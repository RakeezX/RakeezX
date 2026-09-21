import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMAIL_OTP_LENGTH,
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  emailOtpFailureMessage,
  emailOtpFailureState,
  isValidEmailOtp,
  normalizeEmailAddress,
  normalizeEmailOtp,
} from '../src/lib/email-otp.js';
import * as cloud from '../src/lib/cloud.js';

const OWNER = '11111111-1111-4111-8111-111111111111';

function installLocalStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return values;
}

test('email OTP input normalizes Arabic and Persian digits to exactly six ASCII digits', () => {
  assert.equal(EMAIL_OTP_LENGTH, 6);
  assert.equal(normalizeEmailOtp('١٢٣-۴۵۶۷'), '123456');
  assert.equal(isValidEmailOtp('١٢٣٤٥٦'), true);
  assert.equal(isValidEmailOtp('12345'), false);
  assert.equal(normalizeEmailAddress(' Teacher@Example.Test '), 'teacher@example.test');
});

test('OTP request is email-only and explicitly forbids Auth user creation', async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options, body: JSON.parse(options.body) };
    return new Response(null, { status: 204 });
  };
  await cloud.requestEmailOtp('existing@example.test');
  assert.match(request.url, /\/auth\/v1\/otp$/);
  assert.deepEqual(request.body, { email: 'existing@example.test', create_user: false });
  assert.equal('phone' in request.body, false);
  assert.equal('password' in request.body, false);
});

test('unknown email rejection cannot create a user and remains a neutral send failure', async () => {
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ message: 'User not found', code: 'user_not_found' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  };
  await assert.rejects(() => cloud.requestEmailOtp('unknown@example.test'));
  assert.equal(body.create_user, false);
  assert.equal(emailOtpFailureMessage(emailOtpFailureState({ code: 'user_not_found' }, 'send')),
    'تعذر إرسال رمز التحقق. تحقق من البريد وحاول مرة أخرى.');
});

test('valid OTP persists the existing Supabase user UUID without touching password credentials', async () => {
  const values = installLocalStorage();
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      access_token: 'otp-access', refresh_token: 'otp-refresh', expires_in: 3600,
      user: { id: OWNER, email: 'existing@example.test' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const user = await cloud.verifyEmailOtp('existing@example.test', '123456');
  assert.equal(user.id, OWNER);
  assert.match(request.url, /\/auth\/v1\/verify$/);
  assert.deepEqual(request.body, { email: 'existing@example.test', token: '123456', type: 'email' });
  assert.equal('password' in request.body, false);
  assert.equal(JSON.parse(values.get(cloud.AUTH_STORAGE_KEY)).user.id, OWNER);
});

test('invalid, expired, offline, and cooldown states are deterministic', () => {
  assert.equal(emailOtpFailureState({ code: 'otp_expired' }), 'expired');
  assert.equal(emailOtpFailureState({ code: 'otp_invalid' }), 'invalid');
  assert.equal(emailOtpFailureState({ code: 'AUTH_NETWORK' }, 'send'), 'offline');
  assert.equal(EMAIL_OTP_RESEND_COOLDOWN_SECONDS, 60);
  assert.match(emailOtpFailureMessage('expired'), /انتهت صلاحية/);
  assert.match(emailOtpFailureMessage('invalid'), /غير صحيح/);
});
