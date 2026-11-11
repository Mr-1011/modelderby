# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Agent Derby (working name `horserace`) is a live model benchmark that the audience can bet on. 6 to 8 LLM agents ("horses") race through the same escape room: 5 locks in a sandbox file system. Each horse runs in its own Archil sandbox. The audience bets Oats (play credits, no real money) on Win and Place from their phones while the race runs. Built at the Archil hackathon on 2026-11-10.

Spec and locked decisions: https://app.notion.com/p/Agent-Derby-Brief-Archil-Hackathon-4147918a03d28195b7feef87143f0455

The spec is ahead of the code. Most of the architecture below is not built yet, so check the code before you rely on a part. Section 2 of the spec lists the locked decisions (race rules, markets, the 3-minute limit, the UI rules). Do not change them without asking. The spec still describes a Next.js app in `apps/` with npm workspaces. The layout and commands in this file are the current ones.

## Repository layout

One git repo and one pnpm workspace with three packages:

- `frontend/`: Vite, React, TypeScript, Tailwind v4, React Router. Hosted on Vercel with root directory `frontend`.
- `backend/`: the race runner, a long-lived Node process. Hosted on Railway. `backend/supabase/` holds the Supabase config and the migrations.
- `shared/`: the row types and the app name, used by both. The Win and Place odds and payout maths also go here.
- `pool/` (git-ignored, never commit it): the private challenge pool with generators, checkers and answers.

`README.md` is for public readers. Update it when setup, commands or behavior change.

Several agents work in this repo at the same time. Stage only the files you changed, by name. Commit each finished unit of work as one small commit with a message like `feat: show live odds on the horse cards`. Never amend or rebase a commit, because another agent can push it at any time. Add a new commit instead. Run `git status -sb` before a commit to see if `main` is behind `origin/main`.

## Commands

Run `pnpm install` once at the root.

Run from `frontend/`:

```
pnpm dev                 # dev server
pnpm build               # type check, then production build
pnpm exec tsc --noEmit   # type check only
```

Run from `backend/`:

```
pnpm dev     # runner in watch mode, reads backend/.env
pnpm start   # runner without watch mode, does NOT read .env (Railway sets the variables)
pnpm build   # type check only, there is no compile step
```

The runner listens on `PORT` (default 8080). `GET /health` answers `{"ok":true}`.

Run Supabase CLI commands from `backend/`. The hosted project is `horserace` (ref `kqpkcmcehcdipshlirzi`, region us-west-1), and `backend/.env` holds `SUPABASE_DB_PASSWORD` for the CLI. To apply new migrations:

```
export SUPABASE_DB_PASSWORD=$(grep '^SUPABASE_DB_PASSWORD=' .env | cut -d= -f2)
supabase db push --dry-run   # lists the migrations that are not on the hosted database
supabase db push
```

A fresh clone needs `supabase link --project-ref kqpkcmcehcdipshlirzi` first. The first migration is on the hosted database, so add a new migration file for each change.

`supabase config push` writes `backend/supabase/config.toml` to the hosted project. When an agent runs it, the CLI answers its own prompt with yes, so there is no dry run by default. To see the diff only:

```
echo n | supabase config push --agent no
```

The runner image is the `Dockerfile` at the repo root, and the build context is the repo root. The Railway project does not exist yet.

The frontend is live at https://horserace-snowy.vercel.app. The Vercel project is `horserace` in the team `fluid-labs`, with root directory `frontend`. It has no Git connection yet, so a push does not deploy. Deploy from the repo root:

```
pnpm dlx vercel deploy --prod --scope fluid-labs
```

`vercel link` appends `.env*` to `.gitignore` and writes a root `.env.local`. Undo both, because that line hides the `.env.example` files.

There is no linter and no test suite.

## Architecture

The three parts talk through Supabase:

- The frontend reads Supabase directly and subscribes to Realtime on `races`, `entries`, `bets` and `odds_snapshots`. Its routes are in `src/App.tsx`: `/` is the phone view (join, horse cards, bet slip), `/board` is the big screen at 1920x1080, and `/submit` is the form to enter your own model.
- The runner owns the race state machine. For each race it forks one Archil sandbox per horse from a prepared base and runs one agent loop per horse: OpenRouter chat completions with one `bash` tool, and each command runs in the fork of that horse. After every tool call the runner runs its own copy of the checker and writes the progress to `entries`. It writes logs, diffs and final room states to the Archil disk `derby`. It is the only writer of race data and uses the service role key.
- Postgres keeps the Oats balances consistent. Clients have select rights only. A bet goes through the function `place_bet`, and the runner pays out through `settle_race`. These two functions are not in the migration yet.

One path does not go through Supabase: `/submit` posts to the runner (`POST /horses` at `VITE_RUNNER_URL`), because the runner must test the endpoint and store the API key.

Rules that hold across files:

- Hidden challenges: a client may only ever get `challenges.category` and `challenges.public_blurb`. Generators, seeds and expected answers stay in `pool/`, on the Archil disk and in the secrets tables. They never go into `frontend/`, a tracked path, a log line, an API response or a horse sandbox. The seed becomes public only after settle, in `races.seed_revealed`.
- `horse_secrets`, `challenge_secrets` and `race_secrets` have row level security with no policy and no grant, so only the service role reads them. Put a new secret value in a table like these, never in a client-readable table.
- The spec puts `endpoint_url` in `horses`. Here it is in `horse_secrets`, and `api_key` is optional, so no client can read the endpoint of a submitted horse.
- `shared/src/types.ts` is handwritten. Update it when the schema changes.
- Node runs the backend `.ts` files directly, and `shared` is imported as source. So `backend/` and `shared/` can use only erasable TypeScript syntax (no enums, no parameter properties), and a relative import needs the `.ts` extension.
- The public name is not decided. It is `APP_NAME` in `shared/src/index.ts`. Do not hardcode the name in another place.
- The database column is `players.credits`, but the UI always says "Oats".
- All horses run through OpenRouter (`OPENROUTER_API_KEY`). Never use a direct Anthropic key.
- Odds are pari-mutuel and are computed on read from `bets`. The runner also writes `odds_snapshots` every 5 s, but only for the odds chart.

## UI rules

- All colors and fonts are theme tokens in the `@theme` block of `frontend/src/index.css`. Do not hardcode them in a component.
- Horse cards are the main element. There is exactly one chart: a line chart of the Win odds over time. No other chart, no progress bar, no race track.
- No pill badges, no coloured shadows, no tilted images, nothing cropped. Flat colours only. Padding is at least 24 px on board cards and 16 px on the phone.
- Before and during a race, show a lock only as its category and its blurb.
