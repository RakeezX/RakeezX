/** AI: default-OFF hosted runtime, reuses original restricted LOGIN and Auth. */
import {createHash} from 'node:crypto';
import {createInactivePublicationV2FiniteBridge} from '../../publication-v2-finite-bridge.inactive.mjs';
import {publicationV2FiniteCatalogSha256} from '../../publication-v2-finite-catalog.inactive.mjs';
import {createPublicationV2PostgresRepository} from '../../publication-v2-postgres.inactive.mjs';
import {createPublicationV2Service} from '../../publication-v2-service.inactive.mjs';
import {authorizeRuntimeConnection,runtimeIdentitySql} from './capability.mjs';
export {runtimeIdentitySql};
import {definitions,encodeArguments,unwrapEnvelope} from '../v2-hosted-compat-1031/boundary.mjs';
import sourcePacket from '../v2-package-1028/manifest.json' with {type:'json'};
import oldContract from '../error-boundary-contract.json' with {type:'json'};
import typed from '../read-service-20261023/typed-read-operations.json' with {type:'json'};
import {assertVerifiedBoundary,privateQuery} from '../private-error-boundary.mjs';
const fail=()=>{throw Error('n88_v2_host_unavailable');};const must=v=>{if(!v)fail();};
const sha=s=>createHash('sha256').update(s).digest('hex');
const clean=r=>({command:r.command,rowCount:r.rowCount,rows:r.rows});
const currentSession='select user_id,session_id from n88_private.lock_current_session($1::uuid,$2::uuid)';
const ingressSql='select n88_private.consume_ingress($1::uuid,$2::bigint) as accepted';

