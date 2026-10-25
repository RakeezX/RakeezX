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

test('certificate center downloads a separate named PNG and A4 PDF for every selected student', async ({ page, context, baseURL }, testInfo) => {
  // Full-size PNG/JPEG idle encoding can take about 6.7s per file in Chromium.
  // Cover sequential files and two intentionally paused encodes without retries.
  test.setTimeout(90000);
  const origin = new URL(baseURL).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
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
    window.print = () => { window.top.__certificatePrintCount = (window.top.__certificatePrintCount || 0) + 1; };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (Number.isInteger(window.__holdCertificateAfter) && window.__holdCertificateAfter-- === 0) {
        (window.__heldCertificateExports ??= []).push(() => toBlob.call(this, callback, ...args));
        return;
      }
      return toBlob.call(this, callback, ...args);
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
    const teaching = store.teachings().find(item => store.students(item.id).length >= 6 && store.items(item.id).length >= 2);
    const emptyTeaching = store.teachings().find(item => item.sectionId !== teaching?.sectionId && store.students(item.id).length && store.items(item.id).length);
    if (!teaching || !emptyTeaching) throw new Error('Two populated synthetic teachings are required');
    const students = store.students(teaching.id).slice(0, 6);
    const common = { updatedAt: Date.now(), deleted: false };
    const identity = { schoolName: 'مدرسة الحساب التجريبي', educationDepartment: 'إدارة التعليم من الحساب', teacherName: 'معلم من بيانات الحساب', reportPrincipalName: 'مدير من بيانات الحساب' };
    await store.patchProfile(identity);
    const names = ['عبدالله بن عبدالرحمن بن محمد بن عبدالعزيز بن عبدالله آل مبدي العتيبي', 'محمد أحمد التجريبي', 'خالد علي التجريبي'];
    // Only this fresh Demo context is changed. Make every chosen teaching item
    // manual/direct so the expected honors set is independent of seed scores.
    const fixtureItems = [...store.items(teaching.id), ...store.items(emptyTeaching.id)].map(item => ({
      ...item, ...common, auto: null, scoreMode: 'direct', distributionMode: null,
      portabilityGroupId: null, distributionOriginId: null, max: 10,
    }));
    const itemIds = new Set(fixtureItems.map(item => item.id));
    const targetItems = fixtureItems.filter(item => item.teachingId === teaching.id);
    const scoreWrites = new Map(store.state.scores.filter(score => itemIds.has(score.itemId))
      .map(score => [score.id, { ...score, ...common, deleted: true }]));
    for (const [studentIndex, student] of students.entries()) {
      for (const [itemIndex, item] of targetItems.entries()) {
        if (studentIndex === 5 || (studentIndex === 4 && itemIndex === targetItems.length - 1)) continue;
        const id = `sc:${student.id}:${item.id}`;
        scoreWrites.set(id, { id, studentId: student.id, itemId: item.id,
          value: studentIndex === 3 && itemIndex === 0 ? item.max - 1 : item.max, ...common });
      }
    }
    await store.save({
      students: students.slice(0, 3).map((student, index) => ({ ...student, name: names[index], ...common })),
      items: fixtureItems,
      scores: [...scoreWrites.values()],
    });
    const chosen = new Set(students.slice(0, 3).map(student => student.id));
    const ordered = store.students(teaching.id).filter(student => chosen.has(student.id));
    return {
      teachingId: teaching.id, className: store.sectionLabel(store.getSection(teaching.sectionId)), emptyTeachingId: emptyTeaching.id,
      emptyStudentId: store.students(emptyTeaching.id)[0].id,
      ids: ordered.map(student => student.id), noEvidenceId: students[5].id, noEvidenceName: students[5].name,
      names: ordered.map(student => student.name), identity: { ...identity, principalName: identity.reportPrincipalName },
      choices: store.teachings().map(item => ({ id: item.id, grade: Number(store.getSection(item.sectionId).grade),
        section: store.getSection(item.sectionId).label, subject: store.getSubject(item.subjectId)?.name ?? '' })),
    };
  });
  await page.goto('/#/reports');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const entry = page.locator('[data-act="certificate-center"]');
  await expect(entry).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('certificate-reports-spacing.png'), fullPage: false });
  await entry.click();
  const workspace = page.locator('.certificate-page');
  await expect(page).toHaveURL(/#\/reports\/certificates$/);
  await expect(workspace).toBeVisible();
  await expect(page.locator('.certificate-center-sheet')).toHaveCount(0);
  await expect(workspace.locator('[data-sheet-close]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const canvas = workspace.locator('[data-center-canvas]');
  const print = workspace.locator('[data-center-print]');
  const message = workspace.locator('[data-center-text]');
  await expect(workspace.locator('[data-center-panel=students]')).toBeVisible();
  await expect(workspace.locator('[data-center-panel=design]')).toBeHidden();
  await expect(workspace.locator('[data-center-panel=design] [data-center-text]')).toHaveCount(1);
  await expect(message).toBeHidden();
  const honors = workspace.locator('[data-center-honors]');
  const honorsHint = workspace.locator('#certificate-center-honors-hint');
  const search = workspace.locator('[data-center-search]');
  const collator = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });
  const expectedChoices = [...fixture.choices].sort((a, b) => a.grade - b.grade
    || collator.compare(a.section, b.section) || collator.compare(a.subject, b.subject)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(item => item.id);
  expect(await workspace.locator('[data-center-teaching] option').evaluateAll(options => options.map(option => option.value))).toEqual(expectedChoices);
  await expect(honors).toHaveText('أبطال التميّز');
  await expect(workspace.locator('[data-center-all]')).toHaveCount(0);
  await workspace.locator('[data-center-teaching]').selectOption(fixture.teachingId);
  const defaultHonorsHint = await honorsHint.innerText();
  await expect(honorsHint).toContainText('الدرجة الكاملة');
  await expect(honorsHint).toContainText('اكتمال رصدها');
  const stateBefore = await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state));
  await expect(workspace.locator('[data-center-names]')).toHaveCount(0);
  await expect(workspace.locator('[data-center-medal]')).toHaveCount(0);
  for (const key of ['schoolName', 'educationDepartment', 'teacherName', 'principalName']) {
    await expect(workspace.locator(`[data-center-meta="${key}"]`)).toHaveValue(fixture.identity[key]);
  }
  await expect(workspace.locator('[data-center-evidence]')).toHaveCount(0);
  await expect(message).toHaveValue('تقديرًا لجهوده المتميزة، واجتهاده ومثابرته في طلب العلم، وتشجيعًا له على مواصلة مسيرة التميّز والإبداع، سائلين الله له دوام التوفيق والسداد');
  await expect(workspace.locator('[data-center-confirm]')).toHaveCount(0);
  await expect(workspace).not.toContainText('راجعت شهادات الطلاب المحددين وأوافق');
  const defaultText = await message.inputValue();
  await expect(workspace.locator('[data-center-student]:checked')).toHaveCount(0);
  await expect(print).toBeDisabled();
  await expect(workspace.locator('[data-center-download]')).toBeDisabled();
  await workspace.locator(`[data-center-student="${fixture.noEvidenceId}"]`).check();
  await expect(print).toBeEnabled();
  await expect(workspace.locator('[data-center-download]')).toBeEnabled();
  await search.fill(fixture.noEvidenceName);
  await honors.click();
  await expect(search).toHaveValue('');
  expect(await workspace.locator('[data-center-student]:checked').evaluateAll(fields => fields.map(field => field.dataset.centerStudent))).toEqual(fixture.ids);
  await expect(workspace.locator(`[data-center-student="${fixture.noEvidenceId}"]`)).not.toBeChecked();
  await workspace.locator('[data-center-clear]').click();
  await expect(honorsHint).toHaveText(defaultHonorsHint);
  await workspace.locator('[data-center-teaching]').selectOption(fixture.emptyTeachingId);
  await expect(honorsHint).toHaveText(defaultHonorsHint);
  await honors.click();
  await expect(workspace.locator('[data-center-student]:checked')).toHaveCount(0);
  await expect(print).toBeDisabled();
  await expect(honorsHint).toContainText('لا يوجد طلاب مكتملة درجاتهم بالدرجة الكاملة');
  await expect(honorsHint).toContainText('يمكنك اختيار الطلاب يدويًا');
  await workspace.locator(`[data-center-student="${fixture.emptyStudentId}"]`).check();
  await expect(print).toBeEnabled();
  await expect(honorsHint).toHaveText(defaultHonorsHint);
  await workspace.locator('[data-center-teaching]').selectOption(fixture.teachingId);
  await expect(workspace.locator('[data-center-student]:checked')).toHaveCount(0);
  await expect(honorsHint).toHaveText(defaultHonorsHint);
  await honors.click();
  expect(await workspace.locator('[data-center-student]:checked').evaluateAll(fields => fields.map(field => field.dataset.centerStudent))).toEqual(fixture.ids);
  await expect(workspace.locator('[data-center-position]')).toHaveText('الشهادة 1 من 3');
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[0]));
  await expect(canvas).not.toHaveAttribute('aria-label', /بنود بدرجة كاملة|مشاركات إيجابية/);
  await expectPaintedMinistryLogo(canvas);
  await expectPaintedThuluth(canvas);
  expect(await page.evaluate(() => [...document.fonts].some(face => face.family.replaceAll('\"', '') === 'Rakeez Certificate Header' && face.status === 'loaded'))).toBe(true);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/assets/fonts/noto-naskh-arabic/NotoNaskhArabic-Bold.ttf')))).toBe(true);
  const previewWidth = await canvas.evaluate(node => {
    const parent = node.closest('.certificate-center__preview');
    const style = getComputedStyle(parent);
    return { actual: node.getBoundingClientRect().width, available: parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
  });
  expect(previewWidth.actual).toBeGreaterThanOrEqual(previewWidth.available - 4);
  const toggleControls = workspace.locator('[data-center-toggle-controls]');
  await expect(toggleControls).toHaveAttribute('aria-expanded', 'true');
  await expect(toggleControls).toContainText('إخفاء الإعدادات');
  await toggleControls.click();
  await expect(toggleControls).toHaveAttribute('aria-expanded', 'false');
  await expect(toggleControls).toContainText('إظهار الإعدادات');
  await expect(workspace.locator('.certificate-center__controls')).toBeHidden();
  await expect.poll(() => canvas.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(previewWidth.actual);
  await toggleControls.click();
  await expect(toggleControls).toHaveAttribute('aria-expanded', 'true');
  await expect(toggleControls).toContainText('إخفاء الإعدادات');
  await expect(workspace.locator('.certificate-center__controls')).toBeVisible();
  expect(await workspace.locator('[data-center-student]:checked').evaluateAll(fields => fields.map(field => field.dataset.centerStudent))).toEqual(fixture.ids);
  await expect(message).toHaveValue(defaultText);
  await page.screenshot({ path: testInfo.outputPath('certificate-center-default.png'), fullPage: false });
  await workspace.locator('[data-center-tab=design]').click();
  await expect(message).toBeVisible();
  await expect(workspace.locator('[data-center-panel=students]')).toBeHidden();
  await message.fill('نعتز بجهدك ومثابرتك، ونسأل الله لك التوفيق والسداد. '.repeat(14).slice(0, 600));
  await canvas.screenshot({ path: testInfo.outputPath('certificate-long-text.png') });
  await message.fill(defaultText);
  await workspace.locator('.certificate-center__metadata > summary').click();
  for (const [key, value] of Object.entries({ schoolName: 'مدرسة ركيز التجريبية', educationDepartment: 'إدارة التعليم — نموذج تجريبي', teacherName: 'عبدالله المعلم', principalName: 'أحمد المدير' })) {
    await workspace.locator(`[data-center-meta="${key}"]`).fill(value);
  }
  await expect(canvas).toHaveAttribute('aria-label', /مدرسة ركيز التجريبية/);
  const beforeSchool = await canvas.evaluate(node => node.__ministryLogoDraws.length);
  await workspace.locator('[data-center-design="school"]').click();
  const beforeOrnate = await expectPaintedMinistryLogo(canvas, beforeSchool);
  await expectPaintedThuluth(canvas, 'green');
  await expect(print).toBeEnabled();
  await expect(workspace.locator('[data-center-design="school"]')).toHaveAttribute('aria-pressed', 'true');
  await canvas.screenshot({ path: testInfo.outputPath('certificate-school-preview.png') });
  await fs.writeFile(testInfo.outputPath('certificate-school-output.png'), Buffer.from(await canvas.evaluate(node => node.toDataURL('image/png').split(',')[1]), 'base64'));
  await workspace.locator('[data-center-design="ornate"]').click();
  await expectPaintedMinistryLogo(canvas, beforeOrnate);
  await expectPaintedThuluth(canvas);
  await canvas.screenshot({ path: testInfo.outputPath('certificate-ornate-preview.png') });
  await fs.writeFile(testInfo.outputPath('certificate-ornate-output.png'), Buffer.from(await canvas.evaluate(node => node.toDataURL('image/png').split(',')[1]), 'base64'));
  await workspace.locator('.certificate-center__metadata > summary').click();
  await page.screenshot({ path: testInfo.outputPath('certificate-center-designs.png'), fullPage: false });
  await message.fill('');
  await expect(print).toBeDisabled();
  await expect(workspace.locator('[data-center-download]')).toBeDisabled();
  const customText = 'وذلك تقديرًا لمثابرته وإبداعه في مادة المهارات الرقمية.\nنعتز بجهده، ونسأل الله له دوام التوفيق والسداد.';
  await message.fill(customText);
  await expect(canvas).toHaveAttribute('aria-label', /نعتز بجهده/);
  await expect(print).toBeEnabled();
  await expect(workspace.locator('[data-center-download]')).toBeEnabled();
  const expectedImages = [], expectedJpegs = [];
  const captureCertificate = async () => {
    const images = await canvas.evaluate(node => ({ png: node.toDataURL('image/png'), jpeg: node.toDataURL('image/jpeg', 0.98) }));
    expectedImages.push(images.png); expectedJpegs.push(images.jpeg);
  };
  await captureCertificate();
  await workspace.locator('[data-center-tab=students]').click();
  await expect(message).toBeHidden();
  await workspace.locator('[data-center-next]').click();
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[1]));
  await expect(canvas).toHaveAttribute('aria-label', /نعتز بجهده/);
  await captureCertificate();
  await expect(print).toBeEnabled();
  await workspace.locator('[data-center-next]').click();
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[2]));
  await expect(canvas).toHaveAttribute('aria-label', /نعتز بجهده/);
  await captureCertificate();
  await expect(workspace.locator('[data-center-next]')).toBeDisabled();
  await workspace.locator('[data-center-prev]').click();
  await workspace.locator('[data-center-prev]').click();
  await workspace.locator('[data-center-expand]').click();
  const expanded = page.locator('.document-preview-sheet');
  await expect(expanded).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(expanded).toHaveCount(0);
  await expect(workspace.locator('[data-center-expand]')).toBeFocused();
  await expect(print).toBeEnabled();
  await workspace.locator('[data-center-back]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('certificate-center-desktop.png'), fullPage: false });
  const outgoing = [];
  const observe = request => outgoing.push(request.url());
  const pngButton = workspace.locator('[data-center-download]');
  const exportStatus = workspace.locator('[data-center-export-status]');
  const safeClass = fixture.className.replace(/\s*[/\\]\s*/g, ' - ');
  const originalTitle = await page.title();
  page.on('request', observe);
  for (const [format, button] of [['png', pngButton], ['pdf', print]]) {
    const downloads = [];
    const collect = download => downloads.push(download);
    page.on('download', collect);
    await button.click();
    // Chromium's native A4 PNG encoder can dispatch its first download after about seven seconds.
    await expect.poll(() => downloads.length, { timeout: 30000 }).toBe(fixture.names.length);
    await expect(button).toBeEnabled();
    page.off('download', collect);
    expect(downloads).toHaveLength(fixture.names.length);
    expect(new Set(downloads.map(download => download.suggestedFilename())).size).toBe(fixture.names.length);
    for (const [index, download] of downloads.entries()) {
      expect(download.suggestedFilename()).toBe(`شهادة شكر وتقدير - ${fixture.names[index]} - ${safeClass}.${format}`);
      const outputPath = testInfo.outputPath(`certificate-student-${index + 1}.${format}`);
      await download.saveAs(outputPath);
      const data = await fs.readFile(outputPath);
      if (format === 'png') {
        expect(data.readUInt32BE(16)).toBe(2970);
        expect(data.readUInt32BE(20)).toBe(2100);
        expect(data.toString('base64')).toBe(expectedImages[index].split(',')[1]);
      } else {
        expectSingleCertificatePdf(data, expectedJpegs[index]);
        expect(data.toString('latin1')).not.toContain(fixture.ids[index]);
      }
    }
    await expect(exportStatus).toContainText('3 ملفات مستقلة');
    await expect(page.locator('iframe[data-certificate-print]')).toHaveCount(0);
    await expect(page).toHaveTitle(originalTitle);
  }
  expect(await page.evaluate(() => window.__certificatePrintCount || 0)).toBe(0);
  await expect(workspace).not.toContainText('من نافذة الطباعة');

  // Pause encoding of the second file so stopping the remainder is deterministic.
  const stoppedDownloads = [];
  const collectStopped = download => stoppedDownloads.push(download);
  page.on('download', collectStopped);
  await page.evaluate(() => { window.__holdCertificateAfter = 1; window.__heldCertificateExports = []; });
  await pngButton.click();
  await page.waitForFunction(() => window.__heldCertificateExports?.length === 1);
  await expect.poll(() => stoppedDownloads.length).toBe(1);
  await expect(workspace.locator('[data-center-cancel]')).toBeVisible();
  await workspace.locator('[data-center-cancel]').click();
  await page.evaluate(() => {
    delete window.__holdCertificateAfter;
    window.__heldCertificateExports.splice(0).forEach(release => release());
  });
  // Cancellation is applied after the pending native PNG encode returns.
  await expect(pngButton).toBeEnabled({ timeout: 15000 });
  await expect(exportStatus).toContainText('توقف التجهيز بعد 1 من 3');
  expect(stoppedDownloads).toHaveLength(1);
  page.off('download', collectStopped);

  // A text edit while the first PDF is still encoding must invalidate the old selection snapshot.
  await workspace.locator('[data-center-tab=design]').click();
  const staleDownloads = [];
  const collectStale = download => staleDownloads.push(download);
  page.on('download', collectStale);
  await page.evaluate(() => { window.__holdCertificateAfter = 0; window.__heldCertificateExports = []; });
  await print.click();
  await page.waitForFunction(() => window.__heldCertificateExports?.length === 1);
  await message.fill('نص جديد أثناء تجهيز الشهادة.');
  await page.evaluate(() => {
    delete window.__holdCertificateAfter;
    window.__heldCertificateExports.splice(0).forEach(release => release());
  });
  await expect(print).toBeEnabled({ timeout: 15000 });
  await expect(exportStatus).toContainText('توقف التجهيز بعد 0 من 3');
  expect(staleDownloads).toHaveLength(0);
  page.off('download', collectStale);
  await message.fill(customText);
  await workspace.locator('[data-center-tab=students]').click();
  expect(outgoing).toEqual([]);
  page.off('request', observe);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await workspace.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await canvas.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`certificate-center-mobile-${width}.png`), fullPage: false });
  }
  const choices = await workspace.locator('[data-center-teaching] option').evaluateAll(options => options.map(option => option.value));
  const otherTeaching = choices.find(id => id !== fixture.teachingId);
  if (otherTeaching) {
    await workspace.locator('[data-center-teaching]').selectOption(otherTeaching);
    await expect(workspace.locator('[data-center-student]:checked')).toHaveCount(0);
    await expect(print).toBeDisabled();
    await expect(workspace.locator('[data-center-download]')).toBeDisabled();
    await expect(message).toHaveValue(customText);
  }
  expect(await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state))).toBe(stateBefore);
  await workspace.locator('[data-center-back]').click();
  await expect(page).toHaveURL(/#\/reports$/);
  await expect(entry).toBeVisible();
  // This is a real route: it must also open directly after a fresh document load.
  await page.goto('/#/reports/certificates');
  await expect(workspace).toBeVisible();
  await expect(workspace.locator('[data-center-student]:checked')).toHaveCount(0);
  await expect(workspace.locator('[data-center-print]')).toBeDisabled();
  await expect(workspace.locator('[data-center-back]')).toHaveAttribute('href', '#/reports');
  expect(errors).toEqual([]);
});

