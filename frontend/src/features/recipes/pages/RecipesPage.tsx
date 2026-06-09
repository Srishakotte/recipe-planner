import { useState } from 'react';
import {
  useGetRecipesQuery,
  useDeleteRecipeMutation,
  Recipe,
} from '../../../app/api';
import RecipeForm from '../components/RecipeForm';

const mealTypes = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];
const defaultImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80';

export default function RecipesPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedType, setSelectedType] = useState('All');
  const [showAiGenerate, setShowAiGenerate] = useState(false);

  const { data: recipes, isLoading } = useGetRecipesQuery(search || undefined);
  const [deleteRecipe] = useDeleteRecipeMutation();

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this recipe?')) {
      await deleteRecipe(id);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingRecipe(null);
  };

  if (showForm) {
    return <RecipeForm recipe={editingRecipe} onClose={handleFormClose} />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipes</h1>
          <p className="text-gray-500 mt-1">Discover, create and manage your recipes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAiGenerate(!showAiGenerate)}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-200 transition-all hover:scale-[1.02]"
          >
            🤖 Generate Recipe
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all hover:scale-[1.02]"
          >
            + Add Recipe
          </button>
        </div>
      </div>

      {/* AI Generate Section */}
      {showAiGenerate && (
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-6 border border-purple-100 animate-scale-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🤖</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">Generate Recipe from Pantry</h3>
              <p className="text-sm text-gray-600 mt-1">Based on what you have, AI suggests recipes you can make right now</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 border border-purple-100 card-hover cursor-pointer">
                  <span className="text-2xl">🍳</span>
                  <p className="font-medium text-sm mt-2 text-gray-800">Egg Fried Rice</p>
                  <p className="text-xs text-gray-500 mt-1">⏱ 15 min • 🔥 380 kcal</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-purple-100 card-hover cursor-pointer">
                  <span className="text-2xl">🥗</span>
                  <p className="font-medium text-sm mt-2 text-gray-800">Quick Veggie Stir Fry</p>
                  <p className="text-xs text-gray-500 mt-1">⏱ 20 min • 🔥 290 kcal</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-purple-100 card-hover cursor-pointer">
                  <span className="text-2xl">🍲</span>
                  <p className="font-medium text-sm mt-2 text-gray-800">Garlic Rice Bowl</p>
                  <p className="text-xs text-gray-500 mt-1">⏱ 12 min • 🔥 320 kcal</p>
                </div>
              </div>
              <p className="text-xs text-purple-500 mt-3 font-medium">✨ AI-powered • Based on your pantry items</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none text-sm shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          {mealTypes.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                selectedType === type
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center animate-pulse">
            <span className="text-2xl">🍳</span>
          </div>
        </div>
      ) : !recipes || recipes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <span className="text-5xl">📖</span>
          <p className="text-gray-600 font-medium mt-4">No recipes yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first recipe to get started!</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
          >
            + Create Recipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm card-hover group"
            >
              {/* Image */}
              <div className="h-40 bg-gradient-to-br from-green-100 to-emerald-50 relative overflow-hidden">
                <img
                  src={defaultImage}
                  alt={recipe.name}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                />
                <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-700">
                  {recipe.defaultServings} servings
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg">{recipe.name}</h3>
                {recipe.description && (
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">{recipe.description}</p>
                )}

                {/* Quick stats */}
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  <span>🥄 {recipe.ingredients.length} ingredients</span>
                  <span>👥 {recipe.defaultServings} servings</span>
                </div>

                {/* Ingredient preview */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {recipe.ingredients.slice(0, 3).map((ing, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-lg">
                      {ing.displayName || ing.name}
                    </span>
                  ))}
                  {recipe.ingredients.length > 3 && (
                    <span className="px-2 py-0.5 text-gray-400 text-xs">+{recipe.ingredients.length - 3} more</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(recipe)}
                    className="flex-1 px-3 py-2 text-xs font-semibold bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(recipe.id)}
                    className="flex-1 px-3 py-2 text-xs font-semibold bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
