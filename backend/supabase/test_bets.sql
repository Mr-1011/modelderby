-- Checks the new-user trigger, open_race, enter_model, place_bet, settle_race and start_race.
-- It runs in one transaction and ends with ROLLBACK, so it leaves no data. Run from backend/:
--   PGPASSWORD=$SUPABASE_DB_PASSWORD psql "host=aws-1-us-west-1.pooler.supabase.com port=5432 user=postgres.kqpkcmcehcdipshlirzi dbname=postgres sslmode=require" -v ON_ERROR_STOP=1 -f supabase/test_bets.sql
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', '{"name": "Ada Test"}'),
  ('00000000-0000-0000-0000-0000000000a2', '{"name": "Ada Other"}'),
  ('00000000-0000-0000-0000-0000000000a3', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', '{"name": "Bo Test"}');

do $$
declare
  a1 uuid := '00000000-0000-0000-0000-0000000000a1';
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
  a3 uuid := '00000000-0000-0000-0000-0000000000a3';
  a4 uuid := '00000000-0000-0000-0000-0000000000a4';
  v_race bigint;
  v_horse text;
begin
  -- A new user gets 1,000 Oats. Two users with the same first name both get a row.
  assert (select count(*) from public.players where id in (a1, a2) and credits = 1000 and nickname = 'Ada') = 2, 'two players named Ada';
  assert (select nickname from public.players where id = '00000000-0000-0000-0000-0000000000a3') like 'player-%', 'fallback nickname';

  -- The payouts below use these seed weights. A later tuning of the house horses must not change them.
  update public.horses h set seed_weight = w.weight
  from (values ('h1', 5), ('h2', 5), ('h3', 4), ('h4', 3), ('h5', 2), ('h6', 1)) as w (id, weight)
  where h.id = w.id;

  -- A new race has the 6 house horses and a seed of 2,000 Oats per market.
  v_race := public.open_race('vault', now() + interval '10 minutes');
  assert (select count(*) from public.entries where race_id = v_race) = 6, '6 entries';
  assert (select sum(amount) from public.bets where race_id = v_race and market = 'win') = 2000, 'win seed';
  assert (select sum(amount) from public.bets where race_id = v_race and market = 'place') = 2000, 'place seed';

  -- The race waits for its first player. The first bet makes it ready and keeps a countdown that is far away.
  assert not (select ready from public.races where id = v_race), 'a new race is not ready';
  perform set_config('request.jwt.claims', json_build_object('sub', a1)::text, true);
  perform public.place_bet(v_race, 'win', 'h1', 400);
  assert (select ready and countdown_ends_at = now() + interval '10 minutes' from public.races where id = v_race), 'the first bet makes the race ready';
  assert (select credits from public.players where id = a1) = 600, 'the stake is deducted';
  begin
    perform public.place_bet(v_race, 'place', 'h6', 10);
    assert false, 'a bet on a second horse must fail';
  exception when raise_exception then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', a3)::text, true);
  perform public.place_bet(v_race, 'place', 'h6', 100);
  perform set_config('request.jwt.claims', json_build_object('sub', a1)::text, true);

  begin
    perform public.place_bet(v_race, 'win', 'h1', 601);
    assert false, 'a bet above the balance must fail';
  exception when raise_exception then null;
  end;
  begin
    perform public.place_bet(v_race, 'win', 'no-horse', 10);
    assert false, 'a bet on a horse outside the race must fail';
  exception when raise_exception then null;
  end;

  -- A player enters one model. It gets a place in the race and seed stakes.
  perform set_config('request.jwt.claims', json_build_object('sub', a2)::text, true);
  v_horse := public.enter_model(v_race, 'mistralai/mistral-large-4-0', 'Test Colt');
  assert (select count(*) from public.entries where race_id = v_race) = 7, '7 entries';
  assert (select sum(amount) from public.bets where race_id = v_race and outcome = v_horse) = 400, 'seed of the new horse';
  begin
    perform public.enter_model(v_race, 'z-ai/glm-5.3', 'Second Colt');
    assert false, 'a second model of the same player must fail';
  exception when raise_exception then null;
  end;
  perform public.place_bet(v_race, 'place', 'h1', 200);
  perform set_config('request.jwt.claims', json_build_object('sub', a4)::text, true);
  perform public.place_bet(v_race, 'win', 'h2', 300);

  -- h1 finishes at the lowest cost, h2 finishes at a higher cost, h3 has a progress of 80.
  -- The other horses have less progress, each a different value.
  update public.entries e
  set finish_pos = f.pos, state = f.state, cost_usd = f.cost, progress = f.progress
  from (values
    ('h1', 1, 'escaped', 0.02, 100), ('h2', 2, 'escaped', 0.05, 100), ('h3', 3, 'timeout', 0.04, 80),
    ('h4', 4, 'timeout', 0.03, 60), ('h5', 5, 'timeout', 0.02, 40), ('h6', 6, 'timeout', 0.01, 20)
  ) as f (horse, pos, state, cost, progress)
  where e.race_id = v_race and e.horse_id = f.horse;
  update public.entries set finish_pos = 7 where race_id = v_race and horse_id = v_horse;
  insert into public.race_secrets (race_id, seed) values (v_race, 'test-seed');

  perform public.settle_race(v_race);

  -- Win pool 2,900 with 900 on h1: 400 pays floor(400 x 2900 / 900) = 1288.
  assert (select payout from public.bets where race_id = v_race and player_id = a1 and market = 'win') = 1288, 'win payout';
  assert (select payout from public.bets where race_id = v_race and player_id = a4 and market = 'win') = 0, 'lost win bet';
  -- Place pool 2,500, 900 on unplaced horses, 3 shares of 300. h1 holds 700: 200 pays floor(200 x (1 + 300 / 700)) = 285.
  assert (select payout from public.bets where race_id = v_race and player_id = a2 and market = 'place') = 285, 'place payout';
  assert (select payout from public.bets where race_id = v_race and player_id = a3 and market = 'place') = 0, 'lost place bet';
  -- The pool balances: all Place payouts together are the Place pool, minus at most 1 Oat per winning bet from the floor.
  assert (select sum(payout) from public.bets where race_id = v_race and market = 'place') between 2496 and 2500, 'place pool balances';
  assert (select sum(payout) from public.bets where race_id = v_race and market = 'win') between 2898 and 2900, 'win pool balances';
  assert (select credits from public.players where id = a1) = 1888, 'credits of the Win winner';
  assert (select credits from public.players where id = a2) = 1085, 'credits of the Place winner';
  assert (select credits from public.players where id = a4) = 700, 'credits of a loser';
  assert (select status = 'settled' and winner_horse = 'h1' and place_horses = array['h1', 'h2', 'h3']
    and seed_revealed = 'test-seed' and betting_closed_at is not null and ended_at is not null
    from public.races where id = v_race), 'race is settled';

  -- A second settle changes nothing, and a bet after the settle fails.
  perform public.settle_race(v_race);
  assert (select credits from public.players where id = a1) = 1888, 'settle is safe to repeat';
  begin
    perform public.place_bet(v_race, 'win', 'h1', 10);
    assert false, 'a bet on a settled race must fail';
  exception when raise_exception then null;
  end;

  -- No horse makes progress or has a cost: positions 1 and 2 tie, and positions 3 and 4 tie, so both markets refund.
  -- One player can use both markets on the same horse.
  v_race := public.open_race('vault', now() + interval '10 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', a2)::text, true);
  perform public.place_bet(v_race, 'win', 'h1', 100);
  perform public.place_bet(v_race, 'place', 'h1', 50);
  update public.entries e set finish_pos = n.pos
  from (select horse_id, row_number() over (order by horse_id) as pos from public.entries where race_id = v_race) n
  where e.race_id = v_race and e.horse_id = n.horse_id;
  perform public.settle_race(v_race);
  assert (select credits from public.players where id = a2) = 1085, 'a tie refunds the stakes';

  -- A race with a countdown in the past waits. Its first player gets a new countdown of 60 seconds.
  v_race := public.open_race('vault', now() - interval '1 minute');
  v_horse := public.enter_model(v_race, 'z-ai/glm-5.3', 'Late Colt');
  assert (select ready and countdown_ends_at = now() + interval '60 seconds' from public.races where id = v_race), 'the first player starts a new countdown';

  -- Only an admin starts a race by hand. The race is then ready without a player and starts in 20 seconds.
  v_race := public.open_race('vault', now() + interval '10 minutes');
  begin
    perform public.start_race(v_race);
    assert false, 'a start by a player who is not an admin must fail';
  exception when raise_exception then null;
  end;
  insert into public.admins (player_id) values (a2);
  perform public.start_race(v_race);
  assert (select ready and countdown_ends_at = now() + interval '20 seconds' from public.races where id = v_race), 'an admin starts a race';
end;
$$;

rollback;
