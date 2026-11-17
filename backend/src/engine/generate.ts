import {
  IngredientLine, PantryEntry, SubstitutionRule, UserConstraintEntry,
  SynonymMap, ConversionEntry, DensityEntry, GeneratedGroceryItem,
  GeneratedGroceryList, GroceryWarning, GrocerySourceRecipe, RoundingStrategy,
} from './types';
import { normalizeIngredientName, normalizeUnit } from './normalize';
import { convertUnits, getUnitType } from './convert';
import { scaleQuantity, roundQuantity, smartUnitDisplay } from './scale';

export interface GenerationInput {
  mealPlanEntries: {
    recipeId: string;
    recipeName: string;
    servings: number;
    defaultServings: number;
    ingredients: { name: string; quantity: number; unit: string; storeSection: string }[];
  }[];
  pantry: PantryEntry[];
  substitutions: SubstitutionRule[];
  constraints: UserConstraintEntry[];
  synonymMap: SynonymMap;
  conversions: ConversionEntry[];
  densities: DensityEntry[];
  roundingStrategy?: RoundingStrategy;
}

export function generateGroceryList(input: GenerationInput): GeneratedGroceryList {
  const {
    mealPlanEntries, pantry, substitutions, constraints,
    synonymMap, conversions, densities, roundingStrategy = 'nearest_half',
  } = input;

  const allWarnings: GroceryWarning[] = [];

  // STEP 1: Expand + Scale
  let lines: IngredientLine[] = [];
  for (const entry of mealPlanEntries) {
    for (const ing of entry.ingredients) {
      const scaledQty = scaleQuantity(ing.quantity, entry.defaultServings, entry.servings);
      lines.push({
        recipeId: entry.recipeId,
        recipeName: entry.recipeName,
        ingredientName: ing.name.toLowerCase().trim(),
        quantity: scaledQty,
        unit: ing.unit.toLowerCase().trim(),
        storeSection: ing.storeSection,
      });
    }
  }

  // STEP 2: Normalize Names first, so synonyms ("heavy cream" -> "cream") can be substituted too
  lines = lines.map(line => ({ ...line, ingredientName: normalizeIngredientName(line.ingredientName, synonymMap) }));

  // STEP 3: Apply Substitutions
  const activeConstraintValues = new Set(constraints.map(c => normalizeConstraintValue(c.constraintValue)));
  const activeRules = substitutions
    .filter(s => activeConstraintValues.has(normalizeConstraintValue(s.constraintValue)))
    .map(s => ({ ...s, original: normalizeIngredientName(s.originalIngredient, synonymMap) }));

  lines = lines.map(line => {
    const sub = findSubstitution(line.ingredientName, activeRules);
    if (!sub) return line;
    const newUnit = sub.substituteUnit ? normalizeUnit(sub.substituteUnit) : line.unit;
    let newQty = line.quantity * sub.quantityRatio;
    if (newUnit !== normalizeUnit(line.unit)) {
      const converted = convertUnits(newQty, normalizeUnit(line.unit), newUnit, conversions, densities, sub.substituteIngredient);
      if (converted === null) {
        allWarnings.push({
          type: 'substitution_conflict',
          message: `Substitution ${line.ingredientName} → ${sub.substituteIngredient} changes unit from ${line.unit} to ${newUnit}`,
          ingredientName: normalizeIngredientName(sub.substituteIngredient, synonymMap),
        });
      } else {
        newQty = converted;
      }
    }
    return {
      ...line,
      ingredientName: normalizeIngredientName(sub.substituteIngredient, synonymMap),
      quantity: newQty, unit: newUnit,
      substitutedFrom: line.ingredientName,
      substitutionReason: sub.constraintValue,
    };
  });

  // STEP 3.5: Constraint check — warn when an ingredient still conflicts with an active constraint
  if (constraints.length > 0) {
    const warned = new Set<string>();
    for (const line of lines) {
      if (line.substitutedFrom) continue; // already handled by a rule
      for (const constraint of constraints) {
        const value = normalizeConstraintValue(constraint.constraintValue);
        const key = `${line.ingredientName}|${value}`;
        if (warned.has(key)) continue;
        if (conflictsWithConstraint(line.ingredientName, value)) {
          warned.add(key);
          allWarnings.push({
            type: 'substitution_conflict',
            message: `"${line.ingredientName}" conflicts with "${constraint.constraintValue}" and no substitution rule exists`,
            ingredientName: line.ingredientName,
          });
        }
      }
    }
  }

  // STEP 4: Normalize Units
  lines = lines.map(line => ({ ...line, unit: normalizeUnit(line.unit) }));

  // STEP 5: Convert + Consolidate
  const consolidated = new Map<string, {
    ingredientName: string; quantity: number; unit: string;
    storeSection: string; sources: GrocerySourceRecipe[];
  }>();

  for (const line of lines) {
    const key = line.ingredientName;
    const existing = consolidated.get(key);

    if (!existing) {
      consolidated.set(key, {
        ingredientName: line.ingredientName, quantity: line.quantity,
        unit: line.unit, storeSection: line.storeSection,
        sources: [sourceOf(line, line.quantity)],
      });
    } else {
      if (existing.unit === line.unit) {
        existing.quantity += line.quantity;
        existing.sources.push(sourceOf(line, line.quantity));
      } else {
        const converted = convertUnits(line.quantity, line.unit, existing.unit, conversions, densities, line.ingredientName);
        if (converted !== null) {
          existing.quantity += converted;
          existing.sources.push(sourceOf(line, converted));
        } else {
          const altKey = `${line.ingredientName}__${line.unit}`;
          const altExisting = consolidated.get(altKey);
          if (altExisting) {
            altExisting.quantity += line.quantity;
            altExisting.sources.push(sourceOf(line, line.quantity));
          } else {
            consolidated.set(altKey, {
              ingredientName: line.ingredientName, quantity: line.quantity,
              unit: line.unit, storeSection: line.storeSection,
              sources: [sourceOf(line, line.quantity)],
            });
            // determine if it's a density issue or general unit mismatch
            const existingType = getUnitType(existing.unit);
            const lineType = getUnitType(line.unit);
            const isDensityIssue = (existingType === 'volume' && lineType === 'mass') || (existingType === 'mass' && lineType === 'volume');
            allWarnings.push({
              type: isDensityIssue ? 'density_missing' : 'unit_mismatch',
              message: isDensityIssue
                ? `Cannot convert "${line.ingredientName}" between ${line.unit} and ${existing.unit} — no density data available`
                : `Cannot merge units for "${line.ingredientName}": ${line.unit} vs ${existing.unit}`,
              ingredientName: line.ingredientName,
            });
          }
        }
      }
    }
  }

  // STEP 6: Round
  const rounded = Array.from(consolidated.values()).map(item => ({
    ...item, quantity: roundQuantity(item.quantity, roundingStrategy),
  }));

  // STEP 7: Subtract Pantry (skip expired items)
  const today = new Date().toISOString().split('T')[0];
  const items: GeneratedGroceryItem[] = rounded.map(item => {
    // all non-expired batches of this ingredient (pantry names go through the same synonym map)
    const pantryMatches = pantry.filter(p => {
      if (normalizeIngredientName(p.name, synonymMap) !== item.ingredientName) return false;
      if (p.expirationDate) {
        const expDate = p.expirationDate.split('T')[0];
        if (expDate < today) return false;
      }
      return true;
    });
    let pantryAvailable = 0;
    for (const pantryMatch of pantryMatches) {
      const pantryUnit = normalizeUnit(pantryMatch.unit);
      const converted = pantryUnit === item.unit
        ? pantryMatch.quantity
        : convertUnits(pantryMatch.quantity, pantryUnit, item.unit, conversions, densities, item.ingredientName);
      if (converted !== null) {
        pantryAvailable += converted;
      } else {
        allWarnings.push({
          type: 'pantry_conversion_failed',
          message: `Cannot convert pantry "${item.ingredientName}" from ${pantryUnit} to ${item.unit}`,
          ingredientName: item.ingredientName,
        });
      }
    }
    const pantrySubtracted = Math.min(pantryAvailable, item.quantity);

    const finalQty = Math.max(0, item.quantity - pantrySubtracted);
    const smartDisplay = smartUnitDisplay(roundQuantity(finalQty, roundingStrategy), item.unit);
    return {
      ingredientName: item.ingredientName,
      quantity: smartDisplay.quantity,
      totalNeeded: roundQuantity(item.quantity, roundingStrategy),
      unit: smartDisplay.unit, storeSection: item.storeSection,
      sources: item.sources,
      warnings: allWarnings.filter(w => w.ingredientName === item.ingredientName),
      pantrySubtracted,
    };
  });

  return { items, warnings: allWarnings, generatedAt: new Date().toISOString() };
}

