import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { canonicalRestoreManifest } from '../src/lib/backup-v2.js';
import { decodeSyncV2Canonical, SYNC_V2_SCHEMAS } from '../src/lib/sync-v2.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);
let pg;

before(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key); create table auth.current_identity(id uuid);
    insert into auth.users values ('${OWNER}'),('${OTHER}');
    insert into auth.current_identity values ('${OWNER}');
    create function auth.uid() returns uuid language sql stable security definer set search_path=''
      as $$select id from auth.current_identity limit 1$$;
    grant usage on schema auth to authenticated,anon;
  `);
  const names = (await readdir(migrationsDirectory)).sort()
    .filter((name) => /^\d+.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 34);
  for (const name of names) {
    await pg.exec((await readFile(new URL(name, migrationsDirectory), 'utf8')).replace(/^\uFEFF/, ''));
  }
});
after(async () => pg?.close());

test('0034 removes direct guard execution without changing trigger bindings', async () => {
  const guards = ['guard_subitem_definition_write', 'guard_subitem_score_write'];
  for (const guard of guards) {
    const [acl] = (await pg.query(`select
      has_function_privilege('anon', $1, 'EXECUTE') anon,
      has_function_privilege('authenticated', $1, 'EXECUTE') authenticated,
      exists (select 1 from pg_proc p, aclexplode(p.proacl) a
        where p.oid=$1::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE') public`,
    [`rakeezx.${guard}()`])).rows;
    assert.deepEqual(acl, { anon: false, authenticated: false, public: false });
    for (const role of ['anon', 'authenticated']) {
      await pg.exec(`set role ${role}`);
      try {
        await assert.rejects(() => pg.query(`select rakeezx.${guard}()`), /permission denied/i);
      } finally {
        await pg.exec('reset role');
      }
    }
  }
  const bindings = (await pg.query(`select p.proname, count(*)::int bindings
    from pg_trigger t join pg_proc p on p.oid=t.tgfoid
    where p.pronamespace='rakeezx'::regnamespace
      and p.proname in ('guard_subitem_definition_write','guard_subitem_score_write')
    group by p.proname order by p.proname`)).rows;
  assert.deepEqual(bindings, [
    { proname: 'guard_subitem_definition_write', bindings: 3 },
    { proname: 'guard_subitem_score_write', bindings: 1 },
  ]);
});

test('score foundation migration is additive and exposes owner-bound domain capability', async () => {
  const columns = (await pg.query(`select table_name,column_name from information_schema.columns
    where table_schema='rakeezx' and table_name in ('items','scores','score_subitems','score_subitem_completions')`)).rows;
  assert.ok(columns.some((row) => row.table_name === 'items' && row.column_name === 'portability_group_id'));
  assert.ok(columns.some((row) => row.table_name === 'scores' && row.column_name === 'manual_value'));
  assert.ok(columns.some((row) => row.table_name === 'score_subitem_completions' && row.column_name === 'checked'));
  const policies = (await pg.query(`select relname,relrowsecurity,relforcerowsecurity from pg_class
    where relnamespace='rakeezx'::regnamespace and relname in
      ('score_subitems','score_subitem_completions','score_domain_receipts')`)).rows;
  assert.equal(policies.length, 3);
  assert.ok(policies.every((row) => row.relrowsecurity && row.relforcerowsecurity));
  const capability = (await pg.query('select rakeezx.score_foundation_capability() result')).rows[0].result;
  assert.equal(capability.scoreDomainVersion, 1);
  assert.equal(capability.restoreProtocol, 'CORE_V2');
  const legacy = (await pg.query('select rakeezx.sync_v2_restore_entities() entities')).rows[0].entities;
  assert.ok(!legacy.includes('score_subitems'));
});

