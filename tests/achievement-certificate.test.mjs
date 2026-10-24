import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementCard } from '../src/lib/student-achievements.js';
import { drawAchievementCertificate, certificateDescription, certificatePrintHtml, certificateBatchPrintHtml, certificateIssueDate } from '../src/lib/achievement-certificate.js';
import { CERTIFICATE_DESIGNS, certificateMetadata } from '../src/lib/certificate-designs.js';

const input = {
  studentId: 'private-student-id',
  history: {
    logs: [
      { record: { studentId: 'private-student-id', kind: 'participation', delta: 1, note: 'private-note' } },
      { record: { studentId: 'other-student', kind: 'participation', delta: 1 } },
    ],
    attendance: [{ record: { studentId: 'private-student-id', status: 'present', date: 'private-date' } }],
  },
  items: [{ id: 'private-item-id', max: 10 }],
  gradeCtx: { scoresByItem: { 'private-item-id': { studentId: 'private-student-id', value: 10 } } },
  credentials: 'private-credential',
};

function recordingCanvas() {
  const texts = [];
  const context = new Proxy({
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    fillText(value) { texts.push(String(value)); },
    measureText(value) { return { width: String(value).length * 23 }; },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  return { texts, getContext: () => context, toDataURL: () => 'data:image/png;base64,c2VsZWN0ZWQtaW1hZ2U=' };
}

test('certificate renderer and description receive only selected positive evidence and optional sanitized name', () => {
  const before = structuredClone(input);
  const card = achievementCard(input, { selected: ['participation', 'scores', 'attendance'], demo: true, studentName: 'اسم خاص' });
  const canvas = recordingCanvas();
  drawAchievementCertificate(canvas, card);
  assert.equal(canvas.width / canvas.height, 297 / 210);
  assert.equal(card.evidence.length, 2);
  assert.ok(card.evidence.every(fact => fact.count === 1));
  const output = canvas.texts.join(' ') + certificateDescription(card);
  assert.match(output, /مشاركات إيجابية/);
  assert.match(output, /بنود بدرجة كاملة/);
  assert.match(output, /بيانات تجريبية/);
  assert.doesNotMatch(output, /private-|other-student|اسم خاص|حضور/);
  assert.deepEqual(input, before);
});

test('both designs display only bounded certificate identity and preserve the chosen evidence', () => {
  const card = achievementCard(input, { selected: ['participation'], includeName: true, studentName: 'طالب تجريبي', demo: true });
  const raw = { schoolName: 'مدرسة\u202e تجريبية', teacherName: 'معلم تجريبي', principalName: 'مدير تجريبي',
    educationDepartment: 'إدارة تعليم تجريبية', className: 'الخامس 1', subjectName: 'المهارات الرقمية',
    dateLabel: certificateIssueDate('2026-10-24'), token: 'private-token', email: 'private-email' };
  for (const design of CERTIFICATE_DESIGNS) {
    const canvas = recordingCanvas();
    const options = { ...raw, design: design.id, medal: 'laurel' };
    drawAchievementCertificate(canvas, card, options);
    const output = canvas.texts.join(' ') + certificateDescription(card, options);
    for (const expected of ['طالب تجريبي', 'مدرسة', 'معلم تجريبي', 'مدير تجريبي', 'الخامس 1', '2026', 'بيانات تجريبية']) assert.ok(output.includes(expected));
    assert.doesNotMatch(output, /private-|\u202e/);
    assert.equal(canvas.width, 2970);
    assert.equal(canvas.height, 2100);
  }
  const metadata = certificateMetadata({ ...raw, design: 'unknown', medal: 'unknown', schoolName: 'س'.repeat(1000) });
  assert.equal(metadata.design, 'ornate');
  assert.equal(metadata.medal, 'star');
  assert.equal(metadata.schoolName.length, 140);
  assert.equal(metadata.token, undefined);
});

test('batch print requires evidence for every selected page and exports exactly one raster per page', () => {
  const card = achievementCard(input, { selected: ['scores'], includeName: true, studentName: '<script>private-name</script>' });
  const entries = Array.from({ length: 3 }, () => ({ canvas: recordingCanvas(), card }));
  assert.throws(() => certificateBatchPrintHtml([], true));
  assert.throws(() => certificateBatchPrintHtml(entries, false));
  assert.throws(() => certificateBatchPrintHtml([...entries, { canvas: recordingCanvas(), card: achievementCard(input) }], true));
  const output = certificateBatchPrintHtml(entries, true);
  assert.equal((output.match(/<img /g) || []).length, 3);
  assert.equal((output.match(/<div class="certificate-page"/g) || []).length, 3);
  assert.match(output, /break-after:page/);
  assert.doesNotMatch(output, /<script|private-|student-profile|https?:\/\//);
});

test('long selected Arabic name is rendered without control characters', () => {
  const name = '\u202eعبدالله بن عبدالرحمن بن محمد بن عبدالعزيز بن عبدالله آل مبدي العتيبي';
  const card = achievementCard(input, { selected: ['scores'], includeName: true, studentName: name });
  const canvas = recordingCanvas();
  drawAchievementCertificate(canvas, card);
  assert.ok(canvas.texts.some(value => value.includes('عبدالله')));
  assert.match(certificateDescription(card), /آل مبدي العتيبي/);
  assert.doesNotMatch(canvas.texts.join(''), /\u202e/);
});

test('printing requires explicit review and evidence, then contains the certificate image alone', () => {
  const canvas = recordingCanvas();
  const empty = achievementCard(input);
  const card = achievementCard(input, { selected: ['scores'], includeName: true, studentName: '<script>private-name</script>' });
  assert.throws(() => certificatePrintHtml(canvas, empty, true));
  for (const confirmation of [false, undefined, 'true', 1]) assert.throws(() => certificatePrintHtml(canvas, card, confirmation));
  const html = certificatePrintHtml(canvas, card, true);
  assert.match(html, /@page\{size:A4 landscape;margin:0\}/);
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.doesNotMatch(html, /<script|private-|student-profile|\/src\/|https?:\/\//);
  assert.match(html, /data:image\/png;base64,/);
  assert.throws(() => certificatePrintHtml({ toDataURL: () => 'data:,' }, card, true));
});
