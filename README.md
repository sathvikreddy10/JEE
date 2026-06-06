# Testify — JEE/NEET Practice Platform

A free, self-hosted test platform for JEE/NEET aspirants with per-test leaderboards, daily challenges, and JEE Advanced partial marking.

## Architecture

```
testify/
├── apps/
│   ├── frontend/   Next.js 16 (App Router) — UI only, no DB
│   └── backend/    Express + ws + Prisma — API + WebSocket
└── shared/         Shared TypeScript types
```

The frontend never queries the database directly. All `/api/*` requests are rewritten by Next.js to `http://localhost:4000/*`. The two apps can be deployed independently (Vercel + Railway/Render).

## First-time setup

```bash
# 1. Install root + workspace deps
npm install

# 2. Set up backend (Prisma client + SQLite + seed data)
cd apps/backend
npm install
npx prisma generate
npx prisma db push --accept-data-loss
npx prisma db seed
cd ../..

# 3. Set up frontend
cd apps/frontend
npm install
cd ../..
```

> Note: if `npx prisma` commands error with `EPERM` on Windows, stop any running Node processes first:
> `Get-Process node | Stop-Process -Force`

## Development

From the workspace root:

```bash
npm run dev
```

This starts both apps via `concurrently`:
- Backend → http://localhost:4000
- Frontend → http://localhost:3000

To run them separately:

```bash
npm run dev:be   # backend only
npm run dev:fe   # frontend only
```

## Demo accounts (seeded)

| Email | Password |
| --- | --- |
| `sathvik@testify.app` | `password123` |
| `arjun@testify.app` | `password123` |
| `priya@testify.app` | `password123` |

## Environment

### `apps/backend/.env`
```
PORT=4000
DATABASE_URL=file:./prisma/dev.db
FRONTEND_URL=http://localhost:3000
SESSION_COOKIE=testify_session
SESSION_TTL_DAYS=30
```

### `apps/frontend/.env.local`
```
BACKEND_URL=http://localhost:4000
```

## Deploy

- **Frontend** → Vercel (root: `apps/frontend`, build: `next build`)
- **Backend** → Railway / Render / Fly.io (root: `apps/backend`, start: `node dist/server.js`)
- **Database** → Postgres in prod (swap `provider` to `postgresql` in `schema.prisma` and re-run `prisma db push`)

## Roadmap

- [x] Auth (email + password, bcryptjs, cookies)
- [x] Per-test leaderboards
- [x] Multi-user data isolation
- [ ] JEE Advanced partial-marking engine
- [ ] Live proctoring via WebSocket (tab switches, flagged events)
- [ ] Phone OTP login
