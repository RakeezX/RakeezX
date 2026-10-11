import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { supportWhatsAppContact, supportWhatsAppMessage, supportWhatsAppUrl } from '../src/lib/support-whatsapp.js';
import { OFFICIAL_SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_CONTACT } from '../src/lib/support-public-config.js';

test('WhatsApp prefill reuses N89 allowlist and never includes raw form text', () => {
  const text = supportWhatsAppMessage({
    type: 'technical', message: '  لا تعمل المزامنة  ',
    diagnostics: {
      appVersion: '1.0.0', buildSha: 'a'.repeat(40), routeCategory: 'students',
      routeTemplate: '/student/:id', syncState: 'blocked', pendingCount: 2,
      lastSuccessfulSyncAt: '2026-10-06T10:00:00Z',
      studentName: 'private-student', className: 'private-class', grade: 'private-grade',
      ownerId: 'private-owner', accountId: 'private-account', recordId: 'private-record',
      otp: 'private-otp', credential: 'private-credential', rawProductData: 'private-data',
      attendance: 'private-attendance', token: 'private-token', rawError: 'private-SQL',
      patch: 'private-patch', recordUrl: 'private-record-url',
    },
  });
  assert.match(text, /نوع الطلب: مشكلة تقنية/);
  assert.doesNotMatch(text, /لا تعمل المزامنة/);
  assert.match(text, /^السلام عليكم/);
  assert.match(text, /الصفحة: \/student\/:id/);
  assert.match(text, /معلق: 2/);
  assert.doesNotMatch(text, /private-|studentName|className|ownerId|accountId|recordId|rawProductData/);
  assert.equal(supportWhatsAppMessage({ type: 'suggestion' }).includes('رسالة المستخدم:'), false);
  assert.throws(() => supportWhatsAppMessage({ type: 'other' }), TypeError);
});

test('only official contact is accepted and safe message is URL encoded', () => {
  assert.equal(supportWhatsAppContact(undefined), OFFICIAL_SUPPORT_WHATSAPP);
  assert.equal(SUPPORT_WHATSAPP_CONTACT, OFFICIAL_SUPPORT_WHATSAPP);
  for (const value of [null, '', 'not-configured', '+12345678901', '123 45678901', '12345678901',
    'https://wa.me/12345678901', '00000000']) {
    assert.equal(supportWhatsAppContact(value), null);
    assert.equal(supportWhatsAppUrl(value, 'test'), null);
  }
  const contact = OFFICIAL_SUPPORT_WHATSAPP;
  const message = 'مشكلة & اقتراح\nسطر ثانٍ? #';
  const url = supportWhatsAppUrl(contact, message);
  assert.equal(url, `https://wa.me/${contact}?text=${encodeURIComponent(message)}`);
  assert.equal(new URL(url).searchParams.get('text'), message);
  assert.equal(supportWhatsAppUrl(contact, ''), null);
});

test('helpers do not transmit; actual UI opens directly without raw form or second action', async () => {
  let opened = 0;
  let submitted = 0;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = { open: () => { opened += 1; } };
  globalThis.fetch = () => { submitted += 1; throw new Error('unexpected request'); };
  try {
    const message = supportWhatsAppMessage({ type: 'inquiry', diagnostics: { online: true } });
    assert.ok(supportWhatsAppUrl(OFFICIAL_SUPPORT_WHATSAPP, message));
    assert.equal(opened, 0);
    assert.equal(submitted, 0);
    const source = await readFile(new URL('../src/views/support.js', import.meta.url), 'utf8');
    const action = source.split("'support-whatsapp-open'()")[1]?.replace(/\/\/[^\n]*/g, '');
    assert.ok(action);
    assert.match(action, /window\.open/);
    assert.doesNotMatch(action, /await |draft\.message|submitSupportRequest|FormData|upload/);
    assert.doesNotMatch(source, /whatsappReview|support-whatsapp-review|support-whatsapp-cancel/);
    assert.match(source, /data-act="support-whatsapp-open"/);
    assert.match(source, /SUPPORT_WHATSAPP_CONTACT/);
    assert.match(source, /إعداد الرقم الرسمي غير صالح/);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});
