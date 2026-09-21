import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { A1_RASTERS, A1_VECTORS } from './helpers/a1-production-assets.mjs';
import {
  FAVICON_CROP_INSET,
  MASTER_NAME,
  MASTER_SHA256,
  MASTER_SIZE,
  PLATFORM_ICON_SIZES,
} from '../scripts/build-brand-assets.mjs';

const rootFile = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const assetFile = (name) => rootFile(`assets/${name}`);
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const pngInfo = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
  colorType: buffer[25],
});

test('authoritative master is the locked 1254px RGB PNG', async () => {
  const master = await readFile(assetFile(MASTER_NAME));
  assert.equal(hash(master), MASTER_SHA256);
  assert.deepEqual(pngInfo(master), { width: MASTER_SIZE, height: MASTER_SIZE, colorType: 2 });
});

test('platform matrix remains square; approved A1-L2 active exports preserve their exact formats', async () => {
  const sizes = [...new Set(Object.values(PLATFORM_ICON_SIZES).flat())];
  assert.deepEqual(PLATFORM_ICON_SIZES.web, [512, 256, 192, 180, 96, 64, 48, 32]);
  assert.deepEqual(PLATFORM_ICON_SIZES.android, [512, 192, 144, 96, 72, 48]);
  assert.deepEqual(PLATFORM_ICON_SIZES.ios, [1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20]);
  for (const size of sizes) {
    const output = await readFile(assetFile(`icon-${size}.png`));
    assert.deepEqual(pngInfo(output), { width: size, height: size, colorType: [192,512].includes(size) ? 6 : 2 }, `icon-${size}.png`);
  }
});

test('approved A1 outputs retain exact bytes, PNG dimensions and encodings without regeneration', async () => {
  for (const [file,size,colorType,sha256] of A1_RASTERS) {
    const bytes = await readFile(assetFile(file));
    assert.equal(hash(bytes),sha256,file);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes[24],8);
    assert.deepEqual(pngInfo(bytes),{width:size,height:size,colorType});
  }
  const favicon = await readFile(assetFile('favicon-32.png'));
  const icon32 = await readFile(assetFile('icon-32.png'));
  const maskable = await readFile(assetFile('icon-maskable.png'));
  const icon512 = await readFile(assetFile('icon-512.png'));
  assert.equal(FAVICON_CROP_INSET, 108);
  assert.notEqual(hash(favicon), hash(icon32));
  assert.deepEqual(pngInfo(favicon), { width: 32, height: 32, colorType: 6 });
  assert.notEqual(hash(maskable), hash(icon512));
});

