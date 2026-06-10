import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { generateGroceryList, GenerationInput } from '../engine/generate';
import { SynonymMap } from '../engine/types';
import crypto from 'crypto';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { weekStart } = req.body;
    let where: any = {};
    
    // Always filter from today onwards — don't generate grocery items for past meals
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (weekStart) {
      const start = new Date(weekStart);
      const effectiveStart = start > today ? start : today;
      const end = new Date(start); end.setDate(end.getDate() + 7);
      where.planDate = { gte: effectiveStart, lt: end };
    } else {
      // Default: from today to 7 days out
      const end = new Date(today); end.setDate(end.getDate() + 7);
      where.planDate = { gte: today, lt: end };
    }

    // Exclude leftover entries that are fully consumed
    where.OR = [
      { isLeftover: false },
      { isLeftover: true, leftoverServings: { gt: 0 } },
      { isLeftover: true, leftoverServings: null },
    ];

    const entries = await prisma.mealPlanEntry.findMany({ where, include: { recipe: { include: { ingredients: true } } } });
    if (entries.length === 0) { res.json({ items: [], warnings: [], generatedAt: new Date().toISOString() }); return; }

    const [pantry, synonyms, conversions, densities, substitutions, constraints] = await Promise.all([
      prisma.pantryItem.findMany(), prisma.ingredientSynonym.findMany(),
      prisma.unitConversion.findMany(), prisma.ingredientDensity.findMany(),
      prisma.substitution.findMany(), prisma.userConstraint.findMany({ where: { isActive: true } }),
    ]);

    const synonymMap: SynonymMap = {};
    for (const s of synonyms) { synonymMap[s.synonym.toLowerCase()] = s.canonicalName.toLowerCase(); }

    const input: GenerationInput = {
      mealPlanEntries: entries.map(e => ({
        recipeId: e.recipeId, recipeName: e.recipe.name, servings: e.servings,
        defaultServings: e.recipe.defaultServings,
        ingredients: e.recipe.ingredients.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, storeSection: i.storeSection })),
      })),
      pantry: pantry.map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit })),
      substitutions: substitutions.map(s => ({
        originalIngredient: s.originalIngredient, substituteIngredient: s.substituteIngredient,
        quantityRatio: s.quantityRatio, substituteUnit: s.substituteUnit,
        constraintType: s.constraintType, constraintValue: s.constraintValue,
      })),
      constraints: constraints.map(c => ({ constraintType: c.constraintType, constraintValue: c.constraintValue })),
      synonymMap,
      conversions: conversions.map(c => ({ fromUnit: c.fromUnit, toUnit: c.toUnit, multiplier: c.multiplier, conversionType: c.conversionType })),
      densities: densities.map(d => ({ ingredientName: d.ingredientName.toLowerCase(), gramsPerMl: d.gramsPerMl })),
    };

    const generatedList = generateGroceryList(input);
    const inputHash = crypto.createHash('md5').update(JSON.stringify(input)).digest('hex');

    const existingGeneration = await prisma.groceryGeneration.findFirst({ where: { inputHash }, include: { items: true }, orderBy: { generatedAt: 'desc' } });
    if (existingGeneration) {
      res.json({ generationId: existingGeneration.id, version: existingGeneration.version, items: existingGeneration.items, warnings: generatedList.warnings, generatedAt: existingGeneration.generatedAt, cached: true });
      return;
    }

    const latestGen = await prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' } });
    const newVersion = (latestGen?.version || 0) + 1;
    const previousItems = latestGen ? await prisma.groceryItem.findMany({ where: { generationId: latestGen.id } }) : [];

    const generation = await prisma.groceryGeneration.create({
      data: {
        version: newVersion, inputHash,
        items: {
          create: generatedList.items.map(item => {
            const prev = previousItems.find(p => p.ingredientName === item.ingredientName && p.unit === item.unit);
            return {
              ingredientName: item.ingredientName, computedQty: item.quantity, unit: item.unit,
              storeSection: item.storeSection, sourceRecipes: item.sources as any,
              warnings: item.warnings.length > 0 ? (item.warnings as any) : null,
              overrideQty: prev?.overrideQty || null, isChecked: prev?.isChecked || false, isAlreadyHave: prev?.isAlreadyHave || false,
            };
          }),
        },
      },
      include: { items: true },
    });

    if (latestGen) {
      const adHocItems = previousItems.filter(p => p.isAdHoc);
      if (adHocItems.length > 0) {
        await prisma.groceryItem.createMany({
          data: adHocItems.map(item => ({
            generationId: generation.id, ingredientName: item.ingredientName, computedQty: item.computedQty,
            unit: item.unit, storeSection: item.storeSection, isAdHoc: true,
            isChecked: item.isChecked, overrideQty: item.overrideQty, isAlreadyHave: item.isAlreadyHave,
          })),
        });
      }
    }

    const finalGeneration = await prisma.groceryGeneration.findUnique({ where: { id: generation.id }, include: { items: true } });
    res.json({ generationId: generation.id, version: generation.version, items: finalGeneration!.items, warnings: generatedList.warnings, generatedAt: generation.generatedAt, cached: false });
  } catch (error) { console.error('Generation error:', error); res.status(500).json({ error: 'Failed to generate grocery list' }); }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { section, uncheckedOnly, warningsOnly } = req.query;
    const latestGen = await prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' }, include: { items: true } });
    if (!latestGen) { res.json({ items: [], generationId: null, version: 0 }); return; }
    let items = latestGen.items;
    if (section) items = items.filter(i => i.storeSection === section);
    if (uncheckedOnly === 'true') items = items.filter(i => !i.isChecked);
    if (warningsOnly === 'true') items = items.filter(i => i.warnings && (i.warnings as any[]).length > 0);
    res.json({ generationId: latestGen.id, version: latestGen.version, generatedAt: latestGen.generatedAt, items });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch grocery list' }); }
});

router.patch('/items/:id/check', async (req: Request, res: Response) => {
  try {
    const { isChecked } = req.body;
    const item = await prisma.groceryItem.update({ where: { id: req.params.id }, data: { isChecked } });
    res.json(item);
  } catch (error) { res.status(500).json({ error: 'Failed to update item' }); }
});

router.patch('/items/:id/override', async (req: Request, res: Response) => {
  try {
    const { overrideQty } = req.body;
    const item = await prisma.groceryItem.update({ where: { id: req.params.id }, data: { overrideQty } });
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
    const latestGen = await prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' } });
    if (!latestGen) { res.status(400).json({ error: 'Generate a grocery list first' }); return; }
    const item = await prisma.groceryItem.create({
      data: { generationId: latestGen.id, ingredientName: name.toLowerCase().trim(), computedQty: quantity, unit, storeSection: storeSection || 'other', isAdHoc: true },
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
