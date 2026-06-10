import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import recipeRoutes from './routes/recipes';
import mealPlanRoutes from './routes/mealPlan';
import pantryRoutes from './routes/pantry';
import groceryRoutes from './routes/grocery';
import substitutionRoutes from './routes/substitutions';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// reset database (start fresh)
app.post('/api/reset', async (req, res) => {
  try {
    const prisma = require('./prisma').default;
    // delete in correct order (foreign key constraints)
    await prisma.groceryItem.deleteMany();
    await prisma.groceryGeneration.deleteMany();
    await prisma.mealPlanEntry.deleteMany();
    await prisma.ingredient.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.pantryItem.deleteMany();
    await prisma.substitution.deleteMany();
    await prisma.userConstraint.deleteMany();
    await prisma.ingredientSynonym.deleteMany();
    await prisma.unitConversion.deleteMany();
    await prisma.ingredientDensity.deleteMany();
    res.json({ message: 'Database cleared. Start fresh!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// routes
app.use('/api/recipes', recipeRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/substitutions', substitutionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
