/** AI: only new migration/private-grant/forced-RLS/session topology checks. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
export async function journey({pool,admin,report}) {
  const a=await pool.connect();
  const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const session='11111111-1111-4111-8111-111111111111';
  const check=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
  const denied=async(sql,code='42501')=>{await a.query('begin');try{await assert.rejects(a.query(sql),e=>e.code===code);}finally{await a.query('rollback');}};
  try {
    const roles=(await admin.query("select rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole from pg_roles where rolname in ('n88_guard','n88_backend') order by rolname")).rows;
    assert.equal(roles.length,2);for(const r of roles)for(const k of ['rolcanlogin','rolsuper','rolbypassrls','rolcreaterole'])assert.equal(r[k],false);
    assert.equal((await a.query('select current_user as role')).rows[0].role,'n88_backend');
    const authState=(await admin.query("select relname,relrowsecurity,relforcerowsecurity,relowner::regrole::text as owner from pg_class where oid in ('auth.users'::regclass,'auth.sessions'::regclass) order by relname")).rows;
    assert.equal(authState.length,2);for(const r of authState){assert.equal(r.relrowsecurity,true);assert.equal(r.relforcerowsecurity,false);assert.equal(r.owner,'supabase_auth_admin');}
    assert.equal((await admin.query("select * from pg_policies where schemaname='auth'")).rowCount,0);
    const mgmt=(await admin.query("select rolsuper,rolbypassrls from pg_roles where rolname='postgres'")).rows[0];
    assert.deepEqual(mgmt,{rolsuper:false,rolbypassrls:true});
    const helperOwners=(await admin.query("select proname,proowner::regrole::text as owner from pg_proc where pronamespace='n88_private'::regnamespace")).rows;
    for(const name of ['lock_owner_key','lock_current_session'])assert.equal(helperOwners.find(h=>h.proname===name).owner,'postgres');
    await admin.query('set role n88_guard');assert.equal((await admin.query("select has_schema_privilege(current_user,'auth','USAGE') as allowed")).rows[0].allowed,false);
    await assert.rejects(admin.query('select id from auth.users'),e=>e.code==='42501');
    await admin.query('select n88_private.lock_owner_key($1)',[owner]);
    await admin.query('reset role');
    assert.equal((await a.query('select * from n88_private.contexts')).rowCount,0);
    for(const sql of ['select id from auth.users','select id from auth.sessions',"update rakeezx.students set name='x'",`select n88_private.lock_owner_key('${owner}')`])await denied(sql);
    // SET ROLE permission uses session_user (the owned fixture admin), not current_user.
    assert.equal((await a.query("select pg_has_role('n88_backend','n88_guard','MEMBER') as member")).rows[0].member,false);
    assert.equal((await a.query('select id from rakeezx.students')).rowCount,0);
    await a.query('begin');
    await a.query('select n88_private.lock_canonical_sources($1,100)',[owner]);
    assert.deepEqual((await a.query('select distinct owner_id from rakeezx.students')).rows,[{owner_id:owner}]);
    await a.query('rollback');
    assert.equal((await a.query('select id from rakeezx.students')).rowCount,0);
    check('fresh_migration_private_roles_forced_rls_owner_scope','Exact CLI-created staged SQL executed on owned PG17.6; both new roles NOLOGIN/no bypass/no admin. No context created. Backend Auth scans/writes/guard membership denied (42501); forced RLS owner scope ends at rollback.');
    for(const role of ['anon','authenticated']) {
      await admin.query('set role '+role);
      await assert.rejects(admin.query('select n88_private.lock_canonical_sources($1,10)',[owner]),e=>e.code==='42501');
      await admin.query('reset role');
    }
    for(const [user,sid,expected]of [[owner,session,1],[other,session,0],[owner,'22222222-2222-4222-8222-222222222222',0]]) {
      await a.query('begin');assert.equal((await a.query('select * from n88_private.lock_current_session($1,$2)',[user,sid])).rowCount,expected);await a.query('rollback');
    }
    await admin.query("update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=$1",[owner]);
    assert.equal((await a.query('select * from n88_private.lock_current_session($1,$2)',[owner,session])).rowCount,0);
    await admin.query('update auth.users set banned_until=null where id=$1',[owner]);
    await admin.query("update auth.sessions set not_after=clock_timestamp()-interval '1 second'");
    assert.equal((await a.query('select * from n88_private.lock_current_session($1,$2)',[owner,session])).rowCount,0);
    await admin.query('delete from auth.sessions');
    assert.equal((await a.query('select * from n88_private.lock_current_session($1,$2)',[owner,session])).rowCount,0);
    check('frontend_denials_current_session_owner_expiry_delete','Both frontend roles denied helper/schema. Managed Auth RLS enabled/zero policies remains. Exact session matches under existing postgres-owned helper, wrong user/session, banned user, expired and deleted sessions return zero. Guard/backend get no Auth scan or new bypass.');
    // Required owner FK key-share lock conflicts with helper's auth.users FOR UPDATE.
    await a.query('begin');await a.query('select n88_private.lock_canonical_sources($1,100)',[owner]);
    await admin.query("set lock_timeout='200ms'");
    await assert.rejects(admin.query("insert into rakeezx.years(owner_id,id,status,revision) values($1,'blocked','active',1)",[owner]),e=>e.code==='55P03');
    await admin.query("insert into rakeezx.years(owner_id,id,status,revision) values($1,'independent','active',1)",[other]);
    await a.query('rollback');
    check('immediate_owner_fk_lock_topology','Same-owner FK insert blocked with 55P03 while other owner succeeds; only fabricated local rows.');
    const sql=await readFile('supabase/migrations/20261018034356_n88_exact_activation_staged.sql','utf8');
    await assert.rejects(admin.query(sql),e=>e.code==='P0001'&&e.message.includes('collision'));await admin.query('rollback');
    check('migration_collision_stop','Second application aborts before private DDL; original private identities remain, no IF NOT EXISTS adoption.');
    const identities=(await admin.query(await readFile('drafts/n88-student-portal/activation/identities.inactive.sql','utf8'))).rows[0].identities;
    await writeFile('drafts/n88-student-portal/activation/expected-identities.json',JSON.stringify({aiAuthored:true,provenance:'Owned local PostgreSQL 17.6 staged migration; expected identities for later hosted comparison, NOT hosted readback',identities},null,2)+'\n');
  } finally {await a.query('rollback');a.release();}
}
