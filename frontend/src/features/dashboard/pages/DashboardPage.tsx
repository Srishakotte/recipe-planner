import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface AnalyticsData {
  overview: {
    totalRecipes: number;
    totalPantryItems: number;
    totalMealsPlanned: number;
    groceryListItems: number;
  };
  mealsPerDay: { day: string; meals: number }[];
  topIngredients: { name: string; count: number }[];
  groceryStats: { total: number; checked: number; unchecked: number; adHoc: number };
  sectionBreakdown: { name: string; value: number }[];
  slotBreakdown: { name: string; value: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/summary')
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">Failed to load analytics</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{data.overview.totalRecipes}</p>
          <p className="text-sm text-gray-500 mt-1">Recipes</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{data.overview.totalMealsPlanned}</p>
          <p className="text-sm text-gray-500 mt-1">Meals Planned</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{data.overview.groceryListItems}</p>
          <p className="text-sm text-gray-500 mt-1">Grocery Items</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{data.overview.totalPantryItems}</p>
          <p className="text-sm text-gray-500 mt-1">Pantry Items</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Meals per day chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Meals Per Day</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.mealsPerDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="meals" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Ingredients */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Most Used Ingredients</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.topIngredients} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Grocery by section pie */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Grocery by Store Section</h3>
          {data.sectionBreakdown.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No grocery data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.sectionBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {data.sectionBreakdown.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Meal slot breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Meals by Slot</h3>
          {data.slotBreakdown.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No meal plan data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.slotBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {data.slotBreakdown.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Grocery progress */}
      {data.groceryStats.total > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Shopping Progress</h3>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full transition-all"
              style={{ width: `${(data.groceryStats.checked / data.groceryStats.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {data.groceryStats.checked} of {data.groceryStats.total} items checked off
          </p>
        </div>
      )}
    </div>
  );
}
