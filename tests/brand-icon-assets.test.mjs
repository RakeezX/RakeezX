import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  FAVICON_CROP_INSET,
  MASTER_NAME,
  MASTER_SHA256,
  MASTER_SIZE,
  PLATFORM_ICON_SIZES,
} from '../scripts/build-brand-assets.mjs';

const rootFile = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const assetFile = (name) => rootFile(`assets/${name}`);
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const pngInfo = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
  colorType: buffer[25],
});

test('authoritative master is the locked 1254px RGB PNG', async () => {
  const master = await readFile(assetFile(MASTER_NAME));
  assert.equal(hash(master), MASTER_SHA256);
  assert.deepEqual(pngInfo(master), { width: MASTER_SIZE, height: MASTER_SIZE, colorType: 2 });
});

test('all platform exports are square opaque RGB PNGs at their declared sizes', async () => {
  const sizes = [...new Set(Object.values(PLATFORM_ICON_SIZES).flat())];
  assert.deepEqual(PLATFORM_ICON_SIZES.web, [512, 256, 192, 180, 96, 64, 48, 32]);
  assert.deepEqual(PLATFORM_ICON_SIZES.android, [512, 192, 144, 96, 72, 48]);
  assert.deepEqual(PLATFORM_ICON_SIZES.ios, [1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20]);
  for (const size of sizes) {
    const output = await readFile(assetFile(`icon-${size}.png`));
    assert.deepEqual(pngInfo(output), { width: size, height: size, colorType: 2 }, `icon-${size}.png`);
  }
});

test('favicon uses only the authorized equal outer-canvas crop and maskable remains untouched', async () => {
  const favicon = await readFile(assetFile('favicon-32.png'));
  const icon32 = await readFile(assetFile('icon-32.png'));
  const maskable = await readFile(assetFile('icon-maskable.png'));
  const icon512 = await readFile(assetFile('icon-512.png'));
  assert.equal(FAVICON_CROP_INSET, 108);
  assert.notEqual(hash(favicon), hash(icon32));
  assert.deepEqual(pngInfo(favicon), { width: 32, height: 32, colorType: 2 });
  assert.equal(hash(maskable), hash(icon512));
});

test('rejected 16px and previous generated SVG derivatives are not product assets', async () => {
  for (const name of ['favicon-16.png', 'icon-16.png', 'favicon.svg', 'icon.svg', 'brand-monochrome.svg']) {
    await assert.rejects(access(assetFile(name)));
  }
  const files = await Promise.all([
    readFile(rootFile('index.html'), 'utf8'),
    readFile(rootFile('manifest.webmanifest'), 'utf8'),
    readFile(rootFile('sw.js'), 'utf8'),
  ]);
  const references = files.join('\n');
  assert.doesNotMatch(references, /favicon-16|favicon\.svg|icon\.svg|brand-monochrome/);
  assert.match(references, /favicon-32\.png\?v=15/);
});
