import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Types
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
  description?: string;
  ingredients: Ingredient[];
  createdAt: string;
}

export interface MealPlanEntry {
  id: string;
  recipeId: string;
  planDate: string;
  mealSlot: string;
  servings: number;
  isLeftover: boolean;
  leftoverServings?: number | null;
  leftoverExpiresAt?: string | null;
  recipe: Recipe;
}

export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string;
}

export interface GroceryItem {
  id: string;
  ingredientName: string;
  computedQty: number;
  unit: string;
  storeSection: string;
  sourceRecipes?: string[];
  warnings?: string[];
  isAdHoc: boolean;
  overrideQty?: number;
  isChecked: boolean;
  isAlreadyHave: boolean;
}

export interface GroceryListResponse {
  generationId: string;
  version: number;
  items: GroceryItem[];
  warnings?: string[];
  generatedAt: string;
}

export interface Substitution {
  id: string;
  originalIngredient: string;
  substituteIngredient: string;
  quantityRatio: number;
  substituteUnit?: string;
  constraintType: string;
  constraintValue: string;
}

export interface UserConstraint {
  id: string;
  constraintType: string;
  constraintValue: string;
  isActive: boolean;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Recipes', 'MealPlan', 'Pantry', 'GroceryList', 'Substitutions', 'Constraints'],
  endpoints: (builder) => ({
    // Recipes
    getRecipes: builder.query<Recipe[], string | void>({
      query: (search) => search ? `/recipes?search=${encodeURIComponent(search)}` : '/recipes',
      providesTags: ['Recipes'],
    }),
    getRecipe: builder.query<Recipe, string>({
      query: (id) => `/recipes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Recipes', id }],
    }),
    createRecipe: builder.mutation<Recipe, { name: string; description?: string; defaultServings: number; ingredients: Omit<Ingredient, 'id'>[] }>({
      query: (body) => ({ url: '/recipes', method: 'POST', body }),
      invalidatesTags: ['Recipes'],
    }),
    updateRecipe: builder.mutation<Recipe, { id: string; data: { name: string; description?: string; defaultServings: number; ingredients: Omit<Ingredient, 'id'>[] } }>({
      query: ({ id, data }) => ({ url: `/recipes/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Recipes'],
    }),
    deleteRecipe: builder.mutation<void, string>({
      query: (id) => ({ url: `/recipes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Recipes'],
    }),

    // Meal Plans
    getMealPlan: builder.query<MealPlanEntry[], string | void>({
      query: (weekStart) => weekStart ? `/meal-plans?weekStart=${weekStart}` : '/meal-plans',
      providesTags: ['MealPlan'],
    }),
    addMealPlanEntry: builder.mutation<MealPlanEntry, Partial<MealPlanEntry>>({
      query: (body) => ({ url: '/meal-plans', method: 'POST', body }),
      invalidatesTags: ['MealPlan', 'GroceryList'],
    }),
    updateMealPlanEntry: builder.mutation<MealPlanEntry, { id: string; data: Partial<MealPlanEntry> }>({
      query: ({ id, data }) => ({ url: `/meal-plans/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['MealPlan', 'GroceryList'],
    }),
    deleteMealPlanEntry: builder.mutation<void, string>({
      query: (id) => ({ url: `/meal-plans/${id}`, method: 'DELETE' }),
      invalidatesTags: ['MealPlan', 'GroceryList'],
    }),

    // Pantry
    getPantry: builder.query<PantryItem[], void>({
      query: () => '/pantry',
      providesTags: ['Pantry'],
    }),
    addPantryItem: builder.mutation<PantryItem, Partial<PantryItem>>({
      query: (body) => ({ url: '/pantry', method: 'POST', body }),
      invalidatesTags: ['Pantry', 'GroceryList'],
    }),
    updatePantryItem: builder.mutation<PantryItem, { id: string; data: Partial<PantryItem> }>({
      query: ({ id, data }) => ({ url: `/pantry/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Pantry', 'GroceryList'],
    }),
    deletePantryItem: builder.mutation<void, string>({
      query: (id) => ({ url: `/pantry/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Pantry', 'GroceryList'],
    }),

    // Grocery List
    generateGroceryList: builder.mutation<GroceryListResponse, void>({
      query: () => ({ url: '/grocery/generate', method: 'POST' }),
      invalidatesTags: ['GroceryList'],
    }),
    getGroceryList: builder.query<GroceryListResponse, { section?: string; uncheckedOnly?: boolean; warningsOnly?: boolean } | void>({
      query: (filters) => {
        if (!filters) return '/grocery';
        const params = new URLSearchParams();
        if (filters.section) params.append('section', filters.section);
        if (filters.uncheckedOnly) params.append('uncheckedOnly', 'true');
        if (filters.warningsOnly) params.append('warningsOnly', 'true');
        const qs = params.toString();
        return qs ? `/grocery?${qs}` : '/grocery';
      },
      providesTags: ['GroceryList'],
    }),
    checkGroceryItem: builder.mutation<GroceryItem, { id: string; isChecked: boolean }>({
      query: ({ id, isChecked }) => ({ url: `/grocery/items/${id}/check`, method: 'PATCH', body: { isChecked } }),
      invalidatesTags: ['GroceryList'],
    }),
    overrideGroceryItem: builder.mutation<GroceryItem, { id: string; overrideQty: number }>({
      query: ({ id, overrideQty }) => ({ url: `/grocery/items/${id}/override`, method: 'PATCH', body: { overrideQty } }),
      invalidatesTags: ['GroceryList'],
    }),
    markAlreadyHave: builder.mutation<GroceryItem, { id: string; isAlreadyHave: boolean }>({
      query: ({ id, isAlreadyHave }) => ({ url: `/grocery/items/${id}/already-have`, method: 'PATCH', body: { isAlreadyHave } }),
      invalidatesTags: ['GroceryList'],
    }),
    addAdHocItem: builder.mutation<GroceryItem, { ingredientName: string; computedQty: number; unit: string; storeSection: string }>({
      query: ({ ingredientName, computedQty, unit, storeSection }) => ({ 
        url: '/grocery/items/ad-hoc', 
        method: 'POST', 
        body: { name: ingredientName, quantity: computedQty, unit, storeSection } 
      }),
      invalidatesTags: ['GroceryList'],
    }),
    deleteGroceryItem: builder.mutation<void, string>({
      query: (id) => ({ url: `/grocery/items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['GroceryList'],
    }),

    // Substitutions
    getSubstitutions: builder.query<Substitution[], void>({
      query: () => '/substitutions',
      providesTags: ['Substitutions'],
    }),
    createSubstitution: builder.mutation<Substitution, Partial<Substitution>>({
      query: (body) => ({ url: '/substitutions', method: 'POST', body }),
      invalidatesTags: ['Substitutions'],
    }),
    deleteSubstitution: builder.mutation<void, string>({
      query: (id) => ({ url: `/substitutions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Substitutions'],
    }),

    // Constraints
    getConstraints: builder.query<UserConstraint[], void>({
      query: () => '/substitutions/constraints',
      providesTags: ['Constraints'],
    }),
    createConstraint: builder.mutation<UserConstraint, Partial<UserConstraint>>({
      query: (body) => ({ url: '/substitutions/constraints', method: 'POST', body }),
      invalidatesTags: ['Constraints', 'GroceryList'],
    }),
    deleteConstraint: builder.mutation<void, string>({
      query: (id) => ({ url: `/substitutions/constraints/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Constraints', 'GroceryList'],
    }),

    // Reset
    resetAppData: builder.mutation<{ message: string }, { reseed?: boolean } | void>({
      query: (body) => ({ url: '/reset', method: 'POST', body: body || {} }),
      invalidatesTags: ['Recipes', 'MealPlan', 'Pantry', 'GroceryList', 'Substitutions', 'Constraints'],
    }),

    // Leftovers
    markAsLeftover: builder.mutation<MealPlanEntry, { id: string; leftoverServings?: number; leftoverExpiresAt?: string }>({
      query: ({ id, ...body }) => ({ url: `/meal-plans/${id}/leftover`, method: 'PATCH', body }),
      invalidatesTags: ['MealPlan'],
    }),
    consumeLeftover: builder.mutation<MealPlanEntry, { id: string; servingsUsed?: number }>({
      query: ({ id, servingsUsed }) => ({ url: `/meal-plans/${id}/consume-leftover`, method: 'PATCH', body: { servingsUsed } }),
      invalidatesTags: ['MealPlan'],
    }),
  }),
});

export const {
  useGetRecipesQuery,
  useGetRecipeQuery,
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
  useDeleteRecipeMutation,
  useGetMealPlanQuery,
  useAddMealPlanEntryMutation,
  useUpdateMealPlanEntryMutation,
  useDeleteMealPlanEntryMutation,
  useGetPantryQuery,
  useAddPantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
  useGenerateGroceryListMutation,
  useGetGroceryListQuery,
  useCheckGroceryItemMutation,
  useOverrideGroceryItemMutation,
  useMarkAlreadyHaveMutation,
  useAddAdHocItemMutation,
  useDeleteGroceryItemMutation,
  useGetSubstitutionsQuery,
  useCreateSubstitutionMutation,
  useDeleteSubstitutionMutation,
  useGetConstraintsQuery,
  useCreateConstraintMutation,
  useDeleteConstraintMutation,
  useResetAppDataMutation,
  useMarkAsLeftoverMutation,
  useConsumeLeftoverMutation,
} = api;
