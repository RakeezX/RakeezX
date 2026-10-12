import { test, expect } from '@playwright/test';
import { createCloud, authenticated } from './helpers/remote-sync-browser.mjs';
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function account(page) {
  const transport = createCloud();
  await authenticated(page, transport);
  await page.route('https://*.supabase.co/auth/v1/user', route => route.fulfill({ json: { id: OWNER } }));
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state.ready);
  await page.evaluate(async () => {
    const s = window.store;
    const sync = await import('/src/lib/sync.js');
    await sync.suspendForWorkspaceDeactivation(); // Keep synthetic outbox for inspection.
    await s.renewOfflineLease();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  });
  expect(await page.evaluate(() => window.store.getActiveWorkspace().type)).toBe('account');
}
async function pickSubject(dialog, name) {
  await dialog.locator('[data-subject-trigger]').click();
  await dialog.getByRole('option', { name, exact: true }).click();
}
async function openCreate(page) {
  await page.locator('[data-act="add"]').first().click();
  return page.getByRole('dialog');
}
async function createFirst(page) {
  const dialog = await openCreate(page);
  await dialog.locator('[name="label"]').fill('أ');
  await pickSubject(dialog, 'العربية');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(1);
  return page.evaluate(() => {
    const s = window.store, teaching = s.teachings()[0];
    return { teaching: teaching.id, section: teaching.sectionId, subject: teaching.subjectId };
  });
}

test('account single create form reuses roster; duplicate current-term subject stays open without writes; rapid submit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await account(page);
  const first = await createFirst(page);
  const before = await page.evaluate(async first => {
    const s = window.store, db = await import('/src/lib/db.js');
    await s.addStudent(first.section, 'طالب اصطناعي');
    return Object.fromEntries(await Promise.all(['sections', 'students', 'enrollments'].map(async name => [name, await db.getAll(name)])));
  }, first);
  let dialog = await openCreate(page);
  await expect(dialog.locator('[name="sectionId"]')).toHaveCount(0);
  await expect(dialog.locator('[name="grade"]')).toBeVisible();
  await expect(dialog.locator('[name="label"]')).toBeVisible();
  await dialog.locator('[name="grade"]').selectOption('4');
  await dialog.locator('[name="label"]').fill('ا'); // Same normalized class label.
  await pickSubject(dialog, 'العلوم');
  await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(2);
  expect(await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return Object.fromEntries(await Promise.all(['sections', 'students', 'enrollments'].map(async name => [name, await db.getAll(name)])));
  })).toEqual(before);
  const beforeDuplicate = await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
  });
  dialog = await openCreate(page);
  await dialog.locator('[name="label"]').fill('أ');
  await pickSubject(dialog, 'العلوم');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#toast')).toContainText('هذه المادة موجودة مسبقًا');
  expect(await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
  })).toEqual(beforeDuplicate);
  // A custom alias for the same built-in subject must also remain read-only.
  await dialog.locator('[data-subject-trigger]').click();
  await dialog.locator('[data-subject-custom]').click();
  await dialog.locator('[name="customSubjectName"]').fill('علوم');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#toast')).toContainText('هذه المادة موجودة مسبقًا');
  expect(await page.evaluate(async () => {
    const db = await import('/src/lib/db.js');
    return Object.fromEntries(await Promise.all(db.STORES.map(async name => [name, await db.getAll(name)])));
  })).toEqual(beforeDuplicate);
  expect(await page.evaluate(() => window.store.teachings().length)).toBe(2);
  await dialog.getByRole('button', { name: 'إلغاء', exact: true }).click();
  await page.locator(`a[href="#/teaching/${first.teaching}"]`).click();
  await page.locator('[data-act="edit-sec"]').click();
  dialog = page.getByRole('dialog');
  await dialog.locator('[name="label"]').fill('ب');
  await dialog.getByRole('button', { name: 'حفظ التغييرات' }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator('[data-act="edit-sec"]').click();
  await page.getByRole('button', { name: 'إضافة مادة أخرى لهذا الفصل' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('[name="sectionId"]')).toHaveCount(0);
  await expect(dialog.locator('[name="grade"]')).toHaveValue('4');
  await expect(dialog.locator('[name="label"]')).toHaveValue('ب');
  await pickSubject(dialog, 'البدنية');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(3);
  expect(await page.evaluate(first => {
    const s = window.store;
    return { sectionCount: s.sections().length, teachingCount: s.teachings().length, label: s.getSection(first.section).label,
      rosterCounts: s.teachings().map(t => s.students(t.id).length), items: s.teachings().map(t => s.items(t.id).length) };
  }, first)).toEqual({ sectionCount: 1, teachingCount: 3, label: 'ب', rosterCounts: [1, 1, 1], items: [5, 5, 5] });
});

