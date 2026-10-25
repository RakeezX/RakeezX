import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

function expectSingleCertificatePdf(pdf, jpegDataUrl) {
  const text = pdf.toString('latin1');
  expect(text).toMatch(/^%PDF-1\.[4-7]/);
  expect(text).toMatch(/%%EOF\s*$/);
  expect((text.match(/\/Type\s*\/Page\b/g) || []).length).toBe(1);
  expect((text.match(/\/Subtype\s*\/Image\b/g) || []).length).toBe(1);
  const box = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  expect(box).not.toBeNull();
  expect(Number(box[1])).toBeCloseTo(841.8898, 1);
  expect(Number(box[2])).toBeCloseTo(595.2756, 1);
  const xref = Number(text.match(/startxref\s+(\d+)\s+%%EOF/)[1]);
  expect(text.slice(xref, xref + 4)).toBe('xref');
  const imageAt = text.indexOf('/Subtype /Image');
  const streamAt = text.indexOf('stream\n', imageAt) + 'stream\n'.length;
  const dictionary = text.slice(imageAt, streamAt);
  expect(dictionary).toMatch(/\/Width\s+2970\b/);
  expect(dictionary).toMatch(/\/Height\s+2100\b/);
  expect(dictionary).toMatch(/\/Filter\s*\/DCTDecode/);
  const length = Number(dictionary.match(/\/Length\s+(\d+)/)[1]);
  expect(pdf.subarray(streamAt, streamAt + length)).toEqual(Buffer.from(jpegDataUrl.split(',')[1], 'base64'));
}

async function expectPaintedMinistryLogo(canvas, previousCount = 0) {
  await expect.poll(() => canvas.evaluate(node => node.__ministryLogoDraws?.length ?? 0)).toBeGreaterThan(previousCount);
  const proof = await canvas.evaluate(node => node.__ministryLogoDraws.at(-1));
  expect(proof.decoded).toBe(true);
  expect((proof.x + proof.width / 2) * proof.scaleX).toBeCloseTo(proof.canvasWidth / 2, 6);
  expect(proof.width / proof.height).toBeCloseTo(proof.naturalWidth / proof.naturalHeight, 8);
  return canvas.evaluate(node => node.__ministryLogoDraws.length);
}

async function expectPaintedThuluth(canvas, theme = 'gold') {
  const proof = await canvas.evaluate(node => node.__certificateTitleDraws?.at(-1));
  expect(proof?.decoded).toBe(true);
  expect(proof.src).toContain(`/assets/certificates/title-approved-first-${theme}.svg`);
  expect([proof.naturalWidth, proof.naturalHeight]).toEqual([766, 165]);
  expect((proof.x + proof.width / 2) * proof.scaleX).toBeCloseTo(proof.canvasWidth / 2, 6);
  expect(proof.width / proof.height).toBeCloseTo(766 / 165, 8);
  expect(proof.y).toBeGreaterThanOrEqual(200);
  expect(proof.y + proof.height).toBeLessThan(379);
  expect(await canvas.evaluate(node => node.__certificateHeaderFont)).toContain('Rakeez Certificate Header');
}

