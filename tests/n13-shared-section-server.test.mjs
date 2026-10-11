import test from 'node:test';
import assert from 'node:assert/strict';
import { academicFixture, lifecycleServer, OWNER } from './helpers/student-lifecycle-server.mjs';

const OTHER = '22222222-2222-4222-8222-222222222222';

test('N13 existing Teaching RPC keeps one roster and rejects another owner or invalid subject', async () => {
  const pg = await lifecycleServer({ migration29: false, migration30: false });
  try {
    const f = await academicFixture(pg, 'n13');
    await pg.query(`insert into rakeezx.subjects(id,name,slug) values('subject:n13:second','Second','n13-second')`);
    const itemIds = JSON.stringify([0, 1, 2, 3, 4].map((index) => `item:n13:second:${index}`));
    const create = () => pg.query(`select rakeezx.apply_sync_v2_teaching_creation_command(
      'mutation:n13:second','device:n13','teaching:n13:second',$1,'subject:n13:second',$2,1,$3::jsonb,100) result`,
      [f.section, f.term, itemIds]);
    const created = (await create()).rows[0].result;
    assert.equal(created.canonicalTeaching.section_id, f.section);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.sections where owner_id=$1 and id=$2`, [OWNER, f.section])).rows[0].n, 1);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.enrollments where owner_id=$1 and section_id=$2`, [OWNER, f.section])).rows[0].n, 1);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.teachings where owner_id=$1 and section_id=$2 and deleted_at is null`, [OWNER, f.section])).rows[0].n, 2);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.items where owner_id=$1 and teaching_id='teaching:n13:second'`, [OWNER])).rows[0].n, 5);

    await assert.rejects(pg.query(`select rakeezx.apply_sync_v2_teaching_creation_command(
      'mutation:n13:invalid','device:n13','teaching:n13:invalid',$1,'subject:missing',$2,1,$3::jsonb,100)`,
      [f.section, f.term, itemIds]), /subject is unavailable/i);
    await pg.query(`insert into auth.users(id) values($1)`, [OTHER]);
    await pg.query(`update auth.current_identity set id=$1`, [OTHER]);
    await assert.rejects(create(), /section is unavailable/i);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.teachings where owner_id=$1`, [OTHER])).rows[0].n, 0);
    assert.equal((await pg.query(`select count(*)::int n from rakeezx.sync_mutation_receipts where owner_id=$1`, [OTHER])).rows[0].n, 0);
  } finally {
    await pg.close();
  }
});
