import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// ---------------------------------------------------------------- core types

export interface Ingredient {
  id: string;
  name: string;
  displayName?: string;
  quantity: number;
  unit: string;
  storeSection: string;
  sortOrder: number;
}

export interface Recipe {
  id: string;
  name: string;
  defaultServings: number;
  description?: string | null;
  steps?: string | null;
  ingredients: Ingredient[];
  createdAt: string;
}

export type RecipeInput = {
  name: string;
  description?: string;
  steps?: string;
  defaultServings: number;
  ingredients: Omit<Ingredient, 'id' | 'sortOrder'>[];
};

export interface MealPlanEntry {
  id: string;
  recipeId: string;
  planDate: string;
  mealSlot: string;
  servings: number;
  isLeftover: boolean;
  leftoverExpiryDate?: string | null;
  recipe: Recipe;
}

export type MealPlanInput = {
  recipeId?: string;
  planDate?: string;
  mealSlot?: string;
  servings?: number;
  isLeftover?: boolean;
  leftoverExpiryDate?: string | null;
};

export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
}

export interface GrocerySource {
  recipeId: string;
  recipeName: string;
  contributionQty: number;
  substitutedFrom?: string;
  substitutionReason?: string;
}

export interface GroceryWarning {
  type: 'unit_mismatch' | 'substitution_conflict' | 'pantry_conversion_failed' | 'density_missing' | 'override_reset' | 'quantity_increased';
  message: string;
  ingredientName: string;
}

export interface GroceryItem {
  id: string;
  ingredientName: string;
  computedQty: number;
  unit: string;
  storeSection: string;
  sourceRecipes?: GrocerySource[] | null;
  warnings?: GroceryWarning[] | null;
  isAdHoc: boolean;
  overrideQty?: number | null;
  isChecked: boolean;
  isAlreadyHave: boolean;
}

export interface GroceryListResponse {
  generationId: string;
  version: number;
  items: GroceryItem[];
  generatedAt: string;
}

export interface Substitution {
  id: string;
  originalIngredient: string;
  substituteIngredient: string;
  quantityRatio: number;
  substituteUnit?: string | null;
  constraintType: string;
  constraintValue: string;
}

export interface UserConstraint {
  id: string;
  constraintType: string;
  constraintValue: string;
  isActive: boolean;
}

export interface Synonym { id: string; synonym: string; canonicalName: string }

export interface AnalyticsSummary {
  weekStart: string;
  overview: { totalRecipes: number; totalPantryItems: number; totalMealsPlanned: number; groceryListItems: number };
  mealsPerDay: { day: string; meals: number }[];
  topIngredients: { name: string; count: number }[];
  groceryStats: { total: number; checked: number; unchecked: number; adHoc: number };
  sectionBreakdown: { name: string; value: number }[];
  slotBreakdown: { name: string; value: number }[];
}

// ---------------------------------------------------------------- AI / kitchen types

/** Every smart feature answers with data + where it came from (Gemini or built-in logic). */
export interface Sourced<T> { data: T; source: 'ai' | 'fallback' }

export interface RecipeMatch {
  recipeId: string;
  name: string;
  description: string | null;
  defaultServings: number;
  have: string[];
  missing: string[];
  expiring: { name: string; daysLeft: number }[];
  conflicts: { ingredient: string; constraint: string }[];
  coverage: number;
  recentlyPlanned: boolean;
  relevance: number;
  score: number;
  reason: string;
}

export interface DinnerPick { pick: RecipeMatch | null; pitch: string; alternatives: RecipeMatch[] }
export interface FixOption { name: string; ratio: number; note: string; inPantry: boolean; fromRule: boolean }
export interface IngredientFix { ingredient: string; options: FixOption[] }
export interface RecipeFix { recipe: RecipeMatch; fixes: IngredientFix[] }

export interface RecipeIdea {
  name: string;
  description: string;
  servings: number;
  cookingTime: number;
  ingredients: { name: string; quantity: number; unit: string; storeSection: string }[];
  steps: string[];
  existingRecipeId?: string;
}

