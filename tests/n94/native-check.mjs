import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { readFile, readdir, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { encodeSyncV2Patch, decodeSyncV2Canonical, createSyncV2Engine } from '../../src/lib/sync-v2.js';
import { normalizeSubitemDatesAndPoints, projectSubitemScore, nextSubitemCompletionState, subitemCompletionState } from '../../src/lib/score-foundation.js';
import { planCloudRestore } from '../../src/lib/backup-v2.js';
import { assertScoreSnapshotInvariant } from '../../src/lib/initial-restore.js';
import * as db from '../../src/lib/db.js';
import * as store from '../../src/store.js';
import * as cloud from '../../src/lib/cloud.js';
import { runtimeSyncOwnershipGuard } from '../../src/lib/sync-ownership.js';
import { n13Account } from '../n13-fixture.mjs';
import { runtimeOfflineLease } from '../../src/lib/offline-lease.js';
import { makeScoreSubitem } from '../../src/models.js';

const bin = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin';
const require = createRequire(import.meta.url);
const { Client } = require('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg/lib/index.js');
const run = promisify(execFile);
const control = (args) => new Promise((done, reject) => {
  const child = spawn(join(bin, 'pg_ctl.exe'), args, { windowsHide: true, stdio: 'ignore' });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? done() : reject(new Error(`Owned pg_ctl exited ${code}`)));
});
const output = resolve('test-results/n94/5d423f2e-0d7a-4af4-8f75-7a8bfe3f6edf');
await mkdir(output, { recursive: true });
const cluster = await mkdtemp(join(output, 'owned-cluster-'));
assert.ok(cluster.startsWith(output + '\\') || cluster.startsWith(output + '/'));
const portServer = createServer();
await new Promise((done) => portServer.listen(0, '127.0.0.1', done));
const port = portServer.address().port;
await new Promise((done) => portServer.close(done));
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
let pg, started = false;
const evidence = { checks: [], native: { port, version: null }, migration: null };
const check = async (name, fn) => { await fn(); evidence.checks.push({ name, status: 'PASS' }); console.log(`${name}: PASS`); };
global.document = { documentElement: { setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {} } }, querySelector: () => ({ setAttribute() {} }) };
global.matchMedia = () => ({ matches: false });
try {
  await run(join(bin, 'initdb.exe'), ['-D', cluster, '-U', 'n94synthetic', '-A', 'trust', '--encoding=UTF8', '--locale=C'], { windowsHide: true });
  await control(['-D', cluster, '-l', join(output, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start']);
  started = true;
  pg = new Client({ host: '127.0.0.1', port, user: 'n94synthetic', database: 'postgres' }); await pg.connect();
  evidence.native.version = (await pg.query('select version() version')).rows[0].version;
  await pg.query(`create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid);
    insert into auth.users values ('${OWNER}'),('${OTHER}'); insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$; grant usage on schema auth to authenticated,anon;`);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  const names = (await readdir(directory)).sort();
  for (const name of names.filter((name) => /^\d+.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 34)) {
    await pg.query((await readFile(new URL(name, directory), 'utf8')).replace(/^\uFEFF/, ''));
  }
  // Reproduce the current observed outer field-map without changing its N71
  // branches. Its historical fallback is the existing local field map in this
  // focused synthetic fixture; N71 Product behavior is not re-certified here.
  const preflight = JSON.parse(await readFile(new URL('./live-preflight.json', import.meta.url), 'utf8'));
  const oldMap = (await pg.query("select pg_get_functiondef('rakeezx.sync_v2_field_map(text)'::regprocedure) body")).rows[0].body;
  await pg.query(oldMap.replace('FUNCTION rakeezx.sync_v2_field_map(', 'FUNCTION rakeezx.sync_v2_field_map_before_n71('));
  await pg.query(preflight.functions.find((row) => row.signature.startsWith('rakeezx.sync_v2_field_map(')).source);
  await pg.query(`insert into rakeezx.years(id,label,hijri_start,hijri_end,device_id) values('year','synthetic',1450,1451,'seed');
    insert into rakeezx.terms(id,year_id,name,"index",device_id) values('term','year','term',1,'seed');
    insert into rakeezx.subjects(id,name,slug,device_id) values('subject','subject','n94-subject','seed');
    insert into rakeezx.sections(id,year_id,grade,label,name,device_id) values('section','year',4,'A','section','seed');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id,device_id) values('teaching','section','subject','term','seed');
    insert into rakeezx.students(id,name,device_id) values('student','synthetic student','seed'),('other-student','other','seed');
    insert into rakeezx.items(id,teaching_id,name,max,device_id) values('item','teaching','assessment',10,'seed'),('manual','teaching','manual',10,'seed');
    insert into rakeezx.scores(id,student_id,item_id,value,device_id) values('sc:student:manual','student','manual',7,'seed');`);
  const config = (id, version, subitems) => pg.query('select rakeezx.apply_score_configuration_command($1,$2,$3,$4,$5) result',
    [id, 'synthetic-device', 'item', version, { scoreMode: 'subitems', distributionMode: 'manual', max: 10, subitems }]);
  const legacy = (id, checked) => pg.query('select rakeezx.apply_score_subitem_command($1,$2,$3,$4,$5,$6,$7,$8) result',
    [id, 'synthetic-device', 'set_completion', 'item', 'student', 'sub', checked, null]);
  await config('old-config', 1, [{ id: 'sub', name: 'Homework', value: 6 }]);
  const oldReceipt = (await legacy('old-checked', true)).rows[0].result;
  const before = (await pg.query("select to_jsonb(d) row from rakeezx.score_subitems d where id='sub'")).rows[0].row;
  const priorScores = (await pg.query('select to_jsonb(s) row from rakeezx.scores s order by id')).rows;
  const migrationName = names.find((name) => name.endsWith('_n94_subitem_dates_late_scoring.sql'));
  const sql = await readFile(new URL(migrationName, directory), 'utf8');
  evidence.migration = { filename: migrationName, sha256: createHash('sha256').update(sql).digest('hex') };
  await pg.query('begin'); await pg.query(sql); await pg.query('commit');
  await check('additive_legacy_snapshot_and_receipt', async () => {
    const after = (await pg.query("select to_jsonb(d) row from rakeezx.score_subitems d where id='sub'")).rows[0].row;
    for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key]);
    assert.equal(after.late_points, null); assert.equal(after.start_date, null); assert.equal(after.due_date, null);
    assert.deepEqual((await pg.query('select to_jsonb(s) row from rakeezx.scores s order by id')).rows, priorScores);
    assert.deepEqual((await legacy('old-checked', true)).rows[0].result, oldReceipt);
    assert.equal((await pg.query('select rakeezx.score_foundation_capability() result')).rows[0].result.n94SubitemVersion, 1);
  });
  await check('subitem_dates_and_points', async () => {
    for (const row of [{ value: 6 }, { value: 6, startDate: '', dueDate: '', latePoints: '' },
      { value: 6, startDate: '2030-01-01', dueDate: '2030-01-01', latePoints: 6 }, { value: 6, latePoints: 0 }]) {
        normalizeSubitemDatesAndPoints(row); assert.ok(Number.isFinite(makeScoreSubitem(row).createdAt));
      }
    for (const row of [{ value: 6, startDate: '2030-01-02', dueDate: '2030-01-01' },
      { value: 6, dueDate: '2030-02-30' }, { value: 6, latePoints: 7 }, { value: 6, latePoints: -1 }]) assert.throws(() => normalizeSubitemDatesAndPoints(row));
    await config('dated', 2, [{ id: 'sub', name: 'Homework', value: 6, startDate: '2030-01-01', dueDate: '2030-01-02', latePoints: 2 }]);
    for (const late of [-1, 7, 1.001]) await assert.rejects(() => config(`bad:${late}`, 3,
      [{ id: 'sub', name: 'Homework', value: 6, latePoints: late }]), /n94_late_points/);
    await assert.rejects(() => config('bad:dates', 3, [{ id: 'sub', name: 'Homework', value: 6, startDate: '2030-01-03', dueDate: '2030-01-02' }]), /n94_subitem_dates/);
    assert.equal((await pg.query("select to_jsonb(created_at) stamp from rakeezx.score_subitems where id='sub'")).rows[0].stamp, before.created_at);
  });
  const selected = (id, state) => pg.query('select rakeezx.apply_score_subitem_command_n94($1,$2,$3,$4,$5,$6,$7,$8) result',
    [id, 'synthetic-device', 'set_completion', 'item', 'student', 'sub', state, null]);
  await check('atomic_selected_state_replay_and_bounds', async () => {
    const late = (await selected('late', 'late')).rows[0].result;
    assert.equal(Number(late.score.value), 2); assert.equal(late.completion.completion_state, 'late');
    assert.deepEqual((await selected('late', 'late')).rows[0].result, late);
    await assert.rejects(() => selected('late', 'regular'), /reused/);
    assert.equal(Number((await selected('regular', 'regular')).rows[0].result.score.value), 6);
    assert.equal((await selected('clear', null)).rows[0].result.score.value, null);
    await config('equal', 3, [{ id: 'sub', name: 'Homework', value: 6, latePoints: 6 }]);
    assert.equal(Number((await selected('equal:late', 'late')).rows[0].result.score.value), 6);
    assert.equal(Number((await selected('equal:regular', 'regular')).rows[0].result.score.value), 6);
    await config('lower', 4, [{ id: 'sub', name: 'Homework', value: 6, latePoints: 2 }]);
    await selected('lower:late', 'late');
    await config('date-edit', 5, [{ id: 'sub', name: 'Homework', value: 6, dueDate: '2031-01-01' }]);
    assert.equal((await pg.query("select completion_state from rakeezx.score_subitem_completions where subitem_id='sub'")).rows[0].completion_state, 'late');
    assert.equal(Number((await pg.query("select derived_value from rakeezx.scores where item_id='item'")).rows[0].derived_value), 2);
    await config('date-reset', 6, [{ id: 'sub', name: 'Homework', value: 6, dueDate: '2030-01-02' }]);
    const manual = (await pg.query('select rakeezx.apply_score_subitem_command($1,$2,$3,$4,$5,$6,$7,$8) result',
      ['manual:clamp', 'device', 'set_manual', 'item', 'student', null, null, 100])).rows[0].result;
    assert.equal(Number(manual.score.value), 10); assert.equal(Number(manual.score.manual_value), 8);
    assert.equal(Number((await selected('clamped:regular', 'regular')).rows[0].result.score.manual_value), 4);
    assert.equal((await pg.query("select value from rakeezx.scores where id='sc:student:manual'")).rows[0].value, '7.00');
    assert.equal((await pg.query("select count(*)::int n from rakeezx.scores where student_id='other-student'")).rows[0].n, 0);
    await pg.query('select rakeezx.assert_score_provenance_consistent($1)', [OWNER]);
  });
  await check('owner_acl_generic_bypass_and_immutable_creation', async () => {
    await pg.query('set role authenticated');
    try {
      await assert.rejects(() => pg.query("update rakeezx.score_subitems set late_points=0 where id='sub'"), { code: '42501' });
      await assert.rejects(() => pg.query("update rakeezx.score_subitem_completions set completion_state='late'"), { code: '42501' });
      await assert.rejects(() => pg.query('select rakeezx.guard_subitem_definition_write()'), /permission denied/);
    } finally { await pg.query('reset role'); }
    await assert.rejects(() => pg.query("update rakeezx.score_subitems set late_points=0 where id='sub'"), /atomic score domain/);
    await assert.rejects(() => pg.query("update rakeezx.score_subitem_completions set completion_state='late'"), /atomic score domain/);
    await pg.query('begin');
    try {
      await pg.query("select set_config('rakeezx.score_domain_write','on',true)");
      await assert.rejects(() => pg.query("update rakeezx.score_subitems set created_at=now() where id='sub'"), /immutable/);
    } finally { await pg.query('rollback'); }
    await pg.query('update auth.current_identity set id=$1', [OTHER]);
    await pg.query('set role authenticated');
    try {
      await assert.rejects(() => selected('foreign', 'late'), /unavailable/);
      assert.equal((await pg.query('select count(*)::int n from rakeezx.score_subitem_completions')).rows[0].n, 0);
    } finally { await pg.query('reset role'); await pg.query('update auth.current_identity set id=$1', [OWNER]); }
  });
  await check('definition_copy_dates_points_without_student_state', async () => {
    await pg.query(`insert into rakeezx.sections(id,year_id,grade,label,name,device_id) values('target-section','year',4,'B','target','seed');
      insert into rakeezx.teachings(id,section_id,subject_id,term_id,device_id) values('target','target-section','subject','term','seed');`);
    const revision = (await pg.query("select revision from rakeezx.items where id='item'")).rows[0].revision;
    const args = ['copy', 'device', 'item', revision, 'target', 'copy:item', JSON.stringify({ sub: 'copy:sub' }), 'missing'];
    const invoke = () => pg.query('select rakeezx.apply_score_distribution_copy_command($1,$2,$3,$4,$5,$6,$7::jsonb,$8) result', args);
    const result = (await invoke()).rows[0].result;
    assert.equal(Number(result.subitems[0].late_points), 2); assert.equal(result.subitems[0].due_date, '2030-01-02');
    assert.deepEqual((await invoke()).rows[0].result, result);
    assert.equal((await pg.query("select count(*)::int n from rakeezx.score_subitem_completions where subitem_id='copy:sub'")).rows[0].n, 0);
  });
  // Actual client outbox/normalization/reconciliation against this native SQL,
  // not a success mock. Simulate losing one response AFTER the SQL commit.
  await check('completion_tap_cycle_owner_outbox_reload_and_reconciliation', async () => {
    await n13Account(OWNER); await store.init();
    store.getOfflineLeaseStatus();
    await runtimeOfflineLease().renew(async () => ({ id: OWNER, source: 'supabase-auth-user', verifiedAt: Date.now() }));
    const stores = ['years','terms','subjects','sections','teachings','students','items','scoreSubitems','scoreSubitemCompletions','scores'];
    const entities = { scoreSubitems: 'score_subitems', scoreSubitemCompletions: 'score_subitem_completions' };
    const rows = {};
    for (const name of stores) rows[name] = (await pg.query(`select to_jsonb(t) row from rakeezx.${entities[name] ?? name} t where owner_id=$1`, [OWNER])).rows.map(({ row }) => decodeSyncV2Canonical(name, row));
    await db.putAcross(rows);
    await db.applyBatch({ outbox: {} }, { prepare: (current) => ({ outbox: { remove: current.outbox.map((row) => row.id) } }) });
    await store.refreshSyncedState();
    cloud.setMockBackend({ getScoreFoundationCapability: async () => (await pg.query('select rakeezx.score_foundation_capability() result')).rows[0].result });
    let loseResponse = true;
    const transport = {
      async applyScoreSubitemCommand(e) {
        const result = (await pg.query('select rakeezx.apply_score_subitem_command_n94($1,$2,$3,$4,$5,$6,$7,$8) result',
          [e.mutationId,e.deviceId,e.command,e.itemId,e.studentId,e.subitemId,e.completionState,e.manualValue])).rows[0].result;
        if (loseResponse) { loseResponse = false; throw new Error('synthetic lost response after native SQL commit'); }
        return result;
      },
      getScoreDomainSnapshot: async () => (await pg.query('select rakeezx.sync_v2_score_domain_snapshot() result')).rows[0].result,
      fetchRecords: async () => [],
    };
    const engine = createSyncV2Engine({ database: db, transport, ownershipGuard: runtimeSyncOwnershipGuard, currentAuthenticatedUserId: () => OWNER });
    await store.setScoreSubitemCompletion('student', 'sub', 'unrecorded');
    assert.equal((await engine.dispatchPending()).failed, 1);
    assert.equal((await engine.dispatchPending()).acknowledged, 1);
    await store.refreshSyncedState();
    const realNow = Date.now; let syntheticNow = realNow(); Date.now = () => syntheticNow;
    try {
      for (const [expected, points] of [['late',2],['regular',6],['unrecorded',null]]) {
        syntheticNow += 400;
        const [a,b] = await Promise.all([store.cycleScoreSubitemCompletion('student','sub',{ localDate:'2030-01-03' }),store.cycleScoreSubitemCompletion('student','sub',{ localDate:'2030-01-03' })]);
        assert.equal(a.completion.id,b.completion.id); assert.equal(subitemCompletionState(a.completion),expected);
        assert.equal(a.derivedValue,points ?? 0);
        assert.equal((await db.getAll('outbox')).length,1);
        assert.equal((await engine.dispatchPending()).acknowledged,1);
        await db.closeDB(); store.state.ready=false; await store.init();
        assert.equal(subitemCompletionState(store.state.scoreSubitemCompletions.find((row)=>row.subitemId==='sub')),expected);
      }
      syntheticNow += 400;
      await store.cycleScoreSubitemCompletion('student','sub',{ localDate:'2030-01-02' });
      assert.equal(subitemCompletionState(store.state.scoreSubitemCompletions.find((row)=>row.subitemId==='sub')),'regular');
      await engine.dispatchPending();
      // Clock/due edits do not infer a state in scoring or canonical refresh.
      syntheticNow += 864000000;
      const pulled = await engine.pullAll({stores:['scores'],scoreDomainSnapshot:true});
      assert.deepEqual(pulled.failures,[]);
      await store.refreshSyncedState();
      assert.equal(subitemCompletionState(store.state.scoreSubitemCompletions.find((row)=>row.subitemId==='sub')),'regular');
      assert.equal(nextSubitemCompletionState({value:6},null,'2099-01-01'),'regular');
      await store.setScoreSubitemCompletion('student','sub','unrecorded');
      const priorOutbox = await db.getAll('outbox');
      const priorCompletions = await db.getAll('scoreSubitemCompletions');
      const priorScores = await db.getAll('scores');
      const denied = createSyncV2Engine({database:db,transport,ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:()=>OTHER});
      const deniedResult = await denied.dispatchPending();
      assert.equal(deniedResult.attempted,0); assert.equal(deniedResult.ownershipBlocked,1);
      assert.deepEqual(await db.getAll('scoreSubitemCompletions'),priorCompletions);
      assert.deepEqual(await db.getAll('scores'),priorScores);
      const blockedCommand=(await db.getAll('outbox'))[0];
      assert.deepEqual(blockedCommand.patch,priorOutbox[0].patch);assert.equal(blockedCommand.mutationId,priorOutbox[0].mutationId);
      assert.equal((await engine.dispatchPending()).acknowledged,1);
    } finally { Date.now=realNow; }
  });
  await check('backup_restore_creation_legacy_defaults_and_interrupted_retry', async () => {
    const record = (entity,id,patch) => ({entity,recordId:id,operation:'create',baseRevision:0,patch,clientUpdatedAt:1});
    await pg.query('update auth.current_identity set id=$1',[OTHER]);
    const operations = [record('years','restore:year',{label:'synthetic',hijri_start:1450,hijri_end:1451}),
      record('terms','restore:term',{year_id:'restore:year',name:'term',index:1}),
      record('subjects','restore:subject',{name:'subject',slug:'restore-subject'}),
      record('sections','restore:section',{year_id:'restore:year',grade:4,label:'A',name:'section'}),
      record('teachings','restore:teaching',{section_id:'restore:section',subject_id:'restore:subject',term_id:'restore:term'}),
      record('students','restore:student',{name:'synthetic'}),
      record('items','restore:item',{teaching_id:'restore:teaching',name:'assessment',max:10,score_mode:'subitems',distribution_mode:'manual',distribution_version:1}),
      record('score_subitems','restore:sub',{item_id:'restore:item',name:'Homework',value:6,order:0,start_date:'2030-01-01',due_date:'2030-01-02',late_points:2,created_at:'2026-01-01T00:00:00Z'}),
      record('score_subitems','restore:old',{item_id:'restore:item',name:'Old',value:1,order:1}),
      record('scores','sc:restore:student:restore:item',{student_id:'restore:student',item_id:'restore:item',value:3,derived_value:3,manual_value:null}),
      record('score_subitem_completions','ssc:restore:student:restore:sub',{student_id:'restore:student',subitem_id:'restore:sub',checked:true,completion_state:'late'}),
      record('score_subitem_completions','ssc:restore:student:restore:old',{student_id:'restore:student',subitem_id:'restore:old',checked:true})];
    const hash='a'.repeat(64);
    const args=['restore',hash,5,'[]',JSON.stringify(operations)];
    const stage=()=>pg.query('select rakeezx.stage_sync_v2_restore_score_v2($1,$2,$3,$4::jsonb,$5::jsonb) result',args);
    const staged=(await stage()).rows[0].result;
    assert.deepEqual((await stage()).rows[0].result,staged);
    assert.equal((await pg.query('select count(*)::int n from rakeezx.items where owner_id=$1',[OTHER])).rows[0].n,0);
    const finalize=()=>pg.query('select rakeezx.finalize_sync_v2_restore_score_v2($1,$2,$3) result',['restore',hash,staged.stageHash]);
    await pg.query('begin'); await finalize(); await pg.query('rollback'); // interrupted transaction
    const final=(await finalize()).rows[0].result;
    assert.deepEqual((await finalize()).rows[0].result,final);
    const snapshot={};
    for(const [name,entity] of [['items','items'],['students','students'],['scores','scores'],['scoreSubitems','score_subitems'],['scoreSubitemCompletions','score_subitem_completions']]) snapshot[name]=final.canonical[entity].map((row)=>decodeSyncV2Canonical(name,row));
    assert.equal(snapshot.scoreSubitems.find(row=>row.id==='restore:sub').createdAt,Date.parse('2026-01-01T00:00:00Z'));
    assert.equal(subitemCompletionState(snapshot.scoreSubitemCompletions.find(row=>row.subitemId==='restore:old')),'regular');
    assert.equal(subitemCompletionState(snapshot.scoreSubitemCompletions.find(row=>row.subitemId==='restore:sub')),'late');
    assertScoreSnapshotInvariant(snapshot);
    const plan=planCloudRestore({version:5,sourceOwnerId:OTHER,data:snapshot},{},{ownerId:OTHER});
    const def=plan.operations.find(row=>row.recordId==='restore:sub');
    assert.equal(def.patch.created_at,'2026-01-01T00:00:00.000Z');assert.equal(def.patch.late_points,2);
    assert.equal(plan.operations.find(row=>row.recordId==='ssc:restore:student:restore:sub').patch.completion_state,'late');
    assert.ok(!('created_at' in encodeSyncV2Patch('scoreSubitems',snapshot.scoreSubitems[0])));
    assert.equal(planCloudRestore({version:5,sourceOwnerId:OTHER,data:snapshot},{},{ownerId:OWNER}).ready,false);
    await pg.query('update auth.current_identity set id=$1',[OWNER]);
  });
  evidence.functions=(await pg.query(`select p.oid::regprocedure::text signature, md5(pg_get_functiondef(p.oid)) source_md5,
    pg_get_functiondef(p.oid) source,p.proacl::text acl from pg_proc p where p.pronamespace='rakeezx'::regnamespace and
    p.proname in ('sync_v2_field_map','guard_subitem_definition_write','recompute_subitem_score','apply_score_subitem_command',
    'apply_score_subitem_command_n94','apply_score_configuration_command','apply_score_distribution_copy_command',
    'score_foundation_capability','assert_score_provenance_consistent','stage_sync_v2_restore_score_v2') order by signature`)).rows;
} finally {
  cloud.setMockBackend(null);store.closeChannel();await db.closeDB();await pg?.end();
  if(started) await control(['-D',cluster,'-m','fast','-w','stop']);
  evidence.cleanup = { serverStopped: started, clusterRetained: cluster,
    reason: 'Prior recursive removal was rejected: blocked by policy. No alternate deletion surface used; stopped synthetic data remains in ignored test-results.' };
  await writeFile(join(output,'native-result.json'),JSON.stringify(evidence,null,2));
}
