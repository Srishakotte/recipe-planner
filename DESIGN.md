# Design Document — Recipe Planner

This doc covers the thinking behind the major design decisions. Not just "what" the system does but "why" it works this way and what happens in edge cases.

## Table of Contents

1. [Data Model Design](#data-model-design)
2. [Grocery Generation — Why a Pipeline](#grocery-generation--why-a-pipeline)
3. [State Management Approach](#state-management-approach)
4. [Conflict Resolution — Full Breakdown](#conflict-resolution--full-breakdown)
5. [Async Robustness & Race Conditions](#async-robustness--race-conditions)
6. [Unit Conversion Design](#unit-conversion-design)
7. [What I'd Do Differently](#what-id-do-differently)

---

## Data Model Design

### The Key Insight: Grocery List is Derived, Not Manual

Early on I had to decide — is the grocery list a thing the user builds manually, or is it computed from the meal plan? I went with **computed as the base, with user edits layered on top**.

This means the grocery list doesn't exist until the user has a meal plan. Generation produces the list, and user actions (check, override, add ad-hoc) modify it.

### Why GroceryGeneration is a Separate Model

I could've just had a flat `grocery_items` table. But then:
- How do you know which "version" of the list you're looking at?
- How do you detect "nothing changed, don't regenerate"?
- How do you carry forward user edits from the old version to the new one?

So I introduced `GroceryGeneration`:

```
GroceryGeneration
├── id (uuid)
├── version (incrementing int)
├── inputHash (MD5 of all inputs)
├── generatedAt
└── items[] → GroceryItem[]
```

Each generation is immutable once created. When the meal plan changes and we regenerate, we create a NEW generation with a new version. The old one stays in the DB (could be used for history/changelog later).

The `inputHash` is an MD5 of the serialized generation input. If you hit "generate" twice with the same meal plan + pantry + constraints, the second call just returns the existing generation. No wasted computation, no duplicate items.

### Why Cascade Deletes

```prisma
recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
```

If a user deletes a recipe, I want its meal plan entries to go away too. Alternative was to soft-delete or leave orphans — but orphan meal plan entries pointing to a non-existent recipe would break the grocery generation (it needs recipe ingredients). Cascade keeps things clean.

The trade-off: if user accidentally deletes a recipe, its meal plan entries are gone. For a production app I'd add soft-delete or a confirmation step. For this scope, cascade is the right call.

### Why Ingredients Are Stored Denormalized in GroceryItem

`GroceryItem` stores `ingredientName`, `computedQty`, `unit`, `storeSection` directly — not a foreign key to `Ingredient`. This is intentional:
- The grocery item represents the *computed result* after scaling, substitution, merging
- It might not correspond to a single ingredient in a single recipe anymore (it could be merged from 3 recipes)
- If the user edits a recipe later, existing grocery items shouldn't retroactively change

### Schema Diagram

```
┌──────────────┐       ┌──────────────────┐
│   Recipe     │───1:*─│   Ingredient     │
│              │       │ (name, qty, unit) │
└──────┬───────┘       └──────────────────┘
       │ 1:*
       ▼
┌──────────────────┐
│  MealPlanEntry   │
│ (date, slot,     │
│  servings)       │
└──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│ GroceryGeneration│───1:*─│   GroceryItem    │
│ (version, hash)  │       │ (name, qty, unit,│
└──────────────────┘       │  checked, override│
                           │  isAdHoc, sources)│
                           └──────────────────┘

┌──────────────────┐
│   PantryItem     │  (independent, subtracted during generation)
│ (name, qty, unit,│
│  expirationDate) │
└──────────────────┘

┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│IngredientSynonym │  │ UnitConversion  │  │IngredientDensity │
│(synonym→canonical)│  │(from→to, ×mult)│  │(ingredient, g/ml)│
└──────────────────┘  └─────────────────┘  └──────────────────┘

┌──────────────────┐  ┌─────────────────┐
│  Substitution    │  │ UserConstraint  │
│(original→sub,    │  │(type, value,    │
│ ratio, constraint)│  │ isActive)       │
└──────────────────┘  └─────────────────┘
```

---

## Grocery Generation — Why a Pipeline

### Why Not Just "Loop and Sum"?

The naive approach: loop through all meal plan ingredients, sum quantities by name. But that breaks immediately:
- "scallion" and "green onion" are the same thing — you'd get two lines
- "2 cups flour" and "300g flour" need unit conversion before adding
- User has a dairy-free constraint — milk should become oat milk
- "3.333 tbsp" of sugar is not a useful shopping quantity

So the pipeline does things in a specific order, and the order matters:

```
Scale FIRST (before substitution — so ratios apply to scaled quantities)
  → Substitute (replace ingredients based on active constraints)
    → Normalize names (merge synonyms)
      → Normalize units (standardize aliases)
        → Convert + Consolidate (merge same ingredients)
          → Round (human-friendly numbers)
            → Subtract pantry (last step, after all merging is done)
```

### Why Scale Before Substitute?

I initially had substitution first, then scaling. But consider:
- Recipe: 1 cup milk (for 2 servings)
- User wants 4 servings
- Substitution: milk → oat milk, ratio 1.0

If we substitute first: 1 cup → 1 cup oat milk, then scale → 2 cups oat milk. Correct.
If we scale first: 1 cup → 2 cups milk, then substitute → 2 cups oat milk. Also correct.

Both work here, but scale-first is better because the substitution's `quantityRatio` is meant to apply to the *actual needed quantity*. If the ratio was 1.2× (you need more oat milk than regular milk), you want it applied to the scaled amount.

### Why Normalize Before Consolidate?

If we consolidate first, "scallion" and "green onion" stay as separate map keys. Normalization must happen before we try to merge. Same with unit normalization — "tablespoons" and "tbsp" need to become the same string before the consolidation map can merge them.

### Why Subtract Pantry Last?

Pantry subtraction needs the final, fully-merged quantities. If I subtract before consolidating, I might subtract pantry onions from only one recipe's onion usage, not the total.

---

## State Management Approach

### Frontend: RTK Query as the Single Source of Truth

I don't have any `createSlice` reducers for UI state. All server data flows through RTK Query. Local UI state (form inputs, modal visibility, filters) uses plain `useState`.

Why this works well here:
- No stale data problems — RTK Query refetches when tags are invalidated
- No "did I forget to update the local copy" bugs
- Loading/error states are automatic
- Cache is shared across components (Recipes dropdown in MealPlan uses same cache as RecipesPage)

### Tag Invalidation Map

This is how the cache stays fresh:

```
Action                     → Invalidates
──────────────────────────────────────────────
Create/Update/Delete Recipe → ['Recipes']
Add/Update/Delete MealPlan  → ['MealPlan', 'GroceryList']
Add/Update/Delete Pantry    → ['Pantry', 'GroceryList']
Generate Grocery List       → ['GroceryList']
Check/Override/Delete Item  → ['GroceryList']
Create/Delete Substitution  → ['Substitutions']
Create/Delete Constraint    → ['Constraints', 'GroceryList']
```

Notice that meal plan and pantry changes invalidate `GroceryList`. This triggers a refetch of the grocery list, keeping it visually in sync even without explicit regeneration.

### Why Meal Plan Changes Auto-Regenerate

When a user adds a recipe to Monday's dinner, they expect the grocery list to update. I didn't want them to have to manually click "Generate" every time.

The MealPlanPage component watches `entries.length`. When it changes, a 500ms debounce timer starts. If no more changes happen in that window, it fires `generateList()` and shows a toast notification.

```
User adds recipe → entries.length changes → debounce 500ms → generateList() → toast "Grocery list updated"
```

The 500ms debounce prevents hammering the API if the user is rapidly adding/removing things.

Limitation: servings changes don't trigger auto-regen (only entry count changes do). The user can manually hit "Generate Grocery List" button for those. This was a conscious trade-off — servings tweaks happen often and regenerating on every +/- click felt too aggressive.

---

## Conflict Resolution — Full Breakdown

This is the section the eval doc specifically asks for. Let me walk through every scenario.

### The Core Rule

> Generated data is recomputed from scratch every time. User edits (overrides, checks, ad-hoc items) are preserved by matching against the new generation.

### Matching Strategy

When a new generation is created, for each new item we look in the PREVIOUS generation's items for a match:

```typescript
const prev = previousItems.find(
  p => p.ingredientName === item.ingredientName && p.unit === item.unit
);
```

Match by `ingredientName + unit`. If found, carry forward:
- `overrideQty` (user's manual quantity)
- `isChecked` (checked off in store)
- `isAlreadyHave` (marked as "have it")

### Scenario: User Checks Off Item, Then Plan Changes

```
State: Grocery list has "milk — 2 cups" ✓ (checked)
Action: User removes a recipe that needed milk
Result: New generation has "milk — 1 cup" (less needed now)
         isChecked = true (carried from previous)
         User sees: "milk — 1 cup" still checked ✓
```

Why this is correct: User already bought the milk. Even though they need less now, the item stays checked because the purchase already happened.

### Scenario: User Overrides Quantity, Then Regen

```
State: Generated "onion — 3 piece", user overrides to 5
Action: Plan changes, new generation says "onion — 4 piece"
Result: New item: computedQty=4, overrideQty=5
         UI shows: 5 (override wins in display)
```

The override persists because the user explicitly said "I want 5." Maybe they know they'll use extras for something else. We don't second-guess that.

### Scenario: Ad-Hoc Items Across Regenerations

```
State: User adds "paper towels" (ad-hoc, not from any recipe)
Action: Meal plan changes, grocery list regenerates
Result: Paper towels are copied to the new generation as-is
         (with their checked state, override, everything)
```

Ad-hoc items are flagged with `isAdHoc: true`. During regeneration, all ad-hoc items from the previous generation are bulk-inserted into the new one. They're never affected by the computation.

### Scenario: Recipe Deleted While in Meal Plan

```
State: "Chicken Stir Fry" is planned for Tuesday dinner
Action: User deletes the recipe from the recipe library
Result: CASCADE delete removes the MealPlanEntry for Tuesday
         Next grocery generation runs without that recipe's ingredients
         Items that ONLY came from that recipe disappear
         Items shared with other recipes just decrease in quantity
         User's overrides on shared items are still preserved
```

### Scenario: Same Input, Multiple Generate Calls

```
State: Meal plan hasn't changed, user clicks "Generate" again
Action: Engine runs, produces same output, inputHash matches
Result: Server returns the EXISTING generation (cached)
         No new DB records created
         Response includes `cached: true` flag
```

This prevents version inflation and unnecessary DB writes.

### Scenario: Item Existed Before, Now Not Needed

```
State: Previous gen had "spaghetti — 400g" (checked)
Action: User removes all pasta recipes from plan
Result: New generation doesn't include spaghetti at all
         The checked state has nowhere to carry forward to
         Item simply doesn't appear in new list
```

The previous generation's items still exist in DB (attached to old generation). But the UI always shows the latest generation.

### Edge Case: Unit Changes Across Regenerations

```
State: Previous gen had "flour — 2 cup", user overrides to 3
Action: User adds a recipe that uses flour in grams
Result: Consolidation might produce "flour — 570 g" (if density conversion works)
         OR "flour — 2 cup" + "flour — 200 g" (if units can't merge)
         
         Case A (merged): Match by name+unit fails (unit changed from cup to g)
                          Override is lost. Acceptable — the item fundamentally changed.
         Case B (separate): "flour — 2 cup" still matches, override preserved.
```

This is a known limitation. If consolidation changes an item's canonical unit between generations, the override can be orphaned. In practice this rarely happens because the engine is deterministic — same inputs produce same unit choices.

---

## Async Robustness & Race Conditions

### Problem Statement

The user might:
- Rapidly add/remove recipes from the meal plan
- Click "Generate" while another generation is in-flight
- Edit grocery items while a background regen is happening

### How It's Handled

**1. Input Hash Deduplication (Server-Side)**

Every generation call hashes its entire input (meal plan + pantry + substitutions + constraints + synonyms + conversions + densities). If this hash already exists in the DB, we return the cached result. This means:
- Two rapid "Generate" clicks → second one returns cached first result
- Background auto-regen + manual "Generate" at the same time → same hash, no conflict

**2. Debounced Client-Side Triggering**

The auto-regeneration in MealPlanPage uses a 500ms debounce:

```typescript
if (debounceRef.current) clearTimeout(debounceRef.current);
debounceRef.current = setTimeout(() => {
  generateList();
}, 500);
```

Rapid meal plan edits (add 3 recipes in quick succession) → only ONE generate call fires.

**3. RTK Query Request Deduplication**

RTK Query internally deduplicates identical in-flight requests. If `getGroceryList` is already fetching, another component calling the same hook doesn't fire a second request — it gets the same promise.

For mutations, RTK Query serializes them — a second mutation waits for the first to complete before firing. This prevents overlapping PATCH requests on the same grocery item.

**4. Versioned Generations (No Mutation of Old Data)**

Generations are append-only. We never UPDATE a generation record. We CREATE a new one. This means:
- If a user is viewing generation v3 while v4 is being created, their view is stable
- Tag invalidation causes a refetch, which picks up v4 naturally
- No partial-write visibility issues

**5. Overlay by Content Match, Not ID**

We match previous items by `ingredientName + unit`, not by database ID. This means even if the generation creates entirely new item IDs (which it always does), the user state carries forward correctly. No stale ID references.

### What's NOT Handled (Honestly)

- **True multi-user concurrency**: If two users share a meal plan and both edit simultaneously, last-write-wins at the DB level. No CRDT or OT. This is a single-user app by design.
- **Optimistic updates**: The frontend doesn't optimistically update the UI before server confirmation. Mutations wait for the server response. This means slightly slower perceived performance on high-latency connections.
- **Server-side mutex on generate**: Two concurrent generate calls with DIFFERENT inputs could theoretically both run and create two generations. The version numbers would be sequential (handled by DB auto-increment logic), and the frontend always shows the latest. So it's not a correctness issue — just a minor efficiency one.

---

## Unit Conversion Design

### Why a Graph-Like Approach

I thought about this as a graph problem. Each unit is a node. Each conversion rule is an edge. Finding a conversion = finding a path between two nodes.

```
        ×3         ×5
tsp ──────── tbsp       tsp ──────── ml
              │                      │
           ×16│                ×1000 │
              ▼                      ▼
            cup                      l

        ×1000       ×28.35
g ──────── kg    g ──────── oz
                            │
                       ×16  │
                            ▼
                            lb
```

The algorithm tries:
1. Direct edge (fromUnit → toUnit)
2. Reverse edge (toUnit → fromUnit, divide instead of multiply)
3. Two-hop (fromUnit → intermediate → toUnit)
4. Density bridge (mass↔volume using ingredient-specific density)
5. Give up (return null, emit warning)

### Why Two-Hop Max?

Three-hop would be: tsp → ml → l → ... something. In practice, all real cooking unit conversions are reachable in two hops with the conversion table I have. Adding more hops adds complexity and potential precision issues (floating point accumulation). Two-hop is the sweet spot.

### Why Density is Last Resort

Mass↔volume conversion requires knowing what ingredient we're talking about. 1 cup of flour ≠ 1 cup of honey (by weight). So density conversion is only attempted when:
- The units are in different categories (one is volume, other is mass)
- We have a density entry for that specific ingredient
- Standard conversion paths all failed

If density isn't available for an ingredient, we get a `density_missing` or `unit_mismatch` warning and keep the items separate.

### Rounding Philosophy

After all conversions and math, quantities often end up as ugly decimals. Nobody wants to see "buy 2.6667 cups of flour" on their grocery list.

The default rounding strategy is `nearest_half`:
- 1.3 → 1.5
- 1.7 → 1.5
- 1.8 → 2.0
- 0.2 → 0.0 (gets filtered out since it's zero)

Why nearest_half as default? Because in cooking, half-measurements are common (½ cup, ½ tsp). Rounding to nearest whole would lose precision that matters. Nearest quarter is too granular for a shopping list.

The strategy is configurable — could expose it as a user preference later.

---

## What I'd Do Differently

Given more time or a second iteration:

1. **Zod validation on all endpoints** — right now input validation is manual `if (!name)` checks. Zod would give schema validation + TypeScript type inference in one shot.

2. **Integration tests for grocery generation endpoint** — the pure engine is tested, but the overlay logic (carrying forward overrides, ad-hoc items) only works "in practice," not proven by tests.

3. **Shared types package** — frontend and backend define their own interfaces for the same data. A shared package or code generation from the Prisma schema would prevent drift.

4. **Optimistic updates** — check off a grocery item and see it instantly, roll back if server fails. RTK Query supports this but I didn't wire it up.

5. **Undo on destructive actions** — deleting a recipe is permanent right now. A soft-delete with 30-second undo would be friendlier.

6. **WebSocket for live sync** — if this became multi-user (family planning together), polling wouldn't cut it. Server-sent events or WebSocket for push updates.

7. **Better error messages** — right now most errors are generic "Failed to X". Would add specific error codes and user-friendly messages.

8. **Pantry expiration warnings** — the `expirationDate` field exists and the UI shows it, but nothing warns you "hey your milk expires tomorrow, use it in a recipe." That'd be a nice dashboard insight.
