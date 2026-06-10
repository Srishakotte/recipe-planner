import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// gemini-1.5-flash is deprecated (June 2025). Use gemini-2.5-flash or gemini-2.5-flash-lite
const GEMINI_MODEL = (() => {
  const envModel = process.env.GEMINI_MODEL;
  // Override deprecated models automatically
  if (!envModel || envModel === 'gemini-1.5-flash' || envModel === 'gemini-2.0-flash') {
    return 'gemini-2.5-flash';
  }
  return envModel;
})();

function getGeminiClient(): any | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return null;
  }
  try {
    const { GoogleGenAI } = require('@google/genai');
    return new GoogleGenAI({ apiKey });
  } catch {
    return null;
  }
}

async function callAI(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    console.log('No GEMINI_API_KEY, using fallback');
    return '';
  }

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    const text = response.text ?? '';
    console.log('Gemini responded:', text.substring(0, 80));
    return text;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Gemini error:', message);
    return '';
  }
}

// Fallback: generate suggestions from pantry without AI
function generateFallbackRecipes(pantryItems: { name: string; quantity: number; unit: string }[]): any[] {
  const names = pantryItems.map(p => p.name.toLowerCase());
  const suggestions = [];
  if (names.includes('rice') && names.includes('onion'))
    suggestions.push({ name: 'Garlic Fried Rice', cookingTime: 15, calories: 380, protein: 8, difficulty: 'easy', ingredientsUsed: ['rice', 'onion', 'garlic'] });
  if (names.includes('flour') && names.includes('sugar'))
    suggestions.push({ name: 'Simple Pancakes', cookingTime: 20, calories: 420, protein: 10, difficulty: 'easy', ingredientsUsed: ['flour', 'sugar', 'milk'] });
  if (names.includes('onion') && names.includes('garlic'))
    suggestions.push({ name: 'Onion Soup', cookingTime: 30, calories: 180, protein: 5, difficulty: 'easy', ingredientsUsed: ['onion', 'garlic', 'olive oil'] });
  if (names.includes('olive oil') && names.includes('garlic'))
    suggestions.push({ name: 'Aglio e Olio Pasta', cookingTime: 15, calories: 450, protein: 12, difficulty: 'easy', ingredientsUsed: ['olive oil', 'garlic'] });
  if (names.includes('rice') && names.includes('soy sauce'))
    suggestions.push({ name: 'Soy Sauce Rice Bowl', cookingTime: 10, calories: 320, protein: 6, difficulty: 'easy', ingredientsUsed: ['rice', 'soy sauce', 'garlic'] });
  if (suggestions.length === 0)
    suggestions.push({ name: 'Simple Salad', cookingTime: 10, calories: 150, protein: 3, difficulty: 'easy', ingredientsUsed: pantryItems.slice(0, 3).map(p => p.name) });
  return suggestions.slice(0, 3);
}

