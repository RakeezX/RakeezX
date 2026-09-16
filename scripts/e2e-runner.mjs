import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_DIR = fileURLToPath(new URL('../tests/', import.meta.url));
const VITE = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const PLAYWRIGHT = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const BASE_URL = 'http://127.0.0.1:5173';
const runnerEnv = {
  ...process.env,
  RAKEEZX_E2E_SERVER: 'external',
  RAKEEZX_E2E_BASE_URL: BASE_URL,
  RAKEEZX_ATTENDANCE_TEST_URL: BASE_URL,
  RAKEEZX_TIMING_TEST_URL: BASE_URL,
};

const run = (file, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [file, ...args], { cwd: ROOT, env, stdio: 'inherit' });
  child.once('error', reject);
  child.once('close', (code, signal) => resolve({ code, signal }));
});

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become ready at ${BASE_URL}.`);
}

const server = spawn(process.execPath, [VITE, '--host', '127.0.0.1'], {
  cwd: ROOT,
  stdio: ['ignore', 'inherit', 'inherit'],
});

try {
  await waitForServer();
  const requestedSpecs = process.argv.slice(2);
  const specs = requestedSpecs.length ? requestedSpecs : (await readdir(TEST_DIR)).filter((name) => name.endsWith('.e2e.mjs')).sort();
  for (const spec of specs) {
    // A fresh Playwright process per spec prevents module/fixture leakage and
    // Windows socket exhaustion. Playwright still creates an isolated browser
    // context and page for every test, with one worker and zero retries.
    const result = await run(PLAYWRIGHT, ['test', `tests/${spec}`], runnerEnv);
    if (result.code !== 0) throw new Error(`E2E spec failed in its isolated Playwright process: ${spec}`);
  }
} finally {
  if (!server.killed && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
}
