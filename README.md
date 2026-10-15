# Production Tracker — Manufacturing Process Tracking Prototype

Track production orders through a fixed sequence of steps (e.g. Material Preparation → 3D Printing →
CNC Finishing → Quality Inspection → Sterile Packaging), see what is in progress at each step, and see
how materials, machine time, and labour are used as the work moves forward.

| Layer    | Tech                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query (server state), Zustand (UI state), React Router, Recharts |
| Backend  | NestJS 12, TypeORM, PostgreSQL 16, class-validator, Swagger                         |
| Tests    | Vitest unit tests for the workflow rules                                           |

See **[SUMMARY.md](SUMMARY.md)** for the written summary: requirements, functional spec, design,
user manual, and how AI tools were used.

## Run locally

Prerequisites: **Node.js 20+** (tested with Node 22) and **Docker**.

```bash
# 1. Database (PostgreSQL in Docker, exposed on host port 5433)
docker compose up -d

# 2. Backend API: http://localhost:3000/api, Swagger docs at /api/docs
cd backend
cp .env.example .env        # defaults already point at the docker database
npm install
npm run seed                # creates the schema and loads demo data (resets the DB)
npm run start:dev

# 3. Frontend: http://localhost:5173 (in a second terminal)
cd frontend
npm install
npm run dev
```

The Vite dev server forwards `/api` to `http://localhost:3000`. If you skip the seed, the app starts
empty and you can set up steps and resources under **Process setup** and **Resources**.

### Useful commands

| Where      | Command            | What it does                                         |
| ---------- | ------------------ | ---------------------------------------------------- |
| `backend`  | `npm test`         | Unit tests for the transition and validation rules   |
| `backend`  | `npm run seed`     | Reset the database and reload the demo data          |
| `backend`  | `npm run build`    | Compile to `dist/` (`npm run start:prod` to run it)  |
| `frontend` | `npm run build`    | Type-check and build the production bundle           |

### Configuration (`backend/.env`)

| Variable         | Default                                            |
| ---------------- | -------------------------------------------------- |
| `DATABASE_URL`   | `postgres://mfg:mfg@localhost:5433/mfg_tracker`     |
| `PORT`           | `3000`                                             |
| `DB_SYNCHRONIZE` | `true`: the schema is derived from the entities (prototype setting) |
| `CORS_ORIGIN`    | allow all origins                                  |

## Project layout

```
docker-compose.yml          PostgreSQL
backend/src
  workflow/                 transition.rules.ts (pure rules + tests), workflow.service.ts (transactional advance/cancel)
  orders/                   orders, step logs (route history), order events (audit trail)
  steps/                    process steps + per-step resource requirements
  resources/                resources + stock ledger (consume / restock / adjust)
  dashboard/                board + overview aggregates
  database/                 TypeORM config, seed script
frontend/src
  api/                      axios client, types, TanStack Query hooks (query keys + invalidation)
  store/ui.ts               Zustand store: dialogs, filters
  components/               layout, UI primitives, workflow dialogs (create / advance / cancel)
  pages/                    Overview, Production board, Orders, Order detail, Resources, Process setup
```

## API overview

| Method | Path                                 | Purpose                                            |
| ------ | ------------------------------------ | -------------------------------------------------- |
| GET    | `/api/dashboard`                     | Counts by status, load per step, bottleneck, stock, activity |
| GET    | `/api/board`                         | Queue, one lane per step, recently completed       |
| GET/POST | `/api/orders`                      | List (filter by status, step, or search, paginated) / create |
| GET/PATCH/DELETE | `/api/orders/:id`          | Detail with route, consumption, and events / edit or delete (pending only) |
| GET    | `/api/orders/:id/next`               | Dry run: next step, resources needed, blockers     |
| POST   | `/api/orders/:id/advance`            | Move one step forward (`{ expectedStepId }` guards against stale screens) |
| POST   | `/api/orders/:id/cancel`             | Cancel with a reason                               |
| GET/POST/PATCH/DELETE | `/api/steps…`         | Manage steps; `PUT /steps/reorder`, `PUT /steps/:id/requirements` |
| GET/POST/PATCH/DELETE | `/api/resources…`     | Manage resources; `POST /:id/restock`, `POST /:id/adjust`, `GET /resources/transactions` |

Business rule violations return **409 Conflict** with a readable message (for example
`"Quality Inspection" is at full capacity (2/2 orders).`). Invalid input returns **400**.