test('same subject in a previous term permits creation only in the current term on the same class', async ({ page }) => {
  await account(page);
  const first = await createFirst(page);
  const previous = await page.evaluate(async () => {
    const s = window.store;
    const term = s.activeTerm();
    const next = s.termsOf(term.yearId).find(candidate => candidate.id !== term.id && !s.isTermClosed(candidate.id));
    if (!next) throw new Error('Synthetic fixture needs its second open term.');
    await s.patchDevice({ activeTermId: next.id });
    await s.save({ terms: [{ ...term, status: 'closed' }] }, { queue: false });
    (await import('/src/repaint.js')).repaint();
    return term.id;
  });
  const dialog = await openCreate(page);
  await dialog.locator('[name="label"]').fill('أ');
  await pickSubject(dialog, 'العربية');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(1);
  expect(await page.evaluate(({ first, previous }) => {
    const s = window.store;
    return { sections: s.sections().length, oldTeaching: s.teachings(previous)[0].id,
      newSection: s.teachings()[0].sectionId, newSubject: s.teachings()[0].subjectId,
      newItems: s.items(s.teachings()[0].id).length };
  }, { first, previous })).toEqual({ sections: 1, oldTeaching: first.teaching,
    newSection: first.section, newSubject: first.subject, newItems: 5 });
});

test('delete confirmation rechecks scope, prevents silent expansion and preserves retained data', async ({ page }) => {
  await account(page);
  const first = await createFirst(page);
  const second = await page.evaluate(async first => {
    const s = window.store, subject = await s.resolveSubjectSelection({ token: 'builtin:science' });
    return (await s.createTeaching({ sectionId: first.section, subjectId: subject.id })).id;
  }, first);
  await page.locator('[data-act="delete-class-flow"]').click();
  let dialog = page.getByRole('dialog');
  await dialog.locator(`[data-teaching-id="${second}"]`).click();
  await dialog.getByRole('button', { name: 'متابعة' }).click();
  await expect(dialog.locator('.class-delete-confirm-box__consequence')).toContainText('هذه المادة فقط');
  await page.evaluate(second => { window.store.state.teachings.find(t => t.id === second).deleted = true; }, second);
  // Current selected teaching disappeared: no expanded full-class mutation.
  await dialog.getByRole('button', { name: 'تأكيد الحذف' }).click();
  await expect(page.locator('#toast')).toContainText('غير متاح');
  expect(await page.evaluate(first => !!window.store.getSection(first.section), first)).toBe(true);
  await page.evaluate(second => { window.store.state.teachings.find(t => t.id === second).deleted = false; }, second);
  await dialog.getByRole('button', { name: 'رجوع', exact: true }).click();
  await dialog.getByRole('button', { name: 'متابعة' }).click();
  await page.evaluate(first => { window.store.state.teachings.find(t => t.id === first.teaching).deleted = true; }, first);
  await dialog.getByRole('button', { name: 'تأكيد الحذف' }).click();
  await expect(dialog.locator('.sheet__title')).toHaveText('تأكيد حذف الفصل كاملًا');
  expect(await page.evaluate(first => !!window.store.getSection(first.section), first)).toBe(true);
  // Restore synthetic memory fixture, then add real store roster evidence.
  await page.evaluate(async first => {
    window.store.state.teachings.find(t => t.id === first.teaching).deleted = false;
    await window.store.addStudent(first.section, 'طالب محفوظ');
  }, first);
  await dialog.getByRole('button', { name: 'تأكيد الحذف' }).click();
  await expect(dialog.locator('.sheet__title')).toHaveText('تأكيد حذف المادة من الفصل');
  await dialog.getByRole('button', { name: 'تأكيد الحذف' }).click();
  await expect(page.locator('#toast')).toContainText('بيانات محفوظة');
  expect(await page.evaluate(() => window.store.teachings().length)).toBe(2);
});

