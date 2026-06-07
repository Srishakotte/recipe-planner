# Recipe Planner + Grocery List

A full-stack meal planning application that enables users to plan weekly meals, generate a consolidated grocery list with smart pantry subtraction, handle unit conversions, ingredient normalization, substitutions under dietary constraints, and persist user overrides across regenerations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Redux Toolkit (RTK Query) + Tailwind CSS |
| Backend | Express.js + TypeScript |
| ORM | Prisma 5 |
| Database | MySQL 8.0 |
| Dev Tools | Vite, Docker Compose, Nodemon |

## Quick Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd recipe-planner
cd backend && npm install
cd ../frontend && npm install
cd ..

# 2. Start MySQL
docker compose up -d

# 3. Configure database
cd backend
cp .env.example .env
npx prisma migrate dev --name init
npm run db:seed

# 4. Start development
cd ..
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              React Frontend (Vite)                    │
│   Redux Toolkit (RTK Query) + Tailwind CSS          │
└──────────────────────┬──────────────────────────────┘
                       │ REST API via /api proxy
                       ▼
┌─────────────────────────────────────────────────────┐
│             Express.js Backend                        │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  REST Routes │    │  Grocery Generation       │   │
│  │  (CRUD)      │    │  Engine (Pure Functions)  │   │
│  └──────────────┘    └──────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │         Prisma ORM → MySQL 8.0               │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Grocery Generation Engine

Located in `backend/src/engine/`. Pure functions, no side effects, deterministic.

### Pipeline

```
Step 1: SCALE — multiply ingredients by (targetServings / defaultServings)
Step 2: SUBSTITUTE — apply substitution rules for active constraints
Step 3: NORMALIZE NAMES — resolve synonyms (scallion → green onion)
Step 4: NORMALIZE UNITS — standardize (tablespoons → tbsp)
Step 5: CONVERT + CONSOLIDATE — merge same ingredients, convert units
Step 6: ROUND — human-friendly rounding (nearest 0.5)
Step 7: SUBTRACT PANTRY — need 3, have 1, buy 2
```

### Unit Conversion

| Type | Method |
|------|--------|
| Volume ↔ Volume | Direct lookup (tsp→ml→cup) |
| Mass ↔ Mass | Direct lookup (g→kg→lb) |
| Mass ↔ Volume | Via density table |
| Incompatible | Keep separate + warning |

### Conflict Resolution (Overlay Strategy)

- Generated list = base truth
- User overrides stored separately, re-applied on regeneration by matching ingredientName + unit
- Checked state preserved across regenerations
- Ad-hoc items never removed by regeneration
- Input hash prevents unnecessary regeneration

## API Endpoints

- `GET/POST /api/recipes` — CRUD + search
- `GET/POST/PUT/DELETE /api/meal-plans` — weekly planning
- `GET/POST/PUT/DELETE /api/pantry` — inventory
- `POST /api/grocery/generate` — trigger generation
- `GET /api/grocery` — fetch list with filters
- `PATCH /api/grocery/items/:id/check|override|already-have`
- `POST /api/grocery/items/ad-hoc`
- `GET/POST/DELETE /api/substitutions`
- `GET/POST/DELETE /api/substitutions/constraints`

## Tradeoffs

| Decision | Rationale |
|----------|-----------|
| Express over NestJS | Faster to build under time constraint |
| Prisma over TypeORM | Type-safe, clean migrations |
| RTK Query | Built-in caching + tag invalidation |
| No auth | Zero domain signal, trivially addable later |
| Overlay strategy | Predictable, user overrides always win |

## AI Usage

- Claude used for: schema design iteration, seed data, boilerplate scaffolding
- All core logic hand-designed: generation pipeline, unit conversion, conflict resolution
- All AI code reviewed and modified

## External Libraries

Express, Prisma, @reduxjs/toolkit, react-router-dom, tailwindcss, cors, dotenv
