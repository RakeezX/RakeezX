/** Brand artwork generation only. Uses installed Windows Segoe UI; no font files copied.
 * Run on Windows: node scripts/build-brand-assets.mjs
 * Fixed Model 3 composition, T3 hierarchy. PNG text keeps PWA artwork deterministic.
 */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('Generate approved artwork on Windows with installed Segoe UI.');
const asset = (name) => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  const screenshot = async (svg, size, path) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await page.evaluate(() => document.fonts.ready);
    return page.screenshot({ omitBackground: true, ...(path ? { path } : {}) });
  };
  if (!process.argv.includes('--small-only')) {
  // A complete two-word graphic, not font outlines, glyph sets or a bundled font.
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 724 400"><g fill="#0C3022" font-family="Segoe UI, Tahoma, Arial, sans-serif" text-anchor="middle" direction="rtl"><text x="362" y="161" font-size="218" font-weight="700">رَكيز</text><text x="362" y="337" font-size="188" font-weight="400">المعلم</text></g></svg>`;
  await page.setViewportSize({ width: 724, height: 400 });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${textSvg}`);
  await page.evaluate(() => document.fonts.ready);
  const name = (await page.screenshot({ omitBackground: true })).toString('base64');
  const cues = [
    '<circle cy="-16" r="15"/><path d="M-26 26v-9a26 26 0 0 1 52 0v9z"/><circle cx="-35" cy="-10" r="10"/><circle cx="35" cy="-10" r="10"/>',
    '<g fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round"><path d="M-36-22h72M-36 0h72M-36 22h45"/></g>',
    '<g fill="none" stroke="currentColor" stroke-width="11" stroke-linejoin="round"><rect x="-34" y="-30" width="68" height="65" rx="10"/><path d="M-34-10h68M-19-42v21M19-42v21m-37 28 14 14 27-31"/></g>',
    '<rect x="-34" y="6" width="17" height="33" rx="3"/><rect x="-8" y="-14" width="17" height="53" rx="3"/><rect x="18" y="-35" width="17" height="74" rx="3"/>',
  ];
  const artwork = `<defs><linearGradient id="tile" x2=".7" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#EAF3E9"/></linearGradient><linearGradient id="module" x2="1" y2="1"><stop stop-color="#34B77E"/><stop offset="1" stop-color="#0F5132"/></linearGradient></defs><rect x="6" y="6" width="1012" height="1012" rx="225" fill="url(#tile)" stroke="#D9EAD7" stroke-width="8"/><rect x="221" y="208" width="582" height="610" rx="165" fill="none" stroke="#B7DCC2" stroke-width="12" opacity=".8"/>${[[235,220],[789,220],[235,805],[789,805]].map(([x,y],i)=>`<g transform="translate(${x} ${y})"><rect x="-116" y="-81" width="232" height="180" rx="48" fill="#0F5132" opacity=".045"/><rect x="-116" y="-90" width="232" height="180" rx="48" fill="url(#module)"/><g transform="scale(1.5)" fill="#F8FBF8" color="#F8FBF8">${cues[i]}</g></g>`).join('')}<image x="150" y="315" width="724" height="400" href="data:image/png;base64,${name}"/><path d="m710 687 20 24m0-24-20 24" fill="none" stroke="#529D72" stroke-width="3" stroke-linecap="round" opacity=".71"/>`;
  const wrap = (content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="رَكيز المعلم">${content}</svg>`;
  const svg = wrap(artwork);
  await writeFile(asset('icon.svg'), svg + '\n');
  for (const size of [180,192,512,1024]) await screenshot(svg, size, asset(`icon-${size}.png`));
  // Full-bleed ivory and all artwork inside the central mask-safe circle.
  await screenshot(wrap(`<rect width="1024" height="1024" fill="#F8FBF8"/><g transform="translate(154 154) scale(.7)">${artwork}</g>`), 512, asset('icon-maskable.png'));
  }
  // Four substantial modules frame one open workspace. No tiny text or central dot.
  // Integer-aligned geometry retains an open center and clear gaps at 16px.
  const module = '<path d="M16 8h12v12h-8v8H8V16a8 8 0 0 1 8-8Z"/>';
  const small = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#F8FBF8"/><g fill="#0F5132">${[0,90,180,270].map(angle => `<g transform="rotate(${angle} 32 32)">${module}</g>`).join('')}</g></svg>`;
  await writeFile(asset('favicon.svg'), small + '\n');
  for (const size of [16,32]) await screenshot(small, size, asset(`favicon-${size}.png`));
  await writeFile(asset('brand-monochrome.svg'), small.replace(/<rect width="64"[^>]*\/>/, '').replaceAll('#198754', 'currentColor').replaceAll('#0F5132', 'currentColor') + '\n');
} finally { await browser.close(); }
