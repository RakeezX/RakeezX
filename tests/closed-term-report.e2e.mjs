import { test, expect } from '@playwright/test';

test('closed-term Archive reads only the immutable report set, including offline', async ({ page, context }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !/WebSocket connection|\[vite\]|Failed to send error to Vite server/.test(text)) errors.push(text);
  });
  await page.goto('/#/archive');
  await page.waitForFunction(() => window.store?.state?.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready && !!navigator.serviceWorker.controller);
  await page.evaluate(async () => {
    const a = (record) => ({ ...record, canonicalId: record.id, serverRevision: 1, fieldRevisions: { all: 1 } });
    await window.store.patch('profile', 'profile', { teacherName: 'معلم مؤرشف', serverRevision: 1 }, null, { queue: false });
    const year = a({ id: 'e2e:closed:year', label: '1470-1471', hijriStart: 1470, hijriEnd: 1471, order: 9, status: 'active', deleted: false });
    const term = a({ id: 'e2e:closed:term', yearId: year.id, index: 1, name: 'فصل مغلق ثابت', status: 'active', deleted: false });
    const subject = a({ id: 'e2e:closed:subject', name: 'رياضيات ثابتة', slug: 'e2e-closed-math', deleted: false });
    const section = a({ id: 'e2e:closed:section', yearId: year.id, grade: 5, label: 'أ', name: 'الخامس أ', color: '#0f766e', order: 0, status: 'active', archivedAt: null, archiveDate: null, deleted: false });
    const teaching = a({ id: 'e2e:closed:teaching', sectionId: section.id, subjectId: subject.id, termId: term.id, order: 0, deleted: false });
    const student = a({ id: 'e2e:closed:student', name: 'طالب الحقيقة الثابتة', status: 'active', note: '', deleted: false });
    const enrollment = a({ id: 'e2e:closed:enrollment', studentId: student.id, sectionId: section.id, rollNo: 4, startDate: '2026-08-01', endDate: null, status: 'active', transferNote: '', deleted: false });
    const item = a({ id: 'e2e:closed:item', teachingId: teaching.id, name: 'واجب ثابت', max: 10, order: 0, auto: null, perPoint: 1, penalty: 1, unitId: null, lessonId: null, deleted: false });
    const score = a({ id: 'e2e:closed:score', studentId: student.id, itemId: item.id, value: 9, deleted: false });
    const session = a({ id: 'e2e:closed:session', teachingId: teaching.id, date: '2026-09-08', period: 2, startTime: '08:00', endTime: '08:45', status: 'held', reason: '', slotId: null, timeProfileId: null, makeupForId: null, lessonId: null, note: '', homework: '', covered: '', deleted: false });
    const rosterSnapshot = a({ id: 'e2e:closed:roster', sessionId: session.id, teachingId: teaching.id, sectionId: section.id, capturedAt: 1, members: [{ studentId: student.id, rollNo: 4 }], state: 'complete', deleted: false });
    const attendance = a({ id: 'e2e:closed:attendance', studentId: student.id, sessionId: session.id, teachingId: teaching.id, date: session.date, status: 'present', note: '', deleted: false });
    await window.store.save({ years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching], students: [student], enrollments: [enrollment], items: [item], scores: [score], sessions: [session], sessionRosterSnapshots: [rosterSnapshot], attendance: [attendance] }, { queue: false });
    const payload = window.store.buildClosedTermReportPayload(term.id);
    const report = a({ id: 'e2e:closed:report', termId: term.id, yearId: year.id, version: 1, supersedesId: null,
      sourceManifest: window.store.closedTermSourceManifest(term.id), payload, state: 'complete', createdAt: 1, deleted: false });
    await window.store.save({ closedTermReports: [report] }, { queue: false });
    await window.store.patch('terms', term.id, { status: 'closed' }, null, { queue: false });
    await window.store.patch('sections', section.id, {
      status: 'archived',
      archivedAt: 1,
      archiveDate: '2026-09-09',
    }, null, { queue: false });
    await window.store.patch('students', student.id, { name: 'اسم حي لا يجب عرضه' }, null, { queue: false });
    await window.store.patch('items', item.id, { name: 'بند حي لا يجب عرضه' }, null, { queue: false });
    await window.store.patch('scores', score.id, { value: 1 }, null, { queue: false });
    await window.store.patch('sessions', session.id, { startTime: '12:00' }, null, { queue: false });
    window.store.repaint();
  });

  await page.goto('/#/archive/year/e2e%3Aclosed%3Ayear/term/e2e%3Aclosed%3Aterm');
  await expect(page.getByText('تقارير ثابتة')).toBeVisible();
  await expect(page.getByText('الإصدار 1')).toBeVisible();
  await page.getByRole('link', { name: /الخامس الابتدائي \/ أ/ }).click();
  await expect(page).toHaveURL(/teaching\/.*closed.*teaching\/reports/);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready);
  await expect(page.locator('.print-report')).toContainText('طالب الحقيقة الثابتة');
  await expect(page.locator('.print-report')).toContainText('واجب ثابت');
  await expect(page.locator('.print-report')).toContainText('9');
  await expect(page.locator('.print-report')).not.toContainText('اسم حي لا يجب عرضه');
  await expect(page.locator('.print-report')).not.toContainText('بند حي لا يجب عرضه');
  await page.getByRole('button', { name: 'الحضور' }).click();
  await expect(page.locator('.print-report')).toContainText('طالب الحقيقة الثابتة');
  expect(errors).toEqual([]);
});
