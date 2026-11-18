import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { asyncHandler, parseBody, HttpError, startOfToday } from '../lib/http';
import { importFromUrl } from '../services/importer';

const router = Router();

const ingredientSchema = z.object({
  name: z.string().trim().min(1),
  displayName: z.string().optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1),
  storeSection: z.string().default('other'),
});

const recipeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  defaultServings: z.coerce.number().int().min(1).max(50).default(2),
  description: z.string().optional().nullable(),
  steps: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  cuisine: z.string().max(60).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  ingredients: z.array(ingredientSchema).min(1, 'at least one ingredient is required'),
});

// embeddings are internal (semantic search) and large, so never send them to the client
const hidden = { embedding: true, embeddingKey: true } as const;
const withIngredients = { ingredients: { orderBy: { sortOrder: 'asc' as const } } };

function toData(body: z.infer<typeof recipeSchema>) {
  return {
    name: body.name, defaultServings: body.defaultServings,
    description: body.description || null, steps: body.steps || null,
    imageUrl: body.imageUrl || null, cuisine: body.cuisine || null, category: body.category || null, sourceUrl: body.sourceUrl || null,
    ingredients: {
      create: body.ingredients.map((ing, index) => ({
        name: ing.name.replace(/\s+/g, ' ').toLowerCase(), displayName: ing.displayName || ing.name,
        quantity: ing.quantity, unit: ing.unit, storeSection: ing.storeSection, sortOrder: index,
      })),
    },
  };
}

async function assertUniqueName(name: string, exceptId?: string) {
  const existing = await prisma.recipe.findFirst({ where: { name, ...(exceptId && { NOT: { id: exceptId } }) } });
  if (existing) throw new HttpError(409, `A recipe named "${name}" already exists. Please use a different name.`);
}

// My recipes (saved). ?scope=all also returns library recipes.
router.get('/', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const ingredient = typeof req.query.ingredient === 'string' ? req.query.ingredient : undefined;
  res.json(await prisma.recipe.findMany({
    where: {
      ...(req.query.scope !== 'all' && { saved: true }),
      ...(search && { name: { contains: search } }),
      ...(ingredient && { ingredients: { some: { name: { contains: ingredient } } } }),
    },
    include: withIngredients, omit: hidden, orderBy: { name: 'asc' },
  }));
}));

// draft from a web page (not saved; the user reviews it in the form)
router.post('/import-url', asyncHandler(async (req, res) => {
  const { url } = parseBody(z.object({ url: z.string().trim().min(4).max(2000) }), req.body);
  res.json(await importFromUrl(url));
}));

// add a library recipe to My recipes, or remove it again
router.patch('/:id/saved', asyncHandler(async (req, res) => {
  const { saved } = parseBody(z.object({ saved: z.boolean() }), req.body);
  res.json(await prisma.recipe.update({ where: { id: req.params.id }, data: { saved }, include: withIngredients, omit: hidden }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id }, include: withIngredients, omit: hidden });
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  res.json(recipe);
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = parseBody(recipeSchema, req.body);
  await assertUniqueName(body.name);
  res.status(201).json(await prisma.recipe.create({ data: { ...toData(body), source: body.sourceUrl ? 'web' : 'user' }, include: withIngredients, omit: hidden }));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const body = parseBody(recipeSchema, req.body);
  await assertUniqueName(body.name, req.params.id);
  // replace ingredients atomically (validated first, so bad input can't wipe them)
  const recipe = await prisma.$transaction(async tx => {
    await tx.ingredient.deleteMany({ where: { recipeId: req.params.id } });
    return tx.recipe.update({ where: { id: req.params.id }, data: toData(body), include: withIngredients, omit: hidden });
  });
  res.json(recipe);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const upcoming = await prisma.mealPlanEntry.count({ where: { recipeId: req.params.id, planDate: { gte: startOfToday() } } });
  if (upcoming > 0) {
    throw new HttpError(409, 'Cannot delete — recipe is used in upcoming meal plan', {
      usedInDays: upcoming,
      message: `This recipe is planned for ${upcoming} upcoming meal(s). Remove it from the meal plan first.`,
    });
  }
  const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id }, select: { source: true } });
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  // library recipes go back to Discover instead of being deleted
  if (recipe.source === 'library') await prisma.recipe.update({ where: { id: req.params.id }, data: { saved: false } });
  else await prisma.recipe.delete({ where: { id: req.params.id } });
  res.json({ message: 'Recipe removed' });
}));

export default router;
