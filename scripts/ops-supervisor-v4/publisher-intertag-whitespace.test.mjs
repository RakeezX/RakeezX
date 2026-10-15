import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeCloudflareIndex } from './publisher.mjs';

const f = JSON.parse(fs.readFileSync(new URL('./fixtures/cloudflare-user-tail-20261014.json', import.meta.url)));
const h = value => createHash('sha256').update(value).digest('hex');
const metadata = { repoPath: 'index.html', urlPath: '/', statusCode: 200, server: 'cloudflare', contentType: 'text/html' };
const app = '<html><body>APP</body></html>';
const orders = [
  [f.jsd, f.beacon, ['cloudflare-jsd-v1', 'cloudflare-analytics-20261014']],
  [f.beacon, f.jsd, ['cloudflare-analytics-20261014', 'cloudflare-jsd-v1']]
];
for (const [first, second, names] of orders) {
  for (const separator of [' ', '\n', '\t']) {
    test('one exact provider separator '+JSON.stringify({names,separator}), () => {
      const input = '<html><body>APP' + first + separator + second + '</body></html>';
      const result = normalizeCloudflareIndex(Buffer.from(input), {...metadata, expectedSha256: h(app)});
      assert.ok(result);
      assert.equal(result.normalizedSha256, h(app));
      assert.equal(result.normalizedBytes, Buffer.byteLength(app));
      assert.equal(result.removedProviderBytes, Buffer.byteLength(first+separator+second));
      assert.deepEqual(result.providerTransforms, names);
    });
  }
  test('two separators are not accepted as one pinned separator '+names.join(','), () => {
    const input = '<html><body>APP'+first+'  '+second+'</body></html>';
    const result = normalizeCloudflareIndex(Buffer.from(input), {...metadata, expectedSha256: h(app)});
    assert.notEqual(result?.normalizedSha256, h(app));
  });
}
test('changed application bytes do not pass strict SHA', () => {
  const result = normalizeCloudflareIndex(Buffer.from('<html><body>DIFFERENT'+f.beacon+' '+f.jsd+'</body></html>'), {...metadata, expectedSha256: h(app)});
  assert.notEqual(result?.normalizedSha256, h(app));
});
test('unknown, duplicated and altered provider scripts remain rejected', () => {
  const bad = [
    f.jsd+'<script>unknown</script>'+f.beacon,
    f.jsd+' '+f.beacon+f.beacon,
    f.jsd+' '+f.beacon.replace('beacon.min.js','unknown.min.js')
  ];
  for (const x of bad) assert.equal(normalizeCloudflareIndex(Buffer.from('<html><body>APP'+x+'</body></html>'), metadata), null);
});
test('challenge and wrong server remain rejected', () => {
  const source = Buffer.from('<html><body>APP'+f.beacon+' '+f.jsd+'</body></html>');
  assert.equal(normalizeCloudflareIndex(source, {...metadata, mitigated:'challenge'}), null);
  assert.equal(normalizeCloudflareIndex(source, {...metadata, server:'nginx'}), null);
});
