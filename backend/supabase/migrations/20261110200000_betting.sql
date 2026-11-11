-- Betting and the race lifecycle.
-- A new user gets 1,000 Oats. A player bets through place_bet and enters a model through enter_model.
-- The runner opens a race with open_race and pays out with settle_race.

-- Google first names are not unique, and a duplicate must not block a login.
alter table public.players drop constraint players_nickname_key;

-- The prior of a horse: the house seeds seed_weight x 100 Oats on it in each market, so a strong model starts with lower odds.
alter table public.horses add column seed_weight int not null default 2;

-- Null until the race is settled. 0 = lost. A refund pays the stake back.
alter table public.bets add column payout int;

insert into public.horses (id, name, model, provider, size_class, vision, seed_weight) values
  ('h1', 'Midnight Diff', 'anthropic/claude-sonnet-5.5', 'Anthropic', 'frontier', true, 5),
  ('h2', 'Terra Firma', 'openai/gpt-5.6-terra', 'OpenAI', 'frontier', true, 5),
  ('h3', 'Dark Matter', 'x-ai/grok-4.7', 'xAI', 'frontier', true, 4),
  ('h4', 'Twin Flash', 'google/gemini-3.8-flash', 'Google', 'small', true, 3),
  ('h5', 'Luna Sprint', 'openai/gpt-5.6-luna', 'OpenAI', 'small', true, 2),
  ('h6', 'Open Range', 'qwen/qwen3.8-27b', 'Qwen', 'open-weight', true, 1);

