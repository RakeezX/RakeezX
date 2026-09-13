import { test, expect } from '@playwright/test';

test('Schedule export creates a real privacy-safe RTL PNG in the browser', async ({ page }) => {
  await page.goto('/#/schedule');
  const results = [];
  for (const theme of ['light', 'dark', 'auto']) {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => window.store?.state?.ready);
    await page.evaluate(async theme => { await window.store.patchDevice({ theme }); window.store.applyTheme(); window.store.repaint(); }, theme);
    const result = await page.evaluate(async () => {
    const engine = await import('/src/lib/schedule-export.js');
    let canvas = null;
    const profile = {
      name: 'التوقيت الأساسي التجريبي',
      periods: [
        { period: 1, start: '07:00', end: '07:45' },
        { period: 2, start: '07:50', end: '08:35' },
      ],
      overrides: {},
    };
    const source = {
      state: { profile: { teacherName: 'معلم تجريبي', schoolName: 'مدرسة تجريبية', email: 'must-not-export@example.test' } },
      activeYear: () => ({ label: '1448-1449' }),
      activeTerm: () => ({ id: 'private-term-id', name: 'الفصل الدراسي الأول' }),
      activeTimeProfile: () => profile,
      allSlots: () => [{ id: 'private-slot-id', weekday: 0, period: 1, teachingId: 'private-teaching-id' }],
      getTeaching: () => ({ sectionId: 'private-section-id', subjectId: 'private-subject-id' }),
      getSection: () => ({ grade: 5, label: 'أ' }),
      getSubject: () => ({ name: 'المهارات الرقمية' }),
    };
    const model = engine.buildScheduleExportModel(source, {
      includeTeacherName: true,
      includeSchoolName: false,
      includeTimes: true,
    });
    const blob = await engine.renderSchedulePng(model, {
      createCanvas: () => {
        canvas = document.createElement('canvas');
        return canvas;
      },
    });
    return {
      width: canvas.width,
      height: canvas.height,
      blobType: blob.type,
      blobSize: blob.size,
      pngHash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
      model: JSON.stringify(model),
      printDocument: engine.schedulePrintDocument(model),
    };
  });

  expect(result.width).toBe(1600);
  expect(result.height).toBe(1200);
  expect(result.blobType).toBe('image/png');
  expect(result.blobSize).toBeGreaterThan(1000);
  expect(result.model).toContain('التوقيت الأساسي: التوقيت الأساسي التجريبي');
  expect(result.model).not.toContain('must-not-export@example.test');
  expect(result.model).not.toContain('private-slot-id');
  expect(result.printDocument).toContain('@page { size: A4 landscape;');
  expect(result.printDocument).not.toContain('التوقيت المعتمد');
    results.push(result);
    // The dedicated document must remain light, RTL, landscape, and independent
    // of app CSS even with browser background graphics disabled.
    const popup = await page.context().newPage();
    await popup.setContent(result.printDocument);
    await popup.emulateMedia({ media: 'print', colorScheme: 'dark' });
    const colors = await popup.evaluate(() => ({
      scheme: getComputedStyle(document.documentElement).colorScheme,
      canvas: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.body).color,
      border: getComputedStyle(document.querySelector('td')).borderTopColor,
      direction: getComputedStyle(document.body).direction,
    }));
    expect(colors).toEqual({ scheme: 'light only', canvas: 'rgb(255, 255, 255)', body: 'rgb(255, 255, 255)', text: 'rgb(22, 47, 53)', border: 'rgb(174, 191, 194)', direction: 'rtl' });
    await popup.close();
  }
  expect(results[1]).toEqual(results[0]);
  expect(results[2]).toEqual(results[0]);
});
