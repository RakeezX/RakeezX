import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const base = '60b9197354e8656df739a4e7ee30b9016aeec3c1';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const paths = new Set([
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean));
for (const path of paths) assert.match(path, /^(src\/views\/settings\.js|tests\/n64-presentation-[^/]+\.mjs|docs\/automation-evidence\/20261014\/N64_PENDING_GUIDANCE_ONLY\.md)$/);
const before = git('show', `${base}:src/views/settings.js`);
const after = await readFile('src/views/settings.js', 'utf8');
const call = 'const updated = await cloud.updateCurrentUserEmail(nextEmail);';
assert.equal(before.split(call).length, 2);
assert.equal(after.split(call).length, 2);
assert.ok(after.includes("code: 'AUTH_OWNER_MISMATCH'"));
assert.deepEqual(after.match(/^import .*$/gm), before.match(/^import .*$/gm));
assert.equal(git('diff', base, '--', 'src/lib/cloud.js', 'src/router.js', 'src/app.js', 'src/lib/dom.js', 'src/store.js', 'src/lib/sync.js'), '');
console.log('PASS n64_no_auth_logic_change: allowed paths only, identical existing email-call expression/imports, existing owner mismatch guard, shared Auth/router/app/DOM/store/Sync untouched');
