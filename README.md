# Recipe Planner + Grocery List

a meal planning app that lets you plan weekly meals, auto-generates a smart grocery list, handles unit conversions, pantry subtraction, substitutions and keeps everything in sync when plans change.

## how i approached this

started by looking at apps like Mealime, Paprika, and AnyList to understand what real meal planners do. realized the hard part isnt the UI — its the grocery generation engine that needs to handle real-world messiness like:
- same ingredient in different units across recipes (500ml milk + 1 cup milk)
- pantry items that might be in different units than recipe needs
- user edits that should survive when the list regenerates
- substitutions that trigger based on dietary constraints

so i built the engine first as pure functions, tested it independently, then wrapped everything with the API and UI.

## tech stack

| what | why |
|------|-----|
| React + TypeScript | assignment requirement |
| Redux Toolkit (RTK Query) | handles caching + auto-refetch on tag invalidation |
| Tailwind CSS | fast to build, consistent design |
| Express + TypeScript | lightweight, same language as frontend |
| Prisma ORM | type-safe queries, clean migrations |
| MySQL 8.0 | assignment requirement |
| Recharts | dashboard visualizations |
| Gemini AI | recipe suggestions, nutrition estimates |

## setup instructions

### prerequisites
- Node.js 18+
- Docker Desktop (for MySQL) OR MySQL installed locally

### run it

```bash
# 1. clone
git clone https://github.com/Srishakotte/recipe-planner.git
cd recipe-planner

# 2. start mysql
docker compose up -d
# wait ~10 seconds for mysql to be ready

# 3. backend setup
cd backend
npm install
cp .env.example .env
# edit .env if your mysql is on different port/password
npx prisma generate
npx prisma db push --force-reset
npm run db:seed
npm run dev

# 4. frontend (new terminal)
cd frontend
npm install
npm run dev

# 5. open
# http://localhost:3000
```

### .env configuration

```
DATABASE_URL="mysql://root:password@localhost:3307/recipe_planner"
PORT=3001
GEMINI_API_KEY="your-gemini-api-key"
```

## database schema

11 tables total. heres the important relationships:

```
recipes ──has many──→ ingredients
recipes ──used in──→ meal_plan_entries
meal_plan_entries ──generates──→ grocery_items (via engine)
pantry_items ──subtracted from──→ grocery_items
substitutions ──applied during──→ generation
user_constraints ──trigger──→ substitutions
ingredient_synonyms ──normalize──→ ingredient names
unit_conversions ──merge──→ different units
ingredient_densities ──bridge──→ mass↔volume
```

key tables:
- `recipes` — name, servings, steps
- `ingredients` — qty, unit, store section (per recipe)
- `meal_plan_entries` — recipe assigned to date + slot + servings + isLeftover
- `pantry_items` — what you have at home (qty, unit, expiry)
- `grocery_items` — generated list items with override state
- `grocery_generations` — version tracking + input hash for idempotency

## grocery generation engine

this is the core. located in `backend/src/engine/`. all pure functions, no database calls inside, deterministic (same input = same output).

### pipeline

```
Step 1: SCALE
  multiply each ingredient by (targetServings / defaultServings)

Step 2: SUBSTITUTE
  if user has active constraints (dairy-free, no-peanuts etc)
  and substitution rule exists → replace ingredient
  if NO substitution exists → generate warning

Step 3: NORMALIZE NAMES
  resolve synonyms: scallion → green onion, capsicum → bell pepper
  handles: spaces, hyphens, case (Lady Finger = lady-finger = ladyfinger)

Step 4: NORMALIZE UNITS
  tablespoons → tbsp, grams → g, cups → cup, etc

Step 5: CONVERT + CONSOLIDATE
  group by canonical ingredient name
  try unit conversion to merge (500ml + 1L = 1500ml = 1.5L)
  if cant convert → keep separate + warning

Step 6: ROUND
  human-friendly rounding (nearest 0.5 by default)
  also: smart unit display (1500ml → 1.5L, 2000g → 2kg)

Step 7: SUBTRACT PANTRY
  for each item: need - have = buy
  skips expired pantry items
  if pantry unit differs → converts first
  if cant convert pantry unit → warning + show full qty

OUTPUT: items[] + warnings[] + source attribution
```

### unit conversion approach

| conversion | method |
|-----------|--------|
| volume↔volume | lookup table (tsp↔tbsp↔cup↔ml↔L) |
| mass↔mass | lookup table (g↔kg↔oz↔lb) |
| mass↔volume | density table (flour: 0.593 g/ml, milk: 1.03 g/ml) |
| incompatible | keep separate lines + surface warning |

density values i used (researched from cooking resources):
- flour: 0.593 g/ml
- sugar: 0.845 g/ml
- butter: 0.911 g/ml
- milk: 1.03 g/ml
- olive oil: 0.918 g/ml
- honey: 1.42 g/ml
- rice: 0.85 g/ml

### conflict resolution strategy

chose: **"regenerate base + apply overlay"**

```
GENERATED BASE (from engine)
      +
USER OVERLAY (stored separately)
  - quantity overrides: user changed qty → persists
  - checked state: user checked item → stays checked
  - ad-hoc items: user added "paper towels" → never removed
      =
FINAL DISPLAY
```

rules:
1. user override always wins, even after regeneration
2. checked state preserved by matching ingredientName + unit
3. ad-hoc items never touched by regeneration
4. if recipe deleted from plan → its items removed from base, overrides cleaned
5. input hash prevents unnecessary regeneration (same input → skip)

### recipe deletion handling

