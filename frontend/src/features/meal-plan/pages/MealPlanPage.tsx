import { useState } from 'react';
import {
  useGetMealPlanQuery,
  useGetRecipesQuery,
  useAddMealPlanEntryMutation,
  useUpdateMealPlanEntryMutation,
  useDeleteMealPlanEntryMutation,
  MealPlanEntry,
} from '../../../app/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export default function MealPlanPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [showAddModal, setShowAddModal] = useState<{ day: string; slot: string } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [servings, setServings] = useState(4);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);

  const { data: entries, isLoading } = useGetMealPlanQuery(currentWeekStart);
  const { data: recipes } = useGetRecipesQuery();
  const [addEntry] = useAddMealPlanEntryMutation();
  const [updateEntry] = useUpdateMealPlanEntryMutation();
  const [deleteEntry] = useDeleteMealPlanEntryMutation();

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
  };

  const handleUpdateServings = async (entry: MealPlanEntry, newServings: number) => {
    await updateEntry({ id: entry.id, data: { servings: newServings } });
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
  };

  const navigateWeek = (direction: number) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + direction * 7);
    setCurrentWeekStart(getWeekStart(date));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Meal Plan</h1>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3 text-gray-600">Loading meal plan...</span>
        </div>
      ) : (
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
                            className="text-green-600 hover:text-green-700 text-xs"
                          >
                            +
                          </button>
                        </div>
                        {slotEntries.length === 0 ? (
                          <p className="text-xs text-gray-300 italic">Empty</p>
                        ) : (
                          slotEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="bg-green-50 rounded p-1.5 mb-1 text-xs"
                            >
                              <p className="font-medium text-gray-800 truncate">
                                {entry.recipe?.name || 'Unknown'}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1">
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
                                </div>
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
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
                  onClick={() => setShowAddModal(null)}
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
