import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lifecycleServer } from '../helpers/student-lifecycle-server.mjs';
import { buildAccountFoundationDefaults } from '../../src/lib/account-provisioning.js';
import { calendarPresetRecords, getCalendarPreset, GENERAL_1448_1449_PRESET_ID } from '../../src/lib/calendar-presets.js';

// Diagnostic regression: PASS proves the blocker, not N117 acceptance.
// Execute the repository's actual provisioning SQL in disposable local PGlite.
// Never connect to Supabase or alter the repository migration.
test('N117 service prerequisite: general initial foundation is rejected atomically by current provisioning contract', async () => {
  const owner = '22222222-2222-4222-8222-222222222222';
  const pg = await lifecycleServer({ migration32: true });
  try {
    await pg.exec(await readFile(new URL('../../supabase/migrations/20260924003436_beta_new_account_provisioning.sql', import.meta.url), 'utf8'));
    await pg.exec(await readFile(new URL('../../supabase/migrations/20261003000000_n03_education_department.sql', import.meta.url), 'utf8'));
    await pg.query('insert into auth.users(id) values($1)', [owner]);
    await pg.query('update auth.current_identity set id=$1', [owner]);
    await pg.exec('set role authenticated');
    const pending = (await pg.query('select rakeezx.provision_account_profile() result')).rows[0].result;
    assert.equal(pending.provisioning.state, 'PROFILE_REQUIRED');
    await pg.query("select rakeezx.complete_account_profile('Synthetic teacher','0500000001','masculine',null)");
    await pg.query('select rakeezx.begin_account_provisioning()');

    const defaults = buildAccountFoundationDefaults();
    const general = calendarPresetRecords(getCalendarPreset(GENERAL_1448_1449_PRESET_ID));
    const requested = { ...defaults, years: [general.year], calendars: [general.calendar],
      terms: general.terms, calendarDays: general.calendarDays };
    assert.equal(requested.calendars[0].source, 'preset:sa-general-1448-1449');
    await assert.rejects(pg.query('select rakeezx.provision_account_workspace($1::jsonb)',
      [JSON.stringify(requested)]), /Invalid foundation identity/);
    for (const table of ['years', 'calendars', 'terms', 'calendar_days', 'subjects', 'time_profiles', 'slots', 'sessions']) {
      assert.equal((await pg.query(`select count(*)::int n from rakeezx.${table} where owner_id=$1`, [owner])).rows[0].n, 0, `${table}: rejected foundation leaves no rows`);
    }
    const afterFailure = (await pg.query('select rakeezx.account_contract() result')).rows[0].result;
    assert.equal(afterFailure.provisioning.state, 'PROVISIONING');
    assert.equal(afterFailure.profile.educationDepartment, null, 'profile completion RPC has not persisted a department');

    // Positive control ensures the rejection is the preset constraint, not an
    // invalid owner, missing access, malformed foundation or fixture failure.
    const western = (await pg.query('select rakeezx.provision_account_workspace($1::jsonb) result',
      [JSON.stringify(defaults)])).rows[0].result;
    assert.equal(western.contract.provisioning.state, 'READY');
    const retry = (await pg.query('select rakeezx.provision_account_workspace($1::jsonb) result',
      [JSON.stringify(defaults)])).rows[0].result;
    assert.deepEqual(retry.snapshot, western.snapshot);
    assert.equal(retry.snapshot.years.length, 1);
    assert.equal(retry.snapshot.terms.length, 2);
    console.log('N117 diagnostic: general -> Invalid foundation identity; zero partial foundation; western control -> READY; retry unchanged.');
  } finally {
    await pg.exec('reset role');
    await pg.close();
  }
});
