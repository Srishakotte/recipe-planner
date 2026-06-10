# Recipe Planner + Grocery List

a meal planning app that lets you plan weekly meals, auto-generates a smart grocery list, handles unit conversions, pantry subtraction, substitutions and keeps everything in sync when plans change.

---

## important note for evaluators

**UI loading time:** the app uses Railway-hosted MySQL (free tier). first request after inactivity takes 3-5 seconds as the database wakes up. after that, all interactions are fast. RTK Query caches responses, so subsequent page visits are instant.

**meal plan / grocery updates:** when you change the meal plan (add/remove/swap meals, change servings), the grocery list regenerates automatically. this takes 1-2 seconds since it runs the full engine pipeline (scale → substitute → normalize → convert → consolidate → round → subtract pantry). please wait for the list to refresh — its doing real computation, not just a database fetch.

**for fastest evaluation:** run locally with Docker MySQL (instructions below). no cold start issues.

**sample data:** the app comes pre-seeded with 6 recipes, 10 pantry items, and 6 meal plan entries. want to explore with data? its already there. want a blank slate? click "🧹 Start Fresh" on the homepage. want sample data back? click "📦 Load Sample Data". no terminal commands needed for either.

**AI features:** require a Gemini API key (free from Google AI Studio). if you dont add one, the app works fully — all AI features fall back to smart hardcoded logic. the core engine has zero AI dependency.

---

## how i approached this

i spent the first few hours just **using** real meal planning apps to understand what they actually do well and where they fail:

**Mealime** — great UX for picking recipes, but no pantry management. if you already have onions at home, too bad — it still adds them to the list.

**Paprika** — excellent recipe management, but grocery consolidation is basic. if one recipe needs "1 cup milk" and another needs "250ml milk", it shows both separately. no unit conversion.

**AnyList** — good list management but completely disconnected from recipes. no concept of "this item came from this recipe". change your meal plan and the list doesnt update.

**Whisk** — closest to what i wanted to build. does consolidation and scaling. but substitution handling is non-existent, and if you edit the list manually, one meal plan change nukes everything.

**Mealboard** — has pantry subtraction! but expired items still get counted as "available" which is wrong.

so the gaps i identified:
1. **unit conversion** — nobody does it properly (mass↔volume especially)
2. **pantry subtraction with expiry awareness** — expired milk shouldnt count
3. **user edits surviving regeneration** — the "overlay" approach is the only correct solution
4. **substitution under constraints** — if someone is dairy-free, automatically replace milk with oat milk during list generation

i built the **grocery engine first** as pure functions, tested it with 42 unit tests, then wrapped everything else around it.

---

## tech stack

| layer | choice | reasoning |
|-------|--------|-----------|
| Frontend | React 18 + TypeScript | assignment requirement. strict mode enabled |
| State | Redux Toolkit + RTK Query | RTK Query gives me auto-caching + tag-based invalidation. when meal plan changes → grocery list auto-refetches. zero manual refetch code |
| Styling | Tailwind CSS | utility-first = fast iteration. consistent spacing/colors without a design file |
| Backend | Express + TypeScript | lightweight for the scope. same language as frontend = shared mental model |
| ORM | Prisma 5 | type-safe queries, declarative schema, clean migration story |
| Database | MySQL 8.0 (Railway) | assignment requirement. Railway gives free hosted MySQL for demo |
| Charts | Recharts | composable, lightweight, works with React without wrapper headaches |
| AI | Gemini 2.5 Flash | recipe suggestions, nutrition estimation, cost estimation. NOT used for core logic |

---

## setup instructions

### option A: local development (recommended for evaluation)

**prerequisites:** Node.js 18+, Docker Desktop

```bash
# 1. clone
git clone https://github.com/Srishakotte/recipe-planner.git
cd recipe-planner

# 2. start mysql via docker
docker compose up -d
# wait ~10 seconds for mysql to be ready

# 3. backend
cd backend
npm install
cp .env.example .env
# the default .env works with docker-compose — no edits needed
npx prisma generate
npx prisma db push --force-reset
npm run db:seed
npm run dev
# backend runs on http://localhost:3001

# 4. frontend (new terminal)
cd frontend
npm install
npm run dev
# frontend runs on http://localhost:3000

# 5. open http://localhost:3000
```

### option B: using Railway MySQL (already deployed)

if you want to use the hosted database instead of docker:

