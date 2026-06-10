# Recipe Planner + Grocery List

A full-stack meal planning app where users plan weekly meals, and the system generates a smart grocery list that handles ingredient consolidation, unit conversions, pantry subtraction, dietary substitutions, and user overrides — all while keeping behavior predictable under frequent edits.

I looked at how apps like Mealime, Paprika, and Whisk handle grocery generation before building this. Most of them just dump ingredients without merging or pantry awareness. The goal here was to build something that actually solves the annoying parts — like when you have 3 recipes all needing garlic and you don't want 3 separate "garlic" lines on your list.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + TypeScript | Type safety, hooks-based architecture |
| State | Redux Toolkit (RTK Query) | Server cache with tag-based invalidation, no manual refetching |
| Styling | Tailwind CSS 4 | Utility-first, fast iteration |
| Backend | Express.js + TypeScript | Lightweight, flexible routing |
| ORM | Prisma 5 | Type-safe queries, clean migration system |
| Database | MySQL 8.0 | Relational data with proper foreign keys |
| Dev Tools | Vite 6, Docker Compose, Nodemon, Jest |

## Quick Setup

```bash
# 1. Clone
git clone https://github.com/Srishakotte/recipe-planner.git
cd recipe-planner

# 2. Install everything
cd backend && npm install
cd ../frontend && npm install
cd ..

# 3. Start MySQL (needs Docker)
docker compose up -d

# 4. Wait for MySQL to be ready (important, don't skip)
sleep 10

# 5. Set up database
cd backend
cp .env.example .env
npx prisma db push
npm run db:seed
cd ..

# 6. Run both servers
npm run dev
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:3001`.

The Vite dev server proxies `/api` requests to the backend so no CORS issues during development.

### Alternative: Step by step

If `npm run dev` doesn't work (it uses `concurrently`), run in two terminals:

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

### Running Tests

```bash
cd backend && npm test
```

Tests cover the grocery generation engine — scaling, conversion, normalization, and the full pipeline.

### Building for Production

```bash
cd frontend && npm run build    # outputs to frontend/dist
cd backend && npm run build     # compiles to backend/dist, run with npm start
```

## Project Structure

```
recipe-planner/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # all models
│   │   └── seed.ts              # demo data (recipes, conversions, synonyms, pantry)
│   └── src/
│       ├── engine/              # pure functions, no DB dependency
│       │   ├── types.ts         # shared interfaces
│       │   ├── generate.ts      # the main 7-step pipeline
│       │   ├── convert.ts       # unit conversion with density support
│       │   ├── normalize.ts     # ingredient synonyms + unit aliases
│       │   ├── scale.ts         # quantity scaling + rounding
│       │   └── __tests__/       # unit tests for all engine modules
│       ├── routes/              # express route handlers
│       │   ├── recipes.ts
│       │   ├── mealPlan.ts
│       │   ├── pantry.ts
│       │   ├── grocery.ts       # generation endpoint + CRUD
│       │   ├── substitutions.ts
│       │   └── analytics.ts
│       ├── index.ts             # server entry
│       └── prisma.ts            # prisma client singleton
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── api.ts           # RTK Query — all endpoints defined here
│       │   └── store.ts         # Redux store config
│       ├── features/            # domain-organized pages
│       │   ├── dashboard/
│       │   ├── recipes/
│       │   ├── meal-plan/
│       │   ├── grocery-list/
│       │   ├── pantry/
│       │   └── substitutions/
│       └── shared/components/   # Layout, Toast
├── docker-compose.yml           # MySQL container
└── package.json                 # root scripts (concurrently)
```

## Data Model

I designed the schema around the idea that the grocery list is a *derived artifact* — it's computed from meal plan + pantry + rules, not manually maintained. But users still need to edit it (check things off, override quantities), so there's a separate layer for that.

### Core Models

**Recipe + Ingredient** — One recipe has many ingredients. Each ingredient stores `name` (normalized, lowercase), `displayName` (original casing for UI), `quantity`, `unit`, `storeSection`, and `sortOrder`. Ingredients cascade-delete with the recipe.

