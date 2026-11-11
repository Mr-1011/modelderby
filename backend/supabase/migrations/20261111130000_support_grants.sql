-- support_messages got the default grants of Supabase. Like the secrets tables, it has no grant for a client:
-- only send_support (security definer) writes to it, and only the service role reads it.
revoke all on public.support_messages from anon, authenticated;
revoke all on sequence public.support_messages_id_seq from anon, authenticated;
grant all on public.support_messages to service_role;
