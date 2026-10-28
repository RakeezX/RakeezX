/** AI: existing Supabase Edge composition; all external capabilities disabled by default. */
import './node-globals.mjs';
import {CURRENT_INSPECTION} from './activation/current-hosted-inspection.mjs';
import {assertVerifiedBoundary,privateQuery} from './activation/private-error-boundary.mjs';
import {supportedSessionPolicy} from './session-policy.mjs';
import {Buffer} from 'node:buffer';
import pg from 'pg';
import {p256} from '@noble/curves/nist.js';
import {readSenderMaterial} from './sender-material.mjs';
import {createPrivatePushPorts} from './private-runtime.mjs';
import {createWebEntry} from './web-entry.mjs';
import {privateResponse} from './web-protocol.mjs';
import {databaseConfig} from './database-transport.mjs';
import {runtimeFailure} from './runtime-failure.mjs';
import {prepareRequestSession} from './request-session.mjs';
export async function assertPrivateDatabaseSession(client,onSource=()=>{}) {
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
  onSource();await assertVerifiedBoundary(client);
}
export function createExistingHost(readEnv,{Pool=pg.Pool,fetch,now=Date.now,senderPorts={}}={}) {
 let configurationPhase='configuration';try{
 if(readEnv('N44_ENABLED')!=='true')return Object.freeze({handle:async()=>privateResponse(),close:async()=>{}});
 const required=n=>{const v=readEnv(n);if(typeof v!=='string'||!v)throw Error('n44_configuration');return v;};
 configurationPhase='configuration_origin';const authUrl=required('N44_AUTH_URL'),origin=required('N44_PUBLIC_ORIGIN');
 for(const v of [authUrl,origin]){const u=new URL(v);if(u.origin!==v||u.protocol!=='https:')throw Error('n44_origin');}
 configurationPhase='configuration_revision';if(required('N44_SERVICE_REVISION')!=='n44-browser-service-v2')throw Error('n44_readback_missing');
 configurationPhase='configuration_policy';
 const sessionPolicy=JSON.parse(required('N44_SESSION_POLICY_JSON')),serviceSourceSha=required('N44_SERVICE_SOURCE_SHA');
 if(!supportedSessionPolicy(sessionPolicy,now(),serviceSourceSha))throw Error('n44_session_policy_readback_missing');
 configurationPhase='configuration_transport';const transport=databaseConfig(readEnv);
 configurationPhase='configuration_crypto';
 const key=n=>{const v=required(n);if(!/^[a-f0-9]{64}$/.test(v))throw Error('n44_key_configuration');return Buffer.from(v,'hex');};
 const ingressKey=key('N44_INGRESS_KEY'),schedulerKey=key('N44_SCHEDULER_KEY'),rateKey=key('N44_RATE_KEY');
 const material=readSenderMaterial(required('N44_CRYPTO_JSON'));
 const keys=[ingressKey,schedulerKey,rateKey,...material.sealingKeys.values(),...material.endpointHmacKeys.values(),...material.bindingHmacKeys.values()];
 if(new Set(keys.map(v=>v.toString('hex'))).size!==keys.length)throw Error('n44_separate_keys_required');
 for(const v of material.vapidKeys.values()){if(!p256.utils.isValidPrivateKey(Buffer.from(v.privateKey??'','base64url')))throw Error('n44_private_key_configuration');}
 configurationPhase='configuration_provider';const providerOrigins=JSON.parse(required('N44_PROVIDER_ORIGINS_JSON'));
 const crypto=createPrivatePushPorts({...material,providerOrigins,enabled:true},{...senderPorts,clock:now});
 const pool=new Pool(transport);
 pool.on('error',()=>{});let waiting=0;
 const acquire=async()=>{if(waiting>=4)throw Error('n44_pool_capacity');waiting++;let c;
  let phase='connect';try{c=await pool.connect();
   await prepareRequestSession(c,transport.ssl.servername==='db.xlrubcwjqktzzunrvuns.supabase.co'?'direct':'session',assertPrivateDatabaseSession);
   return {query:async(sql,values)=>{try{return await privateQuery(c,sql,values);}catch(e){throw runtimeFailure('query',e);}},release:e=>c.release(e)};}
  catch(e){c?.release(Error('n44_database_unavailable'));throw runtimeFailure(phase,e);}finally{waiting--;}};
 try {
  const finiteScheduler=JSON.parse(readEnv('N44_FINITE_SCHEDULER_JSON')??'null');
  const approval=JSON.parse(readEnv('N44_ONE_DEVICE_TEST_JSON')??'null');
  // A separate reviewed pin is mandatory. Never derive authority from its own descriptor.
  const mobileTrial=approval?.kind==='n44-mobile-pilot-v1'?approval:null;
  const mobileGrantSha256=readEnv('N44_MOBILE_GRANT_SHA256')??null;
  if(mobileGrantSha256!==null&&!mobileTrial)throw Error('n44_mobile_configuration_conflict');
  if(mobileTrial&&(approval.purpose!==undefined||readEnv('N44_DELIVERY_ENABLED')==='true'||readEnv('N44_SCHEDULER_ENABLED')==='true'))throw Error('n44_mobile_configuration_conflict');
  const operatorDisposal=approval?.purpose==='n44-exact-old-disposal-v1'?approval:null,currentInspection=approval?.purpose===CURRENT_INSPECTION?approval:null,deviceTest=mobileTrial||operatorDisposal||currentInspection?null:approval;
  const publicVapidKey=material.vapidKeys.get(material.activeVapidKeyId)?.publicKey??null;
  const handle=createWebEntry({finiteScheduler,sessionPolicy,serviceSourceSha,acquire,authUrl,origin,apiKey:required('N44_AUTH_API_KEY'),providerOrigins,crypto,ingressKey,schedulerKey,rateKey,deviceTest,operatorDisposal,currentInspection,mobileTrial,mobileGrantSha256,publicVapidKey,deliveryEnabled:readEnv('N44_DELIVERY_ENABLED')==='true',fetch,now});
  return Object.freeze({handle,async close(){crypto.close();await pool.end();}});
 }catch(e){crypto.close();void pool.end();throw runtimeFailure('configuration',e);}
 }catch(e){throw runtimeFailure(configurationPhase,e);}
}
