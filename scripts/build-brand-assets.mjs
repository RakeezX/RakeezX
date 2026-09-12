/**
 * Locked RAKEEZ brand asset exporter.
 *
 * Source artwork is never rebuilt or edited. Chromium decodes the authoritative
 * PNG and performs only proportional square resampling at deviceScaleFactor 1.
 */
import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const asset = (name) => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
const reviewAsset = (name) => fileURLToPath(new URL(`../test-results/brand-icon/${name}`, import.meta.url));
export const MASTER_NAME = 'brand-icon-master-1254.png';
export const MASTER_SIZE = 1254;
export const MASTER_SHA256 = 'a83bbe865c835e1162d313bc95c6ad9aac34630cceae62a79dab55cf746e5a27';
export const FAVICON_CROP_INSET = 108;

export const PLATFORM_ICON_SIZES = Object.freeze({
  web: [512, 256, 192, 180, 96, 64, 48, 32],
  android: [512, 192, 144, 96, 72, 48],
  ios: [1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20],
});

const pngDimensions = (buffer) => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });

export async function buildLockedBrandAssets() {
  const sizes = [...new Set(Object.values(PLATFORM_ICON_SIZES).flat())].sort((a, b) => b - a);
  const master = await readFile(asset(MASTER_NAME));
  const masterHash = createHash('sha256').update(master).digest('hex');
  if (masterHash !== MASTER_SHA256) throw new Error(`Locked master hash mismatch: ${masterHash}`);

  const masterDimensions = pngDimensions(master);
  if (masterDimensions.width !== MASTER_SIZE || masterDimensions.height !== MASTER_SIZE) {
    throw new Error(`Locked master must be ${MASTER_SIZE}x${MASTER_SIZE}; received ${masterDimensions.width}x${masterDimensions.height}.`);
  }

  const source = `data:image/png;base64,${master.toString('base64')}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: MASTER_SIZE, height: MASTER_SIZE }, deviceScaleFactor: 1 });
    const showMaster = async (size, cropInset = 0) => {
      const sourceFrame = MASTER_SIZE - cropInset * 2;
      const renderedSize = size * MASTER_SIZE / sourceFrame;
      const offset = -(size * cropInset / sourceFrame);
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}img{position:absolute;display:block;inline-size:${renderedSize}px;block-size:${renderedSize}px;inset-inline-start:${offset}px;inset-block-start:${offset}px}</style><img src="${source}" alt="">`);
      await page.locator('img').evaluate((image) => image.decode());
    };

    await showMaster(MASTER_SIZE);
    await page.locator('img').evaluate((image) => image.decode());
    const decoded = await page.locator('img').evaluate((image) => [image.naturalWidth, image.naturalHeight]);
    if (decoded[0] !== MASTER_SIZE || decoded[1] !== MASTER_SIZE) throw new Error(`Unexpected decoded master size: ${decoded.join('x')}`);

    for (const size of sizes) {
      await showMaster(size);
      const output = asset(`icon-${size}.png`);
      await page.screenshot({ path: output, omitBackground: true, animations: 'disabled' });
      const dimensions = pngDimensions(await readFile(output));
      if (dimensions.width !== size || dimensions.height !== size) throw new Error(`Unexpected ${output} dimensions.`);
    }

    // Favicon-only authorization: trim equal outer canvas on all sides, while
    // scaling the complete untouched internal artwork as one image.
    await showMaster(32, FAVICON_CROP_INSET);
    await page.screenshot({ path: asset('favicon-32.png'), omitBackground: true, animations: 'disabled' });

    // Review-only: the untouched master is not sufficiently legible at 16px.
    await mkdir(fileURLToPath(new URL('../test-results/brand-icon/', import.meta.url)), { recursive: true });
    await showMaster(16);
    await page.screenshot({ path: reviewAsset('favicon-master-16-review.png'), omitBackground: true, animations: 'disabled' });

    // The source composition already keeps functional modules and wordmark in the
    // central mask-safe area, so no additional padding or artwork change is used.
    await copyFile(asset('icon-512.png'), asset('icon-maskable.png'));
  } finally {
    await browser.close();
  }

  console.log(`Exported locked ${MASTER_SIZE}px master to ${sizes.length} proportional product sizes; 16px is review-only.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildLockedBrandAssets();
}
