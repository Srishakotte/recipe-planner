import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface AnalyticsData {
  overview: { totalRecipes: number; totalPantryItems: number; totalMealsPlanned: number; groceryListItems: number };
  mealsPerDay: { day: string; meals: number }[];
  topIngredients: { name: string; count: number }[];
  groceryStats: { total: number; checked: number; unchecked: number; adHoc: number };
  sectionBreakdown: { name: string; value: number }[];
  slotBreakdown: { name: string; value: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const quickActions = [
  { label: 'Plan Meals', icon: '📅', to: '/meal-plan', color: 'from-green-500 to-emerald-600' },
  { label: 'Browse Recipes', icon: '📖', to: '/recipes', color: 'from-blue-500 to-indigo-600' },
  { label: 'Grocery List', icon: '🛒', to: '/grocery-list', color: 'from-amber-500 to-orange-600' },
  { label: 'My Pantry', icon: '🏠', to: '/pantry', color: 'from-purple-500 to-violet-600' },
];

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    fetch('/api/analytics/summary')
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
        <p className="mt-4 text-gray-500 animate-pulse">Loading your kitchen...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 text-white p-8 mb-8">
        <div className="absolute top-0 right-0 opacity-10 text-[150px] leading-none select-none">🍽️</div>
        <div className="relative">
          <h1 className="text-3xl font-bold">{greeting}! 👋</h1>
          <p className="mt-2 text-green-100 text-lg">Ready to plan some delicious meals?</p>
          {data && data.overview.totalMealsPlanned > 0 ? (
            <p className="mt-1 text-green-200 text-sm">
              You have {data.overview.totalMealsPlanned} meals planned this week with {data.overview.groceryListItems} items on your grocery list
            </p>
          ) : (
            <p className="mt-1 text-green-200 text-sm">Start by adding recipes to your meal plan for the week</p>
          )}
          <Link
            to="/meal-plan"
            className="inline-block mt-4 px-5 py-2.5 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-all hover:scale-105 shadow-lg"
          >
            Plan This Week →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger-children">
        {quickActions.map(action => (
          <Link
            key={action.to}
            to={action.to}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${action.color} p-5 text-white card-hover group`}
          >
            <span className="absolute -bottom-2 -right-2 text-5xl opacity-20 group-hover:opacity-30 transition-opacity">{action.icon}</span>
            <span className="text-3xl block mb-2">{action.icon}</span>
            <span className="font-semibold text-sm">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Stats Cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger-children">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 card-hover text-center">
              <p className="text-3xl font-bold text-green-600">{data.overview.totalRecipes}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Recipes</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 card-hover text-center">
              <p className="text-3xl font-bold text-blue-600">{data.overview.totalMealsPlanned}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Meals Planned</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 card-hover text-center">
              <p className="text-3xl font-bold text-amber-600">{data.overview.groceryListItems}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Grocery Items</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 card-hover text-center">
              <p className="text-3xl font-bold text-purple-600">{data.overview.totalPantryItems}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">In Pantry</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Meals Per Day</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.mealsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="meals" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Top Ingredients</h3>
              {data.topIngredients.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Plan some meals to see insights</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.topIngredients.slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={75} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Grocery + Slot breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.sectionBreakdown.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Grocery by Section</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.sectionBreakdown} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name" label={({ name }) => name}>
                      {data.sectionBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {data.groceryStats.total > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Shopping Progress</h3>
                <div className="flex items-center justify-center py-6">
                  <div className="relative w-36 h-36">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="72" cy="72" r="60" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                      <circle
                        cx="72" cy="72" r="60" fill="none" stroke="#10b981" strokeWidth="12"
                        strokeDasharray={`${(data.groceryStats.checked / data.groceryStats.total) * 377} 377`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                        {Math.round((data.groceryStats.checked / data.groceryStats.total) * 100)}%
                      </span>
                      <span className="text-xs text-gray-500">complete</span>
                    </div>
                  </div>
                </div>
                <p className="text-center text-sm text-gray-500">
                  {data.groceryStats.checked} of {data.groceryStats.total} items checked
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