for (const failedAsset of ['/assets/brand/ministry-of-education', '/assets/certificates/title-approved-first-gold.svg']) {
test(`certificate page keeps exports unavailable after failed asset ${failedAsset}`, async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  let failedAssetRequests = 0;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes(failedAsset)) {
      failedAssetRequests += 1;
      return route.abort('failed');
    }
    return url.origin === origin ? route.continue() : route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'active'));
  await page.goto('/#/reports/certificates');
  await page.waitForFunction(async () => {
    const store = await import('/src/store.js');
    return store.state.ready && store.getActiveWorkspace()?.type === 'demo';
  });
  await page.locator('.boot').waitFor({ state: 'detached' });
  const workspace = page.locator('.certificate-page');
  await expect(workspace).toBeVisible();
  await workspace.locator('[data-center-student]').first().check();
  await expect(workspace.locator('[data-center-status]')).toBeVisible();
  await expect(workspace.locator('[data-center-status]')).toContainText(/شعار/);
  await expect(workspace.locator('[data-center-print]')).toBeDisabled();
  await expect(workspace.locator('[data-center-download]')).toBeDisabled();
  expect(failedAssetRequests).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
}

test('certificate identity follows current Rakeez data while explicit edits stay local to the open certificates', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'active'));
  await page.goto('/#/reports/certificates');
  await page.waitForFunction(async () => {
    const store = await import('/src/store.js');
    return store.state.ready && store.getActiveWorkspace()?.type === 'demo';
  });
  await page.locator('.boot').waitFor({ state: 'detached' });
  const workspace = page.locator('.certificate-page');
  await expect(workspace).toBeVisible();
  const initial = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const { EDUCATION_DEPARTMENTS } = await import('/src/lib/education-department-directory.js');
    if (store.getActiveWorkspace()?.type !== 'demo') throw new Error('Fresh synthetic Demo required');
    const profile = { schoolName: 'مدرسة البيانات التلقائية', educationDepartment: EDUCATION_DEPARTMENTS[0],
      teacherName: 'المعلم من ركيز', reportPrincipalName: 'المدير من ركيز' };
    await store.patchProfile(profile);
    return profile;
  });
  const field = key => workspace.locator(`[data-center-meta="${key}"]`);
  for (const key of ['schoolName', 'educationDepartment', 'teacherName']) await expect(field(key)).toHaveValue(initial[key]);
  await expect(field('principalName')).toHaveValue(initial.reportPrincipalName);
  await workspace.locator('[data-center-student]').first().check();
  await workspace.locator('[data-center-tab=design]').click();
  await workspace.locator('.certificate-center__metadata > summary').click();
  await field('teacherName').fill('توقيع خاص بهذه الشهادات');
  await field('principalName').fill('');
  const changed = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    const { EDUCATION_DEPARTMENTS } = await import('/src/lib/education-department-directory.js');
    if (store.getActiveWorkspace()?.type !== 'demo') throw new Error('Fresh synthetic Demo required');
    const profile = { schoolName: 'مدرسة بعد تحديث بيانات ركيز', educationDepartment: EDUCATION_DEPARTMENTS[1],
      teacherName: 'المعلم بعد التحديث', reportPrincipalName: 'المدير بعد التحديث' };
    await store.patchProfile(profile);
    return { profile, storedProfile: JSON.stringify(store.state.profile), device: JSON.stringify(store.state.device) };
  });
  await expect(field('schoolName')).toHaveValue(changed.profile.schoolName);
  await expect(field('educationDepartment')).toHaveValue(changed.profile.educationDepartment);
  await expect(field('teacherName')).toHaveValue('توقيع خاص بهذه الشهادات');
  await expect(field('principalName')).toHaveValue('');
  await expect(workspace.locator('[data-center-student]:checked')).toHaveCount(1);
  await expect(workspace.locator('[data-center-panel=design]')).toBeVisible();
  await expect(workspace.locator('[data-center-canvas]')).toHaveAttribute('aria-label', new RegExp(changed.profile.schoolName));
  const source = await page.evaluate(async () => {
    const store = await import('/src/store.js');
    return { profile: JSON.stringify(store.state.profile), device: JSON.stringify(store.state.device) };
  });
  expect(source).toEqual({ profile: changed.storedProfile, device: changed.device });
  await workspace.locator('[data-center-back]').click();
  await page.locator('[data-act="certificate-center"]').click();
  await expect(field('teacherName')).toHaveValue(changed.profile.teacherName);
  await expect(field('principalName')).toHaveValue(changed.profile.reportPrincipalName);
});

