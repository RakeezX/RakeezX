import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateCard, certificatePng, isCertificateReady, drawAchievementCertificate, certificateDescription, certificatePrintHtml, certificateBatchPrintHtml, certificateIssueDate } from '../src/lib/achievement-certificate.js';
import { CERTIFICATE_DESIGNS, CERTIFICATE_MEDALS, CERTIFICATE_TEXT_LIMIT, certificateText, defaultCertificateText, certificateMetadata } from '../src/lib/certificate-designs.js';

const approvedText = 'تقديرًا لجهوده المتميزة، واجتهاده ومثابرته في طلب العلم، وتشجيعًا له على مواصلة مسيرة التميّز والإبداع، سائلين الله له دوام التوفيق والسداد';

function recordingCanvas() {
  const texts = [];
  const images = [];
  const context = new Proxy({
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    fillText(value) { texts.push(String(value)); },
    drawImage(...args) { images.push(args); },
    measureText(value) { return { width: Array.from(String(value)).length * Number((this.font || '24px').match(/([\d.]+)px/)[1]) * 0.55 }; },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  return { texts, images, getContext: () => context, toDataURL: () => 'data:image/png;base64,c2VsZWN0ZWQtaW1hZ2U=', toBlob: callback => callback(new Blob(['certificate'], { type: 'image/png' })) };
}

test('certificates use only the student name and teacher text, with no achievement requirement', () => {
  const input = { studentName: 'اسم الطالب', text: defaultCertificateText(), demo: true,
    studentId: 'private-student', evidence: [{ key: 'scores', title: 'private-score', count: 1 }], credentials: 'private-credential' };
  const before = structuredClone(input);
  const card = certificateCard(input);
  assert.equal(card.name, 'اسم الطالب');
  assert.deepEqual(Object.keys(card), ['name', 'text', 'demo']);
  assert.equal(isCertificateReady(card), true);
  const canvas = recordingCanvas();
  drawAchievementCertificate(canvas, card);
  assert.equal(canvas.width / canvas.height, 297 / 210);
  const output = canvas.texts.join(' ') + certificateDescription(card);
  assert.match(output, /طلب العلم/);
  assert.match(output, /التميّز والإبداع/);
  assert.match(output, /بيانات تجريبية/);
  assert.match(output, /اسم الطالب/);
  assert.doesNotMatch(output, /private-|بنود بدرجة كاملة|مشاركات إيجابية|إنجازًا موثّقًا/);
  assert.deepEqual(input, before);
});

test('approved default text is exact for every subject and editable text remains bounded plain text', () => {
  assert.equal(defaultCertificateText(), approvedText);
  assert.equal(defaultCertificateText('الرياضيات'), approvedText);
  assert.equal(defaultCertificateText('المهارات الرقمية'), approvedText);
  assert.doesNotMatch(defaultCertificateText(), /في مادة/);
  assert.equal(certificateText(''), '');
  assert.equal(certificateText(' \u202e \u0000 '), '');
  assert.equal(certificateText('سطر أول\r\nسطر ثانٍ'), 'سطر أول\nسطر ثانٍ');
  assert.equal(Array.from(certificateText('س'.repeat(800))).length, CERTIFICATE_TEXT_LIMIT);
  const text = certificateText(('نعتز بجهدك ومثابرتك، ونسأل الله لك التوفيق والسداد. '.repeat(14)));
  const longToken = certificateText('تقدير '.repeat(8) + 'أ'.repeat(180) + '\n' + 'نعتز بإنجازك '.repeat(20));
  for (const body of [text, longToken]) {
    for (const design of CERTIFICATE_DESIGNS) {
      const canvas = recordingCanvas();
      drawAchievementCertificate(canvas, certificateCard({ studentName: 'طالب تجريبي', text: body }), { design: design.id });
      assert.ok(canvas.texts.join('').replace(/\s/g, '').includes(body.replace(/\s/g, '')), 'The complete accepted text must be painted');
    }
  }
});

test('both designs display bounded identity, the original Ministry logo, the fixed medal and the complete edited text', () => {
  const card = certificateCard({ studentName: '\u202eعبدالله بن عبدالرحمن بن محمد بن عبدالعزيز بن عبدالله آل مبدي العتيبي', text: 'تقديرًا لمثابرتك وإبداعك.\nنعتز بجهدك ونحتفي بإنجازك.', demo: true });
  const raw = { schoolName: 'مدرسة\u202e تجريبية', teacherName: 'معلم تجريبي', principalName: 'مدير تجريبي',
    educationDepartment: 'إدارة تعليم تجريبية', className: 'الخامس 1', subjectName: 'المهارات الرقمية',
    dateLabel: certificateIssueDate('2026-10-24'), token: 'private-token', email: 'private-email' };
  for (const design of CERTIFICATE_DESIGNS) {
    const canvas = recordingCanvas();
    const ministryLogo = { naturalWidth: 866, naturalHeight: 659 };
    const options = { ...raw, design: design.id, medal: 'laurel', ministryLogo };
    drawAchievementCertificate(canvas, card, options);
    const logoDraws = canvas.images.filter(([image]) => image === ministryLogo);
    assert.equal(logoDraws.length, 1, 'Each design must embed the provided original logo');
    const [, x, y, width, height] = logoDraws[0];
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
    assert.ok(Math.abs(width / height - ministryLogo.naturalWidth / ministryLogo.naturalHeight) < 1e-10, 'The logo must retain its original aspect ratio');
    const output = canvas.texts.join(' ') + certificateDescription(card, options);
    for (const expected of ['آل مبدي العتيبي', 'مدرسة', 'معلم تجريبي', 'مدير تجريبي', 'الخامس 1', '2026', 'بيانات تجريبية', 'نعتز بجهدك']) assert.ok(output.includes(expected));
    assert.doesNotMatch(output, /private-|\u202e/);
    assert.equal(canvas.width, 2970);
    assert.equal(canvas.height, 2100);
  }
  const metadata = certificateMetadata({ ...raw, design: 'unknown', medal: 'unknown', schoolName: 'س'.repeat(1000) });
  assert.equal(metadata.design, 'ornate');
  assert.equal(metadata.medal, 'star');
  assert.equal(certificateMetadata({ medal: 'laurel' }).medal, 'star');
  assert.deepEqual(CERTIFICATE_MEDALS.map(item => item.id), ['star']);
  assert.equal(metadata.schoolName.length, 140);
  assert.equal(metadata.token, undefined);
});

test('batch print directly exports one isolated raster per named student with nonempty text', () => {
  const card = certificateCard({ studentName: '<script>private-name</script>', text: 'تقديرًا لتميّزك ومثابرتك.' });
  const entries = Array.from({ length: 3 }, () => ({ canvas: recordingCanvas(), card }));
  assert.throws(() => certificateBatchPrintHtml([]));
  for (const incomplete of [certificateCard({ studentName: 'طالب' }), certificateCard({ text: 'عبارة تقدير' })]) {
    assert.throws(() => certificateBatchPrintHtml([...entries, { canvas: recordingCanvas(), card: incomplete }]));
  }
  const output = certificateBatchPrintHtml(entries);
  assert.equal((output.match(/<img /g) || []).length, 3);
  assert.equal((output.match(/<div class="certificate-page"/g) || []).length, 3);
  assert.match(output, /break-after:page/);
  assert.doesNotMatch(output, /<script|private-|student-profile|https?:\/\//);
});

test('PNG and print export custom text directly while rejecting empty name, text or image', async () => {
  const canvas = recordingCanvas();
  const empty = certificateCard({ studentName: 'طالب', text: '   ' });
  const card = certificateCard({ studentName: '<script>private-name</script>', text: '<b>تقديرًا لمثابرتك</b>' });
  for (const incomplete of [empty, certificateCard({ text: 'عبارة تقدير' })]) {
    assert.throws(() => certificatePrintHtml(canvas, incomplete));
    await assert.rejects(certificatePng(canvas, incomplete));
  }
  assert.equal((await certificatePng(canvas, card)).type, 'image/png');
  const html = certificatePrintHtml(canvas, card);
  assert.match(html, /@page\{size:A4 landscape;margin:0\}/);
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.doesNotMatch(html, /<script|private-|student-profile|\/src\/|https?:\/\//);
  assert.match(html, /data:image\/png;base64,/);
  assert.throws(() => certificatePrintHtml({ toDataURL: () => 'data:,' }, card));
});