export async function createHostedPublicationV2Runtime({enabled=false,acquire,assertTransport,expectedSystemIdentifier='7678071634733212629',canonical,origin,now=Date.now,transactionMs=5000}={}){
 if(enabled!==true)return Object.freeze({handle:createPublicationV2Service({origin})});
 must(typeof acquire==='function'&&typeof assertTransport==='function'&&canonical&&Number.isInteger(transactionMs)&&transactionMs>=50&&transactionMs<=5000);
 const operations=new Map(definitions.map(o=>[o.sql,o]));
 const oldReads=new Map([...oldContract.operations,...typed].filter(o=>o.sql===currentSession||o.sql===ingressSql||/^select n88_private\.lock_(?:canonical|projection)_sources\(/.test(o.sql)||o.sql.includes('from rakeezx.')).map(o=>[o.sql,o]));
 const prove=async c=>{const token=await authorizeRuntimeConnection(c,{expectedSystemIdentifier,assertTransport});await assertVerifiedBoundary(c);
 const fs=(await c.query(`select proname,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition,prosecdef,pg_get_userbyid(proowner) as owner,has_function_privilege(current_user,p.oid,'EXECUTE') as callable,(has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')) as public_call from pg_proc p where pronamespace='n88_private'::regnamespace and proname=any($1::text[]) order by proname`,[sourcePacket.functions.map(f=>f.name)])).rows;
 must(fs.length===14&&fs.every((f,i)=>f.proname===sourcePacket.functions[i].name&&f.definition===sourcePacket.functions[i].definition&&f.prosecdef&&f.owner==='n88_v2_guard'&&!f.callable&&!f.public_call));return token;};
 const first=await acquire();let runtimeCapability;try{runtimeCapability=await prove(first);}finally{first.release();}
 const repository=createPublicationV2PostgresRepository({executionMode:'hosted',runtimeCapability,transactionMs,acquire:async()=>{const c=await acquire();try{await prove(c);return {query:(sql,args)=>oldReads.has(sql)?privateQuery(c,sql,args):c.query(sql,args),release:broken=>c.release(broken)};}catch{c.release(Error('n88_v2_host_unavailable'));fail();}}});
  const scopeOwner = 'select set_config(\'n88.v2_owner\',$1,true)';
  // All mutable admission state belongs to one request/transaction closure.
  const assemble = request => {
    let identity = null, located = null, raw, deadline = now() + transactionMs;
    const admission = async () => {
      must(raw && now() < deadline);
      if (identity) {
        if (identity.role === 'teacher') {
          const r = await raw.query(currentSession, [identity.ownerId, identity.sessionId]);
          must(r.rows.length === 1 && r.rows[0].user_id === identity.ownerId && r.rows[0].session_id === identity.sessionId);
        }
        must(identity.expiresAt > now()); return structuredClone(identity);
      }
      const token = /(?:^|;\s*)__Secure-n88-student=([A-Za-z0-9_-]{43})(?:;|$)/.exec(request.headers?.cookie ?? '')?.[1];
      must(token && request.method === 'GET');
      return { ownerId: null, sessionId: null, role: 'locator', expiresAt: deadline, numeric: {
        tokenHash: sha(token), credentialId: null, studentId: null, version: null }, storageWrite: false };
    };
    const verifyIdentity = async (v, r) => {
      must(r === request && raw && v.auth.current === true);
      const c = { ownerId: v.auth.ownerId, sessionId: v.auth.sessionId, role: v.role,
        expiresAt: v.role === 'student' ? v.expiresAt : deadline, numeric: v.numeric ?? null, storageWrite: true };
      if (identity) must(JSON.stringify(identity) === JSON.stringify(c)); else identity = c;
      await raw.query(scopeOwner, [c.ownerId]);
    };
    const wrapped = { transaction: action => repository.transaction(async (legacy, ports) => {
      must(!raw); raw = ports;
      const executePublicationV2 = async (sql, args, signal) => {
        const o = operations.get(sql); must(o && !signal?.aborted && now() < deadline);
        let r;try { r=unwrapEnvelope(await ports.query(o.safeSql,[encodeArguments(args)])); } catch { ports.poison(); fail(); }
        if (o.id === 'numeric-session' && r.rows.length === 1) located = r.rows[0].payload;
        return clean(r);
      };
      const query = async (sql, args = []) => {
        must(oldReads.has(sql) && args.length === oldReads.get(sql).parameters.length);
        if (sql === currentSession) must(args.every(v => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v)));
        else if(sql===ingressSql)must(typeof args[0]==='string'&&/^[a-f0-9-]{36}$/.test(args[0])&&Number.isSafeInteger(args[1])&&args[1]>Math.floor(now()/1000)&&args[1]<=Math.floor(now()/1000)+32);
        else must((typeof args[0] === 'string' && /^[a-f0-9-]{36}$/.test(args[0]) || Array.isArray(args[0]) && args[0].length === 1 && /^[a-f0-9-]{36}$/.test(args[0][0])) &&
          (Array.isArray(args[0]) ? args[0][0] : args[0]) === (identity?.ownerId ?? located?.ownerId) && Number.isSafeInteger(args[1]) && args[1] >= 1 && args[1] <= 2001 &&
          (args.length === 2 || args.length === 3 && Number.isSafeInteger(args[2]) && args[2] >= 1 && args[2] <= 2097152));
        return ports.query(sql,args);
      };
      return action(legacy, Object.freeze({ query, beforeCommit: ports.beforeCommit, canonicalReadMode: () => 'serial', executePublicationV2 }));
    }) };
    const options = { ...canonical, onVerifiedIdentity: verifyIdentity };
    return { repository: wrapped, canonical: options, admission };
  };
  return Object.freeze({
    async handle(request) {
      const a = assemble(request);
      return await createInactivePublicationV2FiniteBridge({ executionMode: 'hosted', runtimeCapability, enabled: true, origin,
        catalogSha256: publicationV2FiniteCatalogSha256, repository: a.repository, verifyAdmission: a.admission,
        canonical: a.canonical, now, budgetMs: transactionMs })(request);
    },
  });
}
