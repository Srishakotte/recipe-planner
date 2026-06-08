import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface AnalyticsData {
  overview: { totalRecipes: number; totalPantryItems: number; totalMealsPlanned: number; groceryListItems: number };
  mealsPerDay: { day: string; meals: number }[];
  topIngredients: { name: string; count: number }[];
  groceryStats: { total: number; checked: number; unchecked: number; adHoc: number };
  sectionBreakdown: { name: string; value: number }[];
  slotBreakdown: { name: string; value: number }[];
}

const mealEmojis: Record<string, string> = {
  'Spaghetti Bolognese': '🍝',
  'Chicken Stir Fry': '🥘',
  'Fluffy Pancakes': '🥞',
  'Caesar Salad': '🥗',
  'Creamy Tomato Soup': '🍲',
  'Beef Tacos': '🌮',
};

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const today = new Date().getDay(); // 0=Sun, 1=Mon...
const todayIndex = today === 0 ? 6 : today - 1;

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
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center animate-pulse">
          <span className="text-3xl">🍳</span>
        </div>
        <p className="mt-4 text-gray-400 text-sm">Loading your kitchen...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{greeting}! 👋</h1>
          <p className="text-gray-500 mt-1">Eat healthy. Save time. Live better.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/meal-plan"
            className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-[1.02]"
          >
            + Plan Meals
          </Link>
        </div>
      </div>

      {/* Weekly Meal Plan Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Your Meal Plan</h2>
          <Link to="/meal-plan" className="text-sm text-green-600 hover:text-green-700 font-medium">
            View full week →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-3 stagger-children">
          {dayNames.map((day, i) => {
            const mealsForDay = data?.mealsPerDay[i]?.meals || 0;
            const isToday = i === todayIndex;
            return (
              <div
                key={day}
                className={`rounded-2xl p-4 text-center transition-all card-hover ${
                  isToday
                    ? 'bg-gradient-to-b from-green-50 to-emerald-50 border-2 border-green-400 shadow-md shadow-green-100'
                    : 'bg-white border border-gray-100 shadow-sm'
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-green-600' : 'text-gray-400'}`}>
                  {day}
                </p>
                {isToday && <span className="text-[10px] text-green-500 font-bold">TODAY</span>}
                <div className={`w-14 h-14 mx-auto mt-2 rounded-xl flex items-center justify-center text-2xl ${
                  mealsForDay > 0
                    ? 'bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100'
                    : 'bg-gray-50 border border-gray-100'
                }`}>
                  {mealsForDay > 0 ? '🍽️' : '➕'}
                </div>
                <p className="mt-2 text-xs text-gray-600 font-medium">
                  {mealsForDay > 0 ? `${mealsForDay} meal${mealsForDay > 1 ? 's' : ''}` : 'Empty'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 stagger-children">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
            <span className="text-lg">📖</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.overview.totalRecipes || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Recipes</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
            <span className="text-lg">📅</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.overview.totalMealsPlanned || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Meals Planned</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
            <span className="text-lg">🛒</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.overview.groceryListItems || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Grocery Items</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
            <span className="text-lg">🏠</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.overview.totalPantryItems || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pantry Items</p>
        </div>
      </div>

      {/* Bottom Row: AI Suggestions + Grocery Progress */}
      <div className="grid grid-cols-3 gap-6">
        {/* AI Suggestion Card */}
        <div className="col-span-2 bg-gradient-to-br from-[#f0fdf4] to-[#ecfdf5] rounded-2xl p-6 border border-green-100 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🤖</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800 text-sm">AI-Powered Suggestion</h3>
              <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                {data && data.overview.totalMealsPlanned > 3
                  ? "You're doing great this week! Consider adding more variety with leafy greens and whole grains."
                  : "Start planning your meals for the week! Adding at least 5 meals helps maintain a balanced diet."}
              </p>
              <div className="flex gap-2 mt-3">
                <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-green-700 border border-green-200">🥬 Add greens</span>
                <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-amber-700 border border-amber-200">🥚 More protein</span>
                <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-blue-700 border border-blue-200">💧 Stay hydrated</span>
              </div>
            </div>
            <div className="flex-shrink-0 text-4xl animate-float">
              🥗
            </div>
          </div>
        </div>

        {/* Shopping Progress */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-sm mb-4">Shopping Progress</h3>
          {data && data.groceryStats.total > 0 ? (
            <div className="flex flex-col items-center">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="56" cy="56" r="46" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle
                    cx="56" cy="56" r="46" fill="none" strokeWidth="10"
                    stroke="url(#progressGrad)"
                    strokeDasharray={`${(data.groceryStats.checked / data.groceryStats.total) * 289} 289`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">
                    {Math.round((data.groceryStats.checked / data.groceryStats.total) * 100)}%
                  </span>
                  <span className="text-[10px] text-gray-400">complete</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                {data.groceryStats.checked}/{data.groceryStats.total} items
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-gray-400">
              <span className="text-3xl mb-2">🛒</span>
              <p className="text-xs">Generate a grocery list!</p>
              <Link to="/grocery-list" className="mt-2 text-xs text-green-600 font-medium hover:text-green-700">
                Go to list →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Top Ingredients */}
      {data && data.topIngredients.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-sm mb-4">🥬 Most Used Ingredients</h3>
          <div className="flex flex-wrap gap-2">
            {data.topIngredients.slice(0, 8).map((ing, i) => (
              <span
                key={ing.name}
                className="px-3 py-1.5 rounded-full text-xs font-medium border"
                style={{
                  backgroundColor: ['#ecfdf5', '#eff6ff', '#fef3c7', '#fce7f3', '#f3e8ff', '#ecfeff', '#fef2f2', '#f0fdf4'][i % 8],
                  borderColor: ['#a7f3d0', '#bfdbfe', '#fde68a', '#fbcfe8', '#e9d5ff', '#a5f3fc', '#fecaca', '#bbf7d0'][i % 8],
                  color: ['#065f46', '#1e40af', '#92400e', '#9d174d', '#6b21a8', '#155e75', '#991b1b', '#166534'][i % 8],
                }}
              >
                {ing.name} ({ing.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
