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

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Food illustrations using emojis in decorative positions
const foodEmojis = ['🥑', '🍅', '🥕', '🧅', '🫑', '🍋', '🥦', '🍊', '🫐', '🍇', '🥬', '🌽'];

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
      <div className="flex flex-col items-center justify-center py-24">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-200 border-t-green-600"></div>
          <span className="absolute inset-0 flex items-center justify-center text-xl">🍳</span>
        </div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Preparing your kitchen...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 text-white p-8 md:p-10 shadow-xl shadow-green-200/40 dark:shadow-green-900/30">
        {/* Floating food decorations */}
        <div className="absolute top-4 right-8 text-4xl opacity-30 animate-float" style={{ animationDelay: '0s' }}>🥗</div>
        <div className="absolute top-12 right-28 text-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }}>🍲</div>
        <div className="absolute bottom-4 right-16 text-5xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>🥘</div>
        <div className="absolute bottom-8 right-48 text-3xl opacity-15 animate-float" style={{ animationDelay: '1.5s' }}>🍜</div>

        <div className="relative z-10">
          <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Your Kitchen Dashboard</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">{greeting}! 👋</h1>
          <p className="mt-3 text-green-50 text-lg max-w-lg">
            {data && data.overview.totalMealsPlanned > 0
              ? `You have ${data.overview.totalMealsPlanned} meals planned with ${data.overview.groceryListItems} items on your shopping list.`
              : "Let's plan some healthy, delicious meals for the week!"}
          </p>
          <div className="flex gap-3 mt-6">
            <Link
              to="/meal-plan"
              className="px-5 py-2.5 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-all hover:scale-105 shadow-lg text-sm"
            >
              📅 Plan This Week
            </Link>
            <Link
              to="/grocery-list"
              className="px-5 py-2.5 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all border border-white/30 text-sm"
            >
              🛒 Grocery List
            </Link>
          </div>
        </div>
      </div>

      {/* Food emoji strip — decorative */}
      <div className="flex justify-center gap-3 py-2 overflow-hidden">
        {foodEmojis.map((emoji, i) => (
          <span
            key={i}
            className="text-2xl animate-float cursor-default select-none"
            style={{ animationDelay: `${i * 0.2}s`, animationDuration: `${2.5 + (i % 3) * 0.5}s` }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
        <Link to="/meal-plan" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 p-5 text-white card-hover shadow-lg shadow-orange-200/30 dark:shadow-orange-900/20">
          <div className="absolute -bottom-3 -right-3 text-6xl opacity-20 group-hover:opacity-40 transition-opacity">📅</div>
          <span className="text-3xl block mb-2">📅</span>
          <span className="font-bold text-sm">Plan Meals</span>
          <p className="text-orange-100 text-xs mt-1">Weekly planner</p>
        </Link>
        <Link to="/recipes" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 p-5 text-white card-hover shadow-lg shadow-blue-200/30 dark:shadow-blue-900/20">
          <div className="absolute -bottom-3 -right-3 text-6xl opacity-20 group-hover:opacity-40 transition-opacity">📖</div>
          <span className="text-3xl block mb-2">📖</span>
          <span className="font-bold text-sm">My Recipes</span>
          <p className="text-blue-100 text-xs mt-1">{data?.overview.totalRecipes || 0} saved</p>
        </Link>
        <Link to="/grocery-list" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 p-5 text-white card-hover shadow-lg shadow-amber-200/30 dark:shadow-amber-900/20">
          <div className="absolute -bottom-3 -right-3 text-6xl opacity-20 group-hover:opacity-40 transition-opacity">🛒</div>
          <span className="text-3xl block mb-2">🛒</span>
          <span className="font-bold text-sm">Shopping</span>
          <p className="text-amber-100 text-xs mt-1">{data?.overview.groceryListItems || 0} items</p>
        </Link>
        <Link to="/pantry" className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 p-5 text-white card-hover shadow-lg shadow-violet-200/30 dark:shadow-violet-900/20">
          <div className="absolute -bottom-3 -right-3 text-6xl opacity-20 group-hover:opacity-40 transition-opacity">🏠</div>
          <span className="text-3xl block mb-2">🏠</span>
          <span className="font-bold text-sm">Pantry</span>
          <p className="text-violet-100 text-xs mt-1">{data?.overview.totalPantryItems || 0} stocked</p>
        </Link>
      </div>

      {/* Stats + Charts */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
          {/* Meals per day */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <span>📊</span> Meals This Week
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.mealsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="meals" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Ingredients */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <span>🥬</span> Most Used Ingredients
            </h3>
            {data.topIngredients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <span className="text-4xl mb-2">🧑‍🍳</span>
                <p className="text-sm">Plan some meals to see insights!</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.topIngredients.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" fill="url(#barGradient2)" radius={[0, 8, 8, 0]} />
                  <defs>
                    <linearGradient id="barGradient2" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Grocery by Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <span>🛍️</span> Grocery Sections
            </h3>
            {data.sectionBreakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <span className="text-4xl mb-2">🛒</span>
                <p className="text-sm">Generate a grocery list first!</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.sectionBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" paddingAngle={3}>
                    {data.sectionBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Shopping Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <span>✅</span> Shopping Progress
            </h3>
            {data.groceryStats.total === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <span className="text-4xl mb-2">🎯</span>
                <p className="text-sm">No shopping list yet!</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="52" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                      cx="64" cy="64" r="52" fill="none" stroke="url(#progressGradient)" strokeWidth="10"
                      strokeDasharray={`${(data.groceryStats.checked / data.groceryStats.total) * 327} 327`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                    <defs>
                      <linearGradient id="progressGradient">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {Math.round((data.groceryStats.checked / data.groceryStats.total) * 100)}%
                    </span>
                    <span className="text-xs text-gray-500">done</span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {data.groceryStats.checked}/{data.groceryStats.total} items • {data.groceryStats.unchecked} remaining
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
