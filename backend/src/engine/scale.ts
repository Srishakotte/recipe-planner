import { RoundingStrategy } from './types';

export function scaleQuantity(
  quantity: number,
  originalServings: number,
  targetServings: number
): number {
  if (originalServings <= 0) return quantity;
  return (quantity / originalServings) * targetServings;
}

export function roundQuantity(quantity: number, strategy: RoundingStrategy): number {
  switch (strategy) {
    case 'nearest_half':
      return Math.round(quantity * 2) / 2;
    case 'nearest_quarter':
      return Math.round(quantity * 4) / 4;
    case 'nearest_whole':
      return Math.round(quantity);
    case 'none':
    default:
      return Math.round(quantity * 100) / 100;
  }
}


/**
 * Converts to a more human-friendly unit display
 * e.g., 1500ml → 1.5 L, 2000g → 2 kg
 */
export function smartUnitDisplay(quantity: number, unit: string): { quantity: number; unit: string } {
  if (unit === 'ml' && quantity >= 1000) {
    return { quantity: Math.round((quantity / 1000) * 100) / 100, unit: 'l' };
  }
  if (unit === 'g' && quantity >= 1000) {
    return { quantity: Math.round((quantity / 1000) * 100) / 100, unit: 'kg' };
  }
  if (unit === 'tsp' && quantity >= 3) {
    return { quantity: Math.round((quantity / 3) * 100) / 100, unit: 'tbsp' };
  }
  if (unit === 'tbsp' && quantity >= 16) {
    return { quantity: Math.round((quantity / 16) * 100) / 100, unit: 'cup' };
  }
  return { quantity, unit };
}
