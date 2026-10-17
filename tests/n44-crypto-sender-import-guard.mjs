/** Scoped successor to the legacy raw-path grep. No Product imports or writes. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Check literal module/script imports, not a source path held in JSON/evidence.
// This retains the existing focused suite's executable-import interpretation.
export function importsPrivatePush(source) {
  return /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bsrc\s*=\s*)['"][^'"\r\n]*n44-push[\\/]/.test(source);
}

export function assertNoPrivatePushImports(root = new URL('../', import.meta.url)) {
  let scanned = 0;
  function inspect(file) {
    assert.equal(importsPrivatePush(readFileSync(file, 'utf8')), false,
      'Private Push module imported by an application/service/script entry');
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
  return Object.freeze({ scanned });
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
