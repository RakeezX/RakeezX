-- AI: local/inert current prerequisites; hosted execution requires separate exact authority.
do $$ begin
 if current_user<>'postgres' or to_regclass('n88_private.task_guidance') is not null or
    to_regclass('n88_private.code_recovery') is null or to_regclass('n88_private.class_visibility') is null or
    not exists(select 1 from pg_roles where rolname='n88_backend' and not rolsuper and not rolbypassrls) or
    has_schema_privilege('authenticated','n88_private','usage') or has_schema_privilege('anon','n88_private','usage') then
   raise exception 'n88_guidance_preflight_unavailable';
 end if;
end $$;
-- AI: INACTIVE additive proposal; local fabricated PG only. No canonical/Auth writes.
create table n88_private.task_guidance (
 owner_id uuid not null references n88_private.contexts(owner_id),
 class_id text not null check(length(class_id) between 1 and 200),
 term_id text not null check(length(term_id) between 1 and 200),
 teaching_id text not null check(length(teaching_id) between 1 and 200),
 subitem_id text not null check(length(subitem_id) between 1 and 200),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1048576),
 primary key(owner_id,class_id,term_id,teaching_id,subitem_id),
 check(payload ?& array['revision','sourceStamp','executionInstructions','deliveryInstructions','bindings']),
 check((payload-array['revision','sourceStamp','executionInstructions','deliveryInstructions','bindings'])='{}'::jsonb),
 check(jsonb_typeof(payload->'revision')='number' and (payload->>'revision')::bigint>0),
 check(payload->>'sourceStamp' ~ '^[a-f0-9]{64}$'),
 check(jsonb_typeof(payload->'executionInstructions')='string' and length(payload->>'executionInstructions')<=400),
 check(jsonb_typeof(payload->'deliveryInstructions')='string' and length(payload->>'deliveryInstructions')<=400),
 check(jsonb_typeof(payload->'bindings')='array' and jsonb_array_length(payload->'bindings')<=2000)
);
revoke all on n88_private.task_guidance from public,anon,authenticated;
alter table n88_private.task_guidance enable row level security;
create policy task_guidance_backend on n88_private.task_guidance to n88_backend
 using(owner_id::text=current_setting('n88.canonical_owner',true))
 with check(owner_id::text=current_setting('n88.canonical_owner',true));
grant select,insert,update on n88_private.task_guidance to n88_backend;