// GET /api/ai/test
router.get('/test', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) { res.status(400).json({ success: false, error: 'No GEMINI_API_KEY in .env or @google/genai not installed' }); return; }
  try {
    const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: 'Say hello in one word' });
    const text = response.text ?? '';
    res.json({ success: true, provider: 'gemini', model: GEMINI_MODEL, text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

// POST /api/ai/suggest-recipes
router.post('/suggest-recipes', async (req: Request, res: Response) => {
  try {
    const pantryItems = await prisma.pantryItem.findMany();
    const ingredients = pantryItems.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');
    const prompt = `I have these ingredients in my pantry: ${ingredients}. Suggest 3 quick recipes I can make using ONLY these ingredients. Return ONLY a valid JSON array, no other text: [{"name":"Recipe Name","cookingTime":15,"calories":350,"protein":12,"difficulty":"easy","ingredientsUsed":["rice","onion"]}]`;
    const response = await callAI(prompt);
    if (response) {
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        const recipes = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        if (recipes.length > 0) { res.json({ suggestions: recipes, source: 'gemini' }); return; }
      } catch (e) { console.error('Parse error:', e); }
    }
    const fallback = generateFallbackRecipes(pantryItems.map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit })));
    res.json({ suggestions: fallback, source: 'fallback' });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/ai/estimate-nutrition
router.post('/estimate-nutrition', async (req: Request, res: Response) => {
  try {
    const { recipeName, ingredients } = req.body;

    // If called with 'weekly-plan', fetch actual meal plan data for the current week
    if (recipeName === 'weekly-plan') {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);

      const entries = await prisma.mealPlanEntry.findMany({
        where: { planDate: { gte: monday, lt: sunday } },
        include: { recipe: { include: { ingredients: true } } },
        orderBy: { planDate: 'asc' },
      });

      if (entries.length === 0) {
        res.json({ nutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 }, source: 'empty' });
        return;
      }

      // Build per-day meal descriptions for AI
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const dayMeals: Record<string, string[]> = {};
      entries.forEach(e => {
        const date = new Date(e.planDate);
        const dayIdx = (date.getDay() + 6) % 7; // Mon=0
        const dayName = days[dayIdx];
        if (!dayMeals[dayName]) dayMeals[dayName] = [];
        const ings = e.recipe.ingredients.map((i: any) => `${i.quantity * (e.servings / e.recipe.defaultServings)} ${i.unit} ${i.name}`).join(', ');
        dayMeals[dayName].push(`${e.mealSlot}: ${e.recipe.name} (${e.servings} servings) - ingredients: ${ings}`);
      });

      const mealDescription = Object.entries(dayMeals)
        .map(([day, meals]) => `${day}: ${meals.join(' | ')}`)
        .join('\n');

      const prompt = `Estimate daily nutrition (calories, protein in grams, carbs in grams, fats in grams) for each day of this weekly meal plan. Be realistic based on the ingredients and portions:\n\n${mealDescription}\n\nReturn ONLY valid JSON array, no other text: [{"day":"Monday","calories":1850,"protein":95,"carbs":210,"fats":62},{"day":"Tuesday","calories":2100,"protein":110,"carbs":240,"fats":70}]`;

      const response = await callAI(prompt);
      if (response) {
        try {
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          const nutrition = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          if (nutrition && nutrition.length > 0) {
            res.json({ nutrition, source: 'gemini' });
            return;
          }
        } catch (e) { console.error('Parse error:', e); }
      }

      // Fallback: estimate based on number of meals per day
      const fallback = days.map(day => {
        const meals = dayMeals[day] || [];
        const mealCount = meals.length;
        return {
          day,
          calories: mealCount * 550 + Math.round(Math.random() * 200),
          protein: mealCount * 28 + Math.round(Math.random() * 15),
          carbs: mealCount * 65 + Math.round(Math.random() * 30),
          fats: mealCount * 20 + Math.round(Math.random() * 10),
        };
      });
      res.json({ nutrition: fallback, source: 'fallback' });
      return;
    }

    // Single recipe nutrition estimation
    const list = ingredients?.map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(', ') || recipeName;
    const prompt = `Estimate the nutrition for this meal: ${recipeName} with ingredients: ${list}. Return ONLY valid JSON, no other text: {"calories":450,"protein":25,"carbs":55,"fats":18}`;
    const response = await callAI(prompt);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const nutrition = jsonMatch ? JSON.parse(jsonMatch[0]) : { calories: 400, protein: 20, carbs: 50, fats: 15 };
      res.json({ nutrition, source: response ? 'gemini' : 'fallback' });
    } catch { res.json({ nutrition: { calories: 400, protein: 20, carbs: 50, fats: 15 }, source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/ai/estimate-cost
router.post('/estimate-cost', async (req: Request, res: Response) => {
  try {
    const groceryGen = await prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' }, include: { items: true } });
    const items = groceryGen?.items.filter(i => !i.isAlreadyHave && !i.isChecked && i.computedQty > 0) || [];
    if (items.length === 0) { res.json({ totalCost: 0, breakdown: [], source: 'empty' }); return; }
    const itemList = items.map(i => `${i.computedQty} ${i.unit} ${i.ingredientName}`).join(', ');
    const prompt = `Estimate the total Indian Rupees (INR ₹) grocery cost for these items by checking average prices on Amazon, Flipkart, Zepto, Instamart, BigBasket and giving the average: ${itemList}. Return ONLY valid JSON with no extra text: {"totalCost":780,"currency":"INR","breakdown":[{"item":"chicken breast","cost":250,"unit":"500g"},{"item":"onion","cost":40,"unit":"1kg"}]}`;
    const response = await callAI(prompt);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const cost = jsonMatch ? JSON.parse(jsonMatch[0]) : { totalCost: items.length * 60, currency: 'INR' };
      res.json({ ...cost, source: response ? 'gemini' : 'fallback' });
    } catch { res.json({ totalCost: items.length * 60, currency: 'INR', source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/ai/suggest-substitution
router.post('/suggest-substitution', async (req: Request, res: Response) => {
  try {
    const { ingredient } = req.body;
    const pantryItems = await prisma.pantryItem.findMany();
    const pantryList = pantryItems.map(p => p.name).join(', ');
    const prompt = `I need a substitution for "${ingredient}" in cooking. My pantry has: ${pantryList}. Prioritize pantry items. Return ONLY valid JSON array: [{"name":"substitute name","ratio":"1:1","similarityPercent":90,"isInPantry":true,"notes":"works well in baking"}]`;
    const response = await callAI(prompt);
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const subs = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json({ substitutions: subs, source: response ? 'gemini' : 'fallback' });
    } catch { res.json({ substitutions: [], source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/ai/weekly-plan
router.post('/weekly-plan', async (req: Request, res: Response) => {
  try {
    const recipes = await prisma.recipe.findMany();
    const names = recipes.map(r => r.name).join(', ');
    const prompt = `Generate a balanced 7-day meal plan using these recipes: ${names}. Return ONLY valid JSON: {"plan":[{"day":"Monday","breakfast":"recipe name","lunch":"recipe name","dinner":"recipe name"}]}`;
    const response = await callAI(prompt);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { plan: [] };
      res.json({ ...plan, source: response ? 'gemini' : 'fallback' });
    } catch { res.json({ plan: [], source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
