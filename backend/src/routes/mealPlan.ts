import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { asyncHandler, parseBody, HttpError, dateRange, startOfToday } from '../lib/http';

const router = Router();

const entrySchema = z.object({
  recipeId: z.string().min(1),
  planDate: z.string().min(1),
  mealSlot: z.string().optional(),
  servings: z.coerce.number().int().min(1).max(50).optional(),
  isLeftover: z.boolean().optional(),
  leftoverExpiryDate: z.string().optional().nullable(),
});

const hidden = { embedding: true, embeddingKey: true } as const;
const withRecipe = { recipe: { include: { ingredients: true }, omit: hidden } };
const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);

router.get('/', asyncHandler(async (req, res) => {
  const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined;
  res.json(await prisma.mealPlanEntry.findMany({
    where: weekStart ? { planDate: dateRange(weekStart) } : {},
    include: withRecipe, orderBy: [{ planDate: 'asc' }, { mealSlot: 'asc' }],
  }));
}));

// available leftovers (not expired)
router.get('/leftovers', asyncHandler(async (_req, res) => {
  res.json(await prisma.mealPlanEntry.findMany({
    where: { isLeftover: true, OR: [{ leftoverExpiryDate: null }, { leftoverExpiryDate: { gte: startOfToday() } }] },
    include: { recipe: { omit: hidden } },
  }));
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = parseBody(entrySchema, req.body);
  const recipe = await prisma.recipe.findUnique({ where: { id: body.recipeId }, select: { defaultServings: true } });
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  res.status(201).json(await prisma.mealPlanEntry.create({
    data: {
      recipeId: body.recipeId, planDate: new Date(body.planDate), mealSlot: body.mealSlot ?? 'dinner',
      servings: body.servings ?? recipe.defaultServings,
      isLeftover: body.isLeftover ?? false, leftoverExpiryDate: toDate(body.leftoverExpiryDate),
    },
    include: withRecipe,
  }));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  // no defaults in the schema, so only fields that were sent are updated
  const body = parseBody(entrySchema.partial(), req.body);
  const data = {
    ...(body.recipeId && { recipeId: body.recipeId }),
    ...(body.planDate && { planDate: new Date(body.planDate) }),
    ...(body.mealSlot && { mealSlot: body.mealSlot }),
    ...(body.servings !== undefined && { servings: body.servings }),
    ...(body.isLeftover !== undefined && { isLeftover: body.isLeftover }),
    ...(body.leftoverExpiryDate !== undefined && { leftoverExpiryDate: toDate(body.leftoverExpiryDate) }),
    // unmarking a leftover also clears its expiry
    ...(body.isLeftover === false && { leftoverExpiryDate: null }),
  };
  res.json(await prisma.mealPlanEntry.update({ where: { id: req.params.id }, data, include: withRecipe }));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.mealPlanEntry.delete({ where: { id: req.params.id } });
  res.json({ message: 'Meal plan entry deleted' });
}));

export default router;
