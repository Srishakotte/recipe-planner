import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// Helper: call Gemini API
async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return JSON.stringify({ error: 'Gemini API key not configured' });
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });
    const data: any = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify({ error: 'No response' });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

// POST /api/ai/suggest-recipes
router.post('/suggest-recipes', async (req: Request, res: Response) => {
  try {
    const pantryItems = await prisma.pantryItem.findMany();
    const ingredients = pantryItems.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ');

    const prompt = `I have these ingredients: ${ingredients}. Suggest 3 quick recipes. Return ONLY JSON array: [{"name":"...","cookingTime":15,"calories":350,"protein":12,"difficulty":"easy","ingredientsUsed":["rice","onion"]}]`;

    const response = await callGemini(prompt);
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const recipes = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json({ suggestions: recipes, source: 'ai' });
    } catch { res.json({ suggestions: [], source: 'fallback' }); }
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
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

export default router;
