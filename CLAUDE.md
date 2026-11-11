# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Model Derby (domain modelderby.com) is a live model benchmark that the audience can bet on. 6 to 8 LLM agents ("horses") race through the same challenge (a "room") in a sandbox file system: a Rubik's cube or a warehouse rover with a command line tool, or the Vault with 5 locks. The horse that solves the room at the lowest cost wins, not the fastest. Each horse runs in its own Archil sandbox. The audience bets Credits (play money, not real money) on Win and Place from their phones while the race runs. Built at the Archil hackathon on 2026-11-10.

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

The runner image is the `Dockerfile` at the repo root, and the build context is the repo root. The runner is live on Railway: project `modelderby` (ID `e405b04d-2041-4cd2-9565-69ff387598cf`), environment `production`, service `runner`, region `sfo`, one replica, health check `/health`. Railway builds the `Dockerfile` with no config file. The service variables are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `ARCHIL_API_KEY` and `ARCHIL_REGION`. Deploy only between races, because a restart cuts a running race short:

```
npx -y @railway/cli up --ci --service runner --environment production --project e405b04d-2041-4cd2-9565-69ff387598cf
npx -y @railway/cli logs --service runner --lines 100
```

The frontend is live at https://www.modelderby.com (`modelderby.com` redirects to it, and https://horserace-snowy.vercel.app also works). The Vercel project is `modelderby` in the team `fluid-labs`, with root directory `frontend`. Its variables are `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_GOOGLE_CLIENT_ID`. It has no Git connection yet, so a push does not deploy. Deploy from the repo root:

```
pnpm dlx vercel deploy --prod --scope fluid-labs
```

Both CLIs upload the working directory, with the uncommitted work of the other agents. To deploy one commit, export it and deploy from the copy: `git archive HEAD | tar -x -C <dir>`, then copy `.vercel/` into it for Vercel.

`vercel link` appends `.env*` to `.gitignore` and writes a root `.env.local`. Undo both, because that line hides the `.env.example` files.

There is no linter. The tests are small and run alone:

```
node --test shared/src/odds.test.ts      # the odds maths
node --test shared/src/finish.test.ts    # the finish order
# From backend/: the betting functions, on the hosted database, in a transaction that rolls back.
PGPASSWORD=$SUPABASE_DB_PASSWORD psql "host=aws-1-us-west-1.pooler.supabase.com port=5432 user=postgres.kqpkcmcehcdipshlirzi dbname=postgres sslmode=require" -v ON_ERROR_STOP=1 -f supabase/test_bets.sql
```

## Architecture

The three parts talk through Supabase:

- The frontend reads Supabase directly, and all of that access is in `src/lib/queries.ts`: `useRaces` for the lists, and `useRace(id)` for one live race, which reloads on Realtime events of `races`, `entries` and `bets`. Its routes are in `src/App.tsx`: `/` is the race list (tabs Popular and Latest, and a Filter menu for the status that hides the races that are over at first), `/race/:id` is one race (`pages/RacePage.tsx` gives live data to `PhoneView`: the title of the challenge, the odds chart, the track and the horse boxes, then the result), `/arena` lists the open races where a player can enter a model, `/leaderboard` ranks the players by Credits, `/profile` is where a player sets the public name and builds the rider (the account menu in the header opens it, or the Profile tab on a phone), `/admin` lets an admin start an open race by hand (no nav link), `/ops` is the ops view for an admin (only on a local dev server, because it shows tool calls of hidden challenges), and `/board` is the big screen at 1920x1080.
- The runner owns the race state machine. For each race it forks one Archil sandbox per horse from a prepared base and runs one agent loop per horse: OpenRouter chat completions with one `bash` tool, and each command runs in the fork of that horse. After every tool call the runner runs its own copy of the checker and writes the progress to `entries`. It writes logs, diffs and final room states to the Archil disk `derby`. It is the only writer of race data and uses the service role key. It keeps 3 open house races and 1 open Arena race. Run exactly one runner: two runners run each race twice. At boot the runner deletes all `derby-r*` sandboxes and settles each `running` race, so a restart during a race cuts that race short.
- Postgres keeps the Credits balances consistent. Clients have select rights only. A new Google user gets a `players` row with 1,000 Credits from the trigger `handle_new_user`. A bet goes through the function `place_bet`, a player enters a model through `enter_model`, the runner opens a race with `open_race` (house horses plus the house seed bets) and pays out through `settle_race`. They are in `migrations/20261110200000_betting.sql`. A player sets the public name (`players.nickname`) and the rider (`players.rider`) through `set_profile` (`migrations/20261110250000_profile.sql`).

