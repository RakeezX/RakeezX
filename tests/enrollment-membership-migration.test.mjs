import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// This is an isolated in-memory PostgreSQL fixture. It never contacts
// Supabase or any Production data.
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER = '22222222-2222-4222-8222-222222222222';
const migration = await readFile(
  new URL('../supabase/migrations/0008_enrollment_membership_operations.sql', import.meta.url),
  'utf8',
);
let pg;

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create role authenticated;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${OWNER}'), ('${OTHER_OWNER}');
    create function auth.uid() returns uuid language sql immutable
      as $$select '${OWNER}'::uuid$$;
  `);
});

beforeEach(async () => {
  await pg.exec(`
    drop schema if exists rakeezx cascade;
    create schema rakeezx;
    create table rakeezx.sections (
      id text not null,
      owner_id uuid not null default auth.uid(),
      deleted_at timestamptz,
      primary key (owner_id, id)
    );
    create table rakeezx.enrollments (
      id text not null,
      owner_id uuid not null default auth.uid(),
      student_id text not null,
      section_id text not null,
      roll_no integer,
      start_date date,
      end_date date,
      status text not null default 'active',
      transfer_note text not null default '',
      client_updated_at bigint,
      device_id text,
      deleted_at timestamptz,
      primary key (owner_id, id),
      unique (owner_id, student_id, section_id),
      check (roll_no is null or roll_no between 1 and 999)
    );
    create unique index enrollments_active_roll_uniq
      on rakeezx.enrollments (owner_id, section_id, roll_no)
      where status = 'active' and roll_no is not null and deleted_at is null;
  `);
  await pg.exec(migration);
  await insertSection('section:source');
  await insertSection('section:destination');
  await insertSection('section:other');
});

after(async () => { await pg.close(); });

async function insertSection(id, { owner = OWNER, deleted = false } = {}) {
  await pg.query(
    'insert into rakeezx.sections(id, owner_id, deleted_at) values ($1, $2, $3)',
    [id, owner, deleted ? '2026-01-01T00:00:00Z' : null],
  );
}

async function insertEnrollment({
  id, studentId = 'student:test', sectionId = 'section:source', rollNo = 1,
  status = 'active', stamp = 1, owner = OWNER, deletedAt = null,
}) {
  await pg.query(`insert into rakeezx.enrollments
    (id, owner_id, student_id, section_id, roll_no, status, client_updated_at, deleted_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [id, owner, studentId, sectionId, rollNo, status, stamp, deletedAt]);
}

const transferPayload = ({
  sourceId = 'en:student:source', destinationId = 'en:student:destination',
  studentId = 'student:test', sourceSectionId = 'section:source',
  destinationSectionId = 'section:destination', rollNo = 1, stamp = 10,
} = {}) => ({
  source: {
    id: sourceId, student_id: studentId, section_id: sourceSectionId,
    status: 'transferred', end_date: '2026-09-01', client_updated_at: stamp,
  },
  destination: {
    id: destinationId, student_id: studentId, section_id: destinationSectionId,
    status: 'active', roll_no: rollNo, start_date: '2026-09-01', client_updated_at: stamp,
  },
});

async function callTransfer(payload) {
  return pg.query(
    'select rakeezx.commit_enrollment_transfer($1::jsonb, $2::jsonb) as result',
    [JSON.stringify(payload.source), JSON.stringify(payload.destination)],
  );
}

async function callRenumber(sectionId, roster) {
  return pg.query(
    'select rakeezx.renumber_enrollment_roster($1, $2::jsonb) as result',
    [sectionId, JSON.stringify(roster)],
  );
}

async function seedRoster() {
  await insertEnrollment({ id: 'en:one', studentId: 'student:one', rollNo: 1 });
  await insertEnrollment({ id: 'en:two', studentId: 'student:two', rollNo: 2 });
}

const plan = (first = 2, second = 1) => [
  { id: 'en:one', roll_no: first, client_updated_at: 10, device_id: 'device:test' },
  { id: 'en:two', roll_no: second, client_updated_at: 10, device_id: 'device:test' },
];

