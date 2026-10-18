/** AI: offline preparation only. Provider SQL definitions are comparison data, never executed. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const dir='drafts/n44-push/activation/';
export const migration='supabase/migrations/20261018044448_n44_exact_activation_staged.sql';
export const input='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-0636-service-preflight/metadata.json';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const tables=['sessions','score_subitems','items','years','sections','subjects','calendars','calendar_days','terms','teachings'];
export const required={
 sessions:{id:'text',owner_id:'uuid',teaching_id:'text',date:'date',start_time:'time',end_time:'time',status:'text',revision:'int8',deleted_at:'timestamptz'},
 score_subitems:{id:'text',owner_id:'uuid',item_id:'text',start_date:'date',due_date:'date',revision:'int8',deleted_at:'timestamptz'},
 items:{id:'text',owner_id:'uuid',teaching_id:'text',score_mode:'text',revision:'int8',deleted_at:'timestamptz'},
 years:{id:'text',owner_id:'uuid',status:'text',hijri_start:'int4',hijri_end:'int4',calendar_preset_id:'text',revision:'int8',deleted_at:'timestamptz'},
 sections:{id:'text',owner_id:'uuid',year_id:'text',status:'text',revision:'int8',deleted_at:'timestamptz'},
 subjects:{id:'text',owner_id:'uuid',revision:'int8',deleted_at:'timestamptz'},
 calendars:{id:'text',owner_id:'uuid',year_id:'text',source:'text',preset_id:'text',term_date_overrides:'jsonb',revision:'int8',deleted_at:'timestamptz'},
 calendar_days:{id:'text',owner_id:'uuid',calendar_id:'text',date:'date',kind:'text',revision:'int8',deleted_at:'timestamptz'},
 terms:{id:'text',owner_id:'uuid',year_id:'text',index:'int4',status:'text',start_date:'date',end_date:'date',revision:'int8',deleted_at:'timestamptz'},
 teachings:{id:'text',owner_id:'uuid',section_id:'text',subject_id:'text',term_id:'text',revision:'int8',deleted_at:'timestamptz'}
};
const lit=s=>"'"+s.replaceAll("'","''")+"'";
await mkdir(dir,{recursive:true});
const raw=await readFile(input);assert.equal(hash(raw),'b0abdcb656880f0660d43d4678ce1191fb8ccd7eed2e957f519d33aa5f55f334');
const capture=JSON.parse(raw),m=capture.metadata;
const evidenceRoot='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-0636-service-preflight/';
const addonRaw=await readFile(evidenceRoot+'metadata-addendum.json'),capRaw=await readFile(evidenceRoot+'management-capabilities.json');
assert.equal(hash(addonRaw),'e1f5276131ada32af32eb7ba467b74a4f84a993a3cdc265445873c95131b9e09');
assert.equal(hash(capRaw),'49a4e708b7e86001f62222600880591483bac2110b32415270cc54b44410e5c1');
const addon=JSON.parse(addonRaw),cap=JSON.parse(capRaw);
for(const v of [addon,cap]){assert.equal(v.projectId,capture.projectId);assert.equal(v.personalRowsRead,0);assert.equal(v.readOnly,true);}
assert.deepEqual(addon.metadata.auth_policies,[]);
for(const r of addon.metadata.auth_rls){assert.equal(r.enabled,true);assert.equal(r.forced,false);assert.equal(r.owner,'supabase_auth_admin');}
assert.deepEqual(cap.capabilities,{management_role:'postgres',management_session_role:'postgres',management_bypassrls:true,management_superuser:false,auth_owner_member:false,auth_schema_create:false});
for(const [table,definition]of [['users','PRIMARY KEY (id)'],['sessions','PRIMARY KEY (id)'],['sessions','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE']])assert.ok(addon.metadata.auth_constraints.some(c=>c.table===table&&c.definition===definition));
for(const t of m.triggers.filter(t=>tables.includes(t.table)))assert.ok(addon.metadata.canonical_trigger_functions.some(f=>f.name===t.function_name&&f.schema===t.function_schema),t.function_name);
const revision=addon.metadata.canonical_trigger_functions.find(f=>f.name==='sync_v2_stamp_revision');
assert.match(revision.definition,/v_next_revision := old.revision \+ 1/);assert.match(revision.definition,/if old.deleted_at is not null then\s+return null/);
assert.match(addon.metadata.canonical_trigger_functions.find(f=>f.name==='record_owner_sync_change').definition,/Owner identity is immutable/);
assert.equal(capture.projectId,'xlrubcwjqktzzunrvuns');assert.equal(capture.personalRowsRead,0);
assert.deepEqual(m.private_roles,[]);assert.deepEqual(m.private_schemas,[]);
const columns=m.columns.filter(c=>c.schema==='auth'||c.schema==='rakeezx'&&required[c.table]?.[c.column]);
for(const [table,cols] of Object.entries(required))for(const [column,type]of Object.entries(cols)) {
  const c=columns.find(c=>c.schema==='rakeezx'&&c.table===table&&c.column===column);
  assert.equal(c?.udt,type,table+'.'+column);
}
const constraints=m.constraints.filter(c=>c.schema==='rakeezx'&&tables.includes(c.table));
const triggers=m.triggers.filter(c=>tables.includes(c.table));
const rls=m.rls.filter(c=>tables.includes(c.table));
for(const table of tables) {
  assert.ok(constraints.some(c=>c.table===table&&c.definition==='PRIMARY KEY (owner_id, id)'));
  assert.ok(constraints.some(c=>c.table===table&&c.definition==='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE'));
  assert.ok(triggers.some(c=>c.table===table&&c.name===table+'_sync_v2_revision'&&c.function_name==='sync_v2_stamp_revision'));
  assert.deepEqual(rls.find(c=>c.table===table),{table,forced:true,enabled:true});
}
const contract={aiAuthored:true,capturedAt:capture.capturedAt,metadataCapturedAt:m.captured_at,projectId:capture.projectId,inputSha256:hash(raw),columns,constraints,triggers,rls,
  addendum:{capturedAt:addon.capturedAt,sha256:hash(addonRaw),metadata:addon.metadata},management:{capturedDuring:cap.capturedDuring,sha256:hash(capRaw),capabilities:cap.capabilities},
  limitations:['Read-only snapshots prove captured identities, not future provider state. Full metadata preflight must pass at separately authorized hosted application.','Local replica covers consumed columns, FK lock topology, forced canonical RLS and managed Auth RLS/owner with zero policies; private management helpers run as NON-superuser existing postgres. It is not a repeat of all canonical write-trigger/Sync/restore checks.']};
await writeFile(dir+'metadata-contract.json',JSON.stringify(contract,null,2)+'\n');
let checks=[];
for(const c of columns)checks.push(`if not exists(select 1 from information_schema.columns where table_schema=${lit(c.schema)} and table_name=${lit(c.table)} and column_name=${lit(c.column)} and udt_name=${lit(c.udt)} and is_nullable=${lit(c.nullable)}) then raise exception 'N44 column mismatch: ${c.schema}.${c.table}.${c.column}'; end if;`);
for(const c of constraints)checks.push(`if not exists(select 1 from pg_constraint where conrelid=${lit(c.schema+'.'+c.table)}::regclass and conname=${lit(c.name)} and convalidated and not condeferrable and pg_get_constraintdef(oid)=${lit(c.definition)}) then raise exception 'N44 constraint mismatch: ${c.name}'; end if;`);
for(const t of triggers)checks.push(`if not exists(select 1 from pg_trigger where tgrelid=${lit('rakeezx.'+t.table)}::regclass and tgname=${lit(t.name)} and tgenabled='O' and pg_get_triggerdef(oid)=${lit(t.definition)}) then raise exception 'N44 trigger mismatch: ${t.name}'; end if;`);
for(const t of tables)checks.push(`if not exists(select 1 from pg_class where oid='rakeezx.${t}'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N44 forced RLS mismatch: ${t}'; end if;`);
for(const f of addon.metadata.canonical_trigger_functions.filter(f=>triggers.some(t=>t.function_name===f.name&&t.function_schema===f.schema))) {
  const md5=createHash('md5').update(f.definition.replaceAll('\r\n','\n')).digest('hex');
  checks.push(`if not exists(select 1 from pg_proc where oid=to_regprocedure(${lit(f.schema+'.'+f.name+'('+f.identity_arguments+')')}) and proowner::regrole::text=${lit(f.owner)} and prosecdef=${f.security_definer} and md5(replace(pg_get_functiondef(oid),E'\\r\\n',E'\\n'))=${lit(md5)}) then raise exception 'N44 canonical function identity mismatch: ${f.name}'; end if;`);
}
// These are explicitly authored predicates, NOT execution of captured SQL definitions.
const auth=`if not has_column_privilege('postgres','auth.users','id','REFERENCES') then raise exception 'N44 existing management Auth REFERENCES prerequisite not verified; do not widen privileges automatically'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.users'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)' and convalidated and not condeferrable) then raise exception 'N44 Auth user PK prerequisite'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)' and convalidated and not condeferrable) then raise exception 'N44 Auth session PK prerequisite'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and contype='f' and confrelid='auth.users'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N44 Auth session FK prerequisite'; end if;
if (select count(*) from pg_class where oid in ('auth.users'::regclass,'auth.sessions'::regclass) and relrowsecurity and not relforcerowsecurity and relowner::regrole::text='supabase_auth_admin')<>2 then raise exception 'N44 managed Auth owner/RLS mismatch'; end if;
if exists(select 1 from pg_policies where schemaname='auth' and tablename in ('users','sessions')) then raise exception 'N44 managed Auth policy mismatch'; end if;
if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and rolbypassrls and not rolsuper and rolcreaterole) or pg_has_role('postgres','supabase_auth_admin','MEMBER') or has_schema_privilege('postgres','auth','CREATE') then raise exception 'N44 existing management capability mismatch'; end if;
if not has_column_privilege('postgres','auth.users','id','SELECT') or not has_column_privilege('postgres','auth.users','banned_until','SELECT') or not has_column_privilege('postgres','auth.users','id','UPDATE') or not has_column_privilege('postgres','auth.sessions','id','SELECT') or not has_column_privilege('postgres','auth.sessions','user_id','SELECT') or not has_column_privilege('postgres','auth.sessions','not_after','SELECT') or not has_column_privilege('postgres','auth.sessions','id','UPDATE') then raise exception 'N44 existing management exact Auth lock privileges unavailable'; end if;`;
const collision=`if exists(select 1 from pg_namespace where nspname='n44_push_draft') or exists(select 1 from pg_roles where rolname in ('n44_guard','n44_backend')) then raise exception 'N44 collision: never reapply/adopt existing private objects'; end if;
if to_regclass('supabase_migrations.schema_migrations') is not null then
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261018044448') then raise exception 'N44 migration history collision'; end if;
end if;`;
await writeFile(dir+'preflight.inactive.sql',`-- AI: metadata-only, no personal rows. Authorized auditor only. No apply command.\nbegin read only;\nset local statement_timeout='5s';\ndo $n44$ begin\n${collision}\n${checks.join('\n')}\n${auth}\nend $n44$;\nselect 'xlrubcwjqktzzunrvuns' as expected_project, current_database(), version();\n-- Also independently verify actual project identity, unexposed private schema, Auth issuer/JWKS/session policy, revision bodies/lifecycle commands.\nrollback;\n`);
// Migration guards consumed column/PK/FK/RLS assumptions; trigger comparison belongs to fresh preflight.
const topologyNames=new Set(tables.flatMap(t=>[t+'_pkey',t+'_owner_id_fkey']).concat([
  'terms_owner_id_year_id_fkey','sections_owner_id_year_id_fkey','teachings_owner_id_section_id_fkey','teachings_owner_id_subject_id_fkey','teachings_owner_id_term_id_fkey','items_owner_id_teaching_id_fkey','sessions_owner_id_teaching_id_fkey','score_subitems_owner_id_item_id_fkey','calendars_owner_id_year_id_fkey','calendar_days_owner_id_calendar_id_fkey']));
const guardChecks=checks.filter(s=>!s.includes('pg_trigger')&&!s.includes('canonical function identity')&&(!s.includes('pg_constraint')||[...topologyNames].some(n=>s.includes("conname='"+n+"'"))));
let sql=`-- AI-authored staged candidate. CLI v2.117.0 migration new, 2026-10-18. NEVER APPLIED.\n-- Exact project xlrubcwjqktzzunrvuns; requires separate hosted approval and passing full preflight.\n-- Fresh-only; no credentials, contexts, source rows, route, cron or Auth settings.\nbegin;\nset local lock_timeout='1s';\nset local statement_timeout='15s';\nselect pg_advisory_xact_lock(4400182026);\ndo $n44$ begin\n${collision}\n${guardChecks.join('\n')}\n${auth}\nend $n44$;\ncreate role n44_backend nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;\n`;
// Compose only reviewed local SQL; never execute captured provider definitions.
let schema=await readFile('drafts/n44-push/schema-proposal.sql','utf8');
schema=schema.replace(/^begin;$/m,'').replace(/^commit;$/m,'').replace('-- DRAFT ONLY. Not a migration, not applied; keep outside supabase/ paths.','-- Reviewed SQL composition; staged migration only, never applied hosted.');
// Private backend only: remove dormant authenticated policies, not canonical guards.
schema=schema.split('\n').filter(l=>!l.includes("create policy owner_")).join('\n');
let host=await readFile('drafts/n44-push/existing-host.inactive.sql','utf8');
host=host.replace(/^create role n44_.*;$/gm,'');
let canonical=await readFile('drafts/n44-push/canonical-source.inactive.sql','utf8');
// Grant while still owned by postgres; transfer with short-lived SET + CREATE only.
canonical=canonical.replace('alter function n44_push_draft.read_source(uuid,text,text) owner to n44_guard;','');
sql=sql.replace('create role n44_backend nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;',
 'create role n44_backend nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;\ncreate role n44_guard nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;');
sql+='\n'+schema+'\n'+host+'\n'+canonical;
sql+=`\ngrant create on schema n44_push_draft to n44_guard;
grant n44_guard to postgres with set true, inherit false;
alter function n44_push_draft.read_source(uuid,text,text) owner to n44_guard;
revoke create on schema n44_push_draft from n44_guard;
grant n44_guard to postgres with set false, inherit false;
commit;\n`;
await writeFile(migration,sql);
console.log('N44 metadata SHA verified; exact staged migration and fail-closed metadata preflight prepared.');
