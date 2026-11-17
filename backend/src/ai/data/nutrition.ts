/**
 * Approximate nutrition per 100 g (USDA FoodData Central reference values, rounded),
 * plus typical weights for count units. Used when Gemini is not available.
 */
export interface Macros { calories: number; protein: number; carbs: number; fats: number }

const PER_100G: Record<string, Macros> = {
  'rice': { calories: 365, protein: 7, carbs: 80, fats: 0.7 },
  'spaghetti': { calories: 371, protein: 13, carbs: 75, fats: 1.5 },
  'pasta': { calories: 371, protein: 13, carbs: 75, fats: 1.5 },
  'flour': { calories: 364, protein: 10, carbs: 76, fats: 1 },
  'bread': { calories: 265, protein: 9, carbs: 49, fats: 3.2 },
  'oats': { calories: 389, protein: 17, carbs: 66, fats: 7 },
  'sugar': { calories: 387, protein: 0, carbs: 100, fats: 0 },
  'honey': { calories: 304, protein: 0.3, carbs: 82, fats: 0 },
  'milk': { calories: 61, protein: 3.2, carbs: 4.8, fats: 3.3 },
  'oat milk': { calories: 48, protein: 1, carbs: 7, fats: 1.5 },
  'almond milk': { calories: 15, protein: 0.6, carbs: 0.3, fats: 1.2 },
  'butter': { calories: 717, protein: 0.9, carbs: 0.1, fats: 81 },
  'ghee': { calories: 900, protein: 0, carbs: 0, fats: 100 },
  'cream': { calories: 340, protein: 2.8, carbs: 2.7, fats: 36 },
  'coconut cream': { calories: 330, protein: 3.6, carbs: 6.7, fats: 35 },
  'sour cream': { calories: 198, protein: 2.4, carbs: 4.6, fats: 19 },
  'yogurt': { calories: 61, protein: 3.5, carbs: 4.7, fats: 3.3 },
  'parmesan': { calories: 431, protein: 38, carbs: 4.1, fats: 29 },
  'cheddar cheese': { calories: 403, protein: 25, carbs: 1.3, fats: 33 },
  'mozzarella': { calories: 280, protein: 28, carbs: 3.1, fats: 17 },
  'paneer': { calories: 296, protein: 18, carbs: 3.6, fats: 22 },
  'egg': { calories: 143, protein: 13, carbs: 0.7, fats: 9.5 },
  'chicken breast': { calories: 165, protein: 31, carbs: 0, fats: 3.6 },
  'chicken': { calories: 215, protein: 27, carbs: 0, fats: 11 },
  'ground beef': { calories: 254, protein: 17, carbs: 0, fats: 20 },
  'tofu': { calories: 76, protein: 8, carbs: 1.9, fats: 4.8 },
  'chickpeas': { calories: 164, protein: 8.9, carbs: 27, fats: 2.6 },
  'lentils': { calories: 116, protein: 9, carbs: 20, fats: 0.4 },
  'onion': { calories: 40, protein: 1.1, carbs: 9.3, fats: 0.1 },
  'garlic': { calories: 149, protein: 6.4, carbs: 33, fats: 0.5 },
  'tomato': { calories: 18, protein: 0.9, carbs: 3.9, fats: 0.2 },
  'canned tomatoes': { calories: 32, protein: 1.6, carbs: 7.3, fats: 0.3 },
  'bell pepper': { calories: 31, protein: 1, carbs: 6, fats: 0.3 },
  'broccoli': { calories: 34, protein: 2.8, carbs: 6.6, fats: 0.4 },
  'spinach': { calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4 },
  'potato': { calories: 77, protein: 2, carbs: 17, fats: 0.1 },
  'romaine lettuce': { calories: 17, protein: 1.2, carbs: 3.3, fats: 0.3 },
  'green onion': { calories: 32, protein: 1.8, carbs: 7.3, fats: 0.2 },
  'olive oil': { calories: 884, protein: 0, carbs: 0, fats: 100 },
  'vegetable oil': { calories: 884, protein: 0, carbs: 0, fats: 100 },
  'coconut oil': { calories: 862, protein: 0, carbs: 0, fats: 100 },
  'soy sauce': { calories: 53, protein: 8, carbs: 4.9, fats: 0.6 },
  'croutons': { calories: 407, protein: 12, carbs: 74, fats: 6.6 },
  'taco shells': { calories: 468, protein: 7, carbs: 62, fats: 22 },
  'lemon juice': { calories: 22, protein: 0.4, carbs: 6.9, fats: 0.2 },
};

/** grams per unit; volume units assume water-like density (density table refines this in the engine) */
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1, kg: 1000, oz: 28.35, lb: 453.6, ml: 1, l: 1000, cup: 240, tbsp: 15, tsp: 5,
};
const GRAMS_PER_PIECE: Record<string, number> = {
  egg: 50, onion: 110, tomato: 120, 'bell pepper': 120, potato: 170, 'romaine lettuce': 600,
  'green onion': 15, 'taco shells': 13, garlic: 5, 'canned tomatoes': 400, 'chicken breast': 175,
};

const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fats: 0 };

export function lookupMacros(name: string): Macros | undefined {
  if (PER_100G[name]) return PER_100G[name];
  const key = Object.keys(PER_100G).find(k => name.endsWith(' ' + k) || name.startsWith(k + ' '));
  return key ? PER_100G[key] : undefined;
}

/** Returns macros for one ingredient line, or null if it can't be estimated. */
export function estimateIngredient(name: string, quantity: number, unit: string): Macros | null {
  const macros = lookupMacros(name);
  if (!macros) return null;
  const grams = GRAMS_PER_UNIT[unit] !== undefined
    ? quantity * GRAMS_PER_UNIT[unit]
    : ['piece', 'whole', 'clove', 'can', 'slice'].includes(unit) && GRAMS_PER_PIECE[name] !== undefined
      ? quantity * GRAMS_PER_PIECE[name]
      : null;
  if (grams === null) return null;
  const f = grams / 100;
  return { calories: macros.calories * f, protein: macros.protein * f, carbs: macros.carbs * f, fats: macros.fats * f };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fats: a.fats + b.fats };
}

export function roundMacros(m: Macros): Macros {
  return { calories: Math.round(m.calories), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fats: Math.round(m.fats) };
}

export { ZERO as ZERO_MACROS };
