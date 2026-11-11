-- The rules of 2026-11-10 20:15 PT: the horse that solves the challenge at the lowest cost wins, not the fastest.
-- The runner sets finish_pos with finishOrder in shared/src/finish.ts: the finishers by cost, then the other
-- horses by progress, and the cheaper horse first on equal progress.

-- 0 to 100 from the progress function of the challenge, written live by the runner. 100 = solved.
alter table public.entries add column progress int not null default 0;
-- One line that shows the challenge state of the horse, for the screens: the 54 stickers of the cube, or the
-- rows of the rover map joined with '/'. Null before the race and in a room without a picture.
alter table public.entries add column view text;
comment on column public.entries.state is 'waiting | running | escaped | failed | timeout | out (stopped by live elimination)';

-- The races before this rule counted locks.
update public.entries set progress = locks_open * 20;

-- A room with a command line tool has one row: the whole room is one task.
insert into public.challenges (id, room, lock, category, public_blurb) values
  ('cube-1', 'cube', 1, 'puzzle', 'Solve a scrambled Rubik''s cube with a command line tool.'),
  ('rover-1', 'rover', 1, 'robotics', 'Drive a rover through a warehouse and deliver one package before the battery is empty.');

-- The same function as before, with a new tie rule: two horses tie when both finished or both did not, with the
-- same progress and the same cost.
create or replace function public.settle_race(p_race bigint)
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
      and (a.state = 'escaped') = (b.state = 'escaped')
      and (a.state = 'failed') = (b.state = 'failed')
      and a.progress = b.progress
      and a.cost_usd = b.cost_usd
  ) into v_win_tie;
  select exists (
    select 1 from public.entries a join public.entries b on b.race_id = a.race_id
    where a.race_id = p_race and a.finish_pos = v_k and b.finish_pos = v_k + 1
      and (a.state = 'escaped') = (b.state = 'escaped')
      and (a.state = 'failed') = (b.state = 'failed')
      and a.progress = b.progress
      and a.cost_usd = b.cost_usd
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
