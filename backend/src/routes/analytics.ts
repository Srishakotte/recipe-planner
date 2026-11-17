import { Router } from 'express';
import prisma from '../prisma';
import { asyncHandler, dateRange, startOfToday, toIsoDate } from '../lib/http';

const router = Router();

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function mondayOf(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIsoDate(d);
}

const countBy = <T>(items: T[], key: (item: T) => string) =>
  items.reduce<Record<string, number>>((acc, item) => { const k = key(item); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
const toPairs = (counts: Record<string, number>) => Object.entries(counts).map(([name, value]) => ({ name, value }));

// GET /api/analytics/summary?weekStart=YYYY-MM-DD (defaults to the current week)
router.get('/summary', asyncHandler(async (req, res) => {
  const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : mondayOf(startOfToday());
  const [totalRecipes, totalPantryItems, weekMeals, groceryGen] = await Promise.all([
    prisma.recipe.count(),
    prisma.pantryItem.count(),
    prisma.mealPlanEntry.findMany({
      where: { planDate: dateRange(weekStart) },
      include: { recipe: { select: { ingredients: { select: { name: true } } } } },
    }),
    prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' }, include: { items: true } }),
  ]);

  const perDay = countBy(weekMeals, m => DAYS[(m.planDate.getUTCDay() + 6) % 7]);
  const ingredientCounts = countBy(weekMeals.flatMap(m => m.recipe.ingredients), i => i.name);
  const groceryItems = groceryGen?.items ?? [];

  res.json({
    weekStart,
    overview: { totalRecipes, totalPantryItems, totalMealsPlanned: weekMeals.length, groceryListItems: groceryItems.length },
    mealsPerDay: DAYS.map(day => ({ day, meals: perDay[day] || 0 })),
    topIngredients: Object.entries(ingredientCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
    groceryStats: {
      total: groceryItems.length,
      checked: groceryItems.filter(i => i.isChecked).length,
      unchecked: groceryItems.filter(i => !i.isChecked).length,
      adHoc: groceryItems.filter(i => i.isAdHoc).length,
    },
    sectionBreakdown: toPairs(countBy(groceryItems, i => i.storeSection)),
    slotBreakdown: toPairs(countBy(weekMeals, m => m.mealSlot)),
  });
}));

export default router;