The product model: one race is one "challenge" for the player, with a room, a lineup and two markets (Win and Place). A race is a house race or an Arena race (`races.arena`, `migrations/20261110280000_arena.sql`), never both. A house race has only the house horses, and the race list on `/` shows only house races. An Arena race is on `/arena` only, and only an Arena race takes the model of a player: `enter_model` refuses a house race. A player enters a model as an OpenRouter model id only (`enter_model`). There are no custom endpoints and no API keys of players: every model runs on our OpenRouter key, so `horse_secrets` is not in use and the frontend does not call the runner.

The start rules (`migrations/20261110210000_start_rules.sql`, they replace the pool and countdown rule of the spec): the runner starts only a race with `races.ready = true`. The database sets `ready` when the first player bets or enters a model, and it then gives the race a countdown of at least 60 seconds. So a race with `ready = false` waits, also after its countdown, and no race runs without a player. An admin (a row in `admins`, added by SQL with the service role) starts a race in 20 seconds with `start_race`. A player bets on one horse per race, on Win, on Place or on both.

The race rules (Notion, locked on 2026-11-10 at 20:15 PT, they replace the "first escape wins" rule of the spec):

- The winner is the horse that solves the room inside the time limit at the lowest cost. The cost is the sum of the OpenRouter usage of the horse (`entries.cost_usd`), and there is no budget cap. `finishOrder` in `shared/src/finish.ts` is the one definition of the order, for the runner and for the live standing on the screens: the finishers by cost, then the other horses by progress, and the cheaper horse first on equal progress. `settle_race` pays from `entries.finish_pos` and refunds a market when the two horses on a paying border have the same progress and the same cost.
- Betting closes at the first finish. The race goes on until every horse has finished or the time limit ends.
- Each room has a deterministic checker with no LLM judge. Its last lines are `PROGRESS <0 to 100>` and optionally `VIEW <one line>`. The runner runs its own copy after each command and on a 3 s timer, and writes `entries.progress` and `entries.view`. The view is a text picture for the screens: the 54 stickers of the cube (faces U, R, F, D, L, B), or the rows of the rover map joined with `/`. The Vault checker prints one line per lock, and its progress is 20 per open lock.
- A room is a folder in `pool/` with `setup.py --seed`, `check.sh` and `solve.py`. The setup installs the command line tool of the room (`cube`, `robot`) and writes `/room/TASK.md`. The state of a room is a log of commands, and the checker replays that log from the seed, so an edit of a state file changes nothing.
- `LIVE_ELIMINATION` (runner variable, off by default): a horse whose cost is above the cost of the first finisher gets the state `out` and stops.

The ops view (`pages/Ops.tsx`) shows the 3 newest races as a graph: the disk, the base room and one fork node per horse, with the steps and the tool calls. A click on the title of a race opens its detail view (`/ops?race=<id>`): the base sandbox and one machine per horse in a row, in the order of the forks, with the sandbox id, the fork time, the commands and the files on the disk. Its data is the table `race_events`, which the runner writes (kinds `base_built`, `fork_created`, `step`, `tool_call`, `checkpoint`, `solved`, `out`, `timeout`, `failed`, `settled`). Only an admin reads that table (the policy calls `is_admin()`), and an event never holds the output of a command or a seed.

Rules that hold across files:

