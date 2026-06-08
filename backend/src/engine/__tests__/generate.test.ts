import { generateGroceryList, GenerationInput } from '../generate';

const baseInput: GenerationInput = {
  mealPlanEntries: [
    {
      recipeId: 'recipe-1',
      recipeName: 'Pasta',
      servings: 4,
      defaultServings: 2,
      ingredients: [
        { name: 'spaghetti', quantity: 200, unit: 'g', storeSection: 'pantry' },
        { name: 'onion', quantity: 1, unit: 'piece', storeSection: 'produce' },
        { name: 'garlic', quantity: 2, unit: 'clove', storeSection: 'produce' },
        { name: 'olive oil', quantity: 2, unit: 'tbsp', storeSection: 'pantry' },
      ],
    },
    {
      recipeId: 'recipe-2',
      recipeName: 'Salad',
      servings: 2,
      defaultServings: 2,
      ingredients: [
        { name: 'onion', quantity: 1, unit: 'piece', storeSection: 'produce' },
        { name: 'olive oil', quantity: 1, unit: 'tbsp', storeSection: 'pantry' },
        { name: 'lettuce', quantity: 1, unit: 'piece', storeSection: 'produce' },
      ],
    },
  ],
  pantry: [
    { name: 'onion', quantity: 2, unit: 'piece' },
    { name: 'olive oil', quantity: 500, unit: 'ml' },
  ],
  substitutions: [],
  constraints: [],
  synonymMap: { 'scallion': 'green onion' },
  conversions: [
    { fromUnit: 'tsp', toUnit: 'ml', multiplier: 5, conversionType: 'volume' },
    { fromUnit: 'tbsp', toUnit: 'ml', multiplier: 15, conversionType: 'volume' },
    { fromUnit: 'cup', toUnit: 'ml', multiplier: 240, conversionType: 'volume' },
    { fromUnit: 'kg', toUnit: 'g', multiplier: 1000, conversionType: 'mass' },
  ],
  densities: [
    { ingredientName: 'olive oil', gramsPerMl: 0.918 },
  ],
};

