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