if recipe is used in future meal plan → prevent deletion with error message.
if only in past meals → allow deletion (already eaten).

## leftover system

- past/current meals can be marked as leftover (🍱 toggle)
- opens modal with expiry date picker (default: tomorrow)
- leftover meals skip grocery generation (dont add ingredients again)
- available leftovers shown when adding new meals
- after expiry → leftover removed from available options

## features

### core (required)
- [x] recipe CRUD with ingredients (qty, unit, name, store section)
- [x] meal plan week view with day + slot assignment
- [x] serving adjustment per planned recipe
- [x] grocery list generation from meal plan
- [x] ingredient consolidation across recipes
- [x] scaling by servings
- [x] store section grouping
- [x] pantry subtraction
- [x] unit conversion (vol↔vol, mass↔mass, mass↔vol via density)
- [x] warning for unconvertible units
- [x] ingredient normalization (synonyms)
- [x] human-friendly rounding
- [x] substitution rules + dietary constraints
- [x] allergen warning when no substitution exists
- [x] check off items, manual qty edit, ad-hoc items
- [x] "already have" / move to pantry
- [x] override persistence across regeneration
- [x] checked state persistence
- [x] auto-regeneration on meal plan change
- [x] recipe search by name and ingredient
- [x] grocery list filters (section, unchecked, warnings)
- [x] deterministic conflict handling (overlay strategy)
- [x] prevent deleting recipe used in future plan

### stretch features
- [x] leftover system with expiry
- [x] copy previous week meal plan
- [x] swap recipe button
- [x] dashboard with charts (recharts)
- [x] AI recipe suggestions from pantry (gemini)
- [x] AI nutrition estimation
- [x] AI cost estimation
- [x] smart unit display (1500ml → 1.5L)
- [x] expiry warnings on pantry
- [x] synonym management UI
- [x] CSV export (only buy items)
- [x] dark green sidebar premium UI

## testing

42 unit tests for the grocery engine:

```bash
cd backend
npm test
```

covers:
- scaling (scaleQuantity)
- rounding (all strategies)
- unit conversion (direct, reverse, two-hop, density)
- normalization (synonyms, unit aliases)
- full pipeline (determinism, consolidation, substitution, warnings, pantry subtraction)

## api endpoints

```
# recipes
GET    /api/recipes?search=&ingredient=
POST   /api/recipes
PUT    /api/recipes/:id
DELETE /api/recipes/:id

# meal plans
GET    /api/meal-plans?weekStart=
POST   /api/meal-plans
PUT    /api/meal-plans/:id
DELETE /api/meal-plans/:id
GET    /api/meal-plans/leftovers

# pantry
GET    /api/pantry
POST   /api/pantry
PUT    /api/pantry/:id
DELETE /api/pantry/:id

# grocery
POST   /api/grocery/generate
GET    /api/grocery
PATCH  /api/grocery/items/:id/check
PATCH  /api/grocery/items/:id/override
PATCH  /api/grocery/items/:id/already-have
POST   /api/grocery/items/ad-hoc
DELETE /api/grocery/items/:id

# substitutions + constraints + synonyms
GET    /api/substitutions
POST   /api/substitutions
DELETE /api/substitutions/:id
GET    /api/substitutions/constraints
POST   /api/substitutions/constraints
DELETE /api/substitutions/constraints/:id
GET    /api/substitutions/synonyms
POST   /api/substitutions/synonyms
DELETE /api/substitutions/synonyms/:id

# ai
GET    /api/ai/test
POST   /api/ai/suggest-recipes
POST   /api/ai/estimate-nutrition
POST   /api/ai/estimate-cost
POST   /api/ai/suggest-substitution
POST   /api/ai/weekly-plan

# analytics
GET    /api/analytics/summary
```

## state management

```
RTK Query handles all server state:
- auto-caching
- tag-based invalidation (meal plan change → grocery list refetches)
- optimistic updates possible (not implemented yet)

invalidation chain:
  meal plan mutation → invalidates ['MealPlan', 'GroceryList']
  pantry mutation → invalidates ['Pantry', 'GroceryList']
  constraint mutation → invalidates ['Constraints', 'GroceryList']
```

## tradeoffs

| decision | why |
|----------|-----|
| express over nestjs | faster to build under time constraint, less ceremony |
| prisma over typeorm | type-safe out of box, cleaner migration system |
| RTK Query over manual thunks | built-in caching, tag invalidation, less code |
| no auth | evaluators test grocery logic not JWT. trivially addable (add user_id FK to all tables) |
| overlay conflict strategy | predictable, user edits always win, clear mental model |
| density table approach | honest about limitations — warns when cant convert |
| generate from today only | past meals already eaten, no point buying their ingredients |

## what i would improve with more time

- optimistic updates for instant check/uncheck feel
- drag-and-drop meal planning
- websocket for multi-household real-time sync
- recipe image upload (currently uses placeholder)
- more comprehensive density table
- cost tracking with real price data
- mobile responsive improvements
- recipe sharing/import from URL

## ai usage

used gemini AI for:
- recipe suggestions based on pantry items
- nutrition estimation (calories, protein, carbs, fats)
- grocery cost estimation
- substitution suggestions
- weekly plan generation

all core logic (scaling, conversion, consolidation, pantry subtraction, conflict resolution) is hand-written deterministic code. AI is for suggestions only — the grocery engine works perfectly without it.

fallback: if AI is unavailable, smart hardcoded logic suggests recipes based on pantry contents.

## external libraries

express, prisma, @reduxjs/toolkit, react-router-dom, tailwindcss, recharts, @google/genai, cors, dotenv, react-icons
