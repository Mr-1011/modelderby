# Agent Derby

**The benchmark you can bet on.**

Every week a new model claims it is the best coder. Agent Derby lets the audience decide. 6 to 8 LLM agents race through the same escape room, each in its own [Archil](https://archil.com) sandbox, and the crowd bets on them from their phones while the race runs. The stake is Oats, a play credit. No real money.

Built at "Agents Need Solid Ground: An Archil Hackathon" in San Francisco on 2026-11-10.

> This project is in build. [Status](#status) shows what works today.

## How a race works

1. **The lineup.** Each horse is a different model with its own name: frontier models, small models and open-weight models. Anyone can enter their own model for the next race.
2. **Betting opens.** The big screen shows a QR code. You scan it, sign in with Google and get 1,000 Oats. You bet on Win or on Place.
3. **The start.** The race starts when the pool reaches 10,000 Oats or when a 60-second countdown ends.
4. **The race.** Each horse gets an identical copy of the room and 3 minutes. Betting stays open and the odds move with every bet.
5. **The finish.** The first horse that opens all 5 locks wins, and betting closes at that moment. The other horses race on for Place. If no horse escapes in 3 minutes, the horse with the most open locks wins.
6. **The payout.** Winning bets are paid in Oats. The board shows the finish order, the changes the winner made in its room, and the leaderboard.

## The escape room

A room is a directory in a sandbox with 5 independent locks. A horse opens a lock with shell commands and file edits. There is no network. Each lock is derived from a known benchmark and then changed, so it is credible but not memorised.

| Lock | Task | Derived from | Category |
|---|---|---|---|
| 1 | A log hunt | Terminal-Bench | Text |
| 2 | A cipher | picoCTF | Text |
| 3 | A real bug in a small code base | SWE-bench | Text |
| 4 | A grid puzzle | ARC-AGI | Image |
| 5 | A path puzzle | Advent of Code | Text |

The difficulty rises from lock 1 to lock 5. Small models are expected to stop after one or two locks. Only frontier models are expected to reach lock 5.

## Betting

There are two markets per race, like at the track:

- **Win**: the horse finishes first.
- **Place**: the horse finishes in the top 3 (top 2 if fewer than 6 horses run).

The odds are pari-mutuel: all stakes of a market go into one pool, and the winners share it. The house takes nothing.

- Win odds of a horse = total Win pool / stake on that horse.
- Place: the stakes on the horses that did not place are split into equal shares, one share per placed horse. Each share is paid out in proportion to the stakes on that horse.
- The house seeds 2,000 Oats per market, and a stronger model gets a larger share. So every horse has odds before the first bet, and the favorite starts with the lowest odds.
- The odds are dynamic: each bet on a horse lowers its odds and raises the odds of the others. The chart on the race page shows this as the chance to win over time.

The finish order is: escaped horses by time, then the other horses by open locks, then by the time of their latest lock.

## Built on Archil

The race needs forked, shared and persistent state. Archil gives all three.

- **Forked.** One base sandbox holds the prepared room. Each horse gets its own fork of it. A fork is a disk checkpoint plus a branch, so every horse starts from the identical room in milliseconds.
- **Shared.** One Archil disk, `derby`, holds the room blueprints. The runner appends one log line per agent step to the same disk.
- **Persistent.** When the race ends, the final state of every room goes to the disk: the diff, the full room as an archive, and the result. Anyone can replay and audit a race.

```
derby/
  rooms/<room>/                 the blueprint of a room
  races/<race>/<horse>/
    log.jsonl                   one line per agent step
    final.diff                  what the horse changed in its room
    room.tar.gz                 the final state of the room
    result.json                 locks, steps, cost, time, finish position
```

## Architecture

```mermaid
flowchart LR
  phone["Phone<br/>join and bet"]
  board["Board<br/>big screen"]
  db[("Supabase<br/>Postgres, Realtime, Auth")]
  runner["Runner<br/>Node on Railway"]
  models["OpenRouter<br/>one model per horse"]

  subgraph archil["Archil"]
    base["Base sandbox<br/>the prepared room"]
    forks["One fork per horse"]
    disk[("Disk derby<br/>rooms, logs, results")]
  end

  phone -- "bets" --> db
  db -- "live odds" --> phone
  db -- "live race" --> board
  runner -- "race progress" --> db
  runner -- "chat with a bash tool" --> models
  runner -- "runs the commands" --> forks
  base -- "fork" --> forks
  runner -- "logs and final rooms" --> disk
```

- **Frontend.** A Vite app on Vercel. `/` is the race list (Popular and Latest), `/race/:id` is one race with the bets and the odds chart, `/arena` is where you enter your own OpenRouter model in an open race, `/leaderboard` ranks the players, and `/board` is the big screen. It reads Supabase directly and gets every change through Realtime.
- **Runner.** A long-lived Node process on Railway. It owns the race: it forks the sandboxes, runs one agent loop per horse, checks the locks after every step and settles the bets. The models run outside the sandbox through OpenRouter. The runner executes their commands inside the fork.
- **Supabase.** Postgres, Realtime and auth. Clients can only read. A bet, a model entry and the payout each go through one Postgres function, so the Oats balances stay consistent.

## Fair play

- **Hidden challenges.** Before and during a race, the audience and the model owners see only a category and one sentence per lock. The real task is generated at race start from a private pool with a fresh random seed. Nobody can train a model on the exact task.
- **Open afterwards.** The seed is published when the race is settled. With it, anyone can rebuild the room and check the result.
- **The checker is out of reach.** The runner runs its own copy of the checker. An agent that edits the checker in its room changes nothing. The checker stores only hashes of the answers.
- **Equal limits.** Every horse gets the same prompt, the same sandbox, the same 3 minutes, the same step limit and the same token budget. This includes the models that players enter.

## Stack

- Vite, React, TypeScript, Tailwind CSS v4
- Node.js and TypeScript for the runner
- Supabase (Postgres, Realtime, Google login)
- Archil sandboxes and disks
- OpenRouter for all models
- Vercel (frontend) and Railway (runner)

## Setup

You need Node.js 24 or later and pnpm.

```
pnpm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Set these values in `frontend/.env.local`:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | The URL of the Supabase project. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The public key of that project. Never use the service role key here. |
| `VITE_GOOGLE_CLIENT_ID` | The Google OAuth client ID for Sign in with Google. |

Set these values in `backend/.env`:

| Variable | Value |
|---|---|
| `ARCHIL_API_KEY` | The Archil API key. |
| `ARCHIL_REGION` | The Archil region. The default is `aws-us-west-2`. |
| `OPENROUTER_API_KEY` | The OpenRouter key. All models run through OpenRouter. |
| `SUPABASE_URL` | The URL of the Supabase project. |
| `SUPABASE_SERVICE_ROLE_KEY` | The service role key. Never put this key in the frontend. |
| `KEENABLE_API_KEY` | Optional. Web search for the agents. |

## Commands

Run from `frontend/`:

```
pnpm dev                 # dev server
pnpm build               # type check, then production build
pnpm exec tsc --noEmit   # type check only
```

Run from `backend/`:

```
pnpm dev     # runner in watch mode, reads .env
pnpm start   # runner without watch mode, does not read .env
pnpm build   # type check only
```

The runner answers `GET /health` on port 8080. There is no linter and no test suite.

## Project layout

```
frontend/            the Vite app: phone view, board and submit form
backend/src/         the race runner
backend/supabase/    database config and migrations
shared/              types and the app name, used by frontend and backend
```

The challenge pool (generators, checkers and answers) is private and is not in this repository.

## Status

- [x] Workspace scaffold: frontend routes, runner health endpoint, shared types
- [x] Database schema with row level security
- [ ] One agent in one sandbox, end to end
- [ ] A full race with parallel horses and a finish order
- [ ] Live board
- [ ] Betting and payouts
- [ ] Enter your own model
- [ ] Google login
