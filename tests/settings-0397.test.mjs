import test from 'node:test';
import assert from 'node:assert/strict';
import { profileAttention } from '../src/lib/settings-profile-ui.js';
import { installContext, installSteps } from '../src/lib/install-guide-ui.js';

const profile = { teacherName: 'معلمة', phone: '0500000000' };
const contract = { profileStatus: 'READY', access: { label: 'الوصول التجريبي' }, provisioning: { state: 'READY' } };
test('N42 healthy profile stays compact; existing required/invalid rules expose attention', () => {
  assert.equal(profileAttention({ profile, contract }), '');
  for (const patch of [{ teacherName: '' }, { phone: '' }, { phone: '0412345678' }]) {
    assert.equal(profileAttention({ profile: { ...profile, ...patch }, contract }), 'أكمل بياناتك المطلوبة');
  }
});
test('N42 pending/unavailable/account attention remains discoverable; Demo excludes account state', () => {
  assert.equal(profileAttention({ profile, pendingEmail: true, contract }), 'تغيير البريد قيد التأكيد');
  assert.equal(profileAttention({ profile, unavailable: true, contract }), 'تعذر التحقق من حالة الوصول الآن');
  for (const patch of [{ profileStatus: 'PENDING_PROFILE' }, { access: null }, { provisioning: { state: 'PROVISIONING_REQUIRED' } }]) {
    assert.equal(profileAttention({ profile, contract: { ...contract, ...patch } }), 'راجع حالة حسابك');
  }
  assert.equal(profileAttention({ profile, demo: true, pendingEmail: true, unavailable: true, contract: null }), '');
});
const ua = {
  ios: 'Mozilla iPhone Safari/605.1', ipad: 'Mozilla Macintosh Safari/605.1',
  android: 'Mozilla Android Chrome/144.0 Safari/537', edge: 'Mozilla Windows Chrome/144.0 Safari/537 Edg/144.0',
  chrome: 'Mozilla Windows Chrome/144.0 Safari/537', mac: 'Mozilla Macintosh Safari/605.1', unknown: 'Mozilla Linux Firefox/140.0',
};
test('N43 native, manual, standalone and unknown remain distinct', () => {
  assert.equal(installContext({ ua: ua.chrome, prompt: true }).state, 'native');
  assert.equal(installContext({ ua: ua.chrome }).state, 'manual');
  assert.equal(installContext({ ua: ua.unknown }).state, 'limited');
  assert.equal(installContext({ ua: ua.unknown }).device, null);
  assert.equal(installContext({ ua: ua.chrome, standalone: true, prompt: true }).state, 'standalone');
});
test('N43 Safari/iOS never exposes Chromium native prompt; iPad desktop UA is recognized', () => {
  assert.equal(installContext({ ua: ua.ios, prompt: true }).state, 'manual');
  assert.equal(installContext({ ua: ua.mac, prompt: true }).state, 'manual');
  assert.equal(installContext({ ua: ua.ipad, platform: 'MacIntel', touch: 5 }).device, 'ios');
  assert.equal(installContext({ ua: 'iPhone CriOS/144.0 Safari/605.1', prompt: true }).state, 'limited');
});
test('N43 all approved manual paths have three textual steps and platform-specific instructions', () => {
  for (const [device, browser] of [['ios'], ['android'], ['windows', 'edge'], ['windows', 'chrome'], ['mac']]) {
    const steps = installSteps(device, browser);
    assert.equal(steps.length, 3);
    for (const step of steps) assert.ok(step[0] && step[1] && step[2] && step[3]);
  }
  assert.match(installSteps('ios')[2][1], /إذا ظهر خيار «فتح كتطبيق ويب»، فعّله ثم اضغط «إضافة»/);
  assert.match(installSteps('windows', 'edge')[1][1], /المزيد من الأدوات.*التطبيقات.*تثبيت هذا الموقع كتطبيق/);
  assert.match(installSteps('windows', 'chrome')[1][1], /بثّ وحفظ ومشاركة.*تثبيت الصفحة كتطبيق/);
  assert.match(installSteps('mac')[0][1], /Sonoma 14 أو أحدث/);
  assert.deepEqual(installSteps(null), []);
});
