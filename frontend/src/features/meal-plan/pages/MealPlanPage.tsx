import { useState, useEffect, useRef } from 'react';
import {
  useGetMealPlanQuery,
  useGetRecipesQuery,
  useAddMealPlanEntryMutation,
  useUpdateMealPlanEntryMutation,
  useDeleteMealPlanEntryMutation,
  useGenerateGroceryListMutation,
  useMarkAsLeftoverMutation,
  useConsumeLeftoverMutation,
  MealPlanEntry,
} from '../../../app/api';
import { showToast } from '../../../shared/components/Toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function formatExpiry(expiresAt: string | null | undefined): string {
  if (!expiresAt) return '';
  const date = new Date(expiresAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`;
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  return `Expires in ${diffDays} days`;
}

export default function MealPlanPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [showAddModal, setShowAddModal] = useState<{ day: string; slot: string } | null>(null);
  const [showLeftoverModal, setShowLeftoverModal] = useState<MealPlanEntry | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [servings, setServings] = useState(4);
  const [leftoverServingsInput, setLeftoverServingsInput] = useState(2);
  const [leftoverExpiryInput, setLeftoverExpiryInput] = useState('');

  const { data: entries, isLoading } = useGetMealPlanQuery(currentWeekStart);
  const { data: recipes } = useGetRecipesQuery();
  const [addEntry] = useAddMealPlanEntryMutation();
  const [updateEntry] = useUpdateMealPlanEntryMutation();
  const [deleteEntry] = useDeleteMealPlanEntryMutation();
  const [generateList] = useGenerateGroceryListMutation();
  const [markAsLeftover] = useMarkAsLeftoverMutation();
  const [consumeLeftover] = useConsumeLeftoverMutation();

  // auto-regenerate grocery list when meal plan changes (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEntriesLength = useRef(entries?.length ?? 0);

  useEffect(() => {
    if (entries && entries.length !== prevEntriesLength.current) {
      prevEntriesLength.current = entries.length;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        generateList().then((result) => {
          if ('data' in result) {
            showToast('Grocery list updated', 'info');
          }
        });
      }, 500);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [entries, generateList]);

  const getEntriesForSlot = (day: string, slot: string) => {
    if (!entries) return [];
    const dayIndex = DAYS.indexOf(day);
    const weekStartDate = new Date(currentWeekStart);
    const targetDate = new Date(weekStartDate);
    targetDate.setDate(weekStartDate.getDate() + dayIndex);
    const dateStr = targetDate.toISOString().split('T')[0];
    return entries.filter((e) => e.planDate === dateStr && e.mealSlot === slot);
  };

  const handleAddEntry = async () => {
    if (!showAddModal || !selectedRecipeId) return;
    const dayIndex = DAYS.indexOf(showAddModal.day);
    const weekStartDate = new Date(currentWeekStart);
    const targetDate = new Date(weekStartDate);
    targetDate.setDate(weekStartDate.getDate() + dayIndex);
    const planDate = targetDate.toISOString().split('T')[0];

    await addEntry({
      recipeId: selectedRecipeId,
      planDate,
      mealSlot: showAddModal.slot,
      servings,
    });
    setShowAddModal(null);
    setSelectedRecipeId('');
    setServings(4);
    showToast('Meal added', 'success');
  };

  const handleUpdateServings = async (entry: MealPlanEntry, newServings: number) => {
    await updateEntry({ id: entry.id, data: { servings: newServings } });
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    showToast('Meal removed', 'info');
  };

  const handleMarkLeftover = async () => {
    if (!showLeftoverModal) return;
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 3);
    
    await markAsLeftover({
      id: showLeftoverModal.id,
      leftoverServings: leftoverServingsInput,
      leftoverExpiresAt: leftoverExpiryInput || defaultExpiry.toISOString().split('T')[0],
    });
    setShowLeftoverModal(null);
    setLeftoverServingsInput(2);
    setLeftoverExpiryInput('');
    showToast('Marked as leftover', 'success');
  };

  const handleConsumeLeftover = async (entry: MealPlanEntry) => {
    await consumeLeftover({ id: entry.id, servingsUsed: 1 });
    const remaining = (entry.leftoverServings || entry.servings) - 1;
    if (remaining <= 0) {
      showToast('Leftover fully consumed!', 'success');
    } else {
      showToast(`Used 1 serving, ${remaining} left`, 'info');
    }
  };

  const openLeftoverModal = (entry: MealPlanEntry) => {
    setShowLeftoverModal(entry);
    setLeftoverServingsInput(Math.max(1, entry.servings - 1));
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 3);
    setLeftoverExpiryInput(defaultExpiry.toISOString().split('T')[0]);
  };

  const navigateWeek = (direction: number) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + direction * 7);
    setCurrentWeekStart(getWeekStart(date));
  };

  const getEntryStyles = (entry: MealPlanEntry) => {
    if (!entry.isLeftover) return 'bg-green-50 border-green-200';
    const expired = isExpired(entry.leftoverExpiresAt);
    const fullyConsumed = entry.leftoverServings !== null && entry.leftoverServings !== undefined && entry.leftoverServings <= 0;
    
    if (fullyConsumed) return 'bg-gray-100 border-gray-300 opacity-50';
    if (expired) return 'bg-red-50 border-red-300';
    return 'bg-amber-50 border-amber-300';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Meal Plan</h1>
        <button
          onClick={() => generateList()}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Generate Grocery List
        </button>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateWeek(-1)}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm transition-colors"
          >
            ← Prev Week
          </button>
          <span className="text-sm font-medium text-gray-600">
            Week of {new Date(currentWeekStart).toLocaleDateString()}
          </span>
          <button
            onClick={() => navigateWeek(1)}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm transition-colors"
          >
            Next Week →
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block"></span> Regular</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block"></span> Leftover</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-300 inline-block"></span> Expired</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block opacity-50"></span> Consumed</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3 text-gray-600">Loading meal plan...</span>
        </div>
      ) : (
        <>
          {(!entries || entries.length === 0) && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-green-800 font-medium">Plan your week!</p>
              <p className="text-green-600 text-sm mt-1">Click the + button on any slot to add recipes. Then generate your grocery list.</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[900px]">
              {DAYS.map((day) => (
                <div key={day} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-green-600 text-white text-center py-2 font-medium text-sm">
                    {day}
                  </div>
                  <div className="p-2 space-y-2">
                    {MEAL_SLOTS.map((slot) => {
                      const slotEntries = getEntriesForSlot(day, slot);
                      return (
                        <div key={slot} className="border-b border-gray-100 pb-2 last:border-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-500 uppercase">{slot}</span>
                            <button
                              onClick={() => setShowAddModal({ day, slot })}
                              className="text-green-600 hover:text-green-700 text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                          {slotEntries.length === 0 ? (
                            <p className="text-xs text-gray-300 italic">Empty</p>
                          ) : (
                            slotEntries.map((entry) => {
                              const fullyConsumed = entry.isLeftover && entry.leftoverServings !== null && entry.leftoverServings !== undefined && entry.leftoverServings <= 0;
                              const expired = entry.isLeftover && isExpired(entry.leftoverExpiresAt);
                              
                              return (
                                <div
                                  key={entry.id}
                                  className={`rounded p-1.5 mb-1 text-xs border relative group ${getEntryStyles(entry)}`}
                                  title={entry.isLeftover ? formatExpiry(entry.leftoverExpiresAt) : ''}
                                >
                                  {/* Hover tooltip for leftover expiry */}
                                  {entry.isLeftover && entry.leftoverExpiresAt && (
                                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10">
                                      <div className={`text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap ${expired ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'}`}>
                                        {formatExpiry(entry.leftoverExpiresAt)}
                                        {entry.leftoverServings !== null && entry.leftoverServings !== undefined && (
                                          <span> · {entry.leftoverServings} serving{entry.leftoverServings !== 1 ? 's' : ''} left</span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <p className={`font-medium truncate ${fullyConsumed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {entry.isLeftover && <span className="mr-0.5">{fullyConsumed ? '✓' : expired ? '⚠' : '🍱'}</span>}
                                    {entry.recipe?.name || 'Unknown'}
                                  </p>
                                  
                                  {/* Leftover info line */}
                                  {entry.isLeftover && !fullyConsumed && (
                                    <p className={`text-xs mt-0.5 ${expired ? 'text-red-500 font-medium' : 'text-amber-600'}`}>
                                      {entry.leftoverServings ?? entry.servings}sv left
                                      {expired && ' · EXPIRED'}
                                    </p>
                                  )}

                                  <div className="flex items-center justify-between mt-1">
                                    <div className="flex items-center gap-1">
                                      {!entry.isLeftover ? (
                                        <>
                                          <button
                                            onClick={() => handleUpdateServings(entry, Math.max(1, entry.servings - 1))}
                                            className="w-4 h-4 bg-gray-200 rounded text-xs flex items-center justify-center hover:bg-gray-300"
                                          >
                                            -
                                          </button>
                                          <span className="text-gray-600">{entry.servings}sv</span>
                                          <button
                                            onClick={() => handleUpdateServings(entry, entry.servings + 1)}
                                            className="w-4 h-4 bg-gray-200 rounded text-xs flex items-center justify-center hover:bg-gray-300"
                                          >
                                            +
                                          </button>
                                        </>
                                      ) : !fullyConsumed ? (
                                        <button
                                          onClick={() => handleConsumeLeftover(entry)}
                                          className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded transition-colors"
                                        >
                                          Use 1sv
                                        </button>
                                      ) : (
                                        <span className="text-xs text-gray-400">Done</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      {!entry.isLeftover && (
                                        <button
                                          onClick={() => openLeftoverModal(entry)}
                                          className="text-amber-500 hover:text-amber-600 text-xs"
                                          title="Mark as leftover"
                                        >
                                          🍱
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDelete(entry.id)}
                                        className="text-red-400 hover:text-red-600"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Add Recipe - {showAddModal.day} {showAddModal.slot}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe</label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  <option value="">Select a recipe...</option>
                  {recipes?.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
                <input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  min={1}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddEntry}
                  disabled={!selectedRecipeId}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddModal(null); setSelectedRecipeId(''); setServings(4); }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Leftover Modal */}
      {showLeftoverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              Mark as Leftover
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {showLeftoverModal.recipe?.name} — how many servings are left over?
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leftover Servings</label>
                <input
                  type="number"
                  value={leftoverServingsInput}
                  onChange={(e) => setLeftoverServingsInput(Number(e.target.value))}
                  min={1}
                  max={showLeftoverModal.servings}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Out of {showLeftoverModal.servings} total servings cooked</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expires On</label>
                <input
                  type="date"
                  value={leftoverExpiryInput}
                  onChange={(e) => setLeftoverExpiryInput(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">When should this be eaten by?</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleMarkLeftover}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Mark as Leftover
                </button>
                <button
                  onClick={() => { setShowLeftoverModal(null); setLeftoverServingsInput(2); setLeftoverExpiryInput(''); }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
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
