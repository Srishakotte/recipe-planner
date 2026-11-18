import { Router } from 'express';
import { z } from 'zod';
import { aiStatus } from '../ai/client';
import { recommend, whatsForDinner, fixRecipe, suggestSubstitutes, pantryIdeas, weeklyNutrition, estimateCost, scanGroceries } from '../services/kitchen';
import { itemsToBuy } from '../services/grocery';
import { askAssistant } from '../services/assistant';
import { asyncHandler, parseBody, HttpError } from '../lib/http';

const router = Router();

// Every response is { data, source: 'ai' | 'fallback' } so the UI can label it.

router.get('/status', (_req, res) => { res.json(aiStatus()); });

router.get('/recommend', asyncHandler(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : '';
  res.json(await recommend({ query, limit: 8 }));
}));

router.get('/dinner', asyncHandler(async (_req, res) => { res.json(await whatsForDinner()); }));

router.get('/fix-recipe/:id', asyncHandler(async (req, res) => { res.json(await fixRecipe(req.params.id)); }));

router.post('/substitutes', asyncHandler(async (req, res) => {
  const { ingredient } = parseBody(z.object({ ingredient: z.string().trim().min(1).max(80) }), req.body);
  res.json(await suggestSubstitutes(ingredient));
}));

// Gemini Vision: photo of a fridge, shelf or receipt -> pantry items to confirm
const scanSchema = z.object({
  image: z.string().min(100).max(10_000_000), // base64, no data: prefix
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  kind: z.enum(['fridge', 'receipt']).default('fridge'),
});
router.post('/scan', asyncHandler(async (req, res) => {
  const { image, mimeType, kind } = parseBody(scanSchema, req.body);
  const items = await scanGroceries(image, mimeType, kind);
  if (!items) throw new HttpError(503, 'Scanning needs a working GEMINI_API_KEY (Gemini Vision)');
  res.json({ data: items, source: 'ai' });
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
