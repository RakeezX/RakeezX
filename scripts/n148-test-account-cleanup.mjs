// AI-authored exact N148 cleanup, governed by the current activated card.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PROJECT='xlrubcwjqktzzunrvuns';
export const AUTHORITY='PO-20261030-EXACT-TEST-ACCOUNT-HARD-DELETE';
export const MANIFEST_HASH='b671dc27a08c9553df385ef15c340801df4581a4a44b378f8698b5e5bec947e9';
const TASK='continuous-n148-test-account-cleanup-20261030';
const RUN='bf1599c0-e38d-4c04-9c7c-0d839681171d';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schemas=['rakeezx','n44_push_draft','n88_private'];
const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
const list=values=>values.map(literal).join(',');
const ident=v=>'"'+v.replaceAll('"','""')+'"';
const qtable=t=>t.split('.').map(ident).join('.');
const array=v=>`array[${list(v)}]::text[]`;
const json=v=>`${literal(JSON.stringify(v))}::jsonb`;

export const SUSPENSIONS=[
 ['n88_private.numeric_credentials','numeric_tombstones'],
 ['n88_private.class_credential_receipts','class_receipts_immutable'],
 ['n88_private.code_recovery','recovery_immutable'],
 ['rakeezx.closed_term_reports','closed_term_reports_immutable'],
 ...['years','calendars','calendar_days','terms'].map(t=>['rakeezx.'+t,'01_n58_calendar_contract']),
 ['rakeezx.calendars','99_n58_revalidate_calendar'],
 ['rakeezx.terms','99_n58_revalidate_term'],
 ['rakeezx.n58_restore_transactions','99_n58_revalidate_restore']
];
export function validateManifest(bytes,expectedHash=MANIFEST_HASH){
 if(createHash('sha256').update(bytes).digest('hex')!==expectedHash)throw Error('Manifest digest mismatch');
 const m=JSON.parse(bytes);
 if(m.projectId!==PROJECT||m.authorityRef!==AUTHORITY||m.allCount!==56||m.targetIds?.length!==50||m.keepIds?.length!==6||m.deleteDomains?.length!==4||m.deleteEmails?.length!==5||m.expectedTargetStudentRows!==2149||m.expectedKeptStudentRows!==927)throw Error('Manifest scope mismatch');
 const ids=[...m.targetIds,...m.keepIds];
 if(ids.some(id=>!uuid.test(id))||new Set(ids).size!==56||!m.keepIds.includes(m.exceptionId)||m.targetIds.includes(m.exceptionId))throw Error('Identity/exception guard failed');
 if(typeof m.keepEmail!=='string'||!m.keepEmail.includes('@')||m.deleteEmails.some(s=>typeof s!=='string'||!s.includes('@'))||m.deleteDomains.some(s=>typeof s!=='string'||!/^[a-z0-9.-]+$/i.test(s)))throw Error('Invalid selectors');
 return m;
}
export function selectionGuardSql(m){return `do $guard$ begin
 if (select count(*) from auth.users)<>56 or
 (select count(*) from auth.users where id::text in (${list(m.targetIds)}))<>50 or
 (select count(*) from auth.users where id::text in (${list(m.keepIds)}))<>6 or
 not exists(select 1 from auth.users where id=${literal(m.exceptionId)}::uuid and lower(email)=lower(${literal(m.keepEmail)})) or
 exists(select 1 from auth.users where
 coalesce(((lower(split_part(email,'@',2)) in (${list(m.deleteDomains.map(s=>s.toLowerCase()))}) or lower(email) in (${list(m.deleteEmails.map(s=>s.toLowerCase()))})) and lower(email)<>lower(${literal(m.keepEmail)})),false)
 is distinct from (id::text in (${list(m.targetIds)}))) or
 (select count(*) from rakeezx.students where owner_id::text in (${list(m.targetIds)}))<>2149 or
 (select count(*) from rakeezx.students where owner_id::text in (${list(m.keepIds)}))<>927
 then raise exception 'N148 live selection/exception/student-count guard failed'; end if;
 end $guard$;`;}