test('certificate edits appreciation text and directly exports the current image without a review checkbox', async ({ page, context, baseURL }, testInfo) => {
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
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      const result = drawImage.call(this, image, ...args);
      if (image instanceof HTMLImageElement && image.src.includes('/assets/brand/ministry-of-education')) {
        const [x, y, width, height] = args.slice(-4);
        (this.canvas.__ministryLogoDraws ??= []).push({
          decoded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight, x, y, width, height,
          scaleX: this.getTransform().a, canvasWidth: this.canvas.width,
        });
      }
      if (image instanceof HTMLImageElement && image.src.includes('/assets/certificates/title-approved-first-')) {
        const [x, y, width, height] = args.slice(-4);
        (this.canvas.__certificateTitleDraws ??= []).push({
          src: image.src, decoded: image.complete && image.naturalWidth > 0,
          naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
          x, y, width, height, scaleX: this.getTransform().a, canvasWidth: this.canvas.width,
        });
      }
      return result;
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.font.includes('Rakeez Certificate Header')) this.canvas.__certificateHeaderFont = this.font;
      return fillText.call(this, text, ...args);
    };
    // Observe the application's actual isolated print document without opening an OS dialog.
    window.print = () => {
      window.top.__certificatePrintProof = {
        isolated: window !== window.top,
        title: document.title, parentTitle: window.top.document.title,
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
      scores: store.state.scores.filter(score => score.studentId === student.id).map(score => ({ ...score, ...common, deleted: true })),
      logs: store.state.logs.filter(log => log.studentId === student.id).map(log => ({ ...log, ...common, deleted: true })),
    });
    return { studentId: student.id, teachingId: teaching.id, name, className: store.sectionLabel(store.getSection(teaching.sectionId)), identity: { ...identity, principalName: identity.reportPrincipalName } };
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
  const message = sheet.locator('[data-certificate-text]');
  await expect(editor).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(editor.locator('[data-certificate-name]')).toHaveCount(0);
  await expect(editor.locator('[data-certificate-medal]')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.name));
  for (const key of ['schoolName', 'educationDepartment', 'teacherName', 'principalName']) {
    await expect(editor.locator(`[data-certificate-meta="${key}"]`)).toHaveValue(fixture.identity[key]);
    await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.identity[key]));
  }
  await expect(editor.locator('[data-certificate-field]')).toHaveCount(0);
  await expect(message).toHaveValue('تقديرًا لجهوده المتميزة، واجتهاده ومثابرته في طلب العلم، وتشجيعًا له على مواصلة مسيرة التميّز والإبداع، سائلين الله له دوام التوفيق والسداد');
  await expect(sheet.locator('[data-certificate-confirm]')).toHaveCount(0);
  await expect(sheet).not.toContainText('راجعت الشهادة وأوافق');
  await expect(sheet.locator('[data-certificate-download]')).toBeEnabled();
  await expect(sheet.locator('[data-certificate-print]')).toBeEnabled();
  await expect(sheet.locator('[data-certificate-pdf]')).toBeEnabled();
  await expectPaintedMinistryLogo(canvas);
  await expectPaintedThuluth(canvas);
  expect(await page.evaluate(() => [...document.fonts].some(face => face.family.replaceAll('\"', '') === 'Rakeez Certificate Header' && face.status === 'loaded'))).toBe(true);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/assets/fonts/noto-naskh-arabic/NotoNaskhArabic-Bold.ttf')))).toBe(true);
  await message.fill('');
  await expect(sheet.locator('[data-certificate-download]')).toBeDisabled();
  await expect(sheet.locator('[data-certificate-print]')).toBeDisabled();
  await expect(sheet.locator('[data-certificate-pdf]')).toBeDisabled();
  const customText = 'وذلك تقديرًا لمثابرته وإبداعه في مادة المهارات الرقمية.\nنعتز بجهده، ونسأل الله له دوام التوفيق والسداد.';
  await message.fill(customText);
  await expect(canvas).toHaveAttribute('aria-label', /نعتز بجهده/);
  await expect(canvas).not.toHaveAttribute('aria-label', /بنود بدرجة كاملة|مشاركات إيجابية/);
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.name));
  await expect(canvas).toHaveAttribute('aria-label', /بيانات تجريبية/);
  await expect(sheet.locator('[data-certificate-download]')).toBeEnabled();
  await expect(sheet.locator('[data-certificate-print]')).toBeEnabled();
  await expect(sheet.locator('[data-certificate-pdf]')).toBeEnabled();
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
  await expect(sheet.locator('[data-certificate-download]')).toBeEnabled();
  const beforeSchool = await canvas.evaluate(node => node.__ministryLogoDraws.length);
  await editor.locator('[data-certificate-design][value="school"]').check();
  const beforeOrnate = await expectPaintedMinistryLogo(canvas, beforeSchool);
  await expectPaintedThuluth(canvas, 'green');
  await expect(sheet.locator('[data-certificate-download]')).toBeEnabled();
  await editor.locator('[data-certificate-design][value="ornate"]').check();
  await expectPaintedMinistryLogo(canvas, beforeOrnate);
  await expectPaintedThuluth(canvas);
  const expectedImage = await canvas.evaluate(node => node.toDataURL('image/png'));
  const outgoing = [];
  const observe = request => outgoing.push(request.url());
  page.on('request', observe);
  const pendingDownload = page.waitForEvent('download');
  await sheet.locator('[data-certificate-download]').click();
  const download = await pendingDownload;
  const expectedFilename = `شهادة شكر وتقدير - ${fixture.name} - ${fixture.className.replace(/\s*[/\\]\s*/g, ' - ')}`;
  expect(download.suggestedFilename()).toBe(expectedFilename + '.png');
  const imagePath = testInfo.outputPath('certificate-output.png');
  await download.saveAs(imagePath);
  const png = await fs.readFile(imagePath);
  expect(png.readUInt32BE(16)).toBe(2970);
  expect(png.readUInt32BE(20)).toBe(2100);
  expect(png.toString('base64')).toBe(expectedImage.split(',')[1]);
  await expect(sheet.locator('[data-certificate-pdf]')).toBeEnabled();
  const expectedJpeg = await canvas.evaluate(node => node.toDataURL('image/jpeg', 0.98));
  const pendingPdf = page.waitForEvent('download');
  await sheet.locator('[data-certificate-pdf]').click();
  const pdfDownload = await pendingPdf;
  expect(pdfDownload.suggestedFilename()).toBe(expectedFilename + '.pdf');
  const pdfPath = testInfo.outputPath('certificate-direct-output.pdf');
  await pdfDownload.saveAs(pdfPath);
  expectSingleCertificatePdf(await fs.readFile(pdfPath), expectedJpeg);
  await expect(page.locator('iframe[data-certificate-print]')).toHaveCount(0);
  await expect(sheet.locator('[data-certificate-print]')).toBeEnabled();
  await expect(sheet.locator('[data-certificate-pdf]')).toBeEnabled();
  expect(outgoing).toEqual([]);
  page.off('request', observe);

  const originalTitle = await page.title();
  await sheet.locator('[data-certificate-print]').click();
  await page.waitForFunction(() => window.__certificatePrintProof);
  const proof = await page.evaluate(() => window.__certificatePrintProof);
  expect(proof.isolated).toBe(true);
  expect(proof.title).toBe(expectedFilename);
  expect(proof.parentTitle).toBe(expectedFilename);
  await expect(page).toHaveTitle(expectedFilename);
  expect(proof.images).toBe(1);
  expect(proof.text).toBe('');
  expect(proof.html).not.toContain('student-profile');
  expect(proof.html).not.toContain(fixture.studentId);
  expect(proof.html).toContain(expectedImage);
  await fs.writeFile(testInfo.outputPath('certificate-print.html'), proof.html);
  await page.evaluate(() => document.querySelector('[data-certificate-print]') && document.querySelector('iframe[data-certificate-print]')?.contentWindow.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('iframe[data-certificate-print]')).toHaveCount(0);
  await expect(page).toHaveTitle(originalTitle);
  await expect(sheet.locator('[data-certificate-download]')).toBeEnabled();
  await expect(sheet.locator('[data-certificate-print]')).toBeEnabled();
  await expect(sheet.locator('[data-certificate-pdf]')).toBeEnabled();
  await expect(sheet).not.toContainText('من نافذة الطباعة');

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
