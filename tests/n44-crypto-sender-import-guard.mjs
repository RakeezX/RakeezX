/** Guard private N44 modules from accidental public/runtime imports.
 * The real N44 Edge entry and its reviewed staging bundler are intentional. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export function importsPrivatePush(source) {
  return /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bsrc\s*=\s*)['"][^'"\r\n]*n44-push[\\/]/.test(source);
}

const allowedImports = new Set([
  'supabase/functions/n44-notifications/index.ts',
  'scripts/n44-activation-custody.mjs',
]);
const edgeImports = [
  'node-globals.mjs', 'existing-host.mjs', 'web-protocol.mjs',
  'readiness-entry.mjs', 'edge-request.mjs', 'runtime-failure.mjs',
].sort();

export function assertNoPrivatePushImports(root = new URL('../', import.meta.url)) {
  let scanned = 0;
  const origin = fileURLToPath(root);
  function inspect(file) {
    const source = readFileSync(file, 'utf8');
    const name = relative(origin, fileURLToPath(file)).replaceAll('\\', '/');
    if (importsPrivatePush(source)) {
      assert.ok(allowedImports.has(name), 'Unexpected private Push import in ' + name);
      if (name === 'supabase/functions/n44-notifications/index.ts') {
        const imports = [...source.matchAll(/['"]\.\.\/\.\.\/\.\.\/drafts\/n44-push\/([^'"]+)['"]/g)]
          .map(match => match[1]).sort();
        assert.deepEqual(imports, edgeImports, 'Only the reviewed N44 Edge entry graph is permitted');
      } else {
        assert.match(source, /await import\('\.\.\/drafts\/n44-push\/web-protocol\.mjs'\)/);
      }
    }
    scanned++;
  }
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git'].includes(entry.name)) scan(target);
      } else if (/\.(?:[cm]?js|tsx?|jsx|html)$/.test(entry.name)) inspect(target);
    }
  }
  for (const directory of ['src/', 'supabase/', 'scripts/']) scan(new URL(directory, root));
  for (const entry of ['sw.js', 'index.html']) inspect(new URL(entry, root));
  assert.ok(scanned > 100, 'Application/service/script scan unexpectedly empty');
  return Object.freeze({ scanned, approvedEntrypoints: allowedImports.size });
}

export function qualifyImportGuard() {
  const positives = [
    "import { value } from '../drafts/n44-push/delivery.mjs';",
    "export { value } from '../drafts/n44-push/registration.mjs';",
    "import '../drafts/n44-push/shared.mjs';",
    "await import('../drafts/n44-push/private-runtime.mjs');",
    "require('../drafts/n44-push/delivery.mjs');",
    '<script src="../drafts/n44-push/delivery.mjs"></script>',
    "import {value} from '../n44-push/delivery.mjs';",
    "require('..\\drafts\\n44-push\\delivery.mjs');",
  ];
  const negatives = [
    '{"allowedPaths":["drafts/n44-push/**"]}',
    "const receipt = {repoPath:'drafts/n44-push/README.md'};",
    "assert.equal(receipt.repoPath, 'drafts/n44-push/README.md');",
    "import { createServer } from 'node:http';",
  ];
  for (const source of positives) assert.equal(importsPrivatePush(source), true);
  for (const source of negatives) assert.equal(importsPrivatePush(source), false);
  return Object.freeze({ positiveImportForms: positives.length, nonImportForms: negatives.length,
    ...assertNoPrivatePushImports() });
}
