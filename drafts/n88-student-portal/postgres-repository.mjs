import { Buffer } from 'node:buffer';
import {assertVerifiedBoundary,privateQuery} from './activation/private-error-boundary.mjs';
import {createReadPhaseTiming} from './web-protocol.mjs';
/** AI: INACTIVE trusted-server pilot port. No driver/network/Auth/config defaults.
 * All writers must use this SAME global transaction lock. Small, bounded snapshots
 * serialize even async teacher verification: unsuitable for public production scale.
 * acquire() returns an exclusive pg-compatible client with query/release(error).
 * No retries (especially after uncertain COMMIT); no in-memory fallback.
 */
const unavailable = () => new Error('n88_repository_unavailable');
const must = test => { if (!test) throw unavailable(); };
// Fixed trusted namespace, never derived from a request/owner/source.
const LOCK = 'select pg_advisory_xact_lock(1312307256, 88)';
const tables = {
  contexts: { sql: 'contexts', pk: ['namespace'], fields: ['namespace','ownerId','active'],
    cols: ['namespace','owner_id','active'] },
  memberships: { sql: 'memberships', pk: ['owner_id','class_id','student_id','enrollment_id'],
    fields: ['ownerId','classId','studentId','enrollmentId','revision','status','endDate','studentActive','classActive','label','canonicalStamp'],
    cols: ['owner_id','class_id','student_id','enrollment_id','revision','status','end_date','student_active','class_active','label','canonical_stamp','active'] },
  credentials: { sql: 'credentials', pk: ['id'], fields: ['id','namespace','ownerId','studentId','version','verifier','entryVerifier','revokedAt'],
    cols: ['id','namespace','owner_id','student_id','version','verifier','entry_verifier','revoked_at'] },
  sessions: { sql: 'sessions', pk: ['id'],
    fields: ['id','credentialId','namespace','ownerId','classId','studentId','enrollmentId','version','membershipRevision','entryVerifier','tokenHash','expiresAt','revokedAt','canonicalStamp'],
    cols: ['id','credential_id','namespace','owner_id','class_id','student_id','enrollment_id','version','membership_revision','entry_verifier','token_hash','expires_at','revoked_at','canonical_stamp'] },
  publications: { sql: 'publications', pk: ['id'],
    fields: ['id','ownerId','classId','studentId','enrollmentId','source','title','instruction','deadline','status','published'],
    cols: ['id','owner_id','class_id','student_id','enrollment_id','source_teaching_id','source_item_id','title','instruction','deadline','status','published'] },
  rates: { sql: 'guess_budgets', pk: ['key'], fields: ['key','count','until'], cols: ['key','count','until_at'] },
};
const names = Object.keys(tables);
const exact = (o, keys) => must(o && Object.getPrototypeOf(o) === Object.prototype &&
  Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k)));
