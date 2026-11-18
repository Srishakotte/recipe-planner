import { parseMeasure, parseIngredientLine, guessStoreSection } from '../parseIngredient';

describe('parseMeasure (TheMealDB style)', () => {
  it.each([
    ['3 tbs', 3, 'tbsp'],
    ['8 cups ', 8, 'cup'],
    ['500g', 500, 'g'],
    ['1/2 tsp', 0.5, 'tsp'],
    ['1 1/2 cups', 1.5, 'cup'],
    ['½ tsp', 0.5, 'tsp'],
    ['1½ cups', 1.5, 'cup'],
    ['1 x 400g tin', 400, 'g'],
    ['2 x 200ml', 400, 'ml'],
    ['2 cloves minced', 2, 'clove'],
    ['1 large', 1, 'piece'],
    ['4 fillets', 4, 'piece'],
    ['1 lb', 1, 'lb'],
    ['2-3 tbsp', 3, 'tbsp'],
    ['Garnish', 1, 'pinch'],
    ['to taste', 1, 'pinch'],
    ['', 1, 'piece'],
    ['4', 4, 'piece'],
  ])('%s -> %d %s', (input, quantity, unit) => {
    expect(parseMeasure(input)).toEqual({ quantity, unit });
  });
});

describe('parseIngredientLine (recipe websites)', () => {
  it('splits amount, unit, name and note', () => {
    expect(parseIngredientLine('2 cups all-purpose flour, sifted')).toEqual({ quantity: 2, unit: 'cup', name: 'all-purpose flour', note: 'sifted' });
  });
  it('handles fractions and preparation words', () => {
    expect(parseIngredientLine('1/2 tsp ground cumin, toasted')).toEqual({ quantity: 0.5, unit: 'tsp', name: 'ground cumin', note: 'toasted' });
  });
  it('counts without a unit', () => {
    expect(parseIngredientLine('3 large eggs')).toMatchObject({ quantity: 3, unit: 'piece', name: 'eggs' });
  });
  it('pack sizes', () => {
    expect(parseIngredientLine('1 x 400g can chopped tomatoes')).toMatchObject({ quantity: 400, unit: 'g' });
  });
  it('lines without amounts', () => {
    expect(parseIngredientLine('Salt to taste')).toMatchObject({ quantity: 1, unit: 'pinch', name: 'salt' });
  });
});

describe('guessStoreSection', () => {
  it.each([
    ['Chicken Thighs', 'meat'], ['Unsalted Butter', 'dairy'], ['Red Onion', 'produce'], ['Chicken Stock', 'pantry'],
    ['Olive Oil', 'pantry'], ['Basmati Rice', 'pantry'], ['Naan Bread', 'bakery'], ['Frozen Peas', 'frozen'], ['Garlic Powder', 'pantry'],
  ])('%s -> %s', (name, section) => expect(guessStoreSection(name)).toBe(section));
});
