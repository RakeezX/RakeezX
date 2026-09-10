import { test, expect } from '@playwright/test';

test('Schedule export creates a real privacy-safe RTL PNG in the browser', async ({ page }) => {
  await page.goto('/#/schedule');
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
});
