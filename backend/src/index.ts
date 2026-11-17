import 'dotenv/config'; // must be first: modules below read process.env at import time
import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import prisma from './prisma';
import recipeRoutes from './routes/recipes';
import mealPlanRoutes from './routes/mealPlan';
import pantryRoutes from './routes/pantry';
import groceryRoutes from './routes/grocery';
import substitutionRoutes from './routes/substitutions';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import { aiStatus } from './ai/client';
import { asyncHandler, errorHandler } from './lib/http';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), ai: aiStatus() });
});

// Start fresh: clears the user's data. Reference data the engine needs
// (unit conversions, densities, synonyms) is kept so conversions keep working.
app.post('/api/reset', asyncHandler(async (_req, res) => {
  await prisma.$transaction([
    prisma.groceryItem.deleteMany(),
    prisma.groceryGeneration.deleteMany(),
    prisma.mealPlanEntry.deleteMany(),
    prisma.ingredient.deleteMany(),
    prisma.recipe.deleteMany(),
    prisma.pantryItem.deleteMany(),
    prisma.substitution.deleteMany(),
    prisma.userConstraint.deleteMany(),
  ]);
  res.json({ message: 'Database cleared. Start fresh!' });
}));

// reload the sample data (runs the seed script)
app.post('/api/reseed', asyncHandler(async (_req, res) => {
  const backendRoot = path.resolve(__dirname, '..');
  const tsNode = path.join(backendRoot, 'node_modules', 'ts-node', 'dist', 'bin.js');
  await promisify(execFile)(process.execPath, [tsNode, 'prisma/seed.ts'], { cwd: backendRoot, timeout: 60_000 });
  res.json({ message: 'Sample data reloaded!' });
}));

app.use('/api/recipes', recipeRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/substitutions', substitutionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  const ai = aiStatus();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(ai.enabled ? `AI: Gemini (${ai.model})` : 'AI: off (no GEMINI_API_KEY) — smart features use built-in fallbacks');
});

export default app;
