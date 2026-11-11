-- The support page: a visitor or a player sends one text to us. Only the service role reads the messages.

create table public.support_messages (
  id bigint generated always as identity primary key,
  player_id uuid references public.players (id) on delete set null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- No policy and no grant: no client reads or writes this table directly.
alter table public.support_messages enable row level security;

-- A signed-in player sends only the text, and the email comes from the account. A visitor gives an email.
create function public.send_support(p_message text, p_email text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
  v_message text := btrim(p_message);
  v_email text;
begin
  if v_message is null or char_length(v_message) not between 1 and 5000 then
    raise exception 'The message must have 1 to 5000 characters';
  end if;
  if v_player is not null then
    select email into v_email from auth.users where id = v_player;
  else
    v_email := btrim(p_email);
    if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'This email address is not valid';
    end if;
  end if;
  insert into public.support_messages (player_id, email, message) values (v_player, v_email, v_message);
end;
$$;

revoke execute on function public.send_support(text, text) from public;
grant execute on function public.send_support(text, text) to anon, authenticated;
