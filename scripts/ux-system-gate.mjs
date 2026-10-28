/**
 * UX System Quality Gate V1 — synthetic Demo only.
 * Never requires a personal account, service worker, or external API access.
 * Usage: npm run test:ux:system [-- webkit|firefox|chromium].
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const browser = process.argv[2] ?? 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(browser)) {
  console.error('Supported browser: chromium, firefox, webkit');
  process.exit(2);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const result = spawnSync(process.execPath, [
  cli, 'test', '--config', 'playwright-ux-skills.config.mjs',
  'tests/ux-skills-system-audit.spec.mjs', '--browser', browser
], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    RAKEEZX_E2E_BASE_URL: 'http://127.0.0.1:5194',
    UX_AUDIT_RUN: 'gate',
    UX_SYSTEM_QUALITY_GATE: '1'
  }
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
