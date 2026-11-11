-- The ops view (/ops) shows what the runner does in a race: the base room, the forks, each model step and each
-- tool call. A tool call can show the content of a hidden challenge, so only an admin can read this table.
create table public.race_events (
  id bigserial primary key,
  race_id bigint not null references public.races (id) on delete cascade,
  horse_id text references public.horses (id),  -- null = an event of the whole race
  at timestamptz not null default now(),
  kind text not null,                  -- base_built | fork_created | step | tool_call | checkpoint | solved | out | timeout | failed | settled
  text text,                           -- step: the first words of the model. tool_call: the command, max 120 characters.
  cost_usd numeric,                    -- step: the cost of that model call
  tokens_in int,
  tokens_out int
);

create index race_events_race_id_idx on public.race_events (race_id, id);

alter table public.race_events enable row level security;
create policy "Admins can read race events" on public.race_events for select to authenticated using ((select public.is_admin()));
revoke all on public.race_events from anon, authenticated;
grant select on public.race_events to authenticated;
grant all on public.race_events to service_role;
grant usage, select on sequence public.race_events_id_seq to service_role;