```bash
cd backend
cp .env.example .env
# edit .env — replace DATABASE_URL with Railway connection string:
# DATABASE_URL="mysql://root:YOUR_PASSWORD@YOUR_HOST:PORT/railway"
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

### .env configuration

```env
# database (docker default works out of the box)
DATABASE_URL="mysql://root:password@localhost:3306/recipe_planner"
PORT=3001

# AI (optional — everything works without this)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
```

> the app works **fully** without a Gemini API key. all AI features fall back to smart hardcoded suggestions. the core grocery engine is pure deterministic logic — no AI dependency whatsoever.

### running tests

```bash
cd backend
npm test
# runs 42 unit tests for the grocery generation engine
```

---

## database schema

11 tables. designed to separate concerns cleanly:

```
┌─────────────┐       ┌──────────────┐       ┌───────────────────┐
│   recipes   │──────→│  ingredients │       │ meal_plan_entries  │
│             │       │ (per recipe) │       │ (recipe+date+slot) │
└─────────────┘       └──────────────┘       └───────────────────┘
       │                                              │
       └──────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  GROCERY ENGINE    │ ← pure functions
                    │  (scale, convert,  │
                    │   consolidate,     │
                    │   subtract pantry) │
                    └─────────┬──────────┘
                              │
              ┌───────────────▼────────────────┐
              │      grocery_generations       │
              │  (versioned, input-hashed)      │
              └───────────────┬────────────────┘
                              │
              ┌───────────────▼────────────────┐
              │        grocery_items            │
              │ (checked, overrides, ad-hoc)    │
              └────────────────────────────────┘

Supporting tables:
  pantry_items ──→ subtracted during generation
  substitutions ──→ applied during generation
  user_constraints ──→ trigger substitutions
  ingredient_synonyms ──→ normalize names
  unit_conversions ──→ merge different units
  ingredient_densities ──→ mass↔volume bridge
```

key design decisions:
- `grocery_items` stores both the computed result AND the user overlay (overrideQty, isChecked, isAdHoc) — so regeneration can update the base while preserving user edits
- `grocery_generations` tracks version + inputHash — prevents unnecessary regeneration if nothing actually changed
- `ingredients` are per-recipe (not shared) — avoids complex many-to-many that makes editing harder
- `meal_plan_entries` has `isLeftover` + `leftoverExpiryDate` — leftovers skip grocery generation

---

## grocery generation engine

**this is the core of the entire project.** located in `backend/src/engine/`. all pure functions — no database calls inside, no side effects, fully deterministic (same input = same output every time).

### pipeline (7 steps)

```
INPUT: planned meals (recipe + servings) + pantry + constraints + substitution rules

Step 1: SCALE
  multiply each ingredient by (targetServings / defaultServings)
  e.g., Spaghetti Bolognese serves 4. you planned 2 → halve all ingredients.

Step 2: SUBSTITUTE
  check user constraints (dairy-free? vegetarian? no-peanuts?)
  for each ingredient: if constraint applies AND substitution rule exists → replace
    example: constraint=dairy-free, ingredient=milk → substitute with oat milk (ratio 1:1)
  if constraint applies but NO substitution exists → generate WARNING
    "⚠️ No substitute found for parmesan under dairy-free constraint"

Step 3: NORMALIZE NAMES
  apply synonym mapping: scallion → green onion, capsicum → bell pepper
  handles: spaces, hyphens, case variations
    Lady Finger = lady-finger = ladyfinger = bhindi → all become "okra"

Step 4: NORMALIZE UNITS
  standardize unit strings: tablespoons → tbsp, grams → g, cups → cup
  prevents "1 tablespoon" + "2 tbsp" from being treated as different units

Step 5: CONVERT + CONSOLIDATE
  group by canonical ingredient name
  within each group: try to convert all quantities to same unit
    volume↔volume: 500ml + 1 cup → 500ml + 240ml = 740ml
    mass↔mass: 200g + 0.5kg → 200g + 500g = 700g
    mass↔volume: 200g flour → 200/0.593 = 337ml (density-based)
  if conversion impossible → keep as separate lines + WARNING
    "⚠️ Unable to merge units: 2 piece garlic + 1 tsp garlic powder"

Step 6: ROUND
  human-friendly quantities (configurable strategy):
    nearest 0.5: 1.73 → 1.5, 2.26 → 2.5
    nearest whole: 1.73 → 2
  smart unit upgrade: 1500ml → 1.5L, 2000g → 2kg

