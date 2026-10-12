/** Exact live-source baseline, new disposable native PG17 cluster, focused N71 certification. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { fixtureIds, portableFixture } from './n71-live/fixture.mjs';
import { SYNC_V2_SCHEMAS, encodeSyncV2Patch } from '../src/lib/sync-v2.js';
const exec = promisify(execFile);
const shared = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const { Client } = createRequire(import.meta.url)(path.join(shared, 'client/node_modules/pg/lib/index.js'));
const bin = path.join(shared, 'package/native/bin');
const root = path.resolve('coverage/n71-current');
await fs.mkdir(root, { recursive: true });
const cluster = path.join(root, 'pg-' + randomUUID());
const log = path.join(root, 'pg.log');
const q = value => '"' + value.replaceAll('"', '""') + '"';
const schema = JSON.parse(await fs.readFile(path.join(root, 'live-schema.json'), 'utf8'));
const sql = await fs.readFile('supabase/migrations/20261012163000_n71_unified_restore.sql', 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => {
  const number = server.address().port; server.close(() => resolve(number));
}); });
const run = (name, args) => name === 'pg_ctl' ? new Promise((resolve,reject) => {
  const child=spawn(path.join(bin,name+'.exe'),args,{windowsHide:true,stdio:'ignore'});
  child.on('error',reject); child.on('exit',code=>code===0?resolve():reject(Error('pg_ctl exit '+code)));
}) : exec(path.join(bin, name + '.exe'), args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
let started = false, pg;
const checks = [];
const check = (name, evidence) => checks.push({ name, status: 'PASS', evidence });
try {
  await run('initdb', ['-D', cluster, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale']);
  await run('pg_ctl', ['-D', cluster, '-l', log, '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  pg = new Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  await pg.connect();
  await pg.query(`create schema auth; create schema rakeezx; create schema realtime; create role authenticated; create role anon;
    create role service_role; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ select $$;
    set check_function_bodies=off;`);
  for (const table of schema.tables) {
    await pg.query(`create table rakeezx.${q(table.name)} (${table.columns.map(c =>
      `${q(c.name)} ${c.type}${c.notnull ? ' not null' : ''}${c.default ? ' default ' + c.default : ''}`).join(',')})`);
  }
  for (const foreign of [false, true]) for (const table of schema.tables) for (const c of table.constraints ?? []) {
    if (c.sql.startsWith('FOREIGN KEY') !== foreign) continue;
    await pg.query(`alter table rakeezx.${q(table.name)} add constraint ${q(c.name)} ${c.sql}`);
  }
  for (const fn of schema.functions) await pg.query(fn.sql);
  for (const table of schema.tables) {
    for (const trigger of table.triggers ?? []) await pg.query(trigger);
    if (table.rls) await pg.query(`alter table rakeezx.${q(table.name)} enable row level security`);
    if (table.force) await pg.query(`alter table rakeezx.${q(table.name)} force row level security`);
  }
  for (const policy of schema.policies) await pg.query(`create policy ${q(policy.policyname)} on rakeezx.${q(policy.tablename)}
    as ${policy.permissive} for ${policy.cmd} to ${policy.roles.join(',')}
    ${policy.qual ? 'using (' + policy.qual + ')' : ''} ${policy.with_check ? 'with check (' + policy.with_check + ')' : ''}`);
  // Unique indexes not represented by pg_constraint are part of the source baseline.
  for (const index of schema.indexes) if (index.includes(' UNIQUE ') && index.includes(' WHERE ')) await pg.query(index);
  await pg.query('grant usage on schema rakeezx,auth to authenticated,anon; grant select on all tables in schema rakeezx to authenticated');
  const legacyBefore = schema.functions.filter(fn => /^(stage_sync_v2_restore|finalize_sync_v2_restore|sync_v2_restore_entities)/.test(fn.name));
  await pg.query(sql);
  check('migration_native', (await pg.query('select version()')).rows[0].version + '; SQL sha256=' + sha256(sql));
  for (const fn of legacyBefore) {
    const live = (await pg.query('select pg_get_functiondef($1::regprocedure) definition', [`rakeezx.${fn.name}(${fn.args.replace(/p_\w+ /g, '')})`])).rows[0].definition;
    assert.equal(live.replaceAll('\r',''), fn.sql.replaceAll('\r',''));
  }
  check('old_endpoint_compatibility', 'Every existing stage/finalize/entity helper source is unchanged');
  const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
  await pg.query('insert into auth.users values($1),($2)', [A,B]);
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [A]);
  const manifest = async () => (await pg.query('select rakeezx.n71_restore_manifest() result')).rows[0].result;
  const stage = async (id, operations, source = null) => (await pg.query('select rakeezx.stage_n71_restore($1,$2,5,$3,$4,$5) result',
    [id,'a'.repeat(64),JSON.stringify(source ?? await manifest()),JSON.stringify(operations),A])).rows[0].result;
  const finalize = async (id, staged) => (await pg.query('select rakeezx.finalize_n71_restore($1,$2,$3) result',
    [id,'a'.repeat(64),staged.stageHash])).rows[0].result;
  const make = (entity,id,patch) => ({ entity,recordId:id,operation:'create',baseRevision:0,patch,clientUpdatedAt:1 });
  const ops = [make('years','y',{label:'Synthetic',hijri_start:1450,hijri_end:1451}),
    make('terms','t',{year_id:'y',name:'Synthetic',index:1}),make('subjects','su',{name:'Synthetic',slug:'synthetic'}),
    make('units','u',{subject_id:'su',grade:5,term_index:1,name:'Synthetic'}),make('lessons','l',{unit_id:'u',name:'Synthetic'}),
    make('sections','sec',{year_id:'y',grade:5,label:'X',name:'Synthetic'}),
    make('teachings','teach',{section_id:'sec',subject_id:'su',term_id:'t'}),make('students','student',{name:'Synthetic'}),
    make('items','i',{teaching_id:'teach',name:'Synthetic',max:10,unit_id:'u',lesson_id:'l'}),
    make('scores','score',{student_id:'student',item_id:'i',value:7}),
    make('assignments','a',{teaching_id:'teach',lesson_id:'l',item_id:'i',title:'Synthetic',assigned_date:'2026-10-12',max:10}),
    make('submissions','s',{student_id:'student',assignment_id:'a',status:'submitted',score:7})];
  const staged = await stage('native:full',ops);
  assert.equal((await pg.query("select count(*)::int n from rakeezx.units where owner_id=$1",[A])).rows[0].n,0);
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
  await assert.rejects(finalize('native:full',staged),/mismatch/);
  await assert.rejects(pg.query('select rakeezx.n71_restore_manifest($1)',[A]),/owner mismatch/);
  await pg.query('set role authenticated');
  assert.deepEqual((await pg.query('select * from rakeezx.assignments')).rows,[]);
  await pg.query('reset role');
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
  const result = await finalize('native:full',staged);
  assert.equal(result.canonical.units[0].name,'Synthetic'); assert.equal(result.canonical.lessons[0].unit_id,'u');
  assert.equal(result.canonical.assignments[0].lesson_id,'l'); assert.equal(Number(result.canonical.submissions[0].score),7);
  assert.deepEqual(await finalize('native:full',staged),result);
  await assert.rejects(pg.query('select rakeezx.finalize_sync_v2_restore_score_v2($1,$2,$3)',
    ['native:full','a'.repeat(64),'wrong']),/mismatch/);
  check('owner_atomic_full_idempotency','Stage is Product-write-free; B denied; full units/lessons/assignments/submissions restored; exact receipt reused');
  const bad = await stage('native:rollback',[make('students','rollback',{name:'Synthetic'}),
    make('submissions','invalid',{student_id:'rollback',assignment_id:'a',status:'submitted',score:999})]);
  await assert.rejects(finalize('native:rollback',bad),/maximum/);
  assert.equal((await pg.query("select count(*)::int n from rakeezx.students where id='rollback'")).rows[0].n,0);
  assert.equal((await pg.query("select count(*)::int n from rakeezx.sync_restore_receipts where restore_id='native:rollback'")).rows[0].n,0);
  check('rollback_score_guard','Invalid submission maximum rolls back all Product writes and receipt');
  const excessive = await stage('native:score-limit',[{entity:'scores',recordId:'score',operation:'patch',baseRevision:1,patch:{value:11},clientUpdatedAt:2}]);
  await assert.rejects(finalize('native:score-limit',excessive),/maximum/);
  const deletedOps=[{...make('students','deleted-student',{name:'Deleted synthetic'}),operation:'create_deleted'},
    {...make('assignments','deleted-assignment',{teaching_id:'teach',title:'Deleted synthetic',assigned_date:'2026-10-12',max:10}),operation:'create_deleted'},
    {...make('submissions','deleted-submission',{student_id:'deleted-student',assignment_id:'deleted-assignment'}),operation:'create_deleted'}];
  const deletedStage=await stage('native:deleted',deletedOps);
  const deletedResult=await finalize('native:deleted',deletedStage);
  for(const [entity,id]of [['students','deleted-student'],['assignments','deleted-assignment'],['submissions','deleted-submission']])
    assert.ok(deletedResult.canonical[entity].find(row=>row.id===id).deleted_at);
  await assert.rejects(stage('native:null-action',[{...make('students','invalid-action',{name:'Synthetic'}),operation:null}]),/Invalid/);
  const ordinary=(await pg.query('select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,$5,$6,$7,$8) result',
    ['assignments','a','native:normal-sync','native-device',1,JSON.stringify({title:'Ordinary Sync'}),'patch',2])).rows[0].result;
  assert.equal(ordinary.canonical.title,'Ordinary Sync');
  await assert.rejects(pg.query('select rakeezx.apply_sync_v2_mutation($1,$2,$3,$4,$5,$6,$7,$8)',
    ['assignments','a','native:max-guard','native-device',2,JSON.stringify({max:1}),'patch',2]),/maximum/);
  check('portable_tombstone_normal_sync','Deleted student/assignment/submission inserted already tombstoned; ordinary Sync RPC supports new domain; null action and excessive target scores rejected');
  const fullFixture=portableFixture(fixtureIds('native'),{subjects:[{id:'su'}],timeProfiles:[{id:null}]},new Date().toISOString());
  fullFixture.years[0].hijriStart=1452;fullFixture.years[0].hijriEnd=1453;
  const order=['years','terms','sections','teachings','students','enrollments','units','lessons','items','slots','sessions','notes',
    'classRules','classCharterSelections','classGoals','groupArrangements','scoreSubitems','scores','scoreSubitemCompletions','logs',
    'sessionRosterSnapshots','attendance','closedTermReports','assignments','submissions'];
  const allOps=order.flatMap(name=>(fullFixture[name]??[]).map(row=>make(SYNC_V2_SCHEMAS[name].entity,row.id,encodeSyncV2Patch(name,row))));
  const allStage=await stage('native:portable-fixture',allOps);await finalize('native:portable-fixture',allStage);
  check('all_record_shapes','The deterministic live fixture record shapes, immutable report/roster, calendar boundary and mixed score provenance finalize under current live source');
  const stale = await stage('native:stale',[]);
  await pg.query("update rakeezx.assignments set title='newer' where owner_id=$1 and id='a'",[A]);
  await assert.rejects(finalize('native:stale',stale),/source changed/i);
  await pg.query("update rakeezx.assignments set deleted_at=now() where owner_id=$1 and id='a'",[A]);
  await assert.rejects(stage('native:resurrection',[{...make('assignments','a',{}),operation:'patch',baseRevision:3}]),/stale/);
  const orphan = await stage('native:orphan',[make('submissions','orphan',{student_id:'student',assignment_id:'a'})]);
  await assert.rejects(finalize('native:orphan',orphan),/deleted restore scope/);
  // Use the guarded term lifecycle flag only in this disposable local cluster.
  await pg.query("select set_config('rakeezx.closed_term_report_write','on',false)");
  await pg.query("update rakeezx.terms set status='closed' where owner_id=$1 and id='t'",[A]);
  const closed = await stage('native:closed',[make('items','closed-child',{teaching_id:'teach',name:'Must not resurrect',max:10})]);
  await assert.rejects(finalize('native:closed',closed),/closed-term restore scope/);
  check('deletion_source_guard','Changed source rejected; tombstoned assignment cannot resurrect; live descendant under deleted scope rejected');
  const grants = (await pg.query(`select has_function_privilege('anon','rakeezx.stage_n71_restore(text,text,integer,jsonb,jsonb,uuid)','execute') anon,
    has_function_privilege('authenticated','rakeezx.stage_n71_restore(text,text,integer,jsonb,jsonb,uuid)','execute') authenticated,
    has_table_privilege('authenticated','rakeezx.assignments','insert') direct_insert,
    has_function_privilege('authenticated','rakeezx.n71_restore_entities()','execute') internal`)).rows[0];
  assert.deepEqual(grants,{anon:false,authenticated:true,direct_insert:false,internal:false});
  check('acl','New tables FORCE RLS; owner SELECT only; authenticated RPC only; no direct writes or internal helper execute');
  await fs.writeFile(path.join(root,'native-result.json'),JSON.stringify({sqlSha256:sha256(sql),schemaSha256:sha256(JSON.stringify(schema)),checks},null,2));
  console.log(JSON.stringify({checks},null,2));
} finally {
  await pg?.end().catch(()=>{});
  if(started) await run('pg_ctl',['-D',cluster,'-w','stop','-m','fast']);
  const resolved=path.resolve(cluster);
  if(!resolved.startsWith(root+path.sep)||path.dirname(resolved)!==root)throw Error('Unsafe cluster cleanup target');
  await fs.rm(resolved,{recursive:true,force:true});
}
