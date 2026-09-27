import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(120_000);
test.use({
  ...(process.env.RAKEEZX_E2E_BASE_URL ? { baseURL: process.env.RAKEEZX_E2E_BASE_URL } : {}),
  serviceWorkers: 'block',
  timezoneId: 'Asia/Riyadh',
});

const teachingId = 'groups-touch-teaching';

async function seedGroups(page, studentCount = 24) {
  await page.goto('/#/classes');
  await page.waitForFunction(() => window.store?.state?.ready === true);
  await page.evaluate(async ({ count, currentTeachingId }) => {
    const students = Array.from({ length: count }, (_, index) => ({
      id: `groups-touch-student-${index}`,
      name: `طالب لمس ${index + 1}`,
      status: 'active',
    }));
    await window.store.save({
      years: [{ id: 'groups-touch-year', label: '1448-1449' }],
      terms: [{ id: 'groups-touch-term', yearId: 'groups-touch-year', name: 'الفصل الأول' }],
      subjects: [{ id: 'groups-touch-subject', name: 'العلوم' }],
      sections: [{ id: 'groups-touch-section', yearId: 'groups-touch-year', grade: 5, label: 'لمس' }],
      teachings: [{ id: currentTeachingId, sectionId: 'groups-touch-section', subjectId: 'groups-touch-subject', termId: 'groups-touch-term' }],
      students,
      enrollments: students.map((student, index) => ({
        id: `groups-touch-enrollment-${index}`,
        studentId: student.id,
        sectionId: 'groups-touch-section',
        status: 'active',
        rollNo: index + 1,
      })),
    }, { queue: false });
    await window.store.patchDevice({
      activeYearId: 'groups-touch-year',
      activeTermId: 'groups-touch-term',
    }, { queue: false });
  }, { count: studentCount, currentTeachingId: teachingId });
  await expect.poll(() => page.evaluate((id) => Boolean(window.store.getTeaching(id)), teachingId)).toBe(true);
  await page.locator(`a[href="#/teaching/${teachingId}"]`).click();
  await page.locator(`a[href="#/teaching/${teachingId}/groups"]`).click();
  await expect(page.getByRole('heading', { name: 'المجموعات', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /قسّم المجموعات/ }).click();
  await expect(page.locator('.group')).toHaveCount(Math.ceil(studentCount / 4));
}

async function touchDrag(page, source, target, { holdMs = 60, duringHold = null } = {}) {
  await source.scrollIntoViewIfNeeded();
  const targetGroup = target.locator('.group__head');
  await targetGroup.scrollIntoViewIfNeeded();
  // Keep both gesture endpoints clear of the fixed header and bottom navigation.
  const initialSource = await source.boundingBox();
  const initialTarget = await targetGroup.boundingBox();
  await page.evaluate(({source,target}) => window.scrollBy({top:Math.min(source.y,target.y)-80,behavior:'instant'}),{source:initialSource,target:initialTarget});
  const sourceBox = await source.boundingBox();
  const targetBox = await targetGroup.boundingBox();
  expect(sourceBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  const from = { x: Math.round(sourceBox.x + sourceBox.width / 2), y: Math.round(sourceBox.y + sourceBox.height / 2) };
  const to = { x: Math.round(targetBox.x + targetBox.width / 2), y: Math.round(targetBox.y + targetBox.height / 2) };
  await expect.poll(() => source.evaluate((node,p)=>node.contains(document.elementFromPoint(p.x,p.y)),from)).toBe(true);
  await expect.poll(() => targetGroup.evaluate((node,p)=>node.contains(document.elementFromPoint(p.x,p.y)),to)).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  const point = (position) => [{ ...position, id: 1, radiusX: 5, radiusY: 5, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
  const scrollAtStart = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(holdMs);
  if (duringHold) await duringHold(source);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(to) });
  await page.waitForTimeout(holdMs);
  return {
    scrollAtStart,
    end: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    cancel: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }),
  };
}

async function startTouchHold(page, source, holdMs, pointId = 7) {
  await source.scrollIntoViewIfNeeded();
  await source.evaluate((node) => {
    node.addEventListener('pointerdown', (event) => { window.__groupsLastPointerId = event.pointerId; }, { once: true });
  });
  const box = await source.boundingBox();
  expect(box).toBeTruthy();
  const start = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  const cdp = await page.context().newCDPSession(page);
  const points = (position) => [{ ...position, id: pointId, radiusX: 5, radiusY: 5, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(start) });
  await page.waitForTimeout(holdMs);
  return {
    start,
    pointerId: await page.evaluate(() => window.__groupsLastPointerId),
    moveTo: (position) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(position) }),
    end: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    cancel: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }),
  };
}

