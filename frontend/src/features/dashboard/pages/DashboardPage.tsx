import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useResetAppDataMutation } from '../../../app/api';
import { showToast } from '../../../shared/components/Toast';

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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetAppData, { isLoading: isResetting }] = useResetAppDataMutation();

  const fetchData = () => {
    setLoading(true);
    fetch('/api/analytics/summary')
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Start Fresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger-children">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 text-center card-hover">
          <p className="text-4xl font-bold text-green-600 dark:text-green-400">{data.overview.totalRecipes}</p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1 font-medium">Recipes</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 text-center card-hover">
          <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{data.overview.totalMealsPlanned}</p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 font-medium">Meals Planned</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-center card-hover">
          <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">{data.overview.groceryListItems}</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 font-medium">Grocery Items</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-5 text-center card-hover">
          <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">{data.overview.totalPantryItems}</p>
          <p className="text-sm text-purple-700 dark:text-purple-300 mt-1 font-medium">Pantry Items</p>
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

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-red-700 mb-2">Start Fresh?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete all your recipes, meal plans, pantry items, grocery lists, and dietary constraints.
              Reference data (unit conversions, synonyms, densities, substitution rules) will be kept.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Choose how you'd like to start:
            </p>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  const result = await resetAppData({ reseed: true });
                  if ('data' in result) {
                    showToast('Reset with sample data!', 'success');
                    setShowResetConfirm(false);
                    fetchData();
                  } else { showToast('Failed to reset', 'error'); }
                }}
                disabled={isResetting}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-4 py-3 rounded-lg font-medium transition-colors text-left"
              >
                <span className="block font-semibold">Reset with Sample Data</span>
                <span className="block text-xs text-amber-100 mt-0.5">Clear everything and load demo recipes, pantry items, and a starter meal plan</span>
              </button>
              <button
                onClick={async () => {
                  const result = await resetAppData({});
                  if ('data' in result) {
                    showToast('All data cleared! Start fresh.', 'success');
                    setShowResetConfirm(false);
                    fetchData();
                  } else { showToast('Failed to reset', 'error'); }
                }}
                disabled={isResetting}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-3 rounded-lg font-medium transition-colors text-left"
              >
                <span className="block font-semibold">Completely Empty</span>
                <span className="block text-xs text-red-100 mt-0.5">Clear everything — start from a blank slate, add your own recipes</span>
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