function sourceOf(line: IngredientLine, contributionQty: number): GrocerySourceRecipe {
  const source: GrocerySourceRecipe = { recipeId: line.recipeId, recipeName: line.recipeName, contributionQty };
  if (line.substitutedFrom) {
    source.substitutedFrom = line.substitutedFrom;
    source.substitutionReason = line.substitutionReason;
  }
  return source;
}

/** "Dairy Free", "dairy_free", " dairy-free " all become "dairy-free" */
export function normalizeConstraintValue(value: string): string {
  return value.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

/**
 * Picks the rule for an ingredient. Exact name wins; otherwise a rule for "chicken"
 * also covers "chicken breast" / "chicken thighs" (rule name is the leading word(s)).
 * The longest matching rule wins, so "peanut butter" never falls to a "butter" rule.
 * Ties are broken alphabetically by substitute so the result is deterministic.
 */
export function findSubstitution<T extends SubstitutionRule & { original: string }>(
  ingredientName: string, rules: T[]
): T | undefined {
  const candidates = rules.filter(r => ingredientName === r.original || ingredientName.startsWith(r.original + ' '));
  candidates.sort((a, b) =>
    b.original.length - a.original.length || a.substituteIngredient.localeCompare(b.substituteIngredient));
  return candidates[0];
}

const CONSTRAINT_KEYWORDS: Record<string, string[]> = {
  'dairy-free': ['milk', 'butter', 'cream', 'cheese', 'parmesan', 'cheddar', 'mozzarella', 'paneer', 'yogurt', 'ghee', 'curd', 'whey'],
  'lactose-free': ['milk', 'cream', 'cheese', 'parmesan', 'cheddar', 'mozzarella', 'paneer', 'yogurt', 'curd', 'whey'],
  'vegetarian': ['chicken', 'beef', 'pork', 'lamb', 'mutton', 'fish', 'shrimp', 'prawn', 'bacon', 'ham', 'turkey', 'salmon', 'tuna', 'sausage', 'anchovy'],
  'vegan': ['chicken', 'beef', 'pork', 'lamb', 'mutton', 'fish', 'shrimp', 'prawn', 'bacon', 'ham', 'turkey', 'salmon', 'tuna', 'sausage', 'anchovy',
    'milk', 'butter', 'cream', 'cheese', 'parmesan', 'cheddar', 'mozzarella', 'paneer', 'yogurt', 'ghee', 'curd', 'whey', 'egg', 'honey'],
  'gluten-free': ['flour', 'bread', 'pasta', 'spaghetti', 'noodle', 'croutons', 'couscous', 'barley', 'semolina', 'taco shells', 'tortilla'],
  'no-peanuts': ['peanut'],
  'nut-free': ['peanut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut'],
  'egg-free': ['egg'],
};

// plant-based look-alikes that should not trigger dairy/meat warnings
const SAFE_PREFIXES = ['oat', 'almond', 'soy', 'coconut', 'rice', 'cashew', 'vegan', 'peanut', 'cocoa', 'shea'];

export function conflictsWithConstraint(ingredientName: string, constraintValue: string): boolean {
  const words = ingredientName.split(/\s+/);
  const keywords = CONSTRAINT_KEYWORDS[constraintValue];
  if (!keywords) {
    // unknown constraint like "no-mushrooms" / "mushroom-free": derive the keyword
    const base = constraintValue.replace(/^no-/, '').replace(/-free$/, '').replace(/-/g, ' ');
    const singular = base.endsWith('es') ? base.slice(0, -2) : base.endsWith('s') ? base.slice(0, -1) : base;
    return singular.length > 2 && ingredientName.includes(singular);
  }
  return keywords.some(k => {
    const idx = ingredientName.indexOf(k);
    if (idx === -1) return false;
    // keyword must start a word ("graham" is not ham), but may be a prefix ("buttermilk" is still butter)
    if (idx > 0 && ingredientName[idx - 1] !== ' ') return false;
    // whole-word-ish match ("eggplant" is not egg, "buttermilk" is still dairy)
    if (k === 'egg' && !words.some(w => w === 'egg' || w === 'eggs')) return false;
    const before = ingredientName.slice(0, idx).trim().split(/\s+/).pop() || '';
    if (SAFE_PREFIXES.includes(before) && k !== before) {
      // "almond milk" is fine for dairy-free, but "almond" itself is a nut for nut-free
      return false;
    }
    return true;
  });
}