// Preserved for interpreting the first attempt's immutable-guard failure. The
// CLI no longer exposes this consumed probe as an executable mode.
export function rollbackProbeSql(m){return `begin isolation level serializable; ${selectionGuardSql(m)} delete from n88_private.numeric_credentials where owner_id::text in (${list(m.targetIds)}); rollback;`;}

const AUTH_TABLES=['users','identities','sessions','refresh_tokens','one_time_tokens','flow_state','audit_log_entries','mfa_factors','mfa_challenges','mfa_amr_claims','mfa_recovery_code_sets','mfa_recovery_codes','oauth_authorizations','oauth_consents','scim_users','webauthn_credentials','webauthn_challenges','saml_relay_states','oauth_client_states'].map(t=>'auth.'+t);
const STORAGE_TABLES=['buckets','objects','s3_multipart_uploads','s3_multipart_uploads_parts'].map(t=>'storage.'+t);
// Parameters: exact targets, frozen numeric credential IDs, numeric session IDs,
// Auth session IDs, factor IDs, recovery-set IDs, flow IDs, target emails, and
// exclusive flow client-state IDs. Child selectors NEVER depend on a deleted parent.
export function buildSpecs(metadata){
 const tables=[...new Set(metadata.columns.filter(c=>schemas.includes(c.table_schema)).map(c=>c.table_schema+'.'+c.table_name)),...AUTH_TABLES,...STORAGE_TABLES,'realtime.messages'].sort();
 return tables.map(table=>{
  const [schema,name]=table.split('.');
  const columns=metadata.columns.filter(c=>c.table_schema===schema&&c.table_name===name).map(c=>c.column_name);
  if(!columns.length)throw Error('Expected dependency table missing');
  let predicate='false';
  if(schemas.includes(schema)&&columns.includes('owner_id'))predicate='r.owner_id::text=any($1)';
  if(table==='n88_private.code_recovery')predicate='r.credential_id::text=any($2)';
  if(table==='n88_private.numeric_attempts')predicate="r.payload->>'sessionId'=any($3)";
  if(schema==='auth'&&columns.includes('user_id'))predicate='r.user_id::text=any($1)';
  if(table==='auth.users')predicate='r.id::text=any($1)';
  if(table==='auth.refresh_tokens')predicate='r.user_id::text=any($1) or r.session_id::text=any($4)';
  if(table==='auth.flow_state')predicate='r.user_id::text=any($1) or r.linking_target_id::text=any($1)';
  if(table==='auth.mfa_amr_claims')predicate='r.session_id::text=any($4)';
  if(table==='auth.mfa_challenges')predicate='r.factor_id::text=any($5)';
  if(table==='auth.mfa_recovery_code_sets')predicate='r.user_id::text=any($1) or r.mfa_factor_id::text=any($5)';
  if(table==='auth.mfa_recovery_codes')predicate='r.mfa_recovery_code_set_id::text=any($6)';
  if(table==='auth.saml_relay_states')predicate='r.flow_state_id::text=any($7) or lower(r.for_email)=any($8)';
  if(table==='auth.oauth_client_states')predicate='r.id::text=any($9)';
  if(table==='auth.audit_log_entries')predicate="r.payload::jsonb->>'actor_id'=any($1) or r.payload::jsonb->>'user_id'=any($1) or r.payload::jsonb->'traits'->>'user_id'=any($1) or lower(r.payload::jsonb->>'actor_username')=any($8) or lower(r.payload::jsonb->'traits'->>'email')=any($8)";
  if(STORAGE_TABLES.includes(table))predicate=columns.filter(c=>['owner','owner_id'].includes(c)).map(c=>`r.${ident(c)}::text=any($1)`).join(' or ');
  if(table==='realtime.messages')predicate="r.topic=any(array(select 'rakeezx-owner:'||v from unnest($1::text[]) v))";
  return {table,predicate:`coalesce((${predicate}),false)`,deletable:!STORAGE_TABLES.includes(table)&&predicate!=='false'};
 });
}
// Explicit child-first order; the terms/calendars cycle uses terms first so no
// SET NULL touches a still-live term. Closed-report self links are handled as leaves.
export const DELETE_ORDER=[
 'n88_private.numeric_attempts','n88_private.sessions','n88_private.numeric_sessions','n88_private.code_recovery',
 'n88_private.publications','n88_private.task_guidance','n88_private.class_visibility','n88_private.class_credential_receipts',
 'n88_private.credentials','n88_private.numeric_credentials','n88_private.memberships','n88_private.contexts',
 ...['deliveries','events','endpoint_claims','registrations','budgets','owner_clock','contexts'].map(t=>'n44_push_draft.'+t),
 ...['support_notification_outbox','support_requests','submissions','assignments','score_subitem_completions','scores',
 'class_goals','class_charter_selections','class_rules','group_arrangements','attendance','logs','notes','session_roster_snapshots',
 'sessions','slots','score_subitems','items','lessons','units','teachings','enrollments','students','closed_term_reports','sections',
 'calendar_days','terms','calendars','years','subjects','time_profiles','profile','sync_restore_receipts','sync_restore_stages',
 'n58_restore_transactions','score_domain_receipts','student_lifecycle_receipts','sync_mutation_receipts','score_distribution_plans',
 'n58_foundation_repair_receipts','curriculum_sync_bootstraps','account_access_grants','owner_sync_changes'].map(t=>'rakeezx.'+t),
 ...['saml_relay_states','oauth_client_states','flow_state','mfa_recovery_codes','mfa_recovery_code_sets','mfa_challenges','mfa_amr_claims',
 'mfa_factors','refresh_tokens','sessions','one_time_tokens','identities','oauth_authorizations','oauth_consents','scim_users',
 'webauthn_challenges','webauthn_credentials','audit_log_entries','users'].map(t=>'auth.'+t),
 'realtime.messages'
];
function validatePlan(specs,metadata){
 const deletable=specs.filter(s=>s.deletable).map(s=>s.table);
 if(new Set(DELETE_ORDER).size!==DELETE_ORDER.length||deletable.some(t=>!DELETE_ORDER.includes(t))||DELETE_ORDER.some(t=>!deletable.includes(t)))throw Error('Incomplete exact deletion plan');
 const affected=new Set(specs.map(s=>s.table));
 for(const f of metadata.fks)if(affected.has(f.parent)&&!affected.has(f.child))throw Error('Uncovered inbound FK dependency');
}
function triggerMetadataSql(tables){return `(select coalesce(jsonb_object_agg(c.tbl||'#'||t.tgname,jsonb_build_object('oid',t.oid,'tgfoid',t.tgfoid,'def',pg_get_triggerdef(t.oid),'fn',pg_get_functiondef(t.tgfoid),'enabled',t.tgenabled)),'{}'::jsonb) from pg_trigger t join (select oid,oid::regclass::text tbl from pg_class where oid in (${tables.map(t=>literal(t)+'::regclass').join(',')})) c on c.oid=t.tgrelid)`;}
function constraintsSql(tables){return `(select coalesce(jsonb_object_agg(conrelid::regclass::text||'#'||conname,jsonb_build_object('oid',oid,'def',pg_get_constraintdef(oid),'validated',convalidated,'deferred',condeferred,'deferrable',condeferrable)),'{}'::jsonb) from pg_constraint where conrelid in (${tables.map(t=>literal(t)+'::regclass').join(',')}))`;}
const USING='using v_targets,v_credentials,v_numeric_sessions,v_auth_sessions,v_factors,v_sets,v_flows,v_emails,v_client_states';
const SNAPSHOT=`v_snapshot:='{}'::jsonb;
 for v_spec in select value from jsonb_array_elements(v_specs) loop
 execute format('select count(*) total,count(*) filter(where %s) targets,count(*) filter(where not (%s)) protected_count,md5(coalesce(string_agg(md5(to_jsonb(r)::text),%L order by md5(to_jsonb(r)::text)) filter(where not (%s)),%L)) fingerprint from %s r',v_spec->>'predicate',v_spec->>'predicate','',v_spec->>'predicate','',v_spec->>'qualified') into v_row ${USING};
 v_snapshot:=v_snapshot||jsonb_build_object(v_spec->>'table',to_jsonb(v_row));
 end loop;`;