test('approved outlined headers and sanitized Micro-Mark have exact safe vector bytes', async () => {
  for (const [file,width,height,sha256] of A1_VECTORS) {
    const bytes = await readFile(assetFile(file)), svg = bytes.toString();
    assert.equal(hash(bytes),sha256,file);
    assert.match(svg,new RegExp(`viewBox="0 0 ${width} ${height}"`));
    assert.doesNotMatch(svg,/<text\b|<script\b|<foreignObject\b|<!ENTITY|@font-face|\bon\w+=/i);
    for (const match of svg.matchAll(/(?:href|src)=["']([^"']+)/g)) assert.ok(match[1].startsWith('#'));
    for (const match of svg.matchAll(/url\(([^)]+)\)/g)) assert.ok(match[1].startsWith('#'));
  }
});

test('Brand release preserves Production identity, install actions and offline policy across later runtime work', async () => {
  const baseline = file => execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'show',`66b0f4bd1748ac1fb756d47fb814c66cf4df64af:${file}`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  const productionBaseline = file => execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'show',`5f88e74d7d0af36df136ec2c90a57619143013bf:${file}`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  const read = async file => (await readFile(rootFile(file),'utf8')).replace(/\r\n/g,'\n');
  for (const file of ['manifest.webmanifest','src/lib/student-lifecycle.js','src/views/attendance.js']) assert.equal(await read(file),baseline(file),file);
  const accountProfileField = "  teacherForm: o.teacherForm === 'feminine' ? 'feminine' : 'masculine',\n";
  assert.equal((await read('src/models.js')).replace(accountProfileField, ''), baseline('src/models.js'), 'src/models.js');
  const databaseSelector = `let activeDatabaseName = DB_NAME;

`;
  const databaseRouting = `export function selectDatabase(databaseName) {
  const name = String(databaseName ?? '').trim();
  if (!/^(?:rakeezx|rakeezx-demo|rakeezx-user-[0-9a-f]{32})$/.test(name)) {
    throw Object.assign(new Error('Invalid resolved Product database name'), { code: 'INVALID_WORKSPACE_DATABASE' });
  }
  if (_db && _db.name !== name) {
    throw Object.assign(new Error('Cannot switch Product databases while one is mounted'), {
      code: 'WORKSPACE_DATABASE_ALREADY_OPEN',
    });
  }
  activeDatabaseName = name;
  return activeDatabaseName;
}

export const getActiveDatabaseName = () => activeDatabaseName;

`;
  const database = await read('src/lib/db.js');
  const initialRestoreDbStart = '/**\n * Installs a verified CORE_V1 snapshot and a local-only receipt atomically.';
  const initialRestoreDbEnd = '/**\n * يُغلق اتصال قاعدة البيانات تمامًا.';
  const restoreStartAt = database.indexOf(initialRestoreDbStart);
  const restoreEndAt = database.indexOf(initialRestoreDbEnd);
  assert.ok(restoreStartAt > -1 && restoreEndAt > restoreStartAt, 'Initial Restore DB support must be one bounded block');
  const initialRestoreDb = database.slice(restoreStartAt, restoreEndAt);
  assert.equal(initialRestoreDb.split('export async function importInitialRestoreSnapshot').length - 1, 1);
  assert.equal(initialRestoreDb.split('export async function readInitialRestoreReceipt').length - 1, 1);
  assert.equal(database.split(databaseSelector).length - 1, 1, 'workspace database selector must occur exactly once');
  assert.equal(database.split(databaseRouting).length - 1, 1, 'approved workspace database routing must occur exactly once');
  assert.equal(database
    .replace(databaseSelector, '')
    .replace(databaseRouting, '')
    .replace(initialRestoreDb, '')
    .replace('indexedDB.open(activeDatabaseName, DB_VERSION)', 'indexedDB.open(DB_NAME, DB_VERSION)'), baseline('src/lib/db.js'), 'src/lib/db.js outside approved workspace routing');
  const store = await read('src/store.js');
  assert.match(store, /export const THEME_BOOT_STORAGE_KEY = 'rakeezx-theme'/);
  assert.match(store, /localStorage\?\.setItem\(THEME_BOOT_STORAGE_KEY, t\)/);
  assert.doesNotMatch(store, /assets\/(?:icon|header|micro-mark|favicon)/);
  const identityValidation = `/**
 * Revalidate the current Auth identity with Supabase before a local workspace
 * ownership transition. Cached session/user data alone is deliberately not
 * sufficient for this operation.
 */
export async function verifyCurrentAuthIdentity(expectedOwnerId) {
  const expected = String(expectedOwnerId ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expected)) {
    throw Object.assign(new Error('A valid expected Auth user ID is required'), { code: 'INVALID_AUTH_USER_ID' });
  }
  await ensureFreshSession();
  if (!session?.access_token) throw authError('Authentication required');
  const verified = await request('/user', { method: 'GET' }, true);
  const actual = String(verified?.id ?? '').trim().toLowerCase();
  if (actual !== expected) {
    throw Object.assign(new Error('Verified Auth user does not match the expected workspace owner'), {
      code: 'AUTH_OWNER_MISMATCH', expectedOwnerId: expected, verifiedOwnerId: actual || null,
    });
  }
  saveSession({ ...session, user: verified });
  return Object.freeze({
    id: actual,
    verifiedAt: Date.now(),
    source: 'supabase-auth-user',
  });
}

`;
  const cloudSource = await read('src/lib/cloud.js');
  assert.equal(cloudSource.split(identityValidation).length - 1, 1, 'approved Auth identity validation must occur exactly once');
  const emailOtpStart = '/** Requests an email OTP for an existing Auth user without provisioning. */';
  const emailOtpEnd = '/**\n * Revalidate the current Auth identity with Supabase before a local workspace';
  const emailOtpStartAt = cloudSource.indexOf(emailOtpStart);
  const emailOtpEndAt = cloudSource.indexOf(emailOtpEnd);
  assert.ok(emailOtpStartAt > -1 && emailOtpEndAt > emailOtpStartAt, 'email OTP support must be one bounded block');
  const emailOtpCloud = cloudSource.slice(emailOtpStartAt, emailOtpEndAt);
  assert.equal(emailOtpCloud.split('export async function requestEmailOtp').length - 1, 1);
  assert.equal(emailOtpCloud.split('export async function verifyEmailOtp').length - 1, 1);
  assert.match(emailOtpCloud, /create_user:\s*false/);
  const emailChangeStart = '/**\n * Request an Auth-authoritative email change.';
  const emailChangeEnd = 'export async function signOut() {';
  const emailChangeStartAt = cloudSource.indexOf(emailChangeStart);
  const emailChangeEndAt = cloudSource.indexOf(emailChangeEnd);
  assert.ok(emailChangeStartAt > -1 && emailChangeEndAt > emailChangeStartAt, 'approved email-change support must be one bounded block');
  const emailChangeCloud = cloudSource.slice(emailChangeStartAt, emailChangeEndAt);
  assert.equal(emailChangeCloud.split('export async function updateCurrentUserEmail').length - 1, 1);
  assert.match(emailChangeCloud, /request\('\/user'/);
  assert.match(emailChangeCloud, /actualOwnerId !== expectedOwnerId/);
  const curriculumCloudStart = '/** Owner-derived curriculum bootstrap status. Domain rows are never returned here. */';
  const curriculumCloudEnd = '/** Sync V2 enrollment command transport. */';
  const curriculumStartAt = cloudSource.indexOf(curriculumCloudStart);
  const curriculumEndAt = cloudSource.indexOf(curriculumCloudEnd);
  assert.ok(curriculumStartAt > -1 && curriculumEndAt > curriculumStartAt, 'approved curriculum RPC support must be one bounded block');
  const curriculumCloud = cloudSource.slice(curriculumStartAt, curriculumEndAt);
  for (const name of [
    'getCurriculumSyncBootstrapStatus', 'contributeCurriculumSyncBootstrap',
    'finalizeCurriculumSyncBootstrap', 'getSyncV2RestoreManifestFull', 'getSyncV2RestoreCanonicalFull',
  ]) assert.equal(curriculumCloud.split(`export async function ${name}`).length - 1, 1, `${name} must occur exactly once`);
  for (const endpoint of [
    '/rpc/get_curriculum_sync_bootstrap_status', '/rpc/contribute_curriculum_sync_bootstrap',
    '/rpc/finalize_curriculum_sync_bootstrap', '/rpc/sync_v2_restore_manifest_full',
    '/rpc/sync_v2_restore_canonical_full',
  ]) assert.equal(curriculumCloud.split(endpoint).length - 1, 1, endpoint);
  assert.doesNotMatch(
    curriculumCloud.slice(0, curriculumCloud.indexOf('export async function getSyncV2RestoreManifestFull')),
    /p_owner\s*:/,
    'bootstrap owner must remain exclusively server-derived',
  );
  const accountCloudStart = '/** Owner-derived account profile/access foundation RPCs. */';
  const accountCloudEnd = '/** End account profile/access foundation RPCs. */';
  const accountStartAt = cloudSource.indexOf(accountCloudStart);
  const accountEndAt = cloudSource.indexOf(accountCloudEnd);
  assert.ok(accountStartAt > -1 && accountEndAt > accountStartAt, 'account foundation RPC support must be one bounded block');
  const accountCloud = cloudSource.slice(accountStartAt - 1, accountEndAt + accountCloudEnd.length + 1);
  for (const name of ['getAccountContract', 'provisionAccountProfile', 'completeAccountProfile']) {
    assert.equal(accountCloud.split(`export async function ${name}`).length - 1, 1, `${name} must occur exactly once`);
  }
  for (const endpoint of ['/rpc/account_contract', '/rpc/provision_account_profile', '/rpc/complete_account_profile']) {
    assert.equal(accountCloud.split(endpoint).length - 1, 1, endpoint);
  }
  const cloud = cloudSource
    .replace('export async function init({ waitForRefresh = true } = {}) {', 'export async function init() {')
    .replace("          const refresh = refreshSession().catch((error) => {\n            if (!isAuthRequiredError(error)) console.warn('[rakeezx auth] Session refresh deferred until connectivity returns.');\n          });\n          if (waitForRefresh) await refresh;", "          try { await refreshSession(); }\n          catch (error) {\n            if (!isAuthRequiredError(error)) console.warn('[rakeezx auth] Session refresh deferred until connectivity returns.');\n          }")
    .replace(identityValidation, '')
    .replace(emailOtpCloud, '')
    .replace(emailChangeCloud, '')
    .replace(accountCloud, '')
    .replace(curriculumCloud, '');
  assert.equal(cloudSource, productionBaseline('src/lib/cloud.js'), 'src/lib/cloud.js must remain byte-identical to the Demo candidate Production baseline');
  const home=await read('src/views/home.js'),oldHome=baseline('src/views/home.js');
  assert.equal(home.slice(home.indexOf('  actions:')),oldHome.slice(oldHome.indexOf('  actions:')));
  const rawWorker=await read('sw.js'),oldWorker=baseline('sw.js');
  const executableRevalidation = `          // Cloudflare may keep executable responses fresh in the browser HTTP
          // cache for hours. Revalidate them explicitly so a runtime-only
          // deployment cannot keep executing the prior release until expiry.
          return await cacheResponse(request, await fetch(new Request(request, { cache: 'reload' })));`;
  const worker = rawWorker.replace(
    executableRevalidation,
    '          return await cacheResponse(request, await fetch(request));',
  );
  assert.equal(worker.slice(worker.indexOf("self.addEventListener('install'")),oldWorker.slice(oldWorker.indexOf("self.addEventListener('install'")));
  assert.match(worker,/const VERSION = 'rakeezx-v29';/);
  assert.match(worker,/\.\/src\/lib\/email-otp\.js/);
  assert.match(worker,/\.\/src\/lib\/account-profile\.js/);
  assert.match(worker,/\.\/src\/lib\/demo-workspace\.js/);
  assert.match(worker, /\.\/src\/lib\/initial-restore\.js/);
  assert.match(worker,/\.\/src\/lib\/curriculum-bootstrap\.js/);
  assert.equal(rawWorker.split(executableRevalidation).length - 1, 1, 'executable HTTP-cache revalidation must occur exactly once');
  assert.match(worker,/\.\/src\/lib\/workspace-claim\.js/);
  assert.match(worker,/\.\/src\/lib\/workspace-routing\.js/);
  assert.match(worker,/return \(await caches\.match\('\.\/'\)\) \|\| cachedFallback\('\.\/index\.html', 503\)/);
  assert.match(worker,/generation < CACHE_GENERATION/);
  for (const [file] of A1_VECTORS) assert.ok(worker.includes(`'./assets/${file}'`));
});

test('rejected 16px and previous generated SVG derivatives are not product assets', async () => {
  for (const name of ['favicon-16.png', 'icon-16.png', 'favicon.svg', 'icon.svg', 'brand-monochrome.svg']) {
    await assert.rejects(access(assetFile(name)));
  }
  const files = await Promise.all([
    readFile(rootFile('index.html'), 'utf8'),
    readFile(rootFile('manifest.webmanifest'), 'utf8'),
    readFile(rootFile('sw.js'), 'utf8'),
  ]);
  const references = files.join('\n');
  assert.doesNotMatch(references, /favicon-16|favicon\.svg|icon\.svg|brand-monochrome/);
  assert.match(references, /favicon-32\.png\?v=19/);
});
