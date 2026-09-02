import { test, expect } from '@playwright/test';

async function seed(page) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async () => {
    const students = [
      { id: 'recovery-a2-student-1', name: 'طالب الاسترداد الأول', status: 'active' },
      { id: 'recovery-a2-student-2', name: 'طالب الاسترداد الثاني', status: 'active' },
    ];
    await window.store.save({
      years: [{ id: 'recovery-a2-year', label: 'سنة الاختبار' }],
      terms: [{ id: 'recovery-a2-term', yearId: 'recovery-a2-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'recovery-a2-subject', name: 'المهارات الرقمية' }],
      sections: [{ id: 'recovery-a2-section', yearId: 'recovery-a2-year', grade: 5, label: 'أ' }],
      teachings: [{ id: 'recovery-a2-teaching', sectionId: 'recovery-a2-section', subjectId: 'recovery-a2-subject', termId: 'recovery-a2-term' }],
      students,
      enrollments: students.map((student, index) => ({ id: `recovery-a2-enrollment-${index}`, studentId: student.id, sectionId: 'recovery-a2-section', status: 'active', rollNo: index + 1 })),
    });
    await window.store.patchDevice({ activeYearId: 'recovery-a2-year', activeTermId: 'recovery-a2-term' });
    window.store.repaint();
  });
}

test('Recovery A.2 keeps Quick Log stable and preserves Picker sound, celebration, and return context', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    let contexts = 0;
    class TestAudioContext {
      constructor() { contexts += 1; this.currentTime = 0; this.state = 'running'; }
      resume() { return Promise.resolve(); }
      createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
    }
    window.AudioContext = TestAudioContext;
    window.webkitAudioContext = TestAudioContext;
    Object.defineProperty(window, '__recoveryA2AudioContexts', { get: () => contexts });
  });
  await seed(page);

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/#/teaching/recovery-a2-teaching/quicklog');
    const card = page.locator('#ql-recovery-a2-student-1');
    const roll = card.locator('.qlcard__roll');
    const minus = card.locator('[data-act="minus"]');
    await expect(card).toBeVisible();
    await expect(roll).toHaveText('1');
    const [before, rollBox, minusBox] = await Promise.all([card.boundingBox(), roll.boundingBox(), minus.boundingBox()]);
    expect(before).not.toBeNull();
    expect(rollBox).not.toBeNull();
    expect(minusBox).not.toBeNull();
    const controlsOverlap = rollBox.x < minusBox.x + minusBox.width
      && rollBox.x + rollBox.width > minusBox.x
      && rollBox.y < minusBox.y + minusBox.height
      && rollBox.y + rollBox.height > minusBox.y;
    expect(controlsOverlap).toBe(false);
    await card.locator('[data-act="plus"]').click();
    await expect(card.locator('.qlcard__score')).toHaveText(/^\+\d+$/);
    const after = await card.boundingBox();
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
    expect(await page.evaluate(() => window.__recoveryA2AudioContexts)).toBeGreaterThan(0);
    await expect(page.locator('.effect-overlay')).toHaveCount(1);
    expect(await page.evaluate(() => window.store.state.logs.filter((log) => log.teachingId === 'recovery-a2-teaching' && log.studentId === 'recovery-a2-student-1').length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/teaching/recovery-a2-teaching/picker');
  await page.locator('[data-act="spin"]').click();
  await expect(page.locator('.picker__name')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: 'إضافة درجة مشاركة' })).toBeVisible();
  const report = page.getByRole('link', { name: 'تقرير الطالب' });
  await expect(report).toBeVisible();
  expect(await page.evaluate(() => window.__recoveryA2AudioContexts)).toBeGreaterThan(0);
  await expect(page.locator('.effect-overlay')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await report.click();
  await expect(page).toHaveURL(/#\/student\/recovery-a2-student-[12]\?from=picker&cls=recovery-a2-teaching/);
  await page.getByRole('link', { name: 'رجوع' }).click();
  await expect(page).toHaveURL(/#\/teaching\/recovery-a2-teaching\/picker/);

  await page.goto('/#/settings');
  await expect(page.getByText('المؤثرات الصوتية', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-act="sound"]')).toHaveCount(2);
  await expect(page.locator('select[data-act*="sound"], [data-act="sound-preset"]')).toHaveCount(0);
  await page.locator('[data-act="sound"][data-val="off"]').click();
  expect(await page.evaluate(() => localStorage.getItem('rakeez_sound_enabled'))).toBe('false');
  await page.reload();
  await expect(page.locator('[data-act="sound"][data-val="off"]')).toHaveClass(/is-on/);
  expect(errors).toEqual([]);
});
