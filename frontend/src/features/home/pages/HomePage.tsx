import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetMealPlanQuery,
  useGetGroceryListQuery,
  useGetPantryQuery,
  useGetRecipesQuery,
  useAiEstimateCostMutation,
  useAiSuggestRecipesMutation,
} from '../../../app/api';

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
  const [estimateCost] = useAiEstimateCostMutation();
  const [suggestRecipes] = useAiSuggestRecipesMutation();

  const [costLoading, setCostLoading] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [botActive, setBotActive] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [botSuggestions, setBotSuggestions] = useState<any[]>([]);
  const [resetting, setResetting] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
  const alreadyHave = groceryItems.filter(i => i.isAlreadyHave || i.computedQty === 0);
  const checked = groceryItems.filter(i => i.isChecked);

  // Expiring pantry
  const expiring = pantry.filter(item => {
    if (!item.expirationDate) return false;
    const days = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / 86400000);
    return days <= 3 && days >= 0;
  });

  const handleEstimateCost = async () => {
    setCostLoading(true);
    try {
      const result = await estimateCost().unwrap();
      setEstimatedCost(result.totalCost);
    } catch (e) {
      setEstimatedCost(needToBuy.length * 55);
    }
    setCostLoading(false);
  };

  const handleBotCook = async () => {
    setBotActive(true);
    setBotLoading(true);
    try {
      const result = await suggestRecipes().unwrap();
      if (result?.suggestions) {
        setBotSuggestions(result.suggestions.slice(0, 3));
      }
    } catch (e) {
      setBotSuggestions([{ name: 'Quick Stir Fry', cookingTime: 15 }, { name: 'Simple Omelette', cookingTime: 10 }]);
    }
    setBotLoading(false);
  };

  const handleStartFresh = async () => {
    setResetting(true);
    try {
      await fetch('/api/reset', { method: 'POST' });
      window.location.reload();
    } catch (e) { console.error(e); }
    setResetting(false);
    setShowResetConfirm(false);
  };

  const handleLoadSampleData = async () => {
    setReseeding(true);
    try {
      await fetch('/api/reseed', { method: 'POST' });
      window.location.reload();
    } catch (e) { console.error(e); }
    setReseeding(false);
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{greeting}! 👋</h1>
          <p className="text-gray-500 mt-1">Eat healthy. Save time. Live better.</p>
        </div>
        <div className="flex gap-3">
          {showResetConfirm ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl animate-scale-in">
              <span className="text-xs text-red-700 font-medium">Clear everything?</span>
              <button onClick={handleStartFresh} disabled={resetting} className="px-2.5 py-1 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600">
                {resetting ? '...' : 'Yes'}
              </button>
              <button onClick={() => setShowResetConfirm(false)} className="px-2.5 py-1 text-xs font-bold bg-gray-200 text-gray-700 rounded-lg">No</button>
            </div>
          ) : (
            <button onClick={() => setShowResetConfirm(true)} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all">
              🧹 Start Fresh
            </button>
          )}
          <button onClick={handleLoadSampleData} disabled={reseeding} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all disabled:opacity-50">
            {reseeding ? '⏳ Loading...' : '📦 Load Sample Data'}
          </button>
          <Link to="/meal-plan" className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-[1.02]">
            + Plan Meals
          </Link>
        </div>
      </div>

      {/* Expiring Soon Banner (top, visible immediately) */}
      {expiring.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200 animate-scale-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <h3 className="font-bold text-amber-800 text-sm">Expiring Soon - Use These First!</h3>
                <p className="text-xs text-amber-600 mt-0.5">{expiring.length} item{expiring.length > 1 ? 's' : ''} expiring in the next 3 days</p>
              </div>
            </div>
            <Link to="/pantry" className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 transition-colors">
              View Pantry →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {expiring.map(item => {
              const daysLeft = Math.ceil((new Date(item.expirationDate!).getTime() - Date.now()) / 86400000);
              return (
                <div key={item.id} className="bg-white rounded-xl px-3 py-1.5 border border-amber-200 flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-800">{item.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-bold">
                    {daysLeft <= 0 ? 'Expired!' : daysLeft === 1 ? '1 day' : `${daysLeft} days`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Week Plan + Grocery Side Panel */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Week Plan (2 cols wide) */}
        <div className="col-span-2 space-y-6">
          {/* Your Meal Plan */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">📅 Your Meal Plan</h2>
              <Link to="/meal-plan" className="text-xs text-green-600 font-semibold hover:text-green-700 px-3 py-1.5 bg-green-50 rounded-lg">
                View Full Week →
              </Link>
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
                      {meals.length > 0 ? '🍽️' : <span className="text-gray-200 text-lg">-</span>}
                    </div>
                    <p className="mt-2 text-xs text-gray-600 font-medium">
                      {meals.length > 0 ? `${meals.length} meal${meals.length > 1 ? 's' : ''}` : ''}
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

          {/* AI Chef Assistant */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 p-6 shadow-lg shadow-blue-200">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute top-4 right-8 w-16 h-16 bg-white/10 rounded-full animate-pulse"></div>
              <div className="absolute bottom-4 left-12 w-10 h-10 bg-white/10 rounded-full animate-bounce" style={{animationDelay: '0.5s'}}></div>
              <div className="absolute top-8 left-[33%] w-8 h-8 bg-white/5 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
            </div>
            <div className="relative flex items-center gap-5">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-bounce" style={{animationDuration: '3s'}}>
                  <span className="text-4xl">👩‍🍳</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg">AI Chef Assistant</h3>
                <p className="text-blue-100 text-sm mt-0.5">Let me help you decide what to cook today</p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleBotCook}
                    className="group flex items-center gap-2 px-5 py-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.05]"
                  >
                    <span className="text-xl group-hover:animate-bounce">🍳</span>
                    <span className="text-sm font-bold text-gray-800">What Can I Cook?</span>
                  </button>
                  <Link
                    to="/recipes"
                    className="group flex items-center gap-2 px-5 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl border border-white/30 hover:bg-white/30 transition-all hover:scale-[1.05]"
                  >
                    <span className="text-xl group-hover:animate-bounce">📖</span>
                    <span className="text-sm font-bold">Generate Recipe</span>
                  </Link>
                </div>
              </div>
            </div>
            {botActive && (
              <div className="relative mt-5 p-4 bg-white rounded-xl shadow-inner animate-scale-in">
                {botLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-300 border-t-blue-600"></div>
                    <span className="text-sm text-blue-600 font-medium">Chef is thinking...</span>
                  </div>
                ) : botSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-700">Here is what you can make right now:</p>
                    {botSuggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                        <span className="text-lg">{['🍳', '🥗', '🍲'][i % 3]}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{s.name}</p>
                          <p className="text-[10px] text-gray-500">{s.cookingTime || 20} min</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No suggestions yet. Add items to your pantry first.</p>
                )}
              </div>
            )}
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
                    <span className="text-xs font-bold text-green-600">{alreadyHave.length} items</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-600">Purchased</span>
                    <span className="text-xs font-bold text-blue-600">{checked.length} items</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={handleEstimateCost}
                      disabled={costLoading}
                      className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all group"
                    >
                      <span className="text-xs font-medium text-purple-700 flex items-center gap-1.5">
                        <span className="text-sm group-hover:animate-bounce">💰</span>
                        {costLoading ? 'Estimating...' : 'Estimate Cost'}
                      </span>
                      {costLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-300 border-t-purple-600"></div>
                      ) : estimatedCost !== null ? (
                        <span className="text-sm font-bold text-purple-700">₹{estimatedCost}</span>
                      ) : (
                        <span className="text-[10px] text-purple-500">AI powered →</span>
                      )}
                    </button>
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
                      <p className="text-[10px] text-gray-500">{entry.mealSlot} · {entry.servings} servings</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
