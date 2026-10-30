import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateManifest, selectionGuardSql, rollbackProbeSql, compareProtected, PROJECT, AUTHORITY } from '../scripts/n148-test-account-cleanup.mjs';

function fixture() {
  const ids = Array.from({length:56}, (_,i) => `00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
  return { projectId:PROJECT, authorityRef:AUTHORITY, allCount:56, targetIds:ids.slice(0,50), keepIds:ids.slice(50),
    exceptionId:ids[50], keepEmail:'exception@n148-unit-fixture.test', deleteDomains:['a.fixture.test','b.fixture.test','c.fixture.test','d.fixture.test'],
    deleteEmails:Array.from({length:5},(_,i)=>`test${i}@n148-unit-fixture.test`), expectedTargetStudentRows:2149, expectedKeptStudentRows:927 };
}
const validate = m => { const bytes = Buffer.from(JSON.stringify(m)); return validateManifest(bytes,createHash('sha256').update(bytes).digest('hex')); };

test('exact partition, exception, project and pinned digest fail closed', () => {
  assert.equal(validate(fixture()).targetIds.length,50);
  for (const mutate of [m=>m.targetIds[0]=m.exceptionId,m=>m.keepIds[0]=m.keepIds[1],m=>m.exceptionId=m.targetIds[0],
    m=>m.projectId='other',m=>m.authorityRef='other',m=>m.targetIds.pop(),m=>m.expectedKeptStudentRows=0]) {
    const m=fixture(); mutate(m); assert.throws(()=>validate(m));
  }
  assert.throws(()=>validateManifest(Buffer.from(JSON.stringify(fixture()))));
});

test('SQL ties selectors and exception to exact live IDs; probe cannot commit', () => {
  const m=fixture(), sql=selectionGuardSql(m), probe=rollbackProbeSql(m);
  assert.match(sql,/is distinct from \(id::text in/);
  assert.ok(sql.includes(m.exceptionId) && sql.includes(m.keepEmail));
  assert.match(probe,/begin isolation level serializable/);
  assert.match(probe,/delete from n88_private\.numeric_credentials where owner_id::text in/);
  assert.match(probe,/rollback;$/);
  assert.doesNotMatch(probe,/\bcommit\b|disable|truncate|alter table|session_replication_role/i);
});

test('protected comparison detects counts, fingerprint and missing-table changes', () => {
  const before=[{tbl:'sample',total:3,targets:1,protected_count:2,protected_fingerprint:'abc'}];
  assert.equal(compareProtected(before,structuredClone(before)),true);
  for(const patch of [{total:2},{targets:0},{protected_count:1},{protected_fingerprint:'changed'}]) {
    assert.equal(compareProtected(before,[{...before[0],...patch}]),false);
  }
  assert.equal(compareProtected(before,[]),false);
});
