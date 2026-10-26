import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { approvedProviderOrigins, trustedSubscription } from '../drafts/n44-push/provider-policy.mjs';

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const validKeys = {
  p256dh: ecdh.getPublicKey().toString('base64url'),
  auth: randomBytes(16).toString('base64url'),
};
const sub = endpoint => ({ endpoint, keys: validKeys });
const cases = [
  ['Chromium FCM', 'https://fcm.googleapis.com/wp/valid-token_42'],
  ['Mozilla Firefox v2', 'https://updates.push.services.mozilla.com/wpush/v2/valid_token-42'],
  ['Mozilla Firefox v1', 'https://updates.push.services.mozilla.com/wpush/v1/valid_token-42'],
  ['Apple Safari and installed iOS PWA', 'https://web.push.apple.com/Q_valid-token42'],
];
for (const [name, endpoint] of cases) {
  test('N44 accepts trusted ' + name + ' subscription', () => {
    const origin = new URL(endpoint).origin;
    assert.deepEqual(approvedProviderOrigins([origin]), [origin]);
    assert.equal(trustedSubscription(sub(endpoint), [origin]).endpoint, endpoint);
  });
}
test('N44 rejects foreign provider hosts and malformed endpoints', () => {
  const bad = [
    'https://updates.push.services.mozilla.com.evil.test/wpush/v2/valid',
    'https://web.push.apple.com.evil.test/Q_valid',
    'http://web.push.apple.com/Q_valid',
    'https://web.push.apple.com:444/Q_valid',
    'https://web.push.apple.com/Q_valid?redirect=https://evil.test',
    'https://updates.push.services.mozilla.com/wpush/v2/valid#fragment',
    'https://127.0.0.1/wpush/v2/valid',
    'https://web.push.apple.com/admin/secret',
    'https://updates.push.services.mozilla.com/admin/secret',
  ];
  for (const endpoint of bad) {
    assert.throws(() => trustedSubscription(sub(endpoint), [
      'https://fcm.googleapis.com',
      'https://updates.push.services.mozilla.com',
      'https://web.push.apple.com',
    ]), undefined, endpoint);
  }
});
test('N44 refuses unreviewed provider domains and duplicate entries', () => {
  assert.throws(() => approvedProviderOrigins(['https://evil.test']));
  assert.throws(() => approvedProviderOrigins(['https://fcm.googleapis.com', 'https://fcm.googleapis.com']));
});
