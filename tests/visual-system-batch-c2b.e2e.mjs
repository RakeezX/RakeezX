import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(120_000);

const viewports = [
  { width: 320, height: 760 },
  { width: 390, height: 844 },
  { width: 412, height: 860 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
];

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

async function seed(page) {
  await page.goto('/#/');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    const a = (record) => {
      const canonical = {
        ...record,
        canonicalId: record.id,
        serverRevision: 1,
        fieldRevisions: { all: 1 },
        deleted: false,
      };
      return { ...canonical, serverCanonical: structuredClone(canonical) };
    };
    const profile = a({ ...window.store.state.profile, id: 'profile', teacherName: 'معلم ركيز' });
    await window.store.patch('profile', 'profile', profile, null, { queue: false });
    const year = a({ id: 'c2b-year', label: '1447-1448', order: 10, status: 'archived' });
    const olderYear = a({ id: 'c2b-year-old', label: '1446-1447', order: 9, status: 'archived' });
    const term = a({ id: 'c2b-term', yearId: year.id, index: 1, name: 'الفصل الدراسي الأول', status: 'active' });
    const unresolved = a({ id: 'c2b-term-unresolved', yearId: year.id, index: 2, name: 'الفصل الدراسي الثاني', status: 'closed' });
    const olderTerm = a({ id: 'c2b-term-old', yearId: olderYear.id, index: 1, name: 'الفصل الدراسي الأول', status: 'closed' });
    const subject = a({ id: 'c2b-subject', name: 'المهارات الرقمية' });
    const section = a({ id: 'c2b-section', yearId: year.id, grade: 5, label: 'أ', status: 'archived', archivedAt: 1 });
    const teaching = a({ id: 'c2b-teaching', sectionId: section.id, subjectId: subject.id, termId: term.id });
    const unresolvedTeaching = a({ id: 'c2b-teaching-unresolved', sectionId: section.id, subjectId: subject.id, termId: unresolved.id });
    const student = a({ id: 'c2b-student', name: 'طالب السجل التاريخي', status: 'active' });
    const enrollment = a({ id: 'c2b-enrollment', studentId: student.id, sectionId: section.id, rollNo: 1, status: 'active' });
    const item = a({ id: 'c2b-item', teachingId: teaching.id, name: 'مهمة محفوظة', max: 10, order: 0, perPoint: 1, penalty: 1 });
    const score = a({ id: 'c2b-score', studentId: student.id, itemId: item.id, value: 9 });
    const session = a({ id: 'c2b-session', teachingId: teaching.id, date: '2026-09-08', period: 2, startTime: '08:00', endTime: '08:45', status: 'held' });
    const roster = a({ id: 'c2b-roster', sessionId: session.id, teachingId: teaching.id, sectionId: section.id, capturedAt: 1, members: [{ studentId: student.id, rollNo: 1 }], state: 'complete' });
    const attendance = a({ id: 'c2b-attendance', studentId: student.id, sessionId: session.id, teachingId: teaching.id, date: session.date, status: 'present' });
    await window.store.save({
      years: [year, olderYear], terms: [term, unresolved, olderTerm], subjects: [subject], sections: [section],
      teachings: [teaching, unresolvedTeaching], students: [student], enrollments: [enrollment], items: [item],
      scores: [score], sessions: [session], sessionRosterSnapshots: [roster], attendance: [attendance],
    }, { queue: false });
    const payload = window.store.buildClosedTermReportPayload(term.id);
    const report = a({ id: 'c2b-report', termId: term.id, yearId: year.id, version: 1, supersedesId: null, sourceManifest: window.store.closedTermSourceManifest(term.id), payload, state: 'complete', createdAt: 1 });
    await window.store.save({ closedTermReports: [report] }, { queue: false });
    await window.store.patchDevice({ activeYearId: year.id, activeTermId: term.id, theme: 'light' }, { queue: false });
  });
}

async function setTheme(page, selected) {
  await page.evaluate((theme) => window.store.patchDevice({ theme }, { queue: false }), selected);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', selected);
}

