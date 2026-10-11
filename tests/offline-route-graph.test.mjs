import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_SPECIFIER = /(?:import(?:\s+[\s\S]*?\s+from\s+|\s*)|import\s*\()(['"])([^'"]+)\1/g;

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

test('service worker precaches the complete executable route graph', async () => {
  const { visited, dependencies } = await executableGraph('src/app.js');
  const serviceWorker = await readFile(resolve(ROOT, 'sw.js'), 'utf8');
  const cachedModules = new Set(
    [...serviceWorker.matchAll(/['"](\.\/src\/[^'"]+\.js)['"]/g)]
      .map((match) => match[1].slice(2)),
  );
  const missing = [...visited].filter((module) => !cachedModules.has(module)).sort();

  assert.deepEqual(missing, [], `reachable modules missing from SHELL:\n${missing.join('\n')}`);
  assert.ok(visited.size >= 59, 'route graph unexpectedly shrank; review router/module coverage');

  const routedViews = dependencies.get('src/router.js') ?? [];
  assert.equal(routedViews.length, 30, 'every router entry must remain part of the audited graph');
  for (const view of routedViews) assert.ok(cachedModules.has(view), `${view} is not precached`);
});

test('fresh worker installation serves the five repaired shell dependencies offline without warming', async () => {
  const origin = 'https://offline-shell.test';
  const repaired = [
    'src/lib/day-targeting.js',
    'src/lib/education-department-directory.js',
    'src/lib/hijri-year-input.js',
    'src/lib/sync-warning-policy.js',
    'src/lib/visible-numerals.js',
  ];
  const listeners = new Map();
  const entries = new Map();
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, `${origin}/`).href;
  const cache = {
    async add(request) {
      const path = new URL(request.url).pathname.slice(1);
      // Only executable bytes are relevant to this bounded install/fetch fixture.
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
    console: { warn(...args) { assert.fail(`unexpected cache failure: ${args.join(' ')}`); } },
    async fetch() { networkAttempts += 1; throw new Error('synthetic offline'); },
  });
  let installation;
  listeners.get('install')({ waitUntil(promise) { installation = promise; } });
  await installation;
  assert.equal(networkAttempts, 0, 'no runtime dependency warming before disconnect');

  async function offlineResponse(path) {
    let response;
    listeners.get('fetch')({
      request: new Request(`${origin}/${path}`),
      respondWith(promise) { response = promise; },
    });
    assert.ok(response, 'worker must handle the same-origin module');
    return response;
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
