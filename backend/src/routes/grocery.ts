import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { generateGroceryList, GenerationInput } from '../engine/generate';
import { SynonymMap, GroceryWarning } from '../engine/types';
import { convertUnits } from '../engine/convert';
import crypto from 'crypto';

const router = Router();

type GroceryItemRow = Awaited<ReturnType<typeof prisma.groceryItem.findMany>>[number];

const EPSILON = 0.01;
const GENERATIONS_TO_KEEP = 10;

// Serialize regenerations so two requests (e.g. GET + POST /generate fired together)
// can't both read "latest" and create duplicate versions.
let regenerateQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = regenerateQueue.then(fn, fn);
  regenerateQueue = run.catch(() => undefined);
  return run;
}

interface RegenerateOptions { weekStart?: string; fromToday?: boolean }

/**
 * Runs the engine on the current meal plan and stores a new generation when the
 * inputs changed. User edits from the latest generation are carried over:
 *  - quantity override: kept only while the computed need is unchanged; if a recipe is
 *    added/removed/scaled the override is reset and the item gets an `override_reset` notice
 *  - checked / already-have: kept unless the need went UP (then you have to buy more)
 *  - ad-hoc items: always kept
 */
async function regenerate({ weekStart, fromToday }: RegenerateOptions) {
  const where: any = {};
  if (weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    where.planDate = { gte: start, lt: end };
  }
  if (fromToday) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.planDate = { ...where.planDate, gte: today };
  }

  const [entries, pantry, synonyms, conversions, densities, substitutions, constraints] = await Promise.all([
    prisma.mealPlanEntry.findMany({
      where, orderBy: [{ planDate: 'asc' }, { mealSlot: 'asc' }, { id: 'asc' }],
      include: { recipe: { include: { ingredients: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } } },
    }),
    prisma.pantryItem.findMany({ orderBy: { id: 'asc' } }),
    prisma.ingredientSynonym.findMany({ orderBy: { id: 'asc' } }),
    prisma.unitConversion.findMany({ orderBy: { id: 'asc' } }),
    prisma.ingredientDensity.findMany({ orderBy: { id: 'asc' } }),
    prisma.substitution.findMany({ orderBy: { id: 'asc' } }),
    prisma.userConstraint.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ]);

  // Leftover entries don't need new groceries
  const activeEntries = entries.filter(e => !e.isLeftover);

  const synonymMap: SynonymMap = {};
  for (const s of synonyms) { synonymMap[s.synonym.toLowerCase()] = s.canonicalName.toLowerCase(); }

  const conversionEntries = conversions.map(c => ({ fromUnit: c.fromUnit, toUnit: c.toUnit, multiplier: c.multiplier, conversionType: c.conversionType }));
  const densityEntries = densities.map(d => ({ ingredientName: d.ingredientName.toLowerCase(), gramsPerMl: d.gramsPerMl }));

  const input: GenerationInput = {
    mealPlanEntries: activeEntries.map(e => ({
      recipeId: e.recipeId, recipeName: e.recipe.name, servings: e.servings,
      defaultServings: e.recipe.defaultServings,
      ingredients: e.recipe.ingredients.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, storeSection: i.storeSection })),
    })),
    pantry: pantry.map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit, expirationDate: p.expirationDate?.toISOString() || null })),
    substitutions: substitutions.map(s => ({
      originalIngredient: s.originalIngredient, substituteIngredient: s.substituteIngredient,
      quantityRatio: s.quantityRatio, substituteUnit: s.substituteUnit,
      constraintType: s.constraintType, constraintValue: s.constraintValue,
    })),
    constraints: constraints.map(c => ({ constraintType: c.constraintType, constraintValue: c.constraintValue })),
    synonymMap,
    conversions: conversionEntries,
    densities: densityEntries,
  };

  const inputHash = crypto.createHash('md5').update(JSON.stringify(input)).digest('hex');
  const latestGen = await prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' }, include: { items: true } });

  // Nothing changed since the latest generation -> keep it (and all edits on it) as is.
  // Only the LATEST generation counts: matching an older one would serve a stale list.
  if (latestGen && latestGen.inputHash === inputHash) {
    return { generation: latestGen, warnings: null as any[] | null, cached: true };
  }

  const generatedList = activeEntries.length > 0
    ? generateGroceryList(input)
    : { items: [], warnings: [], generatedAt: new Date().toISOString() };

  const previousItems = latestGen?.items ?? [];
  const previousGenerated = previousItems.filter(p => !p.isAdHoc);

  const toUnit = (qty: number, from: string, to: string, name: string) =>
    from === to ? qty : convertUnits(qty, from, to, conversionEntries, densityEntries, name);

  const newItems = generatedList.items.map(item => {
    const base = {
      ingredientName: item.ingredientName, computedQty: item.quantity, unit: item.unit,
      storeSection: item.storeSection, sourceRecipes: item.sources as any,
    };
    const notices: GroceryWarning[] = [...item.warnings];

    // find the same ingredient in the previous list (unit may have changed, e.g. 900 g -> 1.2 kg)
    const prev = previousGenerated.find(p => p.ingredientName === item.ingredientName && p.unit === item.unit)
      ?? previousGenerated.find(p => p.ingredientName === item.ingredientName && toUnit(1, p.unit, item.unit, item.ingredientName) !== null);

    let overrideQty: number | null = null;
    let isChecked = false;
    let isAlreadyHave = false;

    if (prev) {
      const prevNeed = toUnit(prev.computedQty, prev.unit, item.unit, item.ingredientName);
      const needUnchanged = prevNeed !== null && Math.abs(prevNeed - item.quantity) < EPSILON;
      const needIncreased = prevNeed === null || item.quantity > prevNeed + EPSILON;

      if (prev.overrideQty !== null && prev.overrideQty !== undefined) {
        if (needUnchanged) {
          overrideQty = toUnit(prev.overrideQty, prev.unit, item.unit, item.ingredientName) ?? prev.overrideQty;
          overrideQty = Math.round(overrideQty * 100) / 100;
        } else {
          notices.push({
            type: 'override_reset',
            message: `Your edited amount (${prev.overrideQty} ${prev.unit}) was reset because the meal plan changed: needed ${prev.computedQty} ${prev.unit}, now ${item.quantity} ${item.unit}`,
            ingredientName: item.ingredientName,
          });
        }
      }

      if (prev.isChecked || prev.isAlreadyHave) {
        if (needIncreased) {
          notices.push({
            type: 'quantity_increased',
            message: `You marked this done at ${prev.computedQty} ${prev.unit}, but the meal plan now needs ${item.quantity} ${item.unit}`,
            ingredientName: item.ingredientName,
          });
        } else {
          isChecked = prev.isChecked;
          isAlreadyHave = prev.isAlreadyHave;
        }
      }
    }

    return { ...base, overrideQty, isChecked, isAlreadyHave, warnings: notices.length > 0 ? (notices as any) : null };
  });

  const adHocItems = previousItems.filter(p => p.isAdHoc).map((item: GroceryItemRow) => ({
    ingredientName: item.ingredientName, computedQty: item.computedQty,
    unit: item.unit, storeSection: item.storeSection, isAdHoc: true,
    isChecked: item.isChecked, overrideQty: item.overrideQty, isAlreadyHave: item.isAlreadyHave,
  }));

  const newVersion = (latestGen?.version || 0) + 1;
  const generation = await prisma.$transaction(async tx => {
    const created = await tx.groceryGeneration.create({
      data: { version: newVersion, inputHash, items: { create: [...newItems, ...adHocItems] } },
      include: { items: true },
    });
    // keep the history bounded
    await tx.groceryGeneration.deleteMany({ where: { version: { lte: newVersion - GENERATIONS_TO_KEEP } } });
    return created;
  });

  return { generation, warnings: generatedList.warnings, cached: false };
}