describe('generateGroceryList', () => {
  it('is deterministic - same input produces same output', () => {
    const result1 = generateGroceryList(baseInput);
    const result2 = generateGroceryList(baseInput);
    // remove generatedAt since its time-based
    const items1 = result1.items.map(i => ({ ...i }));
    const items2 = result2.items.map(i => ({ ...i }));
    expect(items1).toEqual(items2);
  });

  it('scales ingredients by servings', () => {
    const result = generateGroceryList(baseInput);
    // Pasta: spaghetti 200g at 2 servings, scaled to 4 = 400g
    const spaghetti = result.items.find(i => i.ingredientName === 'spaghetti');
    expect(spaghetti).toBeDefined();
    expect(spaghetti!.quantity).toBe(400);
  });

  it('consolidates same ingredients across recipes', () => {
    const result = generateGroceryList(baseInput);
    // onion: 2 (from pasta scaled 1*2) + 1 (from salad) = 3, minus 2 pantry = 1
    const onion = result.items.find(i => i.ingredientName === 'onion');
    expect(onion).toBeDefined();
    expect(onion!.quantity).toBe(1);
  });

  it('subtracts pantry items', () => {
    const result = generateGroceryList(baseInput);
    // onion: need 3 (2+1), have 2, buy 1
    const onion = result.items.find(i => i.ingredientName === 'onion');
    expect(onion!.quantity).toBe(1);
    expect(onion!.pantrySubtracted).toBe(2);
  });

  it('converts units when consolidating (tbsp olive oil vs ml pantry)', () => {
    const result = generateGroceryList(baseInput);
    // olive oil: 4tbsp (pasta) + 1tbsp (salad) = 5tbsp = 75ml
    // pantry has 500ml, so 75ml needed, 500ml available → 0 to buy
    const oliveOil = result.items.find(i => i.ingredientName === 'olive oil');
    expect(oliveOil).toBeDefined();
    expect(oliveOil!.quantity).toBe(0);
  });

  it('applies substitutions when constraint is active', () => {
    const input: GenerationInput = {
      ...baseInput,
      mealPlanEntries: [{
        recipeId: 'r1', recipeName: 'Pancakes', servings: 2, defaultServings: 2,
        ingredients: [{ name: 'milk', quantity: 1, unit: 'cup', storeSection: 'dairy' }],
      }],
      pantry: [],
      substitutions: [{
        originalIngredient: 'milk', substituteIngredient: 'oat milk',
        quantityRatio: 1.0, substituteUnit: null,
        constraintType: 'dietary', constraintValue: 'dairy-free',
      }],
      constraints: [{ constraintType: 'dietary', constraintValue: 'dairy-free' }],
    };
    const result = generateGroceryList(input);
    const milk = result.items.find(i => i.ingredientName === 'milk');
    const oatMilk = result.items.find(i => i.ingredientName === 'oat milk');
    expect(milk).toBeUndefined();
    expect(oatMilk).toBeDefined();
    expect(oatMilk!.quantity).toBe(1);
  });

  it('does NOT apply substitution when constraint is inactive', () => {
    const input: GenerationInput = {
      ...baseInput,
      mealPlanEntries: [{
        recipeId: 'r1', recipeName: 'Pancakes', servings: 2, defaultServings: 2,
        ingredients: [{ name: 'milk', quantity: 1, unit: 'cup', storeSection: 'dairy' }],
      }],
      pantry: [],
      substitutions: [{
        originalIngredient: 'milk', substituteIngredient: 'oat milk',
        quantityRatio: 1.0, substituteUnit: null,
        constraintType: 'dietary', constraintValue: 'dairy-free',
      }],
      constraints: [], // no active constraints
    };
    const result = generateGroceryList(input);
    const milk = result.items.find(i => i.ingredientName === 'milk');
    expect(milk).toBeDefined();
  });

  it('normalizes ingredient synonyms', () => {
    const input: GenerationInput = {
      ...baseInput,
      mealPlanEntries: [{
        recipeId: 'r1', recipeName: 'Stir Fry', servings: 2, defaultServings: 2,
        ingredients: [
          { name: 'scallion', quantity: 2, unit: 'piece', storeSection: 'produce' },
          { name: 'green onion', quantity: 1, unit: 'piece', storeSection: 'produce' },
        ],
      }],
      pantry: [],
    };
    const result = generateGroceryList(input);
    // both should merge into 'green onion'
    const greenOnion = result.items.find(i => i.ingredientName === 'green onion');
    expect(greenOnion).toBeDefined();
    expect(greenOnion!.quantity).toBe(3);
    // no separate 'scallion' entry
    const scallion = result.items.find(i => i.ingredientName === 'scallion');
    expect(scallion).toBeUndefined();
  });

  it('generates warning when units cant be merged', () => {
    const input: GenerationInput = {
      ...baseInput,
      mealPlanEntries: [{
        recipeId: 'r1', recipeName: 'Recipe A', servings: 1, defaultServings: 1,
        ingredients: [
          { name: 'garlic', quantity: 2, unit: 'clove', storeSection: 'produce' },
          { name: 'garlic', quantity: 1, unit: 'tbsp', storeSection: 'produce' },
        ],
      }],
      pantry: [],
    };
    const result = generateGroceryList(input);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].type).toBe('unit_mismatch');
    expect(result.warnings[0].ingredientName).toBe('garlic');
  });

  it('returns empty list for empty meal plan', () => {
    const input: GenerationInput = { ...baseInput, mealPlanEntries: [] };
    const result = generateGroceryList(input);
    expect(result.items).toHaveLength(0);
  });

  it('tracks source recipes for each item', () => {
    const result = generateGroceryList(baseInput);
    const onion = result.items.find(i => i.ingredientName === 'onion');
    expect(onion!.sources.length).toBe(2);
    expect(onion!.sources.map(s => s.recipeName)).toContain('Pasta');
    expect(onion!.sources.map(s => s.recipeName)).toContain('Salad');
  });
});
