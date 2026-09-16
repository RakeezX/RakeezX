import { readFile, readdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGeneratedBuildMeta } from './generate-build-meta.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIR = resolve(ROOT, 'tests');
const BENCHMARK = 'benchmark.test.mjs';
const BUILD_META = resolve(ROOT, 'src/generated/build-meta.generated.js');

const runNodeTests = (files, label, env = process.env) => new Promise((resolveRun, reject) => {
  const child = spawn(process.execPath, ['--test', ...files.map((file) => `tests/${file}`)], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  child.once('error', reject);
  child.once('close', (code, signal) => {
    if (code === 0) resolveRun();
    else reject(new Error(`${label} failed${signal ? ` (${signal})` : ` (exit ${code})`}.`));
  });
});

const testFiles = (await readdir(TEST_DIR))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort();
const functionalFiles = testFiles.filter((name) => name !== BENCHMARK);

if (!testFiles.includes(BENCHMARK)) throw new Error(`Missing mandatory benchmark: ${BENCHMARK}`);

const checkedInBuildMeta = await readFile(BUILD_META);
try {
  // Boot and Sync are measured in separate fresh processes so neither benchmark's
  // setup, IndexedDB workload, garbage collection, or generated-file I/O can
  // contaminate the other. The stricter Sync threshold runs first.
  await runNodeTests([BENCHMARK], 'Sync performance benchmark', { ...process.env, RAKEEZX_BENCHMARK_CASE: 'sync' });
  await runNodeTests([BENCHMARK], 'Boot performance benchmark', { ...process.env, RAKEEZX_BENCHMARK_CASE: 'boot' });

  // Validate metadata generated from this checkout's exact bytes, then restore
  // the checked-in Production identity even when a test fails.
  await writeGeneratedBuildMeta();
  await runNodeTests(functionalFiles, 'Deterministic functional/unit suite');
} finally {
  await writeFile(BUILD_META, checkedInBuildMeta);
}