test('transfer RPC rejects an existing same-owner source enrollment for the wrong student', async () => {
  await insertEnrollment({ id: 'en:student:source', studentId: 'student:other' });
  await assert.rejects(callTransfer(transferPayload()), /Enrollment identity does not match transfer payload/);
});

test('transfer RPC rejects an existing same-owner source enrollment for the wrong section', async () => {
  await insertEnrollment({ id: 'en:student:source', sectionId: 'section:other' });
  await assert.rejects(callTransfer(transferPayload()), /Enrollment identity does not match transfer payload/);
});

test('transfer RPC rejects an existing same-owner destination enrollment for the wrong student', async () => {
  await insertEnrollment({ id: 'en:student:source' });
  await insertEnrollment({ id: 'en:student:destination', studentId: 'student:other', sectionId: 'section:destination' });
  await assert.rejects(callTransfer(transferPayload()), /Enrollment identity does not match transfer payload/);
});

test('transfer RPC rejects a source section outside the authenticated owner scope', async () => {
  await insertSection('section:foreign', { owner: OTHER_OWNER });
  const payload = transferPayload({ sourceSectionId: 'section:foreign' });
  await assert.rejects(callTransfer(payload), /Source section is not owned by current user/);
});

test('transfer RPC rejects a deleted destination section before changing the source enrollment', async () => {
  await insertEnrollment({ id: 'en:student:source' });
  await pg.query("update rakeezx.sections set deleted_at = now() where owner_id = $1 and id = 'section:destination'", [OWNER]);
  await assert.rejects(callTransfer(transferPayload()), /Destination section is not active for current user/);
  const source = (await pg.query("select status from rakeezx.enrollments where id = 'en:student:source'")).rows[0];
  assert.equal(source.status, 'active');
});

test('renumber RPC rejects NULL, zero, negative, and non-integer requested rolls', async () => {
  await seedRoster();
  for (const rollNo of [null, 0, -1, 1.5]) {
    const invalid = plan(rollNo, 2);
    await assert.rejects(callRenumber('section:source', invalid), /Invalid enrollment roster roll number or identity/);
  }
});

test('renumber RPC rejects duplicate final rolls before temporary NULL reassignment', async () => {
  await seedRoster();
  await assert.rejects(callRenumber('section:source', plan(1, 1)), /Invalid or stale enrollment roster plan/);
  const rows = (await pg.query("select id, roll_no from rakeezx.enrollments order by id")).rows;
  assert.deepEqual(rows.map(row => [row.id, Number(row.roll_no)]), [['en:one', 1], ['en:two', 2]]);
});

test('valid transfer succeeds', async () => {
  await insertEnrollment({ id: 'en:student:source' });
  const payload = transferPayload();
  await callTransfer(payload);
  const rows = (await pg.query("select id, student_id, section_id, status, roll_no from rakeezx.enrollments order by id")).rows;
  assert.deepEqual(rows.map(row => [row.id, row.student_id, row.section_id, row.status, Number(row.roll_no)]), [
    ['en:student:destination', 'student:test', 'section:destination', 'active', 1],
    ['en:student:source', 'student:test', 'section:source', 'transferred', 1],
  ]);
});

test('valid transfer retry is idempotent', async () => {
  await insertEnrollment({ id: 'en:student:source' });
  const payload = transferPayload();
  await callTransfer(payload);
  await callTransfer(payload);
  assert.equal((await pg.query('select count(*) from rakeezx.enrollments')).rows[0].count, 2);
});

test('valid renumber succeeds atomically', async () => {
  await seedRoster();
  const roster = plan();
  await callRenumber('section:source', roster);
  const rows = (await pg.query("select id, roll_no from rakeezx.enrollments order by id")).rows;
  assert.deepEqual(rows.map(row => [row.id, Number(row.roll_no)]), [['en:one', 2], ['en:two', 1]]);
});

test('valid renumber retry is idempotent', async () => {
  await seedRoster();
  const roster = plan();
  await callRenumber('section:source', roster);
  await callRenumber('section:source', roster);
  const rows = (await pg.query("select id, roll_no from rakeezx.enrollments order by id")).rows;
  assert.deepEqual(rows.map(row => [row.id, Number(row.roll_no)]), [['en:one', 2], ['en:two', 1]]);
});
