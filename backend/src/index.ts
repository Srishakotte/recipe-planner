import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import recipeRoutes from './routes/recipes';
import mealPlanRoutes from './routes/mealPlan';
import pantryRoutes from './routes/pantry';
import groceryRoutes from './routes/grocery';
import substitutionRoutes from './routes/substitutions';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// routes
app.use('/api/recipes', recipeRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/substitutions', substitutionRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