Step 7: SUBTRACT PANTRY
  for each item: needQty - pantryQty = buyQty
  rules:
    - skip expired pantry items (expired milk ≠ available milk)
    - if pantry unit differs from recipe unit → convert first
    - if conversion fails → warning + show full needed qty
    - if buyQty ≤ 0 → item marked as "covered by pantry" (still shown, but marked)

OUTPUT: {
  items: [{ingredientName, computedQty, unit, storeSection, sourceRecipes, warnings}],
  warnings: string[],
  inputHash: string,  // for idempotency
  version: number
}
```

### unit conversion details

| type | method | example |
|------|--------|---------|
| volume↔volume | lookup table | 1 cup = 240ml, 1 tbsp = 15ml, 1 tsp = 5ml |
| mass↔mass | lookup table | 1 kg = 1000g, 1 lb = 453.6g, 1 oz = 28.35g |
| mass↔volume | density table | 200g flour ÷ 0.593 g/ml = 337ml |
| two-hop | chained lookup | cup → tbsp → ml (cup×16=tbsp, tbsp×15=ml) |
| incompatible | keep separate | "2 piece garlic" cant merge with "1 tsp garlic powder" → WARNING |

density values (from USDA FoodData Central + King Arthur Baking):
- flour: 0.593 g/ml
- sugar: 0.845 g/ml
- butter: 0.911 g/ml
- milk: 1.03 g/ml
- olive oil: 0.918 g/ml
- honey: 1.42 g/ml
- rice: 0.85 g/ml
- cream: 1.012 g/ml
- salt: 1.217 g/ml
- water: 1.0 g/ml
- vegetable oil: 0.92 g/ml

### conflict resolution strategy

i chose: **"regenerate base + apply user overlay"**

this is the only approach that gives predictable behavior. heres how it works:

```
┌─────────────────────────┐
│ GENERATED BASE          │  ← from engine (pure, deterministic)
│ scaled + converted +    │
│ consolidated + subtracted│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ USER OVERLAY            │  ← stored per-item in DB
│ - overrideQty (user     │
│   changed 500g → 750g)  │
│ - isChecked (user       │
│   bought this item)     │
│ - isAdHoc (user added   │
│   "paper towels")       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ FINAL DISPLAY           │  ← what user sees
│ base + overlay merged   │
└─────────────────────────┘
```

**rules:**
1. user override always wins, even after regeneration
2. checked state preserved by matching ingredientName + unit (not by ID)
3. ad-hoc items (user-added) are never touched by regeneration
4. if recipe removed from plan → its items removed from base, related overrides cleaned
5. input hash prevents unnecessary regeneration (same meal plan state → skip engine, return cached)

**why not "overwrite + undo"?**
- undo stack is complex to implement correctly
- users lose trust if their edits disappear even temporarily
- overlay approach means edits are NEVER lost, period

### async robustness / race condition handling

| scenario | how its handled |
|----------|----------------|
| rapid recipe swaps | RTK Query debounces: only latest mutation's invalidation matters |
| bulk week planning | each mutation invalidates tags, but RTK Query batches refetches |
| out-of-order updates | input hash idempotency: if final state matches cached → no regeneration |
| mid-shop regeneration | overlay preserves all checked/override state. user never loses progress |
| concurrent writes | Prisma transactions: generation writes items atomically. no partial state |

---

## leftover system

this was a stretch feature but i built it because every real meal plan has leftovers.

- past/current meals can be marked as leftover (🍱 button)
- expiry date picker (default: tomorrow)
- leftover meals skip grocery generation (ingredients already purchased)
- when adding new meals: shows available leftovers with remaining servings
- **serving cap enforced**: cant use 4 servings from a 2-serving leftover
- **dynamic tracking**: 4sv leftover → use 2sv → shows "2sv left". delete that meal → goes back to 4sv
- unmarking directly toggles off (no modal needed for unmark)
- expired leftovers auto-disappear from available list

### color coding in meal plan:
- 🟡 Yellow card = leftover source (past meal marked as leftover)
- ⬜ Grey card = leftover consumed (future meal using leftover servings)
- 🟢 Green card = normal planned meal
- Blurred/dimmed = past day (locked, only leftover toggle visible)

---

## features checklist

### core (all required features)
- [x] recipe CRUD with ingredients (qty, unit, name, displayName, store section)
- [x] meal plan week view with day + meal slot (breakfast/lunch/dinner/snack/anytime)
- [x] add/remove/swap recipes in plan
- [x] adjust servings per planned recipe (decrement to 0 = remove meal)
- [x] grocery list generation from meal plan (deterministic engine)
- [x] ingredient consolidation across all planned recipes
- [x] scaling by servings ratio
- [x] store section grouping (produce, dairy, meat, pantry, bakery, frozen, other)
- [x] pantry inventory (qty + unit + expiration date)
- [x] pantry subtraction (skips expired items)
- [x] unit conversion: volume↔volume, mass↔mass, mass↔volume via density
- [x] warning for unconvertible units
- [x] ingredient normalization (synonym mapping, case/hyphen handling)
- [x] human-friendly rounding (nearest 0.5, configurable)
- [x] substitution rules + dietary constraints (allergen, dietary, preference)
- [x] warning when no substitution exists for constrained ingredient
- [x] check off grocery items (persists across regeneration)
- [x] manual quantity edit / override (persists across regeneration)
- [x] add ad-hoc items (not from recipes, never removed by regeneration)
- [x] "already have" / move to pantry
- [x] conflict handling: overlay strategy (documented, deterministic)
- [x] async robustness (input hash idempotency, atomic writes, tag invalidation)
- [x] auto-regeneration on meal plan change
- [x] recipe search by name and ingredient
- [x] grocery list filters: unchecked only, store section, warnings
- [x] prevent deleting recipe used in future meal plan (409 error + user message)
- [x] loading states throughout (spinners, skeleton-like pulses)
- [x] empty states (helpful messages + action buttons when no data)

### stretch features
- [x] leftover system with expiry + dynamic remaining servings + serving cap
- [x] copy previous week meal plan
- [x] swap recipe button
- [x] dashboard with analytics charts
- [x] AI recipe suggestions from pantry items (Gemini)
- [x] AI nutrition estimation from actual weekly meal plan
- [x] AI grocery cost estimation in INR
- [x] smart unit display (1500ml → 1.5L, 2000g → 2kg)
- [x] pantry expiry warnings + grouped display (total/expiring/safe qty per item)
- [x] synonym management UI (add/remove synonyms)
- [x] CSV export (only items to buy)
- [x] start fresh + reload sample data (one-click from homepage)
- [x] inline delete confirmation (no browser popups)

---

## testing

42 unit tests in `backend/src/engine/__tests__/`:

```bash
cd backend && npm test
```

| file | what it tests |
|------|--------------|
| `scale.test.ts` | scaling quantities by serving ratio, edge cases (0 servings, fractional) |
| `normalize.test.ts` | synonym resolution, unit alias normalization, case/hyphen variants |
| `convert.test.ts` | direct conversion, reverse lookup, two-hop chaining, density-based mass↔volume, incompatible unit detection |
| `generate.test.ts` | full pipeline: determinism (same input→same output), consolidation across recipes, substitution application, pantry subtraction, warning generation, rounding |

the engine is tested **independently** of the database — pure function in, result out. this is intentional: i can change the database, the API, the frontend, and the engine tests still pass.

---

## api endpoints

```
# recipes
GET    /api/recipes?search=&ingredient=
POST   /api/recipes
PUT    /api/recipes/:id
DELETE /api/recipes/:id              # 409 if used in future meal plan

