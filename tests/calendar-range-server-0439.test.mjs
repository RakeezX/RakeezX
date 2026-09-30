import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import 'fake-indexeddb/auto';
import * as db from '../src/lib/db.js';
import * as store from '../src/store.js';
import { createSyncV2Engine } from '../src/lib/sync-v2.js';

// Disposable in-memory PostgreSQL. Minimal auth/Realtime stubs stand in for
// Supabase platform schemas; every tracked Product migration runs unchanged.
const OWNER = '11111111-1111-4111-8111-111111111111';
const CALENDAR = 'cal:range-0439';
global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });

test('full migration chain preserves Calendar tombstones, active uniqueness and Sync V2 convergence', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema auth; create schema realtime;
      create role authenticated; create role anon; create role service_role;
      create table realtime.messages(extension text, topic text);
      create function realtime.topic() returns text language sql stable as $$select null::text$$;
      create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;
      create table auth.users(id uuid primary key);
      create table auth.current_identity(id uuid not null);
      insert into auth.users values ('${OWNER}');
      insert into auth.current_identity values ('${OWNER}');
      create function auth.uid() returns uuid language sql stable security definer set search_path = ''
        as $$select id from auth.current_identity limit 1$$;`);
    const names = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
      .filter((name) => name.endsWith('.sql')).sort();
    assert.equal(names.at(-1), '20260930094421_calendar_day_active_identity.sql');
    for (const name of names) await pg.exec((await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
    assert.equal(names.length, 36);
    const reusable = (await pg.query(`select rakeezx.sync_v2_natural_key_reusable_after_delete('calendar_days') calendar_days,
      rakeezx.sync_v2_natural_key_reusable_after_delete('sections') sections,
      rakeezx.sync_v2_natural_key_reusable_after_delete('slots') slots,
      rakeezx.sync_v2_natural_key_reusable_after_delete('students') students`)).rows[0];
    assert.deepEqual(reusable, { calendar_days: true, sections: true, slots: true, students: false });
    await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,status,client_updated_at,device_id)
      values ('year:0439','Synthetic',1448,1449,'active',1,'test')`);
    await pg.query(`insert into rakeezx.calendars(id,year_id,source,label,client_updated_at,device_id)
      values ($1,'year:0439','custom','Synthetic',1,'test')`, [CALENDAR]);

    const mutate = async (recordId, mutationId, operation, patch = {}, baseRevision = 0, deviceId = 'device-a') =>
      (await pg.query(`select rakeezx.apply_sync_v2_mutation('calendar_days',$1,$2,$3,$4,$5::jsonb,$6,10) result`,
        [recordId, mutationId, deviceId, baseRevision, JSON.stringify(patch), operation])).rows[0].result;
    const patch = { calendar_id: CALENDAR, date: '2026-10-05', kind: 'holiday', label: 'first' };
    const first = await mutate('day:A', 'mut:A', 'create', patch);
    assert.equal(first.outcome, 'applied');
    const revision = Number((await pg.query("select revision from rakeezx.calendar_days where id='day:A'")).rows[0].revision);
    assert.equal((await mutate('day:A', 'mut:delete', 'delete', {}, revision)).outcome, 'deleted');
    const replacement = await mutate('day:B', 'mut:B', 'create', { ...patch, label: 'replacement' }, 0, 'device-b');
    assert.equal(replacement.outcome, 'applied');
    assert.equal((await mutate('day:A', 'mut:stale-patch', 'patch', { label: 'stale' }, revision, 'old-device')).outcome, 'tombstoned');
    assert.equal((await mutate('day:A', 'mut:stale-create', 'create', patch, 0, 'old-device')).outcome, 'tombstoned');
    assert.equal((await mutate('day:C', 'mut:compete', 'create', patch, 0, 'device-c')).outcome, 'canonicalized');
    assert.deepEqual(await mutate('day:B', 'mut:B', 'create', { ...patch, label: 'replacement' }, 0, 'device-b'), replacement);
    await assert.rejects(pg.query(`insert into rakeezx.calendar_days
      (id,owner_id,calendar_id,date,kind,label,client_updated_at,device_id)
      values ('day:duplicate',$1,$2,'2026-10-05','holiday','duplicate',1,'test')`, [OWNER, CALENDAR]),
    /calendar_days_active_natural_uniq/);
    const rows = (await pg.query(`select id,label,deleted_at is not null as tombstone
      from rakeezx.calendar_days where owner_id=$1 and calendar_id=$2 and date='2026-10-05' order by id`,
    [OWNER, CALENDAR])).rows;
    assert.deepEqual(rows, [
      { id: 'day:A', label: 'first', tombstone: true },
      { id: 'day:B', label: 'replacement', tombstone: false },
    ]);
    assert.equal((await pg.query(`select count(*)::int count from pg_policies
      where schemaname='rakeezx' and tablename='calendar_days'`)).rows[0].count, 3);

    // Queue real Calendar writes while offline, then hand their durable outbox
    // to the real Sync V2 dispatcher against this disposable migrated server.
    await db.clearAll();
    store.state.ready = false;
    await store.init();
    for (const entry of await db.getAll('outbox')) await db.remove('outbox', entry.id);
    const localCalendar = { id: CALENDAR, yearId: store.activeYear().id, source: 'custom',
      label: 'Synthetic', deleted: false, updatedAt: Date.now(), serverRevision: 1 };
    store.state.calendars.push(localCalendar);
    await db.put('calendars', localCalendar);
    const transport = {
      async applyMutation(envelope) {
        return (await pg.query(`select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,$5,$6::jsonb,$7,$8) result`, [
          envelope.entity, envelope.recordId, envelope.mutationId, envelope.deviceId,
          envelope.baseRevision, JSON.stringify(envelope.patch), envelope.operation, envelope.clientUpdatedAt,
        ])).rows[0].result;
      },
      async fetchRecords(entity) {
        return (await pg.query(`select * from rakeezx.${entity} where owner_id=$1`, [OWNER])).rows;
      },
    };
    const engine = createSyncV2Engine({ database: db, transport });
    const offlineDeleted = await store.saveCalendarRange({ calendarId: CALENDAR,
      startDate: '2026-10-06', kind: 'holiday', label: 'offline delete' });
    const deletedId = store.calendarRangesOf(store.activeYear().id).find((range) => range.id === offlineDeleted).days[0].id;
    await store.removeCalendarRange(CALENDAR, offlineDeleted);
    assert.deepEqual((await db.getAll('outbox')).filter((entry) => entry.recordId === deletedId)
      .sort((a, b) => a.sequence - b.sequence).map((entry) => entry.op), ['create', 'delete']);
    const deletedDispatch = await engine.dispatchPending();
    assert.equal(deletedDispatch.acknowledged, 2);
    assert.equal((await db.getAll('outbox')).length, 0);
    assert.equal((await db.get('calendarDays', deletedId)).deleted, true);
    assert.equal((await pg.query(`select count(*)::int count from rakeezx.calendar_days
      where owner_id=$1 and calendar_id=$2 and date='2026-10-06' and deleted_at is null`,
    [OWNER, CALENDAR])).rows[0].count, 0);

    const offlineMoved = await store.saveCalendarRange({ calendarId: CALENDAR,
      startDate: '2026-10-07', kind: 'holiday', label: 'offline move' });
    await store.saveCalendarRange({ id: offlineMoved, calendarId: CALENDAR,
      startDate: '2026-10-08', kind: 'holiday', label: 'offline move' });
    assert.deepEqual((await db.getAll('outbox')).filter((entry) => entry.store === 'calendarDays')
      .sort((a, b) => a.sequence - b.sequence).map((entry) => entry.op),
      ['create', 'create', 'delete']);
    const movedDispatch = await engine.dispatchPending();
    assert.equal(movedDispatch.acknowledged, 3);
    assert.equal((await db.getAll('outbox')).length, 0);
    const movedRows = (await pg.query(`select date::text as date, deleted_at is not null as tombstone
      from rakeezx.calendar_days where owner_id=$1 and calendar_id=$2 and date between '2026-10-07' and '2026-10-08'
      order by date`, [OWNER, CALENDAR])).rows;
    assert.deepEqual(movedRows, [
      { date: '2026-10-07', tombstone: true },
      { date: '2026-10-08', tombstone: false },
    ]);
  } finally {
    store.closeChannel();
    await db.closeDB();
    await pg.close();
  }
});