const str = (s, max, min = 1) => must(typeof s === 'string' && s.length >= min && s.length <= max && !s.includes('\0'));
const uuid = s => must(typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s));
const hex = s => must(typeof s === 'string' && /^[a-f0-9]{64}$/.test(s));
const bool = b => must(typeof b === 'boolean');
const safe = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => { must(typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max); return n; };
const number = n => { must(typeof n === 'string' && /^(0|[1-9][0-9]*)(\.0+)?$/.test(n)); return safe(Number(n)); };
const time = n => safe(n, 0, 253402300799999);
const date = s => { if (s === null) return; must(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s); };
const namespace = s => must(typeof s === 'string' && /^[A-Za-z0-9_-]{24,64}$/.test(s));
const active = r => r.status === 'active' && r.endDate === null && r.studentActive && r.classActive;
function validate(name, r) {
  exact(r, tables[name].fields);
  for (const k of ['ownerId','id','credentialId']) if (Object.hasOwn(r,k)) uuid(r[k]);
  for (const k of ['classId','studentId','enrollmentId']) if (Object.hasOwn(r,k)) str(r[k],240);
  if (Object.hasOwn(r,'namespace')) namespace(r.namespace);
  for (const k of ['version','revision','membershipRevision']) if (Object.hasOwn(r,k)) safe(r[k],1);
  for (const k of ['verifier','entryVerifier','tokenHash']) if (Object.hasOwn(r,k)) hex(r[k]);
  if (Object.hasOwn(r,'canonicalStamp')) hex(r.canonicalStamp);
  if (Object.hasOwn(r,'revokedAt') && r.revokedAt !== null) time(r.revokedAt);
  if (name === 'contexts') bool(r.active);
  if (name === 'memberships') {
    must(['active','inactive','ended'].includes(r.status)); date(r.endDate);
    bool(r.studentActive); bool(r.classActive); str(r.label,300,0);
  }
  if (name === 'sessions') time(r.expiresAt);
  if (name === 'publications') {
    exact(r.source,['teachingId','itemId']); str(r.source.teachingId,240); str(r.source.itemId,240);
    str(r.title,160); str(r.instruction,500,0); date(r.deadline);
    must(['todo','working','done'].includes(r.status)); bool(r.published);
  }
  if (name === 'rates') { must(r.key === 'global' || r.key === 'global-failure' || /^[a-f0-9]{64}$/.test(r.key)); safe(r.count,0,2147483647); time(r.until); }
}
const stamp = n => n === null ? null : new Date(time(n)).toISOString();
function encode(name,r) {
  validate(name,r);
  if (name === 'memberships') return tables[name].fields.map(k=>r[k]).concat(active(r));
  if (name === 'publications') return [r.id,r.ownerId,r.classId,r.studentId,r.enrollmentId,r.source.teachingId,r.source.itemId,r.title,r.instruction,r.deadline,r.status,r.published];
  return tables[name].fields.map(k=>['revokedAt','expiresAt','until'].includes(k)?stamp(r[k]):r[k]);
}
function decode(name,row) {
  const t = tables[name]; exact(row,t.cols);
  let r;
  if (name === 'publications') r = {id:row.id,ownerId:row.owner_id,classId:row.class_id,studentId:row.student_id,enrollmentId:row.enrollment_id,
    source:{teachingId:row.source_teaching_id,itemId:row.source_item_id},title:row.title,instruction:row.instruction,deadline:row.deadline,status:row.status,published:row.published};
  else r = Object.fromEntries(t.fields.map((k,i)=>[k,row[t.cols[i]]]));
  for (const k of ['version','revision','membershipRevision','count']) if (Object.hasOwn(r,k)) r[k]=number(r[k]);
  for (const k of ['revokedAt','expiresAt','until']) if (Object.hasOwn(r,k) && r[k] !== null) r[k]=number(r[k]);
  validate(name,r);
  if (name === 'memberships') { bool(row.active); must(row.active === active(r)); }
  return r;
}
// SQL is generated exclusively from the above fixed private table/column allowlist.
const queries = Object.fromEntries(names.map(name=>{
  const t=tables[name], col=c=> c.endsWith('_at') ? `(extract(epoch from ${c})*1000)::text as ${c}` :
    ['revision','version','membership_revision','count','end_date','deadline'].includes(c) ? `${c}::text as ${c}` : c;
  return [name,{
    // Bound the transfer as well as the decoded snapshot. Over-cap rows become
    // explicit null sentinels, NEVER filtered/truncated into a successful snapshot.
    // Numeric/time columns are text inside JSON (no implicit bigint/Date coercion).
    read:`select case when octet_length(payload)<=$2 and sum(octet_length(payload)) over (rows unbounded preceding)<=$3 then payload else null end as bounded_row from (select row_to_json(t)::text as payload from (select ${t.cols.map(col).join(',')} from n88_private.${t.sql} limit $1) t) bounded`,
    insert:`insert into n88_private.${t.sql} (${t.cols.join(',')}) values (${t.cols.map((_,i)=>`$${i+1}`).join(',')})`,
    update:`update n88_private.${t.sql} set ${t.cols.filter(c=>!t.pk.includes(c)).map(c=>`${c}=$${t.cols.indexOf(c)+1}`).join(',')} where ${t.pk.map(c=>`${c}=$${t.cols.indexOf(c)+1}`).join(' and ')}`,
    remove:`delete from n88_private.${t.sql} where ${t.pk.map((c,i)=>`${c}=$${i+1}`).join(' and ')}`,
  }];
}));
const pk = (name,values) => tables[name].pk.map(k=>values[tables[name].cols.indexOf(k)]);
function snapshot(state,limits) {
  exact(state,names); let total=0, bytes=0;
  const maps={};
  for(const name of names) {
    must(Array.isArray(state[name]) && state[name].length <= limits[name]); total+=state[name].length;
    must(total<=limits.total); maps[name]=new Map();
    for(const r of state[name]) {
      const values=encode(name,r), json=JSON.stringify(r), size=Buffer.byteLength(json);
      must(size<=limits.rowBytes); bytes+=size; must(bytes<=limits.bytes);
      const key=JSON.stringify(pk(name,values)); must(!maps[name].has(key)); maps[name].set(key,values);
    }
  }
  return maps;
}
function transitions(before,after) {
  // No credential deletion/unrevocation/rekeying: old PINs/entries stay tombstoned.
  for(const [key,a] of before.credentials) {
    const b=after.credentials.get(key); must(b);
    must(a.slice(0,7).every((v,i)=>v===b[i])); must(a[7]===null || b[7]!==null);
  }
  for(const [key,a] of before.sessions) {
    const b=after.sessions.get(key); if(!b) continue;
    must(a.slice(0,12).every((v,i)=>v===b[i])); must(a[12]===null || a[12]===b[12]);
    must(a[13]===b[13]);
  }
}
/** Explicit bounds required, including aggregate row/byte caps. No truncation.
 * A JS callback may await, but must be cooperative (no event-loop blocking loops).
 * Timed-out callbacks own only a detached draft; fences prevent ALL later flushes.
 * Pool must itself bound connections/queue and release(error) must destroy client.
 */
