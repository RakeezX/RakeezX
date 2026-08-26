import { test, expect } from '@playwright/test';

function observeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function waitForRestore(page) {
  await page.waitForTimeout(1_300);
  await page.waitForFunction(() => window.store?.state?.years?.some((record) => record.id === 'backup-year'), { timeout: 15_000 });
}

const liveCounts = () => {
  const stores = [
    'years', 'terms', 'subjects', 'sections', 'teachings', 'students', 'enrollments',
    'slots', 'sessions', 'attendance', 'items', 'scores', 'calendars', 'calendarDays',
    'units', 'lessons', 'timeProfiles',
  ];
  return Object.fromEntries(stores.map((store) => [store, window.store.state[store].filter((record) => !record.deleted).length]));
};

test('backup UI restores representative TEST data into a clean context without local-only records or duplicates', async ({ page }) => {
  test.setTimeout(90_000);
  const sourceErrors = observeErrors(page);
  await page.goto('/#/settings/backup');
  await page.waitForFunction(() => window.store, { timeout: 15_000 });

  // Representative TEST-only fixture across every currently backed-up product area.
  await page.evaluate(async () => {
    const stamp = 1_800_000_000_000;
    await window.store.save({
      profile: [{ id: 'profile', teacherName: 'TEST Teacher', schoolName: 'TEST School', updatedAt: stamp }],
      years: [{ id: 'backup-year', name: 'TEST Year', updatedAt: stamp }],
      terms: [{ id: 'backup-term', yearId: 'backup-year', name: 'TEST Term', updatedAt: stamp }],
      subjects: [{ id: 'backup-subject', name: 'TEST Subject', updatedAt: stamp }],
      sections: [{ id: 'backup-section', yearId: 'backup-year', grade: 5, label: 'Z', name: 'TEST 5/Z', order: 0, updatedAt: stamp }],
      teachings: [{ id: 'backup-teaching', sectionId: 'backup-section', subjectId: 'backup-subject', termId: 'backup-term', order: 0, updatedAt: stamp }],
      students: [{ id: 'backup-student', name: 'TEST Backup Student', status: 'active', updatedAt: stamp }],
      enrollments: [{ id: 'backup-enrollment', studentId: 'backup-student', sectionId: 'backup-section', rollNo: 7, status: 'active', updatedAt: stamp }],
      timeProfiles: [{ id: 'backup-time-profile', name: 'TEST Timing', periods: [{ number: 1, start: '07:00', end: '07:45' }], updatedAt: stamp }],
      slots: [{ id: 'backup-slot', teachingId: 'backup-teaching', weekday: 1, period: 4, updatedAt: stamp }],
      sessions: [{ id: 'backup-session', teachingId: 'backup-teaching', slotId: 'backup-slot', date: '2026-08-02', weekday: 0, period: 1, updatedAt: stamp }],
      attendance: [{ id: 'backup-attendance', studentId: 'backup-student', sessionId: 'backup-session', teachingId: 'backup-teaching', date: '2026-08-02', status: 'late', updatedAt: stamp }],
      items: [{ id: 'backup-item', teachingId: 'backup-teaching', name: 'TEST Assessment', max: 20, updatedAt: stamp }],
      scores: [{ id: 'backup-score', studentId: 'backup-student', itemId: 'backup-item', value: 17, updatedAt: stamp }],
      calendars: [{ id: 'backup-calendar', yearId: 'backup-year', name: 'TEST Calendar', updatedAt: stamp }],
      calendarDays: [{ id: 'backup-calendar-day', calendarId: 'backup-calendar', date: '2026-08-02', kind: 'school', updatedAt: stamp }],
      units: [{ id: 'backup-unit', teachingId: 'backup-teaching', name: 'TEST Unit', order: 0, updatedAt: stamp }],
      lessons: [{ id: 'backup-lesson', unitId: 'backup-unit', teachingId: 'backup-teaching', name: 'TEST Lesson', order: 0, updatedAt: stamp }],
    });
    await window.store.patchDevice({ activeYearId: 'backup-year', activeTermId: 'backup-term', theme: 'dark' });
    const db = await import('/src/lib/db.js');
    await db.put('meta', { id: 'source-meta', value: 'must-not-export' });
    await db.put('outbox', { id: 'source-outbox', store: 'scores', op: 'upsert' });
    window.store.repaint();
  });

  // Export through the actual backup UI and inspect the produced JSON only in memory.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-act="export"]').click(),
  ]);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const backupBuffer = Buffer.concat(chunks);
  const backup = JSON.parse(backupBuffer.toString('utf8'));
  expect(backup.app).toBe('rakeezx');
  expect(backup.data.device).toBeUndefined();
  expect(backup.data.meta).toBeUndefined();
  expect(backup.data.outbox).toBeUndefined();
  expect(backup.data.attendance).toHaveLength(1);
  expect(backup.data.scores).toHaveLength(1);
  expect(backup.data.units).toHaveLength(1);
  expect(backup.data.lessons).toHaveLength(1);
  const sourceCounts = await page.evaluate(liveCounts);

  // A separate browser context is a clean IndexedDB device. Its local-only records are deliberately different.
  const freshDevice = await page.context().browser().newContext();
  const restored = await freshDevice.newPage();
  const restoredErrors = observeErrors(restored);
  await restored.goto('/#/settings/backup');
  await restored.waitForFunction(() => window.store, { timeout: 15_000 });
  await restored.waitForFunction(() => window.store?.state?.ready === true, { timeout: 15_000 });
  await restored.evaluate(async () => {
    await window.store.patchDevice({ theme: 'light' });
    const db = await import('/src/lib/db.js');
    await db.put('meta', { id: 'target-meta', value: 'keep-meta' });
    await db.put('outbox', { id: 'target-outbox', store: 'attendance', op: 'upsert' });
  });

  const fileInput = restored.locator('#restore-file');
  await fileInput.setInputFiles({ name: 'rakeezx-test-backup.json', mimeType: 'application/json', buffer: backupBuffer });
  await expect(restored.locator('[data-pick="replace"]')).toBeVisible();
  await restored.locator('[data-pick="replace"]').click();
  await expect(restored.locator('[data-confirm]')).toBeVisible();
  await restored.locator('[data-confirm]').click();
  await waitForRestore(restored);

  expect(await restored.evaluate(liveCounts)).toEqual(sourceCounts);
  expect(await restored.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return {
      section: window.store.state.sections.find((record) => record.id === 'backup-section'),
      slot: window.store.state.slots.find((record) => record.id === 'backup-slot'),
      session: window.store.state.sessions.find((record) => record.id === 'backup-session'),
      attendance: window.store.state.attendance.find((record) => record.id === 'backup-attendance'),
      score: window.store.state.scores.find((record) => record.id === 'backup-score'),
      lesson: window.store.state.lessons.find((record) => record.id === 'backup-lesson'),
      device: window.store.state.device,
      meta: await db.get('meta', 'target-meta'),
      outbox: await db.get('outbox', 'target-outbox'),
      importedMeta: await db.get('meta', 'source-meta'),
      importedOutbox: await db.get('outbox', 'source-outbox'),
    };
  })).toMatchObject({
    section: { id: 'backup-section', grade: 5, label: 'Z' },
    slot: { id: 'backup-slot', teachingId: 'backup-teaching', weekday: 1, period: 4 },
    session: { id: 'backup-session', slotId: 'backup-slot', date: '2026-08-02', period: 1 },
    attendance: { id: 'backup-attendance', studentId: 'backup-student', sessionId: 'backup-session', status: 'late' },
    score: { id: 'backup-score', studentId: 'backup-student', itemId: 'backup-item', value: 17 },
    lesson: { id: 'backup-lesson', unitId: 'backup-unit', teachingId: 'backup-teaching' },
    device: { theme: 'light' },
    meta: { id: 'target-meta', value: 'keep-meta' },
    outbox: { id: 'target-outbox', store: 'attendance', op: 'upsert' },
    importedMeta: undefined,
    importedOutbox: undefined,
  });

  // Reports must render restored relationships and survive a normal reload.
  await restored.goto('/#/teaching/backup-teaching/reports');
  await expect(restored.locator('.printhead')).toContainText('الخامس الابتدائي / Z');
  await expect(restored.locator('.gtable--report')).toContainText('TEST Backup Student');
  await expect(restored.locator('.gtable--report')).toContainText('17');
  await restored.locator('[data-act="tab"][data-tab="attendance"]').click();
  await expect(restored.locator('.gtable--report')).toContainText('TEST Backup Student');
  await restored.reload();
  await expect(restored.locator('.gtable--report')).toContainText('TEST Backup Student');

  // Re-importing the same backup in supported merge mode is idempotent: no duplicate records.
  await restored.goto('/#/settings/backup');
  await restored.waitForFunction(() => window.store?.state?.ready === true, { timeout: 15_000 });
  const restoredFileInput = restored.locator('#restore-file');
  await restoredFileInput.setInputFiles({ name: 'rakeezx-test-backup.json', mimeType: 'application/json', buffer: backupBuffer });
  await expect(restored.locator('[data-pick="merge"]')).toBeVisible();
  await restored.locator('[data-pick="merge"]').click();
  await waitForRestore(restored);
  expect(await restored.evaluate(liveCounts)).toEqual(sourceCounts);
  expect(await restored.evaluate(() => ({
    scoreIds: window.store.state.scores.filter((record) => !record.deleted).map((record) => record.id),
    attendanceIds: window.store.state.attendance.filter((record) => !record.deleted).map((record) => record.id),
  }))).toEqual({ scoreIds: ['backup-score'], attendanceIds: ['backup-attendance'] });

  expect(restoredErrors).toEqual([]);
  await freshDevice.close();
  expect(sourceErrors).toEqual([]);
});
