import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

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
  assert.equal(routedViews.length, 28, 'every router entry must remain part of the audited graph');
  for (const view of routedViews) assert.ok(cachedModules.has(view), `${view} is not precached`);
});
