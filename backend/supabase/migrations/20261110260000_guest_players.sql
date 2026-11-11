-- A guest joins with a QR code, without Google (anonymous sign-in). The guest picks a rider name on /join,
-- and that name goes into the user metadata. A guest gets the same 1,000 Oats as a Google user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.players (id, nickname)
  values (
    new.id,
    left(coalesce(
      case
        -- The guest wrote this name for the public, so all of it is the nickname.
        when new.is_anonymous then nullif(trim(new.raw_user_meta_data ->> 'name'), '')
        -- Google gives one full name. Only the first word goes on the public leaderboard.
        else nullif(split_part(trim(new.raw_user_meta_data ->> 'name'), ' ', 1), '')
      end,
      'player-' || left(new.id::text, 6)
    ), 24)
  );
  return new;
end;
$$;
