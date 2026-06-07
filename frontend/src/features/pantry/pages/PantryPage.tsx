import { useState } from 'react';
import {
  useGetPantryQuery,
  useAddPantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
  PantryItem,
} from '../../../app/api';

export default function PantryPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const { data: items, isLoading } = useGetPantryQuery();
  const [addItem, { isLoading: isAdding }] = useAddPantryItemMutation();
  const [updateItem, { isLoading: isUpdating }] = useUpdatePantryItemMutation();
  const [deleteItem] = useDeletePantryItemMutation();

  const isSaving = isAdding || isUpdating;

  const resetForm = () => {
    setName('');
    setQuantity(1);
    setUnit('');
    setExpirationDate('');
    setEditingItem(null);
    setShowForm(false);
  };

  const handleEdit = (item: PantryItem) => {
    setEditingItem(item);
    setName(item.name);
    setQuantity(item.quantity);
    setUnit(item.unit);
    setExpirationDate(item.expirationDate || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name,
      quantity,
      unit,
      expirationDate: expirationDate || undefined,
    };

    try {
      if (editingItem) {
        await updateItem({ id: editingItem.id, data }).unwrap();
      } else {
        await addItem(data).unwrap();
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save pantry item:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Remove this item from your pantry?')) {
      await deleteItem(id);
    }
  };

  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const expiry = new Date(date);
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    return expiry <= threeDays;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Pantry</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Add Item
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {editingItem ? 'Edit Item' : 'Add New Item'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Item name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min={0}
                step="any"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              <input
                type="text"
                placeholder="Unit (e.g., lbs, cups)"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              <input
                type="date"
                placeholder="Expiration"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {isSaving ? 'Saving...' : editingItem ? 'Update' : 'Add'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3 text-gray-600">Loading pantry...</span>
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">Your pantry is empty.</p>
          <p className="text-gray-400 mt-2">Add items you already have at home!</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unit</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Expires</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3">
                    {item.expirationDate ? (
                      <span className={`text-sm ${isExpiringSoon(item.expirationDate) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {new Date(item.expirationDate).toLocaleDateString()}
                        {isExpiringSoon(item.expirationDate) && ' ⚠'}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-sm text-green-600 hover:text-green-700 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