test('C2B backup and archive are responsive, accessible, and behavior-preserving', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await seed(page);

  for (const selectedTheme of ['light', 'dark']) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/#/settings/backup');
      await setTheme(page, selectedTheme);
      await expect(page.locator('.data-safety-surface')).toBeVisible();
      await expect(page.locator('.recovery-path')).toHaveCount(2);
      await expect(page.getByRole('button', { name: 'اختيار نسخة للمراجعة' })).toBeEnabled();
      await expect(page.locator('.recovery-path--cloud')).toContainText('الاستعادة السحابية الآمنة');
      await expect(page.locator('.data-danger-zone')).toBeVisible();
      expect(await noOverflow(page), `${selectedTheme}/${viewport.width}/backup`).toBe(true);

      await page.goto('/#/archive');
      await expect(page.locator('.archive-year')).toHaveCount(2);
      await expect(page.locator('.archive-year[open]')).toHaveCount(1);
      await expect(page.locator('.archive-summary')).toContainText('للقراءة فقط');
      expect(await noOverflow(page), `${selectedTheme}/${viewport.width}/archive`).toBe(true);
    }
  }

  await mkdir(path.resolve('test-results/c2b-browser'), { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/settings/backup');
  await setTheme(page, 'light');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تنزيل نسخة' }).click();
  const download = await downloadEvent;
  const backupPath = path.resolve('test-results/c2b-browser/rakeezx-backup.json');
  await download.saveAs(backupPath);
  await expect(page.locator('.backup-action-status')).toContainText('اكتمل آخر تنزيل في هذه الجلسة');
  await page.locator('#restore-file').setInputFiles(backupPath);
  const restoreDialog = page.getByRole('dialog', { name: 'استعادة نسخة على هذا الجهاز' });
  await expect(restoreDialog).toBeVisible();
  await expect(restoreDialog).toContainText('هذه استعادة محلية');
  await expect(restoreDialog.getByRole('button', { name: /دمج السجلات/ })).toBeVisible();
  await expect(restoreDialog.getByRole('button', { name: /استبدال كامل/ })).toBeVisible();
  await expect(restoreDialog.getByRole('button', { name: /دمج السجلات/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(restoreDialog).toBeHidden();
  await page.getByRole('button', { name: /إعادة ضبط سجل ركيز المحلي/ }).click();
  await expect(page.getByRole('dialog', { name: 'إعادة ضبط السجل المحلي؟' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/c2b-browser/backup-desktop-light.png', fullPage: true });

  await page.goto('/#/archive');
  const secondYear = page.locator('.archive-year').nth(1).locator('summary');
  await secondYear.focus();
  await expect(secondYear).toBeFocused();
  await secondYear.press('Enter');
  await expect(page.locator('.archive-year').nth(1)).toHaveAttribute('open', '');
  await page.screenshot({ path: 'test-results/c2b-browser/archive-desktop-light.png', fullPage: true });

  await page.goto('/#/archive/year/c2b-year/term/c2b-term');
  await expect(page.locator('.archive-context')).toContainText('تقارير ثابتة');
  await expect(page.locator('.archive-context')).toContainText('الإصدار 1');
  await expect(page.locator('.archive-record-row')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /الخامس الابتدائي \/ أ/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/c2b-browser/archive-detail-desktop-light.png', fullPage: true });

  await page.goto('/#/archive/year/c2b-year/term/c2b-term-unresolved');
  await expect(page.locator('.archive-unresolved')).toContainText('لن يستنتج ركيز تقاريره من البيانات الحالية');
  await expect(page.locator('.archive-record-row.is-disabled')).toHaveCount(1);
  expect(await noOverflow(page)).toBe(true);

  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/#/settings/backup');
  await setTheme(page, 'dark');
  const touchHeights = await page.locator('button:not([disabled]), a.btn').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height).filter((height) => height > 0));
  expect(touchHeights.every((height) => height >= 44)).toBe(true);
  await page.screenshot({ path: 'test-results/c2b-browser/backup-320-dark.png', fullPage: true });
  const scan = await new AxeBuilder({ page }).include('.backup-data-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'critical')).toEqual([]);
  expect(errors).toEqual([]);
});
