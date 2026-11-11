-- Checks the new-user trigger, open_race, enter_model, place_bet and settle_race.
-- It runs in one transaction and ends with ROLLBACK, so it leaves no data. Run from backend/:
--   PGPASSWORD=$SUPABASE_DB_PASSWORD psql "host=aws-1-us-west-1.pooler.supabase.com port=5432 user=postgres.kqpkcmcehcdipshlirzi dbname=postgres sslmode=require" -v ON_ERROR_STOP=1 -f supabase/test_bets.sql
begin;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', '{"name": "Ada Test"}'),
  ('00000000-0000-0000-0000-0000000000a2', '{"name": "Ada Other"}'),
  ('00000000-0000-0000-0000-0000000000a3', '{}');

do $$
declare
  a1 uuid := '00000000-0000-0000-0000-0000000000a1';
  a2 uuid := '00000000-0000-0000-0000-0000000000a2';
  v_race bigint;
  v_horse text;
begin
  -- A new user gets 1,000 Oats. Two users with the same first name both get a row.
  assert (select count(*) from public.players where id in (a1, a2) and credits = 1000 and nickname = 'Ada') = 2, 'two players named Ada';
  assert (select nickname from public.players where id = '00000000-0000-0000-0000-0000000000a3') like 'player-%', 'fallback nickname';

  -- A new race has the 6 house horses and a seed of 2,000 Oats per market.
  v_race := public.open_race('vault', now() + interval '10 minutes');
  assert (select count(*) from public.entries where race_id = v_race) = 6, '6 entries';
  assert (select sum(amount) from public.bets where race_id = v_race and market = 'win') = 2000, 'win seed';
  assert (select sum(amount) from public.bets where race_id = v_race and market = 'place') = 2000, 'place seed';

  perform set_config('request.jwt.claims', json_build_object('sub', a1)::text, true);
  perform public.place_bet(v_race, 'win', 'h1', 400);
  perform public.place_bet(v_race, 'place', 'h6', 100);
  assert (select credits from public.players where id = a1) = 500, 'stakes are deducted';

  begin
    perform public.place_bet(v_race, 'win', 'h1', 501);
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
  perform public.place_bet(v_race, 'win', 'h2', 300);
  perform public.place_bet(v_race, 'place', 'h1', 200);

  -- h1 escapes first, h2 second, h3 has 4 locks. The other horses have fewer locks, each a different count.
  update public.entries e
  set finish_pos = f.pos, solved_ms = f.solved, locks_open = f.locks, last_lock_ms = f.last_lock
  from (values
    ('h1', 1, 90000, 5, 90000), ('h2', 2, 120000, 5, 120000), ('h3', 3, null, 4, 150000),
    ('h4', 4, null, 3, 100000), ('h5', 5, null, 2, 80000), ('h6', 6, null, 1, 30000)
  ) as f (horse, pos, solved, locks, last_lock)
  where e.race_id = v_race and e.horse_id = f.horse;
  update public.entries set finish_pos = 7 where race_id = v_race and horse_id = v_horse;
  insert into public.race_secrets (race_id, seed) values (v_race, 'test-seed');

  perform public.settle_race(v_race);

  -- Win pool 2,900 with 900 on h1: 400 pays floor(400 x 2900 / 900) = 1288.
  assert (select payout from public.bets where race_id = v_race and player_id = a1 and market = 'win') = 1288, 'win payout';
  assert (select payout from public.bets where race_id = v_race and player_id = a2 and market = 'win') = 0, 'lost win bet';
  -- Place pool 2,500, 900 on unplaced horses, 3 shares of 300. h1 holds 700: 200 pays floor(200 x (1 + 300 / 700)) = 285.
  assert (select payout from public.bets where race_id = v_race and player_id = a2 and market = 'place') = 285, 'place payout';
  assert (select payout from public.bets where race_id = v_race and player_id = a1 and market = 'place') = 0, 'lost place bet';
  -- The pool balances: all Place payouts together are the Place pool, minus at most 1 Oat per winning bet from the floor.
  assert (select sum(payout) from public.bets where race_id = v_race and market = 'place') between 2496 and 2500, 'place pool balances';
  assert (select sum(payout) from public.bets where race_id = v_race and market = 'win') between 2898 and 2900, 'win pool balances';
  assert (select credits from public.players where id = a1) = 1788, 'credits of the winner';
  assert (select credits from public.players where id = a2) = 785, 'credits of the other player';
  assert (select status = 'settled' and winner_horse = 'h1' and place_horses = array['h1', 'h2', 'h3']
    and seed_revealed = 'test-seed' and betting_closed_at is not null and ended_at is not null
    from public.races where id = v_race), 'race is settled';

  -- A second settle changes nothing, and a bet after the settle fails.
  perform public.settle_race(v_race);
  assert (select credits from public.players where id = a1) = 1788, 'settle is safe to repeat';
  begin
    perform public.place_bet(v_race, 'win', 'h1', 10);
    assert false, 'a bet on a settled race must fail';
  exception when raise_exception then null;
  end;

  -- No horse opens a lock: positions 1 and 2 tie, and positions 3 and 4 tie, so both markets refund.
  v_race := public.open_race('vault', now() + interval '10 minutes');
  perform public.place_bet(v_race, 'win', 'h1', 100);
  perform public.place_bet(v_race, 'place', 'h6', 50);
  update public.entries e set finish_pos = n.pos
  from (select horse_id, row_number() over (order by horse_id) as pos from public.entries where race_id = v_race) n
  where e.race_id = v_race and e.horse_id = n.horse_id;
  perform public.settle_race(v_race);
  assert (select credits from public.players where id = a2) = 785, 'a tie refunds the stakes';
end;
$$;

rollback;
