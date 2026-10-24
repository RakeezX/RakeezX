import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('certificate center applies editable appreciation text to any chosen students and exports their isolated A4 pages', async ({ page, context, baseURL }, testInfo) => {
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
      teachingId: teaching.id, emptyTeachingId: emptyTeaching.id,
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
  const sheet = page.locator('.certificate-center-sheet');
  await expect(sheet).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const canvas = sheet.locator('[data-center-canvas]');
  const print = sheet.locator('[data-center-print]');
  const message = sheet.locator('[data-center-text]');
  const honors = sheet.locator('[data-center-honors]');
  const honorsHint = sheet.locator('#certificate-center-honors-hint');
  const search = sheet.locator('[data-center-search]');
  const collator = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });
  const expectedChoices = [...fixture.choices].sort((a, b) => a.grade - b.grade
    || collator.compare(a.section, b.section) || collator.compare(a.subject, b.subject)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(item => item.id);
  expect(await sheet.locator('[data-center-teaching] option').evaluateAll(options => options.map(option => option.value))).toEqual(expectedChoices);
  await expect(honors).toHaveText('أبطال التميّز');
  await expect(sheet.locator('[data-center-all]')).toHaveCount(0);
  await sheet.locator('[data-center-teaching]').selectOption(fixture.teachingId);
  const defaultHonorsHint = await honorsHint.innerText();
  await expect(honorsHint).toContainText('الدرجة الكاملة');
  await expect(honorsHint).toContainText('اكتمال رصدها');
  const stateBefore = await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state));
  await expect(sheet.locator('[data-center-names]')).toHaveCount(0);
  await expect(sheet.locator('[data-center-medal]')).toHaveCount(0);
  for (const key of ['schoolName', 'educationDepartment', 'teacherName', 'principalName']) {
    await expect(sheet.locator(`[data-center-meta="${key}"]`)).toHaveValue(fixture.identity[key]);
  }
  await expect(sheet.locator('[data-center-evidence]')).toHaveCount(0);
  await expect(message).toHaveValue('تقديرًا لجهوده المتميزة، واجتهاده ومثابرته في طلب العلم، وتشجيعًا له على مواصلة مسيرة التميّز والإبداع، سائلين الله له دوام التوفيق والسداد');
  await expect(sheet.locator('[data-center-confirm]')).toHaveCount(0);
  await expect(sheet).not.toContainText('راجعت شهادات الطلاب المحددين وأوافق');
  const defaultText = await message.inputValue();
  await expect(sheet.locator('[data-center-student]:checked')).toHaveCount(0);
  await expect(print).toBeDisabled();
  await expect(sheet.locator('[data-center-download]')).toBeDisabled();
  await sheet.locator(`[data-center-student="${fixture.noEvidenceId}"]`).check();
  await expect(print).toBeEnabled();
  await expect(sheet.locator('[data-center-download]')).toBeEnabled();
  await search.fill(fixture.noEvidenceName);
  await honors.click();
  await expect(search).toHaveValue('');
  expect(await sheet.locator('[data-center-student]:checked').evaluateAll(fields => fields.map(field => field.dataset.centerStudent))).toEqual(fixture.ids);
  await expect(sheet.locator(`[data-center-student="${fixture.noEvidenceId}"]`)).not.toBeChecked();
  await sheet.locator('[data-center-clear]').click();
  await expect(honorsHint).toHaveText(defaultHonorsHint);
  await sheet.locator('[data-center-teaching]').selectOption(fixture.emptyTeachingId);
  await expect(honorsHint).toHaveText(defaultHonorsHint);
  await honors.click();
  await expect(sheet.locator('[data-center-student]:checked')).toHaveCount(0);
  await expect(print).toBeDisabled();
  await expect(honorsHint).toContainText('لا يوجد طلاب مكتملة درجاتهم بالدرجة الكاملة');
  await expect(honorsHint).toContainText('يمكنك اختيار الطلاب يدويًا');
  await sheet.locator(`[data-center-student="${fixture.emptyStudentId}"]`).check();
  await expect(print).toBeEnabled();
  await expect(honorsHint).toHaveText(defaultHonorsHint);
  await sheet.locator('[data-center-teaching]').selectOption(fixture.teachingId);
  await expect(sheet.locator('[data-center-student]:checked')).toHaveCount(0);
  await expect(honorsHint).toHaveText(defaultHonorsHint);
  await honors.click();
  expect(await sheet.locator('[data-center-student]:checked').evaluateAll(fields => fields.map(field => field.dataset.centerStudent))).toEqual(fixture.ids);
  await expect(sheet.locator('[data-center-position]')).toHaveText('الشهادة 1 من 3');
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[0]));
  await expect(canvas).not.toHaveAttribute('aria-label', /بنود بدرجة كاملة|مشاركات إيجابية/);
  await page.screenshot({ path: testInfo.outputPath('certificate-center-default.png'), fullPage: false });
  await message.fill('نعتز بجهدك ومثابرتك، ونسأل الله لك التوفيق والسداد. '.repeat(14).slice(0, 600));
  await canvas.screenshot({ path: testInfo.outputPath('certificate-long-text.png') });
  await message.fill(defaultText);
  await sheet.locator('[data-center-tab="design"]').click();
  await sheet.locator('.certificate-center__metadata > summary').click();
  for (const [key, value] of Object.entries({ schoolName: 'مدرسة ركيز التجريبية', educationDepartment: 'إدارة التعليم — نموذج تجريبي', teacherName: 'عبدالله المعلم', principalName: 'أحمد المدير' })) {
    await sheet.locator(`[data-center-meta="${key}"]`).fill(value);
  }
  await expect(canvas).toHaveAttribute('aria-label', /مدرسة ركيز التجريبية/);
  await sheet.locator('[data-center-design="school"]').click();
  await expect(print).toBeEnabled();
  await expect(sheet.locator('[data-center-design="school"]')).toHaveAttribute('aria-pressed', 'true');
  await canvas.screenshot({ path: testInfo.outputPath('certificate-school-preview.png') });
  await fs.writeFile(testInfo.outputPath('certificate-school-output.png'), Buffer.from(await canvas.evaluate(node => node.toDataURL('image/png').split(',')[1]), 'base64'));
  await sheet.locator('[data-center-design="ornate"]').click();
  await canvas.screenshot({ path: testInfo.outputPath('certificate-ornate-preview.png') });
  await fs.writeFile(testInfo.outputPath('certificate-ornate-output.png'), Buffer.from(await canvas.evaluate(node => node.toDataURL('image/png').split(',')[1]), 'base64'));
  await sheet.locator('.certificate-center__metadata > summary').click();
  await page.screenshot({ path: testInfo.outputPath('certificate-center-designs.png'), fullPage: false });
  await sheet.locator('[data-center-tab="students"]').click();
  await message.fill('');
  await expect(print).toBeDisabled();
  await expect(sheet.locator('[data-center-download]')).toBeDisabled();
  const customText = 'وذلك تقديرًا لمثابرته وإبداعه في مادة المهارات الرقمية.\nنعتز بجهده، ونسأل الله له دوام التوفيق والسداد.';
  await message.fill(customText);
  await expect(canvas).toHaveAttribute('aria-label', /نعتز بجهده/);
  await expect(print).toBeEnabled();
  await expect(sheet.locator('[data-center-download]')).toBeEnabled();
  await sheet.locator('[data-center-next]').click();
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[1]));
  await expect(canvas).toHaveAttribute('aria-label', /نعتز بجهده/);
  await expect(print).toBeEnabled();
  await sheet.locator('[data-center-next]').click();
  await expect(canvas).toHaveAttribute('aria-label', new RegExp(fixture.names[2]));
  await expect(canvas).toHaveAttribute('aria-label', /نعتز بجهده/);
  await expect(sheet.locator('[data-center-next]')).toBeDisabled();
  await sheet.locator('[data-center-prev]').click();
  await sheet.locator('[data-center-prev]').click();
  await sheet.locator('[data-center-expand]').click();
  const expanded = page.locator('.document-preview-sheet');
  await expect(expanded).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(expanded).toHaveCount(0);
  await expect(sheet.locator('[data-center-expand]')).toBeFocused();
  await expect(print).toBeEnabled();
  await sheet.locator('.sheet__body').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('certificate-center-desktop.png'), fullPage: false });
  const outgoing = [];
  const observe = request => outgoing.push(request.url());
  const expectedImage = await canvas.evaluate(node => node.toDataURL('image/png'));
  page.on('request', observe);
  const pendingDownload = page.waitForEvent('download');
  await sheet.locator('[data-center-download]').click();
  const download = await pendingDownload;
  const pngPath = testInfo.outputPath('certificate-center-current.png');
  await download.saveAs(pngPath);
  const png = await fs.readFile(pngPath);
  expect(png.readUInt32BE(16)).toBe(2970);
  expect(png.readUInt32BE(20)).toBe(2100);
  expect(png.toString('base64')).toBe(expectedImage.split(',')[1]);
  await expect(print).toBeEnabled();
  await print.click();
  await page.waitForFunction(() => window.__certificateBatchProof);
  const proof = await page.evaluate(() => window.__certificateBatchProof);
  expect(proof.isolated).toBe(true);
  expect(proof.images).toBe(3);
  expect(proof.text).toBe('');
  expect(proof.html).not.toContain(fixture.ids[0]);
  expect(proof.html).not.toContain('certificate-center__roster');
  expect(proof.html).toContain(expectedImage);
  await page.evaluate(() => document.querySelector('iframe[data-certificate-print]')?.contentWindow.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('iframe[data-certificate-print]')).toHaveCount(0);
  await expect(print).toBeEnabled();
  await expect(sheet.locator('[data-center-download]')).toBeEnabled();
  await expect(sheet).not.toContainText('من نافذة الطباعة');
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
    await expect(print).toBeDisabled();
    await expect(sheet.locator('[data-center-download]')).toBeDisabled();
    await expect(message).toHaveValue(customText);
  }
  expect(await page.evaluate(async () => JSON.stringify((await import('/src/store.js')).state))).toBe(stateBefore);
  await sheet.locator('[data-sheet-close]').last().click();
  await expect(entry).toBeFocused();
  expect(errors).toEqual([]);
});
