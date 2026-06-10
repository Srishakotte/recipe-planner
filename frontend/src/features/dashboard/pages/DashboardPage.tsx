import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
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

// Mock nutrition data (will be replaced by AI/Gemini)
const weeklyNutrition = [
  { day: 'Mon', calories: 1850, protein: 95, carbs: 210, fats: 62 },
  { day: 'Tue', calories: 2100, protein: 110, carbs: 240, fats: 70 },
  { day: 'Wed', calories: 1920, protein: 88, carbs: 200, fats: 68 },
  { day: 'Thu', calories: 2050, protein: 102, carbs: 225, fats: 65 },
  { day: 'Fri', calories: 1780, protein: 82, carbs: 195, fats: 58 },
  { day: 'Sat', calories: 2200, protein: 115, carbs: 250, fats: 75 },
  { day: 'Sun', calories: 1900, protein: 92, carbs: 215, fats: 60 },
];

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
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center animate-pulse">
          <span className="text-2xl">📊</span>
        </div>
        <p className="mt-4 text-gray-400 text-sm">Loading analytics...</p>
      </div>
    );
  const [showNutrition, setShowNutrition] = useState(false);
  const [estimatingNutrition, setEstimatingNutrition] = useState(false);
  }

  const avgCalories = Math.round(weeklyNutrition.reduce((a, b) => a + b.calories, 0) / 7);
  const avgProtein = Math.round(weeklyNutrition.reduce((a, b) => a + b.protein, 0) / 7);
  const avgCarbs = Math.round(weeklyNutrition.reduce((a, b) => a + b.carbs, 0) / 7);
  const avgFats = Math.round(weeklyNutrition.reduce((a, b) => a + b.fats, 0) / 7);

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
        <p className="text-gray-500 mt-1">Track your nutrition, costs, and meal patterns</p>
      </div>

      {/* Nutrition Summary Cards */}
      <div className="grid grid-cols-4 gap-4 stagger-children">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100 card-hover">
          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Avg. Calories</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{avgCalories}</p>
          <p className="text-xs text-green-500 mt-1">kcal / day</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 card-hover">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Avg. Protein</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{avgProtein}g</p>
          <p className="text-xs text-blue-500 mt-1">per day</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100 card-hover">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Avg. Carbs</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">{avgCarbs}g</p>
          <p className="text-xs text-amber-500 mt-1">per day</p>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-5 border border-rose-100 card-hover">
          <p className="text-xs text-rose-600 font-semibold uppercase tracking-wide">Avg. Fats</p>
          <p className="text-3xl font-bold text-rose-700 mt-1">{avgFats}g</p>
          <p className="text-xs text-rose-500 mt-1">per day</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Calorie Trend */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-sm mb-4">🔥 Daily Calories (This Week)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyNutrition}>
              <defs>
                <linearGradient id="calorieGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <Area type="monotone" dataKey="calories" stroke="#10b981" strokeWidth={2.5} fill="url(#calorieGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Protein Trend */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-sm mb-4">💪 Daily Protein (This Week)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyNutrition}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <Bar dataKey="protein" fill="url(#proteinGrad)" radius={[6, 6, 0, 0]} />
              <defs>
                <linearGradient id="proteinGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-6">
        {/* Meals per day */}
        {data && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 text-sm mb-4">📅 Meals Per Day</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.mealsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="meals" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Grocery by section */}
        {data && data.sectionBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 text-sm mb-4">🛍️ Grocery by Section</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.sectionBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" nameKey="name" paddingAngle={3}>
                  {data.sectionBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Ingredients */}
        {data && data.topIngredients.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 text-sm mb-4">🥬 Top Ingredients</h3>
            <div className="space-y-2.5">
              {data.topIngredients.slice(0, 5).map((ing, i) => (
                <div key={ing.name} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${(ing.count / (data.topIngredients[0]?.count || 1)) * 100}%`,
                      background: COLORS[i % COLORS.length]
                    }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-20 text-right">{ing.name}</span>
                  <span className="text-xs text-gray-400">{ing.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
