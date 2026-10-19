// AI-authored N125: diagnostic output is finite even for hostile summary input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSyncOperationalSection } from '../../src/lib/sync-operational-ui.js';
const summary={state:'error',actionableSyncIssue:true,lastSafeFailure:{phase:'pull',code:'HTTP_503',event:'focus',elapsedMs:605,at:'2026-10-19T15:00:00.000Z',token:'secret',ownerId:'secret',payload:'pupil-secret'}};
test('existing Sync details expose only finite failure fields',()=>{
 const output=String(renderSyncOperationalSection(summary));
 assert.match(output,/pull \/ HTTP_503 \/ focus \/ 605ms/);
 assert.ok(!output.includes('secret'));
 for(const field of ['phase','code','event','at','elapsedMs']){
  const poisoned={...summary,lastSafeFailure:{...summary.lastSafeFailure,[field]:field==='elapsedMs'?Infinity:'pupil-secret'}};
  assert.ok(!String(renderSyncOperationalSection(poisoned)).includes('data-sync-safe-failure'));
 }
});
