import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetMealPlanQuery,
  useGetGroceryListQuery,
  useGetPantryQuery,
  useGetRecipesQuery,
} from '../../../app/api';

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export default function HomePage() {
  const weekStart = useMemo(() => getWeekStart(), []);
  const { data: entries = [] } = useGetMealPlanQuery(weekStart);
  const { data: groceryList } = useGetGroceryListQuery();
  const { data: pantry = [] } = useGetPantryQuery();
  const { data: recipes = [] } = useGetRecipesQuery();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Meals per day
  const mealsPerDay = dayNames.map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    return entries.filter(e => e.planDate?.split('T')[0] === dateStr);
  });

  // Grocery stats
  const groceryItems = groceryList?.items || [];
  const needToBuy = groceryItems.filter(i => !i.isChecked && !i.isAlreadyHave && i.computedQty > 0);
  const checked = groceryItems.filter(i => i.isChecked);

  // Expiring pantry
  const expiring = pantry.filter(item => {
    if (!item.expirationDate) return false;
    const days = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / 86400000);
    return days <= 3 && days >= 0;
  });

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{greeting}! 👋</h1>
          <p className="text-gray-500 mt-1">Eat healthy. Save time. Live better.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/meal-plan" className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-[1.02]">
            + Plan Meals
          </Link>
        </div>
      </div>

      {/* Main Grid: Week Plan + Grocery Side Panel */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Week Plan (2 cols wide) */}
        <div className="col-span-2 space-y-6">
          {/* Your Meal Plan */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">📅 Your Meal Plan</h2>
              <div className="flex gap-2">
                <Link to="/meal-plan" className="text-xs text-green-600 font-semibold hover:text-green-700 px-3 py-1.5 bg-green-50 rounded-lg">
                  View Full Week →
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2.5 stagger-children">
              {dayNames.map((day, i) => {
                const meals = mealsPerDay[i];
                const isToday = i === todayIdx;
                return (
                  <div
                    key={day}
                    className={`rounded-2xl p-3 text-center transition-all card-hover ${
                      isToday
                        ? 'bg-gradient-to-b from-green-50 to-emerald-50 border-2 border-green-400 shadow-md shadow-green-100'
                        : 'bg-white border border-gray-100 shadow-sm'
                    }`}
                  >
                    <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-green-600' : 'text-gray-400'}`}>{day}</p>
                    {isToday && <span className="text-[9px] text-green-500 font-bold block">TODAY</span>}
                    <div className={`w-12 h-12 mx-auto mt-2 rounded-xl flex items-center justify-center text-xl ${
                      meals.length > 0 ? 'bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100' : 'bg-gray-50'
                    }`}>
                      {meals.length > 0 ? '🍽️' : <span className="text-gray-300 text-lg">+</span>}
                    </div>
                    <p className="mt-2 text-xs text-gray-600 font-medium">
                      {meals.length > 0 ? `${meals.length} meal${meals.length > 1 ? 's' : ''}` : 'Empty'}
                    </p>
                    {meals.length > 0 && (
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{meals[0].recipe?.name}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-3 stagger-children">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover text-center">
              <p className="text-2xl font-bold text-green-600">{recipes.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Recipes</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover text-center">
              <p className="text-2xl font-bold text-blue-600">{entries.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Planned</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover text-center">
              <p className="text-2xl font-bold text-amber-600">{needToBuy.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">To Buy</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover text-center">
              <p className="text-2xl font-bold text-purple-600">{pantry.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">In Pantry</p>
            </div>
          </div>

          {/* AI Kitchen Intelligence */}
          <div className="bg-gradient-to-br from-[#f0fdf4] to-[#ecfdf5] rounded-2xl p-6 border border-green-100">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🤖</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-sm">Kitchen Intelligence</h3>
                {expiring.length > 0 ? (
                  <p className="text-sm text-gray-600 mt-1.5">
                    ⚠️ {expiring.length} ingredient{expiring.length > 1 ? 's' : ''} expiring soon: <strong>{expiring.map(e => e.name).join(', ')}</strong>. Cook them today!
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 mt-1.5">
                    You have {pantry.length} items in your pantry. {entries.length > 0 ? `${entries.length} meals planned this week.` : 'Start planning your week!'}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <Link to="/pantry" className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-green-700 border border-green-200 hover:bg-green-50 transition-colors">
                    🍳 Cook Now
                  </Link>
                  <Link to="/recipes" className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors">
                    📖 Generate Recipe
                  </Link>
                  <Link to="/grocery-list" className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 transition-colors">
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Grocery Summary Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
              🛒 Grocery Summary
            </h3>
            {groceryItems.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <span className="text-3xl block mb-2">🛍️</span>
                <p className="text-xs">No list yet</p>
                <Link to="/grocery-list" className="text-xs text-green-600 font-medium mt-1 block">Generate one →</Link>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-600">Need to buy</span>
                    <span className="text-xs font-bold text-amber-600">{needToBuy.length} items</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-600">Already have</span>
                    <span className="text-xs font-bold text-green-600">{groceryItems.length - needToBuy.length} items</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-600">Purchased</span>
                    <span className="text-xs font-bold text-blue-600">{checked.length} items</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 pt-2 border-t border-gray-100">
                    <span className="text-xs font-medium text-gray-700">Est. Cost</span>
                    <span className="text-sm font-bold text-gray-900">~₹{needToBuy.length * 3}</span>
                  </div>
                </div>
                {/* Progress */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                    style={{ width: `${groceryItems.length > 0 ? (checked.length / groceryItems.length) * 100 : 0}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{checked.length}/{groceryItems.length} items checked off</p>
              </>
            )}
          </div>

          {/* Today's Meals */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 text-sm mb-3">🍽️ Today's Meals</h3>
            {mealsPerDay[todayIdx].length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                <p className="text-xs">Nothing planned for today</p>
                <Link to="/meal-plan" className="text-xs text-green-600 font-medium mt-1 block">Add a meal →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {mealsPerDay[todayIdx].map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 p-2.5 bg-green-50 rounded-xl">
                    <span className="text-lg">🍽️</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{entry.recipe?.name}</p>
                      <p className="text-[10px] text-gray-500">{entry.mealSlot} • {entry.servings} servings</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expiring Soon */}
          {expiring.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
              <h3 className="font-bold text-amber-800 text-sm mb-2">⚠️ Expiring Soon</h3>
              <div className="space-y-1.5">
                {expiring.slice(0, 4).map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">{item.name}</span>
                    <span className="text-[10px] text-amber-600 font-medium">
                      {Math.ceil((new Date(item.expirationDate!).getTime() - Date.now()) / 86400000)}d left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
