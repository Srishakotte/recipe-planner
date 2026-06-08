import { normalizeIngredientName, normalizeUnit } from '../normalize';

describe('normalizeIngredientName', () => {
  const synonymMap = {
    'scallion': 'green onion',
    'spring onion': 'green onion',
    'capsicum': 'bell pepper',
    'heavy cream': 'cream',
    'all-purpose flour': 'flour',
  };

  it('resolves known synonyms', () => {
    expect(normalizeIngredientName('scallion', synonymMap)).toBe('green onion');
    expect(normalizeIngredientName('spring onion', synonymMap)).toBe('green onion');
    expect(normalizeIngredientName('capsicum', synonymMap)).toBe('bell pepper');
  });

  it('lowercases and trims', () => {
    expect(normalizeIngredientName('  Scallion  ', synonymMap)).toBe('green onion');
    expect(normalizeIngredientName('HEAVY CREAM', synonymMap)).toBe('cream');
  });

  it('returns cleaned name when no synonym found', () => {
    expect(normalizeIngredientName('tomato', synonymMap)).toBe('tomato');
    expect(normalizeIngredientName('  Chicken  ', synonymMap)).toBe('chicken');
  });
});

describe('normalizeUnit', () => {
  it('normalizes plural units', () => {
    expect(normalizeUnit('cups')).toBe('cup');
    expect(normalizeUnit('tablespoons')).toBe('tbsp');
    expect(normalizeUnit('teaspoons')).toBe('tsp');
    expect(normalizeUnit('grams')).toBe('g');
    expect(normalizeUnit('pounds')).toBe('lb');
    expect(normalizeUnit('ounces')).toBe('oz');
    expect(normalizeUnit('pieces')).toBe('piece');
    expect(normalizeUnit('cloves')).toBe('clove');
  });

  it('normalizes full unit names', () => {
    expect(normalizeUnit('tablespoon')).toBe('tbsp');
    expect(normalizeUnit('teaspoon')).toBe('tsp');
    expect(normalizeUnit('kilogram')).toBe('kg');
    expect(normalizeUnit('liter')).toBe('l');
    expect(normalizeUnit('milliliter')).toBe('ml');
  });

  it('handles case insensitive', () => {
    expect(normalizeUnit('CUPS')).toBe('cup');
    expect(normalizeUnit('Tablespoons')).toBe('tbsp');
  });

  it('returns unknown units as-is (lowercased)', () => {
    expect(normalizeUnit('bunch')).toBe('bunch');
    expect(normalizeUnit('pinch')).toBe('pinch');
    expect(normalizeUnit('sprigs')).toBe('sprigs');
  });
});
