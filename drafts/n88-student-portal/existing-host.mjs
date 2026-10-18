/** AI: Supabase Edge composition. Config is read ONLY after explicit activation.
 * No service-role key, new account, SDK Auth flow, migrations or runtime fixtures.
 */
import {Buffer} from 'node:buffer';
import pg from 'pg';
import manifest from './deployment.inactive.json' with {type:'json'};
import {createWebEntry} from './web-entry.mjs';
import {privateResponse} from './web-protocol.mjs';
import {assertVerifiedBoundary} from './activation/private-error-boundary.mjs';
// Source-side error redaction cannot prevent the database server logging DETAIL.
// Read only effective session settings before granting the repository this client.
export async function assertPrivateDatabaseSession(client) {
  const result=await client.query(`select current_user as role,
    current_setting('log_error_verbosity') as error_verbosity,
    current_setting('log_parameter_max_length_on_error') as error_parameters,
    current_setting('log_statement') as statements,
    current_setting('log_min_duration_statement') as duration,
    current_setting('log_min_duration_sample') as duration_sample,
    current_setting('log_transaction_sample_rate') as transaction_sample,
    current_setting('pgaudit.log',true) as audit,
    (select setting from pg_settings where name='auto_explain.log_min_duration') as explain_duration,
    current_setting('auto_explain.log_nested_statements',true) as explain_nested`);
  const r=result.rows?.[0];
  // Statements have a hard3s timeout. An explain threshold above that cannot
  // capture a completed private statement; missing extension settings are inert.
  const explainSafe=r && (r.explain_duration==null || r.explain_duration==='-1' ||
    /^\d+$/.test(r.explain_duration) && Number(r.explain_duration)>3000 && r.explain_nested==='off');
  if(result.rows?.length!==1 || !r || r.role!=='n88_backend' || !['terse','default'].includes(r.error_verbosity) ||
    r.error_parameters!=='0' || !['none','ddl'].includes(r.statements) ||
    r.duration!=='-1' || r.duration_sample!=='-1' || Number(r.transaction_sample)!==0 ||
    r.transaction_sample==null || ![null,'none'].includes(r.audit) || !explainSafe)
    throw Error('n88_database_unavailable');
  // Even terse cannot make an arbitrary private query safe. Verify the exact
  // typed routines, source identities, owner, invoker mode and narrow ACL first.
  await assertVerifiedBoundary(client);
}
export function createExistingHost(readEnv) {
  if(readEnv('N88_ENABLED')!=='true')return Object.freeze({handle:async()=>privateResponse(),close:async()=>{}});
  const required=n=>{const v=readEnv(n);if(typeof v!=='string' || !v)throw Error('n88_configuration');return v;};
  const origin=required('N88_PUBLIC_ORIGIN'),authUrl=required('N88_AUTH_URL'),dbUrl=required('N88_DATABASE_URL');
  const db=new URL(dbUrl);
  const username=decodeURIComponent(db.username);
  if(!['postgres:','postgresql:'].includes(db.protocol) || !(username==='n88_backend' || /^n88_backend\.[a-z0-9]{20}$/.test(username)) || !db.password || db.search || db.hash)throw Error('n88_database_configuration');
  const key=n=>{const s=required(n);if(!/^[a-f0-9]{64}$/.test(s))throw Error('n88_key_configuration');return Buffer.from(s,'hex');};
  // Physical deployment gate; readback/authorization evidence still required.
  if(required('N88_SERVICE_REVISION')!==manifest.serviceRevision)throw Error('n88_service_readback_missing');
  const secretKey=key('N88_HMAC_KEY'),ingressKey=key('N88_INGRESS_KEY'),numericKey=key('N88_NUMERIC_KEY'),reservationKey=key('N88_RESERVATION_KEY');
  if(new Set([secretKey,ingressKey,numericKey,reservationKey].map(k=>k.toString('hex'))).size!==4)throw Error('n88_separate_keys_required');
  if(secretKey.equals(ingressKey))throw Error('n88_separate_keys_required');
  // Explicit server-only supported keyring; no defaults, no browser artifacts.
  const recoveryActiveKeyVersion=required('N88_RECOVERY_ACTIVE_VERSION');
  const versions=required('N88_RECOVERY_VERSIONS').split(',');
  if(versions.length>8||new Set(versions).size!==versions.length||versions.some(v=>!/^[A-Za-z0-9_-]{1,40}$/.test(v)))throw Error('n88_configuration');
  const recoveryKeys=new Map(versions.map(v=>[v,key('N88_RECOVERY_KEY_'+v)]));
  const ca=readEnv('N88_DATABASE_CA_CERT');
  const pool=new pg.Pool({connectionString:dbUrl,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},max:2,
    connectionTimeoutMillis:1000,idleTimeoutMillis:10000,statement_timeout:3000,query_timeout:4000,
    application_name:'n88-private-server',allowExitOnIdle:true});
  // No raw pg errors/SQL/parameters in platform logs.
  pool.on('error',()=>{});let waiting=0;
  const acquire=async()=>{
    if(waiting>=8)throw Error('n88_pool_capacity');waiting++;
    let client;
    try {
      client=await pool.connect();
      await assertPrivateDatabaseSession(client);
      return client;
    }catch{client?.release(Error('n88_database_unavailable'));throw Error('n88_database_unavailable');}
    finally{waiting--;}
  };
  try {
    const handle=createWebEntry({...manifest,origin,authUrl,apiKey:required('N88_AUTH_API_KEY'),secretKey,ingressKey,numericKey,reservationKey,recoveryKeys,recoveryActiveKeyVersion,acquire,
      sourceOnly:false,canonicalReadback:true,privateIngressReadback:true});
    return Object.freeze({handle,close:()=>pool.end()});
  }catch{void pool.end();throw Error('n88_configuration');}
}
