import test from 'node:test';
import assert from 'node:assert/strict';
import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {} }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });
import { makeSection, sectionLabel, makeStudent, makeEnrollment, makeTeaching, makeSlot, makeSession, makeItem, autoAssignSectionColor, SECTION_COLORS } from '../src/models.js';
import * as store from '../src/store.js';

test('Section model and UI labels', (t) => {
  const sec = makeSection({ yearId: 'y1', grade: 4, label: 'أ' });
  assert.equal(sec.name, '4/أ');
  assert.equal(sec.grade, 4);
  assert.equal(sec.label, 'أ');
  assert.equal(sectionLabel(sec), 'الرابع الابتدائي / أ');
  assert.ok(sec.id.startsWith('sec:'), `Expected ID to start with 'sec:' but got: ${sec.id}`);
});

test('autoAssignSectionColor assigns least used or first available palette color with 16 curated colors', () => {
  assert.equal(SECTION_COLORS.length, 16, 'Canonical palette must contain exactly 16 colors');
  assert.equal(autoAssignSectionColor([]), SECTION_COLORS[0]);

  // 16 unique classes get 16 distinct colors without repetition
  const assigned = [];
  for (let i = 0; i < 16; i++) {
    const nextColor = autoAssignSectionColor(assigned);
    assert.equal(nextColor, SECTION_COLORS[i], `Class ${i + 1} should receive palette color ${i}`);
    assigned.push({ color: nextColor });
  }

  // 17th class re-uses least-used color (starts from SECTION_COLORS[0])
  const seventeenthColor = autoAssignSectionColor(assigned);
  assert.equal(seventeenthColor, SECTION_COLORS[0], '17th class should pick least used color');
});

test('Section editing preserves relationships and history', async (t) => {
  try {
    await store.init();
    const year = store.activeYear();
    const term = store.activeTerm();

    // Create section رابع / 1
    const sec = await store.createSection({ grade: 4, label: '1', yearId: year.id });
    const tch = await store.createTeaching({ sectionId: sec.id, subjectId: 'sub:math', termId: term.id });
    
    // Attach relations
    const st = makeStudent({ name: 'Test Student' });
    await store.upsert('students', st);
    const en = makeEnrollment({ studentId: st.id, sectionId: sec.id, yearId: year.id, rollNo: 1, status: 'active' });
    await store.upsert('enrollments', en);

    const slot = makeSlot({ teachingId: tch.id, weekday: 1, period: 1 });
    await store.upsert('slots', slot);
    
    const session = makeSession({ teachingId: tch.id, date: '2026-09-01', period: 1 });
    await store.upsert('sessions', session);
    
    const att = { id: `at:${st.id}:${session.id}`, studentId: st.id, sessionId: session.id, status: 'present' };
    await store.upsert('attendance', att);
    
    const item = makeItem({ teachingId: tch.id, name: 'Test Item', maxScore: 10 });
    await store.upsert('items', item);
    
    const score = { id: `sc:${st.id}:${item.id}`, studentId: st.id, itemId: item.id, score: 9 };
    await store.upsert('scores', score);

    // Edit section to رابع / 5
    await store.editSection(sec.id, { grade: 4, label: '5' });

    // Assert logical identity preserved
    const updated = store.getSection(sec.id);
    assert.equal(updated.name, '4/5');
    assert.equal(updated.grade, 4);
    assert.equal(updated.label, '5');

    // Assert no duplicate
    const allSections = store.sections();
    assert.equal(allSections.filter(s => s.id === sec.id).length, 1);
    assert.equal(allSections.filter(s => s.grade === 4 && s.label === '1').length, 0);

    // Assert relationships preserved
    const roster = store.sectionRoster(sec.id);
    assert.equal(roster.length, 1);
    assert.equal(roster[0].id, st.id);

    assert.equal(store.slotsOf(tch.id).length, 1);
    assert.equal(store.sessionsOf(tch.id).length, 1);
    assert.equal(store.attendanceOf(st.id).length, 1);
    assert.equal(store.scoresOf(st.id).length, 1);

    // Assert duplicate edit rejection
    const sec2 = await store.createSection({ grade: 4, label: '6', yearId: year.id });
    await assert.rejects(
      store.editSection(sec.id, { grade: 4, label: '6' }),
      /موجود مسبق/
    );
  } catch (err) {
    console.error("TEST FAILED WITH ERROR:", err);
    throw err;
  } finally {
    store.closeChannel();
    const db = await import('../src/lib/db.js');
    db.closeDB();
  }
});
