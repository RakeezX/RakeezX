/** AI-authored: affected pure contract/privacy/UNKNOWN failure tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { proposePublicationRows as propose, decidePublication as decide, publicationCommand, reconcilePublication as reconcile, projectStudentFixture as project } from '../../src/lib/n88-item-publication-proposal.js';
import { safeTeacherLink, manualTaskDraft } from '../../src/lib/n88-manual-task-link-safety.js';
import { fixture, scope, membership, publication } from './fixture.mjs';
import { fixtureCustodian } from './fixture-custodian.mjs';
import { readFile } from 'node:fs/promises';
const reconcilePublication = (command, scope, receipt, fresh) => reconcile(command, scope, receipt, fresh, command.binding);

test('n88_v2_existing_distribution_items_proposed_but_default_private_with_dates', () => {
  const source = fixture(), before = JSON.stringify(source);
  const draft = propose(source);
  assert.equal(JSON.stringify(source), before);
  assert.equal(draft.rows.length, 3);
  assert.deepEqual(draft.rows[0].decisions, { required: false, scheduled: false, completed: false, grade: false });
  assert.equal(draft.rows[0].startDate, '2026-10-26'); assert.equal(draft.rows[0].dueDate, '2026-10-30');
  assert.equal(draft.rows[1].startDate, null); assert.equal(draft.rows[1].dueDate, null);
  const chosen = decide(draft, scope, draft.rows[0].id, 'required', true);
  assert.equal(draft.rows[0].decisions.required, false);
  assert.equal(propose({ ...source, previous: chosen }).rows[0].decisions.required, true);
  source.data.scoreSubitems[0].name = 'الاسم المصحح';
  let next = propose({ ...source, previous: chosen });
  assert.equal(next.rows[0].id, draft.rows[0].id); assert.equal(next.rows[0].title, 'الاسم المصحح');
  assert.equal(next.rows[0].decisions.required, false);
  source.data.scoreSubitems[0].deleted = true;
  source.data.scoreSubitems.push({ ...source.data.scoreSubitems[1], id: 'third', name: 'عمل جديد' });
  next = propose({ ...source, previous: chosen });
  assert(!next.rows.some(r => r.sourceId === 'first'));
  assert(next.rows.every(r => Object.values(r.decisions).every(v => v === false)));
  source.data.scoreSubitems[1].dueDate = '2026-02-30';
  assert.throws(() => propose(source));
});

test('n88_v2_grade_item_visibility_independent_and_no_cross_owner_data', () => {
  for (const count of [0, 1, 30, 50]) {
    const source = fixture(count), draft = propose(source), first = draft.rows[0], second = draft.rows[1];
    const workOnly = decide(draft, scope, first.id, 'required', true);
    const gradeOnly = decide(workOnly, scope, second.id, 'grade', true);
    assert.equal(gradeOnly.rows[0].decisions.grade, false);
    assert.equal(gradeOnly.rows[1].decisions.required, false);
    let projections = 0;
    for (const student of source.data.students) {
      const m = membership(student.id);
      const grades = draft.rows.map((r, i) => ({ scope, rowId: r.id, sourceRevision: r.sourceRevision, studentId: student.id, enrollmentId: m.enrollmentId, value: i + 1 }));
      // Legacy coarse flags and local draft decisions alone disclose nothing.
      assert.deepEqual(project({ scope, draft: gradeOnly, membership: m, publications: [], grades, legacyVisibility: { grades: true } }), { work: [], grades: [] });
      const publications = gradeOnly.rows.map(publication);
      const result = project({ scope, draft, membership: m, publications, grades });
      assert.equal(result.work.length, 1); assert.equal(result.grades.length, 1);
      assert.equal(result.grades[0].id, second.id);
      assert(!JSON.stringify(result).includes('total'));
      for (const key of ['ownerId', 'teachingId', 'sectionId', 'termId', 'subjectId']) {
        assert.throws(() => project({ scope: { ...scope, [key]: 'other' }, draft, membership: m, publications, grades }));
        const foreign = publications.map(p => ({ ...p, scope: { ...scope, [key]: 'other' } }));
        assert.deepEqual(project({ scope, draft, membership: m, publications: foreign, grades }), { work: [], grades: [] });
      }
      const tombstones = publications.map(p => ({ ...p, tombstone: true }));
      assert.deepEqual(project({ scope, draft, membership: m, publications: tombstones, grades }), { work: [], grades: [] });
      const stale = publications.map(p => ({ ...p, sourceRevision: 'old' }));
      assert.deepEqual(project({ scope, draft, membership: m, publications: stale, grades }), { work: [], grades: [] });
      assert.equal(project({ scope, draft, membership: m, publications, grades: grades.map(g => ({ ...g, studentId: 'another' })) }).grades.length, 0);
      projections++;
    }
    assert.equal(projections, count);
  }
  const source = fixture(), draft = propose(source);
  const chosen = decide(draft, scope, draft.rows[0].id, 'grade', true);
  source.scope.ownerId = 'other'; source.data.ownerId = 'other';
  source.data.teachings.forEach(r => { r.ownerId = 'other'; }); source.data.sections.forEach(r => { r.ownerId = 'other'; }); source.data.terms.forEach(r => { r.ownerId = 'other'; });
  assert.equal(propose({ ...source, previous: chosen }).rows.length, 0);
  assert.throws(() => decide(chosen, source.scope, chosen.rows[0].id, 'grade', true));
  source.data.items.forEach(r => { r.ownerId = 'other'; }); source.data.scoreSubitems.forEach(r => { r.ownerId = 'other'; });
  assert(propose({ ...source, previous: chosen }).rows.every(r => Object.values(r.decisions).every(v => v === false)));
  for (const key of ['sectionId', 'termId', 'subjectId']) assert.throws(() => propose({ ...fixture(), scope: { ...scope, [key]: 'other' } }));
});

test('n88_v2_https_teacher_manual_links_and_scheduled_tasks_validate', () => {
  assert.equal(safeTeacherLink('https://example.test/lesson?q=1#test'), 'https://example.test/lesson?q=1#test');
  for (const bad of ['http://example.test', 'javascript:alert(1)', 'data:text/html,x', 'file:///x', '//example.test', 'https://a:b@example.test', 'https://@example.test', 'https://example.test/\n', 'https://example.test/%0a', 'https://example.test/\\x', ' https://example.test', 'https://example.test/' + 'a'.repeat(2048)]) assert.throws(() => safeTeacherLink(bad), bad);
  const task = manualTaskDraft({ id: 'manual', title: 'مهمة المعلم', description: '<b>نص فقط</b>', startDate: '٢٠٢٦-١٠-٢٨', dueDate: '', link: 'https://example.test/exam' }, new Date('2026-10-28'));
  assert.equal(task.startDate, '2026-10-28'); assert.equal(task.dueDate, null);
  assert.throws(() => manualTaskDraft({ ...task, dueDate: '2026-10-27' }));
  assert.throws(() => manualTaskDraft({ ...task, dueDate: '2099-01-01' }, new Date('2026-10-28')));
  const draft = propose({ ...fixture(), manualTasks: [{ ...task, scope }] }), manual = draft.rows.at(-1);
  assert(Object.values(manual.decisions).every(v => v === false));
  assert.throws(() => decide(draft, scope, manual.id, 'grade', true));
  assert.throws(() => propose({ ...fixture(), manualTasks: [{ ...task, scope: { ...scope, termId: 'other' } }] }));
  const selected = decide(draft, scope, manual.id, 'scheduled', true);
  const result = project({ scope, draft: selected, membership: membership(), publications: selected.rows.map(publication) });
  assert.equal(result.work[0].link, task.link); assert.equal(result.grades.length, 0);
});

test('V2 CAS envelope, unique per-row revision, unknown ACK and fresh reconciliation never retry', () => {
  const draft = propose(fixture());
  const command = publicationCommand({ draft: decide(draft, scope, draft.rows[0].id, 'grade', true), scope, rowId: draft.rows[0].id,
    requestId: 'fake-request-000001', expectedPublicationRevision: 4, expectedMembershipRevision: 'roster-1',
    binding: { sessionId: 'fake-session', leaseId: 'fake-lease', contextRevision: 'context-1' } });
  assert.equal(command.expectedPublicationRevision, 4); assert.equal(command.decisions.grade, true);
  const receipt = { version: 2, scope, binding: { ...command.binding }, requestId: command.requestId, rowId: command.rowId, sourceRevision: command.expectedSourceRevision, state: 'applied', publicationRevision: 5 };
  const fresh = { ...receipt, fresh: true, membershipRevision: 'roster-1', decisions: { ...command.decisions } };
  assert.deepEqual(reconcilePublication(command, scope, receipt, fresh), { state: 'confirmed', retry: false, publicationRevision: 5 });
  assert.equal(reconcilePublication(command, scope, null, fresh).state, 'unknown');
  assert.equal(reconcilePublication(command, scope, receipt, null).state, 'unknown');
  for (const patch of [{ publicationRevision: 6 }, { requestId: 'another' }, { sourceRevision: 'stale' }, { binding: { ...command.binding, leaseId: 'different' } }, { fresh: false }, { membershipRevision: 'new-roster' }, { decisions: { ...command.decisions, grade: false } }]) assert.equal(reconcilePublication(command, scope, receipt, { ...fresh, ...patch }).state, 'unknown');
  assert.equal(reconcile(command, scope, receipt, fresh, { ...command.binding, sessionId: 'new-session' }).state, 'blocked');
  assert.equal(reconcile(command, scope, receipt, fresh).state, 'blocked');
  assert.deepEqual(reconcilePublication(command, { ...scope, ownerId: 'other' }, receipt, fresh), { state: 'blocked', retry: false });
  const rejected = { ...receipt, state: 'rejected', publicationRevision: 4 };
  assert.deepEqual(reconcilePublication(command, scope, rejected, { ...fresh, state: 'rejected', publicationRevision: 4 }), { state: 'rejected', retry: false });
  assert.equal(reconcilePublication(command, scope, { ...receipt, unexpected: true }, fresh).state, 'unknown');
  for (const key of ['expectedPublicationRevision', 'expectedMembershipRevision', 'binding']) {
    assert.throws(() => publicationCommand({ ...command, draft, scope, rowId: draft.rows[0].id, [key]: null }));
  }
});

test('synthetic custodian models CAS, replay identity and independent revisions; no real service claim', () => {
  const draft = propose(fixture()), service = fixtureCustodian(draft);
  const command = row => publicationCommand({ draft, scope, rowId: row.id, requestId: `request-${row.sourceId}-000001`,
    expectedPublicationRevision: 0, expectedMembershipRevision: 'roster-1', binding: { sessionId: 'fake-session', leaseId: 'fake-lease', contextRevision: 'context-1' } });
  const first = command(draft.rows[0]), second = command(draft.rows[1]);
  // Model an applied command whose ACK was lost; only lookup + fresh read resolves it.
  const receipt = service.apply(first);
  assert.equal(reconcilePublication(first, scope, null, service.read(first.rowId)).state, 'unknown');
  assert.equal(reconcilePublication(first, scope, receipt, service.read(first.rowId)).state, 'confirmed');
  assert.deepEqual(service.apply(first), receipt); // server deduplicates; client still must not resend UNKNOWN.
  assert.equal(service.read(first.rowId).publicationRevision, 1);
  assert.equal(service.apply(second).publicationRevision, 1); // independent per-item revision.
  assert.throws(() => service.apply({ ...first, decisions: { ...first.decisions, grade: true } }), /idempotency_conflict/);
  assert.throws(() => service.apply(first, false), /not_authorized/);
  assert.throws(() => service.apply({ ...first, requestId: 'new-request-000001' }), /cas_conflict/);
  service.roster('roster-2');
  assert.throws(() => service.apply({ ...first, requestId: 'new-request-000002', expectedPublicationRevision: 1 }), /cas_conflict/);
  service.roster('roster-1');
  const changed = structuredClone(draft); changed.rows[0].sourceRevision = 'changed'; service.source(changed);
  assert.throws(() => service.apply({ ...first, requestId: 'new-request-000003', expectedPublicationRevision: 1 }), /cas_conflict/);
});

test('inactive modules have no live account/store/transport imports or operations', async () => {
  const files = ['src/lib/n88-item-publication-proposal.js', 'src/lib/n88-manual-task-link-safety.js', 'drafts/n88-student-portal/publication-v2-review.inactive.mjs'];
  for (const file of files) {
    const source = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    assert(!/\b(fetch|XMLHttpRequest|WebSocket|localStorage|indexedDB|sessionStorage)\b/.test(source), file);
    assert(!/from\s+['"][^'"]*(store|cloud|student-portal|router|supabase)/.test(source), file);
  }
  const app = await readFile(new URL('../../src/app.js', import.meta.url), 'utf8');
  assert(!app.includes('publication-v2-review')); assert(!app.includes('n88-item-publication-proposal'));
});
