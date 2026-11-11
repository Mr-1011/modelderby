# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Model Derby (domain modelderby.com) is a live model benchmark that the audience can bet on. 6 to 8 LLM agents ("horses") race through the same escape room: 5 locks in a sandbox file system. Each horse runs in its own Archil sandbox. The audience bets Oats (play credits, no real money) on Win and Place from their phones while the race runs. Built at the Archil hackathon on 2026-11-10.

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
yes n | supabase config push --agent no   # one "n" for each service that has a diff
```

The runner image is the `Dockerfile` at the repo root, and the build context is the repo root. The Railway project does not exist yet.

The frontend is live at https://horserace-snowy.vercel.app. The Vercel project is `horserace` in the team `fluid-labs`, with root directory `frontend`. It has no Git connection yet, so a push does not deploy. Deploy from the repo root:

```
pnpm dlx vercel deploy --prod --scope fluid-labs
```

`vercel link` appends `.env*` to `.gitignore` and writes a root `.env.local`. Undo both, because that line hides the `.env.example` files.

There is no linter. The tests are small and run alone:

```
node --test shared/src/odds.test.ts      # the odds maths
node --test backend/src/finish.test.ts   # the finish order
# From backend/: the betting functions, on the hosted database, in a transaction that rolls back.
PGPASSWORD=$SUPABASE_DB_PASSWORD psql "host=aws-1-us-west-1.pooler.supabase.com port=5432 user=postgres.kqpkcmcehcdipshlirzi dbname=postgres sslmode=require" -v ON_ERROR_STOP=1 -f supabase/test_bets.sql
```

## Architecture

The three parts talk through Supabase:

- The frontend reads Supabase directly, and all of that access is in `src/lib/queries.ts`: `useRaces` for the lists, and `useRace(id)` for one live race, which reloads on Realtime events of `races`, `entries` and `bets`. Its routes are in `src/App.tsx`: `/` is the race list (tabs Popular and Latest), `/race/:id` is one race (`pages/RacePage.tsx` gives live data to `PhoneView`, then the odds chart and the result), `/arena` lists the open races where a player can enter a model, `/leaderboard` ranks the players by Oats, `/admin` lets an admin start an open race by hand (no nav link), and `/board` is the big screen at 1920x1080.
- The runner owns the race state machine. For each race it forks one Archil sandbox per horse from a prepared base and runs one agent loop per horse: OpenRouter chat completions with one `bash` tool, and each command runs in the fork of that horse. After every tool call the runner runs its own copy of the checker and writes the progress to `entries`. It writes logs, diffs and final room states to the Archil disk `derby`. It is the only writer of race data and uses the service role key. It keeps 3 open races. Run exactly one runner: two runners run each race twice. At boot the runner deletes all `derby-r*` sandboxes and settles each `running` race, so a restart during a race cuts that race short.
- Postgres keeps the Oats balances consistent. Clients have select rights only. A new Google user gets a `players` row with 1,000 Oats from the trigger `handle_new_user`. A bet goes through the function `place_bet`, a player enters a model through `enter_model`, the runner opens a race with `open_race` (house horses plus the house seed bets) and pays out through `settle_race`. They are in `migrations/20261110200000_betting.sql`.

The product model: one race is one "challenge" for the player, with a room, a lineup and two markets (Win and Place). A player enters a model as an OpenRouter model id only (`enter_model`). There are no custom endpoints and no API keys of players: every model runs on our OpenRouter key, so `horse_secrets` is not in use and the frontend does not call the runner.

The start rules (`migrations/20261110210000_start_rules.sql`, they replace the pool and countdown rule of the spec): the runner starts only a race with `races.ready = true`. The database sets `ready` when the first player bets or enters a model, and it then gives the race a countdown of at least 60 seconds. So a race with `ready = false` waits, also after its countdown, and no race runs without a player. An admin (a row in `admins`, added by SQL with the service role) starts a race in 20 seconds with `start_race`. A player bets on one horse per race, on Win, on Place or on both.

Rules that hold across files:

- Hidden challenges: a client may only ever get `challenges.category` and `challenges.public_blurb`. Generators, seeds and expected answers stay in `pool/`, on the Archil disk and in the secrets tables. They never go into `frontend/`, a tracked path, a log line, an API response or a horse sandbox. The seed becomes public only after settle, in `races.seed_revealed`.
- `horse_secrets`, `challenge_secrets` and `race_secrets` have row level security with no policy and no grant, so only the service role reads them. Put a new secret value in a table like these, never in a client-readable table.
- The spec puts `endpoint_url` in `horses`. Here it is in `horse_secrets`, and `api_key` is optional, so no client can read the endpoint of a submitted horse.
- `shared/src/types.ts` is handwritten. Update it when the schema changes.
- Node runs the backend `.ts` files directly, and `shared` is imported as source. So `backend/` and `shared/` can use only erasable TypeScript syntax (no enums, no parameter properties), and a relative import needs the `.ts` extension.
- The public name is Model Derby (decided on 2026-11-10, before it was Agent Derby). It is `APP_NAME` in `shared/src/index.ts`, and the static tags in `frontend/index.html` also hold it, because a link preview does not run JavaScript. Do not hardcode the name in another place. `horserace` is only the name of the repo, the packages and the hosted projects. Never show it to a user.
- The database column is `players.credits`, but the UI always says "Oats".
- All horses run through OpenRouter (`OPENROUTER_API_KEY`). Never use a direct Anthropic key.
- Odds are pari-mutuel and are computed on read from `bets` with the maths in `shared/src/odds.ts`: all stakes of a market are one pool, so the odds of a horse fall when more Oats are on it. `open_race` and `enter_model` add a house seed of `horses.seed_weight` x 100 Oats per market (bets with `player_id` null), so each horse has odds before the first bet and a strong model starts as the favorite. The view `bet_totals` has the stakes per horse. The odds chart is computed from `bets` too (`winChanceHistory`), so nothing writes `odds_snapshots`.
- A payout is floored per bet. A tie on the border of a paying position refunds that market.

## Google login

Login must not redirect through Supabase. Do not use `supabase.auth.signInWithOAuth`: Google then shows `kqpkcmcehcdipshlirzi.supabase.co` on its sign-in screen. That was the problem in hypemarket.

- Use Google Identity Services in the browser. Load `https://accounts.google.com/gsi/client`, call `google.accounts.id.initialize({ client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, nonce: hashedNonce, callback })` and show the button with `google.accounts.id.renderButton`. Google draws this button. A custom button cannot start the flow.
- In the callback, call `supabase.auth.signInWithIdToken({ provider: 'google', token: response.credential, nonce })`.
- The nonce is a random string. Google gets its SHA-256 hash as a hex string. Supabase gets the raw string.
- The OAuth client is "Agent Derby web" in the Google Cloud project `horserace-514403` (organization fluidlabs.co). No client secret is stored, because this flow does not need one.
- Google accepts the button only on the origins in the client: `http://localhost:5173`, `http://localhost` and `https://horserace-snowy.vercel.app`. Add each new origin (the final domain) in the Google Cloud console under Google Auth Platform, Clients.
- The Google app is in "Testing", so only test users can log in. Add test users under Google Auth Platform, Audience. "Publish app" needs a home page and a privacy policy link on the final domain.
- `[auth.external.google]` in `backend/supabase/config.toml` holds the client ID. The hosted project gets it with `supabase config push`.

