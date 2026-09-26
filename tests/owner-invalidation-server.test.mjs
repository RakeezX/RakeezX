import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { installRealtimeFixture } from './helpers/realtime-server-fixture.mjs';

const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
test('owner marker: real SQL rollback, coverage, ACL, owner RLS and private receive policy', async () => {
  const pg=new PGlite();
  try {
    await pg.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
      create table auth.users(id uuid primary key); create table auth.current_identity(id uuid);
      insert into auth.users values('${A}'),('${B}'); insert into auth.current_identity values('${A}');
      create function auth.uid() returns uuid language sql stable security definer set search_path=''
        as $$select id from auth.current_identity limit 1$$;
      grant usage on schema auth to authenticated,anon;`);
    await installRealtimeFixture(pg);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    for(const name of (await readdir(directory)).sort().filter(n=>/^\d.*\.sql$/.test(n))) {
      await pg.exec((await readFile(new URL(name,directory),'utf8')).replace(/^\uFEFF/,''));
    }
    const marker=async()=> (await pg.query('select rakeezx.owner_sync_change_marker() m')).rows[0].m;
    assert.equal((await marker()).revision,'0');
    await pg.exec(`insert into rakeezx.students(id,name,status) values('signal-a','Synthetic','active')`);
    assert.equal((await marker()).revision,'1');
    await pg.exec(`begin; update rakeezx.students set name='Rolled back' where id='signal-a'; rollback;`);
    assert.equal((await marker()).revision,'1');
    assert.equal((await pg.query('select count(*)::int n from realtime.messages')).rows[0].n,1);
    const deletion = (await pg.query(`select rakeezx.apply_student_lifecycle_command(
      'signal-delete','synthetic-device','delete_pristine','{"studentId":"signal-a"}'::jsonb,10) result`)).rows[0].result;
    assert.equal(deletion.outcome,'applied');
    assert.equal((await marker()).revision,'2');
    const replay=(await pg.query(`select rakeezx.apply_student_lifecycle_command(
      'signal-delete','synthetic-device','delete_pristine','{"studentId":"signal-a"}'::jsonb,10) result`)).rows[0].result;
    assert.deepEqual(replay,deletion);
    assert.equal((await marker()).revision,'2');
    const messages=(await pg.query('select * from realtime.messages order by id')).rows;
    assert.deepEqual(messages.map(m=>m.payload),[{revision:'1'},{revision:'2'}]);
    assert.ok(messages.every(m=>m.private && m.event==='invalidate' && m.topic===`rakeezx-owner:${A}`));
    assert.equal((await pg.query(`select count(*)::int n from pg_trigger where tgname='owner_sync_change'`)).rows[0].n,28);
    await pg.exec('grant usage on schema rakeezx to authenticated,anon');
    await pg.exec(`set role authenticated; select set_config('test.realtime_topic','rakeezx-owner:${A}',false)`);
    assert.equal((await pg.query('select count(*)::int n from realtime.messages')).rows[0].n,2);
    await assert.rejects(pg.exec(`insert into realtime.messages(topic,extension) values('rakeezx-owner:${A}','broadcast')`),/row-level security/);
    await assert.rejects(pg.exec('update rakeezx.owner_sync_changes set revision=99'),/permission denied/);
    await assert.rejects(pg.exec('select rakeezx.record_owner_sync_change()'),/permission denied/);
    await pg.exec('reset role');
    await pg.query('update auth.current_identity set id=$1',[B]);
    await pg.exec('set role authenticated');
    assert.equal((await marker()).revision,'0');
    assert.equal((await pg.query('select count(*)::int n from rakeezx.owner_sync_changes')).rows[0].n,0);
    assert.equal((await pg.query('select count(*)::int n from realtime.messages')).rows[0].n,0);
    await assert.rejects(pg.exec(`insert into rakeezx.owner_sync_changes values('${A}',99,now())`),/permission denied/);
    await pg.exec(`select set_config('test.realtime_topic','rakeezx-owner:${B}',false)`);
    assert.equal((await pg.query('select count(*)::int n from realtime.messages')).rows[0].n,0);
    await pg.exec('reset role; update auth.current_identity set id=null; set role anon');
    await assert.rejects(marker(),/permission denied/);
    assert.equal((await pg.query('select count(*)::int n from realtime.messages')).rows[0].n,0);
  } finally { await pg.close(); }
});
