import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateCard, certificatePng, certificatePdf, isCertificateReady, drawAchievementCertificate, certificateDescription, certificatePrintHtml, certificateIssueDate, certificateFilename } from '../src/lib/achievement-certificate.js';
import { certificatePdfFromJpeg } from '../src/lib/certificate-pdf.js';
import { CERTIFICATE_DESIGNS, CERTIFICATE_MEDALS, CERTIFICATE_TEXT_LIMIT, certificateText, defaultCertificateText, certificateMetadata, TITLE_FONT_FAMILY } from '../src/lib/certificate-designs.js';

const approvedText = 'تقديرًا لجهوده المتميزة، واجتهاده ومثابرته في طلب العلم، وتشجيعًا له على مواصلة مسيرة التميّز والإبداع، سائلين الله له دوام التوفيق والسداد';

function recordingCanvas() {
  const texts = [];
  const images = [];
  const lettering = [];
  const context = new Proxy({
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    fillText(value, x, y) { texts.push(String(value)); lettering.push({ text: String(value), font: this.font, color: this.fillStyle, x, y }); },
    drawImage(...args) { images.push(args); },
    measureText(value) { return { width: Array.from(String(value)).length * Number((this.font || '24px').match(/([\d.]+)px/)[1]) * 0.55 }; },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  return { texts, images, lettering, getContext: () => context, toDataURL: () => 'data:image/png;base64,c2VsZWN0ZWQtaW1hZ2U=', toBlob: callback => callback(new Blob(['certificate'], { type: 'image/png' })) };
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
    assert.ok(Math.abs(x + width / 2 - canvas.width / 4) < 1e-8, 'The Ministry logo must be horizontally centered in the certificate');
    const title = canvas.lettering.find(entry => entry.text === 'شهادة شكر وتقدير');
    assert.ok(title?.font.includes(TITLE_FONT_FAMILY), 'The title must use the dedicated Arabic display font');
    const department = canvas.lettering.find(entry => entry.text === raw.educationDepartment);
    const school = canvas.lettering.find(entry => entry.text === 'مدرسة تجريبية');
    assert.ok(department.x > x + width, 'Education department belongs to the right of the centered logo');
    assert.ok(school.x < x, 'School belongs to the left of the centered logo');
    assert.equal(school.font, department.font, 'The header labels use coordinated typography');
    assert.ok(school.font.includes('"Thmanyah Sans"'), 'The header uses the available Rakeez brand font');
    assert.equal(school.color, department.color, 'The header labels use the same theme color');
    assert.equal(school.color, design.id === 'ornate' ? '#806027' : '#f3e3ba');
    assert.ok(Math.abs(width / height - ministryLogo.naturalWidth / ministryLogo.naturalHeight) < 1e-10, 'The logo must retain its original aspect ratio');
    const output = canvas.texts.join(' ') + certificateDescription(card, options);
    for (const expected of ['آل مبدي العتيبي', 'مدرسة', 'معلم تجريبي', 'مدير تجريبي', 'الخامس 1', '2026', 'بيانات تجريبية', 'نعتز بجهدك']) assert.ok(output.includes(expected));
    assert.doesNotMatch(output, /private-|\u202e|للجهد قيمة|شكرًا لكل خطوة/);
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

test('direct PDF is one complete A4 landscape page with byte-accurate cross references and the selected image', async () => {
  // A real, synthetic 2x2 RGB JPEG keeps this binary-format test independent of a browser.
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQIBAQEBAQIBAQECAgICAgICAgIDAwQDAwMDAwICAwQDAwQEBAQEAgMFBQQEBQQEBAT/2wBDAQEBAQEBAQIBAQIEAwIDBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD+/iiiigD/2Q==', 'base64');
  const blob = certificatePdfFromJpeg(jpeg, 2, 2);
  assert.equal(blob.type, 'application/pdf');
  const bytes = Buffer.from(await blob.arrayBuffer());
  const document = bytes.toString('latin1');
  assert.match(document, /^%PDF-1\.[4-7]/);
  assert.match(document, /%%EOF\s*$/);
  assert.equal((document.match(/\/Type\s*\/Page\b/g) || []).length, 1);
  assert.match(document, /\/Type\s*\/Pages\b[\s\S]*?\/Count\s+1\b/);
  const page = document.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  assert.ok(page, 'The document declares its page dimensions');
  assert.ok(Math.abs(Number(page[1]) - 841.8898) < 0.02);
  assert.ok(Math.abs(Number(page[2]) - 595.2756) < 0.02);
  const xrefOffset = Number(document.match(/startxref\s+(\d+)\s+%%EOF/)[1]);
  const xref = document.slice(xrefOffset).match(/^xref\s+0\s+(\d+)\s*\r?\n([\s\S]*?)trailer/);
  assert.ok(xref, 'startxref points to the actual byte position of the cross-reference table');
  const entries = xref[2].trim().split(/\r?\n/);
  assert.equal(entries.length, Number(xref[1]));
  entries.slice(1).forEach((entry, index) => {
    const offset = Number(entry.slice(0, 10));
    assert.equal(document.slice(offset, offset + `${index + 1} 0 obj`.length), `${index + 1} 0 obj`);
  });
  const imageAt = document.indexOf('/Subtype /Image');
  assert.ok(imageAt > 0);
  const streamAt = document.indexOf('stream\n', imageAt) + 'stream\n'.length;
  const imageDictionary = document.slice(imageAt, streamAt);
  assert.match(imageDictionary, /\/ColorSpace\s*\/DeviceRGB/);
  assert.match(imageDictionary, /\/Filter\s*\/DCTDecode/);
  const imageLength = Number(imageDictionary.match(/\/Length\s+(\d+)/)[1]);
  assert.deepEqual(bytes.subarray(streamAt, streamAt + imageLength), jpeg);
  for (const [data, width, height] of [[new Uint8Array(), 2, 2], [jpeg, 0, 2], [jpeg, 2, NaN]]) {
    assert.throws(() => certificatePdfFromJpeg(data, width, height));
  }
  const canvas = { width: 2, height: 2, toBlob(callback, type) {
    assert.equal(type, 'image/jpeg'); callback(new Blob([jpeg], { type }));
  } };
  const card = certificateCard({ studentName: 'طالب تجريبي', text: approvedText });
  assert.equal((await certificatePdf(canvas, card)).type, 'application/pdf');
});

test('PNG, PDF and print export custom text directly while rejecting empty name, text or image', async () => {
  const canvas = recordingCanvas();
  const empty = certificateCard({ studentName: 'طالب', text: '   ' });
  const card = certificateCard({ studentName: '<script>private-name</script>', text: '<b>تقديرًا لمثابرتك</b>' });
  for (const incomplete of [empty, certificateCard({ text: 'عبارة تقدير' })]) {
    assert.throws(() => certificatePrintHtml(canvas, incomplete));
    await assert.rejects(certificatePng(canvas, incomplete));
    await assert.rejects(certificatePdf(canvas, incomplete));
  }
  assert.equal((await certificatePng(canvas, card)).type, 'image/png');
  const html = certificatePrintHtml(canvas, card);
  assert.match(html, /@page\{size:A4 landscape;margin:0\}/);
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.doesNotMatch(html, /<script|student-profile|\/src\/|https?:\/\//);
  assert.doesNotMatch(html.match(/<body>([\s\S]*)<\/body>/)[1], /private-|تقديرًا لمثابرتك/);
  assert.match(html, /data:image\/png;base64,/);
  assert.throws(() => certificatePrintHtml({ toDataURL: () => 'data:,' }, card));
});

test('individual certificate filenames preserve Arabic identity and remain safe to save', () => {
  assert.equal(certificateFilename({ studentName: 'أحمد محمد', className: 'الرابع الابتدائي / 2' }),
    'شهادة شكر وتقدير - أحمد محمد - الرابع الابتدائي - 2');
  assert.equal(certificateFilename(), 'شهادة شكر وتقدير - طالب');
  const unsafe = certificateFilename({ studentName: '  أحمد\u202e/علي<>:\"|?*  ', className: 'الخامس\\2. ' });
  assert.doesNotMatch(unsafe, /[<>:\"/\\|?*\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/);
  assert.match(unsafe, /أحمد - علي/);
  assert.match(unsafe, /الخامس - 2$/);
  const bounded = certificateFilename({ studentName: 'عبدالله '.repeat(80), className: 'فصل طويل '.repeat(60) });
  assert.ok(Buffer.byteLength(bounded, 'utf8') <= 240);
  assert.doesNotMatch(bounded, /\uFFFD|[. -]$/);
  assert.ok(bounded.startsWith('شهادة شكر وتقدير - '));

  const card = certificateCard({ studentName: 'طالب & مبدع', text: approvedText });
  const document = certificatePrintHtml(recordingCanvas(), card, { className: 'الخامس / 2' });
  assert.match(document, /<title>شهادة شكر وتقدير - طالب &amp; مبدع - الخامس - 2<\/title>/);
  assert.doesNotMatch(document.match(/<body>([\s\S]*)<\/body>/)[1], /طالب|مبدع|الخامس/);

});
