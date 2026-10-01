import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const port = process.env.RAKEEZX_PULL_PORT || '5461';
const baseURL = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: root, stdio: 'inherit' });
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(baseURL)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Dedicated test server did not start');
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
    cwd: root, stdio: 'inherit', env: { ...process.env, RAKEEZX_E2E_SERVER: 'external',
      RAKEEZX_E2E_BASE_URL: baseURL, RAKEEZX_ATTENDANCE_TEST_URL: baseURL },
  });
  process.exitCode = await new Promise(resolve => child.on('exit', resolve));
} finally { server.kill(); }
