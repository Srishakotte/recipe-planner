export interface IngredientLine {
  recipeId: string;
  recipeName: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  storeSection: string;
}

export interface PantryEntry {
  name: string;
  quantity: number;
  unit: string;
}

export interface SubstitutionRule {
  originalIngredient: string;
  substituteIngredient: string;
  quantityRatio: number;
  substituteUnit: string | null;
  constraintType: string;
  constraintValue: string;
}

export interface UserConstraintEntry {
  constraintType: string;
  constraintValue: string;
}

export interface SynonymMap {
  [synonym: string]: string;
}

export interface ConversionEntry {
  fromUnit: string;
  toUnit: string;
  multiplier: number;
  conversionType: string;
}

export interface DensityEntry {
  ingredientName: string;
  gramsPerMl: number;
}

export interface GroceryWarning {
  type: 'unit_mismatch' | 'substitution_conflict' | 'pantry_conversion_failed' | 'density_missing';
  message: string;
  ingredientName: string;
}

export interface GrocerySourceRecipe {
  recipeId: string;
  recipeName: string;
  contributionQty: number;
}

export interface GeneratedGroceryItem {
  ingredientName: string;
  quantity: number;
  unit: string;
  storeSection: string;
  sources: GrocerySourceRecipe[];
  warnings: GroceryWarning[];
  pantrySubtracted: number;
}

export interface GeneratedGroceryList {
  items: GeneratedGroceryItem[];
  warnings: GroceryWarning[];
  generatedAt: string;
}

export type RoundingStrategy = 'nearest_half' | 'nearest_whole' | 'nearest_quarter' | 'none';