async function seedScoreContext() {
  await pg.exec(`
    insert into rakeezx.years(id,label,hijri_start,hijri_end,client_updated_at,device_id)
      values('score:year','synthetic',1450,1451,1,'seed');
    insert into rakeezx.terms(id,year_id,name,"index",client_updated_at,device_id)
      values('score:term','score:year','term',1,1,'seed');
    insert into rakeezx.subjects(id,name,slug,client_updated_at,device_id)
      values('score:subject','subject','score-subject',1,'seed');
    insert into rakeezx.sections(id,year_id,grade,label,name,client_updated_at,device_id)
      values('score:section','score:year',4,'A','section',1,'seed');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id,client_updated_at,device_id)
      values('score:teaching','score:section','score:subject','score:term',1,'seed');
    insert into rakeezx.students(id,name,client_updated_at,device_id)
      values('score:student','synthetic student',1,'seed');
    insert into rakeezx.items(id,teaching_id,name,max,client_updated_at,device_id)
      values('score:item','score:teaching','assessment',10,1,'seed');
    insert into rakeezx.items(id,teaching_id,name,max,client_updated_at,device_id)
      values('score:direct','score:teaching','direct',10,1,'seed');
    begin;
      select pg_catalog.set_config('rakeezx.score_domain_write','on',true);
      update rakeezx.items set score_mode='subitems',distribution_mode='manual'
        where id='score:item';
      insert into rakeezx.score_subitems(id,item_id,name,value,"order",device_id)
        values('score:sub:one','score:item','one',6,0,'seed'),
          ('score:sub:two','score:item','two',4,1,'seed');
    commit;
  `);
}

async function scoreCommand(mutationId, command, { subitemId = null, checked = null, manual = null } = {}) {
  return (await pg.query(`select rakeezx.apply_score_subitem_command($1,$2,$3,$4,$5,$6,$7,$8) result`,
    [mutationId, 'device:A', command, 'score:item', 'score:student', subitemId, checked, manual])).rows[0].result;
}

test('server atomically materializes checked/manual state, clamps, and returns an idempotent receipt', async () => {
  await seedScoreContext();
  const check = await scoreCommand('mutation:check', 'set_completion',
    { subitemId: 'score:sub:one', checked: true });
  assert.equal(Number(check.score.derived_value), 6);
  assert.equal(Number(check.score.value), 6);
  assert.equal(check.completion.checked, true);
  const manual = await scoreCommand('mutation:manual', 'set_manual', { manual: 5 });
  assert.equal(Number(manual.score.manual_value), 4);
  assert.equal(Number(manual.score.value), 10);
  assert.deepEqual(await scoreCommand('mutation:manual', 'set_manual', { manual: 5 }), manual);
  await assert.rejects(() => scoreCommand('mutation:precision', 'set_manual',
    { manual: 1.005 }), /Invalid score domain command/);
  assert.equal((await pg.query(`select count(*)::int n from rakeezx.score_domain_receipts
    where owner_id=$1`, [OWNER])).rows[0].n, 2);
  const unchecked = await scoreCommand('mutation:uncheck', 'set_completion',
    { subitemId: 'score:sub:one', checked: false });
  assert.equal(Number(unchecked.score.value), 4);
  await assert.rejects(() => pg.query(`update rakeezx.scores set value=9
    where owner_id=$1 and id='sc:score:student:score:item'`, [OWNER]),
  /Subitem score requires atomic score domain command/);
  await pg.query(`insert into rakeezx.scores(id,student_id,item_id,value,device_id)
    values('sc:score:student:score:direct','score:student','score:direct',7,'legacy')`);
  assert.equal((await pg.query(`select value from rakeezx.scores where id='sc:score:student:score:direct'`)).rows[0].value, '7.00');
});

