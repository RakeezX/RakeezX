import { test, expect } from '@playwright/test';

async function seedUpcomingFocus(page) {
  return page.evaluate(async () => {
    const section = await window.store.createSection({
      grade: 5,
      label: `لون-${Date.now()}`,
      name: 'الخامس / لون',
    });
    const teaching = await window.store.createTeaching({ sectionId: section.id });
    await window.store.addStudent(section.id, 'طالب اختبار اللون');
    await window.store.addSlot(teaching.id, 3, 1);
    const session = await window.store.ensureSession(teaching.id, '2026-09-09', 1, {
      startTime: '10:25',
      endTime: '11:10',
    });
    return session.id;
  });
}

async function actionColors(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      border: style.borderColor,
      outline: style.outlineStyle,
      outlineColor: style.outlineColor,
      cursor: style.cursor,
      opacity: style.opacity,
      info: getComputedStyle(document.documentElement).getPropertyValue('--info').trim(),
    };
  });
}

for (const theme of ['light', 'dark']) {
  test(`primary, hover, focus, and disabled action states are coherent — ${theme}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-09T07:00:00+03:00'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/');
    await page.waitForFunction(() => window.store?.state?.ready === true);
    await page.evaluate(async (value) => window.store.patchDevice({ theme: value }), theme);
    const sessionId = await seedUpcomingFocus(page);
    await page.goto('/#/');

    const action = page.locator('.today-focus').getByRole('link', { name: 'رصد الحضور' });
    await expect(action).toHaveAttribute('data-session-id', sessionId);
    const base = await actionColors(action);
    expect(base.background).toBe('rgb(24, 168, 120)');
    expect(base.color).toBe('rgb(6, 35, 31)');
    expect(base.background).not.toBe(base.info);

    await action.hover();
    const hover = await actionColors(action);
    expect(hover.background).not.toBe(base.background);
    expect(hover.color).toBe(base.color);

    await action.focus();
    const focus = await actionColors(action);
    expect(focus.outline).not.toBe('none');
    expect(focus.outlineColor).toBe('rgb(24, 168, 120)');

    const disabled = page.locator('.picker__go[disabled]');
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.className = 'btn btn--primary picker__go';
      button.disabled = true;
      button.textContent = 'إجراء غير متاح';
      document.querySelector('.page')?.append(button);
    });
    await expect(disabled).toBeDisabled();
    const disabledStyle = await actionColors(disabled);
    expect(disabledStyle.background).not.toBe(base.background);
    expect(disabledStyle.cursor).toBe('not-allowed');
    expect(Number(disabledStyle.opacity)).toBeGreaterThan(0.5);
  });
}

test('danger and neutral action roles remain visually distinct', async ({ page }) => {
  await page.goto('/#/settings/backup');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  const danger = page.locator('.btn--danger').first();
  const neutral = page.locator('.btn--ghost').first();
  await expect(danger).toBeVisible();
  await expect(neutral).toBeVisible();
  const dangerStyle = await actionColors(danger);
  const neutralStyle = await actionColors(neutral);
  expect(dangerStyle.color).not.toBe(neutralStyle.color);
  expect(dangerStyle.background).not.toBe(neutralStyle.background);
});
