import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const base = 'b47a0ababa135a10b2e0bcb097b813b156b7063b';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const paths = new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean));
for (const file of paths) assert.match(file, /^(src\/views\/settings\.js|src\/styles\/components\.css|tests\/n64-stability-[^/]+\.mjs|docs\/automation-evidence\/20261014\/N64_SETTINGS_STABILITY\.md)$/);
const before = git('show', `${base}:src/views/settings.js`);
const after = await readFile('src/views/settings.js', 'utf8');
assert.equal(after.slice(after.indexOf('  actions: {')).trimEnd(), before.slice(before.indexOf('  actions: {')).trimEnd(), 'All settings actions and Auth submit/owner guards unchanged');
const sheet = source => source.slice(source.indexOf('function emailChangeSheet('), source.indexOf('function yearSheet('));
assert.equal(sheet(after), sheet(before), 'Existing submit, pending, validation, error and modal behavior unchanged');
assert.equal(git('diff', base, '--', 'src/lib/cloud.js', 'src/router.js', 'src/app.js', 'src/lib/dom.js', 'src/store.js', 'src/lib/sync.js', 'src/lib/account-profile.js', 'src/lib/workspace-routing.js', 'sw.js'), '');
console.log('PASS n64_no_auth_or_sync_semantics_change: exact actions/sheet unchanged; Auth/router/app/DOM/store/Sync/ownership/offline shell untouched; allowed diff only');
