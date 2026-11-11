-- The final diff of a horse holds files of a hidden challenge, so no client reads entries.diff.
-- A client reads the columns below. A new column of entries needs its own grant.
revoke select on public.entries from anon, authenticated;
grant select (
  race_id, horse_id, sandbox_id, state, progress, view, locks_open, locks, steps, last_step,
  cost_usd, tokens, solved_ms, last_lock_ms, finish_pos
) on public.entries to anon, authenticated;
