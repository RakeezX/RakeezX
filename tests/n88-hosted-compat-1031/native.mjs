import {qualify} from './cases.mjs';
/** AI: explicit, local-only native PG qualification. No default DSN or installer.
 * Reuses installed tools only; creates a NEW SCRAM-authenticated loopback cluster.
 * Run from the activated worktree: node tests/n88-hosted-compat-1031/native.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
assert.equal(path.resolve(process.cwd()), root);
const taskId = 'continuous-n88-hosted-runtime-compatibility-20261031', runId = 'e064f942-5130-4715-ae80-fb2173033c90';
const canonicalRoot = 'C:/Users/Abody/Projects/RakeezX';
const toolRoot = path.join(canonicalRoot, 'artifacts/n77-native-pg17');
const bin = path.join(toolRoot, 'package/native/bin');
const { Client } = createRequire(import.meta.url)(path.join(toolRoot, 'client/node_modules/pg'));
const phase = path.join(root, 'artifacts', `${taskId}-${randomUUID()}.tmp`), data = path.join(phase, 'data');
await mkdir(phase, { recursive: true });
const marker = { taskId, runId, token: randomUUID(), runnerPid: process.pid, phase, data };
await writeFile(path.join(phase, 'owner.json'), JSON.stringify(marker), { flag: 'wx' });
const env = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', PATH: `${bin};C:\\Windows\\System32`,
  TEMP: phase, TMP: phase, LANG: 'C' }; // Per-process only; no PG env/pgpass/URL.
const command = (file, args, timeout = 30000, stdio) => execFileSync(file, args, { encoding: 'utf8', windowsHide: true, timeout, env, stdio, maxBuffer: 1024 * 1024 });
const psExe = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const ps = script => command(psExe, ['-NoProfile', '-NonInteractive', '-Command', script]);
const git = args => command('C:/Program Files/Git/cmd/git.exe', args).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const processInfo = pid => JSON.parse(ps(`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(pid)}'; if($p){@{pid=$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;commandLine=$p.CommandLine}|ConvertTo-Json -Compress}else{'null'}`));
const normalize = p => path.resolve(p).toLowerCase();
const control = args => command(path.join(bin, 'pg_ctl.exe'), args, 25000, 'ignore');
const taskFile = path.join(canonicalRoot, 'artifacts/ops-supervisor-v4/queue', taskId + '.json');
// Exact existing controller.mjs/runner configuration, not Bypass/Unrestricted or
// a global policy change. The first attempt omitted this approved process flag.
const lease = action => command(psExe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', path.join(canonicalRoot, 'scripts/ops-supervisor-v4/resource-lease.ps1'),
  '-Name', 'integration', '-Action', action, '-TaskFile', taskFile, '-WaitSeconds', '0', '-OwnerToken', runId]);
const report = { taskId, runId, baseSha: '5e5c19be4779eadb555dc9641f6ae1f91e029cd9', startedAt: new Date().toISOString(), phase,
  checks: [], sourceSha256: {}, cleanup: { stopped: false }, ownershipEpochs: [] };
let identity, port, started = false, leased = false, reservation, failure;
const clients = new Set(), password = randomBytes(32).toString('hex'), passwordFile = path.join(phase, 'password.tmp');
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer(); server.once('error', reject); server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => resolve(server));
});
const close = server => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
async function proveIdentity() {
  assert.deepEqual(JSON.parse(await readFile(path.join(phase, 'owner.json'), 'utf8')), marker);
  const lines = (await readFile(path.join(data, 'postmaster.pid'), 'utf8')).trim().split(/\r?\n/);
  assert.equal(normalize(lines[1]), normalize(data)); assert.equal(Number(lines[3]), port);
  const info = processInfo(Number(lines[0])); assert(info);
  assert.equal(normalize(info.executable), normalize(path.join(bin, 'postgres.exe')));
  assert(info.commandLine.replaceAll('/', '\\').toLowerCase().includes(data.toLowerCase()));
  assert(Math.abs(Date.parse(info.birth) - Number(lines[2]) * 1000) < 3000);
  if (identity) { assert.equal(info.pid, identity.pid); assert.equal(info.birth, identity.birth); }
  else { identity = info; report.ownershipEpochs.push({ ...info, data, port }); }
}
async function connect(label = 'fixture') {
  assert(started && identity); // Identity is proved before the first connection.
  const c = new Client({ host: '127.0.0.1', port, user: 'n88_local_admin', password, database: 'postgres', ssl: false,
    connectionTimeoutMillis: 4000, statement_timeout: 8000, lock_timeout: 6000, query_timeout: 10000,
    application_name: `n88-local-${label}`, options: '-c search_path=pg_catalog' });
  c.on('error', () => {}); clients.add(c); await c.connect();
  const r = (await c.query("select current_setting('data_directory') as dir,host(inet_server_addr()) as host,inet_server_port() as port,version() as version")).rows[0];
  assert.equal(normalize(r.dir), normalize(data)); assert.equal(r.host, '127.0.0.1'); assert.equal(r.port, port);
  assert.match(r.version, /^PostgreSQL 17\.6 /); report.serverVersion = r.version;
  return c;
}
async function disconnectAll() { for (const c of clients) { try { await c.end(); } catch {} } clients.clear(); }
async function portFree() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen({ host: '127.0.0.1', port, exclusive: true }, resolve); });
  await close(server);
}
async function stop() {
  await disconnectAll(); await proveIdentity(); const prior = identity;
  control(['-D', data, '-m', 'fast', '-w', '-t', '20', 'stop']);
  assert.equal(processInfo(prior.pid), null); await portFree(); started = false;
  return { pid: prior.pid, birth: prior.birth, pidAbsent: true, portFree: true };
}
try {
  git(['check-ignore', '--quiet', phase]); // Exit status, not Windows quoted path spelling.
  report.runtime = { existing: true, package: '@embedded-postgres/windows-x64@17.6.0-beta.15',
    provenance: 'existing N77 REPORT.md and archive; third-party packaged native PG, NOT claimed as an official EDB download',
    archiveSha256: hash(await readFile(path.join(toolRoot, 'embedded-postgres-windows-x64-17.6.0-beta.15.tgz'))),
    postgresSha256: hash(await readFile(path.join(bin, 'postgres.exe'))),
    initdbSha256: hash(await readFile(path.join(bin, 'initdb.exe'))),
    pgctlSha256: hash(await readFile(path.join(bin, 'pg_ctl.exe'))),
    version: command(path.join(bin, 'postgres.exe'), ['--version']).trim(), driver: 'pg@8.16.3' };
  assert.equal(report.runtime.archiveSha256, '342a4d42245f9562fc7e7652b353e8f1cecb56febebc72db1a8e2ace0b100528');
  for (const file of ['drafts/n88-student-portal/publication-v2-canonical.inactive.mjs', 'drafts/n88-student-portal/auth-verifier.mjs', 'drafts/n88-student-portal/canonical-adapter.mjs', 'drafts/n88-student-portal/numeric-credentials.mjs', 'drafts/n88-student-portal/publication-v2-postgres.inactive.mjs', 'drafts/n88-student-portal/publication-v2-storage.inactive.sql',
    'drafts/n88-student-portal/publication-v2-service.inactive.mjs', 'drafts/n88-student-portal/student-projection.mjs',
    'tests/n88-backend-package-1028/native-composition.test.mjs']) report.sourceSha256[file] = hash(await readFile(path.join(root, file)));
  report.leaseAcquire = lease('acquire').trim(); leased = true;
  reservation = await freePort(); port = reservation.address().port; report.port = port;
  await writeFile(passwordFile, password + '\n', { flag: 'wx' });
  command(path.join(bin, 'initdb.exe'), ['-D', data, '--encoding=UTF8', '--locale=C', '--username=n88_local_admin', '--auth=scram-sha-256', '--pwfile=' + passwordFile]);
  await unlink(passwordFile);
  await writeFile(path.join(data, 'pg_hba.conf'), 'host all all 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n');
  await writeFile(path.join(data, 'postgresql.auto.conf'), `listen_addresses='127.0.0.1'\nport=${port}\nmax_connections=20\nshared_buffers='16MB'\nlog_statement='ddl'\nlog_min_error_statement='error'\nlog_error_verbosity='default'\nlog_parameter_max_length_on_error=0\nshared_preload_libraries='auto_explain'\nauto_explain.log_min_duration=10000\n`);
  await close(reservation); reservation = null;
  control(['-D', data, '-l', path.join(phase, 'server.log'), '-w', '-t', '20', 'start']); started = true; await proveIdentity();
  const admin = await connect('observer');
  report.localConfig = (await admin.query("select current_setting('listen_addresses') as listen, current_setting('port') as port, current_setting('password_encryption') as password_encryption")).rows[0];
  assert.equal(report.localConfig.listen, '127.0.0.1'); assert.equal(report.localConfig.password_encryption, 'scram-sha-256');
  report.hba = (await admin.query('select type,address,auth_method,error from pg_hba_file_rules order by rule_number')).rows;
  assert(report.hba.every(r => r.error === null)); assert.equal(report.hba[0].auth_method, 'scram-sha-256');
  const verifyRestart = await qualify({ root, admin, connect, report, phase, marker, Client, port, clients });
  report.restart = { prior: await stop() }; identity = undefined;
  control(['-D', data, '-l', path.join(phase, 'server.log'), '-w', '-t', '20', 'start']); started = true; await proveIdentity();
  const fresh = await connect('restart'); report.restart.newIdentity = { pid: identity.pid, birth: identity.birth };
  await verifyRestart(fresh);
  report.checks.push({name:'native_restart_preserves_corrected_attachment',status:'PASS'});
} catch (e) {
  failure = e; report.failure = { name: e.name, code: e.code ?? null, message: e.name === 'AssertionError' ? e.message : 'Native qualification operation failed; no raw SQL/credentials logged',
    location: e.stack?.split('\n').find(s => s.includes('.mjs:'))?.trim() ?? null };
} finally {
  try {
    if (reservation) await close(reservation);
    // A failed start may still have created our postmaster; inspect our new dir only.
    try { await readFile(path.join(data, 'postmaster.pid')); started = true; } catch {}
    if (started) {
      report.cleanup = { stopped: true, ...(await stop()) };
      assert.deepEqual(JSON.parse(await readFile(path.join(phase, 'owner.json'), 'utf8')), marker);
      const absoluteData = await realpath(data), absolutePhase = await realpath(phase);
      assert.equal(path.dirname(absoluteData), absolutePhase); assert.equal(path.basename(absoluteData), 'data');
      await rm(absoluteData, { recursive: true }); report.cleanup.ownedDataRemoved = true;
    }
  } catch (e) { report.cleanup.error = { name: e.name, code: e.code ?? null }; failure ??= e; }
  try { await unlink(passwordFile); } catch {}
  if (leased) { try { report.leaseRelease = lease('release').trim(); } catch (e) { failure ??= e; report.leaseRelease = 'FAIL'; } }
  report.finishedAt = new Date().toISOString(); report.status = failure ? 'FAIL' : 'PASS';
  await writeFile(path.join(phase, 'report.json'), JSON.stringify(report, null, 2));
  if (!process.argv.includes('--identity-only')) await writeFile(path.join(root,'tests/n88-hosted-compat-1031/'+(process.argv.includes('--packet-only')?'packet-results.json':process.argv.includes('--install-only')?'install-results.json':process.argv.includes('--disable-only')?'disable-results.json':process.argv.includes('--ack-only')?'ack-results.json':'results.json')), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ status: report.status, reportPath: path.join(phase, 'report.json'), checks: report.checks, cleanup: report.cleanup, failure: report.failure }));
}
if (failure) process.exitCode = 1;
