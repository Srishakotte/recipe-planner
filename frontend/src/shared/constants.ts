import { Apple, Beef, Croissant, Milk, Package, Snowflake, Wheat, type LucideIcon } from 'lucide-react';

/** Units the engine knows how to normalize and convert. */
export const UNITS = ['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'oz', 'lb', 'piece', 'clove', 'can', 'bunch', 'slice', 'packet'] as const;

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'anytime'] as const;

export const STORE_SECTIONS: Record<string, { label: string; icon: LucideIcon }> = {
  produce: { label: 'Fresh produce', icon: Apple },
  dairy: { label: 'Dairy & eggs', icon: Milk },
  meat: { label: 'Meat & seafood', icon: Beef },
  pantry: { label: 'Pantry staples', icon: Wheat },
  bakery: { label: 'Bakery', icon: Croissant },
  frozen: { label: 'Frozen', icon: Snowflake },
  other: { label: 'Other', icon: Package },
};

export const sectionOf = (key: string) => STORE_SECTIONS[key] ?? STORE_SECTIONS.other;

export const DIETARY_PRESETS = ['dairy-free', 'vegetarian', 'vegan', 'gluten-free', 'no-peanuts', 'nut-free', 'egg-free'] as const;
