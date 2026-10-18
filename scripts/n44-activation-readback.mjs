/** AI: OFFLINE verifier of metadata-only auditor JSON. No database/URL/secret argument. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const identity=row=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
export function verifyReadback(actual,expected) {
  assert.equal(actual.projectId,'xlrubcwjqktzzunrvuns');
  assert.equal(actual.personalRowsRead,0);assert.equal(actual.mode,'metadata-only');
  assert.ok(actual.capturedAt&&Date.parse(actual.capturedAt)>Date.parse('2026-10-18T03:39:31.082219Z'));
  assert.deepEqual(actual.identities,expected.identities,'Stop on any helper/role/grant/RLS/trigger/version identity drift');
  assert.equal(actual.migrationVersion,'20261018044448');assert.equal(actual.enabled,false);
  return 'N44 exact metadata-only identity readback matches; not device/hosted behavior proof';
}
if(process.argv[1]?.endsWith('n44-activation-readback.mjs')) {
  assert.equal(process.argv.length,4,'Usage: node scripts/n44-activation-readback.mjs actual-metadata.json approved-expected.json');
  console.log(verifyReadback(JSON.parse(await readFile(process.argv[2],'utf8')),JSON.parse(await readFile(process.argv[3],'utf8'))));
}