export interface DayNutrition { date: string; day: string; meals: number; coverage: number; calories: number; protein: number; carbs: number; fats: number }
export interface CostEstimate { total: number | null; items: { item: string; cost: number }[] }

export type ProposedAction =
  | { type: 'add_meal'; recipeId: string; recipeName: string; planDate: string; mealSlot: string; servings: number }
  | { type: 'remove_meal'; mealId: string; recipeName: string; planDate: string; mealSlot: string };

export interface ChatMessage { role: 'user' | 'model'; text: string }

// ---------------------------------------------------------------- API

/** Anything that changes what you can cook invalidates 'Kitchen' (recommendations, dinner, fixes). */
const KITCHEN_INPUTS = ['GroceryList', 'Kitchen'] as const;

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Recipes', 'MealPlan', 'Pantry', 'GroceryList', 'Substitutions', 'Constraints', 'Kitchen', 'Analytics'],
  endpoints: (builder) => ({
    // Recipes
    getRecipes: builder.query<Recipe[], string | void>({
      query: (search) => search ? `/recipes?search=${encodeURIComponent(search)}` : '/recipes',
      providesTags: ['Recipes'],
    }),
    createRecipe: builder.mutation<Recipe, RecipeInput>({
      query: (body) => ({ url: '/recipes', method: 'POST', body }),
      invalidatesTags: ['Recipes', ...KITCHEN_INPUTS],
    }),
    updateRecipe: builder.mutation<Recipe, { id: string; data: RecipeInput }>({
      query: ({ id, data }) => ({ url: `/recipes/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Recipes', 'MealPlan', ...KITCHEN_INPUTS],
    }),
    deleteRecipe: builder.mutation<void, string>({
      query: (id) => ({ url: `/recipes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Recipes', 'MealPlan', ...KITCHEN_INPUTS],
    }),

    // Meal plan
    getMealPlan: builder.query<MealPlanEntry[], string | void>({
      query: (weekStart) => weekStart ? `/meal-plans?weekStart=${weekStart}` : '/meal-plans',
      providesTags: ['MealPlan'],
    }),
    getLeftovers: builder.query<MealPlanEntry[], void>({
      query: () => '/meal-plans/leftovers',
      providesTags: ['MealPlan'],
    }),
    addMealPlanEntry: builder.mutation<MealPlanEntry, MealPlanInput>({
      query: (body) => ({ url: '/meal-plans', method: 'POST', body }),
      invalidatesTags: ['MealPlan', 'Analytics', ...KITCHEN_INPUTS],
    }),
    updateMealPlanEntry: builder.mutation<MealPlanEntry, { id: string; data: MealPlanInput }>({
      query: ({ id, data }) => ({ url: `/meal-plans/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['MealPlan', 'Analytics', ...KITCHEN_INPUTS],
    }),
    deleteMealPlanEntry: builder.mutation<void, string>({
      query: (id) => ({ url: `/meal-plans/${id}`, method: 'DELETE' }),
      invalidatesTags: ['MealPlan', 'Analytics', ...KITCHEN_INPUTS],
    }),

    // Pantry
    getPantry: builder.query<PantryItem[], void>({
      query: () => '/pantry',
      providesTags: ['Pantry'],
    }),
    addPantryItem: builder.mutation<PantryItem, Partial<PantryItem>>({
      query: (body) => ({ url: '/pantry', method: 'POST', body }),
      invalidatesTags: ['Pantry', ...KITCHEN_INPUTS],
    }),
    updatePantryItem: builder.mutation<PantryItem, { id: string; data: Partial<PantryItem> }>({
      query: ({ id, data }) => ({ url: `/pantry/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Pantry', ...KITCHEN_INPUTS],
    }),
    deletePantryItem: builder.mutation<void, string>({
      query: (id) => ({ url: `/pantry/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Pantry', ...KITCHEN_INPUTS],
    }),

    // Grocery list (GET regenerates on the server when inputs changed)
    getGroceryList: builder.query<GroceryListResponse, void>({
      query: () => '/grocery',
      providesTags: ['GroceryList'],
    }),
    checkGroceryItem: builder.mutation<GroceryItem, { id: string; isChecked: boolean }>({
      query: ({ id, isChecked }) => ({ url: `/grocery/items/${id}/check`, method: 'PATCH', body: { isChecked } }),
      // optimistic: tick instantly, roll back if the server says no
      async onQueryStarted({ id, isChecked }, { dispatch, queryFulfilled }) {
        const patch = dispatch(api.util.updateQueryData('getGroceryList', undefined, draft => {
          const item = draft.items.find(i => i.id === id);
          if (item) item.isChecked = isChecked;
        }));
        try { await queryFulfilled; } catch { patch.undo(); }
      },
      invalidatesTags: ['GroceryList'],
    }),
    overrideGroceryItem: builder.mutation<GroceryItem, { id: string; overrideQty: number | null }>({
      query: ({ id, overrideQty }) => ({ url: `/grocery/items/${id}/override`, method: 'PATCH', body: { overrideQty } }),
      invalidatesTags: ['GroceryList'],
    }),
    markAlreadyHave: builder.mutation<GroceryItem, { id: string; addToPantry?: boolean }>({
      query: ({ id, addToPantry }) => ({ url: `/grocery/items/${id}/already-have`, method: 'PATCH', body: { addToPantry } }),
      invalidatesTags: ['GroceryList', 'Pantry', 'Kitchen'],
    }),
    addAdHocItem: builder.mutation<GroceryItem, { name: string; quantity: number; unit: string; storeSection: string }>({
      query: (body) => ({ url: '/grocery/items/ad-hoc', method: 'POST', body }),
      invalidatesTags: ['GroceryList'],
    }),
    deleteGroceryItem: builder.mutation<void, string>({
      query: (id) => ({ url: `/grocery/items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['GroceryList'],
    }),

    // Substitution rules, constraints, synonyms
    getSubstitutions: builder.query<Substitution[], void>({
      query: () => '/substitutions',
      providesTags: ['Substitutions'],
    }),
    createSubstitution: builder.mutation<Substitution, Omit<Substitution, 'id'>>({
      query: (body) => ({ url: '/substitutions', method: 'POST', body }),
      invalidatesTags: ['Substitutions', ...KITCHEN_INPUTS],
    }),
    deleteSubstitution: builder.mutation<void, string>({
      query: (id) => ({ url: `/substitutions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Substitutions', ...KITCHEN_INPUTS],
    }),
    getConstraints: builder.query<UserConstraint[], void>({
      query: () => '/substitutions/constraints',
      providesTags: ['Constraints'],
    }),
    createConstraint: builder.mutation<UserConstraint, { constraintType: string; constraintValue: string }>({
      query: (body) => ({ url: '/substitutions/constraints', method: 'POST', body }),
      invalidatesTags: ['Constraints', ...KITCHEN_INPUTS],
    }),
    toggleConstraint: builder.mutation<UserConstraint, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({ url: `/substitutions/constraints/${id}`, method: 'PATCH', body: { isActive } }),
      invalidatesTags: ['Constraints', ...KITCHEN_INPUTS],
    }),
    deleteConstraint: builder.mutation<void, string>({
      query: (id) => ({ url: `/substitutions/constraints/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Constraints', ...KITCHEN_INPUTS],
    }),
    getSynonyms: builder.query<Synonym[], void>({
      query: () => '/substitutions/synonyms',
      providesTags: ['Substitutions'],
    }),
    createSynonym: builder.mutation<Synonym, { synonym: string; canonicalName: string }>({
      query: (body) => ({ url: '/substitutions/synonyms', method: 'POST', body }),
      invalidatesTags: ['Substitutions', ...KITCHEN_INPUTS],
    }),
    deleteSynonym: builder.mutation<void, string>({
      query: (id) => ({ url: `/substitutions/synonyms/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Substitutions', ...KITCHEN_INPUTS],
    }),

    // System
    getAnalytics: builder.query<AnalyticsSummary, string>({
      query: (weekStart) => `/analytics/summary?weekStart=${weekStart}`,
      providesTags: ['Analytics', 'GroceryList'],
    }),
    resetData: builder.mutation<void, void>({
      query: () => ({ url: '/reset', method: 'POST' }),
      invalidatesTags: ['Recipes', 'MealPlan', 'Pantry', 'GroceryList', 'Substitutions', 'Constraints', 'Kitchen', 'Analytics'],
    }),
    reseedData: builder.mutation<void, void>({
      query: () => ({ url: '/reseed', method: 'POST' }),
      invalidatesTags: ['Recipes', 'MealPlan', 'Pantry', 'GroceryList', 'Substitutions', 'Constraints', 'Kitchen', 'Analytics'],
    }),

    // Smart kitchen (Gemini with built-in fallbacks)
    getAiStatus: builder.query<{ enabled: boolean; model: string }, void>({
      query: () => '/ai/status',
    }),
    recommendRecipes: builder.query<Sourced<RecipeMatch[]> & { semantic: boolean }, string>({
      query: (q) => `/ai/recommend?q=${encodeURIComponent(q)}`,
      providesTags: ['Kitchen'],
    }),
    getDinnerPick: builder.query<Sourced<DinnerPick>, void>({
      query: () => '/ai/dinner',
      providesTags: ['Kitchen'],
    }),
    getRecipeFix: builder.query<Sourced<RecipeFix>, string>({
      query: (id) => `/ai/fix-recipe/${id}`,
      providesTags: ['Kitchen'],
    }),
    suggestSubstitutes: builder.mutation<Sourced<IngredientFix>, string>({
      query: (ingredient) => ({ url: '/ai/substitutes', method: 'POST', body: { ingredient } }),
    }),
    getRecipeIdeas: builder.mutation<Sourced<RecipeIdea[]>, void>({
      query: () => ({ url: '/ai/ideas', method: 'POST' }),
    }),
    getNutrition: builder.query<Sourced<DayNutrition[]>, string>({
      query: (weekStart) => `/ai/nutrition?weekStart=${weekStart}`,
      providesTags: ['MealPlan'],
    }),
    estimateCost: builder.mutation<Sourced<CostEstimate>, void>({
      query: () => ({ url: '/ai/cost', method: 'POST' }),
    }),
    askAssistant: builder.mutation<{ reply: string; actions: ProposedAction[] }, ChatMessage[]>({
      query: (messages) => ({ url: '/ai/assistant', method: 'POST', body: { messages } }),
    }),
  }),
});

export const {
  useGetRecipesQuery, useCreateRecipeMutation, useUpdateRecipeMutation, useDeleteRecipeMutation,
  useGetMealPlanQuery, useGetLeftoversQuery, useAddMealPlanEntryMutation, useUpdateMealPlanEntryMutation, useDeleteMealPlanEntryMutation,
  useGetPantryQuery, useAddPantryItemMutation, useUpdatePantryItemMutation, useDeletePantryItemMutation,
  useGetGroceryListQuery, useCheckGroceryItemMutation, useOverrideGroceryItemMutation, useMarkAlreadyHaveMutation,
  useAddAdHocItemMutation, useDeleteGroceryItemMutation,
  useGetSubstitutionsQuery, useCreateSubstitutionMutation, useDeleteSubstitutionMutation,
  useGetConstraintsQuery, useCreateConstraintMutation, useToggleConstraintMutation, useDeleteConstraintMutation,
  useGetSynonymsQuery, useCreateSynonymMutation, useDeleteSynonymMutation,
  useGetAnalyticsQuery, useResetDataMutation, useReseedDataMutation,
  useGetAiStatusQuery, useRecommendRecipesQuery, useGetDinnerPickQuery, useGetRecipeFixQuery,
  useSuggestSubstitutesMutation, useGetRecipeIdeasMutation, useGetNutritionQuery, useEstimateCostMutation, useAskAssistantMutation,
} = api;