# meal plans
GET    /api/meal-plans?weekStart=
POST   /api/meal-plans               # supports isLeftover, leftoverExpiryDate
PUT    /api/meal-plans/:id
DELETE /api/meal-plans/:id
GET    /api/meal-plans/leftovers     # unexpired leftovers only

# pantry
GET    /api/pantry
POST   /api/pantry
PUT    /api/pantry/:id
DELETE /api/pantry/:id

# grocery
POST   /api/grocery/generate         # runs full engine pipeline
GET    /api/grocery?section=&uncheckedOnly=&warningsOnly=
PATCH  /api/grocery/items/:id/check
PATCH  /api/grocery/items/:id/override
PATCH  /api/grocery/items/:id/already-have
POST   /api/grocery/items/ad-hoc
DELETE /api/grocery/items/:id

# substitutions + constraints + synonyms
GET/POST/DELETE  /api/substitutions
GET/POST/DELETE  /api/substitutions/constraints
GET/POST/DELETE  /api/substitutions/synonyms

# ai (all optional — app works without these)
GET    /api/ai/test
POST   /api/ai/suggest-recipes
POST   /api/ai/estimate-nutrition
POST   /api/ai/estimate-cost
POST   /api/ai/suggest-substitution
POST   /api/ai/weekly-plan

