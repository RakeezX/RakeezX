/** INACTIVE. Trusted server capability; no driver, credentials, Auth or network defaults.
 * acquire() must lease ONE exclusive pg-compatible connection through release(error).
 * All context/consent writers MUST use writeContexts (or the same owner-clock protocol).
 * work is PURE synchronous code: rolled-back serialization/deadlock may rerun it once.
 */
import { LIMITS, id, uuid, record, deliveryKey } from './shared.mjs';
import { LESSON_LEAD_MINUTES, DUE_STAGES } from '../../src/lib/notification-state.js';

const DAY = 86400_000;
// Fail closed at these retention-derived capacity bounds; never truncate a snapshot.
const receipts = LIMITS.registrationWritesPerHour * 24 * Math.ceil((LIMITS.registrationMs + LIMITS.receiptMs) / DAY);
export const SNAPSHOT_LIMITS = Object.freeze({ contexts: receipts + LIMITS.devices,
  registrations: receipts, deliveries: LIMITS.jobs, budgets: 2 * receipts + 2 });
const fail = () => { throw new Error('n44_repository_unavailable'); };
const must = condition => { if (!condition) fail(); };
const ownerUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const integer = value => {
  must(typeof value === 'number' || typeof value === 'bigint' || (typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(value)));
  const n = Number(value); must(Number.isSafeInteger(n) && n >= 0); return n;
};
const fp = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const clone = value => structuredClone(value);
const exact = (value, keys) => must(record(value, keys));
const ctxKey = (w, d) => JSON.stringify([w, d]);
const fields = {
  contexts: ['workspaceId','deviceId','active','sessionId','sessionRevision','sessionExpiresAt','consentRevision','pushConsent','preferences'],
  registrations: ['registrationId','workspaceId','deviceId','sessionId','sessionRevision','consentRevision','state','expiresAt','sealed','fingerprint','bindingFingerprint'],
  deliveries: ['key','registrationId','workspaceId','deviceId','payload','expiresAt','attempts','state','startedAt','nextAt'],
  budgets: ['bucket','count','expiresAt'],
};
const columns = {
  contexts: ['workspace_id','device_id','active','session_id','session_revision','session_expires_at_ms','consent_revision','push_consent','preferences'],
  registrations: ['registration_id','workspace_id','device_id','session_id','session_revision','consent_revision','state','expires_at_ms','sealed','fingerprint','binding_fingerprint'],
  deliveries: ['workspace_id','device_id','event_id','registration_id','kind','action_path','expires_at_ms','attempts','state','started_at_ms','next_at_ms'],
  budgets: ['budget_key','bucket','count','expires_at_ms'],
};
const primary = { contexts: ['workspace_id','device_id'], registrations: ['registration_id'],
  deliveries: ['workspace_id','device_id','event_id'], budgets: ['budget_key'] };
