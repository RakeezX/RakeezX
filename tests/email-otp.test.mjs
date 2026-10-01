import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test('unified OTP request is email-only with the pilot gate enabled', async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options, body: JSON.parse(options.body) };
    return new Response(null, { status: 204 });
  };
  await cloud.requestEmailOtp('existing@example.test');
  assert.match(request.url, /\/auth\/v1\/otp$/);
  assert.deepEqual(request.body, { email: 'existing@example.test', create_user: true });
  assert.equal('phone' in request.body, false);
  assert.equal('password' in request.body, false);
});

test('Product pilot gate is on and unified OTP permits Auth user creation', async () => {
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(null, { status: 204 });
  };
  assert.equal(cloud.NEW_ACCOUNT_SIGNUP_ENABLED, true);
  await cloud.requestEmailOtp('new@example.test');
  assert.deepEqual(requestBody, { email: 'new@example.test', create_user: true });
});

test('server disable_signup still blocks the pilot Product gate', async () => {
  const source = await readFile(new URL('../src/lib/cloud.js', import.meta.url), 'utf8');
  assert.equal(source.split('export const NEW_ACCOUNT_SIGNUP_ENABLED = true;').length - 1, 1);
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ code: 'signup_disabled', message: 'Signups not allowed' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  };
  await assert.rejects(() => cloud.requestEmailOtp('new@example.test'),
    (error) => error.status === 403 && error.code === 'signup_disabled');
  assert.deepEqual(requestBody, { email: 'new@example.test', create_user: true });
  assert.equal(cloud.user, null);
});

test('closed Product gate sends create_user false and unknown email remains a neutral failure', async () => {
  const source = await readFile(new URL('../src/lib/cloud.js', import.meta.url), 'utf8');
  const gatedSource = source.replace('export const NEW_ACCOUNT_SIGNUP_ENABLED = true;',
    'export const NEW_ACCOUNT_SIGNUP_ENABLED = false;')
    // A data URL has no directory against which module imports can resolve.
    .replace(/(['"])(\.\/[^'"]+\.js)\1/g, (_match, quote, specifier) =>
      `${quote}${new URL(specifier, new URL('../src/lib/cloud.js', import.meta.url)).href}${quote}`);
  const gatedCloud = await import(`data:text/javascript,${encodeURIComponent(gatedSource)}`);
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ message: 'User not found', code: 'user_not_found' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  };
  await assert.rejects(() => gatedCloud.requestEmailOtp('unknown@example.test'));
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
  assert.equal(emailOtpFailureState({ status: 429 }, 'send'), 'rate_limited');
  assert.equal(EMAIL_OTP_RESEND_COOLDOWN_SECONDS, 60);
  assert.equal(emailOtpFailureMessage('rate_limited'), 'تم إرسال رمز قبل قليل. انتظر قليلًا ثم أعد المحاولة.');
  assert.match(emailOtpFailureMessage('expired'), /انتهت صلاحية/);
  assert.match(emailOtpFailureMessage('invalid'), /غير صحيح/);
});

test('OTP request preserves a reliable server retry-after value', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'over_email_send_rate_limit' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '42' },
  });
  await assert.rejects(
    () => cloud.requestEmailOtp('existing@example.test'),
    (error) => error.status === 429 && error.retryAfterSeconds === 42,
  );
});
