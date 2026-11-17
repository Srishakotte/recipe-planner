import type { MealPlanEntry } from '../../app/api';
import { datePart } from '../../shared/dates';

/**
 * Leftovers:
 *  - SOURCE   = a meal you cooked and marked as leftover (isLeftover + leftoverExpiryDate)
 *  - CONSUMER = a later meal eating those servings (isLeftover, no expiry date)
 * Remaining = source servings − every consumer from the source date on (past ones were eaten too).
 */
export const isLeftoverSource = (e: MealPlanEntry) => e.isLeftover && !!e.leftoverExpiryDate;
export const isLeftoverConsumer = (e: MealPlanEntry) => e.isLeftover && !e.leftoverExpiryDate;

export interface AvailableLeftover { recipeId: string; recipeName: string; remaining: number; expires: string }

/** `entries` should be the /meal-plans/leftovers list (all live leftover entries, any week). */
export function availableLeftovers(entries: MealPlanEntry[], today: string): AvailableLeftover[] {
  const byRecipe = new Map<string, { name: string; servings: number; from: string; expires: string }>();
  for (const source of entries.filter(isLeftoverSource)) {
    const date = datePart(source.planDate);
    const expires = datePart(source.leftoverExpiryDate!);
    if (date > today || expires < today) continue;
    const current = byRecipe.get(source.recipeId);
    byRecipe.set(source.recipeId, current
      ? { ...current, servings: current.servings + source.servings, from: date < current.from ? date : current.from, expires: expires > current.expires ? expires : current.expires }
      : { name: source.recipe.name, servings: source.servings, from: date, expires });
  }
  return [...byRecipe].map(([recipeId, s]) => {
    const eaten = entries
      .filter(e => isLeftoverConsumer(e) && e.recipeId === recipeId && datePart(e.planDate) >= s.from)
      .reduce((sum, e) => sum + e.servings, 0);
    return { recipeId, recipeName: s.name, remaining: Math.max(0, s.servings - eaten), expires: s.expires };
  }).filter(l => l.remaining > 0);
}

/** A source can't be unmarked while upcoming meals are eating from it. */
export function consumersOf(source: MealPlanEntry, entries: MealPlanEntry[], today: string): MealPlanEntry[] {
  return entries.filter(e => isLeftoverConsumer(e) && e.recipeId === source.recipeId && e.id !== source.id && datePart(e.planDate) >= today);
}