// Generated ONLY from the fixed module-owned allowlists, never caller labels.
const queries = Object.fromEntries(Object.keys(columns).map(table => {
  const cols = columns[table], pk = primary[table];
  return [table, {
    read: `select ${cols.map(c => /(_ms|^bucket$)/.test(c) ? `${c}::text as ${c}` : c === 'preferences' ? 'preferences::text as preferences' : c).join(',')} from n44_push_draft.${table} where owner_id=$1 limit $2`,
    put: `insert into n44_push_draft.${table} (owner_id,${cols.join(',')}) values (${['owner_id',...cols].map((_,i)=>`$${i+1}`).join(',')}) on conflict (owner_id,${pk.join(',')}) do update set ${cols.filter(c=>!pk.includes(c)).map(c=>`${c}=excluded.${c}`).join(',')}`,
    remove: `delete from n44_push_draft.${table} where owner_id=$1 and ${pk.map((c,i)=>`${c}=$${i+2}`).join(' and ')}`,
  }];
}));
function preferences(p) {
  exact(p, ['lesson','due','lessonMinutes','dueDays','timezone','quiet']);
  must(typeof p.lesson === 'boolean' && typeof p.due === 'boolean' && LESSON_LEAD_MINUTES.includes(p.lessonMinutes));
  must(Array.isArray(p.dueDays) && p.dueDays.length <= DUE_STAGES.length && new Set(p.dueDays).size === p.dueDays.length && p.dueDays.every(d=>DUE_STAGES.includes(d)));
  must(typeof p.timezone === 'string' && p.timezone.length <= 100);
  new Intl.DateTimeFormat('en', { timeZone:p.timezone });
  if (p.quiet !== null) { exact(p.quiet, ['start','end']); must([p.quiet.start,p.quiet.end].every(n=>Number.isInteger(n) && n>=0 && n<1440)); }
  must(Buffer.byteLength(JSON.stringify(p)) <= 2048);
}
function validate(table, key, r) {
  exact(r, fields[table]);
  must(Buffer.byteLength(JSON.stringify(r)) <= 16384);
  if (table === 'contexts') {
    must([r.workspaceId,r.deviceId,r.sessionId,r.sessionRevision,r.consentRevision].every(id));
    must(key === ctxKey(r.workspaceId,r.deviceId) && typeof r.active === 'boolean' && typeof r.pushConsent === 'boolean');
    must(integer(r.sessionExpiresAt) === r.sessionExpiresAt); preferences(r.preferences);
  } else if (table === 'registrations') {
    must(uuid(key) && key === r.registrationId && [r.workspaceId,r.deviceId,r.sessionId,r.sessionRevision,r.consentRevision].every(id));
    must(['active','revoked','dead'].includes(r.state) && integer(r.expiresAt) === r.expiresAt);
    must(r.state === 'active' ? fp(r.fingerprint) && fp(r.bindingFingerprint) && typeof r.sealed === 'string' && Buffer.byteLength(r.sealed)>0 && Buffer.byteLength(r.sealed)<=8192 : r.fingerprint===null && r.bindingFingerprint===null && r.sealed===null);
  } else if (table === 'deliveries') {
    exact(r.payload, ['id','kind','expiresAt','actionPath']);
    must([r.workspaceId,r.deviceId].every(id) && uuid(r.registrationId));
    must(typeof key === 'string' && key.length<=650 && key===r.key && key===deliveryKey(r.workspaceId,r.deviceId,r.payload.id));
    // Parse and require a canonical tuple; never concatenate or trust a JSON key.
    const parsed = JSON.parse(key); must(Array.isArray(parsed) && parsed.length===3 && JSON.stringify(parsed)===key);
    must(typeof r.payload.id==='string' && /^[a-zA-Z0-9_:%.-]{1,240}$/.test(r.payload.id) && ['lesson','due'].includes(r.payload.kind));
    must(typeof r.payload.actionPath==='string' && r.payload.actionPath.length>=1 && r.payload.actionPath.length<=800);
    must([r.expiresAt,r.startedAt,r.nextAt,r.attempts].every(n=>integer(n)===n) && r.payload.expiresAt===r.expiresAt && r.startedAt<r.expiresAt);
    must(r.attempts<=LIMITS.attempts && ['sending','retry','sent','uncertain','suppressed','dead'].includes(r.state) && (r.attempts>0 || r.state==='suppressed'));
  } else {
    must(key==='register' || key==='owner-day' || /^(hour|day):[A-Za-z0-9_.:-]{1,180}$/.test(key));
    must([r.bucket,r.count,r.expiresAt].every(n=>integer(n)===n) && r.count>=1 && r.count<=LIMITS.ownerSendsPerDay);
    const window = key==='register' || key.startsWith('hour:') ? 3600_000 : DAY;
    const cap = key==='register' ? LIMITS.registrationWritesPerHour : key==='owner-day' ? LIMITS.ownerSendsPerDay : key.startsWith('hour:') ? LIMITS.sendsPerHour : LIMITS.sendsPerDay;
    must(r.count<=cap && Number.isSafeInteger((r.bucket+1)*window) && r.expiresAt===(r.bucket+1)*window);
  }
  return r;
}
function decode(table, r) {
  exact(r, columns[table]);
  let row, key;
  if (table==='contexts') {
    must(typeof r.preferences==='string' && Buffer.byteLength(r.preferences)<=2048);
    row = { workspaceId:r.workspace_id, deviceId:r.device_id, active:r.active, sessionId:r.session_id,
      sessionRevision:r.session_revision, sessionExpiresAt:integer(r.session_expires_at_ms), consentRevision:r.consent_revision,
      pushConsent:r.push_consent, preferences:JSON.parse(r.preferences) }; key=ctxKey(row.workspaceId,row.deviceId);
  } else if (table==='registrations') {
    row={ registrationId:r.registration_id,workspaceId:r.workspace_id,deviceId:r.device_id,sessionId:r.session_id,
      sessionRevision:r.session_revision,consentRevision:r.consent_revision,state:r.state,expiresAt:integer(r.expires_at_ms),
      sealed:r.sealed,fingerprint:r.fingerprint,bindingFingerprint:r.binding_fingerprint }; key=row.registrationId;
  } else if (table==='deliveries') {
    key=deliveryKey(r.workspace_id,r.device_id,r.event_id);
    row={ key, registrationId:r.registration_id,workspaceId:r.workspace_id,deviceId:r.device_id,
      payload:{id:r.event_id,kind:r.kind,expiresAt:integer(r.expires_at_ms),actionPath:r.action_path},
      expiresAt:integer(r.expires_at_ms),attempts:integer(r.attempts),state:r.state,startedAt:integer(r.started_at_ms),nextAt:integer(r.next_at_ms) };
  } else { key=r.budget_key; row={bucket:integer(r.bucket),count:integer(r.count),expiresAt:integer(r.expires_at_ms)}; }
  return [key,validate(table,key,row)];
}
function encode(table,key,r) {
  if(table==='contexts') return [r.workspaceId,r.deviceId,r.active,r.sessionId,r.sessionRevision,r.sessionExpiresAt,r.consentRevision,r.pushConsent,JSON.stringify(r.preferences)];
  if(table==='registrations') return fields.registrations.map(f=>r[f]);
  if(table==='deliveries') return [r.workspaceId,r.deviceId,r.payload.id,r.registrationId,r.payload.kind,r.payload.actionPath,r.expiresAt,r.attempts,r.state,r.startedAt,r.nextAt];
  return [key,r.bucket,r.count,r.expiresAt];
}
function keyValues(table,key,row) {
  if(table==='contexts') return [row.workspaceId,row.deviceId];
  if(table==='deliveries') return [row.workspaceId,row.deviceId,row.payload.id];
  return [key];
}
// A synchronous work callback cannot recursively acquire this OR another repository.
let inWork = false;
export function createPostgresRepository({ acquire }) {
  must(typeof acquire === 'function');
  function run(ownerId, work, writer) {
    must(!inWork && ownerUUID(ownerId) && typeof work==='function' && work.constructor?.name!=='AsyncFunction');
    return execute(ownerId,work,writer);
  }
  async function execute(ownerId,work,writer) {
    for (let attempt=0; attempt<2; attempt++) {
      let c, begun=false, committed=false, broken=false, retry=false;
      try {
        c=await acquire(); must(c && typeof c.query==='function' && typeof c.release==='function');
        await c.query('begin isolation level read committed'); begun=true;
        await c.query("set local statement_timeout='6000ms'");
        await c.query("set local lock_timeout='3000ms'");
        await c.query("set local idle_in_transaction_session_timeout='10000ms'");
        await c.query('set local synchronous_commit=on');
        await c.query('insert into n44_push_draft.owner_clock(owner_id,high_water_ms) values ($1,0) on conflict (owner_id) do nothing',[ownerId]);
        const lock=await c.query('select high_water_ms::text as high_water_ms from n44_push_draft.owner_clock where owner_id=$1 for update',[ownerId]);
        must(lock.rows.length===1); exact(lock.rows[0],['high_water_ms']);
        const db=await c.query('select floor(extract(epoch from clock_timestamp())*1000)::bigint::text as now_ms');
        must(db.rows.length===1); exact(db.rows[0],['now_ms']);
        let highWater=Math.max(integer(lock.rows[0].high_water_ms),integer(db.rows[0].now_ms));
        const state={}, original={}; let bytes=0;
        for(const table of Object.keys(columns)) {
          const loaded=await c.query(queries[table].read,[ownerId,SNAPSHOT_LIMITS[table]+1]);
          must(loaded.rows.length<=SNAPSHOT_LIMITS[table]);
          state[table]=new Map();
          for(const raw of loaded.rows) {
            const [key,row]=decode(table,raw); must(!state[table].has(key)); state[table].set(key,row);
            bytes+=Buffer.byteLength(JSON.stringify(row)); must(bytes<=32*1024*1024);
          }
          original[table]=clone(state[table]);
        }
        // Only THIS owner's claims; never query existence or content of foreign claims.
        const loaded=await c.query('select fingerprint,registration_id from n44_push_draft.endpoint_claims where owner_id=$1 limit $2',[ownerId,SNAPSHOT_LIMITS.registrations+1]);
        must(loaded.rows.length<=SNAPSHOT_LIMITS.registrations);
        const claims=new Map();
        for(const row of loaded.rows) {
          exact(row,['fingerprint','registration_id']); must(fp(row.fingerprint) && uuid(row.registration_id) && !claims.has(row.fingerprint));
          const r=state.registrations.get(row.registration_id); must(r?.state==='active' && r.fingerprint===row.fingerprint);
          claims.set(row.fingerprint,row.registration_id);
        }
        for(const r of state.registrations.values()) if(r.state==='active') must(claims.get(r.fingerprint)===r.registrationId);
        const oldClaims=clone(claims);
        let open=true;
        const guard=()=>must(open);
        const tableMap=table=>{ guard(); must(Object.hasOwn(fields,table) && (writer || table!=='contexts')); return state[table]; };
        const tx=Object.freeze({
          time(now) {guard(); highWater=Math.max(highWater,integer(now)); return highWater;},
          context(w,d) {guard(); must(id(w)&&id(d)); return clone(state.contexts.get(ctxKey(w,d)) ?? null);},
          get(table,key) {return clone(tableMap(table).get(key));},
          rows(table) {return clone([...tableMap(table).values()]);},
          entries(table) {return clone([...tableMap(table).entries()]);},
          set(table,key,row) {const map=tableMap(table); validate(table,key,row); map.set(key,clone(row)); must(map.size<=SNAPSHOT_LIMITS[table]);},
          delete(table,key) {tableMap(table).delete(key);},
          claimEndpoint(fingerprint,rid) {guard(); must(fp(fingerprint)&&uuid(rid)); const old=claims.get(fingerprint); if(old && old!==rid) return false; claims.set(fingerprint,rid); return true;},
          releaseEndpoint(fingerprint,rid) {guard(); must(fp(fingerprint)&&uuid(rid)); if(claims.get(fingerprint)===rid) claims.delete(fingerprint);},
        });
        let value;
        try {
          inWork=true; value=work(tx);
          if(value && typeof value.then==='function') {
            // Drain a rejected async result without allowing its later tx access.
            Promise.resolve(value).catch(()=>{}); fail();
          }
          value=clone(value);
        }
        finally { inWork=false; open=false; }
        // Validate the complete buffered state, even if work caught a tx error.
        bytes=0;
        for(const table of Object.keys(columns)) {
          must(state[table].size<=SNAPSHOT_LIMITS[table]);
          for(const [key,row] of state[table]) {
            validate(table,key,row); bytes+=Buffer.byteLength(JSON.stringify(row)); must(bytes<=32*1024*1024);
          }
        }
        for(const [fingerprint,rid] of claims) {const r=state.registrations.get(rid); must(r?.state==='active' && r.fingerprint===fingerprint);}
        for(const r of state.registrations.values()) if(r.state==='active') must(claims.get(r.fingerprint)===r.registrationId);
        // Exact release first; no ON CONFLICT UPDATE for global endpoint ownership.
        for(const [fingerprint,rid] of oldClaims) if(claims.get(fingerprint)!==rid)
          await c.query('delete from n44_push_draft.endpoint_claims where owner_id=$1 and fingerprint=$2 and registration_id=$3',[ownerId,fingerprint,rid]);
        // Delete children before parents (receipts intentionally have no registration FK).
        for(const table of ['deliveries','budgets','registrations','contexts']) {
          for(const [key,row] of original[table]) if(!state[table].has(key)) await c.query(queries[table].remove,[ownerId,...keyValues(table,key,row)]);
        }
        // Parents before children; tombstones before replacement active-context inserts.
        for(const table of Object.keys(columns)) {
          for(const [key,row] of state[table]) if(original[table].has(key) && JSON.stringify(row)!==JSON.stringify(original[table].get(key))) await c.query(queries[table].put,[ownerId,...encode(table,key,row)]);
          for(const [key,row] of state[table]) if(!original[table].has(key)) await c.query(queries[table].put,[ownerId,...encode(table,key,row)]);
        }
        for(const [fingerprint,rid] of claims) if(oldClaims.get(fingerprint)!==rid)
          await c.query('insert into n44_push_draft.endpoint_claims(fingerprint,owner_id,registration_id) values ($1,$2,$3)',[fingerprint,ownerId,rid]);
        await c.query('update n44_push_draft.owner_clock set high_water_ms=$2 where owner_id=$1',[ownerId,highWater]);
        await c.query('commit'); committed=true;
        return value; // Only after acknowledged durable commit; never before flush.
      } catch(e) {
        // PG ErrorResponse 40001/40P01 means aborted transaction, even at COMMIT.
        // Transport/query timeout or lost COMMIT acknowledgement is NEVER replayed.
        const definitive = ['40001','40P01'].includes(e?.code) && e?.severity==='ERROR';
        let rolledBack=false;
        if(c && begun && !committed) {try {await c.query('rollback'); rolledBack=true;} catch {broken=true;}}
        retry=definitive && rolledBack && attempt===0;
        broken ||= !definitive;
        if(!retry) fail();
      } finally { if(c) { try {await c.release(broken ? new Error('n44_repository_unavailable') : undefined);} catch { /* release cannot undo an acknowledged commit */ } } }
      if(!retry) fail();
    }
    fail();
  }
  return Object.freeze({ atomic:(ownerId,work)=>run(ownerId,work,false),
    // Trusted canonical writer preparation ONLY. Not HTTP/client authorization.
    writeContexts:(ownerId,work)=>run(ownerId,work,true) });
}
