import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);
const migrations = (await readdir(migrationsDirectory)).sort()
  .filter((name) => /^\d+.*\.sql$/.test(name));

test('internal ownership helpers deny direct client execution for both identities', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
      create table auth.users(id uuid primary key); create table auth.current_identity(id uuid not null);
      insert into auth.users values('${A}'),('${B}');
      insert into auth.current_identity values('${A}');
      create function auth.uid() returns uuid language sql stable security definer set search_path=''
        as $$select id from auth.current_identity limit 1$$;
      grant usage on schema auth to authenticated, anon;`);
    for (const name of migrations) {
      const sql = await readFile(new URL(name, migrationsDirectory), 'utf8');
      await pg.exec(sql.replace(/^\uFEFF/, ''));
    }
    const acl = (await pg.query(`select
      has_function_privilege('anon','rakeezx.section_for_operational_row(text,jsonb)','execute') anon_section,
      has_function_privilege('authenticated','rakeezx.section_for_operational_row(text,jsonb)','execute') auth_section,
      has_function_privilege('anon','rakeezx.teaching_delete_blocker(uuid,text)','execute') anon_teaching,
      has_function_privilege('authenticated','rakeezx.teaching_delete_blocker(uuid,text)','execute') auth_teaching,
      has_function_privilege('authenticated','rakeezx.guard_safe_session_delete()','execute') auth_session_guard,
      has_function_privilege('anon','rakeezx.sync_v2_field_map(text)','execute') anon_field_map,
      has_function_privilege('authenticated','rakeezx.sync_v2_field_map(text)','execute') auth_field_map,
      has_function_privilege('authenticated','rakeezx.sync_v2_natural_key(text,jsonb)','execute') auth_natural_key`)).rows[0];
    assert.deepEqual(acl, { anon_section: false, auth_section: false, anon_teaching: false,
      auth_teaching: false, auth_session_guard: false, anon_field_map: false,
      auth_field_map: true, auth_natural_key: false });
    const exposure = (await pg.query(`select p.proname,
      has_function_privilege('anon',p.oid,'execute') anon,
      exists(select 1 from aclexplode(p.proacl) a
        where a.grantee=0 and a.privilege_type='EXECUTE') public
      from pg_proc p where p.pronamespace='rakeezx'::regnamespace
        and p.proname in ('section_for_operational_row','teaching_delete_blocker',
          'guard_safe_session_delete','sync_v2_field_map','sync_v2_natural_key')
      order by p.proname`)).rows;
    assert.equal(exposure.length, 5);
    assert.ok(exposure.every((row) => !row.anon && !row.public));

    // Grant schema resolution solely for this probe; function ACL must be the denial.
    await pg.exec('grant usage on schema rakeezx to anon, authenticated');
    for (const role of ['anon', 'authenticated']) {
      for (const owner of [A, B]) {
        await pg.query('update auth.current_identity set id=$1', [owner]);
        await pg.exec(`set role ${role}`);
        try {
          await assert.rejects(pg.query(`select rakeezx.section_for_operational_row(
            'teachings',$1::jsonb)`, [JSON.stringify({ owner_id: B, id: 'b-teaching' })]),
          /permission denied for function section_for_operational_row/);
          await assert.rejects(pg.query(`select rakeezx.teaching_delete_blocker($1,'b-teaching')`, [B]),
            /permission denied for function teaching_delete_blocker/);
          if (role === 'anon') {
            await assert.rejects(pg.query(`select rakeezx.sync_v2_field_map('sections')`),
              /permission denied for function sync_v2_field_map/);
          } else {
            assert.ok((await pg.query(`select rakeezx.sync_v2_field_map('sections') map`)).rows[0].map);
            if (owner === A) {
              await pg.exec(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status)
                values('security:auth-year','Synthetic',1450,1451,'active')`);
            }
          }
          await assert.rejects(pg.query(`select rakeezx.sync_v2_natural_key('sections','{}'::jsonb)`),
            /permission denied for function sync_v2_natural_key/);
          if (role === 'authenticated') {
            const other = owner === A ? B : A;
            for (const fn of ['sync_v2_restore_canonical_full', 'sync_v2_restore_canonical_score_v2',
              'sync_v2_restore_manifest', 'sync_v2_restore_manifest_full',
              'sync_v2_restore_manifest_score_v2']) {
              await assert.rejects(pg.query(`select rakeezx.${fn}($1)`, [other]),
                /owner|auth|forbidden|denied|mismatch/i, `${fn} must reject cross-owner argument`);
            }
          }
        } finally {
          await pg.exec('reset role');
        }
      }
    }

    // Definer-owner internal chains retain access after client ACL revocation.
    await pg.query('update auth.current_identity set id=$1', [B]);
    await pg.exec(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status)
      values('security:y','Synthetic',1450,1451,'active');
      insert into rakeezx.terms(id,year_id,name,"index",status)
      values('security:t','security:y','Synthetic',1,'active');
      insert into rakeezx.subjects(id,name,slug) values('security:sub','Synthetic','security-sub');
      insert into rakeezx.sections(id,year_id,grade,label,name)
      values('security:s','security:y',5,'A','Synthetic');
      insert into rakeezx.teachings(id,section_id,subject_id,term_id)
      values('security:teach','security:s','security:sub','security:t');`);
    const internal = await pg.query('select rakeezx.section_delete_blocker($1,$2) value', [B, 'security:s']);
    assert.equal(internal.rows[0].value, 'default-items');
    await pg.exec(`insert into rakeezx.group_arrangements(id,teaching_id,groups)
      values('security:groups','security:teach','[]'::jsonb)`);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.group_arrangements
      where owner_id=$1 and teaching_id='security:teach'`, [B])).rows[0].n, 1);
  } finally {
    await pg.close();
  }
});
