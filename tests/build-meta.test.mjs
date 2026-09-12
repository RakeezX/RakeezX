import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUILD_META, resolveBuildMeta } from '../src/lib/build-meta.js';
import { GENERATED_BUILD_META } from '../src/generated/build-meta.generated.js';
import { computeBuildFingerprint } from '../scripts/generate-build-meta.mjs';

test('Production Build Meta is generated from the authoritative package version and current app content', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(GENERATED_BUILD_META.appVersion, packageJson.version);
  assert.match(BUILD_META.buildSha, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
  assert.ok(Number.isFinite(Date.parse(BUILD_META.buildTimestamp)));
  assert.equal(BUILD_META.canonicalOrigin, 'https://rakeezx.com');
  if (GENERATED_BUILD_META.buildShaKind === 'content') {
    assert.equal(GENERATED_BUILD_META.buildSha, await computeBuildFingerprint());
  }
});

test('local development fallback is explicit and contains no deployment or identity data', () => {
  assert.deepEqual(resolveBuildMeta(GENERATED_BUILD_META, { development: true }), {
    appVersion: GENERATED_BUILD_META.appVersion,
    buildSha: 'development',
    buildShaKind: 'development',
    buildTimestamp: null,
    canonicalOrigin: null,
  });
});

test('Build Meta contains no secrets, account identity, repository path, or developer-local path', async () => {
  const serialized = JSON.stringify(GENERATED_BUILD_META);
  assert.doesNotMatch(serialized, /token|password|secret|service_role|supabase|cloudflare|github\.com|[A-Z]:\\\\|Users[\\/]/i);
  assert.deepEqual(Object.keys(GENERATED_BUILD_META).sort(), [
    'appVersion', 'buildSha', 'buildShaKind', 'buildTimestamp', 'canonicalOrigin',
  ].sort());
});

test('Settings uses Build Meta instead of a separately hardcoded version', async () => {
  const source = await readFile(new URL('../src/views/settings.js', import.meta.url), 'utf8');
  assert.match(source, /BUILD_META\.appVersion/);
  assert.doesNotMatch(source, /الإصدار\s+1\.0(?:\D|$)/);
});
