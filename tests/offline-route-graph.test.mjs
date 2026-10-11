import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_SPECIFIER = /(?:import(?:\s+[\s\S]*?\s+from\s+|\s*)|import\s*\()(['"])([^'"]+)\1/g;
const REPAIRED = [
  'src/lib/day-targeting.js',
  'src/lib/education-department-directory.js',
  'src/lib/hijri-year-input.js',
  'src/lib/sync-warning-policy.js',
  'src/lib/visible-numerals.js',
  'src/lib/n77-delete.js',
  'src/lib/restore-deletion-scope.js',
];

async function executableGraph(entry) {
  const visited = new Set();
  const dependencies = new Map();

  async function visit(relativePath) {
    const normalized = relativePath.replaceAll('\\', '/');
    if (visited.has(normalized)) return;
    visited.add(normalized);
    const source = await readFile(resolve(ROOT, normalized), 'utf8');
    const direct = [...source.matchAll(IMPORT_SPECIFIER)]
      .map((match) => match[2])
      .filter((specifier) => specifier.startsWith('.'))
      .map((specifier) => posix.normalize(posix.join(posix.dirname(normalized), specifier)))
      .filter((specifier) => specifier.endsWith('.js'));
    dependencies.set(normalized, direct);
    for (const dependency of direct) await visit(dependency);
  }

  await visit(entry);
  return { visited, dependencies };
}

async function linkedShellAssets() {
  const index = await readFile(resolve(ROOT, 'index.html'), 'utf8');
  const origin = 'https://offline-shell.test/';
  const assets = [];
  for (const tag of index.matchAll(/<(?:link|script|img)\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...tag[0].matchAll(/([\w-]+)\s*=\s*(['"])(.*?)\2/g)]
      .map(match => [match[1].toLowerCase(), match[3]]));
    if (/^<link\b/i.test(tag[0]) && !/\b(?:stylesheet|manifest|icon|apple-touch-icon|preload|modulepreload)\b/i.test(attributes.rel ?? '')) continue;
    const href = attributes.href ?? attributes.src;
    if (!href) continue;
    const url = new URL(href, origin);
    if (url.origin === new URL(origin).origin) assets.push(`.${url.pathname}${url.search}`);
  }
  return [...new Set(assets)];
}

test('service worker precaches every local asset linked by the accepted index, including Work N82 CSS', async () => {
  const source = await readFile(resolve(ROOT, 'sw.js'), 'utf8');
  const shell = runInNewContext(`${source}\nSHELL`, { self: { addEventListener() {} } });
  const linked = await linkedShellAssets();
  assert.ok(linked.includes('./src/styles/work-n82.css'), 'audit the accepted linked stylesheet');
  const missing = linked.filter(asset => !shell.includes(asset));
  assert.deepEqual(missing, [], `linked shell assets missing from SHELL:\n${missing.join('\n')}`);
  assert.equal(shell.filter(asset => asset === './src/styles/work-n82.css').length, 1);
  for (const asset of linked) await readFile(resolve(ROOT, new URL(asset, 'https://offline-shell.test/').pathname.slice(1)));
});

test('service worker precaches the complete executable route graph', async () => {
  const { visited, dependencies } = await executableGraph('src/app.js');
  const serviceWorker = await readFile(resolve(ROOT, 'sw.js'), 'utf8');
  // Inspect the actual SHELL value, so a comment or unrelated string cannot pass.
  const shell = runInNewContext(`${serviceWorker}\nSHELL`, {
    self: { addEventListener() {} },
  });
  const cachedModules = new Set(shell.filter(p => p.endsWith('.js')).map(p => p.slice(2)));
  const missing = [...visited].filter((module) => !cachedModules.has(module)).sort();

  assert.deepEqual(missing, [], `reachable modules missing from SHELL:\n${missing.join('\n')}`);
  assert.ok(visited.size >= 59, 'route graph unexpectedly shrank; review router/module coverage');

  const routedViews = dependencies.get('src/router.js') ?? [];
  assert.equal(routedViews.length, 30, 'every router entry must remain part of the audited graph');
  for (const view of routedViews) assert.ok(cachedModules.has(view), `${view} is not precached`);
  for (const module of REPAIRED) assert.ok(visited.has(module), `${module} must be audited`);
});

test('Train B installs linked shell bytes cold, advances v36/v37, preserves newer/unrelated caches and refreshes executable bytes', async () => {
  const origin = 'https://offline-shell.test';
  const source = await readFile(resolve(ROOT, 'sw.js'), 'utf8');
  const current = source.match(/const VERSION = '(rakeezx-v(\d+))';/);
  assert.ok(current, 'retain the accepted numeric cache namespace');
  assert.ok(Number(current[2]) > 37, 'the linked stylesheet repair must update installed v37 controllers');
  const version = current[1];
  const newer = `rakeezx-v${Number(current[2]) + 1}`;
  const key = request => new URL(typeof request === 'string' ? request : request.url, `${origin}/`).href;
  const stores = new Map([
    ['rakeezx-v35', new Map()], ['rakeezx-v36', new Map()], ['rakeezx-v37', new Map()],
    [newer, new Map()], ['unrelated-cache', new Map()], ['rakeezx-v36-extra', new Map()],
  ]);
  const listeners = new Map();
  const opened = [];
  const fetched = [];
  let online = false;
  let claimed = 0;
  let skipWaiting = 0;
  const preservationKey = `${origin}/synthetic-preserved-marker`;
  for (const name of [newer, 'unrelated-cache', 'rakeezx-v36-extra']) {
    stores.get(name).set(preservationKey, new Response(`preserve ${name}`));
  }
  const assertProtected = async () => {
    for (const name of [newer, 'unrelated-cache', 'rakeezx-v36-extra']) {
      assert.ok(stores.has(name), `${name} must survive cleanup`);
      assert.equal(await stores.get(name).get(preservationKey).clone().text(), `preserve ${name}`);
    }
  };
  const caches = {
    async open(name) {
      opened.push(name);
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async add(request) {
          assert.equal(request.cache, 'reload', 'install bypasses stale HTTP cache');
          const pathname = new URL(key(request)).pathname.slice(1);
          // Real complete-shell bytes, including linked CSS; no browser/network warming.
          const body = await readFile(resolve(ROOT, pathname || 'index.html'));
          entries.set(key(request), new Response(body));
        },
        async put(request, response) { entries.set(key(request), response); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(request) {
      for (const entries of stores.values()) {
        if (entries.has(key(request))) return entries.get(key(request)).clone();
      }
    },
  };
  const context = {
    self: {
      location: { origin }, clients: { async claim() { claimed += 1; } },
      skipWaiting() { skipWaiting += 1; },
      addEventListener(type, listener) { listeners.set(type, listener); },
    },
    caches, URL, Response,
    Request: class extends Request {
      constructor(input, options) { super(typeof input === 'string' ? key(input) : input, options); }
    },
    console: { warn(...args) { assert.fail(`unexpected worker warning: ${args.join(' ')}`); } },
    async fetch(request) {
      fetched.push(request);
      if (!online) throw new Error('synthetic offline');
      return new Response('current deployment executable bytes');
    },
  };
  const shell = runInNewContext(`${source}\nSHELL`, context);
  async function lifecycle(type) {
    let completion;
    listeners.get(type)({ waitUntil(promise) { completion = promise; } });
    assert.ok(completion, `${type} must wait for its work`);
    await completion;
  }
  await lifecycle('install');
  assert.equal(skipWaiting, 1);
  assert.deepEqual([...new Set(opened)], [version], 'install writes only the new generation');
  assert.equal(fetched.length, 0, 'no runtime warming before the cold offline graph');
  assert.ok(stores.has('rakeezx-v36'), 'install leaves the prior controller cache until activation');
  assert.ok(stores.has('rakeezx-v37'), 'install leaves v37 intact until new activation');
  assert.equal(stores.get(version).size, shell.length, 'every shell response installed cold');
  for (const asset of shell) {
    const pathname = new URL(key(asset)).pathname.slice(1) || 'index.html';
    assert.deepEqual(Buffer.from(await stores.get(version).get(key(asset)).clone().arrayBuffer()), await readFile(resolve(ROOT, pathname)), `${asset} cold bytes`);
  }
  const { visited } = await executableGraph('src/app.js');
  for (const module of visited) assert.ok(stores.get(version).has(`${origin}/${module}`), `${module} missing after cold install`);
  await lifecycle('activate');
  assert.equal(claimed, 1);
  assert.equal(stores.has('rakeezx-v35'), false);
  assert.equal(stores.has('rakeezx-v36'), false);
  assert.equal(stores.has('rakeezx-v37'), false);
  for (const retained of [version, newer, 'unrelated-cache', 'rakeezx-v36-extra']) assert.ok(stores.has(retained), `${retained} must survive cleanup`);
  await assertProtected();

  async function responseFor(module) {
    let response;
    listeners.get('fetch')({
      request: new Request(`${origin}/${module}`),
      respondWith(promise) { response = promise; },
    });
    assert.ok(response, 'same-origin executable requests must be handled');
    return response;
  }
  for (const module of visited) {
    const response = await responseFor(module);
    assert.equal(response.status, 200, `${module} must be available offline`);
    assert.equal(await response.text(), await readFile(resolve(ROOT, module), 'utf8'));
  }
  for (const asset of (await linkedShellAssets()).filter(asset => new URL(asset, `${origin}/`).pathname.endsWith('.css'))) {
    const response = await responseFor(asset.slice(2));
    assert.equal(response.status, 200, `${asset} must be available before runtime warming`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(resolve(ROOT, asset.slice(2))));
  }
  const stylesheet = 'src/styles/work-n82.css';
  stores.get(version).delete(`${origin}/${stylesheet}`);
  assert.equal((await responseFor(stylesheet)).status, 504, 'the original linked CSS omission must fail offline');
  const missing = REPAIRED[0];
  stores.get(version).delete(`${origin}/${missing}`);
  assert.equal((await responseFor(missing)).status, 504, 'missing executable bytes fail rather than silently pass');

  // Reappearing older cache is cleaned on fetch; a stale executable is refreshed online.
  stores.set('rakeezx-v36', new Map());
  stores.set('rakeezx-v37', new Map());
  online = true;
  const module = 'src/lib/n77-delete.js';
  assert.equal(await (await responseFor(module)).text(), 'current deployment executable bytes');
  assert.equal(fetched.at(-1).cache, 'reload');
  assert.equal(stores.has('rakeezx-v36'), false);
  assert.equal(stores.has('rakeezx-v37'), false);
  assert.equal(await (await responseFor(stylesheet)).text(), 'current deployment executable bytes');
  assert.equal(fetched.at(-1).cache, 'reload', 'linked CSS revalidates the existing deployment');
  online = false;
  assert.equal(await (await responseFor(module)).text(), 'current deployment executable bytes');
  assert.equal(await (await responseFor(stylesheet)).text(), 'current deployment executable bytes');
  await assertProtected();

  // Synthetic prior numeric controllers retain the existing cleanup contract.
  for (const priorVersion of ['rakeezx-v36', 'rakeezx-v37']) {
    const priorListeners = new Map();
    runInNewContext(source.replace(`const VERSION = '${version}';`, `const VERSION = '${priorVersion}';`), {
      ...context,
      self: { ...context.self, addEventListener(type, listener) { priorListeners.set(type, listener); } },
    });
    let priorActivation;
    priorListeners.get('activate')({ waitUntil(promise) { priorActivation = promise; } });
    await priorActivation;
    assert.ok(stores.has(version), `${priorVersion} cannot delete this repaired cache`);
    assert.ok(stores.has(newer), 'future numeric generation remains protected');
    await assertProtected();
  }

  const app = await readFile(resolve(ROOT, 'src/app.js'), 'utf8');
  assert.match(app, /\.register\('sw\.js', \{ updateViaCache: 'none' \}\)/);
  assert.match(app, /await reg\.update\(\)/, 'retain the existing explicit update check');
});
