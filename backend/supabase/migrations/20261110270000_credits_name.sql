-- The play money is named Credits, not Oats. One message of place_bet had the old name.
-- The function comes from the database, so its body stays as the last migration wrote it.
do $$
begin
  execute replace(
    pg_get_functiondef('public.place_bet(bigint, text, text, int)'::regprocedure),
    'Not enough Oats', 'Not enough Credits'
  );
end;
$$;
