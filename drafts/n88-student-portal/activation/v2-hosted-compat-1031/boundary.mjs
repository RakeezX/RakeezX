/** AI: exact trusted session boundary; no public SQL selection or fallback. */
import packet from './operations.json' with {type:'json'};
const fail=()=>{throw Error('n88_safe_boundary_required');};
export const definitions=packet.definitions;
export const safeReadbackSql=`select p.proname,p.prosrc,p.prosecdef,pg_get_userbyid(p.proowner) as owner,p.proconfig,has_function_privilege(current_user,p.oid,'EXECUTE') as callable,(has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or exists(select 1 from aclexplode(p.proacl) a where a.grantee=0)) as public_call from pg_proc p where p.pronamespace='n88_private'::regnamespace and p.proname=any($1::text[]) order by p.proname`;
export async function verifySafeBoundary(client){
 const expected=[...definitions].sort((a,b)=>a.safeName.localeCompare(b.safeName));
 const rows=(await client.query(safeReadbackSql,[expected.map(o=>o.safeName)])).rows;
 if(rows?.length!==14||rows.some((r,i)=>r.proname!==expected[i].safeName||r.prosrc!==expected[i].body||!r.prosecdef||r.owner!=='n88_v2_guard'||JSON.stringify(r.proconfig)!=='["search_path=pg_catalog"]'||!r.callable||r.public_call))fail();
}
export const loggingSql=`select current_setting('log_error_verbosity') as verbosity,current_setting('log_parameter_max_length_on_error') as parameters,current_setting('log_statement') as statements,current_setting('log_min_duration_statement') as duration,current_setting('log_min_duration_sample') as sample,current_setting('log_transaction_sample_rate') as sampling,current_setting('pgaudit.log',true) as audit,(select setting from pg_settings where name='auto_explain.log_min_duration') as explain,current_setting('statement_timeout') as statement_timeout`;
const milliseconds=s=>{const m=/^(\d+)(ms|s|min)?$/.exec(s??'');return m?Number(m[1])*({ms:1,s:1000,min:60000}[m[2]]??1):NaN;};
export function safeLoggingProfile(r){
 const timeout=milliseconds(r?.statement_timeout),explain=r?.explain==null||r.explain==='-1'?Infinity:Number(r.explain);
 return !!r&&['terse','default'].includes(r.verbosity)&&r.parameters==='0'&&['none','ddl'].includes(r.statements)&&r.duration==='-1'&&r.sample==='-1'&&r.sampling!=null&&Number(r.sampling)===0&&[null,'none'].includes(r.audit)&&timeout>0&&timeout<=5000&&explain>timeout+2000;
}
export function encodeArguments(args){return Buffer.from(JSON.stringify(args),'utf8').toString('base64');}
export function unwrapEnvelope(raw){
 const v=raw?.rows?.length===1?raw.rows[0]?.envelope:null;
 if(!v||Object.keys(v).sort().join(',')!=='ok,result'||v.ok!==true||!v.result||Object.keys(v.result).sort().join(',')!=='command,rowCount,rows'||!Array.isArray(v.result.rows)||!Number.isSafeInteger(v.result.rowCount)||v.result.rowCount<0||!['SELECT','INSERT','UPDATE'].includes(v.result.command))fail();
 return v.result;
}