test('confirmed configuration recalculates all affected scores atomically and rejects stale versions', async () => {
  await scoreCommand('mutation:check:again', 'set_completion',
    { subitemId: 'score:sub:one', checked: true });
  const payload = { scoreMode: 'subitems', distributionMode: 'manual', max: 10, subitems: [
    { id: 'score:sub:one', name: 'one', value: 8 },
    { id: 'score:sub:two', name: 'two', value: 2 },
  ] };
  const result = (await pg.query(`select rakeezx.apply_score_configuration_command(
    $1,$2,$3,$4,$5::jsonb) result`, ['mutation:config', 'device:A', 'score:item', 1,
    JSON.stringify(payload)])).rows[0].result;
  assert.equal(Number(result.scores[0].derived_value), 8);
  assert.equal(Number(result.scores[0].manual_value), 2);
  assert.equal(Number(result.scores[0].value), 10);
  assert.equal(Number(result.item.distribution_version), 2);
  const retry = (await pg.query(`select rakeezx.apply_score_configuration_command(
    $1,$2,$3,$4,$5::jsonb) result`, ['mutation:config', 'device:A', 'score:item', 1,
    JSON.stringify(payload)])).rows[0].result;
  assert.deepEqual(retry, result);
  await assert.rejects(() => pg.query(`select rakeezx.apply_score_configuration_command(
    $1,$2,$3,$4,$5::jsonb) result`, ['mutation:stale', 'device:A', 'score:item', 1,
    JSON.stringify(payload)]), /Score configuration revision changed/);
  await assert.rejects(() => pg.query(`select rakeezx.apply_score_configuration_command(
    $1,$2,$3,$4,$5::jsonb) result`, ['mutation:precision:config', 'device:A', 'score:item', 2,
    JSON.stringify({ ...payload, max: 10.005 })]), /two-decimal precision/);
  const unchanged = (await pg.query(`select value,manual_value,derived_value from rakeezx.scores
    where owner_id=$1 and item_id='score:item'`, [OWNER])).rows[0];
  assert.deepEqual(unchanged, { value: '10.00', manual_value: '2.00', derived_value: '8.00' });
});

test('versioned restore includes provenance and old clients fail closed only for subitem workspaces', async () => {
  await assert.rejects(() => pg.query('select rakeezx.sync_v2_restore_manifest_full($1) result',
    [OWNER]), /RESTORE_PROTOCOL_UNSUPPORTED/);
  await assert.rejects(() => pg.query(`select rakeezx.stage_sync_v2_restore(
    'legacy:restore','legacy:hash',3,'[]'::jsonb,'[]'::jsonb)`), /RESTORE_PROTOCOL_UNSUPPORTED/);
  const v2Manifest = (await pg.query('select rakeezx.sync_v2_restore_manifest_score_v2($1) result',
    [OWNER])).rows[0].result;
  assert.ok(v2Manifest.some((row) => row.entity === 'score_subitems' && row.id === 'score:sub:one'));
  assert.ok(v2Manifest.some((row) => row.entity === 'score_subitem_completions'));
  const canonical = (await pg.query('select rakeezx.sync_v2_restore_canonical_score_v2($1) result',
    [OWNER])).rows[0].result;
  assert.equal(canonical.score_subitems.length, 2);
  assert.equal(canonical.score_subitem_completions.length, 1);
  assert.equal(canonical.items.find((row) => row.id === 'score:item').score_mode, 'subitems');
  assert.equal(canonical.scores.find((row) => row.item_id === 'score:item').value, 10);
  await pg.query('update auth.current_identity set id=$1', [OTHER]);
  const oldDirectManifest = (await pg.query('select rakeezx.sync_v2_restore_manifest_full($1) result',
    [OTHER])).rows[0].result;
  assert.ok(!oldDirectManifest.some((row) => row.entity === 'score_subitems'));
  await pg.exec('set role authenticated');
  try {
    const legacyStage = (await pg.query(`select rakeezx.stage_sync_v2_restore(
      'legacy:direct','legacy:hash',3,'[]'::jsonb,'[]'::jsonb) result`)).rows[0].result;
    assert.equal(legacyStage.state, 'staged');
    const legacyFinal = (await pg.query(`select rakeezx.finalize_sync_v2_restore(
      'legacy:direct','legacy:hash',$1) result`, [legacyStage.stageHash])).rows[0].result;
    assert.equal(legacyFinal.receipt.status, 'finalized');
  } finally {
    await pg.exec('reset role');
  }
  await assert.rejects(() => pg.query('select rakeezx.sync_v2_restore_manifest_score_v2($1)',
    [OWNER]), /Restore manifest owner mismatch/);
  await pg.query('update auth.current_identity set id=$1', [OWNER]);
});

