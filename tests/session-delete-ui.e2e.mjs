import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ids = {
  teaching: 'tch:session-delete-ui',
  section: 'sec:session-delete-ui',
  slot: 'slot:session-delete-ui',
  pristine: 'session:delete-ui:pristine',
  attendance: 'session:delete-ui:attendance',
  content: 'session:delete-ui:content',
  makeupParent: 'session:delete-ui:makeup-parent',
  makeupChild: 'session:delete-ui:makeup-child',
  held: 'session:delete-ui:held',
  restored: 'session:delete-ui:restored',
};

async function seedSessions(page) {
  await page.goto(`/#/teaching/${ids.teaching}/sessions`);
  await expect(page.locator('.topbar__title').first()).toBeVisible({ timeout: 15_000 });
  await page.evaluate(async (fixtureIds) => {
    const date = new Date().toLocaleDateString('en-CA');
    const revision = (record) => ({
      ...record,
      canonicalId: record.id,
      serverRevision: 1,
      deleted: false,
      updatedAt: Date.now(),
    });
    const baseSession = (id, period, changes = {}) => revision({
      id,
      teachingId: fixtureIds.teaching,
      date,
      period,
      startTime: `${String(6 + period).padStart(2, '0')}:00`,
      endTime: `${String(6 + period).padStart(2, '0')}:45`,
      status: 'scheduled',
      reason: '',
      lessonId: null,
      note: '',
      homework: '',
      covered: '',
      makeupForId: null,
      ...changes,
    });
    const year = revision({ id: 'year:session-delete-ui', hijriStart: 1448, label: '1448–1449 هـ', order: 1 });
    const term = revision({
      id: 'term:session-delete-ui', yearId: year.id, index: 1, name: 'الفصل الدراسي الأول',
      startDate: date, endDate: date, status: 'active',
    });
    const subject = revision({ id: 'subject:session-delete-ui', name: 'الرياضيات', slug: 'session-delete-ui' });
    const section = revision({
      id: fixtureIds.section, yearId: year.id, grade: 5, label: 'أ', name: 'الخامس الابتدائي / أ', status: 'active',
    });
    const teaching = revision({
      id: fixtureIds.teaching, sectionId: section.id, subjectId: subject.id, termId: term.id,
    });
    const student = revision({ id: 'student:session-delete-ui', name: 'طالب اختبار', status: 'active' });
    const enrollment = revision({
      id: 'enrollment:session-delete-ui', studentId: student.id, sectionId: section.id,
      status: 'active', rollNo: 1, startDate: date, endDate: null,
    });
    const slot = revision({
      id: fixtureIds.slot, teachingId: teaching.id, weekday: new Date(`${date}T12:00:00`).getDay(), period: 1,
    });
    const sessions = [
      baseSession(fixtureIds.pristine, 1, { slotId: slot.id }),
      baseSession(fixtureIds.attendance, 2),
      baseSession(fixtureIds.content, 3, { note: 'محتوى محفوظ' }),
      baseSession(fixtureIds.makeupParent, 4),
      baseSession(fixtureIds.makeupChild, 5, { status: 'makeup', makeupForId: fixtureIds.makeupParent }),
      baseSession(fixtureIds.held, 6, { status: 'held' }),
      baseSession(fixtureIds.restored, 7, {
        deleteProtection: { mutationId: 'mutation:protected', reason: 'attendance', recordedAt: Date.now() },
      }),
    ];
    const attendance = revision({
      id: 'attendance:session-delete-ui', studentId: 'student:session-delete-ui',
      sessionId: fixtureIds.attendance, teachingId: teaching.id, date, status: 'present', note: '',
    });
    await window.store.save({
      years: [year], terms: [term], subjects: [subject], sections: [section], teachings: [teaching],
      students: [student], enrollments: [enrollment], slots: [slot], sessions, attendance: [attendance],
    }, { queue: false });
    await window.store.patchDevice({ activeYearId: year.id, activeTermId: term.id }, { queue: false });
  }, ids);
  await page.reload();
  await expect(page.locator(`[data-act="status"][data-id="${ids.pristine}"]`)).toBeVisible();
}

