import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const shared = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const { default: pg } = await import(pathToFileURL(shared + '/client/node_modules/pg/lib/index.js'));
const artifact = path.resolve('test-results/n73-native-ff45046cc4f8');
const cluster = path.join(artifact, 'cluster');
assert.ok(cluster.startsWith(path.resolve('test-results') + path.sep));
await mkdir(artifact, { recursive: true });
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const bin = name => shared + '/package/native/bin/' + name + '.exe';
const run = (name, args) => {
  const result = spawnSync(bin(name), args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error(`${name}: ${result.error ?? result.stderr ?? result.stdout}`);
};
let started = false, client;
const checks = [];
const record = (name, evidence) => { checks.push({ name, status: 'PASS', evidence }); console.log('PASS ' + name); };
const OWNER = 'a7300000-0000-4000-8000-000000000001';
const OTHER = 'b7300000-0000-4000-8000-000000000002';
const migration = '20261012120000_n73_distribution_apply.sql';
const sql = await readFile('supabase/migrations/' + migration, 'utf8');
const hash = createHash('sha256').update(sql).digest('hex');
try {
  run('initdb', ['-D', cluster, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--no-locale']);
  run('pg_ctl', ['-D', cluster, '-l', path.join(artifact, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  await client.connect();
  const q = (text, values) => client.query(text, values);
  await q(`create schema auth; create schema realtime;
    create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table realtime.messages(extension text,topic text); alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;
    insert into auth.users values('${OWNER}','a@example.invalid'),('${OTHER}','b@example.invalid');
    select set_config('request.jwt.claim.sub','${OWNER}',false);`);
  for (const name of (await readdir('supabase/migrations')).sort().filter(name => /^00\d+.*\.sql$/.test(name))) {
    await q((await readFile('supabase/migrations/' + name, 'utf8')).replace(/^\uFEFF/, ''));
  }
  await q(sql);
  record('native_exact_migration', `PostgreSQL ${(await q('show server_version')).rows[0].server_version}; ${migration}; SHA256 ${hash}`);
  await q(`insert into rakeezx.years(id,label,hijri_start,hijri_end) values('y','Synthetic',1450,1451);
    insert into rakeezx.terms(id,year_id,name,"index") values('term','y','Synthetic',1);
    insert into rakeezx.subjects(id,name,slug) values('subject','Synthetic','n73');
    insert into rakeezx.sections(id,year_id,grade,label,name) values
      ('s1','y',4,'1','4/1'),('s2','y',4,'2','4/2'),('s3','y',4,'3','4/3'),('s4','y',4,'4','4/4');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values
      ('t1','s1','subject','term'),('t2','s2','subject','term'),('t3','s3','subject','term'),('t4','s4','subject','term');
    insert into rakeezx.students(id,name) values('student','Synthetic A'),('student2','Synthetic B');
    insert into rakeezx.items(id,teaching_id,name,max,"order") values
      ('source','t1','Exam',20,0),('target','t2',' Exam ',25,0),('extra','t2','Extra',5,1),
      ('amb1','t4','Exam',25,0),('amb2','t4','Exam',25,1);
    insert into rakeezx.scores(id,student_id,item_id,value) values
      ('sourceScore','student','source',19),('targetScore','student','target',23),('validScore','student2','target',18),('extraScore','student','extra',4);`);
  const rpc = async (name, values) => (await q(`select rakeezx.${name}(${values.map((_,i) => '$'+(i+1)).join(',')}) result`, values)).rows[0].result;
  const plan = (id, targets = ['t2','t3'], removals = []) => rpc('plan_score_distribution', [id,'t1',targets,removals]);
  const apply = (p, id, confirmed = true, device = 'native') => rpc('apply_score_distribution_plan',[id,device,p.planId,p.token,confirmed]);
  const state = () => rpc('n73_distribution_state',['t1',['t2','t3','t4']]);
  const before = await state();
  const first = await plan('initial',['t2','t3','t4']);
  assert.deepEqual(first.targets.map(t => t.teachingId), ['t2','t3']);
  assert.equal(first.excludedTargets[0].teachingId,'t4');
  assert.ok(first.requiresConfirmation);
  assert.deepEqual(await state(), before);
  await assert.rejects(() => apply(first,'unconfirmed',false), /confirmation/);
  assert.deepEqual(await state(), before);
  record('plan_read_only_and_explicit_confirmation', 'Review has two accepted targets and one excluded ambiguous target; unconfirmed apply makes zero domain writes.');
  await q(`select set_config('request.jwt.claim.sub','${OTHER}',false); set role authenticated;`);
  assert.equal((await q('select * from rakeezx.score_distribution_plans')).rows.length,0);
  await assert.rejects(() => apply(first,'cross-owner'), /unavailable/);
  await assert.rejects(() => plan('b-plan'), /unavailable/);
  assert.equal((await q('select * from rakeezx.items')).rows.length,0);
  await q(`reset role; select set_config('request.jwt.claim.sub','${OWNER}',false);`);
  assert.deepEqual(await state(), before);
  record('owner_A_B', 'Authenticated B cannot select A items/plans or apply A plan. No A mutation.');
  await q("update rakeezx.scores set value=22 where id='targetScore'");
  const staleBefore = await state();
  await assert.rejects(() => apply(first,'stale'), /since review/);
  assert.deepEqual(await state(), staleBefore);
  record('stale_whole_plan_atomic', 'A changed target score rejects all accepted target operations, including target 3 creations.');
  const second = await plan('current',['t2','t3','t4']);
  await q(`create function rakeezx.n73_test_failure() returns trigger language plpgsql as $$
      begin if new.device_id='fail' then raise exception 'bounded synthetic failure'; end if; return new; end $$;
    create trigger n73_test_failure before update on rakeezx.scores for each row execute function rakeezx.n73_test_failure();`);
  const failureBefore = await state();
  await assert.rejects(() => apply(second,'fail',true,'fail'), /bounded synthetic failure/);
  assert.deepEqual(await state(), failureBefore);
  await q('drop trigger n73_test_failure on rakeezx.scores; drop function rakeezx.n73_test_failure()');
  record('injected_failure_atomic', 'Failure after parent operations rolls back every operation and receipt.');
  await q('begin');
  const receipt = await apply(second,'apply');
  const parallel = new pg.Client({ host:'127.0.0.1',port,user:'postgres',database:'postgres' });
  await parallel.connect();
  try {
    await parallel.query(`select set_config('request.jwt.claim.sub','${OWNER}',false)`);
    const retry = parallel.query('select rakeezx.apply_score_distribution_plan($1,$2,$3,$4,$5) result',
      ['apply','native',second.planId,second.token,true]);
    await q('commit');
    assert.deepEqual((await retry).rows[0].result,receipt);
  } finally { await parallel.end(); }
  assert.deepEqual(await apply(second,'apply'), receipt);
  assert.equal((await q("select value from rakeezx.scores where id='targetScore'")).rows[0].value,'20.00');
  assert.equal((await q("select value from rakeezx.scores where id='validScore'")).rows[0].value,'18.00');
  assert.equal((await q("select value from rakeezx.scores where id='sourceScore'")).rows[0].value,'19.00');
  assert.equal((await q("select value from rakeezx.scores where id='extraScore'")).rows[0].value,'4.00');
  assert.equal((await q("select count(*)::int n from rakeezx.scores s join rakeezx.items i on s.item_id=i.id where i.teaching_id='t3'")).rows[0].n,0);
  const repeated = await plan('repeat'); assert.equal(repeated.changedCount,0);
  await apply(repeated,'repeat');
  assert.equal((await q("select count(*)::int n from rakeezx.items where teaching_id='t3'")).rows[0].n,1);
  record('cap_preserve_keep_no_source_grades_idempotence', '22/25 persisted to 20/20; valid 18 and extra 4 preserved; source 19 unchanged; new target has no copied grades; repeat creates no duplicate.');
  const removal = await plan('remove',['t2'],['extra']);
  await apply(removal,'remove');
  assert.ok((await q("select deleted_at from rakeezx.scores where id='extraScore'")).rows[0].deleted_at);
  assert.ok((await q("select deleted_at from rakeezx.items where id='extra'")).rows[0].deleted_at);
  record('explicit_extra_removal', 'Only explicitly selected extra and its target score are tombstoned.');
  await q(`begin; select set_config('rakeezx.score_domain_write','on',true);
    update rakeezx.items set score_mode='subitems',distribution_mode='manual' where id in ('source','target');
    insert into rakeezx.score_subitems(id,item_id,name,value,"order") values ('sd','source','Part',5,0),('td','target','Part',5,0);
    insert into rakeezx.score_subitem_completions(id,student_id,subitem_id,checked) values('tc','student','td',true);
    update rakeezx.scores set value=7,manual_value=2,derived_value=5 where id='targetScore';
    update rakeezx.scores set value=18,manual_value=18,derived_value=0 where id='validScore';
    update rakeezx.scores set value=19,manual_value=19,derived_value=0 where id='sourceScore'; commit;`);
  const sub = await plan('sub',['t2']); const subreceipt = await apply(sub,'sub');
  assert.equal((await q("select id,distribution_origin_id from rakeezx.score_subitems where item_id='target'")).rows[0].distribution_origin_id,'sd');
  assert.equal((await q("select value from rakeezx.scores where id='targetScore'")).rows[0].value,'7.00');
  assert.equal((await q("select checked from rakeezx.score_subitem_completions where id='tc'")).rows[0].checked,true);
  const renameBefore = await state();
  const item = (await q("select * from rakeezx.items where id='target'")).rows[0];
  await rpc('rename_score_item',['rename','native','target',item.revision,'Renamed parent']);
  const renameAfter = await state();
  for (const entity of ['scores','score_subitems','score_subitem_completions']) assert.deepEqual(renameAfter[entity],renameBefore[entity]);
  assert.equal((await q("select distribution_version from rakeezx.items where id='target'")).rows[0].distribution_version,item.distribution_version);
  record('subitem_identity_and_metadata_only_rename', 'Unique subitem matches retain target IDs and checked completions; manual 2 + derived 5 remains 7; parent rename never changes scores, subitems, completions or distribution version.');
  const oldSource = (await q("select revision from rakeezx.items where id='source'")).rows[0].revision;
  const legacy = await rpc('apply_score_distribution_copy_command',['legacy','native','source',oldSource,'t3','legacy-item',{ sd:'legacy-sub' },'add']);
  assert.equal(legacy.item.id,'legacy-item');
  assert.equal((await rpc('score_foundation_capability',[])).copyDomainVersion,1);
  for (const signature of ['n73_distribution_state(text,text[])','n73_build_distribution(text,text[],text[])','sync_v2_field_map_before_n73(text)']) {
    assert.equal((await q("select has_function_privilege('authenticated',$1,'EXECUTE') allowed", ['rakeezx.'+signature])).rows[0].allowed,false);
  }
  for (const signature of ['plan_score_distribution(text,text,text[],text[])','apply_score_distribution_plan(text,text,text,text,boolean)','rename_score_item(text,text,text,bigint,text)']) {
    assert.equal((await q("select has_function_privilege('anon',$1,'EXECUTE') allowed", ['rakeezx.'+signature])).rows[0].allowed,false);
  }
  assert.equal((await rpc('score_distribution_capability',[])).distributionApplyVersion,2);
  await q("set role authenticated; update rakeezx.items set name='Compatible DIRECT edit' where id='amb1'; reset role");
  record('old_clients_and_ACL', 'Existing copy command and copyDomainVersion=1 still work; v2 exposed only to authenticated; helpers denied.');
} finally {
  await client?.end();
  if (started) run('pg_ctl', ['-D', cluster, '-w', '-m', 'fast', 'stop']);
  await rm(cluster, { recursive: true, force: true });
  await writeFile(path.join(artifact,'result.json'), JSON.stringify({ migration, hash, checks, ownedServerStopped: true, ownedClusterRemoved: true }, null, 2));
}
