-- The profile of a player: the public name and the rider, which is the public icon of the player.

-- One number per part of the rider, in the order of PARTS in frontend/src/lib/rider.ts.
-- Null = the player built no rider, and the frontend draws one from the player id.
alter table public.players add column rider smallint[];

create function public.set_profile(p_nickname text, p_rider smallint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
  v_name text := btrim(p_nickname);
begin
  if v_player is null then
    raise exception 'Sign in to change your profile';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 24 then
    raise exception 'The name must have 1 to 24 characters';
  end if;
  -- Each client draws the rider of each player and uses a number as an index.
  -- So only a flat list of numbers from 0 gets in.
  if array_ndims(p_rider) is distinct from 1 or cardinality(p_rider) > 16
    or exists (select from unnest(p_rider) as n where n is null or n < 0) then
    raise exception 'This rider is not valid';
  end if;
  update public.players set nickname = v_name, rider = p_rider where id = v_player;
end;
$$;

revoke execute on function public.set_profile(text, smallint[]) from public, anon;
grant execute on function public.set_profile(text, smallint[]) to authenticated;
