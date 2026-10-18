-- AI: catalog-only preflight for the UNAPPLIED six-v1 amendment; no source/student rows.
begin read only;
set local statement_timeout='5s';
do $$ begin
if current_user<>'postgres' then raise exception 'N88 management identity mismatch';end if;
if not exists(select 1 from pg_constraint where conrelid='n88_private.numeric_credentials'::regclass
  and conname='numeric_credentials_payload_check3' and convalidated and not condeferrable
  and pg_get_constraintdef(oid)=$expected$CHECK (((payload - ARRAY['id'::text, 'ownerId'::text, 'studentId'::text, 'version'::text, 'reservation'::text, 'verifier'::text, 'keyVersion'::text, 'revokedAt'::text]) = '{}'::jsonb))$expected$)
then raise exception 'N88 prior integrated constraint mismatch';end if;
if to_regprocedure('n88_private.numeric_six_capacity_guard()') is not null then raise exception 'N88 amendment collision';end if;
if to_regclass('supabase_migrations.schema_migrations') is not null then
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261018034356') or
     not exists(select 1 from supabase_migrations.schema_migrations where version='20261018102843') or
     exists(select 1 from supabase_migrations.schema_migrations where version='20261018110713') then
    raise exception 'N88 exact migration history mismatch';
  end if;
end if;
end $$;
-- Also compare full prior-six-amendment-integrated-expected-identities.json using the
-- existing metadata-only verifier, and independently verify the authorized project.
rollback;
