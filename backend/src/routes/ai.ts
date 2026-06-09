import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// Helper: call Gemini API using official SDK
async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    console.log('No Gemini API key, using fallback');
    return '';
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('Gemini responded:', text.substring(0, 80));
    return text;
  } catch (error: any) {
    console.error('Gemini SDK error:', error.message);
    return '';
  }
}

// Fallback: generate suggestions from pantry without AI
function generateFallbackRecipes(pantryItems: { name: string; quantity: number; unit: string }[]): any[] {
  const names = pantryItems.map(p => p.name.toLowerCase());
  const suggestions = [];

  if (names.includes('rice') && names.includes('onion')) {
    suggestions.push({ name: 'Garlic Fried Rice', cookingTime: 15, calories: 380, protein: 8, difficulty: 'easy', ingredientsUsed: ['rice', 'onion', 'garlic'] });
  }
  if (names.includes('flour') && names.includes('sugar')) {
    suggestions.push({ name: 'Simple Pancakes', cookingTime: 20, calories: 420, protein: 10, difficulty: 'easy', ingredientsUsed: ['flour', 'sugar', 'milk'] });
  }
  if (names.includes('onion') && names.includes('garlic')) {
    suggestions.push({ name: 'Onion Soup', cookingTime: 30, calories: 180, protein: 5, difficulty: 'easy', ingredientsUsed: ['onion', 'garlic', 'olive oil'] });
  }
  if (names.includes('olive oil') && names.includes('garlic')) {
    suggestions.push({ name: 'Aglio e Olio Pasta', cookingTime: 15, calories: 450, protein: 12, difficulty: 'easy', ingredientsUsed: ['olive oil', 'garlic'] });
  }
  if (names.includes('rice') && names.includes('soy sauce')) {
    suggestions.push({ name: 'Soy Sauce Rice Bowl', cookingTime: 10, calories: 320, protein: 6, difficulty: 'easy', ingredientsUsed: ['rice', 'soy sauce', 'garlic'] });
  }
  if (suggestions.length === 0) {
    suggestions.push({ name: 'Simple Salad', cookingTime: 10, calories: 150, protein: 3, difficulty: 'easy', ingredientsUsed: pantryItems.slice(0, 3).map(p => p.name) });
  }

  return suggestions.slice(0, 3);
}

// POST /api/ai/suggest-recipes
router.post('/suggest-recipes', async (req: Request, res: Response) => {
  try {
    const pantryItems = await prisma.pantryItem.findMany();
    const ingredients = pantryItems.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');

    const prompt = `I have these ingredients: ${ingredients}. Suggest 3 quick recipes I can make. Return ONLY a JSON array with no other text: [{"name":"...","cookingTime":15,"calories":350,"protein":12,"difficulty":"easy","ingredientsUsed":["rice","onion"]}]`;

    const response = await callGemini(prompt);

    if (response) {
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        const recipes = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        if (recipes.length > 0) {
          res.json({ suggestions: recipes, source: 'gemini' });
          return;
        }
      } catch (e) { console.error('Parse error:', e); }
    }

    // Fallback - use hardcoded logic
    const fallback = generateFallbackRecipes(pantryItems.map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit })));
    res.json({ suggestions: fallback, source: 'fallback' });
  } catch (error) {
    console.error('suggest-recipes error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/ai/estimate-nutrition
router.post('/estimate-nutrition', async (req: Request, res: Response) => {
  try {
    const { recipeName, ingredients } = req.body;
    const list = ingredients?.map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(', ') || recipeName;

    const prompt = `Estimate nutrition for: ${recipeName} (${list}). Return ONLY JSON: {"calories":450,"protein":25,"carbs":55,"fats":18}`;

    const response = await callGemini(prompt);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const nutrition = jsonMatch ? JSON.parse(jsonMatch[0]) : { calories: 400, protein: 20, carbs: 50, fats: 15 };
      res.json({ nutrition, source: 'ai' });
    } catch { res.json({ nutrition: { calories: 400, protein: 20, carbs: 50, fats: 15 }, source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/ai/estimate-cost
router.post('/estimate-cost', async (req: Request, res: Response) => {
  try {
    const groceryGen = await prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' }, include: { items: true } });
    const items = groceryGen?.items.filter(i => !i.isAlreadyHave && !i.isChecked && i.computedQty > 0) || [];
    if (items.length === 0) { res.json({ totalCost: 0, items: [], source: 'empty' }); return; }

    const itemList = items.map(i => `${i.computedQty} ${i.unit} ${i.ingredientName}`).join(', ');
    const prompt = `Estimate USD cost for: ${itemList}. Return ONLY JSON: {"totalCost":25.50,"breakdown":[{"item":"chicken","cost":8}]}`;

    const response = await callGemini(prompt);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const cost = jsonMatch ? JSON.parse(jsonMatch[0]) : { totalCost: items.length * 3 };
      res.json({ ...cost, source: 'ai' });
    } catch { res.json({ totalCost: items.length * 3, source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/ai/suggest-substitution
router.post('/suggest-substitution', async (req: Request, res: Response) => {
  try {
    const { ingredient } = req.body;
    const pantryItems = await prisma.pantryItem.findMany();
    const pantryList = pantryItems.map(p => p.name).join(', ');

    const prompt = `Substitution for "${ingredient}". My pantry: ${pantryList}. Prioritize pantry items. Return ONLY JSON array: [{"name":"...","ratio":"1:1","similarityPercent":90,"isInPantry":true,"notes":"..."}]`;

    const response = await callGemini(prompt);
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const subs = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json({ substitutions: subs, source: 'ai' });
    } catch { res.json({ substitutions: [], source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/ai/weekly-plan
router.post('/weekly-plan', async (req: Request, res: Response) => {
  try {
    const recipes = await prisma.recipe.findMany();
    const names = recipes.map(r => r.name).join(', ');

    const prompt = `Generate 7-day meal plan using: ${names}. Return ONLY JSON: {"plan":[{"day":"Monday","breakfast":"...","lunch":"...","dinner":"..."}]}`;

    const response = await callGemini(prompt);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { plan: [] };
      res.json({ ...plan, source: 'ai' });
    } catch { res.json({ plan: [], source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// GET /api/ai/debug-env - check if key is loaded
router.get('/debug-env', (req: Request, res: Response) => {
  const key = process.env.GEMINI_API_KEY;
  res.json({
    hasKey: !!key,
    keyStart: key?.substring(0, 10) || 'none',
    keyLength: key?.length || 0,
  });
});

// GET /api/ai/test-gemini - test actual API call
router.get('/test-gemini', async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(400).json({ error: 'No GEMINI_API_KEY in .env' });
    return;
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Say hello in one word');
    const text = result.response.text();
    res.json({ success: true, text, keyStart: apiKey.substring(0, 10) });
  } catch (error: any) {
    console.error('TEST GEMINI FULL ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor?.name,
      statusCode: error.status || error.statusCode || null,
      details: error.errorDetails || error.response?.data || null,
      keyStart: apiKey.substring(0, 10),
    });
  }
});

export default router;