test('certificate export controls stay in place during press and processing on desktop and mobile', async ({ page, context, baseURL }, testInfo) => {
  const origin = new URL(baseURL).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => {
    sessionStorage.setItem('rakeezx-demo-session-v1', 'active');
    window.__pendingCertificateEncodes = [];
    // This layout check controls only the native encoder's completion; the
    // separate-file test above verifies real PNG and PDF bytes independently.
    HTMLCanvasElement.prototype.toBlob = function (callback) { window.__pendingCertificateEncodes.push(callback); };
  });
  const downloads = [];
  page.on('download', download => downloads.push(download));
  await page.goto('/#/reports/certificates');
  await page.waitForFunction(async () => {
    const store = await import('/src/store.js');
    return store.state.ready && store.getActiveWorkspace()?.type === 'demo';
  });
  await page.locator('.boot').waitFor({ state: 'detached' });
  const workspace = page.locator('.certificate-page');
  const png = workspace.locator('[data-center-download]');
  const pdf = workspace.locator('[data-center-print]');
  await workspace.locator('[data-center-student]').first().check();
  await expect(png).toBeEnabled();
  const positions = () => workspace.locator('[data-center-download], [data-center-print]').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
  }));
  const unchanged = (before, after) => before.forEach((rect, i) => {
    for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(rect[key] - after[i][key])).toBeLessThan(1);
  });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await png.scrollIntoViewIfNeeded();
    const before = await positions();
    const box = await png.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect(await png.evaluate(button => getComputedStyle(button).transform)).toBe('none');
    unchanged(before, await positions());
    await page.mouse.up();
    await page.waitForFunction(() => window.__pendingCertificateEncodes.length === 1);
    await expect(png).toHaveAttribute('aria-busy', 'true');
    await expect(png).toBeDisabled();
    await expect(pdf).toBeDisabled();
    unchanged(before, await positions());
    await png.dispatchEvent('click');
    await pdf.dispatchEvent('click');
    expect(await page.evaluate(() => window.__pendingCertificateEncodes.length)).toBe(1);
    expect(await workspace.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await workspace.locator('.certificate-page__exports').screenshot({ path: testInfo.outputPath(`certificate-export-busy-${width}.png`) });
    await workspace.locator('[data-center-cancel]').click();
    await page.evaluate(() => window.__pendingCertificateEncodes.splice(0).forEach(callback => callback(new Blob(['layout-only'], { type: 'image/png' }))));
    await expect(png).toBeEnabled();
    await expect(pdf).toBeEnabled();
    unchanged(before, await positions());
    await expect(png).toHaveAttribute('aria-busy', 'false');
  }
  expect(downloads).toHaveLength(0);
});