**MealPlanEntry** — Links a recipe to a date + meal slot (breakfast/lunch/dinner/snack) with a servings count. Uses `onDelete: Cascade` so if a recipe gets deleted, its meal plan entries go too — this avoids orphan references.

**PantryItem** — What the user already has at home. Has optional `expirationDate` for tracking freshness.

**GroceryGeneration + GroceryItem** — This is the key design decision. Each "generate" creates a new `GroceryGeneration` record with a version number and input hash. Items belong to a generation. This gives us:
- Version history (can compare what changed)
- Input hash deduplication (same inputs = return cached result)
- Clean separation between computed state and user edits

**Supporting Tables** — `IngredientSynonym` (scallion → green onion), `UnitConversion` (tsp → 5ml), `IngredientDensity` (flour = 0.593 g/ml), `Substitution` + `UserConstraint`.

### ER Relationships

```
Recipe 1──* Ingredient
Recipe 1──* MealPlanEntry
GroceryGeneration 1──* GroceryItem
Substitution ──references── UserConstraint (by type+value match)
```

## Grocery Generation Engine

This is the core of the project. Located in `backend/src/engine/`. It's a pure function — takes all inputs, returns output. No database calls, no side effects, fully deterministic (same input = same output every time).

### The 7-Step Pipeline

```
Input: meal plan entries, pantry, substitutions, constraints, synonyms, conversions, densities
                                    │
                                    ▼
┌─────────────────────────────────────────────────────┐
│ STEP 1: EXPAND + SCALE                              │
│ For each meal plan entry, take each ingredient      │
│ and multiply by (targetServings / defaultServings)  │
│ Example: recipe has 200g pasta for 2 servings,      │
│ user wants 4 servings → 400g pasta                  │
└─────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────┐
│ STEP 2: APPLY SUBSTITUTIONS                         │
│ Check user's active constraints. If "dairy-free"    │
│ is active and there's a rule milk→oat milk,         │
│ replace it. Apply quantityRatio if needed.          │
│ Flag warning if unit change can't be converted.     │
└─────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────┐
│ STEP 3: NORMALIZE NAMES                             │
│ "scallion" → "green onion", "capsicum" → "bell     │
│ pepper". Uses synonym table from DB.                │
└─────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────┐
│ STEP 4: NORMALIZE UNITS                             │
│ "tablespoons" → "tbsp", "cups" → "cup",            │
│ "grams" → "g". Handles plurals and aliases.         │
└─────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────┐
│ STEP 5: CONVERT + CONSOLIDATE                       │
│ Merge same ingredients. If units differ, try to     │
│ convert (direct → reverse → two-hop → density).     │
│ If can't convert, keep separate line + warning.     │
└─────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────┐
│ STEP 6: ROUND                                       │
│ Apply human-friendly rounding. Nobody wants to      │
│ buy "1.333 cups" of flour. Default: nearest 0.5    │
│ Configurable: nearest_half, nearest_quarter,        │
│ nearest_whole, or none (2 decimal places).          │
└─────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────┐
│ STEP 7: SUBTRACT PANTRY                             │
│ For each item, find matching pantry entry.          │
│ Convert units if needed. Subtract what user has.    │
│ If pantry has 500ml olive oil and recipe needs      │
│ 3 tbsp (= 45ml), result is 0 (don't need to buy). │
└─────────────────────────────────────────────────────┘
                                    │
                                    ▼
Output: GeneratedGroceryList { items, warnings, generatedAt }
```

### Why Pure Functions?

