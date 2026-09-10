import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEDULE_PNG_HEIGHT,
  SCHEDULE_PNG_WIDTH,
  buildScheduleExportModel,
  canShareScheduleFile,
  openSchedulePrint,
  renderSchedulePng,
  schedulePrintDocument,
  shareOrDownloadSchedule,
} from '../src/lib/schedule-export.js';

function fixture() {
  const baseProfile = {
    id: 'internal-base-profile',
    name: 'التوقيت الصيفي',
    periods: [
      { period: 1, start: '07:00', end: '07:45' },
      { period: 2, start: '07:50', end: '08:35' },
      { period: 3, start: '08:40', end: '09:25' },
    ],
    overrides: { 1: [{ period: 1, start: '07:05', end: '07:50' }, { period: 2, start: '07:55', end: '08:40' }, { period: 3, start: '08:45', end: '09:30' }] },
  };
  const effectiveOverride = {
    id: 'private-effective-profile',
    name: 'توقيت مؤقت سري',
    periods: [{ period: 1, start: '11:00', end: '11:20' }],
    activeFrom: '2026-09-01',
  };
  const teachings = {
    'internal-teaching-a': { id: 'internal-teaching-a', sectionId: 'internal-section-a', subjectId: 'internal-subject-a' },
    'internal-teaching-b': { id: 'internal-teaching-b', sectionId: 'internal-section-b', subjectId: 'internal-subject-b' },
  };
  const sections = {
    'internal-section-a': { id: 'internal-section-a', grade: 5, label: 'أ' },
    'internal-section-b': { id: 'internal-section-b', grade: 6, label: 'ب' },
  };
  const subjects = {
    'internal-subject-a': { id: 'internal-subject-a', name: 'المهارات الرقمية' },
    'internal-subject-b': { id: 'internal-subject-b', name: 'الحاسب الآلي' },
  };
  const source = {
    state: { profile: { teacherName: 'المعلم الاختباري', schoolName: 'مدرسة الاختبار', email: 'private@example.test' }, timeProfiles: [baseProfile, effectiveOverride], students: [{ name: 'طالب خاص' }] },
    activeYear: () => ({ id: 'internal-year', label: '1448-1449' }),
    activeTerm: () => ({ id: 'internal-term', name: 'الفصل الدراسي الأول' }),
    activeTimeProfile: () => baseProfile,
    resolveProfile: () => { throw new Error('Dated timing resolution must never run for weekly export.'); },
    allSlots: () => [
      { id: 'internal-slot-b', weekday: 2, period: 3, teachingId: 'internal-teaching-b', note: 'private slot metadata' },
      { id: 'internal-slot-a', weekday: 0, period: 1, teachingId: 'internal-teaching-a' },
    ],
    getTeaching: (id) => teachings[id] ?? null,
    getSection: (id) => sections[id] ?? null,
    getSubject: (id) => subjects[id] ?? null,
  };
  return { source, baseProfile, effectiveOverride };
}

test('weekly export model uses only base recurring timing and retains empty slots', () => {
  const { source } = fixture();
  const model = buildScheduleExportModel(source, {
    includeTeacherName: true,
    includeSchoolName: true,
    includeTimes: true,
  });

  assert.equal(model.identity.teacherName, 'المعلم الاختباري');
  assert.equal(model.identity.schoolName, 'مدرسة الاختبار');
  assert.deepEqual(model.academic, { year: '1448-1449', term: 'الفصل الدراسي الأول' });
  assert.equal(model.timing.label, 'التوقيت الأساسي: التوقيت الصيفي');
  assert.deepEqual(model.periods.map(({ period }) => period), [1, 2, 3]);
  assert.equal(model.days.length, 5);
  assert.equal(model.days.every((day) => day.periods.length === 3), true);
  assert.deepEqual(model.days[0].periods[0].time, { start: '07:00', end: '07:45' });
  assert.equal(model.days[0].periods[1].teaching, null);
  assert.deepEqual(model.days[2].periods[2].teaching, {
    classLabel: 'السادس الابتدائي / ب',
    subjectLabel: 'الحاسب الآلي',
  });
  assert.deepEqual(model.days[1].periods[0].time, { start: '07:05', end: '07:50' });
  assert.equal(JSON.stringify(model).includes('توقيت مؤقت سري'), false);
  assert.equal(JSON.stringify(model).includes('11:00'), false);
});

