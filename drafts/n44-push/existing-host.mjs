/** AI: existing Supabase Edge composition; all external capabilities disabled by default. */
import './node-globals.mjs';
import {assertVerifiedBoundary,privateQuery} from './activation/private-error-boundary.mjs';
import {supportedSessionPolicy} from './session-policy.mjs';
import {Buffer} from 'node:buffer';
import pg from 'pg';
import {p256} from '@noble/curves/nist.js';
import {createPrivatePushPorts} from './private-runtime.mjs';
import {createWebEntry} from './web-entry.mjs';
import {privateResponse} from './web-protocol.mjs';
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
  // Statements have at most a hard6s timeout. An explain threshold above that cannot
  // capture a completed private statement; missing extension settings are inert.
  const explainSafe=r && (r.explain_duration==null || r.explain_duration==='-1' ||
    /^\d+$/.test(r.explain_duration) && Number(r.explain_duration)>6000 && r.explain_nested==='off');
  if(result.rows?.length!==1 || !r || r.role!=='n44_backend' || !['terse','default'].includes(r.error_verbosity) ||
    r.error_parameters!=='0' || !['none','ddl'].includes(r.statements) ||
    r.duration!=='-1' || r.duration_sample!=='-1' || Number(r.transaction_sample)!==0 ||
    r.transaction_sample==null || ![null,'none'].includes(r.audit) || !explainSafe)
    throw Error('n44_database_unavailable');
  // Even terse cannot make an arbitrary private query safe. Verify the exact
  // typed routines, source identities, owner, invoker mode and narrow ACL first.
  await assertVerifiedBoundary(client);
}
export function createExistingHost(readEnv) {
 if(readEnv('N44_ENABLED')!=='true')return Object.freeze({handle:async()=>privateResponse(),close:async()=>{}});
 const required=n=>{const v=readEnv(n);if(typeof v!=='string'||!v)throw Error('n44_configuration');return v;};
 const authUrl=required('N44_AUTH_URL'),origin=required('N44_PUBLIC_ORIGIN');
 for(const v of [authUrl,origin]){const u=new URL(v);if(u.origin!==v||u.protocol!=='https:')throw Error('n44_origin');}
 if(required('N44_SERVICE_REVISION')!=='n44-browser-service-v2')throw Error('n44_readback_missing');
 const sessionPolicy=JSON.parse(required('N44_SESSION_POLICY_JSON')),serviceSourceSha=required('N44_SERVICE_SOURCE_SHA');
 if(!supportedSessionPolicy(sessionPolicy,Date.now(),serviceSourceSha))throw Error('n44_session_policy_readback_missing');
 const dbUrl=required('N44_DATABASE_URL'),db=new URL(dbUrl),username=decodeURIComponent(db.username);
 if(!['postgres:','postgresql:'].includes(db.protocol)||!(username==='n44_service_login'&&db.hostname==='db.xlrubcwjqktzzunrvuns.supabase.co'||username==='n44_service_login.xlrubcwjqktzzunrvuns'&&db.hostname==='aws-0-ap-south-1.pooler.supabase.com'&&['','5432'].includes(db.port))||db.pathname!=='/postgres'||!db.password||db.search||db.hash)throw Error('n44_database_configuration');
 const key=n=>{const v=required(n);if(!/^[a-f0-9]{64}$/.test(v))throw Error('n44_key_configuration');return Buffer.from(v,'hex');};
 const ingressKey=key('N44_INGRESS_KEY'),schedulerKey=key('N44_SCHEDULER_KEY'),rateKey=key('N44_RATE_KEY');
 const raw=JSON.parse(required('N44_CRYPTO_JSON'));
 const ring=x=>{if(!Array.isArray(x)||x.length<1||x.length>8)throw Error('n44_key_configuration');return new Map(x.map(([name,value])=>{if(!/^[a-f0-9]{64}$/.test(value))throw Error('n44_key_configuration');return [name,Buffer.from(value,'hex')];}));};
 const material={...raw,sealingKeys:ring(raw.sealingKeys),endpointHmacKeys:ring(raw.endpointHmacKeys),bindingHmacKeys:ring(raw.bindingHmacKeys),vapidKeys:new Map(raw.vapidKeys)};
 const keys=[ingressKey,schedulerKey,rateKey,...material.sealingKeys.values(),...material.endpointHmacKeys.values(),...material.bindingHmacKeys.values()];
 if(new Set(keys.map(v=>v.toString('hex'))).size!==keys.length)throw Error('n44_separate_keys_required');
 for(const v of material.vapidKeys.values()){if(!p256.utils.isValidPrivateKey(Buffer.from(v.privateKey??'','base64url')))throw Error('n44_private_key_configuration');}
 const providerOrigins=JSON.parse(required('N44_PROVIDER_ORIGINS_JSON'));
 const crypto=createPrivatePushPorts({...material,providerOrigins,enabled:true});
 const ca=readEnv('N44_DATABASE_CA_CERT'),pool=new pg.Pool({connectionString:dbUrl,ssl:{rejectUnauthorized:true,servername:db.hostname,minVersion:'TLSv1.2',...(ca?{ca}:{})},max:4,
  connectionTimeoutMillis:1000,idleTimeoutMillis:10000,statement_timeout:3000,query_timeout:4000,application_name:'n44-private-server',allowExitOnIdle:true});
 pool.on('error',()=>{});let waiting=0;
 const acquire=async()=>{if(waiting>=4)throw Error('n44_pool_capacity');waiting++;let c;
  try{c=await pool.connect();
   const identity=(await c.query('select session_user as login,current_user as role')).rows[0];
   if(identity?.login!=='n44_service_login'||![identity.login,'n44_backend'].includes(identity.role))throw Error();
   await c.query('set role n44_backend');await assertPrivateDatabaseSession(c);
   return {query:(sql,values)=>privateQuery(c,sql,values),release:e=>c.release(e)};}
  catch{c?.release(Error('n44_database_unavailable'));throw Error('n44_database_unavailable');}finally{waiting--;}};
 try {
  const handle=createWebEntry({sessionPolicy,serviceSourceSha,acquire,authUrl,origin,apiKey:required('N44_AUTH_API_KEY'),providerOrigins,crypto,ingressKey,schedulerKey,rateKey,deliveryEnabled:readEnv('N44_DELIVERY_ENABLED')==='true'});
  return Object.freeze({handle,async close(){crypto.close();await pool.end();}});
 }catch{crypto.close();void pool.end();throw Error('n44_configuration');}
}
