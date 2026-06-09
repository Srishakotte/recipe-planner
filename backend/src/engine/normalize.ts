import { SynonymMap } from './types';

/**
 * Resolves an ingredient name to its canonical form.
 * Handles: case, extra spaces, hyphens (Lady finger = lady-finger = ladyfinger)
 */
export function normalizeIngredientName(name: string, synonymMap: SynonymMap): string {
  // Clean: lowercase, trim, collapse spaces, normalize hyphens
  const cleaned = name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/-/g, ' ').trim();
  
  // Try exact match
  if (synonymMap[cleaned]) return synonymMap[cleaned];
  
  // Try without spaces/hyphens (ladyfinger = lady finger)
  const noSpaces = cleaned.replace(/\s/g, '');
  for (const [key, value] of Object.entries(synonymMap)) {
    if (key.replace(/\s/g, '').replace(/-/g, '') === noSpaces) return value;
  }
  
  return cleaned;
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
