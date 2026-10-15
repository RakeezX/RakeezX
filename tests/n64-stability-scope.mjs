import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const base = 'f5bbc185039e96acacfd3d8c360cee55958c75c3';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const paths = new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean));
for (const file of paths) assert.match(file, /^(src\/views\/settings\.js|src\/lib\/settings-profile-ui\.js|src\/app\.js|src\/styles\/components\.css|tests\/n64-(stability|confirmed-email)-[^/]+\.(mjs|json)|docs\/automation-evidence\/20261015\/N64_VERIFIED_EMAIL_STABLE_SETTINGS\.md)$/);
const before = git('show', `${base}:src/views/settings.js`);
const after = await readFile('src/views/settings.js', 'utf8');
assert.equal(after.slice(after.indexOf('  actions: {')).trimEnd(), before.slice(before.indexOf('  actions: {')).trimEnd(), 'All settings actions and Auth submit/owner guards unchanged');
const sheet = source => source.slice(source.indexOf('function emailChangeSheet('), source.indexOf('function yearSheet('));
assert.equal(sheet(after), sheet(before), 'Existing submit, pending, validation, error and modal behavior unchanged');
assert.equal(git('diff', base, '--', 'src/lib/cloud.js', 'src/router.js', 'src/lib/dom.js', 'src/store.js', 'src/lib/sync.js', 'src/lib/account-profile.js', 'src/lib/workspace-routing.js', 'sw.js'), '');
console.log('PASS n64_no_auth_or_sync_semantics_change: exact actions/sheet unchanged; Auth/router/DOM/store/Sync/ownership/offline shell untouched; app only invokes beforePaint; allowed diff only');

const app = await readFile('src/app.js', 'utf8');
assert.equal(app.replace('  view.beforePaint?.(mainEl, ctx.params);\n', ''), execFileSync('git', ['show', `${base}:src/app.js`], {encoding:'utf8'}).replaceAll('\r\n', '\n'));
