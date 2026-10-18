-- AI: mirror the observed managed Auth RLS/ownership and existing management capability.
create role supabase_auth_admin nologin nosuperuser nobypassrls;
create role postgres nologin nosuperuser bypassrls;
alter table auth.users add column phone text;
alter table auth.users add column email_change_confirm_status smallint default 0;
alter table auth.users add constraint users_phone_key unique(phone);
alter table auth.users add constraint users_email_change_confirm_status_check check(email_change_confirm_status between 0 and 2);
create table auth.oauth_clients(id uuid primary key);
alter table auth.sessions add column oauth_client_id uuid references auth.oauth_clients(id) on delete cascade;
alter table auth.sessions add column scopes text;
alter table auth.sessions add constraint sessions_scopes_length check(char_length(scopes)<=4096);
alter schema auth owner to supabase_auth_admin;
alter table auth.users owner to supabase_auth_admin;
alter table auth.sessions owner to supabase_auth_admin;
alter table auth.users enable row level security;
alter table auth.sessions enable row level security;
grant usage on schema auth to postgres;
grant select(id,banned_until),update(id) on auth.users to postgres;
grant select(id,user_id,not_after),update(id) on auth.sessions to postgres;
-- No Auth policies, FORCE/BYPASS changes, auth CREATE, auth membership, or new public reader.