const SNAPSHOT_SQL=SNAPSHOT;
const DECLARE=`v_targets text[];v_credentials text[];v_numeric_sessions text[];v_auth_sessions text[];v_factors text[];v_sets text[];v_flows text[];v_emails text[];v_client_states text[];
 v_specs jsonb;v_spec jsonb;v_snapshot jsonb;v_before jsonb;v_after jsonb;v_triggers jsonb;v_constraints jsonb;v_expected jsonb;v_suspended jsonb:='[]'::jsonb;v_guard jsonb;v_row record;v_count bigint;v_deleted jsonb:='{}'::jsonb;v_name text;v_mode text;v_frozen jsonb;`;
const freezeJson=`jsonb_build_object('credentials',v_credentials,'numeric_sessions',v_numeric_sessions,'auth_sessions',v_auth_sessions,'factors',v_factors,'sets',v_sets,'flows',v_flows,'emails',v_emails,'client_states',v_client_states)`;
function protectedGate(){return `for v_name in select jsonb_object_keys(v_before) loop
 if (v_after->v_name->>'targets')::bigint<>0 or
 (v_after->v_name->>'total')::bigint<>(v_before->v_name->>'protected_count')::bigint or
 (v_after->v_name->>'protected_count')::bigint<>(v_before->v_name->>'protected_count')::bigint or
 v_after->v_name->>'fingerprint' is distinct from v_before->v_name->>'fingerprint'
 then raise exception 'N148 protected/residual gate failed: %',v_name;end if;
 end loop;`;}