const detailsButton = (page, id) => page.locator(`[data-act="status"][data-id="${id}"]`);

async function openDetails(page, id) {
  await detailsButton(page, id).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('session details expose deletion only for pristine sessions and explain protected/restored states', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors.push(message.text());
  });
  await seedSessions(page);

  let dialog = await openDetails(page, ids.pristine);
  await expect(dialog.getByText('التاريخ')).toBeVisible();
  await expect(dialog.getByText('الخامس الابتدائي / أ · الرياضيات')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detailsButton(page, ids.pristine)).toBeFocused();

  const protectedCases = [
    [ids.attendance, 'توجد سجلات حضور مرتبطة بهذه الحصة.'],
    [ids.content, 'تحتوي الحصة على محتوى مسجل.'],
    [ids.makeupParent, 'الحصة مرتبطة بحصة تعويضية.'],
    [ids.makeupChild, 'الحصة مرتبطة بحصة تعويضية.'],
    [ids.held, 'حالة الحصة محفوظة ولا يمكن حذفها.'],
  ];
  for (const [id, reason] of protectedCases) {
    dialog = await openDetails(page, id);
    await expect(dialog.locator('.session-delete-option p')).toContainText(reason);
    await expect(dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  }

  await expect(page.getByText('لم يتم حذف الحصة لأنها تحتوي على بيانات محفوظة.').first()).toBeVisible();
  dialog = await openDetails(page, ids.restored);
  await expect(dialog.getByText(/لم يتم حذف الحصة لأنها تحتوي على بيانات محفوظة/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' })).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page })
    .include('.sheet')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations.filter((violation) => violation.impact === 'critical')).toEqual([]);
  await page.keyboard.press('Escape');

  await page.evaluate(async (fixtureIds) => {
    const section = window.store.getSection(fixtureIds.section);
    await window.store.save({ sections: [{ ...section, status: 'archived' }] }, { queue: false });
  }, ids);
  await page.reload();
  await expect(page.getByText('الفصل مؤرشف', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'تفاصيل الحصة وحالتها' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('confirmed offline deletion removes one dated session, keeps its weekly slot, and survives reload', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors.push(message.text());
  });
  await seedSessions(page);

  const slotBefore = await page.evaluate((slotId) => !!window.store.state.slots.find((row) => row.id === slotId && !row.deleted), ids.slot);
  expect(slotBefore).toBe(true);
  let dialog = await openDetails(page, ids.pristine);
  await dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' }).click();

  dialog = page.getByRole('dialog', { name: 'حذف هذه الحصة؟' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('سيتم حذف هذه الحصة فقط، ولن يتغير الجدول الأسبوعي أو الحصص الأخرى.')).toBeVisible();
  await expect(dialog.getByText('الخامس الابتدائي / أ · الرياضيات')).toBeVisible();
  await expect(dialog.getByText(/الحصة 1/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'إلغاء' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(detailsButton(page, ids.pristine)).toBeFocused();
  expect(await page.evaluate((sessionId) => !!window.store.getSession(sessionId), ids.pristine)).toBe(true);

  dialog = await openDetails(page, ids.pristine);
  await dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' }).click();
  dialog = page.getByRole('dialog', { name: 'حذف هذه الحصة؟' });
  await context.setOffline(true);
  await dialog.getByRole('button', { name: 'حذف هذه الحصة', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('تم طلب حذف الحصة، وستتم مزامنته عند توفر الاتصال.');
  await expect(detailsButton(page, ids.pristine)).toHaveCount(0);
  expect(await page.evaluate((slotId) => !!window.store.state.slots.find((row) => row.id === slotId && !row.deleted), ids.slot)).toBe(true);

  await context.setOffline(false);
  await page.reload();
  await expect(page.locator(`[data-act="status"][data-id="${ids.attendance}"]`)).toBeVisible();
  await expect(detailsButton(page, ids.pristine)).toHaveCount(0);
  expect(await page.evaluate((slotId) => !!window.store.state.slots.find((row) => row.id === slotId && !row.deleted), ids.slot)).toBe(true);
  expect(errors).toEqual([]);
});

test('Sessions, in-session status, and top clock entry points share one delete contract', async ({ page }) => {
  await seedSessions(page);

  let dialog = await openDetails(page, ids.pristine);
  await expect(dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' })).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.goto(`/#/teaching/${ids.teaching}/attendance?session=${ids.pristine}`);
  const statusEntry = page.locator('.attendance-session-summary [data-act="session-status"]');
  await expect(statusEntry).toBeVisible();
  await statusEntry.click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' })).toHaveCount(1);
  await page.keyboard.press('Escape');

  const clockEntry = page.locator('.topbar__actions [data-act="session-status"]');
  await clockEntry.focus();
  await page.keyboard.press('Enter');
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(clockEntry).toBeFocused();

  await page.goto(`/#/teaching/${ids.teaching}/attendance?session=${ids.content}`);
  await expect(statusEntry).toBeVisible();
  for (const entry of [statusEntry, clockEntry]) {
    await entry.click();
    dialog = page.getByRole('dialog');
    await expect(dialog.locator('.session-delete-option p')).toContainText('تحتوي الحصة على محتوى مسجل.');
    await expect(dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});

test('in-session delete access stays singular and stable on mobile and desktop', async ({ page }) => {
  await seedSessions(page);
  await page.goto(`/#/teaching/${ids.teaching}/attendance?session=${ids.pristine}`);
  for (const width of [320, 390, 412, 1280]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    const entry = page.locator('.attendance-session-summary [data-act="session-status"]');
    await expect(entry).toBeVisible();
    await entry.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'حذف هذه الحصة فقط' })).toHaveCount(1);
    expect(await page.evaluate(() => ({
      direction: getComputedStyle(document.documentElement).direction,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }))).toEqual({ direction: 'rtl', overflow: false });
    await page.keyboard.press('Escape');
  }
});

test('shared in-session editor preserves status updates and deletes through the top clock action', async ({ page }) => {
  await seedSessions(page);
  await page.goto(`/#/teaching/${ids.teaching}/attendance?session=${ids.content}`);
  await page.locator('.attendance-session-summary [data-act="session-status"]').click();
  await page.getByRole('dialog').getByRole('button', { name: /^تمت/ }).click();
  await expect.poll(() => page.evaluate((sessionId) => window.store.getSession(sessionId)?.status, ids.content)).toBe('held');

  await page.goto(`/#/teaching/${ids.teaching}/attendance?session=${ids.pristine}`);
  await page.locator('.topbar__actions [data-act="session-status"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'حذف هذه الحصة فقط' }).click();
  await page.getByRole('dialog', { name: 'حذف هذه الحصة؟' })
    .getByRole('button', { name: 'حذف هذه الحصة', exact: true }).click();
  await expect.poll(() => page.evaluate((sessionId) => window.store.getSession(sessionId), ids.pristine)).toBeNull();
  await expect(page.locator('.topbar__sub')).toContainText('الحصة 2');
});

test('session delete presentation remains stable across target widths, themes, and RTL', async ({ page }) => {
  await seedSessions(page);
  for (const width of [320, 390, 412, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.setAttribute('data-theme', value);
      }, theme);
      await openDetails(page, ids.pristine);
      expect(await page.evaluate(() => ({
        direction: getComputedStyle(document.documentElement).direction,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }))).toEqual({ direction: 'rtl', overflow: false });
      const deleteButton = page.getByRole('dialog').getByRole('button', { name: 'حذف هذه الحصة فقط' });
      await expect(deleteButton).toBeVisible();
      expect((await deleteButton.boundingBox())?.height).toBeGreaterThanOrEqual(width < 600 ? 44 : 40);
      await page.keyboard.press('Escape');
    }
  }
});
