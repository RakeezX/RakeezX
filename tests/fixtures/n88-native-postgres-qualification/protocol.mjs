/** Bounded SQL TEST adapter, never the synchronous production service repository. */
import { readFile } from 'node:fs/promises';
const scopeSql = await readFile(new URL('./read-scope.sql', import.meta.url), 'utf8');
const sessionSql = await readFile(new URL('./create-session.sql', import.meta.url), 'utf8');
const S = 'n88_private';
export async function transaction(c, fn) {
  await c.query('begin');
  try { const result = await fn(); await c.query('commit'); return result; }
  catch (e) { await c.query('rollback'); throw e; }
}
// All cooperating lifecycle/login/read/rotate/revoke operations use this order.
// Context serializes membership insertions too; SQL does not impose this on a
// writer that ignores the protocol. No network operations occur under locks.
export async function lockScope(c, namespace, owner, student) {
  await c.query(`select namespace from ${S}.contexts where namespace=$1 and owner_id=$2 for update`, [namespace,owner]);
  await c.query(`select enrollment_id from ${S}.memberships where owner_id=$1 and student_id=$2 order by class_id,enrollment_id for update`, [owner,student]);
  await c.query(`select id from ${S}.credentials where owner_id=$1 and student_id=$2 order by id for update`, [owner,student]);
  await c.query(`select id from ${S}.sessions where owner_id=$1 and student_id=$2 order by id for update`, [owner,student]);
}
export async function loginLocked(c, credential, id, tokenHash, verifier=credential.verifier) {
  return (await c.query(sessionSql, [id,tokenHash,credential.entry_verifier,verifier])).rowCount;
}
export async function login(c, credential, id, tokenHash, verifier) {
  return transaction(c, async () => {
    await lockScope(c, credential.namespace, credential.owner_id, credential.student_id);
    return loginLocked(c, credential, id, tokenHash, verifier);
  });
}
export async function read(c, credential, tokenHash, entry=credential.entry_verifier) {
  return transaction(c, async () => {
    await lockScope(c, credential.namespace, credential.owner_id, credential.student_id);
    const scopes=(await c.query(scopeSql,[tokenHash,entry])).rows;
    if(scopes.length!==1) return null;
    const s=scopes[0];
    const tasks=(await c.query(`select id,title,instruction,deadline::text,status from ${S}.publications
      where (owner_id,class_id,student_id,enrollment_id)=($1,$2,$3,$4) and published order by id`,
    [s.owner_id,s.class_id,s.student_id,s.enrollment_id])).rows;
    return { tasks, progress:{total:tasks.length,completed:tasks.filter(t=>t.status==='done').length} };
  });
}
export async function revokeLocked(c, credential) {
  const time=(await c.query('select clock_timestamp() as time')).rows[0].time;
  await c.query(`update ${S}.credentials set revoked_at=$2 where id=$1`,[credential.id,time]);
  return (await c.query(`update ${S}.sessions set revoked_at=$2 where credential_id=$1`,[credential.id,time])).rowCount;
}
// Fixed, pre-provisioned FIVE-key fixture: no dynamic-key capacity/purge claim.
// A production adapter must additionally enforce the global 10,000-key admission
// contract atomically. Maxima/time windows below match the current service.
export async function attempt(c, keys, credential, verifier) {
  return transaction(c,async()=>{
    const rows=(await c.query(`select key,count,until_at from ${S}.guess_budgets
      where key=any($1::text[]) order by key for update`,[keys.map(k=>k.key).sort()])).rows;
    if(rows.length!==keys.length) throw Error('Missing pre-provisioned budget key');
    const time=(await c.query('select clock_timestamp() as time')).rows[0].time;
    await c.query(`update ${S}.guess_budgets set count=0,
      until_at=$2::timestamptz + case when key=any($3::text[]) then interval '24 hours' else interval '15 minutes' end
      where key=any($1::text[]) and until_at <= $2`,[keys.map(k=>k.key),time,keys.filter(k=>k.failure).map(k=>k.key)]);
    const current=(await c.query(`select key,count from ${S}.guess_budgets where key=any($1::text[])`,[keys.map(k=>k.key)])).rows;
    if(keys.some(k=>current.find(r=>r.key===k.key).count>=k.max)) return {reserved:false,lookedUp:false};
    await c.query(`update ${S}.guess_budgets set count=count+1 where key=any($1::text[])`,[keys.filter(k=>!k.failure).map(k=>k.key)]);
    // Lookup happens only AFTER reservation, including malformed/unknown claims.
    const valid=(await c.query(`select exists(select 1 from ${S}.credentials c join ${S}.contexts x
      on (x.namespace,x.owner_id)=(c.namespace,c.owner_id)
      where c.entry_verifier=$1 and c.verifier=$2 and c.revoked_at is null and x.active) as valid`,
    [credential.entry_verifier,verifier])).rows[0].valid;
    if(!valid) await c.query(`update ${S}.guess_budgets set count=count+1 where key=any($1::text[])`,[keys.filter(k=>k.failure).map(k=>k.key)]);
    // A wrong code RETURNS then COMMITS; it does not throw away the debit.
    return {reserved:true,lookedUp:true,valid,databaseTime:time.toISOString()};
  });
}
