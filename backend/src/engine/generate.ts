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

  // STEP 2: Apply Substitutions
  const activeConstraintValues = constraints.map(c => c.constraintValue.toLowerCase());
  lines = lines.map(line => {
    const sub = substitutions.find(
      s => s.originalIngredient.toLowerCase() === line.ingredientName &&
           activeConstraintValues.includes(s.constraintValue.toLowerCase())
    );
    if (sub) {
      const newUnit = sub.substituteUnit || line.unit;
      const newQty = line.quantity * sub.quantityRatio;
      if (newUnit !== line.unit) {
        const canConvert = convertUnits(1, line.unit, newUnit, conversions, densities, sub.substituteIngredient);
        if (canConvert === null) {
          allWarnings.push({
            type: 'substitution_conflict',
            message: `Substitution ${line.ingredientName} → ${sub.substituteIngredient} changes unit from ${line.unit} to ${newUnit}`,
            ingredientName: sub.substituteIngredient,
          });
        }
      }
      return { ...line, ingredientName: sub.substituteIngredient.toLowerCase(), quantity: newQty, unit: newUnit };
    }
    return line;
  });

  // STEP 3: Normalize Names
  lines = lines.map(line => ({ ...line, ingredientName: normalizeIngredientName(line.ingredientName, synonymMap) }));

  // STEP 2.5: Allergen check — warn if ingredient matches constraint but no substitution exists
  if (constraints.length > 0) {
    for (const line of lines) {
      for (const constraint of constraints) {
        // check if this ingredient IS the allergen (e.g. ingredient "peanut" with constraint "no-peanuts")
        const allergenName = constraint.constraintValue.replace('no-', '').replace('-free', '').toLowerCase();
        if (line.ingredientName.includes(allergenName)) {
          // check if a substitution already handled it
          const hasSub = substitutions.find(
            s => s.originalIngredient.toLowerCase() === line.ingredientName &&
                 activeConstraintValues.includes(s.constraintValue.toLowerCase())
          );
          if (!hasSub) {
            allWarnings.push({
              type: 'substitution_conflict',
              message: `⚠️ "${line.ingredientName}" may conflict with constraint "${constraint.constraintValue}" — no substitution rule found`,
              ingredientName: line.ingredientName,
            });
          }
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
        sources: [{ recipeId: line.recipeId, recipeName: line.recipeName, contributionQty: line.quantity }],
      });
    } else {
      if (existing.unit === line.unit) {
        existing.quantity += line.quantity;
        existing.sources.push({ recipeId: line.recipeId, recipeName: line.recipeName, contributionQty: line.quantity });
      } else {
        const converted = convertUnits(line.quantity, line.unit, existing.unit, conversions, densities, line.ingredientName);
        if (converted !== null) {
          existing.quantity += converted;
          existing.sources.push({ recipeId: line.recipeId, recipeName: line.recipeName, contributionQty: converted });
        } else {
          const altKey = `${line.ingredientName}__${line.unit}`;
          const altExisting = consolidated.get(altKey);
          if (altExisting) {
            altExisting.quantity += line.quantity;
            altExisting.sources.push({ recipeId: line.recipeId, recipeName: line.recipeName, contributionQty: line.quantity });
          } else {
            consolidated.set(altKey, {
              ingredientName: line.ingredientName, quantity: line.quantity,
              unit: line.unit, storeSection: line.storeSection,
              sources: [{ recipeId: line.recipeId, recipeName: line.recipeName, contributionQty: line.quantity }],
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
    const pantryMatch = pantry.find(p => {
      if (p.name.toLowerCase() !== item.ingredientName) return false;
      // skip expired items
      if (p.expirationDate) {
        const expDate = p.expirationDate.split('T')[0];
        if (expDate < today) return false;
      }
      return true;
    });
    let pantrySubtracted = 0;

    if (pantryMatch) {
      const pantryUnit = normalizeUnit(pantryMatch.unit);
      if (pantryUnit === item.unit) {
        pantrySubtracted = Math.min(pantryMatch.quantity, item.quantity);
      } else {
        const converted = convertUnits(pantryMatch.quantity, pantryUnit, item.unit, conversions, densities, item.ingredientName);
        if (converted !== null) {
          pantrySubtracted = Math.min(converted, item.quantity);
        } else {
          allWarnings.push({
            type: 'pantry_conversion_failed',
            message: `Cannot convert pantry "${item.ingredientName}" from ${pantryUnit} to ${item.unit}`,
            ingredientName: item.ingredientName,
          });
        }
      }
    }

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
