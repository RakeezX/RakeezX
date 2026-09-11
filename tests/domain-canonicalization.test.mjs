import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const legacyPagesOrigin = ['rakeezx', 'pages', 'dev'].join('.');
const legacyHostedSuffix = ['chatgpt', 'site'].join('.');

test('Production metadata names rakeezx.com as the sole canonical origin', async () => {
  const index = await read('index.html');

  assert.match(index, /<link rel="canonical" href="https:\/\/rakeezx\.com\/">/);
  assert.match(index, /<meta property="og:url" content="https:\/\/rakeezx\.com\/">/);
  assert.doesNotMatch(index, new RegExp(legacyPagesOrigin.replaceAll('.', '\\.')));
  assert.doesNotMatch(index, new RegExp(legacyHostedSuffix.replaceAll('.', '\\.')));
});

test('PWA identity and navigation stay origin-relative on canonical and legacy hosts', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));

  assert.equal(manifest.id, 'rakeezx');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const value of [manifest.id, manifest.start_url, manifest.scope, ...manifest.shortcuts.map(({ url }) => url)]) {
    assert.doesNotMatch(value, /^https?:\/\//);
  }
});

test('Service Worker caches only same-origin application resources', async () => {
  const worker = await read('sw.js');

  assert.match(worker, /if \(url\.origin !== self\.location\.origin\) return;/);
  assert.doesNotMatch(worker, new RegExp(legacyPagesOrigin.replaceAll('.', '\\.')));
  assert.doesNotMatch(worker, new RegExp(legacyHostedSuffix.replaceAll('.', '\\.')));
});

test('current password authentication has no browser redirect or recovery callback URL', async () => {
  const cloud = await read('src/lib/cloud.js');

  assert.match(cloud, /request\('\/token\?grant_type=password'/);
  assert.doesNotMatch(cloud, /(?:emailRedirectTo|redirectTo|callbackUrl)/);
  assert.doesNotMatch(cloud, new RegExp(legacyPagesOrigin.replaceAll('.', '\\.')));
  assert.doesNotMatch(cloud, new RegExp(legacyHostedSuffix.replaceAll('.', '\\.')));
});