function postAccountGuard(m){return `if (select count(*) from auth.users)<>6 or (select count(*) from auth.users where id::text=any(${array(m.keepIds)}))<>6 or
 not exists(select 1 from auth.users where id=${literal(m.exceptionId)}::uuid and lower(email)=lower(${literal(m.keepEmail)})) or
 (select count(*) from rakeezx.students where owner_id::text=any(${array(m.keepIds)}))<>927 then raise exception 'N148 kept accounts/exception/student gate failed';end if;`;}
export function buildCleanupSql(m,metadata,{commit=false}={}){
 const specs=buildSpecs(metadata).map(s=>({...s,qualified:qtable(s.table)}));validatePlan(specs,metadata);
 const tables=specs.map(s=>s.table);
 const expected=SUSPENSIONS.map(([table,trigger])=>{const t=metadata.triggers.find(t=>t.tbl===table&&t.tgname===trigger);if(!t)throw Error('Named guard metadata missing');return {table,trigger,oid:String(t.oid),tgfoid:String(t.tgfoid),def:t.def,fn:t.fn,enabled:t.tgenabled};});
 const expectedFks=Object.fromEntries(metadata.fks.filter(f=>tables.includes(f.parent)).map(f=>[f.child+'#'+f.conname,{parent:f.parent,def:f.def}]));
 const fkSql=`(select coalesce(jsonb_object_agg(conrelid::regclass::text||'#'||conname,jsonb_build_object('parent',confrelid::regclass::text,'def',pg_get_constraintdef(oid))),'{}'::jsonb) from pg_constraint where contype='f' and confrelid in (${tables.map(t=>literal(t)+'::regclass').join(',')}))`;
 const expectedColumns=Object.fromEntries(metadata.columns.filter(c=>schemas.includes(c.table_schema)||tables.includes(c.table_schema+'.'+c.table_name)).map(c=>[c.table_schema+'.'+c.table_name+'.'+c.column_name,c.data_type]));
 const columnsSql=`(select jsonb_object_agg(table_schema||'.'||table_name||'.'||column_name,data_type) from information_schema.columns where table_schema in (${list(schemas)}) or table_schema||'.'||table_name in (${list(tables)}))`;
 const triggerSql=triggerMetadataSql(tables),constraintSql=constraintsSql(tables);
 const deletion=DELETE_ORDER.map(table=>table==='rakeezx.closed_term_reports'?`
 loop
 delete from rakeezx.closed_term_reports r where r.owner_id::text=any(v_targets) and not exists(select 1 from rakeezx.closed_term_reports c where c.owner_id=r.owner_id and c.supersedes_id=r.id);
 get diagnostics v_count=row_count;exit when v_count=0;
 end loop;`:`
 select value into strict v_spec from jsonb_array_elements(v_specs) where value->>'table'=${literal(table)};
 execute format('delete from %s r where %s',v_spec->>'qualified',v_spec->>'predicate') ${USING};
 get diagnostics v_count=row_count;v_deleted:=v_deleted||jsonb_build_object(${literal(table)},v_count);`).join('\n');
 return `begin;
 set local lock_timeout='8s';set local statement_timeout='100s';set local idle_in_transaction_session_timeout='120s';
 lock table ${tables.map(qtable).join(',')} in share row exclusive mode;
 ${selectionGuardSql(m)}
 do $cleanup$ declare ${DECLARE} begin
 v_targets:=${array(m.targetIds)};v_specs:=${json(specs)};v_expected:=${json(expected)};
 if ${fkSql} is distinct from ${json(expectedFks)} or ${columnsSql} is distinct from ${json(expectedColumns)} then raise exception 'N148 dependency metadata changed';end if;
 v_triggers:=${triggerSql};v_constraints:=${constraintSql};
 for v_guard in select value from jsonb_array_elements(v_expected) loop
 if v_triggers->((v_guard->>'table')||'#'||(v_guard->>'trigger')) is distinct from (v_guard-array['table','trigger']) then raise exception 'N148 pinned guard identity changed';end if;
 end loop;
 select coalesce(array_agg(id::text),'{}') into v_credentials from n88_private.numeric_credentials where owner_id::text=any(v_targets);
 select coalesce(array_agg(row_key),'{}') into v_numeric_sessions from n88_private.numeric_sessions where owner_id::text=any(v_targets);
 select coalesce(array_agg(id::text),'{}') into v_auth_sessions from auth.sessions where user_id::text=any(v_targets);
 select coalesce(array_agg(id::text),'{}') into v_factors from auth.mfa_factors where user_id::text=any(v_targets);
 select coalesce(array_agg(id::text),'{}') into v_sets from auth.mfa_recovery_code_sets where user_id::text=any(v_targets) or mfa_factor_id::text=any(v_factors);
 select coalesce(array_agg(id::text),'{}') into v_flows from auth.flow_state where user_id::text=any(v_targets) or linking_target_id::text=any(v_targets);
 select coalesce(array_agg(lower(email)),'{}') into v_emails from auth.users where id::text=any(v_targets) and email is not null;
 select coalesce(array_agg(distinct f.oauth_client_state_id::text),'{}') into v_client_states from auth.flow_state f where f.id::text=any(v_flows) and f.oauth_client_state_id is not null and not exists(select 1 from auth.flow_state p where p.oauth_client_state_id=f.oauth_client_state_id and not(p.id::text=any(v_flows)));
 ${SNAPSHOT_SQL}
 v_before:=v_snapshot;
 if (v_before->'n88_private.code_recovery'->>'targets')::bigint<>45 or
 (v_before->'n88_private.code_recovery'->>'protected_count')::bigint<>7 or
 (v_before->'n88_private.numeric_credentials'->>'targets')::bigint<>45 or
 (v_before->'n88_private.numeric_credentials'->>'protected_count')::bigint<>7 or
 (v_before->'n88_private.class_credential_receipts'->>'protected_count')::bigint<>5 then raise exception 'N148 pinned N88 dependency counts changed';end if;
 for v_name in select value->>'table' from jsonb_array_elements(v_specs) where value->>'table' like 'storage.%' loop
 if (v_before->v_name->>'targets')::bigint<>0 then raise exception 'N148 unexpected Storage target; no Storage mutation authorized';end if;end loop;
 if exists(select 1 from rakeezx.account_access_grants where not(owner_id::text=any(v_targets)) and granted_by::text=any(v_targets)) then raise exception 'N148 protected grant references target';end if;
 for v_guard in select value from jsonb_array_elements(v_expected) loop
 if (v_before->(v_guard->>'table')->>'targets')::bigint>0 then
 execute format('alter table %s disable trigger %I',v_guard->>'table',v_guard->>'trigger');
 v_suspended:=v_suspended||jsonb_build_array(v_guard);end if;
 end loop;
 ${deletion}
 set constraints all immediate;
 for v_guard in select value from jsonb_array_elements(v_suspended) loop
 v_mode:=case v_guard->>'enabled' when 'O' then 'enable' when 'D' then 'disable' when 'R' then 'enable replica' when 'A' then 'enable always' else null end;
 if v_mode is null then raise exception 'N148 unknown original trigger mode';end if;
 execute format('alter table %s %s trigger %I',v_guard->>'table',v_mode,v_guard->>'trigger');end loop;
 if ${triggerSql} is distinct from v_triggers or ${constraintSql} is distinct from v_constraints then raise exception 'N148 trigger/function/constraint restoration failed';end if;
 ${SNAPSHOT_SQL}
 v_after:=v_snapshot;${protectedGate()} ${postAccountGuard(m)}
 v_frozen:=${freezeJson};
 perform set_config('n148.cleanup_result',jsonb_build_object('before',v_before,'after',v_after,'frozen',v_frozen,'triggers',v_triggers,'constraints',v_constraints,'deleted',v_deleted,'suspended_count',jsonb_array_length(v_suspended),'selection_guard',true,'protected_unchanged',true,'targets_zero',true,'guards_restored',true)::text,false);
 end $cleanup$;
 ${commit?'commit;':"select current_setting('n148.cleanup_result')::jsonb as cleanup; rollback;"}
 ${commit?"select current_setting('n148.cleanup_result')::jsonb as cleanup;":''}`;
}
export function buildReadbackSql(m,metadata,result){
 const specs=buildSpecs(metadata).map(s=>({...s,qualified:qtable(s.table)})),tables=specs.map(s=>s.table);
 return `begin read only;
 do $readback$ declare ${DECLARE} begin
 v_targets:=${array(m.targetIds)};v_specs:=${json(specs)};v_before:=${json(result.before)};
 ${['credentials','numeric_sessions','auth_sessions','factors','sets','flows','emails','client_states'].map(n=>`v_${n}:=${array(result.frozen[n]||[])};`).join('\n')}
 ${SNAPSHOT_SQL}v_after:=v_snapshot;${protectedGate()}${postAccountGuard(m)}
 if ${triggerMetadataSql(tables)} is distinct from ${json(result.triggers)} or ${constraintsSql(tables)} is distinct from ${json(result.constraints)} then raise exception 'N148 readback guard mismatch';end if;
 perform set_config('n148.readback',jsonb_build_object('targets_zero',true,'protected_unchanged',true,'guards_restored',true,'tables',jsonb_object_length_placeholder)::text,true);
 end $readback$;
 select current_setting('n148.readback')::jsonb as readback;
 commit;`.replace('jsonb_object_length_placeholder',String(specs.length));
}
export function compareProtected(before,after){
 return before.length===after.length&&before.every(b=>after.some(a=>a.tbl===b.tbl&&a.total===b.total&&a.targets===b.targets&&a.protected_count===b.protected_count&&a.protected_fingerprint===b.protected_fingerprint));
}
function runCli(cli,sql,dir,label){
 const file=path.join(dir,label+'.sql');fs.writeFileSync(file,sql,{flag:'wx'});
 const r=spawnSync(process.execPath,[cli,'db','query','--linked','--project-ref',PROJECT,'--file',file,'--output','json'],{encoding:'utf8',maxBuffer:30e6,timeout:150000});
 fs.writeFileSync(path.join(dir,label+'.json'),r.stdout||'',{flag:'wx'});fs.writeFileSync(path.join(dir,label+'.stderr'),r.stderr||'',{flag:'wx'});
 return r;
}
async function main(){
 const [mode,manifestPath,cli,taskFile,leaseScript]=process.argv.slice(2);
 if(!['--prepare','--execute'].includes(mode)||!manifestPath||!cli||!taskFile||!leaseScript)throw Error('Use --prepare|--execute PRIVATE_MANIFEST OFFICIAL_CLI CANONICAL_CARD LEASE_SCRIPT');
 const m=validateManifest(fs.readFileSync(manifestPath));
 for(const p of [manifestPath,path.join(path.dirname(manifestPath),'.n148-private-evidence')])if(spawnSync('git',['-C',path.dirname(manifestPath),'check-ignore','--quiet','--',path.resolve(p)]).status!==0)throw Error('Private directory not ignored');
 const card=JSON.parse(fs.readFileSync(taskFile)),scope=card.preparationAuthority;
 if(card.id!==TASK||card.attempt?.runId!==RUN||card.status!=='running'||card.model!=='gpt-6.1-sol'||card.effort!=='medium'||card.liveAuthorizationRef!==AUTHORITY||scope?.projectId!==PROJECT||scope.privateManifestSha256!==MANIFEST_HASH||path.resolve(scope.privateManifest)!==path.resolve(manifestPath)||!scope.temporaryTriggerSuspension?.transactionOnly||!scope.temporaryTriggerSuspension?.restoreOriginalStateBeforeCommit)throw Error('Active corrected card mismatch');
 if(JSON.stringify(scope.temporaryTriggerSuspension.allowlist.map(v=>[v.table,v.trigger]))!==JSON.stringify(SUSPENSIONS))throw Error('Trigger authority mismatch');
 const intake=path.dirname(manifestPath),metadata=JSON.parse(fs.readFileSync(path.join(intake,'resumed-metadata.json'))).rows[0].metadata;
 const dir=fs.mkdtempSync(path.join(intake,'atomic-cleanup-'));
 const sql=buildCleanupSql(m,metadata,{commit:true});fs.writeFileSync(path.join(dir,'reviewed-cleanup.sql'),sql,{flag:'wx'});
 if(mode==='--prepare'){console.log(JSON.stringify({prepared:true,tables:buildSpecs(metadata).length,privateEvidence:path.basename(dir)}));return;}
 const lease=action=>{const r=spawnSync('powershell.exe',['-NoProfile','-File',leaseScript,'-Name','live-mutation','-Action',action,'-TaskFile',taskFile,'-OwnerToken',RUN,'-WaitSeconds','0'],{encoding:'utf8',timeout:30000});if(r.status!==0||r.error)throw Error('Lease '+action+' failed');};
 let acquired=false;
 try{
 lease('acquire');acquired=true;
 const held=JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(taskFile)),'leases/live-mutation.json')));
 if(held.taskId!==TASK||held.owner?.token!==RUN||held.resource!=='live-mutation')throw Error('Lease readback mismatch');
 const r=runCli(cli,sql,dir,'transaction');
 if(r.status!==0||r.error){console.log(JSON.stringify({committed:'UNCONFIRMED',privateEvidence:path.basename(dir)}));throw Error('Inspect exact private service result; no automatic retry');}
 const result=JSON.parse(r.stdout).rows[0]?.cleanup;
 if(!result?.targets_zero||!result?.guards_restored||!result?.protected_unchanged)throw Error('Missing transaction proof');
 const rb=runCli(cli,buildReadbackSql(m,metadata,result),dir,'committed-readback');
 if(rb.status!==0||rb.error)throw Error('Committed readback failed; preserve actual transaction evidence');
 const readback=JSON.parse(rb.stdout).rows[0]?.readback;
 if(!readback?.targets_zero||!readback?.guards_restored||!readback?.protected_unchanged)throw Error('Missing readback proof');
 const summary={committed:true,targetAccountsAbsent:50,keptAccounts:6,keptStudentRows:927,tables:buildSpecs(metadata).length,protectedUnchanged:true,guardsRestored:true,suspendedTriggers:result.suspended_count,privateEvidence:path.basename(dir),deleted:result.deleted};
 fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2),{flag:'wx'});console.log(JSON.stringify(summary));
 }finally{if(acquired)lease('release');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{console.error('N148 stopped; inspect owned private evidence. No unverified cleanup success claimed.');process.exitCode=1;});