- Hidden challenges: a client may only ever get `challenges.category` and `challenges.public_blurb`. Generators, seeds and expected answers stay in `pool/`, on the Archil disk and in the secrets tables. They never go into `frontend/`, a tracked path, a log line, an API response or a horse sandbox. The seed becomes public only after settle, in `races.seed_revealed`.
- `horse_secrets`, `challenge_secrets` and `race_secrets` have row level security with no policy and no grant, so only the service role reads them. Put a new secret value in a table like these, never in a client-readable table.
- The spec puts `endpoint_url` in `horses`. Here it is in `horse_secrets`, and `api_key` is optional, so no client can read the endpoint of a submitted horse.
- `shared/src/types.ts` is handwritten. Update it when the schema changes.
- Node runs the backend `.ts` files directly, and `shared` is imported as source. So `backend/` and `shared/` can use only erasable TypeScript syntax (no enums, no parameter properties), and a relative import needs the `.ts` extension.
- The public name is Model Derby (decided on 2026-11-10, before it was Agent Derby). It is `APP_NAME` in `shared/src/index.ts`, and the static tags in `frontend/index.html` also hold it, because a link preview does not run JavaScript. Do not hardcode the name in another place. The GitHub repo (`Mr-1011/modelderby`) and the Vercel and Railway projects are named `modelderby`. `horserace` is only the name of the packages, the Supabase project and the Google Cloud project. Never show it to a user.
- The play money is "Credits" on every screen and in every document, and the database column is `players.credits`. Its name was "Oats" until 2026-11-10: never write "Oats". Only the helper `oats()` in `frontend/src/lib/format.ts` keeps the old name, and it formats an amount of Credits.
- All horses run through OpenRouter (`OPENROUTER_API_KEY`). Never use a direct Anthropic key.
- Odds are pari-mutuel and are computed on read from `bets` with the maths in `shared/src/odds.ts`: all stakes of a market are one pool, so the odds of a horse fall when more Credits are on it. `open_race` and `enter_model` add a house seed of `horses.seed_weight` x 100 Credits per market (bets with `player_id` null), so each horse has odds before the first bet and a strong model starts as the favorite. The view `bet_totals` has the stakes per horse. The odds chart is computed from `bets` too (`winChanceHistory`), so nothing writes `odds_snapshots`.
- A payout is floored per bet. A tie on the border of a paying position refunds that market.

## Guest accounts and QR codes

A player joins without Google at `/join` (`pages/Join.tsx`): a random rider name that the player can change, then `supabase.auth.signInAnonymously` with that name in the user metadata. `/join?race=<id>` sends the new player to that race, for a judge. The trigger `handle_new_user` gives a guest a `players` row with the full rider name and 1,000 Credits. The session of a guest lives only in the browser. The links of the QR codes start with `SITE_URL` in `shared/src/index.ts`. The ops view does not show the QR codes. `[auth]` in `backend/supabase/config.toml` enables anonymous sign-ins and sets 1,000 of them per hour and IP address, because one venue shares one address. The hosted project gets it with `supabase config push`.

## Google login

Login must not redirect through Supabase. Do not use `supabase.auth.signInWithOAuth`: Google then shows `kqpkcmcehcdipshlirzi.supabase.co` on its sign-in screen. That was the problem in hypemarket.

- Use Google Identity Services in the browser. Load `https://accounts.google.com/gsi/client`, call `google.accounts.id.initialize({ client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, nonce: hashedNonce, callback })` and show the button with `google.accounts.id.renderButton`. Google draws this button. A custom button cannot start the flow.
- In the callback, call `supabase.auth.signInWithIdToken({ provider: 'google', token: response.credential, nonce })`.
- The nonce is a random string. Google gets its SHA-256 hash as a hex string. Supabase gets the raw string.
- The OAuth client is "Model Derby web" in the Google Cloud project `horserace-514403` (organization fluidlabs.co). No client secret is stored, because this flow does not need one.
- Google accepts the button only on the origins in the client: `http://localhost:5173`, `http://localhost`, `https://www.modelderby.com`, `https://modelderby.com` and `https://horserace-snowy.vercel.app`. Add each new origin in the Google Cloud console under Google Auth Platform, Clients.
- The Google app is in "Testing", so only test users can log in. Add test users under Google Auth Platform, Audience. The branding has the app name and the home page `https://www.modelderby.com`. "Publish app" also needs a privacy policy link on that domain, and the logo needs a square image of 120x120 px.
- `[auth.external.google]` in `backend/supabase/config.toml` holds the client ID. The hosted project gets it with `supabase config push`.

## UI rules

The design direction is from Furkan (2026-11-10) and replaces the "no race track" rule of the spec: a fairground derby game in pixel art, angular and technical, with orange as the one brand color.

