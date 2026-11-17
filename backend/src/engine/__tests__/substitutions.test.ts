import { generateGroceryList, GenerationInput, findSubstitution, conflictsWithConstraint, normalizeConstraintValue } from '../generate';

const rule = (originalIngredient: string, substituteIngredient: string, constraintValue: string, quantityRatio = 1) => ({
  originalIngredient, substituteIngredient, quantityRatio, substituteUnit: null,
  constraintType: 'dietary', constraintValue,
});

const input = (ingredients: { name: string; quantity: number; unit: string }[], extra: Partial<GenerationInput> = {}): GenerationInput => ({
  mealPlanEntries: [{
    recipeId: 'r1', recipeName: 'Test', servings: 2, defaultServings: 2,
    ingredients: ingredients.map(i => ({ ...i, storeSection: 'other' })),
  }],
  pantry: [], substitutions: [], constraints: [], synonymMap: {},
  conversions: [{ fromUnit: 'kg', toUnit: 'g', multiplier: 1000, conversionType: 'mass' }],
  densities: [],
  ...extra,
});

describe('substitutions', () => {
  it('matches constraint values regardless of case/spacing', () => {
    const result = generateGroceryList(input([{ name: 'milk', quantity: 1, unit: 'cup' }], {
      substitutions: [rule('milk', 'oat milk', 'dairy-free')],
      constraints: [{ constraintType: 'dietary', constraintValue: 'Dairy Free' }],
    }));
    expect(result.items.map(i => i.ingredientName)).toEqual(['oat milk']);
  });

  it('substitutes synonyms of the original ingredient (heavy cream -> cream -> coconut cream)', () => {
    const result = generateGroceryList(input([{ name: 'Heavy Cream', quantity: 1, unit: 'cup' }], {
      substitutions: [rule('cream', 'coconut cream', 'dairy-free')],
      constraints: [{ constraintType: 'dietary', constraintValue: 'dairy-free' }],
      synonymMap: { 'heavy cream': 'cream' },
    }));
    expect(result.items[0].ingredientName).toBe('coconut cream');
    expect(result.items[0].sources[0].substitutedFrom).toBe('cream');
  });

  it('a rule for "chicken" covers "chicken breast"', () => {
    const result = generateGroceryList(input([{ name: 'chicken breast', quantity: 300, unit: 'g' }], {
      substitutions: [rule('chicken', 'tofu', 'vegetarian')],
      constraints: [{ constraintType: 'dietary', constraintValue: 'vegetarian' }],
    }));
    expect(result.items[0].ingredientName).toBe('tofu');
    expect(result.items[0].quantity).toBe(300);
  });

  it('longest rule wins: peanut butter is not caught by a butter rule', () => {
    const rules = [rule('butter', 'coconut oil', 'dairy-free'), rule('peanut butter', 'sunflower seed butter', 'no-peanuts')]
      .map(r => ({ ...r, original: r.originalIngredient }));
    expect(findSubstitution('peanut butter', rules)!.substituteIngredient).toBe('sunflower seed butter');
    expect(findSubstitution('peanut butter', rules.slice(0, 1))).toBeUndefined();
  });

  it('applies the quantity ratio', () => {
    const result = generateGroceryList(input([{ name: 'sugar', quantity: 4, unit: 'tbsp' }], {
      substitutions: [rule('sugar', 'honey', 'low-sugar', 0.75)],
      constraints: [{ constraintType: 'preference', constraintValue: 'low-sugar' }],
    }));
    expect(result.items[0]).toMatchObject({ ingredientName: 'honey', quantity: 3 });
  });

  it('warns once per ingredient when a constraint has no rule', () => {
    const result = generateGroceryList({
      ...input([{ name: 'parmesan', quantity: 50, unit: 'g' }], { constraints: [{ constraintType: 'dietary', constraintValue: 'dairy-free' }] }),
      mealPlanEntries: [
        { recipeId: 'a', recipeName: 'A', servings: 2, defaultServings: 2, ingredients: [{ name: 'parmesan', quantity: 50, unit: 'g', storeSection: 'dairy' }] },
        { recipeId: 'b', recipeName: 'B', servings: 2, defaultServings: 2, ingredients: [{ name: 'parmesan', quantity: 30, unit: 'g', storeSection: 'dairy' }] },
      ],
    });
    expect(result.warnings.filter(w => w.type === 'substitution_conflict')).toHaveLength(1);
  });

  it('does not warn for the substitute itself', () => {
    const result = generateGroceryList(input([{ name: 'milk', quantity: 1, unit: 'cup' }], {
      substitutions: [rule('milk', 'oat milk', 'dairy-free')],
      constraints: [{ constraintType: 'dietary', constraintValue: 'dairy-free' }],
    }));
    expect(result.warnings).toHaveLength(0);
  });

  it('sums multiple pantry batches', () => {
    const result = generateGroceryList(input([{ name: 'egg', quantity: 10, unit: 'piece' }], {
      pantry: [{ name: 'egg', quantity: 2, unit: 'piece' }, { name: 'Egg', quantity: 6, unit: 'piece' }],
    }));
    expect(result.items[0].quantity).toBe(2);
  });
});

describe('conflictsWithConstraint', () => {
  it.each([
    ['sour cream', 'dairy-free', true],
    ['almond milk', 'dairy-free', false],
    ['peanut butter', 'dairy-free', false],
    ['ground beef', 'vegetarian', true],
    ['graham crackers', 'vegetarian', false],
    ['eggplant', 'egg-free', false],
    ['egg', 'vegan', true],
    ['almond flour', 'nut-free', true],
    ['peanut butter', 'no-peanuts', true],
    ['mushrooms', 'no-mushrooms', true],
    ['mushroom', 'no-mushrooms', true],
  ])('%s vs %s -> %s', (name, constraint, expected) => {
    expect(conflictsWithConstraint(name, normalizeConstraintValue(constraint))).toBe(expected);
  });
});