## UI rules

The design direction is from Furkan (2026-11-10) and replaces the "no race track" rule of the spec: a fairground derby game in pixel art, angular and technical, with orange as the one brand color.

- All colors and fonts are theme tokens in the `@theme` block of `frontend/src/index.css`. Do not hardcode them in a component. The one exception is the pixel art in `frontend/src/lib/sprite.ts` (the horses and the meadow).
- The derby track is the main element: a green pixel meadow with a white fence, like a fairground derby game (`components/Track.tsx`). Each horse has a lane and jumps one step for each open lock. A horse is higher than its lane, so the horses overlap. There is exactly one chart: a line chart of the Win odds over time.
- A horse always stands on the meadow (`grass()` in `components/Track.tsx`), never on the black background, because its outline is black. Orange is for outlines, active states and the main button. Text on orange is black (`text-on-accent`), never white. `components/Horse.tsx` draws the horse from its id, so the same horse looks the same on every screen and each horse differs in breed, mane, tail and silks.
- No rounded corners, no shadows, no gradients, no pill badges, no tilted images, nothing cropped. Borders are 2 px or 4 px. Use `font-pixel` for names, numbers and buttons, and the mono body font for the rest.
- Few labels: a screen must explain itself without tags. Put a column label once in a header, not in every row.
- Padding is at least 24 px on the board and 16 px on the phone. The board is drawn at 1920x1080 and scaled to the screen (`pages/Board.tsx`).
- The race page shows the track only when the race has started. Before the start, the horses wait in boxes (3 to 4 in a row on a wide screen) with the model, the provider, the token price and the odds. A player bets on one horse per race.
- A race in a list is a box with an orange outline and the pixel image of its challenge (`components/Glyph.tsx`). A challenge without a drawn image gets a generated one from its name.
- `/board?demo` and `/?demo` run a fake race from `lib/demo.ts` for design work. Never show it without the `demo` parameter.
- Before and during a race, show a lock only as its category and its blurb.