insert into public.challenges (id, room, lock, category, public_blurb) values
  ('vault-1', 'vault', 1, 'text', 'Find one number hidden in rotated server logs.'),
  ('vault-2', 'vault', 2, 'text', 'Break the cipher on a locked vault file.'),
  ('vault-3', 'vault', 3, 'text', 'Fix a real bug in a small invoicing package.'),
  ('vault-4', 'vault', 4, 'image', 'Find the rule of a grid puzzle and apply it.'),
  ('vault-5', 'vault', 5, 'text', 'Find the cheapest path through a map with strict movement rules.');

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.players (id, nickname)
  values (
    new.id,
    -- Google gives one full name. Only the first word goes on the public leaderboard.
    left(coalesce(
      nullif(split_part(trim(new.raw_user_meta_data ->> 'name'), ' ', 1), ''),
      'player-' || left(new.id::text, 6)
    ), 24)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Lock order in all functions: race, then player.

create function public.open_race(p_task text, p_countdown_ends_at timestamptz)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race bigint;
begin
  insert into public.races (task, countdown_ends_at, place_count)
  values (p_task, p_countdown_ends_at, 3)
  returning id into v_race;

  -- 6 house horses, so 2 of the 8 places stay free for models that players enter.
  insert into public.entries (race_id, horse_id)
  select v_race, id from public.horses where kind = 'house' and active order by id limit 6;

  insert into public.bets (race_id, market, outcome, amount)
  select v_race, m.market, h.id, h.seed_weight * 100
  from public.entries e
  join public.horses h on h.id = e.horse_id
  cross join (values ('win'), ('place')) as m (market)
  where e.race_id = v_race;

  return v_race;
end;
$$;

create function public.enter_model(p_race bigint, p_model text, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
  v_race public.races;
  v_name text := trim(p_name);
  v_horse text;
begin
  if v_player is null then
    raise exception 'Sign in to enter a model';
  end if;
  if v_name is null or length(v_name) not between 2 and 24 then
    raise exception 'The horse name must have 2 to 24 characters';
  end if;
  -- An OpenRouter slug without a variant. The runner checks that the model exists before the race.
  if p_model is null or length(p_model) > 80 or p_model !~ '^[a-z0-9._-]+/[a-zA-Z0-9._-]+$' then
    raise exception 'Unknown model';
  end if;

  -- The lock makes two entries at the same moment take the last place one after the other.
  select * into v_race from public.races where id = p_race for update;
  if not found then
    raise exception 'Race not found';
  end if;
  if v_race.status <> 'open' or v_race.countdown_ends_at <= now() then
    raise exception 'Entries are closed for this race';
  end if;
  if (select count(*) from public.entries where race_id = p_race) >= 8 then
    raise exception 'This race is full';
  end if;
  if exists (
    select 1 from public.entries e join public.horses h on h.id = e.horse_id
    where e.race_id = p_race and h.submitted_by = v_player
  ) then
    raise exception 'You have a model in this race already';
  end if;
  if exists (
    select 1 from public.entries e join public.horses h on h.id = e.horse_id
    where e.race_id = p_race and h.model = p_model
  ) then
    raise exception 'This model is in the race already';
  end if;

  v_horse := 'u-' || gen_random_uuid();
  -- Not active: the horse runs in this race only.
  insert into public.horses (id, name, model, provider, kind, submitted_by, active)
  values (v_horse, v_name, p_model, initcap(split_part(p_model, '/', 1)), 'submitted', v_player, false);
  insert into public.entries (race_id, horse_id) values (p_race, v_horse);
  insert into public.bets (race_id, market, outcome, amount)
  select p_race, m.market, h.id, h.seed_weight * 100
  from public.horses h
  cross join (values ('win'), ('place')) as m (market)
  where h.id = v_horse;

  return v_horse;
end;
$$;

create function public.place_bet(p_race bigint, p_market text, p_outcome text, p_amount int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
  v_race public.races;
  v_credits int;
begin
  if v_player is null then
    raise exception 'Sign in to bet';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'The amount must be more than 0';
  end if;
  if p_market is null or p_market not in ('win', 'place') then
    raise exception 'Unknown market';
  end if;

  -- The share lock makes the close of betting wait for a bet that is in progress.
  select * into v_race from public.races where id = p_race for share;
  if not found then
    raise exception 'Race not found';
  end if;
  if v_race.status not in ('open', 'running') or v_race.betting_closed_at is not null then
    raise exception 'Betting is closed';
  end if;
  if not exists (select 1 from public.entries where race_id = p_race and horse_id = p_outcome) then
    raise exception 'This horse is not in the race';
  end if;

  select credits into v_credits from public.players where id = v_player for update;
  if not found then
    raise exception 'Player not found';
  end if;
  if v_credits < p_amount then
    raise exception 'Not enough Oats';
  end if;

  update public.players set credits = credits - p_amount where id = v_player;
  insert into public.bets (race_id, player_id, market, outcome, amount)
  values (p_race, v_player, p_market, p_outcome, p_amount);
end;
$$;

-- Pari-mutuel, no house take. The house seed is part of the pool, and house winnings are discarded.
create function public.settle_race(p_race bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race public.races;
  v_k int;
  v_winner text;
  v_placed text[];
  v_win_tie boolean;
  v_place_tie boolean;
  v_pool numeric;
  v_on_winner numeric;
  v_losing numeric;
begin
  select * into v_race from public.races where id = p_race for update;
  if not found then
    raise exception 'Race not found';
  end if;
  if v_race.status = 'settled' then
    return;
  end if;
  if exists (select 1 from public.entries where race_id = p_race and finish_pos is null) then
    raise exception 'Every entry needs a finish position';
  end if;

  v_k := least(v_race.place_count, (select count(*) from public.entries where race_id = p_race));
  select horse_id into v_winner from public.entries where race_id = p_race and finish_pos = 1;
  select array_agg(horse_id order by finish_pos) into v_placed
  from public.entries where race_id = p_race and finish_pos <= v_k;

  -- A tie on the border of a paying position refunds the player stakes of that market.
  select exists (
    select 1 from public.entries a join public.entries b on b.race_id = a.race_id
    where a.race_id = p_race and a.finish_pos = 1 and b.finish_pos = 2
      and a.solved_ms is not distinct from b.solved_ms
      and a.locks_open = b.locks_open
      and a.last_lock_ms is not distinct from b.last_lock_ms
  ) into v_win_tie;
  select exists (
    select 1 from public.entries a join public.entries b on b.race_id = a.race_id
    where a.race_id = p_race and a.finish_pos = v_k and b.finish_pos = v_k + 1
      and a.solved_ms is not distinct from b.solved_ms
      and a.locks_open = b.locks_open
      and a.last_lock_ms is not distinct from b.last_lock_ms
  ) into v_place_tie;

  if v_win_tie then
    update public.bets set payout = amount where race_id = p_race and market = 'win';
  else
    -- Win: stake x pool / stake on the winner.
    select sum(amount), sum(amount) filter (where outcome = v_winner) into v_pool, v_on_winner
    from public.bets where race_id = p_race and market = 'win';
    update public.bets
    set payout = case when outcome = v_winner then floor(amount * v_pool / v_on_winner) else 0 end
    where race_id = p_race and market = 'win';
  end if;

  if v_place_tie then
    update public.bets set payout = amount where race_id = p_race and market = 'place';
  else
    -- Place: the stakes on the horses that did not place are split into k equal shares, one per placed horse.
    select coalesce(sum(amount) filter (where outcome <> all (v_placed)), 0) into v_losing
    from public.bets where race_id = p_race and market = 'place';
    update public.bets b
    set payout = case when b.outcome = any (v_placed)
      then floor(b.amount * (1 + v_losing / (v_k * (
        select sum(o.amount) from public.bets o
        where o.race_id = p_race and o.market = 'place' and o.outcome = b.outcome
      ))))
      else 0 end
    where b.race_id = p_race and b.market = 'place';
  end if;

  update public.players p
  set credits = p.credits + w.total
  from (
    select player_id, sum(payout) as total
    from public.bets
    where race_id = p_race and player_id is not null
    group by player_id
  ) w
  where p.id = w.player_id and w.total > 0;

  update public.races
  set status = 'settled',
      ended_at = coalesce(ended_at, now()),
      betting_closed_at = coalesce(betting_closed_at, now()),
      winner_horse = v_winner,
      place_horses = v_placed,
      seed_revealed = (select seed from public.race_secrets where race_id = p_race)
  where id = p_race;
end;
$$;

-- Stakes per race, market and horse: the odds and the pool of a race without a read of every bet.
create view public.bet_totals with (security_invoker = true) as
select
  race_id,
  market,
  outcome,
  sum(amount)::int as staked,
  coalesce(sum(amount) filter (where player_id is not null), 0)::int as player_staked,
  count(distinct player_id)::int as bettors
from public.bets
group by race_id, market, outcome;

revoke all on public.bet_totals from anon, authenticated;
grant select on public.bet_totals to anon, authenticated, service_role;

revoke execute on function public.handle_new_user(), public.open_race(text, timestamptz), public.settle_race(bigint)
  from public, anon, authenticated;
grant execute on function public.open_race(text, timestamptz), public.settle_race(bigint) to service_role;
revoke execute on function public.place_bet(bigint, text, text, int), public.enter_model(bigint, text, text)
  from public, anon;
grant execute on function public.place_bet(bigint, text, text, int), public.enter_model(bigint, text, text)
  to authenticated;
