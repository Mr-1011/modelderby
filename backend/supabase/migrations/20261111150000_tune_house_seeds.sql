-- The house seed after the trial races of 2026-11-11, one for each room and level (27 in all). Luna Sprint won 19,
-- Midnight Diff 3, Terra Firma, Twin Flash and Open Range 1 each, and Dark Matter none. The cheapest model that solves
-- the room wins, so a cheap model that solves it beats each frontier model, and Luna Sprint is the favorite now.
-- The total stays 20, so the seed stays 2,000 Credits per market.
update public.horses set seed_weight = 10 where id = 'h5';
update public.horses set seed_weight = 3 where id = 'h1';
update public.horses set seed_weight = 2 where id in ('h2', 'h4', 'h6');
update public.horses set seed_weight = 1 where id = 'h3';

-- An open race with no bet of a player gets the new seed too.
update public.bets b set amount = h.seed_weight * 100
from public.horses h, public.races r
where b.outcome = h.id and b.race_id = r.id and b.player_id is null and h.kind = 'house' and r.status = 'open'
  and not exists (select 1 from public.bets p where p.race_id = r.id and p.player_id is not null);
