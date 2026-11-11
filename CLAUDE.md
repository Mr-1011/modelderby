# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Agent Derby (working name `horserace`) is a benchmark you can bet on. 6 to 8 LLM agents ("horses") race through the same escape room: 5 locks in a sandbox file system. Each horse runs in its own Archil sandbox, forked from one base. The audience bets Oats (play credits, no real money) on Win and Place while the race runs. Built at the Archil hackathon on 2026-11-10.

The brief holds the full spec, the locked decisions, the odds formulas and the time plan: https://app.notion.com/p/4147918a03d28195b7feef87143f0455

Where this repo and the brief differ, the repo is right:

- The frontend is Vite + React, not Next.js. Env variables start with `VITE_`, not `NEXT_PUBLIC_`.
- The folders are `frontend/`, `backend/` and `shared/`. The brief calls them `apps/web`, `apps/runner` and `packages/shared`.
- The package manager is pnpm, not npm.
- `endpoint_url` of a submitted horse is in `horse_secrets`, not in `horses`, and `api_key` is optional. No client can read either.

## Current state (2026-11-10)

This is a skeleton. It has three placeholder pages, a backend with only `GET /health`, and the tables with row level security. Not built yet: the race runner loop, the functions `place_bet` and `settle_race`, login, the odds and finish order maths, the challenge pool. Update this section when that changes.

## Repository layout

One git repo and one pnpm workspace (`pnpm-workspace.yaml`).

- `frontend/`: Vite, React, TypeScript, Tailwind v4, react-router. Hosted on Vercel.
- `backend/`: the race runner, one long-lived Node process. Hosted on Railway.
- `backend/supabase/`: migrations and config. Run `supabase` commands from `backend/`.
- `shared/`: the package `@horserace/shared`. It holds the row types and `APP_NAME`, and it is the place for the maths that both sides need (odds, payouts, finish order). Both sides import its TypeScript source. It has no build step.
- `pool/`: the private challenge pool (seeded `setup.py`, `check.sh`, `solve.py` per room). Git ignores it. Its content must never reach `frontend/`, a commit, a log line or an API response.

Several agents work in this repo at the same time. Stage only the files you changed, by name. Commit each finished unit of work as one small commit. Messages follow `type: sentence`, for example `feat: show live odds on the horse cards`.

## Commands

Run from the repo root:

```
pnpm install
pnpm --filter horserace-frontend dev      # http://localhost:5173
pnpm --filter horserace-frontend build    # type check, then production build
pnpm --filter horserace-backend dev       # http://localhost:8080/health, restarts on a change, reads backend/.env
pnpm --filter horserace-backend build     # type check only
pnpm --filter horserace-backend start     # the command that Railway runs
```

Run from `backend/`:

```
export SUPABASE_DB_PASSWORD=$(grep '^SUPABASE_DB_PASSWORD=' .env | cut -d= -f2)
supabase db push --dry-run    # shows the migrations that are not on the hosted database
supabase db push              # applies them
```

The hosted Supabase project is `horserace`, ref `kqpkcmcehcdipshlirzi`, region us-west-1. A fresh clone needs `supabase link --project-ref kqpkcmcehcdipshlirzi` first. Minutes after a project is created, `db push` can time out. Try again.

Development uses the hosted project. The local stack (`supabase start`) uses the default ports, and the Hypemarket stack on this machine uses the same ports.

There is no linter and no test suite.

## Environment

- `frontend/.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_GOOGLE_CLIENT_ID`, `VITE_RUNNER_URL`. See `frontend/.env.example`.
- `backend/.env`: `ARCHIL_API_KEY`, `ARCHIL_REGION`, `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KEENABLE_API_KEY`. See `backend/.env.example`. `SUPABASE_DB_PASSWORD` is also there, only for the Supabase CLI.

All models run through OpenRouter. Never use a direct Anthropic key.

## Architecture

**Data flow**
- The frontend has no API server for data. It reads Supabase directly with the publishable key and subscribes to Realtime on `races`, `entries`, `bets` and `odds_snapshots`.
- Clients have `select` only. Row level security and revoked grants block all direct writes. A player changes state only through a `security definer` Postgres function (`place_bet`, not built yet).
- The backend writes with the service role key. It also serves a small HTTP API for the frontend (`VITE_RUNNER_URL`): `GET /health` now, `POST /horses` later.
- `horse_secrets`, `challenge_secrets` and `race_secrets` have row level security on, no policy and no grant. Only the service role reads them.
- Odds are pari-mutuel and computed on read from `bets`. Put that maths in `shared/`, so the frontend and the backend give the same numbers.

**Race** (not built, see the brief, section 3)
- The model runs outside the sandbox. The backend sends each bash command of the model to the fork of that horse.
- After each command the backend runs its own copy of the checker. The copy inside the room is only for the agent.
- The room is generated at race start from a fresh seed. Seeds, generators and answers stay on the backend and on the Archil disk until the race is settled.

**Backend TypeScript**
- Node runs the `.ts` files directly (type stripping), so Node 22.18 or newer is necessary.
- A relative import needs the `.ts` extension. A type-only import needs `import type`. Enums and constructor parameter properties do not work.
- `tsc` reports all three (`backend/tsconfig.json`). The same rules apply to `shared/`, because the backend imports its source.

**Frontend**
- Routes are in `frontend/src/App.tsx`: `/` is the phone view, `/board` is the big screen (1920x1080), `/submit` is the form for a user's own model.
- All colors and fonts are theme tokens in `frontend/src/index.css`. Do not hardcode them in components.
- The public name is not decided. It is `APP_NAME` in `shared/src/index.ts`, which also sets the document title. Change it only there.
- Design bar from the brief: clean, generous padding, plain text labels, flat colors, no pill badges, no colored shadows, no tilted images, nothing cropped. Exactly one chart: the Win odds over time.
- `frontend/vercel.json` sends every path to `index.html`, so a reload on `/board` works.

## Changing the schema

- Add a new migration file. Do not edit a migration that is on the hosted database.
- `shared/src/types.ts` is handwritten. Update it with the schema.
- A new table needs row level security, a policy if clients read it, and explicit grants. Follow the pattern at the end of `backend/supabase/migrations/20261110190000_schema.sql`.

## Deploy

- Vercel: the project root directory is `frontend`. Vercel installs from the workspace root.
- Railway (not set up yet): repo root, build `pnpm install --frozen-lockfile && pnpm --filter horserace-backend build`, start `pnpm --filter horserace-backend start`. Do not put the runner in a Vercel function: a race is longer than 4 minutes and needs open connections.

## Open decisions

- Login: the brief has two ways in (QR code + nickname with an anonymous Supabase session, and Google). The user later said "probably only Google". Ask before building login.
