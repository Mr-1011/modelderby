-- Each race runs its room at one level: 1 is the easy room, 3 the hard one. The runner picks the level when it
-- opens the race, and the blurb of the challenge names the size of the job at that level.
alter table public.races add column level smallint not null default 1 check (level between 1 and 3);

-- The runner of the last deploy calls open_race with two arguments, and that call still works.
drop function public.open_race(text, timestamptz, boolean);

create function public.open_race(
  p_task text,
  p_countdown_ends_at timestamptz,
  p_arena boolean default false,
  p_level int default 1
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race bigint;
begin
  insert into public.races (task, countdown_ends_at, place_count, arena, level)
  values (p_task, p_countdown_ends_at, 3, p_arena, p_level)
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

revoke execute on function public.open_race(text, timestamptz, boolean, int) from public, anon, authenticated;
grant execute on function public.open_race(text, timestamptz, boolean, int) to service_role;
