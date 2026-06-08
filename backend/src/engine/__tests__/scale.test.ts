import { scaleQuantity, roundQuantity } from '../scale';

describe('scaleQuantity', () => {
  it('scales up correctly', () => {
    expect(scaleQuantity(100, 2, 4)).toBe(200);
  });

  it('scales down correctly', () => {
    expect(scaleQuantity(100, 4, 2)).toBe(50);
  });

  it('returns same quantity when servings match', () => {
    expect(scaleQuantity(100, 4, 4)).toBe(100);
  });

  it('handles 1 serving base', () => {
    expect(scaleQuantity(0.5, 1, 3)).toBe(1.5);
  });

  it('handles 0 original servings gracefully', () => {
    expect(scaleQuantity(100, 0, 4)).toBe(100);
  });

  it('handles fractional scaling', () => {
    expect(scaleQuantity(3, 4, 6)).toBe(4.5);
  });
});

describe('roundQuantity', () => {
  it('rounds to nearest half', () => {
    expect(roundQuantity(1.3, 'nearest_half')).toBe(1.5);
    expect(roundQuantity(1.7, 'nearest_half')).toBe(1.5);
    expect(roundQuantity(1.8, 'nearest_half')).toBe(2);
    expect(roundQuantity(0.2, 'nearest_half')).toBe(0);
    expect(roundQuantity(0.3, 'nearest_half')).toBe(0.5);
  });

  it('rounds to nearest whole', () => {
    expect(roundQuantity(1.3, 'nearest_whole')).toBe(1);
    expect(roundQuantity(1.7, 'nearest_whole')).toBe(2);
    expect(roundQuantity(2.5, 'nearest_whole')).toBe(3);
  });

  it('rounds to nearest quarter', () => {
    expect(roundQuantity(1.1, 'nearest_quarter')).toBe(1);
    expect(roundQuantity(1.15, 'nearest_quarter')).toBe(1.25);
    expect(roundQuantity(1.4, 'nearest_quarter')).toBe(1.5);
    expect(roundQuantity(1.9, 'nearest_quarter')).toBe(2);
  });

  it('none strategy rounds to 2 decimal places', () => {
    expect(roundQuantity(1.333333, 'none')).toBe(1.33);
    expect(roundQuantity(2.666666, 'none')).toBe(2.67);
  });
});
