import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { asyncHandler, parseBody, HttpError, startOfToday } from '../lib/http';

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
  ingredients: z.array(ingredientSchema).min(1, 'at least one ingredient is required'),
});

// embeddings are internal (semantic search) and large, so never send them to the client
const hidden = { embedding: true, embeddingKey: true } as const;
const withIngredients = { ingredients: { orderBy: { sortOrder: 'asc' as const } } };

function toData(body: z.infer<typeof recipeSchema>) {
  return {
    name: body.name, defaultServings: body.defaultServings,
    description: body.description || null, steps: body.steps || null,
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

router.get('/', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const ingredient = typeof req.query.ingredient === 'string' ? req.query.ingredient : undefined;
  res.json(await prisma.recipe.findMany({
    where: {
      ...(search && { name: { contains: search } }),
      ...(ingredient && { ingredients: { some: { name: { contains: ingredient } } } }),
    },
    include: withIngredients, omit: hidden, orderBy: { name: 'asc' },
  }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id }, include: withIngredients, omit: hidden });
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  res.json(recipe);
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = parseBody(recipeSchema, req.body);
  await assertUniqueName(body.name);
  res.status(201).json(await prisma.recipe.create({ data: toData(body), include: withIngredients, omit: hidden }));
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
  await prisma.recipe.delete({ where: { id: req.params.id } });
  res.json({ message: 'Recipe deleted' });
}));

export default router;
