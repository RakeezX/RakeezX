import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [html, robots, sitemap] = await Promise.all(
  ['index.html', 'robots.txt', 'sitemap.xml'].map(path => readFile(new URL(path, root), 'utf8')),
);
const canonical = 'https://rakeezx.com/';

function validate(html, robots, sitemap) {
  const metas = [...html.matchAll(/<meta\s+([^>]+)>/g)].map(([, attrs]) =>
    Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])));
  const meta = key => {
    const values = metas.filter(item => item.name === key || item.property === key);
    assert.equal(values.length, 1, `single ${key}`);
    return values[0].content;
  };
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title?.includes('رَكيز المعلم'));
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/rakeezx\.com\/">/);
  assert.equal(meta('og:url'), canonical);
  assert.equal(meta('og:type'), 'website');
  assert.equal(meta('og:locale'), 'ar_SA');
  assert.equal(meta('twitter:card'), 'summary');
  for (const key of ['og:title', 'twitter:title']) assert.equal(meta(key), title);
  for (const key of ['og:description', 'twitter:description']) assert.equal(meta(key), meta('description'));
  assert.ok(meta('description').length > 30);
  for (const item of metas.filter(item => /^(robots|googlebot|bingbot)$/i.test(item.name ?? ''))) {
    assert.doesNotMatch(item.content, /noindex|none|nofollow/i);
  }
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const data = JSON.parse(scripts[0][1]);
  assert.deepEqual(data, {
    '@context': 'https://schema.org', '@type': 'WebApplication',
    name: 'رَكيز المعلم', url: canonical,
    applicationCategory: 'EducationalApplication', inLanguage: 'ar', description: meta('description'),
  });
  assert.equal(robots.trim(), 'User-agent: *\nAllow: /\n\nSitemap: https://rakeezx.com/sitemap.xml');
  // An exact singleton allowlist excludes every private/hash/UUID/account route.
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url), [canonical]);
  assert.equal([...sitemap.matchAll(/<url>/g)].length, 1);
  for (const [, url] of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) {
    assert.doesNotMatch(url, /#|\?|student|teaching|account|settings|portal|invite/i);
  }
  assert.doesNotMatch(sitemap, /<lastmod>/i);
  assert.match(sitemap, /<\/urlset>\s*$/);
}

test('n113_public_metadata_canonical_robots_sitemap_private_routes_excluded', () => validate(html, robots, sitemap));

test('small fabricated regressions are rejected', () => {
  assert.throws(() => validate(html.replace('rel="canonical"', 'rel="alternate"'), robots, sitemap));
  assert.throws(() => validate(html.replace('</head>', '<meta name="robots" content="noindex"></head>'), robots, sitemap));
  assert.throws(() => validate(html, robots.replace('Allow: /', 'Disallow: /'), sitemap));
  assert.throws(() => validate(html, robots, sitemap.replace('</urlset>', '<url><loc>https://rakeezx.com/#/student/fabricated</loc></url></urlset>')));
  assert.throws(() => validate(html.replace('"@type": "WebApplication"', '"@type": invalid'), robots, sitemap));
});
