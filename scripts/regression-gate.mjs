import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildEnv = { ...process.env };

const run = (command, args, env = process.env) => new Promise((resolveRun, reject) => {
  const child = spawn(command, args, { cwd: ROOT, env, stdio: 'inherit' });
  child.once('error', reject);
  child.once('close', (code, signal) => {
    if (code === 0) resolveRun();
    else reject(new Error(`${command} ${args.join(' ')} failed${signal ? ` (${signal})` : ` (exit ${code})`}.`));
  });
});

const buildMetaPath = resolve(ROOT, 'src/generated/build-meta.generated.js');
const checkedInBuildMeta = await readFile(buildMetaPath);
const timestamp = checkedInBuildMeta.toString('utf8').match(/"buildTimestamp":\s*"([^"]+)"/)?.[1];
if (!timestamp) throw new Error('Could not preserve the checked-in Build Meta timestamp for local validation.');
buildEnv.CF_PAGES_BUILD_TIME = timestamp;

try {
  await run(process.execPath, ['scripts/test-sync-runner.mjs']);
  await run(process.execPath, ['scripts/e2e-runner.mjs']);
  await run(process.execPath, ['scripts/generate-build-meta.mjs'], buildEnv);
  await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], buildEnv);
} finally {
  await writeFile(buildMetaPath, checkedInBuildMeta);
}
await run('git', ['diff', '--check']);
