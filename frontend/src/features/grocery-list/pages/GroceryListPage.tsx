import { useState } from 'react';
import {
  useGetGroceryListQuery,
  useGenerateGroceryListMutation,
  useCheckGroceryItemMutation,
  useOverrideGroceryItemMutation,
  useMarkAlreadyHaveMutation,
  useAddAdHocItemMutation,
  useDeleteGroceryItemMutation,
  useAiEstimateCostMutation,
  GroceryItem,
} from '../../../app/api';

const tabs = ['All', 'Need To Buy', 'In Pantry', 'Purchased'];

export default function GroceryListPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [adHocName, setAdHocName] = useState('');
  const [adHocQty, setAdHocQty] = useState(1);
  const [adHocUnit, setAdHocUnit] = useState('piece');
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [costLoading, setCostLoading] = useState(false);

  const { data: groceryList, isLoading } = useGetGroceryListQuery();
  const [generateList, { isLoading: isGenerating }] = useGenerateGroceryListMutation();
  const [checkItem] = useCheckGroceryItemMutation();
  const [overrideItem] = useOverrideGroceryItemMutation();
  const [markAlreadyHave] = useMarkAlreadyHaveMutation();
  const [addAdHocItem] = useAddAdHocItemMutation();
  const [deleteItem] = useDeleteGroceryItemMutation();
  const [estimateCost] = useAiEstimateCostMutation();

  const items = groceryList?.items || [];

  // Filter by tab
  const filteredItems = items.filter(item => {
    if (search && !item.ingredientName.toLowerCase().includes(search.toLowerCase())) return false;
    switch (activeTab) {
      case 'Need To Buy': return !item.isChecked && !item.isAlreadyHave && item.computedQty > 0;
      case 'In Pantry': return item.isAlreadyHave || item.computedQty === 0;
      case 'Purchased': return item.isChecked;
      default: return true;
    }
  });

  // Stats
  const needToBuy = items.filter(i => !i.isChecked && !i.isAlreadyHave && i.computedQty > 0);
  const inPantry = items.filter(i => i.isAlreadyHave || i.computedQty === 0);
  const purchased = items.filter(i => i.isChecked);

  // Group by section
  const groupedItems: Record<string, GroceryItem[]> = {};
  filteredItems.forEach(item => {
    const section = item.storeSection || 'other';
    if (!groupedItems[section]) groupedItems[section] = [];
    groupedItems[section].push(item);
  });

  const handleCheck = async (item: GroceryItem) => {
    await checkItem({ id: item.id, isChecked: !item.isChecked });
  };

  const handleOverride = async (id: string) => {
    await overrideItem({ id, overrideQty: overrideValue });
    setOverrideId(null);
  };

  const handleAddAdHoc = async () => {
    if (!adHocName) return;
    await addAdHocItem({ ingredientName: adHocName, computedQty: adHocQty, unit: adHocUnit, storeSection: 'other' });
    setAdHocName(''); setAdHocQty(1); setShowAddForm(false);
  };

  const handleExportCSV = () => {
    const buyItems = items.filter(i => i.computedQty > 0 && !i.isAlreadyHave);
    const csv = ['Item,Quantity,Unit,Section']
      .concat(buyItems.map(i => `"${i.ingredientName}",${i.overrideQty ?? i.computedQty},"${i.unit}","${i.storeSection}"`))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'grocery-list.csv'; a.click();
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🛒 Grocery List</h1>
          <p className="text-gray-500 mt-1">Auto-generated from your meal plan and pantry</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportCSV} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all">
            📄 Export CSV
          </button>
          <button
            onClick={async () => { await generateList(); }}
            disabled={isGenerating}
            className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Smart Summary Cards */}
      <div className="grid grid-cols-4 gap-4 stagger-children">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center mb-2"><span className="text-sm">📋</span></div>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
          <p className="text-xs text-gray-500">Total Items</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center mb-2"><span className="text-sm">✅</span></div>
          <p className="text-2xl font-bold text-green-600">{inPantry.length}</p>
          <p className="text-xs text-gray-500">Already Have</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center mb-2"><span className="text-sm">🛍️</span></div>
          <p className="text-2xl font-bold text-amber-600">{needToBuy.length}</p>
          <p className="text-xs text-gray-500">Need To Buy</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm card-hover cursor-pointer" onClick={async () => {
          if (estimatedCost !== null) return;
          setCostLoading(true);
          try {
            const result = await estimateCost().unwrap();
            setEstimatedCost(result.totalCost);
          } catch (e) {
            setEstimatedCost(needToBuy.length * 60);
          }
          setCostLoading(false);
        }}>
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center mb-2"><span className="text-sm">💰</span></div>
          {costLoading ? (
            <>
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-300 border-t-purple-600"></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Estimating...</p>
            </>
          ) : estimatedCost !== null ? (
            <>
              <p className="text-2xl font-bold text-purple-600">₹{estimatedCost}</p>
              <p className="text-xs text-gray-500">Est. Cost (AI)</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-purple-600">Click</p>
              <p className="text-xs text-gray-500">Estimate Cost (AI)</p>
            </>
          )}
        </div>
      </div>


      {/* Tabs + Search */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab} ({tab === 'All' ? items.length : tab === 'Need To Buy' ? needToBuy.length : tab === 'In Pantry' ? inPantry.length : purchased.length})
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 outline-none"
          />
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
          + Add Item
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm animate-scale-in flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Item Name</label>
            <input type="text" value={adHocName} onChange={(e) => setAdHocName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="e.g. Paper towels" />
          </div>
          <div className="w-20">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Qty</label>
            <input type="number" value={adHocQty} onChange={(e) => setAdHocQty(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
          </div>
          <div className="w-24">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Unit</label>
            <select value={adHocUnit} onChange={(e) => setAdHocUnit(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
              <option value="piece">piece</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="cup">cup</option>
              <option value="tbsp">tbsp</option>
              <option value="tsp">tsp</option>
              <option value="oz">oz</option>
              <option value="lb">lb</option>
              <option value="can">can</option>
              <option value="bunch">bunch</option>
              <option value="packet">packet</option>
            </select>
          </div>
          <button onClick={handleAddAdHoc} className="px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl">Add</button>
          <button onClick={() => setShowAddForm(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
        </div>
      )}

      {/* Shopping Progress Bar */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">Shopping Progress</span>
            <span className="text-xs text-gray-500">{purchased.length}/{items.length} items</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${items.length > 0 ? (purchased.length / items.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Grocery Items by Section */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center animate-pulse">
            <span className="text-2xl">🛒</span>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <span className="text-5xl">🛒</span>
          <p className="text-gray-600 font-medium mt-4">
            {items.length === 0 ? 'No grocery list yet' : 'No items match your filter'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {items.length === 0 ? 'Add meals to your plan and generate a list!' : 'Try a different tab or search term'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {Object.entries(groupedItems).map(([section, sectionItems]) => (
            <div key={section} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2">
                <span className="text-sm">
                  {section === 'produce' ? '🥬' : section === 'dairy' ? '🥛' : section === 'meat' ? '🥩' : section === 'pantry' ? '🏠' : section === 'bakery' ? '🍞' : section === 'frozen' ? '🧊' : '📦'}
                </span>
                <h3 className="font-semibold text-gray-700 capitalize text-sm">
                  {section === 'produce' ? 'Fresh Produce' : section === 'dairy' ? 'Dairy & Eggs' : section === 'meat' ? 'Meat & Seafood' : section === 'pantry' ? 'Pantry Staples' : section === 'bakery' ? 'Bakery' : section === 'frozen' ? 'Frozen Foods' : 'Other Items'}
                </h3>
                <span className="text-xs text-gray-400 ml-auto">{sectionItems.length} items</span>
              </div>
              <div className="divide-y divide-gray-50">
                {sectionItems.map(item => (
                  <div key={item.id} className={`px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition-colors ${item.isChecked ? 'opacity-50' : ''} ${item.computedQty === 0 ? 'bg-green-50/40' : ''}`}>
                    <input
                      type="checkbox"
                      checked={item.isChecked || item.computedQty === 0}
                      onChange={() => item.computedQty > 0 && handleCheck(item)}
                      className="w-4.5 h-4.5 rounded-md border-gray-300 text-green-600 focus:ring-green-200"
                    />
                    <div className="flex-1">
                      <span className={`font-medium text-sm ${item.isChecked || item.computedQty === 0 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {item.ingredientName}
                      </span>
                      {item.computedQty === 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-md font-medium">✅ in pantry</span>}
                      {item.isAdHoc && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-medium">custom</span>}
                      {item.isAlreadyHave && item.computedQty > 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-md font-medium">have it</span>}
                      {/* Source recipes */}
                      {item.sourceRecipes && (item.sourceRecipes as any[]).length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          From: {(item.sourceRecipes as any[]).map((s: any) => typeof s === 'string' ? s : s.recipeName).join(', ')}
                        </p>
                      )}
                    </div>
                    {/* Quantity */}
                    {overrideId === item.id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" step="0.25" value={overrideValue} onChange={(e) => setOverrideValue(Number(e.target.value))}
                          className="w-16 px-2 py-1 border rounded-lg text-xs" autoFocus />
                        <button onClick={() => handleOverride(item.id)} className="text-green-600 text-xs font-bold">✓</button>
                        <button onClick={() => setOverrideId(null)} className="text-gray-400 text-xs">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setOverrideId(item.id); setOverrideValue(item.overrideQty ?? item.computedQty); }}
                        className="text-sm text-gray-600 hover:text-green-600 font-medium px-2 py-1 rounded-lg hover:bg-green-50 transition-colors"
                      >
                        {item.overrideQty ?? item.computedQty} {item.unit}
                      </button>
                    )}
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {!item.isAlreadyHave && (
                        <button onClick={() => markAlreadyHave({ id: item.id, isAlreadyHave: true })}
                          className="text-xs text-gray-400 hover:text-green-600 px-1.5 py-1 rounded hover:bg-green-50" title="Have it">🏠</button>
                      )}
                      <button onClick={() => deleteItem(item.id)}
                        className="text-xs text-gray-400 hover:text-red-600 px-1.5 py-1 rounded hover:bg-red-50" title="Remove">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
