import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { A1_RASTERS } from './helpers/a1-production-assets.mjs';

const rootFile = path => fileURLToPath(new URL(`../${path}`, import.meta.url));
const assetFile = name => rootFile(`assets/${name}`);
const hash = buffer => createHash('sha256').update(buffer).digest('hex');

// Selective N15 guard from 81b3be2fe25b720624d592d8a88efaa683bd1e02.
// Keep the existing approved-asset/manifest guards intact and avoid the
// unrelated brand-exporter's browser dependency for this source-only gate.
test('installed icon refresh advances every install URL and the offline cache together', async () => {
  const manifest = JSON.parse(await readFile(rootFile('manifest.webmanifest'), 'utf8'));
  const html = await readFile(rootFile('index.html'), 'utf8');
  const worker = (await readFile(rootFile('sw.js'), 'utf8')).replace(/\r\n/g, '\n');
  assert.deepEqual([manifest.id, manifest.start_url, manifest.scope], ['rakeezx', './', './']);

  const approved = new Map(A1_RASTERS.filter(([file]) => file !== 'favicon-32.png')
    .map(([file, , , sha256]) => [file, sha256]));
  const changed = (await Promise.all([...approved].map(async ([file, sha256]) =>
    hash(await readFile(assetFile(file))) !== sha256))).some(Boolean);
  const expected = ['icon-192.png', 'icon-512.png', 'icon-maskable.png'];
  assert.deepEqual(manifest.icons.map(({ src }) => src.replace(/\?v=\d+$/, '')),
    expected.map(file => `assets/${file}`));
  const appleLinks = [...html.matchAll(/<link\b[^>]*\brel="apple-touch-icon"[^>]*>/g)];
  assert.equal(appleLinks.length, 1, 'one Apple touch icon link is required');
  const appleUrl = appleLinks[0][0].match(/\bhref="([^"]+)"/)?.[1];
  assert.ok(appleUrl, 'Apple touch icon href is required');
  const urls = [...manifest.icons.map(({ src }) => src), appleUrl];
  const paths = [...expected, 'icon-180.png'].map(file => `assets/${file}`);
  const generation = worker.match(/const VERSION = 'rakeezx-v(\d+)';/)?.[1];
  assert.ok(generation, 'numeric service worker cache generation is required');
  if (changed) {
    const tokens = urls.map((url, index) => {
      const match = url.match(new RegExp(`^${paths[index].replace('.', '\\.')}\\?v=([1-9]\\d*)$`));
      assert.ok(match, `${paths[index]} needs a versioned install URL after icon bytes change`);
      return match[1];
    });
    assert.equal(new Set(tokens).size, 1, 'installed icons must share one refresh token');
    assert.ok(Number(generation) > 35, 'installed icon refresh must advance cache generation');
  } else {
    assert.deepEqual(urls, paths, 'approved icon bytes retain their current install URLs');
  }
  const shell = worker.match(/const SHELL = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(shell, 'service worker precache list is required');
  const precachedIcons = [...shell.matchAll(/'([^']+)'/g)].map(([, value]) => value)
    .filter(value => /^\.\/assets\/icon-(?:180|192|512|maskable)\.png(?:\?v=\d+)?$/.test(value));
  assert.deepEqual(precachedIcons.sort(), urls.map(url => `./${url}`).sort(),
    'service worker precache must match the four install icon URLs exactly');
});
