import { useState } from 'react';
import {
  useGetRecipesQuery,
  useDeleteRecipeMutation,
  Recipe,
} from '../../../app/api';
import RecipeForm from '../components/RecipeForm';

export default function RecipesPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const { data: recipes, isLoading } = useGetRecipesQuery(search || undefined);
  const [deleteRecipe] = useDeleteRecipeMutation();

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this recipe?')) {
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Recipes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Recipe
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3 text-gray-600">Loading recipes...</span>
        </div>
      ) : !recipes || recipes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">No recipes found.</p>
          <p className="text-gray-400 mt-2">Create your first recipe to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 card-hover"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-1">{recipe.name}</h3>
              {recipe.description && (
                <p className="text-gray-500 text-sm mb-3 line-clamp-2">{recipe.description}</p>
              )}
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{recipe.ingredients.length} ingredients</span>
                <span>Serves {recipe.defaultServings}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleEdit(recipe)}
                  className="flex-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(recipe.id)}
                  className="flex-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
