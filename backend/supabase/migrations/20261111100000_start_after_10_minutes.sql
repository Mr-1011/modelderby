-- The first player starts a countdown of 10 minutes, so other players have time to get in.
-- Before, the countdown was the first countdown of the race, or 60 seconds when that was in the past.
-- The functions come from the database, so the rest of their bodies stays as the last migration wrote it.
do $$
declare
  v_function regprocedure;
  v_body text;
begin
  foreach v_function in array array[
    'public.place_bet(bigint, text, text, int)'::regprocedure,
    'public.enter_model(bigint, text, text)'::regprocedure
  ] loop
    v_body := pg_get_functiondef(v_function);
    assert v_body like '%greatest(countdown_ends_at, now() + interval ''60 seconds'')%', v_function || ' has no countdown of 60 seconds';
    execute replace(
      replace(v_body, 'greatest(countdown_ends_at, now() + interval ''60 seconds'')', 'now() + interval ''10 minutes'''),
      'then have at least 60 seconds', 'then have 10 minutes'
    );
  end loop;
end;
$$;
