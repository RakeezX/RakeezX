import assert from 'node:assert/strict';
import {A,B,SESSION} from './provider.mjs';
export async function lockChecks({admin,pool,holdNext,roster,report}) {
  const owned=await pool.connect();
  try {
    await assert.rejects(()=>owned.query('select id from auth.sessions'),e=>e.code==='42501');
    await assert.rejects(()=>owned.query("update rakeezx.students set name='NO' where owner_id=$1",[A]),e=>e.code==='42501');
    assert.equal((await admin.query("select has_schema_privilege('anon','n88_private','USAGE') or has_schema_privilege('authenticated','n88_private','USAGE') as exposed")).rows[0].exposed,false);
  }finally{owned.release();}
  // Hold an ACTUAL teacher request after its canonical helper has acquired locks.
  const hold=holdNext();const pending=roster();await hold.reached;
  try {
    await admin.query("set lock_timeout='150ms'");
    // This writer has no N88 advisory lock; another owner's ordinary writes work.
    const start=Date.now();
    await admin.query("update rakeezx.students set name='OTHER OWNER WRITES' where owner_id=$1",[B]);
    await admin.query("insert into rakeezx.students(owner_id,id,name,status) values($1,'new-other','OTHER NEW','active')",[B]);
    await admin.query("update rakeezx.enrollments set revision=revision+1 where owner_id=$1",[B]);
    assert.ok(Date.now()-start<1000);
    // Current + tombstoned rows, inserts via FK key lock, key transfer, parent
    // lifecycle and Auth logout all wait. No assumption of cooperative Sync locks.
    const blocked=[
      ["update rakeezx.enrollments set status='transferred' where owner_id=$1",[A]],
      ["insert into rakeezx.enrollments values($1,'new-membership','class3','student',1,'active',null,null)",[A]],
      ["update rakeezx.enrollments set deleted_at=null where owner_id=$1 and id='ended-tombstone'",[A]],
      ["delete from rakeezx.students where owner_id=$1",[A]],
      ["update rakeezx.students set owner_id=$1 where owner_id=$2 and id='new-other'",[A,B]],
      ["update rakeezx.items set deleted_at=now() where owner_id=$1",[A]],
      ["delete from rakeezx.teachings where owner_id=$1",[A]],
      ["update rakeezx.terms set status='closed' where owner_id=$1",[A]],
      ["update rakeezx.sections set status='archived' where owner_id=$1",[A]],
      ["delete from auth.sessions where id=$1",[SESSION]]
    ];
    for(const [index,[sql,args]] of blocked.entries()){report.blockedScenario=index;await assert.rejects(()=>admin.query(sql,args),e=>e.code==='55P03');}
    report.lockEvidence='During actual teacher transaction, unrelated owner UPDATE enrollment/student + INSERT student committed without waiting for N88 lock; ten same-owner membership insert/restore/transfer, source delete, term/section lifecycle and Auth session delete operations timed out 55P03. Real PK/FK, restricted backend + NOLOGIN definer owner.';
  }finally{hold.release();await pending;await admin.query("set lock_timeout='0'");}
  // Missing FK is an activation readback failure; fixture confirms expected exact FKs.
  const fks=(await admin.query("select count(*)::int as n from pg_constraint where contype='f' and connamespace='rakeezx'::regnamespace and confrelid='auth.users'::regclass and not condeferrable and convalidated")).rows[0].n;
  assert.equal(fks,7);
  const c=await pool.connect();try{await c.query('begin');await assert.rejects(()=>c.query('select n88_private.lock_canonical_sources($1,1)',[A]),e=>e.code==='P0001');await c.query('rollback');}finally{c.release();}
}