export function createPostgresRepository({ acquire, limits, timing, synchronize = async () => {} }) {
  must(typeof synchronize === 'function');
  must(typeof acquire==='function'); exact(limits,[...names,'total','bytes','rowBytes']);
  for(const k of names) safe(limits[k],1,10000);
  safe(limits.total,1,50000); safe(limits.bytes,1024,64*1024*1024); safe(limits.rowBytes,128,32768);
  exact(timing,['acquireMs','transactionMs','cleanupMs','statementMs','lockMs']);
  for(const k of Object.keys(timing)) safe(timing[k],1,60000);
  must(timing.acquireMs<=timing.transactionMs && timing.statementMs<=timing.transactionMs && timing.lockMs<=timing.statementMs);
  limits={...limits}; timing={...timing};
  return Object.freeze({ async transaction(action) {
    must(typeof action==='function');
    let c, live=true, begun=false, committed=false, destroyed=false, stage='acquire';
    const phases=createReadPhaseTiming(),measure=phases.measure;
    const deadline=Date.now()+timing.transactionMs;
    const fence=()=>must(live && Date.now()<deadline);
    const release=broken=>{ if(c && !destroyed) {destroyed=true; c.release(broken ? unavailable() : undefined);} };
    const query=async(text,values=[])=>{fence(); const run=()=>privateQuery(c,text,values);
      const r=await (['begin','snapshot'].includes(stage)||text.startsWith('select case when octet_length(payload::text)') ? measure('snapshot',run):run()); fence(); return r;};
    let timer, acquireTimer;
    const work=(async()=>{
      const lease=Promise.resolve().then(()=>acquire(measure));
      // If acquisition times out, a later pool lease is destroyed, never leaked/reused.
      lease.then(client=>{if(!live) client.release(unavailable());},()=>{});
      c=await Promise.race([lease,new Promise((_,reject)=>{acquireTimer=setTimeout(()=>reject(unavailable()),timing.acquireMs);})]);
      clearTimeout(acquireTimer); fence();
      must(c && typeof c.query==='function' && typeof c.release==='function');
      await measure('boundary',()=>assertVerifiedBoundary(c)); fence();
      stage='begin';await query('begin isolation level read committed'); begun=true;
      await query("select set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true),set_config('idle_in_transaction_session_timeout',$3,true),set_config('search_path','pg_catalog',true),set_config('TimeZone','UTC',true),set_config('DateStyle','ISO, YMD',true),set_config('synchronous_commit','on',true)",
        [String(timing.statementMs),String(timing.lockMs),String(timing.transactionMs)]);
      await query(LOCK); // BEFORE any sensitive snapshot lookup; all writers cooperate.
      stage='snapshot';const state={}; let count=0, bytes=0, transferred=0;
      for(const name of names) {
        // Also cap against remaining aggregate capacity: never fetch unbounded history.
        const bound=Math.min(limits[name],limits.total-count);
        const result=await query(queries[name].read,[bound+1,limits.rowBytes,limits.bytes-transferred]);
        must(result.rows.length<=bound);
        state[name]=result.rows.map(row=>{
          exact(row,['bounded_row']); must(typeof row.bounded_row==='string');
          transferred+=Buffer.byteLength(row.bounded_row); must(transferred<=limits.bytes);
          return decode(name,JSON.parse(row.bounded_row));
        }); count+=state[name].length;
        bytes+=Buffer.byteLength(JSON.stringify(state[name])); must(bytes<=limits.bytes);
      }
      const original=snapshot(state,limits);stage='operation';
      // Trusted runtime canonical binding participates in THIS transaction/lock and
      // durable diff. The fenced query capability cannot outlive the transaction.
      const owners=new Set(),commitGuards=[];
      const beforeCommit=check=>{fence();must(typeof check==='function' && commitGuards.length<8);commitGuards.push(check);};
      const synchronizeOwner=async ownerId=>{
        fence(); uuid(ownerId); if(owners.has(ownerId)) return;
        await measure('sync',()=>synchronize(state,{query},ownerId)); fence(); snapshot(state,limits); owners.add(ownerId);
      };
      const value=await action(state,Object.freeze({query,synchronizeOwner,beforeCommit,measure})); fence();
      // Neither the callback's retained references nor its result can alter the flush.
      const final=snapshot(structuredClone(state),limits), result=structuredClone(value);
      transitions(original,final); fence();
      // Children first on removal. Credentials can never be removed.
      for(const name of ['sessions','publications','memberships','contexts','rates'])
        for(const [key,row] of original[name]) if(!final[name].has(key))
          must((await query(queries[name].remove,pk(name,row))).rowCount===1);
      // Parents first; update ALL old credentials (revoke) before replacement insert.
      for(const name of names) {
        for(const [key,row] of final[name]) if(original[name].has(key) && JSON.stringify(row)!==JSON.stringify(original[name].get(key)))
          must((await query(queries[name].update,row)).rowCount===1);
        for(const [key,row] of final[name]) if(!original[name].has(key))
          must((await query(queries[name].insert,row)).rowCount===1);
      }
      for(const check of commitGuards){await check();fence();}
      const ack=await measure('commit',()=>query('commit')); must(ack.command==='COMMIT'); committed=true;
      if(result?.readPhaseDiagnostic===true){delete result.readPhaseDiagnostic;if(result.status===200)result.readPhases=phases.finish();}
      return result; // No response/cookie/PIN until acknowledged durable commit.
    })();
    try {
      return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(unavailable()),Math.max(1,deadline-Date.now()));})]);
    } catch {
      live=false;
      if(c && begun && !committed && !destroyed) {
        let cleanupTimer;
        try { await Promise.race([c.query('rollback'),new Promise((_,reject)=>{cleanupTimer=setTimeout(()=>reject(unavailable()),timing.cleanupMs);})]); }
        catch { /* destroy socket below: no reused client with queued/uncertain SQL */ }
        finally {clearTimeout(cleanupTimer);}
      }
      const error=unavailable();error.safeStage=stage;throw error; // Fixed phase only, never PostgreSQL diagnostics.
    } finally {
      live=false; clearTimeout(timer); clearTimeout(acquireTimer);
      release(!committed); // Broken/uncertain/timed-out clients are destroyed.
    }
  } });
}
