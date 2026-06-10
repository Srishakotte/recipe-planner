import { useState } from 'react';
import {
  useGetPantryQuery,
  useAddPantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
  useAiSuggestRecipesMutation,
  PantryItem,
} from '../../../app/api';

const categories = ['All', 'Vegetables', 'Fruits', 'Protein', 'Dairy', 'Grains', 'Spices', 'Other'];

const getStatus = (item: PantryItem) => {
  if (!item.expirationDate) return { label: 'Good', color: 'bg-green-100 text-green-700', icon: '✓' };
  const daysLeft = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / 86400000);
  if (daysLeft <= 0) return { label: 'Expired', color: 'bg-red-100 text-red-700', icon: '⚠️' };
  if (daysLeft <= 2) return { label: 'Expiring Soon', color: 'bg-amber-100 text-amber-700', icon: '⚠️' };
  if (daysLeft <= 5) return { label: `${daysLeft} days`, color: 'bg-yellow-50 text-yellow-700', icon: '⏰' };
  return { label: 'Good', color: 'bg-green-100 text-green-700', icon: '✓' };
};

export default function PantryPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiRecipes, setAiRecipes] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestRecipes] = useAiSuggestRecipesMutation();

  const { data: items, isLoading } = useGetPantryQuery();
  const [addItem, { isLoading: isAdding }] = useAddPantryItemMutation();
  const [updateItem] = useUpdatePantryItemMutation();
  const [deleteItem] = useDeletePantryItemMutation();

  const resetForm = () => {
    setName(''); setQuantity(1); setUnit(''); setExpirationDate('');
    setEditingItem(null); setShowForm(false);
  };

  const handleEdit = (item: PantryItem) => {
    setEditingItem(item); setName(item.name); setQuantity(item.quantity);
    setUnit(item.unit);
    // Format date for input[type="date"] — needs YYYY-MM-DD
    const expDate = item.expirationDate ? item.expirationDate.split('T')[0] : '';
    setExpirationDate(expDate);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, quantity, unit, expirationDate: expirationDate || undefined };
    try {
      if (editingItem) {
        await updateItem({ id: editingItem.id, data }).unwrap();
      } else {
        await addItem(data).unwrap();
      }
    } catch (err) {
      console.error('Pantry operation failed:', err);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Remove from pantry?')) {
      try {
        await deleteItem(id).unwrap();
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  const filteredItems = (items || []).filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group items by name (same ingredient with different expiry dates)
  interface GroupedItem {
    name: string;
    unit: string;
    totalQty: number;
    entries: PantryItem[]; // individual entries (may have different expiry)
    expiringQty: number; // quantity expiring within 3 days
    expiredQty: number; // quantity already expired
    safeQty: number; // quantity NOT expiring soon
    earliestExpiry: string | null;
  }

  const groupedItems: GroupedItem[] = [];
  const grouped: Record<string, PantryItem[]> = {};
  filteredItems.forEach(item => {
    const key = `${item.name.toLowerCase().trim()}|||${item.unit.toLowerCase().trim()}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  Object.values(grouped).forEach(entries => {
    const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);
    let expiringQty = 0;
    let expiredQty = 0;
    let earliestExpiry: string | null = null;

    entries.forEach(e => {
      if (e.expirationDate) {
        const daysLeft = Math.ceil((new Date(e.expirationDate).getTime() - Date.now()) / 86400000);
        if (daysLeft <= 0) {
          expiredQty += e.quantity;
        } else if (daysLeft <= 3) {
          expiringQty += e.quantity;
        }
        if (!earliestExpiry || e.expirationDate < earliestExpiry) {
          earliestExpiry = e.expirationDate;
        }
      }
    });

    const safeQty = totalQty - expiringQty - expiredQty;

    groupedItems.push({
      name: entries[0].name,
      unit: entries[0].unit,
      totalQty,
      entries,
      expiringQty,
      expiredQty,
      safeQty,
      earliestExpiry,
    });
  });

  const expiringItems = filteredItems.filter(item => {
    if (!item.expirationDate) return false;
    const daysLeft = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / 86400000);
    return daysLeft <= 3 && daysLeft >= 0;
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Pantry</h1>
          <p className="text-gray-500 mt-1">Track ingredients and reduce waste</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setShowAiPanel(true);
              setAiLoading(true);
              try {
                const result = await suggestRecipes();
                if ('data' in result && result.data?.suggestions) {
                  setAiRecipes(result.data.suggestions);
                }
              } catch (e) { console.error(e); }
              setAiLoading(false);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-200 transition-all hover:scale-[1.02]"
          >
            🍳 What Can I Cook?
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-[1.02]"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* AI "What Can I Cook" Panel */}
      {showAiPanel && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-purple-100 animate-scale-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🍳</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">What Can I Cook Right Now?</h3>
              <p className="text-sm text-gray-600 mt-1">Based on your {filteredItems.length} pantry items:</p>
              {aiLoading ? (
                <div className="mt-4 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-300 border-t-purple-600"></div>
                  <span className="text-sm text-purple-600">AI is thinking...</span>
                </div>
              ) : aiRecipes.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {aiRecipes.slice(0, 3).map((recipe: any, i: number) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-purple-100 card-hover cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{['🍳', '🥗', '🍲'][i % 3]}</span>
                        <div>
                          <p className="font-medium text-sm text-gray-800">{recipe.name}</p>
                          <p className="text-xs text-gray-500">
                            ⏱ {recipe.cookingTime || 20} min • 🔥 {recipe.calories || 350} kcal • 💪 {recipe.protein || 15}g
                          </p>
                          {recipe.ingredientsUsed && (
                            <p className="text-[10px] text-purple-500 mt-1">Uses: {recipe.ingredientsUsed.join(', ')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-400">Click the button to get AI suggestions!</p>
              )}
              <p className="text-xs text-purple-500 mt-3 font-medium">✨ Powered by Gemini AI</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 stagger-children">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center mb-2"><span className="text-sm">📦</span></div>
          <p className="text-2xl font-bold text-gray-900">{groupedItems.length}</p>
          <p className="text-xs text-gray-500">Unique Items</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center mb-2"><span className="text-sm">⚠️</span></div>
          <p className="text-2xl font-bold text-amber-600">{expiringItems.length}</p>
          <p className="text-xs text-gray-500">Expiring Soon</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center mb-2"><span className="text-sm">❌</span></div>
          <p className="text-2xl font-bold text-red-600">{groupedItems.reduce((s, g) => s + g.expiredQty, 0)}</p>
          <p className="text-xs text-gray-500">Expired Qty</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center mb-2"><span className="text-sm">✅</span></div>
          <p className="text-2xl font-bold text-green-600">{filteredItems.length}</p>
          <p className="text-xs text-gray-500">Total Entries</p>
        </div>
      </div>

      {/* Expiring Soon Banner */}
      {expiringItems.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200">
          <h3 className="font-bold text-amber-800 flex items-center gap-2">
            <span>⚠️</span> Expiring Soon · Use These First!
          </h3>
          <div className="flex flex-wrap gap-3 mt-3">
            {expiringItems.map(item => {
              const daysLeft = Math.ceil((new Date(item.expirationDate!).getTime() - Date.now()) / 86400000);
              return (
                <div key={item.id} className="bg-white rounded-xl px-4 py-2 border border-amber-200 flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-800">{item.name}</span>
                  <span className="text-xs text-amber-600 font-medium">
                    {daysLeft <= 0 ? 'Expired!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-amber-600 mt-3">💡 Cook these items to avoid waste</p>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search pantry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none text-sm shadow-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-scale-in">
          <h3 className="font-bold text-gray-800 mb-4">{editingItem ? 'Edit Item' : 'Add to Pantry'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Item Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 outline-none" placeholder="e.g. Eggs" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Quantity</label>
              <input type="number" step="0.25" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Unit</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 outline-none" placeholder="g, ml, piece" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Expiry Date</label>
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={isAdding}
                className="px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
                {editingItem ? 'Save' : 'Add'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pantry Table — Grouped by item name */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center animate-pulse">
            <span className="text-xl">🏠</span>
          </div>
        </div>
      ) : groupedItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <span className="text-5xl">🏠</span>
          <p className="text-gray-600 font-medium mt-4">Pantry is empty</p>
          <p className="text-gray-400 text-sm mt-1">Add items you have at home!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Available</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiring</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groupedItems.map((group) => {
                // Determine overall status for the group
                let statusLabel = 'Good';
                let statusColor = 'bg-green-100 text-green-700';
                let statusIcon = '✓';
                if (group.expiredQty > 0) {
                  statusLabel = `${group.expiredQty} expired`;
                  statusColor = 'bg-red-100 text-red-700';
                  statusIcon = '⚠️';
                } else if (group.expiringQty > 0) {
                  statusLabel = `${group.expiringQty} expiring`;
                  statusColor = 'bg-amber-100 text-amber-700';
                  statusIcon = '⏰';
                }

                return (
                  <tr key={group.name + group.unit} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-medium text-gray-900 capitalize">{group.name}</span>
                      {group.entries.length > 1 && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md font-medium">
                          {group.entries.length} batches
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-gray-800">{group.totalQty}</span>
                      <span className="text-gray-500 ml-1 text-sm">{group.unit}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-green-700">{group.safeQty}</span>
                      <span className="text-gray-400 ml-1 text-sm">{group.unit}</span>
                    </td>
                    <td className="px-5 py-4">
                      {(group.expiringQty > 0 || group.expiredQty > 0) ? (
                        <div className="space-y-0.5">
                          {group.expiringQty > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700">
                              ⏰ {group.expiringQty} {group.unit} soon
                            </span>
                          )}
                          {group.expiredQty > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700">
                              ❌ {group.expiredQty} {group.unit} expired
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${statusColor}`}>
                        {statusIcon} {statusLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {group.entries.length === 1 ? (
                        <>
                          <button onClick={() => handleEdit(group.entries[0])} className="text-xs text-green-600 hover:text-green-700 font-medium mr-3">Edit</button>
                          <button onClick={() => handleDelete(group.entries[0].id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                        </>
                      ) : (
                        <div className="space-y-1">
                          {group.entries.map((entry, i) => {
                            const daysLeft = entry.expirationDate
                              ? Math.ceil((new Date(entry.expirationDate).getTime() - Date.now()) / 86400000)
                              : null;
                            return (
                              <div key={entry.id} className="flex items-center justify-end gap-2">
                                <span className="text-[10px] text-gray-400">
                                  {entry.quantity}{entry.unit}
                                  {daysLeft !== null && (
                                    <span className={`ml-1 ${daysLeft <= 0 ? 'text-red-500' : daysLeft <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                                      ({daysLeft <= 0 ? 'exp' : `${daysLeft}d`})
                                    </span>
                                  )}
                                </span>
                                <button onClick={() => handleEdit(entry)} className="text-[10px] text-green-600 hover:text-green-700 font-medium">✏️</button>
                                <button onClick={() => handleDelete(entry.id)} className="text-[10px] text-red-500 hover:text-red-700 font-medium">🗑️</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
