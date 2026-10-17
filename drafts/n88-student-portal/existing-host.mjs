/** AI: Supabase Edge composition. Config is read ONLY after explicit activation.
 * No service-role key, new account, SDK Auth flow, migrations or runtime fixtures.
 */
import {Buffer} from 'node:buffer';
import pg from 'pg';
import manifest from './deployment.inactive.json' with {type:'json'};
import {createWebEntry} from './web-entry.mjs';
import {privateResponse} from './web-protocol.mjs';
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
  const secretKey=key('N88_HMAC_KEY'),ingressKey=key('N88_INGRESS_KEY');
  if(secretKey.equals(ingressKey))throw Error('n88_separate_keys_required');
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
      if((await client.query('select current_user as role')).rows[0]?.role!=='n88_backend')throw Error('n88_database_role');
      return client;
    }catch{client?.release(Error('n88_database_unavailable'));throw Error('n88_database_unavailable');}
    finally{waiting--;}
  };
  try {
    const handle=createWebEntry({...manifest,origin,authUrl,apiKey:required('N88_AUTH_API_KEY'),secretKey,ingressKey,acquire,
      sourceOnly:false,canonicalReadback:true,privateIngressReadback:true});
    return Object.freeze({handle,close:()=>pool.end()});
  }catch{void pool.end();throw Error('n88_configuration');}
}