I separated the engine from the route handler on purpose:
- **Testable** — test the logic without mocking a database
- **Deterministic** — same inputs always produce same outputs (there's a test for this)
- **Reusable** — could swap the DB layer and the engine still works
- **Debuggable** — if output is wrong, you can log the input and reproduce it exactly

## Unit Conversion Logic

The conversion system supports multiple strategies, tried in order:

| Strategy | Example | How |
|----------|---------|-----|
| Direct lookup | tsp → ml | Find rule where fromUnit=tsp, toUnit=ml, multiply |
| Reverse lookup | ml → tsp | Find rule where fromUnit=tsp, toUnit=ml, divide |
| Two-hop | cup → tsp | cup→ml (×240), ml→tsp (÷5) = 48 tsp |
| Density-based | 1 cup flour → g | cup→ml (240), ×0.593 g/ml = 142.3g |
| Failure | piece → ml | Return null, keep separate lines, emit warning |

### Conversion Table (seeded)

| From | To | Multiplier | Type |
|------|----|-----------|------|
| tsp | ml | 5 | volume |
| tbsp | ml | 15 | volume |
| cup | ml | 240 | volume |
| fl oz | ml | 29.574 | volume |
| l | ml | 1000 | volume |
| tbsp | tsp | 3 | volume |
| cup | tbsp | 16 | volume |
| kg | g | 1000 | mass |
| oz | g | 28.35 | mass |
| lb | g | 453.592 | mass |
| lb | oz | 16 | mass |

### Density Table (for mass↔volume)

| Ingredient | g/ml | Source |
|-----------|------|--------|
| flour | 0.593 | King Arthur Baking reference |
| sugar | 0.845 | standard granulated |
| butter | 0.911 | solid at room temp |
| milk | 1.03 | whole milk |
| olive oil | 0.918 | standard EVOO |
| honey | 1.42 | |
| rice | 0.85 | uncooked long grain |
| salt | 1.217 | table salt |
| water | 1.0 | baseline |

I got these from USDA food density data and baking conversion charts. They're approximate but good enough for grocery shopping — nobody measures flour to the exact gram at home anyway.

### When Conversion Fails

If two lines have the same ingredient but incompatible units (like "2 cloves garlic" and "1 tbsp garlic"), we can't merge them — there's no universal clove→tbsp conversion. In this case:
- Both lines stay separate in the grocery list
- A `unit_mismatch` warning is emitted
- The UI shows a yellow warning indicator on that item

## Conflict Resolution — The Overlay Strategy

This was the trickiest design decision. The problem: user checks off items and overrides quantities, but then the meal plan changes and we need to regenerate. What happens to their edits?

### My Approach: "Regenerate base + preserve user layer"

I looked at how Google Keep handles shared lists and how Todoist handles recurring tasks. The pattern that felt right:

**Generated data = base truth. User edits = overlay that gets re-applied.**

Concretely, when regeneration happens:
1. Run the pure generation function with new inputs
2. For each generated item, look up the *previous* generation's items by matching `ingredientName + unit`
3. Carry forward: `overrideQty`, `isChecked`, `isAlreadyHave`
4. Ad-hoc items (user-added, not from any recipe) are always carried forward
5. Hash the input — if identical to previous, just return cached result

### Scenario Walkthrough

| Scenario | What Happens |
|----------|-------------|
| User checks off "milk", then adds a recipe that needs milk | Regeneration creates new milk item. `isChecked` from previous gen is carried forward — still checked. |
| User overrides "onion" from 3 to 5, then removes a recipe | New generation computes maybe 2 onions now. Override of 5 is preserved (user knows better). |
| User adds "paper towels" as ad-hoc item, then regenerates | Ad-hoc items are copied to new generation regardless of what recipes say. |
| User deletes a recipe that's in the meal plan | Cascade delete removes meal plan entries. Next regen produces shorter list. Previous checked states still preserved for remaining items. |
| Same meal plan, no changes, user hits regenerate | Input hash matches → return cached generation. No new DB writes. |

### Why Not "Overwrite + Undo"?

I considered the alternative: blow away the list on each regen and provide an undo/changelog. Rejected because:
- Mid-shopping scenario: user is in the store, checking things off. Plan changes (spouse edits something). If we overwrite, they lose their progress.
- Overlay is more predictable — user edits always win, generated data just updates the baseline.

## State Management (Frontend)

### RTK Query Setup

All API calls go through a single RTK Query `createApi` definition in `frontend/src/app/api.ts`. This gives us:
- Automatic caching (no duplicate requests)
- Tag-based invalidation (mutating recipes invalidates recipe cache)
- Loading/error states built in (no manual `useState` for loading)
- Automatic refetch when tags are invalidated

### Tag Invalidation Strategy

```
createRecipe    → invalidates ['Recipes']
addMealPlanEntry → invalidates ['MealPlan', 'GroceryList']
updatePantryItem → invalidates ['Pantry', 'GroceryList']
generateList    → invalidates ['GroceryList']
```

When a meal plan entry is added, the grocery list cache is invalidated — so the UI refetches the latest list automatically. No manual "refresh" needed by the user.

### Auto-Regeneration

The MealPlanPage watches for changes in meal plan entries. When entries change (add/remove), it debounces (500ms) and triggers a grocery list regeneration automatically. This means the grocery list is always in sync with the meal plan without the user having to manually click "Generate."

## API Endpoints

### Recipes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/recipes?search=&ingredient=` | List all, with optional search |
| GET | `/api/recipes/:id` | Get one recipe with ingredients |
| POST | `/api/recipes` | Create recipe |
| PUT | `/api/recipes/:id` | Update recipe (replaces ingredients) |
| DELETE | `/api/recipes/:id` | Delete recipe (cascades to meal plan) |

### Meal Plans
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meal-plans?weekStart=` | Get entries for a week |
| POST | `/api/meal-plans` | Add entry (recipe + date + slot + servings) |
| PUT | `/api/meal-plans/:id` | Update (change servings, slot, etc.) |
| DELETE | `/api/meal-plans/:id` | Remove entry |

### Pantry
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pantry` | List all pantry items |
| POST | `/api/pantry` | Add item |
| PUT | `/api/pantry/:id` | Update quantity/unit/expiration |
| DELETE | `/api/pantry/:id` | Remove item |

### Grocery List
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/grocery/generate` | Trigger generation from current meal plan |
| GET | `/api/grocery?section=&uncheckedOnly=&warningsOnly=` | Get latest list with filters |
| PATCH | `/api/grocery/items/:id/check` | Toggle checked state |
| PATCH | `/api/grocery/items/:id/override` | Override computed quantity |
| PATCH | `/api/grocery/items/:id/already-have` | Mark as already owned |
| POST | `/api/grocery/items/ad-hoc` | Add manual item |
| DELETE | `/api/grocery/items/:id` | Remove item |

### Substitutions & Constraints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/substitutions` | List all substitution rules |
| POST | `/api/substitutions` | Create rule |
| DELETE | `/api/substitutions/:id` | Delete rule |
| GET | `/api/substitutions/constraints` | List user constraints |
| POST | `/api/substitutions/constraints` | Add constraint |
| DELETE | `/api/substitutions/constraints/:id` | Remove constraint |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/summary` | Dashboard data (counts, charts, breakdowns) |

## Handling Concurrent/Rapid Updates

The eval doc mentions "app must remain consistent under rapid recipe swaps and bulk actions." Here's how this is handled:

1. **Input Hash Deduplication** — If two generate requests fire with the same underlying data, the second one returns the cached generation (matched by MD5 hash of serialized input). No duplicate items.

2. **RTK Query Request Serialization** — RTK Query doesn't fire duplicate in-flight requests for the same endpoint. If a query is already pending, subsequent calls get the same promise.

3. **Debounced Auto-Regeneration** — The meal plan page debounces regeneration by 500ms. Rapid add/remove/swap actions within that window collapse into one generation call.

4. **Versioned Generations** — Each generation gets an incrementing version number. The frontend always fetches the latest version. Old generations are never mutated.

5. **Overlay by Match** — User state is carried forward by matching `ingredientName + unit`, not by ID. So even if the generation creates new item IDs, the overlay logic still finds the right previous state.

## Tradeoffs & Decisions

| Decision | Why | What I'd Do Differently With More Time |
|----------|-----|----------------------------------------|
| Express over NestJS | Faster to build, less ceremony for a small API | NestJS for better structure if team grows |
| Prisma over TypeORM | Better DX, auto-generated types, clean migrations | Same choice, Prisma is solid |
| RTK Query over React Query | Already using Redux, RTK Query integrates cleanly | Either works, picked for ecosystem consistency |
| MySQL over Postgres | Requirement specified MySQL | Postgres if I had the choice (better JSON, arrays) |
| No auth | Not in requirements, zero domain signal for it | Add JWT or session-based if needed |
| Overlay strategy over overwrite+undo | Predictable behavior mid-shopping, simpler mental model | Could add changelog view as enhancement |
| No WebSockets | Single-user app, polling via RTK Query is sufficient | Add WS if multi-user editing needed |
| Density table is hardcoded seed | Covers common ingredients, good enough for demo | Fetch from USDA API or let users add their own |

## Testing Strategy

### What's Tested (Engine — Unit Tests)

- `scale.test.ts` — scaling up/down, fractional, zero-serving edge case, all rounding strategies
- `convert.test.ts` — direct, reverse, two-hop, density-based, failure cases, unit type classification
- `normalize.test.ts` — synonym resolution, unit alias normalization, case handling
- `generate.test.ts` — full pipeline: determinism, scaling, consolidation, pantry subtraction, substitutions (active vs inactive), synonym merging, warning generation, empty plan, source tracking

### What's Not Tested (and why)

- Route handlers: Would need supertest + test DB setup. Focused time on engine correctness since that's where the logic lives.
- Frontend: No unit tests for React components. Would add React Testing Library if time allowed.
- The overlay logic in grocery.ts: This is DB-dependent, would need integration tests with a test database.

### Running Tests

```bash
cd backend
npm test              # runs all tests
npm test -- --watch   # watch mode during development
```

## Research & References

Before building this I spent some time looking at how existing apps handle the grocery problem:

- **Mealime** — generates grocery list but no pantry subtraction, no unit merging. Items are just dumped per-recipe.
- **Paprika** — has a grocery list but it's mostly manual. No smart consolidation.
- **Whisk** — closest to what I built. Consolidates ingredients, but substitution support is limited.
- **Eat This Much** — meal planning focused, grocery list is secondary. No override persistence.

For the unit conversion approach, I referenced:
- USDA Food Data Central for density values
- King Arthur Baking measurement charts
- The concept of "conversion graphs" from programming problems (treat units as nodes, conversions as edges, find path)

For the overlay/conflict resolution pattern:
- CRDTs (conflict-free replicated data types) — too complex for this, but inspired the "user edits always win" principle
- Google Docs operational transform — again overkill, but the idea of "base + operations" influenced the overlay approach
- Todoist's recurring task model — how they handle "checked but comes back"

## AI Usage

Being transparent here:

**Used AI (Claude) for:**
- Iterating on the Prisma schema design (asked "what am I missing for grocery list state management")
- Generating seed data (the 6 recipes with realistic ingredients)
- Boilerplate scaffolding (express route structure, RTK Query endpoint definitions)
- Tailwind CSS class combinations for the UI

**Designed and built myself:**
- The 7-step generation pipeline architecture
- Unit conversion strategy (direct → reverse → two-hop → density fallback)
- Overlay conflict resolution approach
- Data model relationships and the GroceryGeneration versioning concept
- Auto-regeneration debounce logic

**All AI-generated code was reviewed and modified.** The generation engine went through several iterations where I'd test edge cases and fix bugs in the logic (like the synonym normalization needing to happen BEFORE consolidation, not after).

## External Libraries

| Library | Purpose |
|---------|---------|
| express | HTTP server |
| @prisma/client + prisma | ORM + migrations |
| cors | Cross-origin requests |
| dotenv | Environment variables |
| @reduxjs/toolkit | State management + RTK Query |
| react-router-dom | Client-side routing |
| react, react-dom | UI framework |
| recharts | Dashboard charts |
| tailwindcss | Styling |
| jest + ts-jest | Testing |
| vite | Frontend bundler |
| nodemon | Dev hot reload |
| concurrently | Run frontend + backend together |

No exotic dependencies. Everything is mainstream and well-maintained.
