import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attendanceEvidenceProjection, validEvidenceDate } from '../src/lib/attendance-evidence.js';

test('Cloudflare raw-ESM route links CSS without importing text/css as JavaScript', () => {
  const source = readFileSync(new URL('../src/views/attendance-evidence.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s+['"][^'"]+\.css['"]\s*;?\s*$/m);
  assert.match(source, /link\.rel = 'stylesheet'/);
  assert.match(source, /ensureAttendanceEvidenceStyles\(\)/);
});

const t1 = { id: 'test-teaching-1' }, t2 = { id: 'test-teaching-2' };
const row = (id, date, recorded, expected, state = 'completed', teaching = t1, status = 'held') => ({
  session: { id, date, period: Number(id.match(/\d+$/)?.[0] || 1), status },
  teaching, completeness: { state, recorded, expected },
});
const report = (...rows) => ({ teachings: [t1, t2], rows });

test('read-only projection uses only actual, scoped, dated attendance records', () => {
  const input = report(
    row('a1','2026-10-12', 25,25),
    row('a2','2026-10-13', 20,25,'pending'),
    row('a3','2026-10-14', 0,25,'pending'),
    row('a4','2026-10-15', 0,25,'future'),
    row('a5','2026-10-16', 25,25,'excluded'),
    row('a6','2026-10-17', 25,25,'completed', t2),
  );
  const before=structuredClone(input);
  const r=attendanceEvidenceProjection(input,{teachingId:t1.id});
  assert.equal(r.sourceSessions,4);
  assert.equal(r.recordedSessions,2);
  assert.equal(r.fullSessions,1);
  assert.equal(r.partialSessions,1);
  assert.equal(r.recordedMarks,45);
  assert.equal(r.expectedMarks,50);
  assert.equal(r.recordingPercent,90);
  assert.equal(r.pendingUnrecorded,1);
  assert.deepEqual(r.rows.map(x=>x.id),['a2','a1']);
  assert.equal(JSON.stringify(input),JSON.stringify(before),'projection must not alter stored rows');
});

test('no scheduled session, excluded session or no-record session is treated as recorded work', () => {
  const input=report(row('a1','2026-10-12',0,25,'pending'),row('a2','2026-10-14',0,25,'future'),row('a3','2026-10-15',3,25,'excluded'));
  const r=attendanceEvidenceProjection(input,{teachingId:t1.id});
  assert.equal(r.recordedSessions,0);
  assert.equal(r.recordingPercent,null);
  assert.equal(r.pendingUnrecorded,1);
});

test('date filters enforce range and do not silently include other dates or classes', () => {
  const input=report(row('a1','2026-10-12',25,25),row('a2','2026-10-13',20,25,'pending'),row('a3','2026-10-14',25,25));
  const r=attendanceEvidenceProjection(input,{teachingId:t1.id,from:'2026-10-13',to:'2026-10-13'});
  assert.deepEqual(r.rows.map(x=>x.id),['a2']);
  assert.equal(r.recordingPercent,80);
  assert.equal(attendanceEvidenceProjection(input,{teachingId:'different'}).error,'teaching');
});

test('malformed or backwards dates do not become an exportable evidence scope', () => {
  assert.equal(validEvidenceDate('2026-02-29'),false);
  assert.equal(validEvidenceDate('2026-02-28'),true);
  assert.equal(validEvidenceDate('2026-13-01'),false);
  const input=report(row('a1','2026-10-12',25,25));
  for(const [from,to] of [['2026-10-20','2026-10-01'],['bad',''],['','2026-02-29']]) {
    const r=attendanceEvidenceProjection(input,{teachingId:t1.id,from,to});
    assert.equal(r.error,'dates'); assert.equal(r.rows.length,0);
  }
});

test('duplicates, overcounts and invalid roster sizes never inflate documented marks', () => {
  const input=report(row('a1','2026-10-12',25,25),row('a1','2026-10-12',25,25),row('a2','2026-10-13',27,25),row('a3','2026-10-14',2,0));
  const r=attendanceEvidenceProjection(input,{teachingId:t1.id});
  assert.equal(r.recordedSessions,1);
  assert.equal(r.recordedMarks,25);
  assert.equal(r.anomalies,3);
});

test('full marks have attendance recorded even before scheduled deadline; never conflate attendance with presence', () => {
  const input=report(row('a1','2026-10-12',5,5,'completed'),row('a2','2026-10-13',1,5,'future'));
  const r=attendanceEvidenceProjection(input,{teachingId:t1.id});
  assert.equal(r.recordedSessions,2);
  assert.equal(r.fullSessions,1);
  assert.equal(r.partialSessions,1);
  assert.equal(r.recordingPercent,60);
  assert.equal(Object.keys(r.rows[0]).includes('presentStudents'),false);
});