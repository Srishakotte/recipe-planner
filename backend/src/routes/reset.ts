import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// POST /api/reset - Clear all user data
// Body: { keepSeedData?: boolean } - if true, re-seeds after clearing
router.post('/', async (req: Request, res: Response) => {
  try {
    const { reseed } = req.body;

    // Delete in correct order to respect foreign keys
    await prisma.groceryItem.deleteMany();
    await prisma.groceryGeneration.deleteMany();
    await prisma.mealPlanEntry.deleteMany();
    await prisma.ingredient.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.pantryItem.deleteMany();
    await prisma.userConstraint.deleteMany();

    if (reseed) {
      // Re-create sample recipes
      const spaghetti = await prisma.recipe.create({
        data: { name: 'Spaghetti Bolognese', defaultServings: 4, description: 'Classic pasta with meat sauce',
          ingredients: { create: [
            { name: 'spaghetti', quantity: 400, unit: 'g', storeSection: 'pantry', sortOrder: 0 },
            { name: 'ground beef', quantity: 500, unit: 'g', storeSection: 'meat', sortOrder: 1 },
            { name: 'onion', quantity: 2, unit: 'piece', storeSection: 'produce', sortOrder: 2 },
            { name: 'garlic', quantity: 4, unit: 'clove', storeSection: 'produce', sortOrder: 3 },
            { name: 'canned tomatoes', quantity: 2, unit: 'can', storeSection: 'pantry', sortOrder: 4 },
            { name: 'olive oil', quantity: 2, unit: 'tbsp', storeSection: 'pantry', sortOrder: 5 },
            { name: 'salt', quantity: 1, unit: 'tsp', storeSection: 'pantry', sortOrder: 6 },
            { name: 'parmesan', quantity: 50, unit: 'g', storeSection: 'dairy', sortOrder: 7 },
          ] } },
      });

      const stirFry = await prisma.recipe.create({
        data: { name: 'Chicken Stir Fry', defaultServings: 2, description: 'Quick weeknight stir fry',
          ingredients: { create: [
            { name: 'chicken breast', quantity: 300, unit: 'g', storeSection: 'meat', sortOrder: 0 },
            { name: 'bell pepper', quantity: 2, unit: 'piece', storeSection: 'produce', sortOrder: 1 },
            { name: 'broccoli', quantity: 200, unit: 'g', storeSection: 'produce', sortOrder: 2 },
            { name: 'soy sauce', quantity: 3, unit: 'tbsp', storeSection: 'pantry', sortOrder: 3 },
            { name: 'garlic', quantity: 3, unit: 'clove', storeSection: 'produce', sortOrder: 4 },
            { name: 'rice', quantity: 200, unit: 'g', storeSection: 'pantry', sortOrder: 5 },
            { name: 'green onion', quantity: 3, unit: 'piece', storeSection: 'produce', sortOrder: 6 },
          ] } },
      });

      const pancakes = await prisma.recipe.create({
        data: { name: 'Fluffy Pancakes', defaultServings: 4, description: 'Classic breakfast pancakes',
          ingredients: { create: [
            { name: 'flour', quantity: 2, unit: 'cup', storeSection: 'pantry', sortOrder: 0 },
            { name: 'milk', quantity: 1.5, unit: 'cup', storeSection: 'dairy', sortOrder: 1 },
            { name: 'egg', quantity: 2, unit: 'piece', storeSection: 'dairy', sortOrder: 2 },
            { name: 'sugar', quantity: 3, unit: 'tbsp', storeSection: 'pantry', sortOrder: 3 },
            { name: 'butter', quantity: 3, unit: 'tbsp', storeSection: 'dairy', sortOrder: 4 },
            { name: 'baking powder', quantity: 2, unit: 'tsp', storeSection: 'pantry', sortOrder: 5 },
          ] } },
      });

      await prisma.recipe.create({
        data: { name: 'Caesar Salad', defaultServings: 2, description: 'Fresh romaine with caesar dressing',
          ingredients: { create: [
            { name: 'romaine lettuce', quantity: 1, unit: 'piece', storeSection: 'produce', sortOrder: 0 },
            { name: 'parmesan', quantity: 30, unit: 'g', storeSection: 'dairy', sortOrder: 1 },
            { name: 'croutons', quantity: 1, unit: 'cup', storeSection: 'bakery', sortOrder: 2 },
            { name: 'olive oil', quantity: 3, unit: 'tbsp', storeSection: 'pantry', sortOrder: 3 },
            { name: 'garlic', quantity: 2, unit: 'clove', storeSection: 'produce', sortOrder: 4 },
            { name: 'lemon juice', quantity: 2, unit: 'tbsp', storeSection: 'produce', sortOrder: 5 },
          ] } },
      });

      await prisma.recipe.create({
        data: { name: 'Creamy Tomato Soup', defaultServings: 4, description: 'Rich and creamy tomato soup',
          ingredients: { create: [
            { name: 'canned tomatoes', quantity: 3, unit: 'can', storeSection: 'pantry', sortOrder: 0 },
            { name: 'onion', quantity: 1, unit: 'piece', storeSection: 'produce', sortOrder: 1 },
            { name: 'garlic', quantity: 3, unit: 'clove', storeSection: 'produce', sortOrder: 2 },
            { name: 'cream', quantity: 1, unit: 'cup', storeSection: 'dairy', sortOrder: 3 },
            { name: 'butter', quantity: 2, unit: 'tbsp', storeSection: 'dairy', sortOrder: 4 },
            { name: 'salt', quantity: 1, unit: 'tsp', storeSection: 'pantry', sortOrder: 5 },
          ] } },
      });

      await prisma.recipe.create({
        data: { name: 'Beef Tacos', defaultServings: 4, description: 'Simple beef tacos',
          ingredients: { create: [
            { name: 'ground beef', quantity: 500, unit: 'g', storeSection: 'meat', sortOrder: 0 },
            { name: 'taco shells', quantity: 8, unit: 'piece', storeSection: 'pantry', sortOrder: 1 },
            { name: 'onion', quantity: 1, unit: 'piece', storeSection: 'produce', sortOrder: 2 },
            { name: 'tomato', quantity: 2, unit: 'piece', storeSection: 'produce', sortOrder: 3 },
            { name: 'cheddar cheese', quantity: 100, unit: 'g', storeSection: 'dairy', sortOrder: 4 },
            { name: 'sour cream', quantity: 0.5, unit: 'cup', storeSection: 'dairy', sortOrder: 5 },
            { name: 'garlic', quantity: 2, unit: 'clove', storeSection: 'produce', sortOrder: 6 },
          ] } },
      });

      // Re-create pantry items
      await prisma.pantryItem.createMany({
        data: [
          { name: 'olive oil', quantity: 500, unit: 'ml' },
          { name: 'salt', quantity: 500, unit: 'g' },
          { name: 'sugar', quantity: 1, unit: 'kg' },
          { name: 'flour', quantity: 2, unit: 'kg' },
          { name: 'rice', quantity: 1, unit: 'kg' },
          { name: 'soy sauce', quantity: 250, unit: 'ml' },
          { name: 'onion', quantity: 3, unit: 'piece', expirationDate: new Date(Date.now() + 2 * 86400000) },
          { name: 'garlic', quantity: 8, unit: 'clove', expirationDate: new Date(Date.now() + 5 * 86400000) },
          { name: 'milk', quantity: 1, unit: 'l', expirationDate: new Date(Date.now() + 1 * 86400000) },
          { name: 'eggs', quantity: 6, unit: 'piece', expirationDate: new Date(Date.now() + 7 * 86400000) },
        ],
      });

      // Create some meal plan entries for current week
      const today = new Date();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      monday.setDate(today.getDate() + diff);
      monday.setHours(12, 0, 0, 0);

      await prisma.mealPlanEntry.createMany({
        data: [
          { recipeId: stirFry.id, planDate: monday, mealSlot: 'dinner', servings: 2 },
          { recipeId: pancakes.id, planDate: new Date(monday.getTime() + 86400000), mealSlot: 'breakfast', servings: 4 },
          { recipeId: spaghetti.id, planDate: new Date(monday.getTime() + 86400000 * 2), mealSlot: 'dinner', servings: 4 },
        ],
      });

      res.json({ message: 'Application reset with sample data. Enjoy!' });
    } else {
      res.json({ message: 'Application cleared. Start adding your own recipes!' });
    }
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Failed to reset application data' });
  }
});

export default router;
