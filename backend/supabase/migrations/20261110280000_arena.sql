-- A race is a house race or an Arena race, never both. A house race has only the house horses.
-- Only an Arena race takes the models of players.
alter table public.races add column arena boolean not null default false;

-- The old runner calls open_race with two arguments, and that call still works.
drop function public.open_race(text, timestamptz);

create function public.open_race(p_task text, p_countdown_ends_at timestamptz, p_arena boolean default false)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race bigint;
begin
  insert into public.races (task, countdown_ends_at, place_count, arena)
  values (p_task, p_countdown_ends_at, 3, p_arena)
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

revoke execute on function public.open_race(text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.open_race(text, timestamptz, boolean) to service_role;

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
  if not v_race.arena then
    raise exception 'Only an Arena race takes the model of a player';
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
