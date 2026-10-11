import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { supportWhatsAppContact, supportWhatsAppMessage, supportWhatsAppUrl } from '../src/lib/support-whatsapp.js';

test('WhatsApp prefill reuses the N34 allowlist and includes only selected type and written message', () => {
  const text = supportWhatsAppMessage({
    type: 'technical', message: '  لا تعمل المزامنة  ',
    diagnostics: {
      appVersion: '1.0.0', buildSha: 'a'.repeat(40), routeCategory: 'students',
      routeTemplate: '/student/:id', syncState: 'blocked', pendingCount: 2,
      lastSuccessfulSyncAt: '2026-10-06T10:00:00Z',
      studentName: 'private-student', className: 'private-class', grade: 'private-grade',
      ownerId: 'private-owner', accountId: 'private-account', recordId: 'private-record',
      otp: 'private-otp', credential: 'private-credential', rawProductData: 'private-data',
    },
  });
  assert.match(text, /نوع الطلب: مشكلة تقنية/);
  assert.match(text, /لا تعمل المزامنة/);
  assert.match(text, /قالب الصفحة: \/student\/:id/);
  assert.match(text, /عناصر معلقة: 2/);
  assert.doesNotMatch(text, /private-|studentName|className|ownerId|accountId|recordId|rawProductData/);
  assert.equal(supportWhatsAppMessage({ type: 'suggestion' }).includes('رسالة المستخدم:'), false);
  assert.throws(() => supportWhatsAppMessage({ type: 'other' }), TypeError);
});

test('official contact is required and message is URL encoded without changing the reviewed text', () => {
  for (const value of [undefined, '', 'not-configured', '+12345678901', '123 45678901',
    'https://wa.me/12345678901', '00000000']) {
    assert.equal(supportWhatsAppContact(value), null);
    assert.equal(supportWhatsAppUrl(value, 'test'), null);
  }
  const contact = '12345678901';
  const message = 'مشكلة & اقتراح\nسطر ثانٍ? #';
  const url = supportWhatsAppUrl(contact, message);
  assert.equal(url, `https://wa.me/${contact}?text=${encodeURIComponent(message)}`);
  assert.equal(new URL(url).searchParams.get('text'), message);
  assert.equal(supportWhatsAppUrl(contact, ''), null);
});

test('preparation only returns text and URL; the UI opens after a separate review action', async () => {
  let opened = 0;
  let submitted = 0;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.window = { open: () => { opened += 1; } };
  globalThis.fetch = () => { submitted += 1; throw new Error('unexpected request'); };
  try {
    const message = supportWhatsAppMessage({ type: 'inquiry', diagnostics: { online: true } });
    assert.ok(supportWhatsAppUrl('12345678901', message));
    assert.equal(opened, 0);
    assert.equal(submitted, 0);
    const source = await readFile(new URL('../src/views/support.js', import.meta.url), 'utf8');
    const prepareAction = source.split("async 'support-whatsapp-review'()")[1]?.split("'support-whatsapp-open'()")[0];
    assert.ok(prepareAction);
    assert.doesNotMatch(prepareAction, /window\.open|submitSupportRequest/);
    assert.match(source, /draft\.whatsappReview\.text/);
    assert.match(source, /data-act="support-whatsapp-open"/);
    assert.match(source, /VITE_RAKEEZ_SUPPORT_WHATSAPP_BUSINESS/);
    assert.match(source, /!whatsappContact[\s\S]*?لم يُضبط رقم ركيز الرسمي/);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});
