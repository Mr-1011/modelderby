-- New start rules: a race starts only when a player is in it or an admin starts it.
-- A player bets on one horse per race.

-- True when a player has a bet or a model in the race, or an admin started it. The runner starts only a ready race.
alter table public.races add column ready boolean not null default false;

-- Who can start a race by hand. Only the service role reads or writes this table.
create table public.admins (
  player_id uuid primary key references public.players (id)
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant all on public.admins to service_role;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where player_id = auth.uid());
$$;

-- An admin starts an open race now, also when no player is in it.
create function public.start_race(p_race bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can start a race';
  end if;
  -- 20 seconds: the runner builds the room before the countdown ends. The runner can be at work on a ready
  -- race already, so the countdown of a ready race only moves to an earlier time.
  update public.races
  set ready = true,
      countdown_ends_at = case
        when ready then least(countdown_ends_at, now() + interval '20 seconds')
        else now() + interval '20 seconds'
      end
  where id = p_race and status = 'open';
  if not found then
    raise exception 'This race is not open';
  end if;
end;
$$;

create or replace function public.enter_model(p_race bigint, p_model text, p_name text)
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
  -- A race that is not ready waits for its first player, so its countdown does not close the entries.
  if v_race.status <> 'open' or (v_race.ready and v_race.countdown_ends_at <= now()) then
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

  -- The first player makes the race ready. The other players then have at least 60 seconds to get in.
  if not v_race.ready then
    update public.races
    set ready = true, countdown_ends_at = greatest(countdown_ends_at, now() + interval '60 seconds')
    where id = p_race;
  end if;

  return v_horse;
end;
$$;

create or replace function public.place_bet(p_race bigint, p_market text, p_outcome text, p_amount int)
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

  -- The lock makes the close of betting wait for a bet that is in progress, and it lets the first bet change the race.
  select * into v_race from public.races where id = p_race for update;
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
  -- After the lock on the player, so two bets of one player at the same moment cannot pass this check together.
  if exists (
    select 1 from public.bets where race_id = p_race and player_id = v_player and outcome <> p_outcome
  ) then
    raise exception 'You can bet on one horse per race';
  end if;
  if v_credits < p_amount then
    raise exception 'Not enough Oats';
  end if;

  update public.players set credits = credits - p_amount where id = v_player;
  insert into public.bets (race_id, player_id, market, outcome, amount)
  values (p_race, v_player, p_market, p_outcome, p_amount);

  -- The first player makes the race ready. The other players then have at least 60 seconds to get in.
  if v_race.status = 'open' and not v_race.ready then
    update public.races
    set ready = true, countdown_ends_at = greatest(countdown_ends_at, now() + interval '60 seconds')
    where id = p_race;
  end if;
end;
$$;

revoke execute on function public.is_admin(), public.start_race(bigint) from public, anon;
grant execute on function public.is_admin(), public.start_race(bigint) to authenticated;
