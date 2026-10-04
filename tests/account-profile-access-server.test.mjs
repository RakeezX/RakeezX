import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const migration = await fs.readFile(new URL('../supabase/migrations/0032_account_profile_access_foundation.sql', import.meta.url), 'utf8');
const n03Migration = await fs.readFile(new URL('../supabase/migrations/20261003000000_n03_education_department.sql', import.meta.url), 'utf8');

async function fixture() {
  const pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable set search_path=''
      as $$select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create schema rakeezx;
    grant usage on schema rakeezx to authenticated, anon;
    create function rakeezx.touch_updated_at() returns trigger language plpgsql set search_path=''
      as $$begin new.updated_at=now(); return new; end$$;
    create table rakeezx.profile(
      owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
      teacher_name text not null default '', school_name text not null default '', phone text not null default '',
      report_principal_name text not null default '', active_time_profile_id text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      client_updated_at bigint, device_id text, deleted_at timestamptz,
      revision bigint not null default 1, field_revisions jsonb not null default '{}'
    );
    alter table rakeezx.profile enable row level security;
    alter table rakeezx.profile force row level security;
    create policy profile_select on rakeezx.profile for select to authenticated using(owner_id=auth.uid());
    create policy profile_insert on rakeezx.profile for insert to authenticated with check(owner_id=auth.uid());
    create policy profile_update on rakeezx.profile for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
    grant select,insert,update on rakeezx.profile to authenticated;
    create function rakeezx.sync_v2_field_map(text) returns jsonb language sql immutable set search_path=''
      as $$select '{}'::jsonb$$;
    insert into auth.users(id) values('${A}'),('${B}');
    insert into rakeezx.profile(owner_id,teacher_name,school_name,phone)
      values('${A}','اسم محفوظ','مدرسة محفوظة','0500000000');
  `);
  await pg.exec(migration);
  return pg;
}

async function asOwner(pg, owner, sql) {
  await pg.exec(`select pg_catalog.set_config('request.jwt.claim.sub','${owner}',false); set role authenticated;`);
  try { return await pg.query(sql); } finally { await pg.exec('reset role;'); }
}

test('migration preserves existing profile and backfills safe readiness and beta access', async () => {
  const pg = await fixture();
  const profile = (await pg.query(`select teacher_name,school_name,phone,teacher_form,profile_status from rakeezx.profile where owner_id='${A}'`)).rows[0];
  assert.deepEqual(profile, {
    teacher_name: 'اسم محفوظ', school_name: 'مدرسة محفوظة', phone: '0500000000',
    teacher_form: 'masculine', profile_status: 'READY',
  });
  const grant = (await pg.query(`select grant_type,status,source,expires_at from rakeezx.account_access_grants where owner_id='${A}'`)).rows[0];
  assert.equal(grant.grant_type, 'beta_full');
  assert.equal(grant.status, 'active');
  assert.equal(grant.source, 'public_beta');
  assert.equal(grant.expires_at, null);
  await pg.close();
});

test('provisioning is owner-derived, pending, grant-idempotent, and completion validates required fields', async () => {
  const pg = await fixture();
  const first = (await asOwner(pg, B, 'select rakeezx.provision_account_profile() result')).rows[0].result;
  const second = (await asOwner(pg, B, 'select rakeezx.provision_account_profile() result')).rows[0].result;
  assert.equal(first.ownerId, B);
  assert.equal(first.profileStatus, 'PENDING_PROFILE');
  assert.deepEqual(second, first);
  assert.equal((await pg.query(`select count(*)::int n from rakeezx.account_access_grants where owner_id='${B}'`)).rows[0].n, 1);
  await assert.rejects(() => asOwner(pg, B,
    `select rakeezx.complete_account_profile('معلمة','','feminine',null)`), /Phone is required/);
  const ready = (await asOwner(pg, B,
    `select rakeezx.complete_account_profile('معلمة','0500000001','feminine',null) result`)).rows[0].result;
  assert.equal(ready.profileStatus, 'READY');
  assert.equal(ready.profile.teacherForm, 'feminine');
  assert.equal(ready.profile.schoolName, '');
  await pg.close();
});

test('RLS isolates profiles/grants and clients cannot self-grant or change readiness', async () => {
  const pg = await fixture();
  await asOwner(pg, B, 'select rakeezx.provision_account_profile()');
  assert.equal((await asOwner(pg, A, 'select count(*)::int n from rakeezx.profile')).rows[0].n, 1);
  assert.equal((await asOwner(pg, A, 'select count(*)::int n from rakeezx.account_access_grants')).rows[0].n, 1);
  await assert.rejects(() => asOwner(pg, A,
    `insert into rakeezx.account_access_grants(owner_id,grant_type,status,source) values('${A}','beta_full','active','public_beta')`));
  await assert.rejects(() => asOwner(pg, B,
    `update rakeezx.profile set profile_status='READY' where owner_id='${B}'`), /server controlled/);
  await assert.rejects(() => asOwner(pg, A,
    `update rakeezx.profile set owner_id='${B}' where owner_id='${A}'`));
  await pg.close();
});

test('anon cannot read private account state or execute account RPCs', async () => {
  const pg = await fixture();
  await pg.exec('set role anon;');
  try {
    await assert.rejects(() => pg.query('select * from rakeezx.account_access_grants'));
    await assert.rejects(() => pg.query('select rakeezx.account_contract()'));
  } finally { await pg.exec('reset role;'); }
  await pg.close();
});

test('Sync V2 profile map includes teacher form but not server readiness', async () => {
  const pg = await fixture();
  const map = (await pg.query(`select rakeezx.sync_v2_field_map('profile') value`)).rows[0].value;
  assert.equal(map.teacher_form, 'teacher_form');
  assert.equal('profile_status' in map, false);
  await pg.close();
});

test('N03 additive migration preserves readiness, validates official names, and isolates owners', async () => {
  const pg = await fixture();
  await pg.exec(n03Migration);
  const department = 'إدارة التعليم بمحافظة الطائف';
  const before = (await asOwner(pg, A, 'select rakeezx.account_contract() result')).rows[0].result;
  assert.equal(before.profile.educationDepartment, null);
  assert.equal(before.profileStatus, 'READY');
  assert.equal((await pg.query('select count(*)::int n from rakeezx.education_departments')).rows[0].n, 47);
  await assert.rejects(() => asOwner(pg, A,
    "update rakeezx.profile set education_department='غير رسمية'"), /foreign key/i);
  await asOwner(pg, A, `update rakeezx.profile set education_department='${department}'`);
  const own = (await asOwner(pg, A, 'select rakeezx.account_contract() result')).rows[0].result;
  assert.equal(own.profile.educationDepartment, department);
  assert.equal(own.profileStatus, 'READY');
  await asOwner(pg, B, 'select rakeezx.provision_account_profile()');
  const other = (await asOwner(pg, B, 'select rakeezx.account_contract() result')).rows[0].result;
  assert.equal(other.profile.educationDepartment, null);
  assert.equal((await asOwner(pg, B, 'select education_department from rakeezx.profile')).rows.length, 1);
  await asOwner(pg, B, `update rakeezx.profile set education_department='${department}' where owner_id='${A}'`);
  assert.equal((await asOwner(pg, A, 'select rakeezx.account_contract() result')).rows[0].result.profile.educationDepartment, department);
  await asOwner(pg, A, 'update rakeezx.profile set education_department=null');
  assert.equal((await asOwner(pg, A, 'select rakeezx.account_contract() result')).rows[0].result.profile.educationDepartment, null);
  const map = (await pg.query("select rakeezx.sync_v2_field_map('profile') value")).rows[0].value;
  assert.equal(map.education_department, 'education_department');
  assert.equal(map.teacher_form, 'teacher_form');
  assert.equal('profile_status' in map, false);
  await pg.close();
});