test('one owner-scoped cloud score snapshot returns mutually consistent components under authenticated role', async () => {
  await pg.exec('set role authenticated');
  try {
    const snapshot = (await pg.query('select rakeezx.sync_v2_score_domain_snapshot() result')).rows[0].result;
    assert.ok(snapshot.items.some((row) => row.id === 'score:item'));
    assert.ok(snapshot.score_subitems.some((row) => row.item_id === 'score:item'));
    assert.ok(snapshot.score_subitem_completions.some((row) => row.subitem_id === 'score:sub:one'));
    assert.equal(Number(snapshot.scores.find((row) => row.item_id === 'score:item').value), 10);
    await pg.exec('reset role');
    await pg.query('update auth.current_identity set id=$1', [OTHER]);
    await pg.exec('set role authenticated');
    const other = (await pg.query('select rakeezx.sync_v2_score_domain_snapshot() result')).rows[0].result;
    for (const rows of Object.values(other)) assert.equal(rows.length, 0);
  } finally {
    await pg.exec('reset role');
    await pg.query('update auth.current_identity set id=$1', [OWNER]);
  }
});

test('V5 stages without writes and atomically restores subitem provenance for another synthetic owner', async () => {
  await pg.query('update auth.current_identity set id=$1', [OTHER]);
  const source = (await pg.query('select rakeezx.sync_v2_backup_manifest_score_v2($1) result', [OTHER])).rows[0].result;
  assert.deepEqual(source, []);
  const record = (entity, id, patch) => ({ entity, recordId: id, operation: 'create',
    baseRevision: 0, patch, clientUpdatedAt: 1 });
  const operations = [
    record('years', 'v5:year', { label: 'synthetic', hijri_start: 1450, hijri_end: 1451 }),
    record('terms', 'v5:term', { year_id: 'v5:year', name: 'term', index: 1 }),
    record('subjects', 'v5:subject', { name: 'synthetic', slug: 'v5-subject' }),
    record('sections', 'v5:section', { year_id: 'v5:year', grade: 4, label: 'A', name: 'section' }),
    record('teachings', 'v5:teaching', { section_id: 'v5:section', subject_id: 'v5:subject', term_id: 'v5:term' }),
    record('students', 'v5:student', { name: 'synthetic student' }),
    record('items', 'v5:item', { teaching_id: 'v5:teaching', name: 'assessment', max: 10,
      score_mode: 'subitems', distribution_mode: 'manual', distribution_version: 1 }),
    record('score_subitems', 'v5:subitem', { item_id: 'v5:item', name: 'one', value: 3, order: 0,
      distribution_version: 1 }),
    record('scores', 'sc:v5:student:v5:item', { student_id: 'v5:student', item_id: 'v5:item',
      value: 8, derived_value: 3, manual_value: 5 }),
    record('score_subitem_completions', 'ssc:v5:student:v5:subitem', {
      student_id: 'v5:student', subitem_id: 'v5:subitem', checked: true }),
  ];
  const hash = 'a'.repeat(64);
  const stage = (await pg.query(`select rakeezx.stage_sync_v2_restore_score_v2(
    $1,$2,$3,$4::jsonb,$5::jsonb) result`, ['v5:restore', hash, 5,
    JSON.stringify(source), JSON.stringify(operations)])).rows[0].result;
  assert.equal((await pg.query("select count(*)::int n from rakeezx.items where owner_id=$1", [OTHER])).rows[0].n, 0);
  const final = (await pg.query('select rakeezx.finalize_sync_v2_restore_score_v2($1,$2,$3) result',
    ['v5:restore', hash, stage.stageHash])).rows[0].result;
  assert.equal(final.canonical.score_subitem_completions[0].checked, true);
  assert.equal(Number(final.canonical.scores[0].value), 8);
  assert.deepEqual((await pg.query('select rakeezx.finalize_sync_v2_restore_score_v2($1,$2,$3) result',
    ['v5:restore', hash, stage.stageHash])).rows[0].result, final);
  await pg.query('update auth.current_identity set id=$1', [OWNER]);
});

