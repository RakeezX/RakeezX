/** Read-only repair qualification. Writes only the allowed scoped receipt. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { qualifyImportGuard } from './n44-crypto-sender-import-guard.mjs';

const runId = 'a656377b-7e73-4477-a733-2a0030874a6e';
const hash = file => createHash('sha256').update(readFileSync(new URL('../' + file, import.meta.url))).digest('hex');
const saved = JSON.parse(readFileSync(new URL('./n44-crypto-sender.result.json', import.meta.url), 'utf8'));
assert.equal(saved.status, 'PASS');
assert.equal(saved.cases.length, 18);
for (const [file, digest] of Object.entries(saved.sourceHashes)) assert.equal(hash(file), digest);
const guard = qualifyImportGuard();
const target = 'tests/n44-server-preactivation.test.mjs';
const original = readFileSync(new URL('../' + target, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const oldBlock = `  const imports = spawnSync('git', ['grep', '-n', '-E', 'drafts/n44-push|n44-push/(registration|delivery|shared)', '--',
    'src', 'supabase', 'scripts', 'sw.js', 'index.html'], { encoding: 'utf8', stdio: 'pipe' });
  assert.equal(imports.status, 1, imports.stdout + imports.stderr); // git's no-match status
  assert.equal(imports.stdout, '');`;
assert.equal(original.split(oldBlock).length, 2, 'Exact failing harness block changed; do not guess repair');
// Confirm the original mismatch read-only; never rerun the whole unchanged suite.
const legacy = spawnSync('git', ['grep', '-l', '-E', 'drafts/n44-push|n44-push/(registration|delivery|shared)', '--',
  'src', 'supabase', 'scripts', 'sw.js', 'index.html'], { encoding: 'utf8', stdio: 'pipe' });
assert.equal(legacy.status, 0);
const matches = legacy.stdout.trim().split(/\r?\n/).filter(Boolean);
assert.ok(matches.length > 0);
assert.ok(matches.every(file => file.startsWith('scripts/')));
const report = {
  taskId: 'continuous-n44-audited-protector-and-sender-20261018', runId,
  baseSha: 'faa3cd5c32895148d5220ec9b34dd3f07a82cb5e',
  preservedCandidateSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  recordedAt: new Date().toISOString(),
  reusedProof: { runId: saved.runId, path: 'tests/n44-crypto-sender.result.json', status: saved.status,
    cases: saved.cases.length, sourceHashesMatch: true, networkAttempts: saved.networkAttempts },
  repairCheck: { status: 'PASS', ...guard, legacyRawPathMatches: matches },
  requiredMissingPath: target, targetSha256: hash(target),
  proposedCorrection: {
    addImport: "import { assertNoPrivatePushImports } from './n44-crypto-sender-import-guard.mjs';",
    replaceExactBlock: oldBlock,
    replacement: '  assertNoPrivatePushImports();',
    preserved: 'Keep the original forbidden-capability subprocess and all 15 other tests unchanged; run the corrected existing 16-case suite once after path authorization.'
  },
  disposition: 'BLOCKED: existing boundary check remains FAIL. Its required edit path is outside allowedPaths. No test status changed, no old check removed, no queue mutation and no unchanged full-suite retry.',
};
writeFileSync(new URL('./n44-crypto-sender.repair-preflight.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ repairPreflight: 'PASS', guard, sourceHashesMatch: true,
  disposition: 'BLOCKED', requiredMissingPath: target }, null, 2));
