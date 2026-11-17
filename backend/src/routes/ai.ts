import { Router } from 'express';
import { z } from 'zod';
import { aiStatus } from '../ai/client';
import { recommend, whatsForDinner, fixRecipe, suggestSubstitutes, pantryIdeas, weeklyNutrition, estimateCost } from '../services/kitchen';
import { itemsToBuy } from '../services/grocery';
import { askAssistant } from '../services/assistant';
import { asyncHandler, parseBody, HttpError } from '../lib/http';

const router = Router();

// Every response is { data, source: 'ai' | 'fallback' } so the UI can label it.

router.get('/status', (_req, res) => { res.json(aiStatus()); });

router.get('/recommend', asyncHandler(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : '';
  res.json(await recommend(query, 8));
}));

router.get('/dinner', asyncHandler(async (_req, res) => { res.json(await whatsForDinner()); }));

router.get('/fix-recipe/:id', asyncHandler(async (req, res) => { res.json(await fixRecipe(req.params.id)); }));

router.post('/substitutes', asyncHandler(async (req, res) => {
  const { ingredient } = parseBody(z.object({ ingredient: z.string().trim().min(1).max(80) }), req.body);
  res.json(await suggestSubstitutes(ingredient));
}));

router.post('/ideas', asyncHandler(async (_req, res) => { res.json(await pantryIdeas()); }));

router.get('/nutrition', asyncHandler(async (req, res) => {
  const weekStart = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.weekStart);
  res.json(await weeklyNutrition(weekStart));
}));

router.post('/cost', asyncHandler(async (_req, res) => { res.json(await estimateCost(await itemsToBuy())); }));

const assistantSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'model']), text: z.string().min(1).max(2000) })).min(1).max(30),
});

router.post('/assistant', asyncHandler(async (req, res) => {
  const { messages } = parseBody(assistantSchema, req.body);
  const result = await askAssistant(messages);
  if (!result) throw new HttpError(503, 'The assistant needs a working GEMINI_API_KEY in backend/.env');
  res.json(result);
}));

export default router;
