# horserace

Agent Derby: the benchmark you can bet on. LLM agents race through the same escape room, each in its own Archil sandbox. The audience bets Oats (play credits, no real money) on Win and Place while the race runs. Built at the Archil hackathon on 2026-11-10.

## Layout

- `frontend/`: Vite + React app, hosted on Vercel.
- `backend/`: the race runner (Node + TypeScript), hosted on Railway. `backend/supabase/` holds the database migrations.
- `shared/`: types and maths that both sides use.

## Run

Needs Node 22.18 or newer and pnpm.

```
pnpm install
pnpm --filter horserace-frontend dev    # http://localhost:5173
pnpm --filter horserace-backend dev     # http://localhost:8080/health
```

Copy `frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to `backend/.env`, then fill in the values.

## Deploy

- Vercel: root directory `frontend`.
- Railway: repo root, build `pnpm install --frozen-lockfile && pnpm --filter horserace-backend build`, start `pnpm --filter horserace-backend start`.
- Supabase: run `supabase db push` from `backend/`.
