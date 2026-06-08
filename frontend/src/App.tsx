import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './shared/components/Layout';
import RecipesPage from './features/recipes/pages/RecipesPage';
import MealPlanPage from './features/meal-plan/pages/MealPlanPage';
import GroceryListPage from './features/grocery-list/pages/GroceryListPage';
import PantryPage from './features/pantry/pages/PantryPage';
import SubstitutionsPage from './features/substitutions/components/SubstitutionsPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="meal-plan" element={<MealPlanPage />} />
          <Route path="grocery-list" element={<GroceryListPage />} />
          <Route path="pantry" element={<PantryPage />} />
          <Route path="substitutions" element={<SubstitutionsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
