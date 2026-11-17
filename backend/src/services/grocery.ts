/**
 * Grocery list generation: runs the pure engine on the current meal plan and keeps the
 * user's edits (overrides, check-offs, ad-hoc items) on top of each new generation.
 */
import prisma from '../prisma';
import { generateGroceryList, GenerationInput } from '../engine/generate';
import { GroceryWarning } from '../engine/types';
import { convertUnits } from '../engine/convert';
import crypto from 'crypto';
import { dateRange, startOfToday } from '../lib/http';
import { loadSynonymMap } from './kitchen';

type GroceryItemRow = Awaited<ReturnType<typeof prisma.groceryItem.findMany>>[number];

const EPSILON = 0.01;
const GENERATIONS_TO_KEEP = 10;

// Serialize regenerations so two requests (e.g. GET + POST /generate fired together)
// can't both read "latest" and create duplicate versions.
let regenerateQueue: Promise<unknown> = Promise.resolve();
export function serialized<T>(fn: () => Promise<T>): Promise<T> {
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
export async function regenerate({ weekStart, fromToday }: RegenerateOptions) {
  const where: { planDate?: { gte?: Date; lt?: Date } } = {};
  if (weekStart) where.planDate = dateRange(weekStart);
  if (fromToday) where.planDate = { ...where.planDate, gte: startOfToday() };

  const [entries, pantry, synonymMap, conversions, densities, substitutions, constraints] = await Promise.all([
    prisma.mealPlanEntry.findMany({
      where, orderBy: [{ planDate: 'asc' }, { mealSlot: 'asc' }, { id: 'asc' }],
      include: { recipe: { include: { ingredients: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } }, omit: { embedding: true, embeddingKey: true } } },
    }),
    prisma.pantryItem.findMany({ orderBy: { id: 'asc' } }),
    loadSynonymMap(),
    prisma.unitConversion.findMany({ orderBy: { id: 'asc' } }),
    prisma.ingredientDensity.findMany({ orderBy: { id: 'asc' } }),
    prisma.substitution.findMany({ orderBy: { id: 'asc' } }),
    prisma.userConstraint.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
  ]);

  // Leftover entries don't need new groceries
  const activeEntries = entries.filter(e => !e.isLeftover);

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

export function sortItems<T extends { storeSection: string; ingredientName: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.storeSection.localeCompare(b.storeSection) || a.ingredientName.localeCompare(b.ingredientName));
}

export function collectWarnings(items: { warnings: any }[]) {
  return items.flatMap(i => (Array.isArray(i.warnings) ? i.warnings : []));
}


/** The up-to-date grocery list for today onwards (regenerated if anything changed). */
export async function currentGroceryList() {
  const { generation } = await serialized(() => regenerate({ fromToday: true }));
  return { ...generation, items: sortItems(generation.items) };
}

/** What still has to be bought: not checked, not already at home, quantity > 0. */
export async function itemsToBuy() {
  const list = await currentGroceryList();
  return list.items
    .filter(i => !i.isChecked && !i.isAlreadyHave && (i.overrideQty ?? i.computedQty) > 0)
    .map(i => ({ name: i.ingredientName, quantity: i.overrideQty ?? i.computedQty, unit: i.unit }));
}
