import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSection, sectionLabel } from '../src/models.js';

test('Section model and UI labels', (t) => {
  const sec = makeSection({ yearId: 'y1', grade: 4, label: 'أ' });

  // 1. Internal representation stays compatible
  //    name = grade/label (stored as-is for sync identity)
  assert.equal(sec.name, '4/أ');
  assert.equal(sec.grade, 4);
  assert.equal(sec.label, 'أ');

  // 2. User-facing labels render full Arabic
  assert.equal(sectionLabel(sec), 'الرابع الابتدائي / أ');

  // 3. Sync identity is stable — ID format is sec:<uid>
  //    This MUST remain stable across versions (changing it would break sync identity)
  assert.ok(sec.id.startsWith('sec:'), `Expected ID to start with 'sec:' but got: ${sec.id}`);
});