/** AI-authored: exact local PG17 two-grantor repair and fail-closed preimages. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {startNativePg} from './fixtures/n88-integrated-class/native-pg.mjs';
const file='supabase/migrations/20261018195100_n88_guard_membership_inherit_staged.sql';
const sql=await readFile(file,'utf8');
const edges="select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) order by r.rolname,m.rolname,g.rolname) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor where r.rolname in ('n88_backend','n88_guard') or m.rolname in ('n88_backend','n88_guard')";
let pg;
try {
 pg=await startNativePg(process.cwd());
 // Model the provider's bootstrap grantor by name, without adding a fourth edge.
 await pg.fixtureQuery("create role n88_fixture_setup superuser nologin; set session authorization n88_fixture_setup; alter role n88_local_admin rename to supabase_admin; reset session authorization; drop role n88_fixture_setup");
 // Only this fresh owned fixture is normalized to the observed provider grantors.
 const existing=(await pg.fixtureQuery("select r.rolname role,m.rolname member,g.rolname grantor from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor where r.rolname in ('n88_backend','n88_guard')")).rows;
 for(const e of existing) await pg.fixtureQuery('revoke "'+e.role+'" from "'+e.member+'" granted by "'+e.grantor+'" cascade');
 await pg.fixtureQuery("grant n88_backend,n88_guard to postgres with admin true, inherit false, set false granted by supabase_admin");
 await pg.fixtureQuery("set role postgres");
 await pg.fixtureQuery("grant n88_guard to postgres with admin false, inherit true, set false granted by postgres");
 const snapshot=async()=>({edges:(await pg.fixtureQuery(edges)).rows[0].jsonb_agg,roles:(await pg.fixtureQuery("select jsonb_agg(to_jsonb(r)-'rolpassword' order by rolname) roles from pg_roles r where rolname in ('n88_backend','n88_guard')")).rows[0].roles});
 const before=await snapshot();
 await pg.fixtureQuery('begin');await pg.fixtureQuery(sql);
 const after=await snapshot();
 const expected=structuredClone(before);expected.edges.find(e=>e.role==='n88_guard'&&e.grantor==='postgres').inherit=false;
 assert.deepEqual(after,expected);await pg.fixtureQuery('rollback');
 const negatives=[
  ["missing edge","revoke n88_guard from postgres granted by postgres"],
  ["altered SET","grant n88_guard to postgres with set true granted by postgres"],
  ["altered provider ADMIN","reset role; grant n88_backend to postgres with admin false granted by supabase_admin; set role postgres"],
  ["unexpected membership","grant n88_backend to postgres with inherit false, set false granted by postgres"],
  ["changed role flag","reset role; alter role n88_backend inherit; set role postgres"]
 ];
 for(const [name,mutation] of negatives){
  await pg.fixtureQuery('begin');await pg.fixtureQuery(mutation);const pre=await snapshot();
  await pg.fixtureQuery('savepoint repair');
  await assert.rejects(pg.fixtureQuery(sql),/n88_membership_(edge|role)_baseline_mismatch/,name);
  await pg.fixtureQuery('rollback to repair');assert.deepEqual(await snapshot(),pre,name);
  await pg.fixtureQuery('rollback');
 }
 assert.deepEqual(await snapshot(),before);
 const receipt={status:'PASS',localPostgres:'17.6',source:file,sha256:createHash('sha256').update(sql).digest('hex'),twoGrantorPosture:true,onlyTargetInheritChanged:true,negativeCases:negatives.map(x=>x[0]),noPartialSideEffects:true,hostedWrites:0,primaryDocumentation:'https://www.postgresql.org/docs/17/sql-grant.html'};
 await writeFile('tests/n88-official-activation-membership.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await pg?.close();}
