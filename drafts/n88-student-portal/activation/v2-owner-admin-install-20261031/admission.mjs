/** AI: fresh named finite capability. Historical boundary/admissions are untouched. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import manifest from './manifest.json' with {type:'json'};
import originalRead from '../v2-external-plan-1028/read-authority.json' with {type:'json'};
import {identitySql,baselineInventorySql,readOnlyQueryPlan} from '../v2-external-plan-1028/preflight.mjs';
export const sha=s=>createHash('sha256').update(s).digest('hex');
export const TOOL_WINDOW_MS=45*60000;
export const taskId=manifest.taskId,runId=manifest.runId,projectRef=manifest.projectRef;
export const snapshotSql=`select jsonb_build_object(${readOnlyQueryPlan.slice(1,8).map(o=>`'${o.id}',(select coalesce(jsonb_agg(to_jsonb(q) order by to_jsonb(q)::text),'[]'::jsonb) from (${o.sql}) q)`).join(',')},'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',roleid::regrole::text,'member',member::regrole::text,'grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option) order by roleid::regrole::text,member::regrole::text,grantor::regrole::text),'[]'::jsonb) from pg_auth_members where roleid in ('n88_guard'::regrole,'n88_backend'::regrole) or roleid in (coalesce(to_regrole('n88_v2_guard')::oid,0),coalesce(to_regrole('n88_v2_runtime')::oid,0))),'settings',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (select d.datname,r.rolname,array(select v from unnest(s.setconfig) v where v like 'pgrst.db_schemas=%') as setconfig from pg_db_role_setting s left join pg_database d on d.oid=s.setdatabase left join pg_roles r on r.oid=s.setrole where (s.setdatabase=0 or d.datname=current_database()) and (s.setrole=0 or r.rolname in ('authenticator','postgres')) limit 16) q)) as snapshot`;
const targetExpression=`jsonb_build_object('projectRef','${projectRef}','databaseName',i.database_name,'databaseOid',i.database_oid,'systemIdentifier',i.system_identifier,'serverAddress',i.server_address,'serverPort',i.server_port::text,'serverVersionNum',i.server_version_num,'installerSessionRole',i.session_role,'installerCurrentRole',i.current_role,'baselineInventorySha256',b.sha256,'nonExposureReadbackSha256','${manifest.providerSha256}')`;
export const preSql=`select t.target,encode(sha256(convert_to(t.target::text,'UTF8')),'hex') as target_sha256,s.snapshot from (${identitySql}) i cross join (${baselineInventorySql}) b cross join lateral (select ${targetExpression} as target) t cross join (${snapshotSql}) s`;
export const postSql=snapshotSql;
let pinnedTemplate;
export async function verifySources(){
 if(sha(await readFile(manifest.authorityPath))!==manifest.authoritySha256||sha(await readFile(manifest.providerPath))!==manifest.providerSha256)throw Error('n88_authority_or_historical_provider_evidence_changed');
 const template=(await readFile(new URL('./installer.inactive.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n');if(sha(template)!==manifest.installerSha256)throw Error('n88_template_changed');
 for(const [file,h]of Object.entries(manifest.pinnedSources))if(sha((await readFile(file,'utf8')).replaceAll('\r\n','\n'))!==h)throw Error('n88_pinned_source_changed');
 pinnedTemplate=template;return template;
}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const exact=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function validatePre(row){
 const t=row.target,s=row.snapshot;
 if(!t||t.projectRef!==projectRef||t.installerCurrentRole!=='postgres'||t.installerSessionRole!=='postgres'||!/^17/.test(t.serverVersionNum)||!s)throw Error('n88_target_actor_mismatch');
 if(s['roles-and-memberships'].some(r=>r.rolname.startsWith('n88_v2_'))||s['relation-identity'].some(r=>r.relname.startsWith('publication_v2_'))||s['function-and-trigger-identity'].some(r=>/^(v2_|publication_v2_)/.test(r.proname)))throw Error('n88_preexisting_identity_readback_only');
 const edge=s.memberships.filter(e=>e.role==='n88_guard'&&e.member==='postgres');
 if(!exact(edge,[{role:'n88_guard',member:'postgres',grantor:'postgres',admin:false,inherit:false,set:false},{role:'n88_guard',member:'postgres',grantor:'supabase_admin',admin:true,inherit:false,set:false}]))throw Error('n88_expected_original_edges_changed');
 const p=s['exposure-and-effective-privileges'].find(r=>r.nspname==='n88_private');
 if(!p||p.anon_usage||p.authenticated_usage)throw Error('n88_private_effective_exposure');
 // A null session setting is never considered proof. Historical independent UI
 // evidence plus current schema denial and supported catalog settings are retained.
 for(const r of s.settings)for(const setting of r.setconfig??[])if(setting.startsWith('pgrst.db_schemas=')&&setting.split('=')[1].split(',').map(v=>v.trim()).includes('n88_private'))throw Error('n88_provider_schema_now_exposed');
 return true;
}
export function validateOriginalTarget(t){
 const x=originalRead.readback.actualDatabaseIdentity;
 if(t.databaseName!==x.database_name||t.databaseOid!==x.database_oid||t.systemIdentifier!==x.system_identifier||t.serverAddress!==x.server_address||Number(t.serverPort)!==x.server_port||t.serverVersionNum!==x.server_version_num)throw Error('n88_original_physical_target_changed');return true;
}
const preUsed=new WeakSet();
export async function admitPre(client,context){
 await verifySources();if(preUsed.has(client)||context?.taskId!==taskId||context?.runId!==runId)throw Error('n88_pre_admission_denied');preUsed.add(client);
 const r=await client.query(preSql,[]);if(!Array.isArray(r.rows)||r.rows.length!==1||Buffer.byteLength(JSON.stringify(r.rows))>1048576)throw Error('n88_pre_result_bounds');validatePre(r.rows[0]);validateOriginalTarget(r.rows[0].target);return r.rows[0];
}
const deriveSql=(template,target,authority)=>{
 const literal=v=>JSON.stringify(v).replaceAll("'","''");
 return template.replace("expected_target jsonb := 'null'::jsonb;",`expected_target jsonb := '${literal(target)}'::jsonb;`).replace("expected_authority jsonb := 'null'::jsonb;",`expected_authority jsonb := '${literal(authority)}'::jsonb;`);
};
const sealedRecords=new WeakSet();
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export async function bind(row,deadline,{persist=true}={}){
 validatePre(row);const template=await verifySources();
 const authority={productId:'N88',action:'install-owner-admin-storage-20261031',ref:manifest.authorityRef,taskId,runId,targetSha256:row.target_sha256,deltaSha256:manifest.deltaSha256,expiresAt:deadline};
 const literal=v=>JSON.stringify(v).replaceAll("'","''");
 const sql=template.replace("expected_target jsonb := 'null'::jsonb;",`expected_target jsonb := '${literal(row.target)}'::jsonb;`).replace("expected_authority jsonb := 'null'::jsonb;",`expected_authority jsonb := '${literal(authority)}'::jsonb;`);
 const record={taskId,runId,projectRef,authorityRef:manifest.authorityRef,authorityEvidenceSha256:manifest.authoritySha256,installerSha256:manifest.installerSha256,boundInstallerSha256:sha(sql),target:row.target,authority,deadline,originalSnapshot:row.snapshot,serviceEnabled:false,operations:[{id:'fresh-target-baseline',kind:'read',sql:preSql,maxRows:1,maxBytes:1048576},{id:'owner-admin-atomic-install',kind:'migration',name:'n88_owner_admin_storage_window_20261031',sql,maxRows:0,maxBytes:4096},{id:'postinstall-exact-readback',kind:'read',sql:postSql,maxRows:1,maxBytes:1048576}]};
 freeze(record);sealedRecords.add(record);
 if(persist){await writeFile(new URL('./install-bound.sql',import.meta.url),sql);await writeFile(new URL('./install-authority.json',import.meta.url),JSON.stringify(record,null,2)+'\n');}return record;
}
const used=new WeakSet();
export function admit(client,record,context,{reconcile=false,now=Date.now}={}){
 if(!client||!sealedRecords.has(record)||used.has(client)||context?.taskId!==taskId||context?.runId!==runId||record.taskId!==taskId||record.runId!==runId||record.projectRef!==projectRef||record.authorityEvidenceSha256!==manifest.authoritySha256||record.installerSha256!==manifest.installerSha256||sha(record.operations[1].sql)!==record.boundInstallerSha256||record.operations[0].sql!==preSql||record.operations[2].sql!==postSql||!reconcile&&now()>=Date.parse(record.deadline))throw Error('n88_finite_admission_denied');
 if(record.authority?.taskId!==taskId||record.authority?.runId!==runId||record.authority?.ref!==manifest.authorityRef||record.authority?.deltaSha256!==manifest.deltaSha256||record.operations[1].kind!=='migration'||record.operations[1].name!=='n88_owner_admin_storage_window_20261031')throw Error('n88_record_mismatch');
 const derived=deriveSql(pinnedTemplate,record.target,record.authority);
 const expectedOps=[{id:'fresh-target-baseline',kind:'read',sql:preSql,maxRows:1,maxBytes:1048576},{id:'owner-admin-atomic-install',kind:'migration',name:'n88_owner_admin_storage_window_20261031',sql:derived,maxRows:0,maxBytes:4096},{id:'postinstall-exact-readback',kind:'read',sql:postSql,maxRows:1,maxBytes:1048576}];
 if(!pinnedTemplate||sha(derived)!==record.boundInstallerSha256||!exact(record.operations,expectedOps)||!exact(Object.keys(record.authority).sort(),['productId','action','ref','taskId','runId','targetSha256','deltaSha256','expiresAt'].sort())||record.authority.productId!=='N88'||record.authority.action!=='install-owner-admin-storage-20261031'||record.authority.expiresAt!==record.deadline||!Number.isFinite(Date.parse(record.deadline))||!reconcile&&Date.parse(record.deadline)-now()>TOOL_WINDOW_MS)throw Error('n88_derived_sql_or_plan_mismatch');
 validatePre({target:record.target,snapshot:record.originalSnapshot});
 used.add(client);let expires=reconcile?now()+TOOL_WINDOW_MS:Date.parse(record.deadline);let position=reconcile?2:0,closed=false;
 return {close(){closed=true;},async query(sql,values=[]){
 const op=record.operations[position];
 if(closed||!op||values.length||sql!==op.sql||now()>=expires){closed=true;throw Error('n88_finite_statement_denied');}
 position++; // consume before dispatch, including loss of acknowledgement
 try{const r=await client.query(sql,[]);if(closed||!Array.isArray(r.rows)||r.rows.length>op.maxRows||Buffer.byteLength(JSON.stringify(r.rows))>op.maxBytes)throw Error('n88_result_bounds');if(op.kind==='read'&&r.rows.length!==1)throw Error('n88_result_shape');if(op.kind==='migration')expires=now()+TOOL_WINDOW_MS;return r;}catch(e){closed=true;throw e;}
 }};
}
export async function loadSavedRecord(){
 const record=JSON.parse(await readFile(new URL('./install-authority.json',import.meta.url)));
 const expected=await bind({target:record.target,target_sha256:record.authority.targetSha256,snapshot:record.originalSnapshot},record.deadline,{persist:false});
 if(!exact(record,expected))throw Error('n88_saved_binding_tampered');return expected;
}
export async function validatePost(record,row){
 const s=row.snapshot,old=record.originalSnapshot;if(!s)throw Error('n88_post_snapshot_missing');
 const packet=JSON.parse(await readFile(new URL('../v2-package-1028/manifest.json',import.meta.url)));
 const funcs=s['function-and-trigger-identity'];
 for(const f of packet.functions){const g=funcs.find(x=>x.proname===f.name);if(!g||g.definition!==f.definition||g.owner!==f.owner||g.definer!==f.definer||!exact(g.proconfig,f.config)||g.acl!==`{n88_v2_guard=X/n88_v2_guard,n88_v2_runtime=X/n88_v2_guard}`)throw Error('n88_fixed_function_mismatch');}
 const helpers=new Set(['lock_current_session','lock_canonical_sources','lock_projection_sources']);
 const aclParts=(acl,owner,name)=>(acl??`{=X/${owner},${owner}=X/${owner}}`).slice(1,-1).split(',').filter(v=>!helpers.has(name)||v!==`n88_v2_runtime=X/${owner}`).sort();
 const strip=acl=>(acl??'').replace(/,?n88_v2_runtime=X\/(?:n88_guard|postgres)(?=,|\})/g,'').replace('{,','{');
 for(const f of old['function-and-trigger-identity']){const g=funcs.find(x=>x.nspname===f.nspname&&x.proname===f.proname&&x.arguments===f.arguments);if(!g||!exact({...g,acl:null},{...f,acl:null})||!exact(aclParts(g.acl,g.owner,g.proname),aclParts(f.acl,f.owner,f.proname)))throw Error('n88_old_function_changed');}
 const v2=s['roles-and-memberships'].filter(r=>r.rolname.startsWith('n88_v2_'));if(v2.length!==2||v2.some(r=>r.rolsuper||r.rolbypassrls||r.rolinherit||r.rolcanlogin||r.rolcreatedb||r.rolcreaterole))throw Error('n88_role_attributes');
 if(!exact(s['roles-and-memberships'].filter(r=>!r.rolname.startsWith('n88_v2_')).map(r=>r.rolname==='postgres'?{...r,memberships:r.memberships?.filter(m=>!['n88_v2_guard','n88_v2_runtime'].includes(m.role))??null}:r),old['roles-and-memberships']))throw Error('n88_old_roles_changed');
 const fresh=s.memberships.filter(e=>e.role.startsWith('n88_v2_'));if(!exact(fresh,['n88_v2_guard','n88_v2_runtime'].map(role=>({role,member:'postgres',grantor:'supabase_admin',admin:true,inherit:false,set:false}))))throw Error('n88_creator_edges');
 if(!exact(s.memberships.filter(e=>!e.role.startsWith('n88_v2_')),old.memberships))throw Error('n88_old_memberships_changed');
 const tables=s['relation-identity'].filter(r=>r.relname.startsWith('publication_v2_'));if(tables.length!==4||tables.some(r=>r.owner!=='postgres'||!r.relrowsecurity||!r.relforcerowsecurity))throw Error('n88_storage_forced_rls');
 for(const p of s['effective-table-privileges'])if(p.rolname==='n88_v2_runtime'&&['table_select','column_select','insert','update','column_update','delete','truncate'].some(k=>p[k]))throw Error('n88_runtime_raw_privilege');
 const support=funcs.filter(f=>f.proname.startsWith('publication_v2_'));if(support.length!==6||support.some(f=>f.owner!=='postgres'||f.definer||/(?:\{|,)=X|EXECUTE\*/.test(f.acl??'')))throw Error('n88_support_functions');
 const schema=s['exposure-and-effective-privileges'].find(r=>r.nspname==='n88_private');if(schema.anon_usage||schema.authenticated_usage)throw Error('n88_schema_exposed');
 return {relations:4,fixedOperations:14,helpers:6,helperExecuteDelta:3,oldMembershipRestored:true,runtimeRawPrivileges:false,serviceEnabled:false};
}

/** Pure queue-lifecycle state: expiry never releases an explicitly pending tool. */
export function toolLifecycle(deadlineMs,{now=Date.now}={}){
 if(!Number.isFinite(deadlineMs)||deadlineMs<=now()||deadlineMs-now()>TOOL_WINDOW_MS)throw Error('n88_tool_window_invalid');
 let state='AWAITING_CLAIM',pending=false;
 return {get state(){return state;},get canRelease(){return !pending;},claim(){if(state!=='AWAITING_CLAIM'||now()>=deadlineMs)throw Error('n88_tool_claim_expired_or_spent');pending=true;state='PENDING';},tick(){if(now()>=deadlineMs){if(pending)state='PENDING_AFTER_WINDOW';else if(state==='AWAITING_CLAIM')state='EXPIRED_UNCLAIMED';}return state;},terminal(){if(!pending)throw Error('n88_tool_terminal_without_claim');pending=false;state='TERMINAL';}};
}
