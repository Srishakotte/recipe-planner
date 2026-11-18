import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http';
import { facets, libraryStatus, startLibraryImport } from '../services/library';
import { recommend } from '../services/kitchen';

const router = Router();

router.get('/status', asyncHandler(async (_req, res) => { res.json(await libraryStatus()); }));

// starts the background import of ~870 recipes with photos; poll /status
router.post('/import', asyncHandler(async (_req, res) => { startLibraryImport(); res.status(202).json(await libraryStatus()); }));

router.get('/facets', asyncHandler(async (_req, res) => { res.json(await facets()); }));

// Discover: hybrid RAG search over the whole cookbook, ranked with your pantry
const searchSchema = z.object({
  q: z.string().max(200).optional(),
  cuisine: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

router.get('/search', asyncHandler(async (req, res) => {
  const { q, cuisine, category, limit } = searchSchema.parse(req.query);
  res.json(await recommend({ query: q, cuisine, category, limit, scope: 'all' }));
}));

export default router;
