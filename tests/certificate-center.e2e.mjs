import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('certificate center reviews multiple students and exports one isolated A4 page per chosen student', async ({ page, context, baseURL }, testInfo) => {
  const origin = new URL(baseURL).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => {
    sessionStorage.setItem('rakeezx-demo-session-v1', 'active');
    window.print = () => { window.top.__certificateBatchProof = { isolated: window !== window.top, html: document.documentElement.outerHTML, images: document.images.length, text: document.body.innerText }; };
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
    const teaching = store.teachings().find(item => store.students(item.id).length >= 4);
    const students = store.students(teaching.id).slice(0, 4);
    const common = { updatedAt: Date.now(), deleted: false };
    const names = ['عبدالله بن عبدالرحمن بن محمد بن عبدالعزيز بن عبدالله آل مبدي العتيبي', 'محمد أحمد التجريبي', 'خالد علي التجريبي'];
    const cleared = store.state.scores.filter(score => score.studentId === students[3].id).map(score => ({ ...score, ...common, deleted: true }));
    await store.save({
      students: students.slice(0, 3).map((student, index) => ({ ...student, name: names[index], ...common })),
      items: [{ id: 'demo:certificate-center:item', teachingId: teaching.id, name: 'تقييم تجريبي', max: 10, order: 99, ...common }],
      scores: [...cleared, ...students.slice(0, 3).map(student => ({ id: `sc:${student.id}:demo:certificate-center:item`, studentId: student.id, itemId: 'demo:certificate-center:item', value: 10, ...common }))],
    });
    const chosen = new Set(students.slice(0, 3).map(student => student.id));
    const ordered = store.students(teaching.id).filter(student => chosen.has(student.id));
    return { teachingId: teaching.id, ids: ordered.map(student => student.id), noEvidenceId: students[3].id, names: ordered.map(student => student.name) };
  });
  await page.goto('/#/reports');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const entry = page.locator('[data-act="certificate-center"]');
  await expect(entry).toBeVisible();
  await entry.click();
  const sheet = page.locator('.certificate-center-sheet');
  await expect(sheet).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const canvas = sheet.locator('[data-center-canvas]');
  const consent = sheet.locator('[data-center-confirm]');
  const print = sheet.locator('[data-center-print]');
  await sheet.locator('[data-center-teaching]').selectOption(fixture.teachingId);
  const stateBefore = await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state));
  await expect(sheet.locator('[data-center-names]')).not.toBeChecked();
  await expect(sheet.locator('[data-center-evidence]:checked')).toHaveCount(0);
  await expect(sheet.locator('[data-center-student]:checked')).toHaveCount(0);
  await expect(print).toBeDisabled();
  await sheet.locator('[data-center-evidence="scores"]').check();
  await sheet.locator(`[data-center-student="${fixture.noEvidenceId}"]`).check();
  await expect(sheet.locator('[data-center-status]')).toContainText('بلا إنجاز');
  await expect(consent).toBeDisabled();
  await sheet.locator('[data-center-all]').click();
  await expect(sheet.locator(`[data-center-student="${fixture.noEvidenceId}"]`)).not.toBeChecked();
  await sheet.locator('[data-center-clear]').click();
  for (const id of fixture.ids) await sheet.locator(`[data-center-student="${id}"]`).check();
  await expect(sheet.locator('[data-center-position]')).toHaveText('الشهادة 1 من 3');
  await expect(canvas).not.toHaveAttribute('aria-label', new RegExp(fixture.names[0]));
  await sheet.locator('[data-center-names]').check();
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[0]));
  await sheet.locator('[data-center-tab="design"]').click();
  await sheet.locator('.certificate-center__metadata > summary').click();
  for (const [key, value] of Object.entries({ schoolName: 'مدرسة ركيز التجريبية', educationDepartment: 'إدارة التعليم — نموذج تجريبي', teacherName: 'عبدالله المعلم', principalName: 'أحمد المدير' })) {
    await sheet.locator(`[data-center-meta="${key}"]`).fill(value);
  }
  await expect(canvas).toHaveAttribute('aria-label', /مدرسة ركيز التجريبية/);
  await consent.check();
  await sheet.locator('[data-center-design="school"]').click();
  await expect(consent).not.toBeChecked();
  await expect(print).toBeDisabled();
  await expect(sheet.locator('[data-center-design="school"]')).toHaveAttribute('aria-pressed', 'true');
  await sheet.locator('[data-center-medal]').selectOption('laurel');
  await canvas.screenshot({ path: testInfo.outputPath('certificate-school-preview.png') });
  await fs.writeFile(testInfo.outputPath('certificate-school-output.png'), Buffer.from(await canvas.evaluate(node => node.toDataURL('image/png').split(',')[1]), 'base64'));
  await sheet.locator('[data-center-design="ornate"]').click();
  await sheet.locator('[data-center-medal]').selectOption('star');
  await canvas.screenshot({ path: testInfo.outputPath('certificate-ornate-preview.png') });
  await fs.writeFile(testInfo.outputPath('certificate-ornate-output.png'), Buffer.from(await canvas.evaluate(node => node.toDataURL('image/png').split(',')[1]), 'base64'));
  await sheet.locator('.certificate-center__metadata > summary').click();
  await page.screenshot({ path: testInfo.outputPath('certificate-center-designs.png'), fullPage: false });
  await sheet.locator('[data-center-tab="students"]').click();
  await consent.check();
  await sheet.locator('[data-center-next]').click();
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[1]));
  await expect(consent).toBeChecked();
  await sheet.locator('[data-center-next]').click();
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[2]));
  await expect(sheet.locator('[data-center-next]')).toBeDisabled();
  await sheet.locator('[data-center-prev]').click();
  await sheet.locator('[data-center-prev]').click();
  await sheet.locator('[data-center-expand]').click();
  const expanded = page.locator('.document-preview-sheet');
  await expect(expanded).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(expanded).toHaveCount(0);
  await expect(sheet.locator('[data-center-expand]')).toBeFocused();
  await expect(consent).toBeChecked();
  await sheet.locator('.sheet__body').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('certificate-center-desktop.png'), fullPage: false });
  const outgoing = [];
  const observe = request => outgoing.push(request.url());
  page.on('request', observe);
  const pendingDownload = page.waitForEvent('download');
  await sheet.locator('[data-center-download]').click();
  const download = await pendingDownload;
  const pngPath = testInfo.outputPath('certificate-center-current.png');
  await download.saveAs(pngPath);
  const png = await fs.readFile(pngPath);
  expect(png.readUInt32BE(16)).toBe(2970);
  expect(png.readUInt32BE(20)).toBe(2100);
  await expect(consent).not.toBeChecked();
  await consent.check();
  await print.click();
  await page.waitForFunction(() => window.__certificateBatchProof);
  const proof = await page.evaluate(() => window.__certificateBatchProof);
  expect(proof.isolated).toBe(true);
  expect(proof.images).toBe(3);
  expect(proof.text).toBe('');
  expect(proof.html).not.toContain(fixture.ids[0]);
  expect(proof.html).not.toContain('certificate-center__roster');
  await page.evaluate(() => document.querySelector('iframe[data-certificate-print]')?.contentWindow.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('iframe[data-certificate-print]')).toHaveCount(0);
  await expect(consent).not.toBeChecked();
  expect(outgoing).toEqual([]);
  page.off('request', observe);
  const printPage = await context.newPage();
  await printPage.route(origin + '/__certificate-batch-proof', route => route.fulfill({ status: 200, contentType: 'text/html', body: proof.html }));
  await printPage.goto(origin + '/__certificate-batch-proof');
  await printPage.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  const pdf = await printPage.pdf({ path: testInfo.outputPath('certificate-three-students.pdf'), preferCSSPageSize: true, printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(3);
  await printPage.close();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await sheet.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await canvas.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`certificate-center-mobile-${width}.png`), fullPage: false });
  }
  const choices = await sheet.locator('[data-center-teaching] option').evaluateAll(options => options.map(option => option.value));
  const otherTeaching = choices.find(id => id !== fixture.teachingId);
  if (otherTeaching) {
    await sheet.locator('[data-center-teaching]').selectOption(otherTeaching);
    await expect(sheet.locator('[data-center-student]:checked')).toHaveCount(0);
    await expect(consent).not.toBeChecked();
    await expect(print).toBeDisabled();
  }
  expect(await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state))).toBe(stateBefore);
  await sheet.locator('[data-sheet-close]').last().click();
  await expect(entry).toBeFocused();
  expect(errors).toEqual([]);
});