test('weekly export model excludes private data and optional identity when disabled', () => {
  const { source } = fixture();
  const model = buildScheduleExportModel(source, { includeTimes: false });
  const serialized = JSON.stringify(model);

  assert.deepEqual(model.identity, {});
  assert.equal(model.timing, null);
  assert.equal(model.days.every((day) => day.periods.every((cell) => cell.time === null)), true);
  for (const privateValue of [
    'private@example.test', 'طالب خاص', 'internal-teaching', 'internal-section',
    'internal-subject', 'internal-slot', 'internal-year', 'internal-term', 'private slot metadata',
  ]) assert.equal(serialized.includes(privateValue), false, privateValue);
});

test('canvas renderer creates a deterministic 1600x1200 RTL PNG Blob', async () => {
  const { source } = fixture();
  const model = buildScheduleExportModel(source, { includeTimes: true });
  const calls = [];
  const context = {
    save() {}, restore() {}, fillRect() {}, strokeRect() {},
    fillText(value) { calls.push(String(value)); },
    measureText(value) { return { width: String(value).length * 9 }; },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: (type) => type === '2d' ? context : null,
    toBlob(callback, type) { callback(new Blob(['deterministic-png'], { type })); },
  };

  const blob = await renderSchedulePng(model, { createCanvas: () => canvas });
  assert.equal(canvas.width, SCHEDULE_PNG_WIDTH);
  assert.equal(canvas.height, SCHEDULE_PNG_HEIGHT);
  assert.equal(context.direction, 'rtl');
  assert.equal(blob.type, 'image/png');
  assert.equal(blob.size > 0, true);
  assert.equal(calls.includes('الجدول الأسبوعي'), true);
});

test('isolated print document is A4 landscape and leaves existing report CSS untouched', () => {
  const { source } = fixture();
  const model = buildScheduleExportModel(source, { includeTimes: true });
  const documentText = schedulePrintDocument(model);
  assert.match(documentText, /@page\s*\{\s*size:\s*A4 landscape;/);
  assert.match(documentText, /dir="rtl"/);
  assert.match(documentText, /التوقيت الأساسي: التوقيت الصيفي/);
  assert.doesNotMatch(documentText, /التوقيت المعتمد/);

  const writes = [];
  let printed = 0;
  const fakeWindow = {
    document: { open() {}, write(value) { writes.push(value); }, close() {} },
    focus() {},
    print() { printed += 1; },
  };
  openSchedulePrint(model, { openWindow: () => fakeWindow, schedulePrint: (callback) => callback() });
  assert.equal(writes.length, 1);
  assert.equal(printed, 1);
});

test('file share is capability-detected and uses a PNG File when supported', async () => {
  class TestFile extends Blob {
    constructor(parts, name, options) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified;
    }
  }
  const shared = [];
  const navigatorObject = {
    canShare: ({ files }) => files.length === 1 && files[0].type === 'image/png',
    async share(payload) { shared.push(payload); },
  };
  const blob = new Blob(['png'], { type: 'image/png' });
  const result = await shareOrDownloadSchedule(blob, { navigatorObject, FileClass: TestFile });

  assert.equal(canShareScheduleFile(shared[0].files[0], navigatorObject), true);
  assert.equal(result.method, 'share');
  assert.equal(shared[0].files[0].name, 'rakeezx-schedule.png');
  assert.equal(shared[0].files[0].lastModified, 0);
});

test('unsupported or failed file sharing falls back to download without throwing', async () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  const downloads = [];
  const unsupported = await shareOrDownloadSchedule(blob, {
    navigatorObject: { share() {}, canShare: () => false },
    FileClass: null,
    download: (filename, value) => downloads.push({ filename, value }),
  });
  assert.equal(unsupported.method, 'download');
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].value, blob);

  class TestFile extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } }
  const failed = await shareOrDownloadSchedule(blob, {
    navigatorObject: { canShare: () => true, share: async () => { throw new Error('unsupported'); } },
    FileClass: TestFile,
    download: (filename, value) => downloads.push({ filename, value }),
  });
  assert.equal(failed.method, 'download');
  assert.equal(downloads.length, 2);
});
