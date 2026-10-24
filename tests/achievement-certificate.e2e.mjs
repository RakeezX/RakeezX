import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('certificate keeps explicit choices local, previews responsively and exports the reviewed image only', async ({ page, context, baseURL }, testInfo) => {
  const origin = new URL(baseURL).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const requested = new URL(route.request().url());
    return requested.origin === origin ? route.continue() : route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => {
    sessionStorage.setItem('rakeezx-demo-session-v1', 'active');
    // Observe the application's actual isolated print document without opening an OS dialog.
    window.print = () => {
      window.top.__certificatePrintProof = {
        isolated: window !== window.top,
        html: document.documentElement.outerHTML,
        images: document.images.length,
        text: document.body.innerText,
      };
    };
  });
  await page.goto('/#/classes');
  await page.waitForFunction(async () => {
    const store = await import('/src/store.js');
    return store.state.ready && store.getActiveWorkspace()?.type === 'demo' && store.state.students.length > 0;
  });
  await page.locator('.boot').waitFor({ state: 'detached' });
  const fixture = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    if (store.getActiveWorkspace()?.type !== 'demo') throw new Error('Synthetic Demo required');
    const student = store.state.students.find(item => !item.deleted);
    const enrollment = store.activeEnrollment(student.id);
    const teaching = store.teachings().find(item => item.sectionId === enrollment.sectionId);
    const common = { updatedAt: Date.now(), deleted: false };
    const identity = { schoolName: 'مدرسة ركيز للاختبار', educationDepartment: 'إدارة التعليم التجريبية', teacherName: 'معلم الحساب التجريبي', reportPrincipalName: 'مدير الحساب التجريبي' };
    await store.patchProfile(identity);
    const name = 'عبدالله بن عبدالرحمن بن محمد بن عبدالعزيز بن عبدالله آل مبدي العتيبي';
    await store.save({
      students: [{ ...student, name, ...common }],
      items: [{ id: 'demo:certificate:item', teachingId: teaching.id, name: 'تقييم تجريبي موثّق', max: 10, order: 99, ...common }],
      scores: [{ id: `sc:${student.id}:demo:certificate:item`, studentId: student.id, itemId: 'demo:certificate:item', value: 10, ...common }],
      logs: [{ id: 'demo:certificate:log', studentId: student.id, teachingId: teaching.id, kind: 'participation', delta: 1, date: '2026-10-20', ...common }],
    });
    return { studentId: student.id, teachingId: teaching.id, name, identity: { ...identity, principalName: identity.reportPrincipalName } };
  });
  await page.goto(`/#/student/${fixture.studentId}?teaching=${fixture.teachingId}`);
  const entry = page.locator('[data-act="achievement-certificate"]');
  await expect(entry).toBeVisible();
  const snapshot = await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await entry.click();
  const sheet = page.locator('.certificate-sheet');
  const editor = sheet.locator('.certificate-editor');
  const canvas = sheet.locator('[data-certificate-canvas]');
  const consent = sheet.locator('[data-certificate-confirm]');
  await expect(editor).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(editor.locator('[data-certificate-name]')).toHaveCount(0);
  await expect(editor.locator('[data-certificate-medal]')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.name));
  for (const key of ['schoolName', 'educationDepartment', 'teacherName', 'principalName']) {
    await expect(editor.locator(`[data-certificate-meta="${key}"]`)).toHaveValue(fixture.identity[key]);
    await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.identity[key]));
  }
  await expect(editor.locator('[data-certificate-field]:checked')).toHaveCount(0);
  await expect(sheet.locator('[data-certificate-download]')).toBeDisabled();
  await expect(sheet.locator('[data-certificate-print]')).toBeDisabled();
  await expect(editor.locator('[data-certificate-field="attendance"]')).toHaveCount(0);
  await editor.locator('[data-certificate-field="participation"]').check();
  await editor.locator('[data-certificate-field="scores"]').check();
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.name));
  await expect(canvas).toHaveAttribute('aria-label', /بيانات تجريبية/);
  await consent.check();
  await page.screenshot({ path: testInfo.outputPath('certificate-desktop.png'), fullPage: false });

  await sheet.locator('[data-certificate-expand]').click();
  const preview = page.locator('.document-preview-sheet');
  await expect(preview).toBeVisible();
  await preview.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))));
  await expect(sheet.locator('..')).toHaveAttribute('inert', '');
  const previewCanvas = preview.locator('canvas');
  const initialWidth = (await previewCanvas.boundingBox()).width;
  await preview.getByRole('button', { name: 'تكبير', exact: true }).click();
  expect((await previewCanvas.boundingBox()).width).toBeGreaterThan(initialWidth);
  await preview.getByRole('button', { name: 'ملاءمة للشاشة', exact: true }).click();
  await expect.poll(async () => (await previewCanvas.boundingBox()).width).toBeCloseTo(initialWidth, 0);
  await page.screenshot({ path: testInfo.outputPath('certificate-expanded.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(sheet.locator('[data-certificate-expand]')).toBeFocused();
  await expect(consent).toBeChecked();
  await editor.locator('[data-certificate-design][value="school"]').check();
  await expect(consent).not.toBeChecked();
  await expect(sheet.locator('[data-certificate-download]')).toBeDisabled();
  await editor.locator('[data-certificate-design][value="ornate"]').check();
  await consent.check();
  const outgoing = [];
  const observe = request => outgoing.push(request.url());
  page.on('request', observe);
  const pendingDownload = page.waitForEvent('download');
  await sheet.locator('[data-certificate-download]').click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('rakeez-achievement-certificate.png');
  const imagePath = testInfo.outputPath('certificate-output.png');
  await download.saveAs(imagePath);
  const png = await fs.readFile(imagePath);
  expect(png.readUInt32BE(16)).toBe(2970);
  expect(png.readUInt32BE(20)).toBe(2100);
  await expect(consent).not.toBeChecked();
  expect(outgoing).toEqual([]);
  page.off('request', observe);

  await consent.check();
  await sheet.locator('[data-certificate-print]').click();
  await page.waitForFunction(() => window.__certificatePrintProof);
  const proof = await page.evaluate(() => window.__certificatePrintProof);
  expect(proof.isolated).toBe(true);
  expect(proof.images).toBe(1);
  expect(proof.text).toBe('');
  expect(proof.html).not.toContain('student-profile');
  expect(proof.html).not.toContain(fixture.studentId);
  await fs.writeFile(testInfo.outputPath('certificate-print.html'), proof.html);
  await page.evaluate(() => document.querySelector('[data-certificate-print]') && document.querySelector('iframe[data-certificate-print]')?.contentWindow.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('iframe[data-certificate-print]')).toHaveCount(0);
  await expect(consent).not.toBeChecked();

  // Render the exact application-generated print document to a real one-page PDF.
  const printPage = await context.newPage();
  await printPage.route(origin + '/__certificate-print-proof', route => route.fulfill({ status: 200, contentType: 'text/html', body: proof.html }));
  await printPage.goto(origin + '/__certificate-print-proof');
  await printPage.locator('img').evaluate(image => image.decode());
  const pdf = await printPage.pdf({ path: testInfo.outputPath('certificate-output.pdf'), preferCSSPageSize: true, printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(1);
  await printPage.close();

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(editor).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await sheet.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await sheet.locator('[data-certificate-expand]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`certificate-mobile-${width}.png`), fullPage: false });
    await sheet.locator('[data-certificate-expand]').click();
    await expect(preview).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await previewCanvas.boundingBox();
    expect(bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`certificate-preview-${width}.png`), fullPage: false });
    if (width === 320) {
      for (let step = 0; step < 5; step += 1) await preview.getByRole('button', { name: 'تكبير', exact: true }).click();
      await expect(preview.locator('.document-preview__percent')).toHaveText('400%');
      expect((await previewCanvas.boundingBox()).width).toBeGreaterThan(1000);
      expect(await preview.locator('.document-preview__viewport').evaluate(node => { node.scrollLeft = node.scrollWidth; return node.scrollLeft > 0; })).toBe(true);
      await preview.getByRole('button', { name: 'ملاءمة للشاشة', exact: true }).click();
    }
    await page.keyboard.press('Escape');
    await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.name));
  }
  expect(await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state))).toBe(snapshot);
  await sheet.locator('[data-sheet-close]').last().click();
  await expect(entry).toBeFocused();
  expect(errors).toEqual([]);
});