# system
POST   /api/reset                    # clear all data
POST   /api/reseed                   # reload sample data
GET    /api/health
GET    /api/analytics/summary
```

---

## state management

```
RTK Query (server state):
  - auto-caching
  - tag-based invalidation:
      meal plan change → invalidates ['MealPlan', 'GroceryList'] → auto-refetch
      pantry change → invalidates ['Pantry', 'GroceryList'] → auto-refetch
      constraint change → invalidates ['Constraints', 'GroceryList'] → auto-refetch
  - all mutations use .unwrap() for error handling
  - no manual refetch() calls anywhere

Local state (useState):
  - modal visibility, form inputs, inline confirmation
  - component-scoped — doesnt need global store
```

---

## tradeoffs

| decision | why i chose this | what id change with more time |
|----------|-----------------|-------------------------------|
| Express over NestJS | faster to build in 4 days, less ceremony | NestJS for larger team with dependency injection |
| Prisma over TypeORM | type-safe, schema-first, better DX | fine as-is |
| RTK Query over manual thunks | built-in caching + invalidation = less code | fine as-is |
| No auth | evaluators test grocery logic, not JWT. trivially addable (user_id FK + middleware) | add NextAuth or Clerk |
| Overlay conflict strategy | predictable, user edits never lost | maybe add undo for "nice to have" |
| Density table approach | honest about limitations — warns when cant convert | crowdsource more densities |
| Railway MySQL free tier | easy demo deployment, but cold starts are slow | move to PlanetScale or dedicated instance |
| Pure function engine | testable, deterministic, no side effects | fine as-is, this is the correct approach |

---

## ai usage

**what AI does (suggestions only):**
- recipe suggestions based on actual pantry items
- nutrition estimation from actual weekly meal plan (sends real recipes + ingredients)
- grocery cost estimation in INR (sends real grocery list items)
- substitution suggestions with pantry awareness
- weekly plan auto-generation from existing recipes

**what AI does NOT do (core logic is hand-written):**
- scaling ← pure math
- unit conversion ← lookup tables + density math
- consolidation ← grouping + conversion logic
- pantry subtraction ← arithmetic with expiry check
- conflict resolution ← overlay merge algorithm
- synonym resolution ← exact-match lookup
- rounding ← configurable strategy function

the app works **100% without AI**. if Gemini is down, rate-limited, or you dont have an API key — every feature still works. AI is an enhancement layer, not a dependency.

**package used**: `@google/genai` (Google's newer GenAI SDK)
**model**: `gemini-2.5-flash` (auto-upgraded from deprecated `gemini-1.5-flash`)

---

## external libraries

| package | what for |
|---------|----------|
| express | HTTP server framework |
| @prisma/client + prisma | database ORM + schema management |
| @reduxjs/toolkit | state management + RTK Query for data fetching |
| react-router-dom | client-side routing |
| tailwindcss | utility-first CSS framework |
| recharts | dashboard visualization charts |
| @google/genai | Gemini AI SDK (optional) |
| cors | cross-origin request handling |
| dotenv | environment variable loading |
| nodemon + ts-node | development hot-reload |
| jest + ts-jest | unit testing framework |

---

## future scope

these arent random ideas — theyre features i actually want to build because they solve real problems i noticed while using the app myself and from feedback from friends who tested it:

### nutrition awareness (high priority — next thing id build)
the whole point of meal planning is eating better. right now the AI estimates nutrition on-demand, but what i want:
- **per-meal nutrition badge** — show calories/protein right on the meal plan card so you see it while planning
- **daily/weekly nutrition goals** — set a target (2000 cal/day, 100g protein) and see a progress bar
- **nutrition warnings** — "your Thursday has only 40g protein across all meals"
- **macro balance visualization** — pie chart per day showing protein/carbs/fats ratio
- **micronutrient tracking** — iron, calcium, vitamin D for people with deficiencies
- **dietary mode presets** — keto (high fat, low carb), high-protein, balanced — one click to set goals

### smart cost management
- **real-time price comparison** — pull prices from BigBasket, Zepto, Instamart, Amazon Fresh, JioMart
- **price history** — "onions are 30% cheaper this week than last month"
- **budget mode** — "plan my week under ₹1500" → AI picks cheapest recipes that meet nutrition goals
- **store routing** — "buy produce from local market, dairy from BigBasket" (split grocery list by store)
- **bulk buy suggestions** — "you use 2kg rice every week, buy 10kg bag saves ₹200/month"
- **currency settings** — support ₹ / $ / £ with automatic conversion

### food waste reduction (inspired by Too Good To Go & OLIO apps)
- **expiry-first recipe suggestions** — pantry items expiring tomorrow → suggest recipes using THOSE items first with a "Cook Now" flow
- **waste tracking** — mark items as "thrown away" → app learns what you overbuy
- **smart quantity suggestions** — "you always throw away half the spinach. buy 100g instead of 200g"
- **leftover recipe chains** — cook chicken monday → suggests chicken fried rice for tuesday
- **community leftover sharing** — mark excess food as available for neighbors
- **food waste score** — monthly report showing how much you saved vs wasted

### recipe experience (inspired by Tasty & Cookpad)
- **AI-generated step-by-step cooking instructions** — for recipes that only have ingredient lists
- **full-screen cooking mode** — large text, timers per step, voice control ("next step")
- **recipe image from Unsplash API** — auto-fetch appetizing food photos based on recipe name
- **parallel cooking scheduler** — planning 3 dishes? shows optimal order (start rice first, its passive)
- **technique videos** — link to common techniques embedded in steps
- **scaling warnings** — "baking time changes at 2x — adjust from 30min to 45min"
- **equipment checklist** — "you need: large pot, blender, baking sheet" shown before cooking
- **recipe import from URL** — paste a blog link → AI parses ingredients and steps automatically

### smart meal planning (inspired by Eat This Much & PlateJoy)
- **auto-plan generation** — "fill my week" respecting preferences, budget, nutrition goals
- **variety scoring** — flags if you're eating same protein 4+ days in a row
- **seasonal ingredient awareness** — prefer whats in season = cheaper + fresher + better taste
- **cuisine rotation** — ensure mix of Indian/Italian/Asian/Mexican throughout the week
- **prep time optimization** — "Sunday batch cook: rice + dal + marinades. Mon-Wed: assemble only (15min)"
- **family preference learning** — track which meals get repeated vs swapped (= liked vs disliked)
- **dietary tags** — veg / egg / non-veg / vegan filters on recipes and plan
- **not just pantry items** — AI suggests recipes using pantry + minimal additional purchases

### user experience polish
- **authentication + multi-user** — family members each have their own preferences
- **mobile responsive** — proper mobile layout (swipe between days, bottom sheet modals)
- **toast notifications** — slide-in notifications instead of any browser alerts
- **drag-and-drop** meal planning (react-beautiful-dnd)
- **dark mode** — for late-night meal planning
- **undo/redo** — for meal plan changes
- **keyboard shortcuts** — power users can navigate without mouse
- **onboarding flow** — first-time user gets a guided tour

### collaboration & sharing (inspired by AnyList & OurGroceries)
- **shared household** — roommates/family see same plan, split grocery list
- **meal voting** — family members vote on proposed meals for the week
- **recipe sharing** — share via link, import from friends
- **grocery list splitting** — "you buy produce section, i buy dairy" with assignment
- **live sync** — cross off items in real-time while both people shop simultaneously
- **comments on meals** — "loved this one, make again!" or "too spicy, reduce chili"

### integrations
- **calendar sync** — show meals in Google Calendar / Apple Calendar
- **grocery delivery** — one-click order from Zepto/BigBasket/Instamart/Swiggy Instamart
- **smart fridge** — auto-update pantry from fridge camera (IoT future)
- **voice control** — "add eggs to pantry" via Google Assistant / Alexa
- **health app sync** — send nutrition data to Google Fit / Apple Health / MyFitnessPal
- **receipt scanning** — take photo of grocery receipt → auto-update pantry quantities

the architecture supports all of this — the engine is pure functions (easy to extend), the AI endpoints follow a consistent pattern (prompt → parse → fallback), and RTK Query's tag invalidation means adding new data sources "just works" with the existing UI refresh mechanism.

---

## commit history

i kept commits small and frequent. the history shows the progression:
1. engine first (pure functions + tests)
2. API routes wrapping the engine
3. basic UI (CRUD)
4. advanced features (leftover system, pantry grouping, AI integration)
5. polish (inline confirmations, error handling, loading states)

---

*built from scratch by Kotte Srisha | June 2026*
*no template repos, no starter kits — just express + react + the grocery engine i'm proud of*