test('actual Classes/create/edit/confirmation UI at mobile RTL and desktop, light/dark; Demo same handler parity', async ({ page }, testInfo) => {
  await account(page);
  const first = await createFirst(page);
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(async theme => { await window.store.patchDevice({ theme }); window.store.applyTheme(); }, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    let dialog = await openCreate(page);
    await expect(dialog.locator('[name="sectionId"]')).toHaveCount(0);
    await dialog.locator('[name="label"]').fill('أ');
    await pickSubject(dialog, 'العلوم');
    await expect(dialog.locator('[data-subject-selected]')).toHaveText('العلوم');
    await expect(dialog.locator('[name="label"]')).toHaveValue('أ');
    await expect(dialog.locator('[name="grade"]')).toBeVisible();
    expect(await page.evaluate(() => ({ rtl: document.documentElement.dir, fit: document.documentElement.scrollWidth <= innerWidth + 1 }))).toEqual({ rtl: 'rtl', fit: true });
    await page.screenshot({ path: testInfo.outputPath(`create-${width}-${theme}.png`), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await page.locator('[data-act="delete-class-flow"]').click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'متابعة' }).click();
    await expect(dialog.locator('.class-delete-confirm-box__consequence')).toContainText('آخر مادة');
    await expect(dialog.locator('.class-delete-confirm-box__note')).toContainText('لن يتم الحذف');
    await page.screenshot({ path: testInfo.outputPath(`delete-${width}-${theme}.png`), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'رجوع', exact: true }).click();
    await dialog.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await page.locator(`a[href="#/teaching/${first.teaching}"]`).click();
    await page.locator('[data-act="edit-sec"]').click();
    await expect(page.getByRole('button', { name: 'إضافة مادة أخرى لهذا الفصل' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`edit-${width}-${theme}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await page.evaluate(() => { location.hash = '#/classes'; });
    await expect(page.locator('[data-act="add"]').first()).toBeVisible();
  }
  // Activate a fresh Demo in this synthetic browser; use the same Product action.
  await page.evaluate(async () => {
    const s = window.store, { resolveWorkspace, createWorkspaceRegistry } = await import('/src/lib/workspaces.js');
    const registry = createWorkspaceRegistry(); const resolution = await resolveWorkspace({ type: 'demo' }, { registry }); await registry.close();
    await s.deactivateWorkspace(); s.activateWorkspace(resolution.workspace); await s.init();
    location.hash = '#/classes';
    (await import('/src/repaint.js')).repaint();
  });
  const demoFirst = await createFirst(page);
  const dialog = await openCreate(page);
  await dialog.locator('[name="label"]').fill('أ');
  await pickSubject(dialog, 'العلوم');
  await dialog.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.store.teachings().length)).toBe(2);
  expect(await page.evaluate(() => ({ type: window.store.getActiveWorkspace().type, sections: window.store.sections().length, teachings: window.store.teachings().length }))).toEqual({ type: 'demo', sections: 1, teachings: 2 });
});
