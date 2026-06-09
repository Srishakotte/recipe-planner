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

function getCurrentSlotIndex(): number {
  const hour = new Date().getHours();
  if (hour < 10) return 0; // breakfast
  if (hour < 14) return 1; // lunch
  if (hour < 20) return 2; // dinner
  return 3; // snack
}

export default function MealPlanPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [showAddModal, setShowAddModal] = useState<{ date: string; slot: string } | null>(null);
  const [showSwapModal, setShowSwapModal] = useState<{ entryId: string; date: string; slot: string; currentServings: number } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [servings, setServings] = useState(2);
  const [useLeftover, setUseLeftover] = useState(false);

  const { data: entries = [], isLoading } = useGetMealPlanQuery(currentWeekStart);
  const { data: recipes = [] } = useGetRecipesQuery();
  const [addEntry] = useAddMealPlanEntryMutation();
  const [updateEntry] = useUpdateMealPlanEntryMutation();
  const [deleteEntry] = useDeleteMealPlanEntryMutation();
  const [generateList] = useGenerateGroceryListMutation();

  // AUTO-REGENERATE grocery list whenever entries change
  const prevEntriesRef = useRef(JSON.stringify(entries));
  useEffect(() => {
    const current = JSON.stringify(entries);
    if (current !== prevEntriesRef.current && entries.length > 0) {
      prevEntriesRef.current = current;
      generateList();
    }
  }, [entries, generateList]);

  // Get previous week for copy feature
  const prevWeekStart = (() => { const d = new Date(currentWeekStart); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; })();
  const { data: prevEntries = [] } = useGetMealPlanQuery(prevWeekStart);

  // Build dates for current week
  const weekDates = DAYS.map((_, i) => { const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });
  const todayStr = new Date().toISOString().split('T')[0];
  const currentSlotIdx = getCurrentSlotIndex();

  // Check if a date+slot is in the past (can be marked as leftover)
  const isPastMeal = (date: string, slot: string): boolean => {
    if (date < todayStr) return true;
    if (date === todayStr) {
      const slotIdx = MEAL_SLOTS.indexOf(slot.toLowerCase());
      return slotIdx <= currentSlotIdx;
    }
    return false;
  };

  // Get available leftovers (past/current meals marked as leftover)
  const availableLeftovers = entries.filter(e => {
    if (!(e as any).isLeftover) return false;
    // Check expiry
    const expiry = (e as any).leftoverExpiryDate;
    if (expiry) {
      const expiryDate = expiry.split('T')[0];
      if (expiryDate < todayStr) return false;
    }
    return true;
  });

  const getEntriesForDaySlot = (date: string, slot: string): MealPlanEntry[] => {
    return entries.filter(e => e.planDate.split('T')[0] === date && e.mealSlot.toLowerCase() === slot.toLowerCase());
  };

  const handleAddEntry = async () => {
    if (!showAddModal || !selectedRecipeId) return;
    const recipe = recipes.find(r => r.id === selectedRecipeId);
    await addEntry({
      recipeId: selectedRecipeId,
      planDate: showAddModal.date,
      mealSlot: showAddModal.slot,
      servings: servings || recipe?.defaultServings || 2,
      isLeftover: useLeftover,
    } as any);
    setShowAddModal(null);
    setSelectedRecipeId('');
    setServings(2);
    setUseLeftover(false);
  };

  const handleSwap = async () => {
    if (!showSwapModal || !selectedRecipeId) return;
    await deleteEntry(showSwapModal.entryId);
    await addEntry({
      recipeId: selectedRecipeId,
      planDate: showSwapModal.date,
      mealSlot: showSwapModal.slot,
      servings: showSwapModal.currentServings,
    } as any);
    setShowSwapModal(null);
    setSelectedRecipeId('');
  };

  const handleToggleLeftover = async (entry: MealPlanEntry) => {
    const current = (entry as any).isLeftover || false;
    await updateEntry({ id: entry.id, data: { isLeftover: !current } as any });
  };

  const handleCopyPreviousWeek = async () => {
    for (const entry of prevEntries) {
      const oldDate = new Date(entry.planDate.split('T')[0]);
      const newDate = new Date(oldDate);
      newDate.setDate(newDate.getDate() + 7);
      await addEntry({ recipeId: entry.recipeId, planDate: newDate.toISOString().split('T')[0], mealSlot: entry.mealSlot, servings: entry.servings } as any);
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
          <p className="text-gray-500 mt-1">Plan your meals — grocery list updates automatically</p>
        </div>
        <div className="flex items-center gap-3">
          {prevEntries.length > 0 && (
            <button onClick={handleCopyPreviousWeek} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all">
              📋 Copy Previous Week
            </button>
          )}
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => navigateWeek(-1)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">← Prev</button>
        <div className="px-5 py-2 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-sm font-semibold text-green-800">
            {new Date(currentWeekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(weekDates[6]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <button onClick={() => navigateWeek(1)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">Next →</button>
      </div>

      {/* Week Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center animate-pulse"><span className="text-2xl">📅</span></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-3 min-w-[1000px]">
            {weekDates.map((date, dayIdx) => {
              const isToday = date === todayStr;
              return (
                <div key={date} className={`rounded-2xl overflow-hidden border transition-all ${isToday ? 'border-green-400 shadow-md shadow-green-100 bg-white' : 'border-gray-100 bg-white shadow-sm'}`}>
                  <div className={`text-center py-2.5 ${isToday ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' : date < todayStr ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-700'}`}>
                    <p className="text-xs font-bold uppercase tracking-wide">{DAYS_SHORT[dayIdx]}</p>
                    <p className={`text-lg font-bold`}>{new Date(date).getDate()}</p>
                    {isToday && <span className="text-[9px] font-bold text-green-100">TODAY</span>}
                  </div>
                  <div className="p-2 space-y-1.5">
                    {MEAL_SLOTS.map(slot => {
                      const slotEntries = getEntriesForDaySlot(date, slot);
                      const canBeLeftover = isPastMeal(date, slot);
                      return (
                        <div key={slot} className="min-h-[50px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                              <span>{SLOT_ICONS[slot]}</span> {slot}
                            </span>
                            <button onClick={() => setShowAddModal({ date, slot })} className="w-5 h-5 flex items-center justify-center rounded-md text-green-500 hover:bg-green-50 text-xs font-bold">+</button>
                          </div>
                          {slotEntries.length === 0 ? (
                            <div onClick={() => setShowAddModal({ date, slot })} className="h-8 border border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-green-300 hover:bg-green-50/30 transition-all">
                              <span className="text-[10px] text-gray-300">+ add</span>
                            </div>
                          ) : (
                            slotEntries.map(entry => (
                              <div key={entry.id} className={`rounded-lg p-1.5 mb-1 group ${(entry as any).isLeftover ? 'bg-amber-50 border border-amber-200' : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'}`}>
                                <p className="text-[11px] font-semibold text-gray-800 truncate">
                                  {(entry as any).isLeftover && <span className="text-amber-500 mr-0.5">🍱</span>}
                                  {entry.recipe?.name}
                                </p>
                                <div className="flex items-center justify-between mt-0.5">
                                  <div className="flex items-center gap-0.5">
                                    <button onClick={() => updateEntry({ id: entry.id, data: { servings: Math.max(1, entry.servings - 1) } })} className="w-4 h-4 bg-white border border-gray-200 rounded text-[9px] flex items-center justify-center hover:bg-gray-100">-</button>
                                    <span className="text-[10px] text-gray-600 px-0.5">{entry.servings}</span>
                                    <button onClick={() => updateEntry({ id: entry.id, data: { servings: entry.servings + 1 } })} className="w-4 h-4 bg-white border border-gray-200 rounded text-[9px] flex items-center justify-center hover:bg-gray-100">+</button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {canBeLeftover && (
                                      <button onClick={() => handleToggleLeftover(entry)} className={`text-[9px] px-1 rounded ${(entry as any).isLeftover ? 'text-amber-600 font-bold' : 'text-gray-400 hover:text-amber-500'}`} title={`${(entry as any).isLeftover ? 'Unmark' : 'Mark as'} leftover`}>
                                        🍱
                                      </button>
                                    )}
                                    {!canBeLeftover && (
                                      <button onClick={() => setShowSwapModal({ entryId: entry.id, date, slot, currentServings: entry.servings })} className="text-[10px] text-blue-500 hover:text-blue-700 px-0.5" title="Swap">🔄</button>
                                    )}
                                    <button onClick={() => deleteEntry(entry.id)} className="text-[10px] text-red-400 hover:text-red-600 px-0.5">✕</button>
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

      {/* Week Summary */}
      {entries.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center"><p className="text-2xl font-bold text-green-600">{entries.length}</p><p className="text-xs text-gray-500">Total Meals</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-blue-600">{entries.reduce((a, e) => a + e.servings, 0)}</p><p className="text-xs text-gray-500">Servings</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-amber-600">{entries.filter(e => (e as any).isLeftover).length}</p><p className="text-xs text-gray-500">Leftovers</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-purple-600">{new Set(entries.map(e => e.recipeId)).size}</p><p className="text-xs text-gray-500">Unique Recipes</p></div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Add to {showAddModal.slot}</h2>
            <p className="text-sm text-gray-500 mb-4">{new Date(showAddModal.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>

            {/* Available Leftovers */}
            {availableLeftovers.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-2">🍱 Available Leftovers:</p>
                <div className="flex flex-wrap gap-2">
                  {availableLeftovers.map(e => (
                    <button key={e.id} type="button"
                      onClick={() => { setSelectedRecipeId(e.recipeId); setServings(e.servings); setUseLeftover(true); }}
                      className="px-3 py-1.5 bg-white text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-100 border border-amber-200 transition-colors">
                      🍱 {e.recipe?.name} ({e.servings}sv)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Recipe</label>
                <select value={selectedRecipeId}
                  onChange={(e) => { setSelectedRecipeId(e.target.value); const r = recipes.find(x => x.id === e.target.value); if (r) setServings(r.defaultServings); setUseLeftover(false); }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm">
                  <option value="">Choose a recipe...</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.defaultServings} servings)</option>)}
                </select>
              </div>
              <div className="flex gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Servings</label>
                  <input type="number" value={servings} onChange={(e) => setServings(Number(e.target.value))} min={1} className="w-24 px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                </div>
                <label className={`flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-colors ${useLeftover ? 'bg-amber-100 border-amber-300 border' : 'bg-gray-50 border border-gray-200 hover:bg-amber-50'}`}>
                  <input type="checkbox" checked={useLeftover} onChange={(e) => setUseLeftover(e.target.checked)} className="rounded border-amber-300 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">🍱 Leftover</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleAddEntry} disabled={!selectedRecipeId}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 transition-all text-sm">
                  Add to Plan
                </button>
                <button onClick={() => setShowAddModal(null)} className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSwapModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">🔄 Swap Recipe</h2>
            <select value={selectedRecipeId} onChange={(e) => setSelectedRecipeId(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm mb-4">
              <option value="">Choose replacement...</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={handleSwap} disabled={!selectedRecipeId} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl disabled:opacity-50 text-sm">Swap</button>
              <button onClick={() => setShowSwapModal(null)} className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
