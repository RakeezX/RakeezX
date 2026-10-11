import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectSupportDevice, sanitizeSupportDiagnostics } from '../src/lib/support.js';
import { supportWhatsAppMessage } from '../src/lib/support-whatsapp.js';
import { buildNotificationEmail, validateSupportRequest } from '../supabase/functions/support-notification-worker/core.mjs';

const android = detectSupportDevice({
  userAgent: 'Mozilla/5.0 (Linux; Android 16; SM-S906E Build/UP1A.230905.011) AppleWebKit/537.36 Chrome/155.0.0.0',
  platform: 'Linux armv8l',
});

test('Android and real allowed model are detected without transmitting user agent', () => {
  assert.deepEqual(android, { operatingSystem: 'android', operatingSystemVersion: '16', deviceModel: 'SM-S906E' });
  assert.deepEqual(detectSupportDevice({
    userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/155',
    platform: 'Android',
  }), { operatingSystem: 'android' });
  assert.deepEqual(detectSupportDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)' }),
    { operatingSystem: 'ios', operatingSystemVersion: '18.5' });
  assert.deepEqual(detectSupportDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 }),
    { operatingSystem: 'ipados' });
  assert.deepEqual(detectSupportDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }),
    { operatingSystem: 'windows' });
  assert.deepEqual(detectSupportDevice({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }),
    { operatingSystem: 'linux' });
});

test('same client and Edge allowlists reject fake models, unsupported systems and header injection', () => {
  const bad = {
    operatingSystem: 'ios\nBcc:private@example.test',
    operatingSystemVersion: '18\nInjected',
    deviceModel: 'Private Person <private@example.test>',
    userAgent: 'Sensitive UA',
    imei: 'secret-imei',
  };
  assert.deepEqual(sanitizeSupportDiagnostics(bad), {});
  assert.deepEqual(validateSupportRequest({
    id: 'support:bad', type: 'technical', created_at: '2026-10-11T06:00:00Z',
    message: 'safe text', diagnostics: bad,
  }).request.diagnostics, {});
  const clean = sanitizeSupportDiagnostics({
    ...android, deviceCategory: 'mobile', browser: 'chrome', browserVersion: '155',
    buildTimestamp: '2026-10-11T02:00:00Z', timestamp: '2026-10-11T06:00:00Z',
    timezone: 'Asia/Riyadh', userAgent: 'Sensitive UA', serial: 'private-serial',
  });
  assert.deepEqual(clean, {
    ...android, deviceCategory: 'mobile', browser: 'chrome', browserVersion: '155',
    buildTimestamp: '2026-10-11T02:00:00.000Z', timestamp: '2026-10-11T06:00:00.000Z',
    timezone: 'Asia/Riyadh',
  });
  const record = { id: 'support:device', type: 'technical', message: 'The button failed',
    created_at: '2026-10-11T06:00:00Z', diagnostics: clean };
  assert.deepEqual(validateSupportRequest(record).request.diagnostics, clean);
  const email = buildNotificationEmail(record, { to: 'support@example.test' });
  assert.equal(email.ok, true);
  assert.match(email.payload.text, /النظام: Android 16/);
  assert.match(email.payload.text, /الطراز: SM-S906E/);
  assert.match(email.payload.text, /المتصفح: chrome 155/);
  assert.doesNotMatch(email.payload.text, /Sensitive UA|private-serial|imei/);
  const whatsapp = supportWhatsAppMessage({ type: 'technical', diagnostics: clean });
  assert.match(whatsapp, /النظام: Android 16/);
  assert.match(whatsapp, /الطراز: SM-S906E/);
  assert.match(whatsapp, /المتصفح: chrome/);
  assert.doesNotMatch(whatsapp, /وقت البناء|وقت إعداد الرسالة|المنطقة الزمنية|واجهة جوال|تطبيق مثبت|Sensitive UA/);
});

test('WhatsApp action has a small icon, no redundant note, and keeps one gesture', async () => {
  const source = await readFile(new URL('../src/views/support.js', import.meta.url), 'utf8');
  assert.match(source, /icon\('whatsapp', 'inline'\)/);
  assert.match(source, /تواصل عبر الواتساب/);
  assert.doesNotMatch(source, /واتساب خدمة خارجية؛ تُجهّز رسالة/);
  assert.doesNotMatch(source, /aria-describedby="support-whatsapp-disclosure"/);
  assert.match(source, /warmSupportDeviceDetails\(\)/);
});
