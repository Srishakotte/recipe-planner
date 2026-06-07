import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const weekStart = req.query.weekStart as string | undefined;
    let where: any = {};
    if (weekStart) {
      const start = new Date(weekStart);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      where.planDate = { gte: start, lt: end };
    }
    const entries = await prisma.mealPlanEntry.findMany({
      where, include: { recipe: { include: { ingredients: true } } },
      orderBy: [{ planDate: 'asc' }, { mealSlot: 'asc' }],
    });
    res.json(entries);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch meal plan' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { recipeId, planDate, mealSlot, servings } = req.body;
    if (!recipeId || !planDate) { res.status(400).json({ error: 'recipeId and planDate required' }); return; }
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }
    const entry = await prisma.mealPlanEntry.create({
      data: { recipeId, planDate: new Date(planDate), mealSlot: mealSlot || 'dinner', servings: servings || recipe.defaultServings },
      include: { recipe: { include: { ingredients: true } } },
    });
    res.status(201).json(entry);
  } catch (error) { res.status(500).json({ error: 'Failed to add meal plan entry' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { recipeId, planDate, mealSlot, servings } = req.body;
    const entry = await prisma.mealPlanEntry.update({
      where: { id: req.params.id },
      data: {
        ...(recipeId && { recipeId }), ...(planDate && { planDate: new Date(planDate) }),
        ...(mealSlot && { mealSlot }), ...(servings && { servings }),
      },
      include: { recipe: { include: { ingredients: true } } },
    });
    res.json(entry);
  } catch (error) { res.status(500).json({ error: 'Failed to update meal plan entry' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.mealPlanEntry.delete({ where: { id: req.params.id } });
    res.json({ message: 'Meal plan entry deleted' });
  } catch (error) { res.status(500).json({ error: 'Failed to delete meal plan entry' }); }
});

export default router;
