import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_SPECIFIER = /(?:import(?:\s+[\s\S]*?\s+from\s+|\s*)|import\s*\()(['"])([^'"]+)\1/g;
const DIRECTORY_JSON = [
  'src/data/education-departments-2026-09-30.json',
  'src/data/education-department-options-2026-09-30.json',
];

function assertExpectedOfflineJSONWarning(...args) {
  assert.ok(['[sw] Background fetch failed', '[sw] Fetch error'].includes(args[0]),
    `unexpected cache failure: ${args.join(' ')}`);
  assert.ok(DIRECTORY_JSON.includes(new URL(args[1]).pathname.slice(1)));
  assert.equal(args[2]?.message, 'synthetic offline');
}

function importedAssets(source, importer) {
  return [...source.matchAll(IMPORT_SPECIFIER)]
    .map((match) => match[2])
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => posix.normalize(posix.join(posix.dirname(importer), specifier)))
    .filter((specifier) => /\.(?:js|json)$/.test(specifier));
}

test('route graph follows static JSON imports with import attributes', () => {
  assert.deepEqual(importedAssets(`
    import directory from '../data/education-departments-2026-09-30.json' with { type: 'json' };
    import options from '../data/education-department-options-2026-09-30.json'
      with { type: 'json' };
    import { helper } from './helper.js';
    import './side-effect.js';
    const view = import('../views/settings.js');
  `, 'src/lib/education-department-directory.js'), [
    ...DIRECTORY_JSON, 'src/lib/helper.js', 'src/lib/side-effect.js', 'src/views/settings.js',
  ]);
});

function shellEntries(source) {
  return [...source.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/['"]([^'"]+)['"]/g)]
    .map((match) => match[1]);
}

async function linkedStylesheets() {
  const html = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter(([tag]) => /\brel=["']stylesheet["']/i.test(tag))
    .map(([tag]) => tag.match(/\bhref=["']([^"']+)["']/i)[1])
    .map((href) => `./${posix.normalize(href.replace(/^\.\//, ''))}`);
}

test('service worker SHELL includes every stylesheet linked by the accepted index', async () => {
  const source = await readFile(resolve(ROOT, 'sw.js'), 'utf8');
  const shell = new Set(shellEntries(source));
  const linked = await linkedStylesheets();
  assert.ok(linked.includes('./src/styles/work-n82.css'), 'accepted stylesheet link must remain');
  assert.deepEqual(linked.filter((href) => !shell.has(href)), [], 'linked stylesheet missing from SHELL');
});

async function executableGraph(entry) {
  const visited = new Set();
  const dependencies = new Map();

  async function visit(relativePath) {
    const normalized = relativePath.replaceAll('\\', '/');
    if (visited.has(normalized)) return;
    visited.add(normalized);
    const source = await readFile(resolve(ROOT, normalized), 'utf8');
    // JSON is a terminal imported asset, not JavaScript to scan for imports.
    const direct = normalized.endsWith('.json') ? [] : importedAssets(source, normalized);
    dependencies.set(normalized, direct);
    for (const dependency of direct) await visit(dependency);
  }

  await visit(entry);
  return { visited, dependencies };
}

test('service worker precaches the complete executable route graph', async () => {
  const { visited, dependencies } = await executableGraph('src/app.js');
  const serviceWorker = await readFile(resolve(ROOT, 'sw.js'), 'utf8');
  const cachedModules = new Set(shellEntries(serviceWorker).map((href) => href.slice(2)));
  const missing = [...visited].filter((module) => !cachedModules.has(module)).sort();

  assert.deepEqual(missing, [], `reachable modules missing from SHELL:\n${missing.join('\n')}`);
  assert.ok(visited.size >= 59, 'route graph unexpectedly shrank; review router/module coverage');
  assert.deepEqual(dependencies.get('src/lib/education-department-directory.js'), DIRECTORY_JSON,
    'both attributed JSON imports must remain in the audited closure');
  for (const asset of DIRECTORY_JSON) {
    assert.ok(visited.has(asset), `${asset} missing from import closure`);
    assert.ok(cachedModules.has(asset), `${asset} is not precached`);
  }

  const routedViews = dependencies.get('src/router.js') ?? [];
  assert.equal(routedViews.length, 30, 'every router entry must remain part of the audited graph');
  for (const view of routedViews) assert.ok(cachedModules.has(view), `${view} is not precached`);
});

test('fresh worker installation serves repaired JS and imported JSON offline without warming', async () => {
  const origin = 'https://offline-shell.test';
  const repaired = [
    'src/lib/day-targeting.js',
    'src/lib/education-department-directory.js',
    'src/lib/hijri-year-input.js',
    'src/lib/sync-warning-policy.js',
    'src/lib/visible-numerals.js',
    ...DIRECTORY_JSON,
  ];
  const listeners = new Map();
  const entries = new Map();
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, `${origin}/`).href;
  const cache = {
    async add(request) {
      const path = new URL(request.url).pathname.slice(1);
      // Only imported source assets are relevant to this bounded install/fetch fixture.
      const body = path.startsWith('src/') ? await readFile(resolve(ROOT, path), 'utf8') : '';
      entries.set(key(request), new Response(body));
    },
  };
  let networkAttempts = 0;
  runInNewContext(await readFile(resolve(ROOT, 'sw.js'), 'utf8'), {
    self: {
      location: { origin },
      skipWaiting() {},
      addEventListener(type, listener) { listeners.set(type, listener); },
    },
    caches: {
      async open() { return cache; },
      async keys() { return []; },
      async match(request) { return entries.get(key(request))?.clone(); },
    },
    Request: class extends Request {
      constructor(input, options) { super(key(input), options); }
    },
    Response, URL,
    console: { warn: assertExpectedOfflineJSONWarning },
    async fetch() { networkAttempts += 1; throw new Error('synthetic offline'); },
  });
  let installation;
  listeners.get('install')({ waitUntil(promise) { installation = promise; } });
  await installation;
  assert.equal(networkAttempts, 0, 'no runtime dependency warming before disconnect');

  async function offlineResponse(path) {
    let response;
    const background = [];
    listeners.get('fetch')({
      request: new Request(`${origin}/${path}`),
      respondWith(promise) { response = promise; },
      waitUntil(promise) { background.push(promise); },
    });
    assert.ok(response, 'worker must handle the same-origin module');
    const settled = await response;
    await Promise.all(background);
    return settled;
  }
  for (const path of repaired) {
    assert.ok(entries.has(`${origin}/${path}`), `${path} missing immediately after installation`);
    const response = await offlineResponse(path);
    assert.equal(response.status, 200, `${path} must be available offline`);
    assert.equal(await response.text(), await readFile(resolve(ROOT, path), 'utf8'));
  }
  assert.equal(networkAttempts, repaired.length, 'each executable fetch uses the offline fallback');

  entries.delete(`${origin}/${repaired[0]}`);
  assert.equal((await offlineResponse(repaired[0])).status, 504, 'a missing module remains a failure');
});

test('cold install and v38-to-v39 VM update precache imported JSON and protect newer/unrelated caches', async () => {
  const origin = 'https://offline-shell.test';
  const source = await readFile(resolve(ROOT, 'sw.js'), 'utf8');
  assert.match(source, /const VERSION = 'rakeezx-v39';/);
  const oldSource = source.replace("const VERSION = 'rakeezx-v39';", "const VERSION = 'rakeezx-v38';")
    .replace(/^[ \t]*'\.\/src\/data\/education-department(?:s|-options)-2026-09-30\.json',[ \t]*\r?\n/gm, '');
  assert.equal(shellEntries(oldSource).length, 120, 'all predecessor shell entries must remain');
  assert.equal(shellEntries(source).length, 122, 'only the two JSON registrations are added');
  const linked = await linkedStylesheets();
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, `${origin}/`).href;

  function fixture() {
    const buckets = new Map();
    const adds = [];
    let networkAttempts = 0;
    const caches = {
      async open(name) {
        if (!buckets.has(name)) buckets.set(name, new Map());
        const entries = buckets.get(name);
        return {
          async add(request) {
            assert.equal(request.cache, 'reload');
            const pathname = new URL(request.url).pathname.slice(1) || 'index.html';
            entries.set(key(request), new Response(await readFile(resolve(ROOT, pathname))));
            adds.push({ name, url: key(request) });
          },
          async put(request, response) { entries.set(key(request), response); },
        };
      },
      async keys() { return [...buckets.keys()]; },
      async delete(name) { return buckets.delete(name); },
      async match(request) {
        for (const entries of buckets.values()) {
          const response = entries.get(key(request));
          if (response) return response.clone();
        }
      },
    };
    function worker(code) {
      const listeners = new Map();
      let claims = 0;
      let skipWaiting = 0;
      runInNewContext(code, {
        self: {
          location: { origin },
          skipWaiting() { skipWaiting += 1; },
          clients: { async claim() { claims += 1; } },
          addEventListener(type, listener) { listeners.set(type, listener); },
        },
        caches,
        Request: class extends Request {
          constructor(input, options) { super(typeof input === 'string' ? key(input) : input, options); }
        },
        Response, URL,
        console: { warn: assertExpectedOfflineJSONWarning },
        async fetch() { networkAttempts += 1; throw new Error('synthetic offline'); },
      });
      return {
        async lifecycle(type) {
          let completion;
          listeners.get(type)({ waitUntil(promise) { completion = promise; } });
          assert.ok(completion);
          await completion;
        },
        async offline(path) {
          let response;
          const background = [];
          listeners.get('fetch')({
            request: new Request(key(path)),
            respondWith(promise) { response = promise; },
            waitUntil(promise) { background.push(promise); },
          });
          assert.ok(response);
          const settled = await response;
          await Promise.all(background);
          return settled;
        },
        get claims() { return claims; },
        get skipWaiting() { return skipWaiting; },
      };
    }
    return { buckets, adds, worker, get networkAttempts() { return networkAttempts; } };
  }

  async function assertFullInstall(f) {
    const entries = f.buckets.get('rakeezx-v39');
    const expected = shellEntries(source);
    assert.equal(entries.size, expected.length);
    for (const href of expected) {
      const response = entries.get(key(href));
      assert.equal(response?.status, 200, `cold install missing ${href}`);
      const pathname = new URL(key(href)).pathname.slice(1) || 'index.html';
      assert.deepEqual(Buffer.from(await response.clone().arrayBuffer()), await readFile(resolve(ROOT, pathname)));
    }
  }

  const fresh = fixture();
  const freshWorker = fresh.worker(source);
  await freshWorker.lifecycle('install');
  assert.equal(freshWorker.skipWaiting, 1);
  assert.equal(fresh.networkAttempts, 0, 'no runtime warming');
  await assertFullInstall(fresh);
  await freshWorker.lifecycle('activate');
  assert.equal(freshWorker.claims, 1);
  for (const href of [...linked, ...DIRECTORY_JSON]) {
    const response = await freshWorker.offline(href);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(resolve(ROOT, href)));
  }
  for (const asset of DIRECTORY_JSON) {
    fresh.buckets.get('rakeezx-v39').delete(key(asset));
    assert.equal((await freshWorker.offline(asset)).status, 504, 'missing imported JSON fails closed');
  }
  fresh.buckets.get('rakeezx-v39').delete(key('./src/styles/work-n82.css'));
  assert.equal((await freshWorker.offline('./src/styles/work-n82.css')).status, 504, 'missing CSS fails closed');

  const update = fixture();
  const old = update.worker(oldSource);
  await old.lifecycle('install');
  await old.lifecycle('activate');
  for (const asset of DIRECTORY_JSON) {
    assert.equal((await old.offline(asset)).status, 504, 'installed v38 reproduces missing JSON');
  }
  const unrelated = new Map([[key('/sentinel'), new Response('unrelated')]]);
  const newer = new Map([[key('/future'), new Response('future')]]);
  update.buckets.set('unrelated-synthetic', unrelated);
  update.buckets.set('rakeezx-v40', newer);
  update.buckets.set('rakeezx-vinvalid', new Map());
  update.buckets.set('rakeezx-v36', new Map());
  const next = update.worker(source);
  const attemptsBeforeInstall = update.networkAttempts;
  await next.lifecycle('install');
  assert.equal(update.networkAttempts, attemptsBeforeInstall, 'update must not warm runtime assets');
  await assertFullInstall(update);
  assert.ok(update.buckets.has('rakeezx-v38'), 'old cache survives until new activation');
  await old.offline('./src/lib/visible-numerals.js');
  assert.ok(update.buckets.has('rakeezx-v39'), 'old worker must preserve installing newer cache');
  await next.lifecycle('activate');
  assert.equal(next.claims, 1);
  assert.equal(next.skipWaiting, 1);
  for (const generation of [36, 38]) assert.ok(!update.buckets.has(`rakeezx-v${generation}`), 'activation removes older generations');
  update.buckets.set('rakeezx-v38', new Map());
  for (const asset of [...linked, ...DIRECTORY_JSON]) {
    const response = await next.offline(asset);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(resolve(ROOT, asset)));
  }
  assert.ok(!update.buckets.has('rakeezx-v38'), 'fetch cleans an old-worker recreated cache');
  assert.equal(update.buckets.get('unrelated-synthetic'), unrelated);
  assert.equal(update.buckets.get('rakeezx-v40'), newer);
  assert.ok(update.buckets.has('rakeezx-vinvalid'));
  assert.equal(await unrelated.get(key('/sentinel')).text(), 'unrelated');
  assert.equal(await newer.get(key('/future')).text(), 'future');
});
