import { useState } from 'react';
import {
  useGetGroceryListQuery,
  useGenerateGroceryListMutation,
  useCheckGroceryItemMutation,
  useOverrideGroceryItemMutation,
  useMarkAlreadyHaveMutation,
  useAddAdHocItemMutation,
  useDeleteGroceryItemMutation,
  GroceryItem,
} from '../../../app/api';
import { showToast } from '../../../shared/components/Toast';

export default function GroceryListPage() {
  const [sectionFilter, setSectionFilter] = useState('');
  const [uncheckedOnly, setUncheckedOnly] = useState(false);
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [showAdHocForm, setShowAdHocForm] = useState(false);
  const [adHocName, setAdHocName] = useState('');
  const [adHocQty, setAdHocQty] = useState(1);
  const [adHocUnit, setAdHocUnit] = useState('');
  const [adHocSection, setAdHocSection] = useState('Other');
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState(0);
  const [aiEstimate, setAiEstimate] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const filters = {
    section: sectionFilter || undefined,
    uncheckedOnly: uncheckedOnly || undefined,
    warningsOnly: warningsOnly || undefined,
  };

  const { data: groceryList, isLoading } = useGetGroceryListQuery(
    Object.values(filters).some(Boolean) ? filters : undefined
  );
  const [generateList, { isLoading: isGenerating }] = useGenerateGroceryListMutation();
  const [checkItem] = useCheckGroceryItemMutation();
  const [overrideItem] = useOverrideGroceryItemMutation();
  const [markAlreadyHave] = useMarkAlreadyHaveMutation();
  const [addAdHocItem] = useAddAdHocItemMutation();
  const [deleteItem] = useDeleteGroceryItemMutation();

  const handleCheck = async (item: GroceryItem) => {
    await checkItem({ id: item.id, isChecked: !item.isChecked });
  };

  const handleOverride = async (id: string) => {
    await overrideItem({ id, overrideQty: overrideValue });
    setOverrideId(null);
  };

  const handleMarkAlreadyHave = async (item: GroceryItem) => {
    await markAlreadyHave({ id: item.id, isAlreadyHave: !item.isAlreadyHave });
  };

  const handleAddAdHoc = async () => {
    if (!adHocName) return;
    await addAdHocItem({
      ingredientName: adHocName,
      computedQty: adHocQty,
      unit: adHocUnit,
      storeSection: adHocSection,
    });
    setShowAdHocForm(false);
    setAdHocName('');
    setAdHocQty(1);
    setAdHocUnit('');
    setAdHocSection('Other');
    showToast('Item added', 'success');
  };

  const handleDelete = async (id: string) => {
    await deleteItem(id);
  };

  const handleAiEstimate = async () => {
    if (!groceryList?.items) return;
    setAiLoading(true);
    try {
      const toBuyItems = groceryList.items.filter(i => !i.isAlreadyHave && i.computedQty > 0 && !i.isChecked);
      const itemsList = toBuyItems.map(i => `${i.overrideQty ?? i.computedQty} ${i.unit} ${i.ingredientName}`).join(', ');
      
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Estimate the total grocery cost for these items in Indian Rupees (INR). Consider average prices from online grocery stores like Amazon Fresh, BigBasket, Instamart, and Zepto. List each item with its estimated price range, then give a total estimated range. Items: ${itemsList}`,
          context: 'grocery_cost_estimation'
        }),
      });
      const data = await res.json();
      setAiEstimate(data.response || data.error || 'Could not generate estimate');
    } catch {
      setAiEstimate('Failed to connect to AI service. Make sure the API key is configured.');
    }
    setAiLoading(false);
  };

  // Separate items into: to buy, pantry-covered, checked off
  const toBuyItems: GroceryItem[] = [];
  const pantryCoveredItems: GroceryItem[] = [];
  const checkedItems: GroceryItem[] = [];

  if (groceryList?.items) {
    groceryList.items.forEach((item) => {
      if (item.isAlreadyHave || item.computedQty === 0) {
        pantryCoveredItems.push(item);
      } else if (item.isChecked) {
        checkedItems.push(item);
      } else {
        toBuyItems.push(item);
      }
    });
  }

  // Group "to buy" items by section
  const groupedItems: Record<string, GroceryItem[]> = {};
  toBuyItems.forEach((item) => {
    const section = item.storeSection || 'Other';
    if (!groupedItems[section]) groupedItems[section] = [];
    groupedItems[section].push(item);
  });
  const sections = Object.keys(groupedItems).sort();

  // Group checked items by section too
  const groupedChecked: Record<string, GroceryItem[]> = {};
  checkedItems.forEach((item) => {
    const section = item.storeSection || 'Other';
    if (!groupedChecked[section]) groupedChecked[section] = [];
    groupedChecked[section].push(item);
  });

  const storeSections = ['Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen', 'Canned', 'Dry Goods', 'Spices', 'Beverages', 'Other'];

  // CSV export — only items to buy (not pantry-covered, not checked)
  const handleExportCSV = () => {
    const items = toBuyItems;
    const csv = ['Item,Quantity,Unit,Store Section']
      .concat(items.map(i => `"${i.ingredientName}",${i.overrideQty ?? i.computedQty},"${i.unit}","${i.storeSection}"`))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'grocery-list-to-buy.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${items.length} items to CSV`, 'success');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Grocery List</h1>
        <button
          onClick={async () => {
            const result = await generateList();
            if ('data' in result) {
              const items = (result.data as any)?.items?.length || 0;
              showToast(`Grocery list regenerated — ${items} items`, 'success');
            }
          }}
          disabled={isGenerating}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {isGenerating ? 'Generating...' : 'Generate List'}
        </button>
      </div>

      {/* Export + AI buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={handleExportCSV}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          Export CSV (To Buy Only)
        </button>
        <button
          onClick={() => window.print()}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          Print
        </button>
        <button
          onClick={handleAiEstimate}
          disabled={aiLoading || toBuyItems.length === 0}
          className="text-sm px-3 py-1.5 border border-purple-300 rounded-lg hover:bg-purple-50 text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
        >
          {aiLoading ? '✨ Estimating...' : '✨ AI Cost Estimate'}
        </button>
      </div>

      {/* AI Estimate Result */}
      {aiEstimate && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg relative">
          <button
            onClick={() => setAiEstimate(null)}
            className="absolute top-2 right-2 text-purple-400 hover:text-purple-600 text-sm"
          >
            ✕
          </button>
          <p className="text-sm font-medium text-purple-800 mb-2">✨ AI Cost Estimate</p>
          <div className="text-sm text-purple-700 whitespace-pre-wrap">{aiEstimate}</div>
          <p className="text-xs text-purple-400 mt-2 italic">Prices are estimates based on average online grocery store rates (Amazon, BigBasket, Instamart, Zepto)</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
        >
          <option value="">All Sections</option>
          {storeSections.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={uncheckedOnly}
            onChange={(e) => setUncheckedOnly(e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          Unchecked only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={warningsOnly}
            onChange={(e) => setWarningsOnly(e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          Warnings only
        </label>
        <button
          onClick={() => setShowAdHocForm(true)}
          className="ml-auto text-green-600 hover:text-green-700 text-sm font-medium"
        >
          + Add Item
        </button>
      </div>

      {/* Warnings banner */}
      {groceryList?.warnings && groceryList.warnings.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-medium text-yellow-800 mb-1">Warnings:</p>
          <ul className="text-sm text-yellow-700 list-disc list-inside">
            {groceryList.warnings.map((w, i) => (
              <li key={i}>{typeof w === 'string' ? w : (w as any).message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats bar */}
      {groceryList?.items && groceryList.items.length > 0 && (
        <div className="mb-4 flex items-center gap-4 px-4 py-2.5 bg-white border border-gray-200 rounded-lg">
          <span className="text-sm font-medium text-gray-700">
            🛒 {toBuyItems.length} to buy
          </span>
          <span className="text-sm text-green-600">
            ✓ {pantryCoveredItems.length} covered by pantry
          </span>
          <span className="text-sm text-gray-500">
            ☑ {checkedItems.length} checked off
          </span>
          {groceryList.items.some(i => i.warnings && (i.warnings as any[]).length > 0) && (
            <span className="text-sm text-yellow-600">
              ⚠ {groceryList.items.filter(i => i.warnings && (i.warnings as any[]).length > 0).length} warnings
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3 text-gray-600">Loading grocery list...</span>
        </div>
      ) : !groceryList || groceryList.items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">No grocery items yet.</p>
          <p className="text-gray-400 mt-2">Add recipes to your meal plan and generate a list!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* TO BUY section */}
          {sections.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">🛒 To Buy</h2>
              {sections.map((section) => (
                <div key={section} className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-3">
                  <div className="bg-green-50 px-4 py-2 border-b border-gray-200">
                    <h3 className="font-semibold text-green-800 text-sm">{section}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {groupedItems[section].map((item) => (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex items-center gap-3"
                      >
                        <input
                          type="checkbox"
                          checked={item.isChecked}
                          onChange={() => handleCheck(item)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-gray-800">
                            {item.ingredientName}
                          </span>
                          <span className="ml-2 text-sm text-gray-500">
                            {item.overrideQty ?? item.computedQty} {item.unit}
                          </span>
                          {item.isAdHoc && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">ad-hoc</span>
                          )}
                          {item.sourceRecipes && item.sourceRecipes.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              From: {(item.sourceRecipes as any[]).map((s: any) => 
                                typeof s === 'string' ? s : `${s.recipeName} (${s.contributionQty}${item.unit})`
                              ).join(', ')}
                            </p>
                          )}
                          {item.warnings && item.warnings.length > 0 && (
                            <p className="text-xs text-yellow-600 mt-0.5">
                              ⚠ {(item.warnings as any[]).map((w: any) => typeof w === 'string' ? w : w.message).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {overrideId === item.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={overrideValue}
                                onChange={(e) => setOverrideValue(Number(e.target.value))}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                                min={0}
                                step="any"
                              />
                              <button onClick={() => handleOverride(item.id)} className="text-xs text-green-600 hover:text-green-700">✓</button>
                              <button onClick={() => setOverrideId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => { setOverrideId(item.id); setOverrideValue(item.overrideQty ?? item.computedQty); }}
                                className="text-xs text-gray-400 hover:text-gray-600 px-1" title="Override quantity"
                              >✎</button>
                              <button
                                onClick={() => handleMarkAlreadyHave(item)}
                                className="text-xs text-gray-400 hover:text-green-600 px-1" title="Mark as already have"
                              >✓</button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-xs text-red-400 hover:text-red-600 px-1" title="Remove"
                              >×</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CHECKED OFF section */}
          {checkedItems.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2">☑ Checked Off ({checkedItems.length})</h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden opacity-60">
                <div className="divide-y divide-gray-100">
                  {checkedItems.map((item) => (
                    <div key={item.id} className="px-4 py-2 flex items-center gap-3 bg-gray-50">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => handleCheck(item)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="line-through text-gray-400 flex-1">{item.ingredientName}</span>
                      <span className="text-xs text-gray-400">{item.overrideQty ?? item.computedQty} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PANTRY COVERED section */}
          {pantryCoveredItems.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-green-600 uppercase tracking-wide mb-2">✓ Covered by Pantry ({pantryCoveredItems.length})</h2>
              <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
                <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                  <p className="text-xs text-green-600">These items are already in your pantry — no need to buy!</p>
                </div>
                <div className="divide-y divide-green-100">
                  {pantryCoveredItems.map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-green-500 text-sm">✓</span>
                      <div className="flex-1">
                        <span className="text-green-800 font-medium">{item.ingredientName}</span>
                        {item.computedQty === 0 ? (
                          <span className="ml-2 text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">fully covered by pantry</span>
                        ) : (
                          <span className="ml-2 text-xs text-green-600">{item.computedQty} {item.unit} covered</span>
                        )}
                      </div>
                      {item.isAlreadyHave && (
                        <button
                          onClick={() => handleMarkAlreadyHave(item)}
                          className="text-xs text-gray-400 hover:text-red-500"
                          title="Unmark"
                        >undo</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ad-hoc Item Modal */}
      {showAdHocForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Add Item</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Item name"
                value={adHocName}
                onChange={(e) => setAdHocName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Qty"
                  value={adHocQty}
                  onChange={(e) => setAdHocQty(Number(e.target.value))}
                  min={0}
                  step="any"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={adHocUnit}
                  onChange={(e) => setAdHocUnit(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <select
                value={adHocSection}
                onChange={(e) => setAdHocSection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              >
                {storeSections.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddAdHoc}
                  disabled={!adHocName}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAdHocForm(false)}
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