async function expectTouchIdle(page) {
  await expect(page.locator('.groups-page')).not.toHaveClass(/is-touch-drag-active/);
  await expect(page.locator('.group__member.is-touch-dragging')).toHaveCount(0);
  await expect(page.locator('.group[data-drop-state]')).toHaveCount(0);
}

const savedArrangement = (page) => page.evaluate((id) => window.store.groupArrangementOf(id)?.groups, teachingId);

test('direct touch handle moves repeatedly without duplicates and persists', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 320, height: 760 });
  await seedGroups(page, 12);

  const movingId = await page.locator('.group').nth(0).locator('.group__member').first().getAttribute('data-student-id');
  const sourceMember = () => page.locator(`.group__member[data-student-id="${movingId}"]`);
  const sourceHandle = () => sourceMember().locator('.group__drag-handle');

  const beforeInvalid = await savedArrangement(page);
  const sameGroupIndex = beforeInvalid.findIndex((group) => group.includes(movingId));
  const invalidDrag = await touchDrag(page, sourceHandle(), page.locator('.group').nth(sameGroupIndex));
  await expect(sourceMember()).toHaveClass(/is-touch-dragging/);
  await expect(page.locator('.group').nth(sameGroupIndex)).toHaveAttribute('data-drop-state', 'invalid');
  await invalidDrag.end();
  await expect.poll(() => savedArrangement(page)).toEqual(beforeInvalid);

  const firstTarget = sameGroupIndex === 0 ? 1 : 0;
  const validDrag = await touchDrag(page, sourceHandle(), page.locator('.group').nth(firstTarget));
  await expect(sourceMember()).toHaveClass(/is-touch-dragging/);
  await expect(page.locator('.group').nth(firstTarget)).toHaveAttribute('data-drop-state', 'valid');
  expect(await page.evaluate(() => window.scrollY)).toBe(validDrag.scrollAtStart);
  await validDrag.end();
  await expect.poll(() => savedArrangement(page)).not.toEqual(beforeInvalid);
  await expect(page.locator('.group').nth(firstTarget).locator(`.group__member[data-student-id="${movingId}"]`)).toBeVisible();
  await expectTouchIdle(page);

  let arrangement = await savedArrangement(page);
  expect(arrangement.flat().filter((id) => id === movingId)).toHaveLength(1);
  expect(new Set(arrangement.flat()).size).toBe(12);

  const currentIndex = arrangement.findIndex((group) => group.includes(movingId));
  const secondTarget = [0, 1, 2].find((index) => index !== currentIndex);
  const repeatedDrag = await touchDrag(page, sourceHandle(), page.locator('.group').nth(secondTarget));
  await repeatedDrag.end();
  await expect.poll(async () => (await savedArrangement(page)).findIndex((group) => group.includes(movingId))).toBe(secondTarget);
  arrangement = await savedArrangement(page);
  expect(arrangement.flat().filter((id) => id === movingId)).toHaveLength(1);

  await page.reload();
  await page.waitForFunction(() => window.store?.state?.ready === true);
  expect(await savedArrangement(page)).toEqual(arrangement);
  expect(errors).toEqual([]);
});