function sortItems<T extends { storeSection: string; ingredientName: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.storeSection.localeCompare(b.storeSection) || a.ingredientName.localeCompare(b.ingredientName));
}

function collectWarnings(items: { warnings: any }[]) {
  return items.flatMap(i => (Array.isArray(i.warnings) ? i.warnings : []));
}

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { weekStart, fromToday } = req.body || {};
    const { generation, warnings, cached } = await serialized(() => regenerate({ weekStart, fromToday }));
    const items = sortItems(generation.items);
    res.json({
      generationId: generation.id, version: generation.version, generatedAt: generation.generatedAt,
      items, warnings: warnings ?? collectWarnings(items), cached,
    });
  } catch (error) { console.error('Generation error:', error); res.status(500).json({ error: 'Failed to generate grocery list' }); }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { section, uncheckedOnly, warningsOnly } = req.query;
    // Always bring the list up to date first: recipe edits, pantry changes, new
    // substitution rules or constraints all change the inputs. If nothing changed
    // this is a cheap hash comparison and the stored list (with edits) is returned.
    const { generation } = await serialized(() => regenerate({ fromToday: true }));
    let items = generation.items;
    if (section) items = items.filter(i => i.storeSection === section);
    if (uncheckedOnly === 'true') items = items.filter(i => !i.isChecked);
    if (warningsOnly === 'true') items = items.filter(i => i.warnings && (i.warnings as any[]).length > 0);
    res.json({ generationId: generation.id, version: generation.version, generatedAt: generation.generatedAt, items: sortItems(items) });
  } catch (error) { console.error('Grocery fetch error:', error); res.status(500).json({ error: 'Failed to fetch grocery list' }); }
});

