/** AI: offline preparation only. Provider SQL definitions are comparison data, never executed. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const dir='drafts/n88-student-portal/activation/';
export const migration='supabase/migrations/20261018034356_n88_exact_activation_staged.sql';
export const input='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/intake-evidence/po-0636-service-preflight/metadata.json';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const tables=['years','terms','sections','students','enrollments','teachings','items'];
export const required={
  years:{owner_id:'uuid',id:'text',status:'text',deleted_at:'timestamptz',revision:'int8'},
  terms:{owner_id:'uuid',id:'text',year_id:'text',status:'text',deleted_at:'timestamptz',revision:'int8'},
  sections:{owner_id:'uuid',id:'text',year_id:'text',status:'text',deleted_at:'timestamptz',revision:'int8'},
  students:{owner_id:'uuid',id:'text',name:'text',status:'text',deleted_at:'timestamptz',revision:'int8'},
  enrollments:{owner_id:'uuid',id:'text',section_id:'text',student_id:'text',revision:'int8',status:'text',end_date:'date',deleted_at:'timestamptz'},
  teachings:{owner_id:'uuid',id:'text',section_id:'text',term_id:'text',deleted_at:'timestamptz',revision:'int8'},
  items:{owner_id:'uuid',id:'text',teaching_id:'text',name:'text',auto:'text',deleted_at:'timestamptz',revision:'int8'}
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
const columns=m.columns.filter(c=>c.schema==='auth'||required[c.table]?.[c.column]);
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
for(const c of columns)checks.push(`if not exists(select 1 from information_schema.columns where table_schema=${lit(c.schema)} and table_name=${lit(c.table)} and column_name=${lit(c.column)} and udt_name=${lit(c.udt)} and is_nullable=${lit(c.nullable)}) then raise exception 'N88 column mismatch: ${c.schema}.${c.table}.${c.column}'; end if;`);
for(const c of constraints)checks.push(`if not exists(select 1 from pg_constraint where conrelid=${lit(c.schema+'.'+c.table)}::regclass and conname=${lit(c.name)} and convalidated and not condeferrable and pg_get_constraintdef(oid)=${lit(c.definition)}) then raise exception 'N88 constraint mismatch: ${c.name}'; end if;`);
for(const t of triggers)checks.push(`if not exists(select 1 from pg_trigger where tgrelid=${lit('rakeezx.'+t.table)}::regclass and tgname=${lit(t.name)} and tgenabled='O' and pg_get_triggerdef(oid)=${lit(t.definition)}) then raise exception 'N88 trigger mismatch: ${t.name}'; end if;`);
for(const t of tables)checks.push(`if not exists(select 1 from pg_class where oid='rakeezx.${t}'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 forced RLS mismatch: ${t}'; end if;`);
for(const f of addon.metadata.canonical_trigger_functions) {
  const md5=createHash('md5').update(f.definition.replaceAll('\r\n','\n')).digest('hex');
  checks.push(`if not exists(select 1 from pg_proc where oid=to_regprocedure(${lit(f.schema+'.'+f.name+'('+f.identity_arguments+')')}) and proowner::regrole::text=${lit(f.owner)} and prosecdef=${f.security_definer} and md5(replace(pg_get_functiondef(oid),E'\\r\\n',E'\\n'))=${lit(md5)}) then raise exception 'N88 canonical function identity mismatch: ${f.name}'; end if;`);
}
// These are explicitly authored predicates, NOT execution of captured SQL definitions.
const auth=`if not exists(select 1 from pg_constraint where conrelid='auth.users'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)' and convalidated and not condeferrable) then raise exception 'N88 Auth user PK prerequisite'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)' and convalidated and not condeferrable) then raise exception 'N88 Auth session PK prerequisite'; end if;
if not exists(select 1 from pg_constraint where conrelid='auth.sessions'::regclass and contype='f' and confrelid='auth.users'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 Auth session FK prerequisite'; end if;
if (select count(*) from pg_class where oid in ('auth.users'::regclass,'auth.sessions'::regclass) and relrowsecurity and not relforcerowsecurity and relowner::regrole::text='supabase_auth_admin')<>2 then raise exception 'N88 managed Auth owner/RLS mismatch'; end if;
if exists(select 1 from pg_policies where schemaname='auth' and tablename in ('users','sessions')) then raise exception 'N88 managed Auth policy mismatch'; end if;
if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and rolbypassrls and not rolsuper and rolcreaterole) or pg_has_role('postgres','supabase_auth_admin','MEMBER') or has_schema_privilege('postgres','auth','CREATE') then raise exception 'N88 existing management capability mismatch'; end if;
if not has_column_privilege('postgres','auth.users','id','SELECT') or not has_column_privilege('postgres','auth.users','banned_until','SELECT') or not has_column_privilege('postgres','auth.users','id','UPDATE') or not has_column_privilege('postgres','auth.sessions','id','SELECT') or not has_column_privilege('postgres','auth.sessions','user_id','SELECT') or not has_column_privilege('postgres','auth.sessions','not_after','SELECT') or not has_column_privilege('postgres','auth.sessions','id','UPDATE') then raise exception 'N88 existing management exact Auth lock privileges unavailable'; end if;`;
const collision=`if exists(select 1 from pg_namespace where nspname='n88_private') or exists(select 1 from pg_roles where rolname in ('n88_guard','n88_backend')) then raise exception 'N88 collision: never reapply/adopt existing private objects'; end if;
if to_regclass('supabase_migrations.schema_migrations') is not null then
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261018034356') then raise exception 'N88 migration history collision'; end if;
end if;`;
await writeFile(dir+'preflight.inactive.sql',`-- AI: metadata-only, no personal rows. Authorized auditor only. No apply command.\nbegin read only;\nset local statement_timeout='5s';\ndo $n88$ begin\n${collision}\n${checks.join('\n')}\n${auth}\nend $n88$;\nselect 'xlrubcwjqktzzunrvuns' as expected_project, current_database(), version();\n-- Also independently verify actual project identity, unexposed private schema, Auth issuer/JWKS/session policy, revision bodies/lifecycle commands.\nrollback;\n`);
// Migration guards consumed column/PK/FK/RLS assumptions; trigger comparison belongs to fresh preflight.
const topologyNames=new Set(tables.flatMap(t=>[t+'_pkey',t+'_owner_id_fkey']).concat([
  'terms_owner_id_year_id_fkey','sections_owner_id_year_id_fkey','enrollments_owner_id_section_id_fkey',
  'enrollments_owner_id_student_id_fkey','teachings_owner_id_section_id_fkey','teachings_owner_id_term_id_fkey','items_owner_id_teaching_id_fkey']));
const guardChecks=checks.filter(s=>!s.includes('pg_trigger')&&!s.includes('canonical function identity')&&(!s.includes('pg_constraint')||[...topologyNames].some(n=>s.includes("conname='"+n+"'"))));
let sql=`-- AI-authored staged candidate. CLI v2.117.0 migration new, 2026-10-18. NEVER APPLIED.\n-- Exact project xlrubcwjqktzzunrvuns; requires separate hosted approval and passing full preflight.\n-- Fresh-only; no credentials, contexts, source rows, route, cron or Auth settings.\nbegin;\nset local lock_timeout='1s';\nset local statement_timeout='15s';\nselect pg_advisory_xact_lock(8800182026);\ndo $n88$ begin\n${collision}\n${guardChecks.join('\n')}\n${auth}\nend $n88$;\ncreate role n88_backend nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;\n`;
for(const file of ['schema-proposal.sql','postgres-repository-schema.sql','canonical-state-schema.inactive.sql','canonical-lock.inactive.sql','auth-session.inactive.sql','ingress.inactive.sql','roles.inactive.sql'])sql+=`\n-- BEGIN reviewed source ${file}\n`+(await readFile('drafts/n88-student-portal/'+file,'utf8')).replaceAll('\r\n','\n');
sql+='\ncommit;\n';
await writeFile(migration,sql);
console.log('N88 metadata SHA verified; exact staged migration and fail-closed metadata preflight prepared.');