test('long press lifecycle always moves or returns to a clean idle state', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await seedGroups(page, 16);
  const movingId = await page.locator('.group').nth(0).locator('.group__member').first().getAttribute('data-student-id');
  const member = () => page.locator(`.group__member[data-student-id="${movingId}"]`);
  const handle = () => member().locator('.group__drag-handle');

  for (const holdMs of [500, 1000, 2000, 3000]) {
    const before = await savedArrangement(page);
    const fromIdx = before.findIndex((group) => group.includes(movingId));
    const toIdx = fromIdx === 0 ? 1 : 0;
    const drag = await touchDrag(page, handle(), page.locator('.group').nth(toIdx), { holdMs });
    await expect(member()).toHaveClass(/is-touch-dragging/);
    await expect(page.locator('.group').nth(toIdx)).toHaveAttribute('data-drop-state', 'valid');
    await drag.end();
    await expect.poll(async () => (await savedArrangement(page)).findIndex((group) => group.includes(movingId))).toBe(toIdx);
    await expectTouchIdle(page);
    await expect(page.locator('.group').nth(toIdx).locator(`.group__member[data-student-id="${movingId}"]`)).toBeVisible();
  }

  const beforeRelease = await savedArrangement(page);
  const release = await startTouchHold(page, handle(), 1000, 8);
  await release.end();
  await expectTouchIdle(page);
  expect(await savedArrangement(page)).toEqual(beforeRelease);

  const cancel = await startTouchHold(page, handle(), 1000, 9);
  await cancel.moveTo({ x: cancel.start.x, y: 2 });
  await cancel.cancel();
  await expectTouchIdle(page);

  const lostCapture = await startTouchHold(page, handle(), 500, 10);
  expect(await handle().evaluate((node, pointerId) => node.hasPointerCapture(pointerId), lostCapture.pointerId)).toBe(true);
  await handle().evaluate((node, pointerId) => node.releasePointerCapture(pointerId), lostCapture.pointerId);
  await handle().dispatchEvent('lostpointercapture', { pointerId: lostCapture.pointerId, pointerType: 'touch' });
  await expectTouchIdle(page);
  await lostCapture.cancel();

  const beforeFinal = await savedArrangement(page);
  const finalFromIdx = beforeFinal.findIndex((group) => group.includes(movingId));
  const finalToIdx = finalFromIdx === 0 ? 1 : 0;
  const finalTarget = page.locator('.group').nth(finalToIdx);
  const finalDrag = await touchDrag(page, handle(), finalTarget, {
    holdMs: 500,
    duringHold: async (grip) => {
      await grip.evaluate((node) => {
        window.__groupsContextMenuPrevented = null;
        node.addEventListener('contextmenu', (event) => {
          queueMicrotask(() => { window.__groupsContextMenuPrevented = event.defaultPrevented; });
        }, { once: true });
      });
      await grip.dispatchEvent('contextmenu');
      await expect.poll(() => page.evaluate(() => window.__groupsContextMenuPrevented)).toBe(true);
    },
  });
  await expect(member()).toHaveClass(/is-touch-dragging/);
  await expect(finalTarget).toHaveAttribute('data-drop-state', 'valid');
  await finalDrag.end();
  await expect.poll(async () => (await savedArrangement(page)).findIndex((group) => group.includes(movingId))).toBe(finalToIdx);
  const arrangement = await savedArrangement(page);
  expect(arrangement.flat().filter((id) => id === movingId)).toHaveLength(1);
  expect(new Set(arrangement.flat()).size).toBe(16);
});

test('mobile groups preserve normal scrolling, touch sizing, themes, and no overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 760 });
  await seedGroups(page, 24);

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => window.store.patchDevice({ theme: value }, { queue: false }), theme);
    await page.reload();
    for (const width of [320, 390, 412]) {
      await page.setViewportSize({ width, height: 760 });
      await expect(page.locator('.groups-touch-hint')).toBeVisible();
      const handleSizes = await page.locator('.group__drag-handle').evaluateAll((nodes) => nodes.slice(0, 8).map((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }));
      expect(handleSizes.every(({ width: w, height }) => w >= 44 && height >= 44), `${theme}/${width}`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${theme}/${width}`).toBe(true);
    }
  }

  await page.setViewportSize({ width: 320, height: 760 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const memberName = page.locator('.group__member-name').first();
  await memberName.scrollIntoViewIfNeeded();
  const box = await memberName.boundingBox();
  const before = await page.evaluate(() => window.scrollY);
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 3, radiusX: 5, radiusY: 5, force: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 180, id: 3, radiusX: 5, radiusY: 5, force: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);

  const scan = await new AxeBuilder({ page }).include('.groups-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.filter(({ impact }) => impact === 'critical')).toEqual([]);
  expect(errors).toEqual([]);
});

test('desktop drag and keyboard tap-to-move fallback remain available', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedGroups(page, 12);
  await expect(page.locator('.groups-touch-hint')).toBeHidden();

  const desktopMember = page.locator('.group').nth(0).locator('.group__member').first();
  const desktopId = await desktopMember.getAttribute('data-student-id');
  await desktopMember.dragTo(page.locator('.group').nth(1));
  await expect.poll(async () => (await savedArrangement(page)).findIndex((group) => group.includes(desktopId))).toBe(1);
  await page.waitForTimeout(150);

  const keyboardMember = page.locator('.group').nth(0).locator('.group__member').first();
  const keyboardId = await keyboardMember.getAttribute('data-student-id');
  await keyboardMember.focus();
  await page.keyboard.press('Enter');
  const moveButton = page.locator('.group').nth(2).getByRole('button', { name: /نقل/ });
  await moveButton.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await savedArrangement(page)).findIndex((group) => group.includes(keyboardId))).toBe(2);

  const arrangement = await savedArrangement(page);
  expect(new Set(arrangement.flat()).size).toBe(12);
  expect(arrangement.flat()).toHaveLength(12);
  expect(errors).toEqual([]);
});
