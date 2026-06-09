import { useState } from 'react';
import {
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
  Recipe,
  Ingredient,
} from '../../../app/api';

interface RecipeFormProps {
  recipe?: Recipe | null;
  onClose: () => void;
}

const emptyIngredient: Omit<Ingredient, 'id'> = {
  name: '',
  displayName: '',
  quantity: 0,
  unit: '',
  storeSection: 'Produce',
  sortOrder: 0,
};

const storeSections = ['Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen', 'Canned', 'Dry Goods', 'Spices', 'Beverages', 'Other'];

export default function RecipeForm({ recipe, onClose }: RecipeFormProps) {
  const [name, setName] = useState(recipe?.name || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [defaultServings, setDefaultServings] = useState(recipe?.defaultServings || 4);
  const [ingredients, setIngredients] = useState<Omit<Ingredient, 'id'>[]>(
    recipe?.ingredients.map(({ id: _id, ...rest }) => rest) || [{ ...emptyIngredient }]
  );

  const [createRecipe, { isLoading: isCreating }] = useCreateRecipeMutation();
  const [updateRecipe, { isLoading: isUpdating }] = useUpdateRecipeMutation();

  const isEditing = !!recipe;
  const isSaving = isCreating || isUpdating;

  const addIngredient = () => {
    setIngredients([...ingredients, { ...emptyIngredient, sortOrder: ingredients.length }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: string, value: string | number) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, description, defaultServings, ingredients };

    try {
      if (isEditing) {
        await updateRecipe({ id: recipe.id, data }).unwrap();
      } else {
        await createRecipe(data).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save recipe:', err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          {isEditing ? 'Edit Recipe' : 'New Recipe'}
        </h1>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          ← Back to Recipes
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="e.g., Chicken Stir Fry"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              placeholder="Brief description of the recipe..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Steps / Instructions (optional)</label>
            <textarea
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              placeholder="1. Heat oil in a pan&#10;2. Add garlic and cook...&#10;3. Add rice and stir fry..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Servings</label>
            <input
              type="number"
              value={defaultServings}
              onChange={(e) => setDefaultServings(Number(e.target.value))}
              min={1}
              className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Ingredients</h2>
            <button
              type="button"
              onClick={addIngredient}
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              + Add Ingredient
            </button>
          </div>

          {ingredients.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No ingredients added yet.</p>
          ) : (
            <div className="space-y-3">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      required
                      className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Display Name"
                      value={ingredient.displayName || ''}
                      onChange={(e) => updateIngredient(index, 'displayName', e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={ingredient.quantity || ''}
                      onChange={(e) => updateIngredient(index, 'quantity', Number(e.target.value))}
                      min={0}
                      step="any"
                      className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                    <select
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    >
                      <option value="">Unit</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="cup">cup</option>
                      <option value="tbsp">tbsp</option>
                      <option value="tsp">tsp</option>
                      <option value="oz">oz</option>
                      <option value="lb">lb</option>
                      <option value="piece">piece</option>
                      <option value="clove">clove</option>
                      <option value="can">can</option>
                      <option value="bunch">bunch</option>
                      <option value="slice">slice</option>
                    </select>
                    <select
                      value={ingredient.storeSection}
                      onChange={(e) => updateIngredient(index, 'storeSection', e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    >
                      {storeSections.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="mt-1 text-red-400 hover:text-red-600 text-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update Recipe' : 'Create Recipe'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