// drop the one-time 'plan changed' notices once the user acts on the item
function withoutNotices(warnings: any, type: string) {
  if (!Array.isArray(warnings)) return warnings ?? undefined;
  const kept = warnings.filter((w: any) => w?.type !== type);
  return kept.length > 0 ? kept : Prisma.DbNull;
}

router.patch('/items/:id/check', async (req: Request, res: Response) => {
  try {
    const { isChecked } = req.body;
    const existing = await prisma.groceryItem.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }
    const item = await prisma.groceryItem.update({
      where: { id: req.params.id },
      data: { isChecked: !!isChecked, warnings: withoutNotices(existing.warnings, 'quantity_increased') },
    });
    res.json(item);
  } catch (error) { res.status(500).json({ error: 'Failed to update item' }); }
});

// body: { overrideQty: number } to set, { overrideQty: null } to go back to the computed amount
router.patch('/items/:id/override', async (req: Request, res: Response) => {
  try {
    const { overrideQty } = req.body;
    if (overrideQty !== null && (typeof overrideQty !== 'number' || !isFinite(overrideQty) || overrideQty < 0)) {
      res.status(400).json({ error: 'overrideQty must be a non-negative number or null' }); return;
    }
    const existing = await prisma.groceryItem.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }
    // editing an ad-hoc item just changes its amount
    const data = existing.isAdHoc && overrideQty !== null
      ? { computedQty: overrideQty, overrideQty: null }
      : { overrideQty: overrideQty !== null && Math.abs(overrideQty - existing.computedQty) < 0.001 ? null : overrideQty };
    const item = await prisma.groceryItem.update({
      where: { id: req.params.id },
      data: { ...data, warnings: withoutNotices(existing.warnings, 'override_reset') },
    });
    res.json(item);
  } catch (error) { res.status(500).json({ error: 'Failed to override quantity' }); }
});

router.patch('/items/:id/already-have', async (req: Request, res: Response) => {
  try {
    const item = await prisma.groceryItem.update({ where: { id: req.params.id }, data: { isAlreadyHave: true, isChecked: true } });
    const { addToPantry } = req.body;
    if (addToPantry) {
      await prisma.pantryItem.create({ data: { name: item.ingredientName, quantity: item.overrideQty || item.computedQty, unit: item.unit } });
    }
    res.json(item);
  } catch (error) { res.status(500).json({ error: 'Failed to update item' }); }
});

router.post('/items/ad-hoc', async (req: Request, res: Response) => {
  try {
    const { name, quantity, unit, storeSection } = req.body;
    if (!name || !quantity || !unit) { res.status(400).json({ error: 'name, quantity, and unit required' }); return; }
    const latestGen = (await prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' } }))
      ?? (await serialized(() => regenerate({ fromToday: true }))).generation;
    const item = await prisma.groceryItem.create({
      data: { generationId: latestGen.id, ingredientName: name.toLowerCase().trim(), computedQty: Number(quantity), unit, storeSection: storeSection || 'other', isAdHoc: true },
    });
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: 'Failed to add item' }); }
});

router.delete('/items/:id', async (req: Request, res: Response) => {
  try {
    await prisma.groceryItem.delete({ where: { id: req.params.id } });
    res.json({ message: 'Item deleted' });
  } catch (error) { res.status(500).json({ error: 'Failed to delete item' }); }
});

export default router;
