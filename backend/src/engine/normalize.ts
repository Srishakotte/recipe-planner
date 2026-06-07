import { SynonymMap } from './types';

export function normalizeIngredientName(name: string, synonymMap: SynonymMap): string {
  const cleaned = name.toLowerCase().trim();
  return synonymMap[cleaned] || cleaned;
}

export function normalizeUnit(unit: string): string {
  const cleaned = unit.toLowerCase().trim();

  const unitAliases: Record<string, string> = {
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbs': 'tbsp',
    'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'cup': 'cup', 'cups': 'cup',
    'liter': 'l', 'liters': 'l', 'litre': 'l', 'litres': 'l',
    'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml', 'millilitres': 'ml',
    'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
    'gram': 'g', 'grams': 'g',
    'kilogram': 'kg', 'kilograms': 'kg',
    'ounce': 'oz', 'ounces': 'oz',
    'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb',
    'piece': 'piece', 'pieces': 'piece',
    'whole': 'whole',
    'clove': 'clove', 'cloves': 'clove',
    'slice': 'slice', 'slices': 'slice',
    'bunch': 'bunch', 'bunches': 'bunch',
    'pinch': 'pinch', 'pinches': 'pinch',
    'can': 'can', 'cans': 'can',
  };

  return unitAliases[cleaned] || cleaned;
}
