/** Well-known cooking substitutions, used when Gemini is unavailable. ratio = substitute per 1 unit of original. */
export interface Swap { name: string; ratio: number; note: string }

export const COMMON_SWAPS: Record<string, Swap[]> = {
  'milk': [
    { name: 'oat milk', ratio: 1, note: 'Neutral taste, good for baking and sauces' },
    { name: 'almond milk', ratio: 1, note: 'Slightly nutty, thinner' },
    { name: 'yogurt', ratio: 0.75, note: 'Thin with water; adds tang' },
  ],
  'butter': [
    { name: 'coconut oil', ratio: 1, note: 'Works in baking; slight coconut flavour' },
    { name: 'olive oil', ratio: 0.75, note: 'Best for savoury cooking' },
    { name: 'ghee', ratio: 1, note: 'Richer, great for frying' },
  ],
  'cream': [
    { name: 'coconut cream', ratio: 1, note: 'Dairy-free, rich' },
    { name: 'milk', ratio: 1, note: 'Add 1 tbsp butter per cup for richness' },
    { name: 'yogurt', ratio: 1, note: 'Stir in off the heat so it does not split' },
  ],
  'sour cream': [{ name: 'yogurt', ratio: 1, note: 'Greek yogurt is closest' }],
  'yogurt': [{ name: 'sour cream', ratio: 1, note: 'Richer' }, { name: 'buttermilk', ratio: 1, note: 'Thinner' }],
  'egg': [
    { name: 'flax egg', ratio: 1, note: '1 tbsp ground flax + 3 tbsp water per egg' },
    { name: 'banana', ratio: 0.5, note: 'Half a mashed banana per egg, sweet bakes only' },
    { name: 'yogurt', ratio: 0.25, note: '1/4 cup per egg in cakes' },
  ],
  'flour': [
    { name: 'whole wheat flour', ratio: 1, note: 'Denser result' },
    { name: 'almond flour', ratio: 1, note: 'Gluten-free; add an extra egg as binder' },
    { name: 'oats', ratio: 1, note: 'Blend to a powder first' },
  ],
  'sugar': [
    { name: 'honey', ratio: 0.75, note: 'Reduce other liquids slightly' },
    { name: 'jaggery', ratio: 1, note: 'Deeper caramel flavour' },
  ],
  'honey': [{ name: 'sugar', ratio: 1.25, note: 'Add a splash of water' }, { name: 'maple syrup', ratio: 1, note: '' }],
  'lemon juice': [{ name: 'vinegar', ratio: 0.5, note: 'Sharper, use less' }, { name: 'lime juice', ratio: 1, note: '' }],
  'soy sauce': [{ name: 'salt', ratio: 0.2, note: 'Plus a pinch of sugar' }, { name: 'tamari', ratio: 1, note: 'Gluten-free' }],
  'parmesan': [{ name: 'cheddar cheese', ratio: 1, note: 'Milder' }, { name: 'nutritional yeast', ratio: 0.5, note: 'Dairy-free, cheesy flavour' }],
  'cheddar cheese': [{ name: 'mozzarella', ratio: 1, note: 'Milder, meltier' }, { name: 'paneer', ratio: 1, note: 'Does not melt' }],
  'chicken': [{ name: 'paneer', ratio: 1, note: 'Vegetarian; shorter cooking' }, { name: 'tofu', ratio: 1, note: 'Press first' }, { name: 'chickpeas', ratio: 1, note: 'Vegan' }],
  'ground beef': [{ name: 'lentils', ratio: 1, note: 'Cooked; vegetarian' }, { name: 'soya chunks', ratio: 0.5, note: 'Rehydrate first' }],
  'rice': [{ name: 'quinoa', ratio: 1, note: 'More protein' }, { name: 'couscous', ratio: 1, note: 'Faster' }],
  'spaghetti': [{ name: 'penne', ratio: 1, note: 'Any pasta works' }, { name: 'rice noodles', ratio: 1, note: 'Gluten-free' }],
  'onion': [{ name: 'shallot', ratio: 1, note: 'Milder' }, { name: 'green onion', ratio: 1, note: 'Add at the end' }],
  'garlic': [{ name: 'garlic powder', ratio: 0.125, note: '1/8 tsp per clove' }],
  'bell pepper': [{ name: 'zucchini', ratio: 1, note: 'For texture, less sweet' }],
  'canned tomatoes': [{ name: 'tomato', ratio: 4, note: 'About 4 fresh tomatoes per can' }],
  'tomato': [{ name: 'canned tomatoes', ratio: 0.25, note: '' }],
  'olive oil': [{ name: 'vegetable oil', ratio: 1, note: '' }, { name: 'butter', ratio: 1, note: 'Lower smoke point' }],
};

/** Finds swaps for an ingredient: exact name, else a rule for its leading words ("chicken breast" -> "chicken"). */
export function findCommonSwaps(ingredient: string): Swap[] {
  if (COMMON_SWAPS[ingredient]) return COMMON_SWAPS[ingredient];
  const key = Object.keys(COMMON_SWAPS)
    .filter(k => ingredient.startsWith(k + ' '))
    .sort((a, b) => b.length - a.length)[0];
  return key ? COMMON_SWAPS[key] : [];
}
