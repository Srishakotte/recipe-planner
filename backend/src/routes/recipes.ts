import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const ingredient = req.query.ingredient as string | undefined;
    const where: any = {};
    if (search) where.name = { contains: search };
    if (ingredient) where.ingredients = { some: { name: { contains: ingredient } } };

    const recipes = await prisma.recipe.findMany({
      where, include: { ingredients: { orderBy: { sortOrder: 'asc' } } }, orderBy: { createdAt: 'desc' },
    });
    res.json(recipes);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch recipes' }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: req.params.id }, include: { ingredients: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }
    res.json(recipe);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch recipe' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, defaultServings, description, ingredients } = req.body;
    if (!name || !ingredients || ingredients.length === 0) {
      res.status(400).json({ error: 'Name and at least one ingredient required' }); return;
    }
    const recipe = await prisma.recipe.create({
      data: {
        name, defaultServings: defaultServings || 2, description: description || null,
        steps: req.body.steps || null,
        ingredients: {
          create: ingredients.map((ing: any, index: number) => ({
            name: ing.name.toLowerCase().trim(), displayName: ing.displayName || ing.name,
            quantity: ing.quantity, unit: ing.unit, storeSection: ing.storeSection || 'other', sortOrder: index,
          })),
        },
      },
      include: { ingredients: { orderBy: { sortOrder: 'asc' } } },
    });
    res.status(201).json(recipe);
  } catch (error) { res.status(500).json({ error: 'Failed to create recipe' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, defaultServings, description, ingredients } = req.body;
    await prisma.ingredient.deleteMany({ where: { recipeId: req.params.id } });
    const recipe = await prisma.recipe.update({
      where: { id: req.params.id },
      data: {
        name, defaultServings, description,
        steps: req.body.steps || null,
        ingredients: {
          create: ingredients.map((ing: any, index: number) => ({
            name: ing.name.toLowerCase().trim(), displayName: ing.displayName || ing.name,
            quantity: ing.quantity, unit: ing.unit, storeSection: ing.storeSection || 'other', sortOrder: index,
          })),
        },
      },
      include: { ingredients: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json(recipe);
  } catch (error) { res.status(500).json({ error: 'Failed to update recipe' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.recipe.delete({ where: { id: req.params.id } });
    res.json({ message: 'Recipe deleted' });
  } catch (error) { res.status(500).json({ error: 'Failed to delete recipe' }); }
});

export default router;
