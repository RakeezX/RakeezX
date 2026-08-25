import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_DIR = fileURLToPath(new URL('../tests/', import.meta.url));
const VITE = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const PLAYWRIGHT = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const BASE_URL = 'http://127.0.0.1:5173';
const runnerEnv = { ...process.env, RAKEEZX_E2E_SERVER: 'external' };

const run = (file, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [file, ...args], { cwd: ROOT, env, stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve({ code, signal }));
});

const listTests = (spec) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [PLAYWRIGHT, 'test', `tests/${spec}`, '--list', '--reporter=json'], {
    cwd: ROOT,
    env: runnerEnv,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.once('error', reject);
  child.once('exit', (code) => {
    if (code !== 0) return reject(new Error(`Could not list E2E tests for ${spec}.`));
    try {
      const collected = [];
      const collect = (suite) => {
        for (const test of suite.specs ?? []) collected.push(test);
        for (const childSuite of suite.suites ?? []) collect(childSuite);
      };
      for (const suite of JSON.parse(output).suites ?? []) collect(suite);
      const locations = new Map(collected.map((test) => [`${test.file}:${test.line}:${test.column}`, test]));
      resolve([...locations.values()]);
    } catch (error) {
      reject(new Error(`Could not parse the E2E test list for ${spec}: ${error.message}`));
    }
  });
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
    const tests = await listTests(spec);
    for (const test of tests) {
      const result = await run(PLAYWRIGHT, ['test', `tests/${spec}:${test.line}`], runnerEnv);
      if (result.code !== 0) throw new Error(`E2E test failed with isolated Chromium lifecycle: ${spec}:${test.line}`);
    }
  }
} finally {
  if (!server.killed && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
}