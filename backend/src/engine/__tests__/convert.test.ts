import { convertUnits, getUnitType } from '../convert';
import { ConversionEntry, DensityEntry } from '../types';

const conversions: ConversionEntry[] = [
  { fromUnit: 'tsp', toUnit: 'ml', multiplier: 5, conversionType: 'volume' },
  { fromUnit: 'tbsp', toUnit: 'ml', multiplier: 15, conversionType: 'volume' },
  { fromUnit: 'cup', toUnit: 'ml', multiplier: 240, conversionType: 'volume' },
  { fromUnit: 'l', toUnit: 'ml', multiplier: 1000, conversionType: 'volume' },
  { fromUnit: 'tbsp', toUnit: 'tsp', multiplier: 3, conversionType: 'volume' },
  { fromUnit: 'cup', toUnit: 'tbsp', multiplier: 16, conversionType: 'volume' },
  { fromUnit: 'kg', toUnit: 'g', multiplier: 1000, conversionType: 'mass' },
  { fromUnit: 'oz', toUnit: 'g', multiplier: 28.35, conversionType: 'mass' },
  { fromUnit: 'lb', toUnit: 'g', multiplier: 453.592, conversionType: 'mass' },
];

const densities: DensityEntry[] = [
  { ingredientName: 'flour', gramsPerMl: 0.593 },
  { ingredientName: 'milk', gramsPerMl: 1.03 },
  { ingredientName: 'sugar', gramsPerMl: 0.845 },
];

describe('convertUnits', () => {
  it('returns same quantity for same unit', () => {
    expect(convertUnits(5, 'cup', 'cup', conversions, densities)).toBe(5);
  });

  it('converts direct (tsp to ml)', () => {
    expect(convertUnits(2, 'tsp', 'ml', conversions, densities)).toBe(10);
  });

  it('converts reverse (ml to tsp)', () => {
    expect(convertUnits(15, 'ml', 'tsp', conversions, densities)).toBe(3);
  });

  it('converts kg to g', () => {
    expect(convertUnits(2, 'kg', 'g', conversions, densities)).toBe(2000);
  });

  it('converts g to kg', () => {
    expect(convertUnits(500, 'g', 'kg', conversions, densities)).toBe(0.5);
  });

  it('converts via two-hop (cup to tsp)', () => {
    // cup → ml → tsp or cup → tbsp → tsp
    const result = convertUnits(1, 'cup', 'tsp', conversions, densities);
    expect(result).not.toBeNull();
    expect(result).toBe(48); // 1 cup = 16 tbsp = 48 tsp
  });

  it('converts mass to volume via density (g flour to cup)', () => {
    // 593g flour = 1000ml = ~4.17 cups
    const result = convertUnits(593, 'g', 'cup', conversions, densities, 'flour');
    expect(result).not.toBeNull();
    // 593g / 0.593 = 1000ml, 1000ml / 240 = 4.166
    expect(result).toBeCloseTo(4.166, 1);
  });

  it('converts volume to mass via density (1 cup milk to g)', () => {
    // 1 cup = 240ml, 240ml * 1.03 = 247.2g
    const result = convertUnits(1, 'cup', 'g', conversions, densities, 'milk');
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(247.2, 0);
  });

  it('returns null for incompatible units without density', () => {
    expect(convertUnits(1, 'cup', 'g', conversions, densities)).toBeNull();
    expect(convertUnits(1, 'cup', 'g', conversions, densities, 'unknown_ingredient')).toBeNull();
  });

  it('returns null for completely unrelated units', () => {
    expect(convertUnits(1, 'piece', 'g', conversions, densities)).toBeNull();
    expect(convertUnits(1, 'clove', 'ml', conversions, densities)).toBeNull();
  });
});

describe('getUnitType', () => {
  it('identifies volume units', () => {
    expect(getUnitType('ml')).toBe('volume');
    expect(getUnitType('cup')).toBe('volume');
    expect(getUnitType('tbsp')).toBe('volume');
    expect(getUnitType('tsp')).toBe('volume');
    expect(getUnitType('l')).toBe('volume');
  });

  it('identifies mass units', () => {
    expect(getUnitType('g')).toBe('mass');
    expect(getUnitType('kg')).toBe('mass');
    expect(getUnitType('oz')).toBe('mass');
    expect(getUnitType('lb')).toBe('mass');
  });

  it('identifies count units', () => {
    expect(getUnitType('piece')).toBe('count');
    expect(getUnitType('clove')).toBe('count');
    expect(getUnitType('can')).toBe('count');
  });

  it('returns unknown for unrecognized', () => {
    expect(getUnitType('sprig')).toBe('unknown');
    expect(getUnitType('dash')).toBe('unknown');
  });
});
