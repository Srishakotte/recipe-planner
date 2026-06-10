# Recipe Planner + Grocery List


A meal planning app that lets you plan weekly meals, auto-generates a smart grocery list, handles unit conversions, pantry subtraction, substitutions and keeps everything in sync when plans change.

---
## Demo Video

https://www.youtube.com/watch?v=DkaJRh1jgL8

---

## Before You Start

**The application will be slow.** Every request (loading pages, adding recipes, saving meal plans, generating grocery lists) takes 2-4 seconds. This is because the database is hosted on Railway free tier MySQL which has connection latency on every single query. This is NOT a performance bug or code issue - it is the free hosting tier reconnecting on each request. For instant responses, run locally with Docker (steps below).

The app comes pre-seeded with 6 recipes, 10 pantry items, and a sample meal plan for the current week. The sample data includes a **leftover example** - Tuesday's Pancakes are marked as leftover (yellow card with recycle icon), and Thursday reuses 2 servings from that leftover (grey card). This shows the full leftover flow working out of the box.

If you want to start from scratch, there is a "Start Fresh" button on the home page. If you cleared everything and want the demo data back, click "Load Sample Data". No terminal commands needed for either.

AI features (recipe suggestions, nutrition estimation, cost estimation) need a Gemini API key from Google AI Studio. Without one, the app still works fully. All AI features fall back to smart hardcoded logic. The core grocery engine has zero AI dependency.

---

## .env File

Create a file called `.env` inside the `backend/` folder with these three values:

```
DATABASE_URL="mysql://root:password@localhost:3306/recipe_planner"
PORT=3001
GEMINI_API_KEY="your-gemini-api-key-here"
```

- DATABASE_URL: Your MySQL connection string. If using Docker locally, the default above works. If using Railway, copy the connection string from your Railway dashboard (Settings > Variables > DATABASE_URL).
- PORT: The backend runs on this port. Keep it 3001.
- GEMINI_API_KEY: Get a free key from https://aistudio.google.com/apikey (optional, app works without it).

---

## How I Approached This

I looked at existing meal planning apps (Mealime, Paprika, AnyList, Whisk, Mealboard) to understand what they do well and where they fall short. The main gaps I found:
- No proper unit conversion (mass to volume especially)
- Pantry subtraction ignores expiry dates
- User edits get wiped when the grocery list regenerates
- No substitution handling for dietary constraints

I built the grocery engine first as pure functions, tested it with 42 unit tests, then built the API and UI around it.

---

## Tech Stack

- Frontend: React 18 + TypeScript
- State Management: Redux Toolkit + RTK Query (auto-caching + tag-based invalidation)
- Styling: Tailwind CSS
- Backend: Express + TypeScript
- ORM: Prisma 5
- Database: MySQL 8.0 (hosted on Railway)
- Charts: Recharts
- AI: Gemini 2.5 Flash via @google/genai package (optional)

---

## setup (local with Docker)

prerequisites: Node.js 18+, Docker Desktop

```bash
git clone https://github.com/Srishakotte/recipe-planner.git
cd recipe-planner

# start mysql
docker compose up -d
# wait about 10 seconds for mysql to be ready

# backend
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma db push --force-reset
npm run db:seed
npm run dev

# frontend (new terminal)
cd frontend
npm install
npm run dev

# open http://localhost:3000
```

the default .env works with docker-compose out of the box, no edits needed.

## setup (Railway MySQL)

if you want to use the hosted database instead of running Docker locally:

1. go to railway.app, sign in, create a new project
2. add a MySQL service to the project
3. go to the MySQL service, click Variables tab
4. copy the DATABASE_URL value (looks like mysql://root:PASSWORD@HOST:PORT/railway)
5. in your `backend/.env` file, replace the DATABASE_URL line with the Railway one
6. run:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma db push
   npm run db:seed
   npm run dev
   ```

note: Railway free tier has connection latency on every query (2-4 seconds per request). this affects all operations. for the best evaluation experience, run locally with Docker.

---

## troubleshooting

if something goes wrong during setup, heres every error i ran into during development and how to fix each one:

**"Error: listen EADDRINUSE: address already in use :::3001"**

the backend port is occupied by a previous run that didnt close properly.
```bash
npx kill-port 3001
npm run dev
```
if that doesnt work:
```bash
netstat -ano | findstr :3001
taskkill /PID <the_number_you_see> /F
npm run dev
```

**"Error: P1001: Can't reach database server at localhost:3306"**

MySQL isnt running. start it:
```bash
docker compose up -d
```
wait about 10 seconds, then try again. if youre using Railway instead of Docker, make sure your DATABASE_URL in .env matches your Railway connection string exactly.

**"Error: Environment variable not found: DATABASE_URL"**

the .env file is missing. create it:
```bash
cd backend
cp .env.example .env
```
then edit it with your DATABASE_URL if needed.

**"Cannot find module '@prisma/client'"**

prisma client wasnt generated. run:
```bash
npx prisma generate
```

**"The table 'recipes' does not exist"**

database tables havent been created yet:
```bash
npx prisma db push --force-reset
npm run db:seed
```

**"Unique constraint failed on ingredient_densities_ingredientName_key"**

seed data already exists in the database. clear and reseed:
```bash
npx prisma db push --force-reset
npm run db:seed
```

**"[vite] http proxy error: /api/recipes ECONNREFUSED"**

the backend isnt running. start backend FIRST (terminal 1), then frontend (terminal 2). backend must be on port 3001 before frontend can proxy API calls.

**"Cannot find module '@google/genai'" or "Cannot find module 'recharts'"**

dependencies not installed:
```bash
cd backend && npm install
cd ../frontend && npm install
```

**"TSError: Unable to compile TypeScript"**

prisma types out of sync:
```bash
npx prisma generate
npm run dev
```

**"EPERM: operation not permitted, rename .prisma/client/query_engine"**

Windows file lock. close ALL terminals, wait 5 seconds, open fresh terminal:
```bash
cd backend
npx prisma generate
npm run dev
```

**"Gemini error: 503 high demand" or "404 model not found"**

Gemini is temporarily overloaded or model is deprecated. no action needed. the app falls back to smart hardcoded suggestions automatically. AI is optional.

**app shows "No recipes yet"**

seed data wasnt loaded:
```bash
npm run db:seed
```
or just click "Load Sample Data" button on the home page.

**frontend blank page**

make sure youre opening http://localhost:3000 (frontend) not http://localhost:3001 (backend API). both servers need to be running in separate terminals.

**note about .env credentials:** the .env file contains database credentials and API keys. its gitignored for security. if you need my exact .env values to test with the Railway database, reach out and i can share them securely.

---

## running tests

```bash
cd backend
npm test
```

runs 42 unit tests for the grocery generation engine.

---

## database schema

11 tables total:

- `recipes` stores name, default servings, description
- `ingredients` stores qty, unit, name, displayName, storeSection, sortOrder (belongs to a recipe)
- `meal_plan_entries` stores recipe assigned to date + slot + servings + isLeftover + leftoverExpiryDate
- `pantry_items` stores what you have at home (name, qty, unit, expirationDate)
- `grocery_items` stores generated list items with checked state, override qty, isAlreadyHave, isAdHoc, source recipe attribution
- `grocery_generations` stores version tracking + input hash for idempotency
- `substitutions` stores originalIngredient to substituteIngredient mapping with ratio + constraint type
- `user_constraints` stores dietary preferences (dairy-free, vegetarian, no-peanuts)
- `ingredient_synonyms` stores canonical name mapping (scallion maps to green onion)
- `unit_conversions` stores conversion multipliers (tsp to ml, cup to tbsp, kg to g)
- `ingredient_densities` stores grams per ml values for mass to volume conversion

relationships:
- recipes have many ingredients
- recipes are used in meal_plan_entries
- meal_plan_entries generate grocery_items (via engine)
- pantry_items are subtracted during generation
- substitutions are applied during generation when user_constraints match
- ingredient_synonyms normalize names before consolidation
- unit_conversions and ingredient_densities enable merging different units

---

## grocery generation engine

this is the core of the project. located in `backend/src/engine/`. all pure functions. no database calls inside, no side effects, fully deterministic (same input always gives same output).

### pipeline

the engine takes planned meals + pantry + constraints + substitution rules as input and produces a grocery list with warnings.

step 1 SCALE: multiply each ingredient by (targetServings / defaultServings). if recipe serves 4 and you planned 2, halve everything.

step 2 SUBSTITUTE: check user constraints (dairy-free? vegetarian? no-peanuts?). for each ingredient, if constraint applies and substitution rule exists, replace it. example: constraint is dairy-free, ingredient is milk, substitute with oat milk at 1:1 ratio. if constraint applies but no substitution exists, generate a warning.

step 3 NORMALIZE NAMES: apply synonym mapping. scallion becomes green onion, capsicum becomes bell pepper. handles spaces, hyphens, case variations (Lady Finger = lady-finger = ladyfinger = bhindi all become okra).

step 4 NORMALIZE UNITS: standardize unit strings. tablespoons becomes tbsp, grams becomes g, cups becomes cup. prevents "1 tablespoon" and "2 tbsp" from being treated as different units.

step 5 CONVERT AND CONSOLIDATE: group by canonical ingredient name. within each group, try to convert all quantities to the same unit. volume to volume: 500ml + 1 cup = 500ml + 240ml = 740ml. mass to mass: 200g + 0.5kg = 200g + 500g = 700g. mass to volume (via density): 200g flour = 200 / 0.593 = 337ml. if conversion is impossible, keep as separate lines and generate a warning.

step 6 ROUND: produce human-friendly quantities. nearest 0.5 by default (1.73 becomes 1.5, 2.26 becomes 2.5). also does smart unit upgrades: 1500ml becomes 1.5L, 2000g becomes 2kg.

step 7 SUBTRACT PANTRY: for each item, need minus have equals buy. skips expired pantry items. if pantry unit differs from recipe unit, converts first. if conversion fails, shows warning and displays full needed quantity.

output: list of items with quantities + warnings + source recipe attribution per item.

### unit conversion details

volume to volume uses a lookup table: 1 cup = 240ml, 1 tbsp = 15ml, 1 tsp = 5ml, 1 fl oz = 29.574ml, 1 L = 1000ml.

mass to mass uses a lookup table: 1 kg = 1000g, 1 lb = 453.6g, 1 oz = 28.35g.

mass to volume uses a density table. you need to know how dense the ingredient is. examples:
- flour: 0.593 g/ml (so 200g flour = 337ml)
- sugar: 0.845 g/ml
- butter: 0.911 g/ml
- milk: 1.03 g/ml (so 500ml milk = 515g)
- olive oil: 0.918 g/ml
- honey: 1.42 g/ml
- rice: 0.85 g/ml
- cream: 1.012 g/ml
- salt: 1.217 g/ml
- water: 1.0 g/ml
- vegetable oil: 0.92 g/ml

these values are from USDA FoodData Central and King Arthur Baking resources.

two-hop conversions: if theres no direct conversion, the engine chains through an intermediate. for example cup to ml goes through cup to tbsp (x16) then tbsp to ml (x15).

incompatible units: if it cant convert (like "2 piece garlic" and "1 tsp garlic powder"), it keeps them as separate lines and shows a warning to the user. it never guesses.

### conflict resolution

i chose the "regenerate base + apply user overlay" approach.

how it works: the engine generates a fresh grocery list every time the meal plan changes. but user edits (quantity overrides, checked-off items, manually added items) are stored separately as an "overlay". when the list regenerates, the overlay is reapplied on top.

rules:
- user override always wins, even after regeneration
- checked state preserved by matching ingredient name + unit
- ad-hoc items (user-added like "paper towels") are never touched by regeneration
- if a recipe is removed from the plan, its items are removed from the base, and related overrides are cleaned up
- input hash prevents unnecessary regeneration (if nothing actually changed in the meal plan, skip the engine entirely)

why not "overwrite + undo": undo stack is complex, users lose trust if their edits disappear even temporarily. overlay means edits are never lost.

### async robustness

- rapid recipe swaps: RTK Query debounces, only latest mutations invalidation matters
- bulk week planning: each mutation invalidates tags, RTK Query batches refetches
- out-of-order updates: input hash idempotency prevents duplicate generation
- mid-shop regeneration: overlay preserves all checked/override state
- concurrent writes: Prisma transactions ensure atomic writes, no partial state

---

## Leftover System

Past and current meals can be marked as leftover using the toggle button. This opens a modal with an expiry date picker (defaults to tomorrow). Leftover meals skip grocery generation since their ingredients were already purchased.

When adding new meals, available leftovers are shown with remaining servings. Serving cap is enforced so you cannot use more servings than available. The tracking is dynamic: if you have 4 servings of leftover and use 2, it shows 2 remaining. If you delete that meal, it goes back to 4.

**How to identify leftovers in the UI:**
- Yellow card with leftover icon = this meal IS the leftover source (you ate it and marked the remainder)
- Grey card with recycle icon = this meal is REUSING leftover servings (no new groceries needed)
- Green card = normal planned meal
- Dimmed/blurred = past day (locked, only leftover toggle visible)

**Rules:**
- Cannot unmark a leftover if future meals are consuming from it (shows error message)
- Expired leftovers automatically disappear from available list
- Leftover sources must have an expiry date (set during marking)
- Consumers are visually distinct (grey + recycle icon) so you know which meals are "free" from grocery perspective

---

## features

### core features (all required by the specification)

- recipe CRUD with ingredients (qty, unit, name, displayName, store section)
- meal plan week view with day + meal slot (breakfast, lunch, dinner, snack, anytime)
- add, remove, swap recipes in plan
- adjust servings per planned recipe (decrement to 0 removes the meal)
- grocery list generation from meal plan (deterministic engine)
- ingredient consolidation across all planned recipes
- scaling by servings ratio
- store section grouping (produce, dairy, meat, pantry, bakery, frozen, other)
- pantry inventory with quantity + unit + expiration date
- pantry subtraction (skips expired items)
- unit conversion: volume to volume, mass to mass, mass to volume via density
- warning for unconvertible units
- ingredient normalization (synonym mapping, case/hyphen handling)
- human-friendly rounding (nearest 0.5, configurable)
- substitution rules + dietary constraints (allergen, dietary, preference)
- warning when no substitution exists for constrained ingredient
- check off grocery items (persists across regeneration)
- manual quantity edit / override (persists across regeneration)
- add ad-hoc items not from recipes (never removed by regeneration)
- "already have" / move to pantry
- conflict handling using overlay strategy (documented, deterministic)
- async robustness (input hash, atomic writes, tag invalidation)
- auto-regeneration on meal plan change
- recipe search by name and ingredient
- grocery list filters: unchecked only, store section, warnings
- prevent deleting recipe used in future meal plan (shows error message)
- loading states throughout (spinners, pulse animations)
- empty states with helpful messages and action buttons

### stretch features (beyond requirements)

these are features i built beyond what was asked because they make the app feel like a real product:

**leftover system** - mark past meals as leftover, set expiry, and reuse servings in future meals. tracks remaining servings dynamically. if you have 4 servings leftover and use 2 in tomorrow's plan, it shows 2 remaining. delete that meal and it goes back to 4. cant unmark a leftover if its being used by a future meal (shows error).

**AI recipe suggestions** - click "Generate Recipe" and Gemini AI suggests 3 recipes based on your actual pantry items. each suggestion is expandable showing ingredients, steps, and nutrition. one click adds it to your recipe list ready to use in meal plans.

**AI nutrition estimation** - on the dashboard, click "Estimate Nutrition" and it sends your actual weekly meal plan (with real recipes and scaled ingredient quantities) to Gemini. returns per-day calorie/protein/carbs/fats breakdown shown in charts.

**AI cost estimation** - on the grocery page, click "Estimate Cost" and it sends your actual grocery list to Gemini asking for average INR prices from online stores. shows total estimated cost.

**pantry grouping** - if you have the same item with different expiry dates (like 2 eggs expiring today + 6 eggs expiring next week), it groups them into one row showing total quantity, safe quantity, and expiring quantity separately. each batch has its own edit/delete button.

**recipe protection** - cant delete a recipe thats in a future meal plan. shows inline error: "This recipe is planned for X upcoming meals. Remove it from the plan first."

**copy previous week** - one click copies last weeks entire meal plan to this week.

**start fresh / reload sample data** - homepage buttons to clear everything or reload demo data without touching the terminal.

**inline confirmations** - no browser popup alerts anywhere. delete buttons show "Sure? Yes/No" inline.

**unit dropdowns** - recipe form, pantry form, and grocery add-item form all use dropdown selects for units (g, kg, ml, l, cup, tbsp, tsp, oz, lb, piece, clove, can, bunch, slice, packet). prevents typos and ensures engine can convert properly.

**alphabetical sorting** - recipes sorted A-Z by name. grocery items sorted alphabetically within each store section. pantry sorted A-Z.

**CSV export** - exports only "to buy" items (not pantry-covered or checked-off) as a CSV file you can share or print.

**smart unit display** - engine outputs user-friendly quantities: 1500ml becomes 1.5L, 2000g becomes 2kg, 0.5 becomes "half".

---

## testing

42 unit tests in `backend/src/engine/__tests__/`:

- scale.test.ts tests scaling quantities by serving ratio, edge cases with 0 and fractional values
- normalize.test.ts tests synonym resolution, unit alias normalization, case and hyphen variants
- convert.test.ts tests direct conversion, reverse lookup, two-hop chaining, density-based mass to volume, incompatible unit detection
- generate.test.ts tests full pipeline: determinism, consolidation across recipes, substitution application, pantry subtraction, warning generation, rounding

the engine is tested independently of the database. pure function in, result out.

---

## api endpoints

recipes:
- GET /api/recipes?search=&ingredient=
- POST /api/recipes
- PUT /api/recipes/:id
- DELETE /api/recipes/:id (returns 409 if used in future meal plan)

meal plans:
- GET /api/meal-plans?weekStart=
- POST /api/meal-plans (supports isLeftover, leftoverExpiryDate)
- PUT /api/meal-plans/:id
- DELETE /api/meal-plans/:id
- GET /api/meal-plans/leftovers

pantry:
- GET /api/pantry
- POST /api/pantry
- PUT /api/pantry/:id
- DELETE /api/pantry/:id

grocery:
- POST /api/grocery/generate (runs full engine pipeline)
- GET /api/grocery (supports section, uncheckedOnly, warningsOnly filters)
- PATCH /api/grocery/items/:id/check
- PATCH /api/grocery/items/:id/override
- PATCH /api/grocery/items/:id/already-have
- POST /api/grocery/items/ad-hoc
- DELETE /api/grocery/items/:id

substitutions:
- GET/POST/DELETE /api/substitutions
- GET/POST/DELETE /api/substitutions/constraints
- GET/POST/DELETE /api/substitutions/synonyms

ai (all optional):
- GET /api/ai/test
- POST /api/ai/suggest-recipes
- POST /api/ai/estimate-nutrition
- POST /api/ai/estimate-cost
- POST /api/ai/suggest-substitution
- POST /api/ai/weekly-plan

system:
- POST /api/reset (clear all data)
- POST /api/reseed (reload sample data)
- GET /api/health
- GET /api/analytics/summary

---

## state management

RTK Query handles all server state with auto-caching and tag-based invalidation:
- meal plan change invalidates MealPlan and GroceryList tags, triggering auto-refetch
- pantry change invalidates Pantry and GroceryList tags
- constraint change invalidates Constraints and GroceryList tags

this means when you change the meal plan, the grocery list automatically refetches without any manual code. all mutations use .unwrap() for proper error handling.

local UI state (modal visibility, form inputs, inline confirmations) uses component-scoped useState since it doesnt need global access.

---

## tradeoffs

Express over NestJS: faster to build under the time constraint. less boilerplate. NestJS would be better for a larger team with dependency injection needs.

Prisma over TypeORM: type-safe out of box, schema-first approach, cleaner migration story.

RTK Query over manual redux thunks: built-in caching + tag invalidation means less code and fewer bugs with stale data.

no auth: evaluators test grocery logic not JWT flows. adding auth is straightforward (add user_id foreign key to all tables + middleware).

overlay conflict strategy over overwrite + undo: predictable, user edits never lost, simpler mental model, no undo stack to manage.

density table approach: honest about limitations. explicitly warns when it cant convert rather than guessing wrong.

Railway MySQL free tier: easy hosted demo but has connection latency. for production would use PlanetScale or a dedicated instance.

pure function engine: testable independently of database, deterministic, easy to reason about edge cases.

---

## AI Usage

The app uses Gemini AI for optional features:
- Recipe suggestions based on pantry items
- Nutrition estimation from weekly meal plan
- Grocery cost estimation in INR
- Substitution suggestions
- Weekly plan generation

All core logic (scaling, conversion, consolidation, pantry subtraction, conflict resolution) is hand-written. The app works fully without AI. If Gemini is unavailable, everything falls back to hardcoded logic.

Package: @google/genai
Model: gemini-2.5-flash

---

## external libraries

- express: HTTP server
- @prisma/client + prisma: database ORM
- @reduxjs/toolkit: state management + RTK Query
- react-router-dom: client-side routing
- tailwindcss: styling
- recharts: dashboard charts
- @google/genai: Gemini AI (optional)
- cors: cross-origin requests
- dotenv: environment variables
- nodemon + ts-node: dev hot-reload
- jest + ts-jest: unit testing

---

## what i would improve with more time

- optimistic updates for instant check/uncheck feel (currently waits for server response)
- drag-and-drop meal planning
- websocket for real-time sync across devices
- recipe image upload instead of placeholders
- more ingredients in the density table (currently 11)
- mobile responsive layout improvements
- recipe import from URL (parse ingredient lists from blogs)
- undo/redo for meal plan changes

---

## future scope

these are features i want to build because they solve real problems i noticed while using the app:

### nutrition awareness
- per-meal nutrition badge showing calories and protein right on the meal card
- daily and weekly nutrition goals with progress tracking
- nutrition warnings when a day is unbalanced
- macro breakdown visualization (protein/carbs/fats ratio)
- dietary mode presets like keto, high-protein, balanced

### cost intelligence
- real-time price comparison across BigBasket, Zepto, Instamart, Amazon Fresh
- price history tracking to identify when items are cheaper
- budget mode that plans meals under a weekly budget target
- store routing to split grocery list by cheapest store per category
- bulk buy suggestions based on weekly consumption patterns
- currency settings supporting INR, USD, GBP

### food waste reduction
- expiry-first recipe suggestions prioritizing items about to expire
- waste tracking to learn what you overbuy
- smart quantity suggestions based on actual usage patterns
- leftover recipe chains (cook chicken monday, suggest fried rice tuesday)
- community leftover sharing for excess food

### recipe experience
- AI-generated step-by-step cooking instructions
- full-screen cooking mode with timers per step
- recipe images from Unsplash API based on recipe name
- parallel cooking scheduler showing optimal order for multiple dishes
- scaling warnings for recipes that dont scale linearly (like baking)
- recipe import from URL parsing ingredients from food blogs

### smart meal planning
- auto-plan generation respecting preferences, budget, and nutrition goals
- variety scoring to flag repetitive meals
- seasonal ingredient awareness for cheaper and fresher produce
- cuisine rotation ensuring mix throughout the week
- prep time optimization with batch cooking suggestions
- veg / egg / non-veg dietary tags and filters
- suggestions that include items not in pantry for more meaningful meals

### user experience
- authentication and multi-user households
- proper mobile responsive layout
- toast notifications instead of inline messages
- drag-and-drop meal planning
- dark mode
- keyboard shortcuts
- onboarding flow for first-time users

### collaboration
- shared household meal plans and grocery lists
- meal voting for family members
- grocery list splitting with assignment per person
- live sync for simultaneous shopping
- recipe sharing via link

### integrations
- Google Calendar sync for meal reminders
- one-click grocery delivery ordering from Zepto/BigBasket
- health app sync sending nutrition data to Google Fit
- receipt scanning to auto-update pantry quantities

the architecture supports all of this. the engine is pure functions so its easy to extend. the AI endpoints follow a consistent pattern. RTK Query's tag invalidation means adding new data sources works with the existing UI automatically.

---

## Demo Video

https://www.youtube.com/watch?v=DkaJRh1jgL8

---

## AI Used During Development

I used Kiro (AI coding agent) for writing code faster. It helped with boilerplate generation, repetitive UI components, and debugging. 
The architecture decisions, algorithm design, schema planning, and feature prioritization were done by me.

---

Built by Kotte Srisha, June 2026.
