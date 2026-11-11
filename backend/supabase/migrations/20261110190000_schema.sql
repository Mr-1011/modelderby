-- Agent Derby schema: tables, row level security, grants, realtime.
-- Clients only read. The runner writes with the service role key.
-- The functions place_bet and settle_race are not here yet.

create table public.players (
  id uuid primary key references auth.users (id),  -- anonymous or Google user
  nickname text unique not null,
  credits int not null default 1000                -- Oats balance (UI says "Oats")
);

create table public.horses (
  id text primary key,                 -- 'h1', or 'u-<uuid>' for submitted horses
  name text not null,                  -- display name, e.g. 'Midnight Diff'
  model text not null,                 -- OpenRouter slug, or the submitted model id
  provider text not null,              -- 'OpenAI', 'Google', ... or 'Submitted'
  size_class text,                     -- 'frontier' | 'small' | 'open-weight' (null for submitted)
  reasoning_effort text,               -- e.g. 'high', only if the model has that setting
  kind text not null default 'house',  -- house | submitted
  submitted_by uuid references public.players (id),
  active boolean not null default true,  -- submitted horses: join the next race with a free slot
  vision boolean not null default false  -- true if the model takes image input
);

-- Submitted horses only. No client can read this table, so the endpoint and the key stay on the server.
create table public.horse_secrets (
  horse_id text primary key references public.horses (id),
  endpoint_url text not null,          -- OpenAI-compatible base URL
  api_key text                         -- optional
);

-- Public: only what the audience may see.
create table public.challenges (
  id text primary key,                 -- e.g. 'vault-4'
  room text not null,                  -- 'vault' | 'lab' | 'archive'
  lock int not null,                   -- 1..5
  category text not null,              -- 'text' | 'image' | 'robotics' (robotics = coming soon, never raced)
  public_blurb text not null           -- one sentence
);

create table public.challenge_secrets (
  challenge_id text primary key references public.challenges (id),
  generator_ref text not null          -- private generator, e.g. 'rooms/vault/setup.py#lock4' on the derby disk
);

create table public.races (
  id bigserial primary key,
  task text not null,                  -- room: 'vault' | 'lab' | 'archive'
  status text not null default 'open', -- open | running | settled
  opens_at timestamptz not null default now(),
  countdown_ends_at timestamptz,       -- opens_at + 60s
  started_at timestamptz,
  betting_closed_at timestamptz,       -- first escape or race end
  ended_at timestamptz,
  place_count int not null,            -- 3, or 2 with fewer than 6 horses
  winner_horse text references public.horses (id),
  place_horses text[],                 -- top place_count of the finish order
  seed_revealed text                   -- copied from race_secrets by settle_race, null until settled
);

create table public.race_secrets (
  race_id bigint primary key references public.races (id),
  seed text not null                   -- crypto-random, drawn at race start
);

-- One row per horse per race, updated live.
create table public.entries (
  race_id bigint references public.races (id),
  horse_id text references public.horses (id),
  sandbox_id text,
  state text not null default 'waiting',  -- waiting | running | escaped | failed | timeout
  locks_open int not null default 0,   -- 0-5, from the checker
  locks text,                          -- checker output per lock, e.g. '11000'
  steps int not null default 0,
  last_step text,                      -- last bash command, truncated to 120 chars
  cost_usd numeric not null default 0,
  tokens int not null default 0,
  solved_ms int,                       -- ms since race start when lock 5 of 5 opened
  last_lock_ms int,                    -- ms since race start when its latest lock opened
  finish_pos int,                      -- 1..N, set by the runner at race end
  diff text,                           -- final git diff of /room (also on the Archil disk)
  primary key (race_id, horse_id)
);

-- One row per horse every 5 s while open or running, plus one at betting close.
create table public.odds_snapshots (
  race_id bigint references public.races (id),
  at timestamptz not null default now(),
  horse_id text references public.horses (id),
  win_odds numeric not null,
  primary key (race_id, at, horse_id)
);

create table public.bets (
  id bigserial primary key,
  race_id bigint not null references public.races (id),
  player_id uuid references public.players (id),  -- null = house seed
  market text not null,                -- 'win' | 'place'
  outcome text not null,               -- horse id
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.horses enable row level security;
alter table public.horse_secrets enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_secrets enable row level security;
alter table public.races enable row level security;
alter table public.race_secrets enable row level security;
alter table public.entries enable row level security;
alter table public.odds_snapshots enable row level security;
alter table public.bets enable row level security;

-- The three secrets tables have no policy and no grant, so no client can read them.
create policy "Anyone can read players" on public.players for select to anon, authenticated using (true);
create policy "Anyone can read horses" on public.horses for select to anon, authenticated using (true);
create policy "Anyone can read challenges" on public.challenges for select to anon, authenticated using (true);
create policy "Anyone can read races" on public.races for select to anon, authenticated using (true);
create policy "Anyone can read entries" on public.entries for select to anon, authenticated using (true);
create policy "Anyone can read odds snapshots" on public.odds_snapshots for select to anon, authenticated using (true);
create policy "Anyone can read bets" on public.bets for select to anon, authenticated using (true);

revoke all on public.players, public.horses, public.horse_secrets, public.challenges, public.challenge_secrets,
  public.races, public.race_secrets, public.entries, public.odds_snapshots, public.bets from anon, authenticated;
grant select on public.players, public.horses, public.challenges, public.races, public.entries,
  public.odds_snapshots, public.bets to anon, authenticated;
grant all on public.players, public.horses, public.horse_secrets, public.challenges, public.challenge_secrets,
  public.races, public.race_secrets, public.entries, public.odds_snapshots, public.bets to service_role;
grant usage, select on sequence public.races_id_seq, public.bets_id_seq to service_role;

alter publication supabase_realtime add table public.races, public.entries, public.bets, public.odds_snapshots;
