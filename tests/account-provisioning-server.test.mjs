import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lifecycleServer } from './helpers/student-lifecycle-server.mjs';
import { buildAccountFoundationDefaults } from '../src/lib/account-provisioning.js';

const OWNER = '22222222-2222-4222-8222-222222222222';
const migration = await readFile(new URL('../supabase/migrations/20260924003436_beta_new_account_provisioning.sql', import.meta.url), 'utf8');

async function fixture() {
  const pg = await lifecycleServer({ migration32: true });
  await pg.exec(migration);
  await pg.exec(`select pg_catalog.set_config('rakeezx.profile_completion','ready',false);
    insert into rakeezx.profile(owner_id,teacher_name,phone,profile_status)
      values('11111111-1111-4111-8111-111111111111','Existing Teacher','0500000002','READY');
    select pg_catalog.set_config('rakeezx.profile_completion','',false);
    insert into auth.users(id) values('${OWNER}');
    update auth.current_identity set id='${OWNER}';`);
  return pg;
}

test('new owner moves through profile, provisioning and one atomic foundation', async () => {
  const pg = await fixture();
  try {
    await pg.exec('set role authenticated');
    const pending = (await pg.query('select rakeezx.provision_account_profile() result')).rows[0].result;
    assert.equal(pending.provisioning.state, 'PROFILE_REQUIRED');
    assert.equal(pending.profileStatus, 'PENDING_PROFILE');
    await assert.rejects(pg.query(`select rakeezx.complete_account_profile('Teacher','059','masculine',null)`), /Invalid Saudi mobile/);
    const profile = (await pg.query(`select rakeezx.complete_account_profile('Teacher','0500000001','masculine',null) result`)).rows[0].result;
    assert.equal(profile.provisioning.state, 'PROVISIONING_REQUIRED');
    assert.equal(profile.profileStatus, 'READY');
    const begun = (await pg.query('select rakeezx.begin_account_provisioning() result')).rows[0].result;
    assert.equal(begun.provisioning.state, 'PROVISIONING');
    const defaults = JSON.stringify(buildAccountFoundationDefaults());
    const invalid = buildAccountFoundationDefaults();
    invalid.calendarDays[0] = { ...invalid.calendarDays[0], id: 'wrong-day-id' };
    await assert.rejects(pg.query('select rakeezx.provision_account_workspace($1::jsonb)',
      [JSON.stringify(invalid)]), /Invalid calendar day identity/);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.years where owner_id='${OWNER}'`)).rows[0].n, 0);
    assert.equal((await pg.query('select rakeezx.account_contract() result')).rows[0].result.provisioning.state,
      'PROVISIONING');
    await assert.rejects(pg.query(`update rakeezx.profile set provisioning_state='READY' where owner_id='${OWNER}'`),
      /server controlled/);
    await pg.query("select pg_catalog.set_config('rakeezx.account_provisioning_control','allow',false)");
    await assert.rejects(pg.query(`update rakeezx.profile set provisioning_state='READY' where owner_id='${OWNER}'`),
      /server controlled/, 'a client-controlled custom GUC cannot forge READY');
    await pg.query("select pg_catalog.set_config('rakeezx.account_provisioning_control','',false)");
    const ready = (await pg.query('select rakeezx.provision_account_workspace($1::jsonb) result', [defaults])).rows[0].result;
    assert.equal(ready.contract.provisioning.state, 'READY');
    assert.equal(ready.snapshot.years.length, 1);
    assert.equal(ready.snapshot.terms.length, 2);
    assert.equal(ready.snapshot.subjects.length, 1);
    assert.equal(ready.snapshot.time_profiles.length, 4);
    assert.ok(ready.snapshot.calendar_days.length > 0);
    const again = (await pg.query('select rakeezx.provision_account_workspace($1::jsonb) result', [defaults])).rows[0].result;
    assert.deepEqual(again.snapshot, ready.snapshot);
    assert.equal(again.contract.provisioning.foundationHash, ready.contract.provisioning.foundationHash);
    for (const table of ['sections','students','enrollments','slots','sessions','attendance','scores','items']) {
      assert.equal((await pg.query(`select count(*)::int n from rakeezx.${table} where owner_id='${OWNER}'`)).rows[0].n, 0);
    }
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.account_access_grants where owner_id='${OWNER}'`)).rows[0].n, 1);
  } finally { await pg.exec('reset role'); await pg.close(); }
});

test('existing owner is not silently enrolled into fresh provisioning', async () => {
  const pg = await fixture();
  try {
    await pg.exec(`update auth.current_identity set id='11111111-1111-4111-8111-111111111111'; set role authenticated;`);
    const existing = (await pg.query('select rakeezx.provision_account_profile() result')).rows[0].result;
    assert.equal(existing.provisioning, null);
    await assert.rejects(pg.query('select rakeezx.begin_account_provisioning()'), /not a fresh provisioning candidate/);
  } finally { await pg.exec('reset role'); await pg.close(); }
});

test('anon cannot invoke owner provisioning or read owner checkpoint', async () => {
  const pg = await fixture();
  try {
    await pg.exec('set role anon');
    await assert.rejects(pg.query('select rakeezx.begin_account_provisioning()'));
    await assert.rejects(pg.query('select rakeezx.account_provisioning_snapshot()'));
  } finally { await pg.exec('reset role'); await pg.close(); }
});

test('one owner cannot activate or read another owner provisioning state', async () => {
  const pg = await fixture();
  try {
    await pg.exec('set role authenticated');
    await pg.query('select rakeezx.provision_account_profile()');
    await pg.query(`select rakeezx.complete_account_profile('Teacher','0500000001','feminine',null)`);
    await pg.query('select rakeezx.begin_account_provisioning()');
    await pg.query('select rakeezx.provision_account_workspace($1::jsonb)',
      [JSON.stringify(buildAccountFoundationDefaults())]);
    await pg.exec('reset role');
    await pg.exec(`update auth.current_identity set id='11111111-1111-4111-8111-111111111111'; set role authenticated;`);
    assert.equal((await pg.query('select rakeezx.account_contract() result')).rows[0].result.provisioning, null);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.years where owner_id='${OWNER}'`)).rows[0].n, 0);
    await assert.rejects(pg.query('select rakeezx.account_provisioning_snapshot()'), /not ready/);
  } finally { await pg.exec('reset role'); await pg.close(); }
});