- All colors and fonts are theme tokens in the `@theme` block of `frontend/src/index.css`. Do not hardcode them in a component. The one exception is the pixel art in `frontend/src/lib/sprite.ts` (the horses and the meadow) and in `frontend/src/lib/rider.ts` (the riders).
- The derby track is the main element: a green pixel meadow with a white fence, like a fairground derby game (`components/Track.tsx`). Each horse has a lane and jumps one step for each open lock. A horse is higher than its lane, so the horses overlap. There is exactly one chart: a line chart of the Win odds over time.
- A horse always stands on the meadow (`grass()` in `components/Track.tsx`), never on the black background, because its outline is black. Orange is for outlines, active states and the main button. Text on orange is black (`text-on-accent`), never white. `components/Horse.tsx` draws the horse from its id, so the same horse looks the same on every screen and each horse differs in breed, mane, tail and silks.
- The rider is the public icon of a player, in the header and on the leaderboard. `components/Rider.tsx` draws it from `players.rider`: one number per part (body, skin, hair, hat, top, pattern, pants) in the order of `PARTS` in `lib/rider.ts`. A new part goes at the end of `PARTS`. A player with no rider gets one from the player id (`riderOf`). A rider stands on the meadow, like a horse.
- No rounded corners, no shadows, no gradients, no pill badges, no tilted images, nothing cropped. Borders are 2 px or 4 px. Use `font-pixel` for names, numbers and buttons, and the mono body font for the rest.
- Each thing that a player can click has a hover state. An outline button gets `hover:border-accent hover:text-accent`, an orange button `hover:bg-accent-deep`, and a card that is a link `hover:outline-2 hover:outline-accent`. The `aria-pressed:` and `disabled:` classes win against `hover:`. A button has the pointer cursor from the base layer in `index.css`.
- A text that changes must not move the layout. `font-pixel` has digits of one width (`tnum` in the `@theme` block), so a countdown or a cost keeps its width.
- No text that explains a screen (Furkan, 2026-11-10): no intro lines, no hints below a form. A screen has a title and its controls.
- A list that loads shows skeleton boxes with the height of the real boxes (`RaceCardSkeleton`, `FeaturedSkeleton`, the race page), with `animate-load`. An empty list shows `components/Empty.tsx`: one horse on the meadow and one short line.
- Few labels: a screen must explain itself without tags. Put a column label once in a header, not in every row.
- Padding is at least 24 px on the board and 16 px on the phone. The board is drawn at 1920x1080 and scaled to the screen (`pages/Board.tsx`).
- Each page except `/board` and `/signin` is inside `components/Shell.tsx`, so the header is the same on each page. On a phone (below `lg`), the nav is a bar at the bottom with the tabs Races, Arena, Leaderboard and Profile, and the Log out button is on the profile page. On a wide screen, the nav is in the header, and the account menu has Profile and Log out. The four tabs must fit at a width of 320 px.
- The race page shows the odds chart on top. The pointer on a line of the chart highlights the box of that horse, and the pointer on a box highlights its line. The track shows only when the race has started. Before the start, the horses wait in boxes (3 to 4 in a row on a wide screen) with the model, the token price and the odds. During the race, a box shows the progress, the state and the cost of the horse, and the picture of `entries.view` (`components/RoomView.tsx`: the net of the cube or the map of the rover). A player bets on one horse per race.
- A race in a list is a box with an orange outline and the pixel image of its challenge (`components/Glyph.tsx`). A challenge without a drawn image gets a generated one from its name.
- The race list shows one race large and live on top (`components/FeaturedRace.tsx`): a race that runs, or else the first race of the list. A card shows the favorite with its odds, or the winner, and the pool only when players have bet.
- The logo is the checkered flag on the green of the meadow, `frontend/public/favicon.svg`. `logo.png` and `apple-touch-icon.png` are pictures of it, and `og.png` (1200x630) is the link preview: the name on the left and three horses on the meadow. `index.html` links them.
- `/board?demo` and `/?demo` run a fake race from `lib/demo.ts` for design work. Never show it without the `demo` parameter.
- Before and during a race, show a lock only as its category and its blurb.
