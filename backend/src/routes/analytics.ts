import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/analytics/summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const [
      totalRecipes,
      totalPantryItems,
      mealPlanEntries,
      groceryGen,
    ] = await Promise.all([
      prisma.recipe.count(),
      prisma.pantryItem.count(),
      prisma.mealPlanEntry.findMany({
        include: { recipe: true },
      }),
      prisma.groceryGeneration.findFirst({
        orderBy: { version: 'desc' },
        include: { items: true },
      }),
    ]);

    // meals per day this week
    const mealsPerDay: Record<string, number> = {};
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const entry of mealPlanEntries) {
      const date = new Date(entry.planDate);
      const dayName = daysOfWeek[date.getDay()];
      mealsPerDay[dayName] = (mealsPerDay[dayName] || 0) + 1;
    }

    // top ingredients across all planned meals
    const ingredientCount: Record<string, number> = {};
    for (const entry of mealPlanEntries) {
      if (entry.recipe) {
        const recipe = await prisma.recipe.findUnique({
          where: { id: entry.recipeId },
          include: { ingredients: true },
        });
        if (recipe) {
          for (const ing of recipe.ingredients) {
            ingredientCount[ing.name] = (ingredientCount[ing.name] || 0) + 1;
          }
        }
      }
    }
    const topIngredients = Object.entries(ingredientCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // grocery list stats
    const groceryItems = groceryGen?.items || [];
    const groceryStats = {
      total: groceryItems.length,
      checked: groceryItems.filter(i => i.isChecked).length,
      unchecked: groceryItems.filter(i => !i.isChecked).length,
      adHoc: groceryItems.filter(i => i.isAdHoc).length,
    };

    // section breakdown
    const sectionBreakdown: Record<string, number> = {};
    for (const item of groceryItems) {
      sectionBreakdown[item.storeSection] = (sectionBreakdown[item.storeSection] || 0) + 1;
    }

    // meals per slot
    const slotBreakdown: Record<string, number> = {};
    for (const entry of mealPlanEntries) {
      slotBreakdown[entry.mealSlot] = (slotBreakdown[entry.mealSlot] || 0) + 1;
    }

    res.json({
      overview: {
        totalRecipes,
        totalPantryItems,
        totalMealsPlanned: mealPlanEntries.length,
        groceryListItems: groceryStats.total,
      },
      mealsPerDay: daysOfWeek.map(day => ({ day, meals: mealsPerDay[day] || 0 })),
      topIngredients,
      groceryStats,
      sectionBreakdown: Object.entries(sectionBreakdown).map(([name, value]) => ({ name, value })),
      slotBreakdown: Object.entries(slotBreakdown).map(([name, value]) => ({ name, value })),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
