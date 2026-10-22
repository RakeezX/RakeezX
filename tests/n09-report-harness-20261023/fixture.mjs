// AI-authored: fabricated local report read model, never account provisioning.
import assert from 'node:assert/strict';
import * as db from '../../src/lib/db.js';
import * as store from '../../src/store.js';
import { makeYear, makeTerm, makeDevice } from '../../src/models.js';
import { activateSyntheticAccountWorkspace, SYNTHETIC_WORKSPACE_OWNER } from '../helpers/synthetic-workspace.mjs';

export async function reportContext({ ownerId = SYNTHETIC_WORKSPACE_OWNER } = {}) {
  db.closeDB();
  await activateSyntheticAccountWorkspace({ ownerId });
  await db.clearAll();
  const own = row => ({ ...row, ownerId, canonicalId: row.id, serverRevision: 1 });
  const year = own(makeYear({ id: 'n09-report-year', hijriStart: 1470, label: '1470–1471 هـ' }));
  const term = own(makeTerm({ id: 'n09-report-term', yearId: year.id,
    startDate: '2026-08-01', endDate: '2026-12-31' }));
  await db.putAcross({ years: [year], terms: [term], device: [makeDevice({
    activeYearId: year.id, activeTermId: term.id,
  })] });
  await store.init();
  assert.equal(store.activeYear()?.id, year.id);
  assert.equal(store.activeTerm()?.id, term.id);
  assert.equal(store.activeTerm()?.yearId, year.id);
  assert.equal(store.getYear(year.id).ownerId, ownerId);
  // Hydrate fabricated server rows; this test does not exercise write commands.
  const save = async batch => {
    await db.putAcross(Object.fromEntries(Object.entries(batch)
      .map(([name, rows]) => [name, rows.map(own)])));
    await store.init();
  };
  return { year, term, save };
}
