import { useState, useEffect, useRef } from 'react';
import {
  useGetMealPlanQuery,
  useGetRecipesQuery,
  useAddMealPlanEntryMutation,
  useUpdateMealPlanEntryMutation,
  useDeleteMealPlanEntryMutation,
  useGenerateGroceryListMutation,
  MealPlanEntry,
} from '../../../app/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_ICONS: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍿' };

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export default function MealPlanPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [showAddModal, setShowAddModal] = useState<{ date: string; slot: string } | null>(null);
  const [showSwapModal, setShowSwapModal] = useState<{ entryId: string; date: string; slot: string; currentServings: number } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [servings, setServings] = useState(2);

  const { data: entries = [], isLoading } = useGetMealPlanQuery(currentWeekStart);
  const { data: recipes = [] } = useGetRecipesQuery();
  const [addEntry] = useAddMealPlanEntryMutation();
  const [updateEntry] = useUpdateMealPlanEntryMutation();
  const [deleteEntry] = useDeleteMealPlanEntryMutation();
  const [generateList, { isLoading: generating }] = useGenerateGroceryListMutation();

  // Get previous week data for "copy" feature
  const prevWeekStart = (() => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  })();
  const { data: prevEntries = [] } = useGetMealPlanQuery(prevWeekStart);

  // Build dates for current week
  const weekDates = DAYS.map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Match entries to day (handles both "2026-06-09" and "2026-06-09T00:00:00.000Z")
  const getEntriesForDaySlot = (date: string, slot: string): MealPlanEntry[] => {
    return entries.filter(e => {
      const entryDate = e.planDate.split('T')[0];
      return entryDate === date && e.mealSlot.toLowerCase() === slot.toLowerCase();
    });
  };

  const handleAddEntry = async () => {
    if (!showAddModal || !selectedRecipeId) return;
    const recipe = recipes.find(r => r.id === selectedRecipeId);
    await addEntry({
      recipeId: selectedRecipeId,
      planDate: showAddModal.date,
      mealSlot: showAddModal.slot,
      servings: servings || recipe?.defaultServings || 2,
    });
    setShowAddModal(null);
    setSelectedRecipeId('');
    setServings(2);
  };

  const handleSwap = async () => {
    if (!showSwapModal || !selectedRecipeId) return;
    // delete old entry then add new one
    await deleteEntry(showSwapModal.entryId);
    await addEntry({
      recipeId: selectedRecipeId,
      planDate: showSwapModal.date,
      mealSlot: showSwapModal.slot,
      servings: showSwapModal.currentServings,
    });
    setShowSwapModal(null);
    setSelectedRecipeId('');
  };

  const handleCopyPreviousWeek = async () => {
    if (prevEntries.length === 0) return;
    for (const entry of prevEntries) {
      const oldDate = new Date(entry.planDate.split('T')[0]);
      const newDate = new Date(oldDate);
      newDate.setDate(newDate.getDate() + 7);
      await addEntry({
        recipeId: entry.recipeId,
        planDate: newDate.toISOString().split('T')[0],
        mealSlot: entry.mealSlot,
        servings: entry.servings,
      });
    }
  };

  const navigateWeek = (direction: number) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + direction * 7);
    setCurrentWeekStart(getWeekStart(date));
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📅 Meal Plan</h1>
          <p className="text-gray-500 mt-1">Plan your meals for the week</p>
        </div>
        <div className="flex items-center gap-3">
          {prevEntries.length > 0 && (
            <button
              onClick={handleCopyPreviousWeek}
              className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
            >
              📋 Copy Previous Week
            </button>
          )}
          <button
            onClick={() => generateList()}
            disabled={generating}
            className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {generating ? '⏳ Generating...' : '⚡ Generate Grocery List'}
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => navigateWeek(-1)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all card-hover">
          ← Prev Week
        </button>
        <div className="px-5 py-2 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-sm font-semibold text-green-800">
            Week of {new Date(currentWeekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <button onClick={() => navigateWeek(1)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all card-hover">
          Next Week →
        </button>
      </div>

      {/* Week Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center animate-pulse">
            <span className="text-2xl">📅</span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-3 min-w-[1000px]">
            {weekDates.map((date, dayIdx) => {
              const isToday = date === todayStr;
              const dayEntries = entries.filter(e => e.planDate.split('T')[0] === date);
              return (
                <div
                  key={date}
                  className={`rounded-2xl overflow-hidden border transition-all ${
                    isToday
                      ? 'border-green-400 shadow-md shadow-green-100 bg-white'
                      : 'border-gray-100 bg-white shadow-sm'
                  }`}
                >
                  {/* Day header */}
                  <div className={`text-center py-2.5 ${isToday ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' : 'bg-gray-50 text-gray-700'}`}>
                    <p className="text-xs font-bold uppercase tracking-wide">{DAYS_SHORT[dayIdx]}</p>
                    <p className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                      {new Date(date).getDate()}
                    </p>
                    {isToday && <span className="text-[9px] font-bold text-green-100">TODAY</span>}
                  </div>

                  {/* Meal slots */}
                  <div className="p-2 space-y-1.5">
                    {MEAL_SLOTS.map(slot => {
                      const slotEntries = getEntriesForDaySlot(date, slot);
                      return (
                        <div key={slot} className="min-h-[50px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                              <span>{SLOT_ICONS[slot]}</span> {slot}
                            </span>
                            <button
                              onClick={() => setShowAddModal({ date, slot })}
                              className="w-5 h-5 flex items-center justify-center rounded-md text-green-500 hover:bg-green-50 text-xs font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>
                          {slotEntries.length === 0 ? (
                            <div
                              onClick={() => setShowAddModal({ date, slot })}
                              className="h-8 border border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-green-300 hover:bg-green-50/30 transition-all"
                            >
                              <span className="text-[10px] text-gray-300">+ add</span>
                            </div>
                          ) : (
                            slotEntries.map(entry => (
                              <div key={entry.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-1.5 mb-1 group">
                                <p className="text-[11px] font-semibold text-gray-800 truncate">{entry.recipe?.name}</p>
                                <div className="flex items-center justify-between mt-0.5">
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={() => updateEntry({ id: entry.id, data: { servings: Math.max(1, entry.servings - 1) } })}
                                      className="w-4 h-4 bg-white border border-gray-200 rounded text-[9px] flex items-center justify-center hover:bg-gray-100"
                                    >-</button>
                                    <span className="text-[10px] text-gray-600 px-0.5">{entry.servings}</span>
                                    <button
                                      onClick={() => updateEntry({ id: entry.id, data: { servings: entry.servings + 1 } })}
                                      className="w-4 h-4 bg-white border border-gray-200 rounded text-[9px] flex items-center justify-center hover:bg-gray-100"
                                    >+</button>
                                  </div>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setShowSwapModal({ entryId: entry.id, date, slot, currentServings: entry.servings })}
                                      className="text-[10px] text-blue-500 hover:text-blue-700" title="Swap recipe"
                                    >🔄</button>
                                    <button
                                      onClick={() => deleteEntry(entry.id)}
                                      className="text-[10px] text-red-400 hover:text-red-600"
                                    >✕</button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {entries.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 text-sm mb-3">📊 Week Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{entries.length}</p>
              <p className="text-xs text-gray-500">Total Meals</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{entries.reduce((a, e) => a + e.servings, 0)}</p>
              <p className="text-xs text-gray-500">Total Servings</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{new Set(entries.map(e => e.recipeId)).size}</p>
              <p className="text-xs text-gray-500">Unique Recipes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{7 - weekDates.filter(d => entries.some(e => e.planDate.split('T')[0] === d)).length}</p>
              <p className="text-xs text-gray-500">Days Empty</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Add to {showAddModal.slot}
            </h2>
            <p className="text-sm text-gray-500 mb-5">{new Date(showAddModal.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Recipe</label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => {
                    setSelectedRecipeId(e.target.value);
                    const recipe = recipes.find(r => r.id === e.target.value);
                    if (recipe) setServings(recipe.defaultServings);
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none text-sm"
                >
                  <option value="">Choose a recipe...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.defaultServings} servings)</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Servings</label>
                  <input
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value))}
                    min={1}
                    className="w-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
                    <input type="checkbox" id="leftover-check" className="rounded border-amber-300 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">🍱 Leftover</span>
                  </label>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">⚠️ Active Dietary Constraints:</p>
                <p className="text-xs text-gray-500">Substitutions will be auto-applied during grocery generation based on your active constraints (manage in Substitutions page)</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    const isLeftover = (document.getElementById('leftover-check') as HTMLInputElement)?.checked || false;
                    if (!showAddModal || !selectedRecipeId) return;
                    const recipe = recipes.find(r => r.id === selectedRecipeId);
                    addEntry({
                      recipeId: selectedRecipeId,
                      planDate: showAddModal.date,
                      mealSlot: showAddModal.slot,
                      servings: servings || recipe?.defaultServings || 2,
                      isLeftover,
                    } as any);
                    setShowAddModal(null);
                    setSelectedRecipeId('');
                    setServings(2);
                  }}
                  disabled={!selectedRecipeId}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 transition-all text-sm"
                >
                  Add to Plan
                </button>
                <button
                  onClick={() => setShowAddModal(null)}
                  className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Swap Recipe Modal */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSwapModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">🔄 Swap Recipe</h2>
            <p className="text-sm text-gray-500 mb-5">Choose a different recipe for this slot (keeps same servings)</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Recipe</label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none text-sm"
                >
                  <option value="">Choose replacement...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSwap}
                  disabled={!selectedRecipeId}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 transition-all text-sm"
                >
                  Swap Recipe
                </button>
                <button
                  onClick={() => setShowSwapModal(null)}
                  className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