test('distribution copy is one owner-scoped idempotent definition command', async () => {
  await pg.exec(`
    insert into rakeezx.sections(id,year_id,grade,label,name,client_updated_at,device_id)
      values('copy:section','score:year',4,'B','target',1,'seed');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id,client_updated_at,device_id)
      values('copy:teaching','copy:section','score:subject','score:term',1,'seed');
    insert into rakeezx.sections(id,year_id,grade,label,name,client_updated_at,device_id)
      values('copy:section:other','score:year',4,'C','other target',1,'seed');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id,client_updated_at,device_id)
      values('copy:teaching:other','copy:section:other','score:subject','score:term',1,'seed');
  `);
  const revision = Number((await pg.query("select revision from rakeezx.items where id='score:item'"))
    .rows[0].revision);
  const args = ['copy:mutation', 'device:A', 'score:item', revision, 'copy:teaching',
    'copy:item', JSON.stringify({ 'score:sub:one': 'copy:sub:one', 'score:sub:two': 'copy:sub:two' }), 'missing'];
  const invoke = () => pg.query(`select rakeezx.apply_score_distribution_copy_command(
    $1,$2,$3,$4,$5,$6,$7::jsonb,$8) result`, args);
  const result = (await invoke()).rows[0].result;
  assert.equal(result.item.id, 'copy:item');
  assert.equal(result.item.portability_group_id, null);
  assert.equal(result.subitems.length, 2);
  assert.deepEqual(result.scores, []);
  assert.deepEqual((await invoke()).rows[0].result, result);
  assert.equal((await pg.query("select count(*)::int n from rakeezx.items where id='copy:item'"))
    .rows[0].n, 1);
  assert.equal((await pg.query("select count(*)::int n from rakeezx.score_subitem_completions where subitem_id like 'copy:%'"))
    .rows[0].n, 0);
  await assert.rejects(() => pg.query(`select rakeezx.apply_score_distribution_copy_command(
    $1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [...args.slice(0, 5), 'copy:second', args[6], args[7]]),
  /Copy mutation ID reused/);
  await assert.rejects(() => pg.query(`select rakeezx.apply_score_distribution_copy_command(
    $1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [args[0], args[1], args[2], args[3],
    'copy:teaching:other', args[5], args[6], args[7]]),
  /Copy mutation ID reused/, 'same per-target command identity cannot replay for a changed selection');
});

test('authenticated RLS isolates both owners and old direct scoring cannot overwrite SUBITEM', async () => {
  await pg.exec('set role authenticated');
  try {
    assert.equal((await pg.query('select current_user role')).rows[0].role, 'authenticated');
    assert.equal((await pg.query('select count(*)::int n from rakeezx.score_subitems where owner_id=$1',
      [OTHER])).rows[0].n, 0);
    assert.equal((await pg.query('select count(*)::int n from rakeezx.score_subitem_completions where owner_id=$1',
      [OTHER])).rows[0].n, 0);
    await assert.rejects(() => pg.query(`update rakeezx.score_subitems set value=7 where id='v5:subitem'`));
    await assert.rejects(() => pg.query(`update rakeezx.score_subitem_completions set checked=false
      where id='ssc:v5:student:v5:subitem'`));
    await assert.rejects(() => pg.query(`select rakeezx.apply_score_subitem_command(
      'cross:mutation','device:A','set_completion','v5:item','v5:student','v5:subitem',true,null)`),
    /unavailable/);
    await assert.rejects(() => pg.query(`select rakeezx.apply_score_distribution_copy_command(
      'cross:copy','device:A','v5:item',1,'copy:teaching','cross:new','{}'::jsonb,'missing')`),
    /stale/);
    await assert.rejects(() => pg.query(`select rakeezx.stage_sync_v2_restore_score_v2(
      'cross:restore',$1,5,$2::jsonb,'[]'::jsonb)`, ['a'.repeat(64),
      JSON.stringify([{ entity: 'score_subitems', id: 'v5:subitem', revision: 1, deleted: false }])]),
    /Canonical source changed/);
    const source = (await pg.query('select rakeezx.sync_v2_restore_manifest($1) result', [OWNER])).rows[0].result;
    const definitions = (await pg.query(`select id,revision,deleted_at from rakeezx.score_subitems
      where owner_id=$1 order by id`, [OWNER])).rows.map((row) => ({ entity: 'score_subitems',
      id: row.id, revision: Number(row.revision), deleted: row.deleted_at != null }));
    const completions = (await pg.query(`select id,revision,deleted_at from rakeezx.score_subitem_completions
      where owner_id=$1 order by id`, [OWNER])).rows.map((row) => ({ entity: 'score_subitem_completions',
      id: row.id, revision: Number(row.revision), deleted: row.deleted_at != null }));
    const stage = (await pg.query(`select rakeezx.stage_sync_v2_restore_score_v2(
      'role:stage',$1,5,$2::jsonb,'[]'::jsonb) result`, ['a'.repeat(64),
      JSON.stringify([...source, ...definitions, ...completions])])).rows[0].result;
    assert.equal(stage.state, 'staged');
    await pg.query(`update rakeezx.scores set value=6
      where id='sc:score:student:score:direct'`);
    assert.equal((await pg.query(`select value from rakeezx.scores
      where id='sc:score:student:score:direct'`)).rows[0].value, '6.00');
    await assert.rejects(() => pg.query(`update rakeezx.scores set value=9
      where id='sc:score:student:score:item'`), /atomic score domain command/);
    const directRevision = Number((await pg.query(`select revision from rakeezx.scores
      where id='sc:score:student:score:direct'`)).rows[0].revision);
    await pg.query(`select rakeezx.apply_sync_v2_mutation('scores',
      'sc:score:student:score:direct','legacy:direct','old-client',$1,
      '{"value":5}'::jsonb,'patch',1)`, [directRevision]);
    assert.equal((await pg.query(`select value from rakeezx.scores
      where id='sc:score:student:score:direct'`)).rows[0].value, '5.00');
    const subitemRevision = Number((await pg.query(`select revision from rakeezx.scores
      where id='sc:score:student:score:item'`)).rows[0].revision);
    await assert.rejects(() => pg.query(`select rakeezx.apply_sync_v2_mutation('scores',
      'sc:score:student:score:item','legacy:subitem','old-client',$1,
      '{"value":9}'::jsonb,'patch',1)`, [subitemRevision]), /atomic score domain command/);
  } finally {
    await pg.exec('reset role');
  }
  await pg.query('update auth.current_identity set id=$1', [OTHER]);
  await pg.exec('set role authenticated');
  try {
    assert.equal((await pg.query('select count(*)::int n from rakeezx.score_subitems where owner_id=$1',
      [OWNER])).rows[0].n, 0);
    assert.equal((await pg.query('select count(*)::int n from rakeezx.score_subitem_completions where owner_id=$1',
      [OWNER])).rows[0].n, 0);
    assert.equal((await pg.query('select count(*)::int n from rakeezx.score_subitems where owner_id=$1',
      [OTHER])).rows[0].n, 1);
    await assert.rejects(() => pg.query(`select rakeezx.apply_score_subitem_command(
      'cross:reverse','device:B','set_completion','score:item','score:student',
      'score:sub:one',true,null)`), /unavailable/);
  } finally {
    await pg.exec('reset role');
    await pg.query('update auth.current_identity set id=$1', [OWNER]);
  }
});

test('two stale device intents serialize to canonical completion plus accepted manual', async () => {
  await pg.exec(`
    insert into rakeezx.items(id,teaching_id,name,max,client_updated_at,device_id)
      values('race:item3','score:teaching','race3',10,1,'seed'),
        ('race:item7','score:teaching','race7',10,1,'seed');
    begin;
      select pg_catalog.set_config('rakeezx.score_domain_write','on',true);
      update rakeezx.items set score_mode='subitems',distribution_mode='manual'
        where id in ('race:item3','race:item7');
      insert into rakeezx.score_subitems(id,item_id,name,value,"order",device_id)
        values('race:sub3','race:item3','three',3,0,'seed'),
          ('race:sub7','race:item7','seven',7,0,'seed');
    commit;
  `);
  const call = async (mutationId, deviceId, command, itemId, subitemId, checked, manual) =>
    (await pg.query(`select rakeezx.apply_score_subitem_command(
      $1,$2,$3,$4,'score:student',$5,$6,$7) result`,
    [mutationId, deviceId, command, itemId, subitemId, checked, manual])).rows[0].result;
  await pg.exec('set role authenticated');
  try {
    await Promise.all([
      call('race:a:check', 'device:A', 'set_completion', 'race:item3', 'race:sub3', true, null),
      call('race:b:manual', 'device:B', 'set_manual', 'race:item3', null, null, 5),
    ]);
    let row = (await pg.query(`select value,derived_value,manual_value from rakeezx.scores
      where item_id='race:item3'`)).rows[0];
    assert.deepEqual(row, { value: '8.00', derived_value: '3.00', manual_value: '5.00' });
    await Promise.all([
      call('race:a:cap-check', 'device:A', 'set_completion', 'race:item7', 'race:sub7', true, null),
      call('race:b:cap-manual', 'device:B', 'set_manual', 'race:item7', null, null, 5),
    ]);
    row = (await pg.query(`select value,derived_value,manual_value from rakeezx.scores
      where item_id='race:item7'`)).rows[0];
    assert.deepEqual(row, { value: '10.00', derived_value: '7.00', manual_value: '3.00' });
    await Promise.all([
      call('race:a:uncheck', 'device:A', 'set_completion', 'race:item3', 'race:sub3', false, null),
      call('race:b:manual-change', 'device:B', 'set_manual', 'race:item3', null, null, 7),
    ]);
    row = (await pg.query(`select value,derived_value,manual_value from rakeezx.scores
      where item_id='race:item3'`)).rows[0];
    assert.deepEqual(row, { value: '7.00', derived_value: '0.00', manual_value: '7.00' });
    await call('race:a:cap-reset', 'device:A', 'set_completion', 'race:item7', 'race:sub7', false, null);
    await Promise.all([
      call('race:b:cap-manual-first', 'device:B', 'set_manual', 'race:item7', null, null, 5),
      call('race:a:cap-check-second', 'device:A', 'set_completion', 'race:item7', 'race:sub7', true, null),
    ]);
    row = (await pg.query(`select value,derived_value,manual_value from rakeezx.scores
      where item_id='race:item7'`)).rows[0];
    assert.deepEqual(row, { value: '10.00', derived_value: '7.00', manual_value: '3.00' });
    assert.equal((await pg.query(`select checked from rakeezx.score_subitem_completions
      where subitem_id='race:sub3'`)).rows[0].checked, false);
    await Promise.all([
      call('race:b:manual-first', 'device:B', 'set_manual', 'race:item3', null, null, 5),
      call('race:a:check-second', 'device:A', 'set_completion', 'race:item3', 'race:sub3', true, null),
    ]);
    row = (await pg.query(`select value,derived_value,manual_value from rakeezx.scores
      where item_id='race:item3'`)).rows[0];
    assert.deepEqual(row, { value: '8.00', derived_value: '3.00', manual_value: '5.00' });
    await Promise.all([
      call('race:b:manual-reverse', 'device:B', 'set_manual', 'race:item3', null, null, 7),
      call('race:a:uncheck-reverse', 'device:A', 'set_completion', 'race:item3', 'race:sub3', false, null),
    ]);
    row = (await pg.query(`select value,derived_value,manual_value from rakeezx.scores
      where item_id='race:item3'`)).rows[0];
    assert.deepEqual(row, { value: '7.00', derived_value: '0.00', manual_value: '7.00' });
  } finally {
    await pg.exec('reset role');
  }
});

test('client V5 manifest order and revisions match the server staging contract', async () => {
  const canonical = (await pg.query('select rakeezx.sync_v2_backup_canonical_score_v2($1) result',
    [OWNER])).rows[0].result;
  const server = (await pg.query('select rakeezx.sync_v2_backup_manifest_score_v2($1) result',
    [OWNER])).rows[0].result;
  const local = Object.fromEntries(Object.entries(SYNC_V2_SCHEMAS).map(([store, schema]) => [store,
    (canonical[schema.entity] ?? []).map((row) => decodeSyncV2Canonical(store, row))]));
  assert.deepEqual(canonicalRestoreManifest(local, { version: 5 }), server);
});

test('V5 finalization rolls back every row when supplied projection is inconsistent', async () => {
  await pg.query('update auth.current_identity set id=$1', [OTHER]);
  try {
    const source = (await pg.query('select rakeezx.sync_v2_backup_manifest_score_v2($1) result',
      [OTHER])).rows[0].result;
    const create = (entity, recordId, patch) => ({ entity, recordId,
      operation: 'create', baseRevision: 0, patch, clientUpdatedAt: 1 });
    const operations = [
      create('items', 'v5:bad-item', { teaching_id: 'v5:teaching', name: 'bad', max: 10,
        score_mode: 'subitems', distribution_mode: 'manual' }),
      create('score_subitems', 'v5:bad-sub', { item_id: 'v5:bad-item', name: 'three', value: 3 }),
      create('scores', 'sc:v5:student:v5:bad-item', { student_id: 'v5:student',
        item_id: 'v5:bad-item', derived_value: 3, manual_value: 5, value: 9 }),
      create('score_subitem_completions', 'ssc:v5:student:v5:bad-sub', {
        student_id: 'v5:student', subitem_id: 'v5:bad-sub', checked: true }),
    ];
    const hash = 'b'.repeat(64);
    const stage = (await pg.query(`select rakeezx.stage_sync_v2_restore_score_v2(
      $1,$2,5,$3::jsonb,$4::jsonb) result`, ['v5:bad-restore', hash,
      JSON.stringify(source), JSON.stringify(operations)])).rows[0].result;
    await assert.rejects(() => pg.query('select rakeezx.finalize_sync_v2_restore_score_v2($1,$2,$3)',
      ['v5:bad-restore', hash, stage.stageHash]), /provenance diverged/);
    assert.equal((await pg.query("select count(*)::int n from rakeezx.items where id='v5:bad-item'"))
      .rows[0].n, 0);
    assert.equal((await pg.query("select count(*)::int n from rakeezx.score_domain_receipts where mutation_id='v5:bad-restore'"))
      .rows[0].n, 0);
  } finally {
    await pg.query('update auth.current_identity set id=$1', [OWNER]);
  }
});

test('V5 restore preserves a completion tombstone without resurrecting it', async () => {
  await pg.query('update auth.current_identity set id=$1', [OTHER]);
  try {
    const source = (await pg.query('select rakeezx.sync_v2_backup_manifest_score_v2($1) result',
      [OTHER])).rows[0].result;
    const operations = [
      { entity: 'students', recordId: 'v5:tombstone-student', operation: 'create',
        baseRevision: 0, patch: { name: 'synthetic' }, clientUpdatedAt: 1 },
      { entity: 'score_subitem_completions', recordId: 'v5:deleted-completion',
        operation: 'create_deleted', baseRevision: 0,
        patch: { student_id: 'v5:tombstone-student', subitem_id: 'v5:subitem', checked: true },
        clientUpdatedAt: 1 },
    ];
    const hash = 'c'.repeat(64);
    const stage = (await pg.query(`select rakeezx.stage_sync_v2_restore_score_v2(
      $1,$2,5,$3::jsonb,$4::jsonb) result`, ['v5:tombstone-restore', hash,
      JSON.stringify(source), JSON.stringify(operations)])).rows[0].result;
    const final = (await pg.query('select rakeezx.finalize_sync_v2_restore_score_v2($1,$2,$3) result',
      ['v5:tombstone-restore', hash, stage.stageHash])).rows[0].result;
    const restored = final.canonical.score_subitem_completions.find((row) => row.id === 'v5:deleted-completion');
    assert.ok(restored.deleted_at);
    assert.equal((await pg.query("select count(*)::int n from rakeezx.scores where student_id='v5:tombstone-student'"))
      .rows[0].n, 0);
  } finally {
    await pg.query('update auth.current_identity set id=$1', [OWNER]);
  }
});
