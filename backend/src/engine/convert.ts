import { ConversionEntry, DensityEntry } from './types';

export function convertUnits(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  conversions: ConversionEntry[],
  densities: DensityEntry[],
  ingredientName?: string
): number | null {
  if (fromUnit === toUnit) return quantity;

  const direct = conversions.find(c => c.fromUnit === fromUnit && c.toUnit === toUnit);
  if (direct) return quantity * direct.multiplier;

  const reverse = conversions.find(c => c.fromUnit === toUnit && c.toUnit === fromUnit);
  if (reverse) return quantity / reverse.multiplier;

  // two-hop
  const fromConversions = conversions.filter(c => c.fromUnit === fromUnit || c.toUnit === fromUnit);
  for (const first of fromConversions) {
    const intermediate = first.fromUnit === fromUnit ? first.toUnit : first.fromUnit;
    const firstQty = first.fromUnit === fromUnit ? quantity * first.multiplier : quantity / first.multiplier;

    const second = conversions.find(
      c => (c.fromUnit === intermediate && c.toUnit === toUnit) ||
           (c.fromUnit === toUnit && c.toUnit === intermediate)
    );
    if (second) {
      if (second.fromUnit === intermediate) return firstQty * second.multiplier;
      return firstQty / second.multiplier;
    }
  }

  // mass<->volume via density
  if (ingredientName) {
    const density = densities.find(d => d.ingredientName === ingredientName);
    if (density) {
      return convertViaDensity(quantity, fromUnit, toUnit, conversions, density.gramsPerMl);
    }
  }

  return null;
}

function convertViaDensity(
  quantity: number, fromUnit: string, toUnit: string,
  conversions: ConversionEntry[], gramsPerMl: number
): number | null {
  const volumeUnits = ['ml', 'l', 'cup', 'tbsp', 'tsp', 'fl oz'];
  const massUnits = ['g', 'kg', 'oz', 'lb'];

  const isFromVolume = volumeUnits.includes(fromUnit);
  const isFromMass = massUnits.includes(fromUnit);
  const isToVolume = volumeUnits.includes(toUnit);
  const isToMass = massUnits.includes(toUnit);

  if (isFromVolume && isToMass) {
    const mlQty = convertToBase(quantity, fromUnit, 'ml', conversions);
    if (mlQty === null) return null;
    const grams = mlQty * gramsPerMl;
    return convertFromBase(grams, 'g', toUnit, conversions);
  }

  if (isFromMass && isToVolume) {
    const gramsQty = convertToBase(quantity, fromUnit, 'g', conversions);
    if (gramsQty === null) return null;
    const ml = gramsQty / gramsPerMl;
    return convertFromBase(ml, 'ml', toUnit, conversions);
  }

  return null;
}

function convertToBase(quantity: number, fromUnit: string, baseUnit: string, conversions: ConversionEntry[]): number | null {
  if (fromUnit === baseUnit) return quantity;
  const conv = conversions.find(c => c.fromUnit === fromUnit && c.toUnit === baseUnit);
  if (conv) return quantity * conv.multiplier;
  const rev = conversions.find(c => c.fromUnit === baseUnit && c.toUnit === fromUnit);
  if (rev) return quantity / rev.multiplier;
  return null;
}

function convertFromBase(quantity: number, baseUnit: string, toUnit: string, conversions: ConversionEntry[]): number | null {
  if (baseUnit === toUnit) return quantity;
  const conv = conversions.find(c => c.fromUnit === baseUnit && c.toUnit === toUnit);
  if (conv) return quantity * conv.multiplier;
  const rev = conversions.find(c => c.fromUnit === toUnit && c.toUnit === baseUnit);
  if (rev) return quantity / rev.multiplier;
  return null;
}

export function getUnitType(unit: string): 'volume' | 'mass' | 'count' | 'unknown' {
  const volumeUnits = ['ml', 'l', 'cup', 'tbsp', 'tsp', 'fl oz'];
  const massUnits = ['g', 'kg', 'oz', 'lb'];
  const countUnits = ['piece', 'whole', 'clove', 'slice', 'bunch', 'pinch', 'can'];
  if (volumeUnits.includes(unit)) return 'volume';
  if (massUnits.includes(unit)) return 'mass';
  if (countUnits.includes(unit)) return 'count';
  return 'unknown';
}
