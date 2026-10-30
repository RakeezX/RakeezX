import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateManifest, selectionGuardSql, rollbackProbeSql, compareProtected, PROJECT, AUTHORITY } from '../scripts/n148-test-account-cleanup.mjs';

function fixture() {
  const ids = Array.from({length:56}, (_,i) => `00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
  return { projectId:PROJECT, authorityRef:AUTHORITY, allCount:56, targetIds:ids.slice(0,50), keepIds:ids.slice(50),
    exceptionId:ids[50], keepEmail:'exception@n148-unit-fixture.test', deleteDomains:['a.fixture.test','b.fixture.test','c.fixture.test','d.fixture.test'],
    deleteEmails:Array.from({length:5},(_,i)=>`test${i}@n148-unit-fixture.test`), expectedTargetStudentRows:2149, expectedKeptStudentRows:927 };
}
const validate = m => { const bytes = Buffer.from(JSON.stringify(m)); return validateManifest(bytes,createHash('sha256').update(bytes).digest('hex')); };

test('exact partition, exception, project and pinned digest fail closed', () => {
  assert.equal(validate(fixture()).targetIds.length,50);
  for (const mutate of [m=>m.targetIds[0]=m.exceptionId,m=>m.keepIds[0]=m.keepIds[1],m=>m.exceptionId=m.targetIds[0],
    m=>m.projectId='other',m=>m.authorityRef='other',m=>m.targetIds.pop(),m=>m.expectedKeptStudentRows=0]) {
    const m=fixture(); mutate(m); assert.throws(()=>validate(m));
  }
  assert.throws(()=>validateManifest(Buffer.from(JSON.stringify(fixture()))));
});

test('SQL ties selectors and exception to exact live IDs; probe cannot commit', () => {
  const m=fixture(), sql=selectionGuardSql(m), probe=rollbackProbeSql(m);
  assert.match(sql,/is distinct from \(id::text in/);
  assert.ok(sql.includes(m.exceptionId) && sql.includes(m.keepEmail));
  assert.match(probe,/begin isolation level serializable/);
  assert.match(probe,/delete from n88_private\.numeric_credentials where owner_id::text in/);
  assert.match(probe,/rollback;$/);
  assert.doesNotMatch(probe,/\bcommit\b|disable|truncate|alter table|session_replication_role/i);
});

test('protected comparison detects counts, fingerprint and missing-table changes', () => {
  const before=[{tbl:'sample',total:3,targets:1,protected_count:2,protected_fingerprint:'abc'}];
  assert.equal(compareProtected(before,structuredClone(before)),true);
  for(const patch of [{total:2},{targets:0},{protected_count:1},{protected_fingerprint:'changed'}]) {
    assert.equal(compareProtected(before,[{...before[0],...patch}]),false);
  }
  assert.equal(compareProtected(before,[]),false);
});

// Actual PostgreSQL execution of the committing SQL against isolated synthetic
// FK/immutable-guard fixtures. No hosted access or private manifest is used.
import { PGlite } from '@electric-sql/pglite';
import { buildSpecs, buildCleanupSql, buildReadbackSql, DELETE_ORDER, SUSPENSIONS } from '../scripts/n148-test-account-cleanup.mjs';

async function databaseFixture(){
 const db=new PGlite();const m=fixture();
 const definitions=new Map();
 const put=(t,cols)=>definitions.set(t,cols);
 for(const t of DELETE_ORDER)put(t,t.startsWith('auth.')?'id uuid primary key,user_id uuid':'id text primary key,owner_id uuid');
 put('auth.users','id uuid primary key,email text');
 put('auth.sessions','id uuid primary key,user_id uuid');
 put('auth.flow_state','id uuid primary key,user_id uuid,linking_target_id uuid,oauth_client_state_id uuid');
 put('auth.refresh_tokens','id uuid primary key,user_id text,session_id uuid');
 put('auth.audit_log_entries','id uuid primary key,payload jsonb');
 put('auth.mfa_amr_claims','id uuid primary key,session_id uuid');
 put('auth.mfa_challenges','id uuid primary key,factor_id uuid');
 put('auth.mfa_recovery_code_sets','id uuid primary key,user_id uuid,mfa_factor_id uuid');
 put('auth.mfa_recovery_codes','id uuid primary key,mfa_recovery_code_set_id uuid');
 put('auth.saml_relay_states','id uuid primary key,flow_state_id uuid,for_email text');
 put('auth.oauth_client_states','id uuid primary key');
 put('n88_private.numeric_attempts','row_key text primary key,payload jsonb');
 put('n88_private.code_recovery','row_key text primary key,credential_id uuid,payload jsonb');
 put('n88_private.numeric_credentials','id uuid primary key,owner_id uuid');
 put('n88_private.numeric_sessions','row_key text primary key,owner_id uuid');
 put('rakeezx.account_access_grants','id text primary key,owner_id uuid,granted_by uuid');
 put('rakeezx.closed_term_reports','id text,owner_id uuid,supersedes_id text,primary key(owner_id,id)');
 for(const t of ['n88_private.numeric_rates','n44_push_draft.ingress_rates'])put(t,'key text primary key,payload jsonb');
 for(const t of ['storage.buckets','storage.objects','storage.s3_multipart_uploads','storage.s3_multipart_uploads_parts'])put(t,'id text primary key,owner_id text');
 put('realtime.messages','id text primary key,topic text');
 await db.exec(['auth','rakeezx','n88_private','n44_push_draft','storage','realtime'].map(s=>`create schema ${s}`).join(';')+';'+[...definitions].map(([t,c])=>`create table ${t} (${c})`).join(';'));
 await db.exec(`
 alter table n88_private.code_recovery add foreign key(credential_id) references n88_private.numeric_credentials(id) deferrable initially deferred;
 alter table rakeezx.closed_term_reports add foreign key(owner_id,supersedes_id) references rakeezx.closed_term_reports(owner_id,id) on delete restrict;
 alter table rakeezx.submissions add column assignment_id text references rakeezx.assignments(id);
 alter table rakeezx.slots add column term_id text references rakeezx.terms(id);
 alter table rakeezx.sync_restore_receipts add column stage_id text references rakeezx.sync_restore_stages(id) on delete restrict;
 create function rakeezx.fixture_immutable() returns trigger language plpgsql as $$begin raise exception 'fixture immutable';end$$;
 ${SUSPENSIONS.map(([t,n])=>`create trigger "${n}" before delete or update on ${t} for each row execute function rakeezx.fixture_immutable();`).join('\n')}
 `);
 for(const [i,id]of [...m.targetIds,...m.keepIds].entries())await db.query('insert into auth.users values($1,$2)',[id,i<50?`test${i}@a.fixture.test`:i===50?m.keepEmail:`keep${i}@kept.fixture.test`]);
 const target=m.targetIds[0],keep=m.keepIds[0];
 await db.query(`insert into rakeezx.students select 'target-'||n,$1::uuid from generate_series(1,2149)n`,[target]);
 await db.query(`insert into rakeezx.students select 'kept-'||n,$1::uuid from generate_series(1,927)n`,[keep]);
 await db.query(`insert into n88_private.numeric_credentials select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n<=45 then $1::uuid else $2::uuid end from generate_series(1,52)n`,[target,keep]);
 await db.exec(`insert into n88_private.code_recovery select id::text,id,jsonb_build_object('sentinel',id::text) from n88_private.numeric_credentials`);
 await db.query(`insert into n88_private.class_credential_receipts select 'receipt-'||n,case when n<=11 then $1::uuid else $2::uuid end from generate_series(1,16)n`,[target,keep]);
 await db.query(`insert into rakeezx.closed_term_reports select n::text,$1::uuid,case when n=1 then null else (n-1)::text end from generate_series(1,6)n`,[target]);
 await db.query("insert into rakeezx.terms values('term',$1)",[target]);await db.query("insert into rakeezx.slots values('slot',$1,'term')",[target]);
 await db.query("insert into rakeezx.assignments values('assignment',$1)",[target]);
 await db.query("insert into rakeezx.submissions values('submission',$1,'assignment')",[target]);
 await db.query("insert into rakeezx.sync_restore_stages values('stage',$1)",[target]);
 await db.query("insert into rakeezx.sync_restore_receipts values('receipt',$1,'stage')",[target]);
 const sessionTarget='20000000-0000-4000-8000-000000000001',sessionKeep='20000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.sessions values($1,$2),($3,$4)',[sessionTarget,target,sessionKeep,keep]);
 await db.query('insert into auth.identities values($1,$2),($3,$4)',[sessionTarget,target,sessionKeep,keep]);
 await db.query('insert into auth.refresh_tokens values($1,$2,$1),($3,$4,$3)',[sessionTarget,target,sessionKeep,keep]);
 await db.query('insert into n88_private.numeric_sessions values($1,$2),($3,$4)',[sessionTarget,target,sessionKeep,keep]);
 await db.query("insert into n88_private.numeric_attempts values('target',jsonb_build_object('sessionId',$1::text)),('keep',jsonb_build_object('sessionId',$2::text))",[sessionTarget,sessionKeep]);
 const metadata={columns:(await db.query(`select table_schema,table_name,column_name,data_type from information_schema.columns where table_schema in ('auth','rakeezx','n88_private','n44_push_draft','storage','realtime')`)).rows,
 fks:(await db.query(`select conrelid::regclass::text child,confrelid::regclass::text parent,conname,pg_get_constraintdef(oid) def from pg_constraint where contype='f'`)).rows,
 triggers:(await db.query(`select t.oid,tgfoid,tgrelid::regclass::text tbl,tgname,tgenabled,pg_get_triggerdef(t.oid) def,pg_get_functiondef(tgfoid) fn from pg_trigger t where not tgisinternal`)).rows};
 return {db,m,metadata};
}

test('atomic cleanup executes child closure, restores guards, preserves seven recovery records and supports frozen readback',async()=>{
 const {db,m,metadata}=await databaseFixture();
 try{
 const executions=await db.exec(buildCleanupSql(m,metadata,{commit:true}));
 const result=executions.at(-1).rows[0].cleanup;
 assert.equal(result.targets_zero,true);assert.equal(result.protected_unchanged,true);assert.equal(result.guards_restored,true);
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,6);
 assert.equal((await db.query('select count(*)::int n from n88_private.code_recovery')).rows[0].n,7);
 assert.equal((await db.query('select count(*)::int n from n88_private.numeric_credentials')).rows[0].n,7);
 assert.equal((await db.query('select count(*)::int n from n88_private.class_credential_receipts')).rows[0].n,5);
 const rb=await db.exec(buildReadbackSql(m,metadata,result));
 assert.equal(rb.flatMap(r=>r.rows).find(r=>r.readback)?.readback.targets_zero,true);
 await assert.rejects(db.exec('delete from n88_private.code_recovery'),/fixture immutable/);
 }finally{await db.close();}
});

test('a protected child change aborts deletion and restores all trigger states by rollback',async()=>{
 const {db,m,metadata}=await databaseFixture();
 try{
 const sql=buildCleanupSql(m,metadata,{commit:true}).replace('set constraints all immediate;',`update n88_private.code_recovery set payload='{"changed":true}' where credential_id in(select id from n88_private.numeric_credentials where owner_id='${m.keepIds[0]}'); set constraints all immediate;`);
 await assert.rejects(db.exec(sql),/N148 protected\/residual gate failed/);
 await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,56);
 assert.equal((await db.query('select count(*)::int n from n88_private.code_recovery')).rows[0].n,52);
 assert.equal((await db.query("select count(*)::int n from pg_trigger where not tgisinternal and tgenabled<>'O'")).rows[0].n,0);
 }finally{await db.close();}
});
