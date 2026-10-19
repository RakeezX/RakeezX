/** Explicitly invoked, synthetic-only native PG17 qualification. Never auto-started. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, access, rm } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { qualify } from './fixtures/n122-1019/native-cases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(path.resolve(process.cwd()), root, 'run from task worktree');
const runId = '57e985f1-2297-4d68-9855-061744258c65';
const bin = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin';
const clientPath = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg';
const { Client } = createRequire(import.meta.url)(clientPath);
// No default PG environment, connection URL, pgpass, project config or secret read.
const childEnv = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows',
  PATH: `${bin};C:\\Windows\\System32`, TEMP: path.join(root, 'artifacts'),
  TMP: path.join(root, 'artifacts'), LANG: 'C' };
const command = (file, args, timeout = 30000) => execFileSync(file === 'git' ? 'C:/Program Files/Git/cmd/git.exe' : file, args,
  { encoding: 'utf8', windowsHide: true, timeout, env: childEnv, maxBuffer: 1024 * 1024 });
// Windows pg_ctl's server-launch shell can inherit captured stdout handles.
// No inherited pipe for start/stop: all server diagnostics go to owned log.
const control = args => execFileSync(path.join(bin, 'pg_ctl.exe'), args,
  { windowsHide:true, timeout:25000, env:childEnv, stdio:'ignore' });
const ps = script => command('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
  ['-NoProfile', '-NonInteractive', '-Command', script]);
const processInfo = pid => JSON.parse(ps(`$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(pid)}'; if ($p) { @{ pid=$p.ProcessId; birth=$p.CreationDate.ToUniversalTime().ToString('o'); executable=$p.ExecutablePath; commandLine=$p.CommandLine } | ConvertTo-Json -Compress } else { 'null' }`));
const phase = path.join(root, 'tests/fixtures/n122-1019', `n122-native-pg-${runId}-${randomUUID()}`);
assert.ok(phase.startsWith(path.join(root, 'tests/fixtures/n122-1019', `n122-native-pg-${runId}-`)));
const data = path.join(phase, 'data');
await mkdir(phase, { recursive: false }); // New ownership boundary, never reuse data.
const marker = { runId, token: randomUUID(), runnerPid: process.pid, phase, data };
await writeFile(path.join(phase, 'owner.json'), JSON.stringify(marker), { flag: 'wx' });
const reportPath = path.join(root, 'tests/n122-1019-native.json');
const report = { taskId: 'continuous-n122-permanent-activity-waiting-slots-20261019', runId,
  baseSha: command('git', ['rev-parse', 'HEAD']).trim(), startedAt: new Date().toISOString(),
  version: command(path.join(bin, 'pg_ctl.exe'), ['--version']).trim(),
  phase, data, checks: [], negativeSqlstates: [], cleanup: { stopped: false } };
const password = randomBytes(32).toString('hex'); // Only this disposable cluster.
const passwordFile = path.join(phase, 'password.tmp');
const clients = new Set();
let reservation, port, started = false, identity;
const bind = () => new Promise((resolve, reject) => {
  const server = net.createServer(); server.once('error', reject);
  server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => resolve(server));
});
const closeServer = server => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
async function proveIdentity() {
  const same = JSON.parse(await readFile(path.join(phase, 'owner.json'), 'utf8'));
  assert.deepEqual(same, marker);
  const pidLines = (await readFile(path.join(data, 'postmaster.pid'), 'utf8')).trim().split(/\r?\n/);
  assert.equal(path.resolve(pidLines[1]), data);
  assert.equal(Number(pidLines[3]), port);
  const info = processInfo(Number(pidLines[0]));
  assert.ok(info && info.executable.toLowerCase() === path.join(bin, 'postgres.exe').toLowerCase().replaceAll('/', '\\'));
  assert.ok(info.commandLine.replaceAll('/', '\\').includes(data));
  if (identity) assert.equal(info.birth, identity.birth);
  else {
    assert.ok(Math.abs(Date.parse(info.birth) - Number(pidLines[2]) * 1000) < 3000);
    identity = info;
    report.ownership = { pid: info.pid, birth: info.birth, data, port, pidFileDirectoryMatches: true,
      executableMatches: true, commandLineDirectoryMatches: true };
  }
}
async function connect() {
  await proveIdentity(); // No DB connection before PID/birth/directory proof.
  const c = new Client({ host: '127.0.0.1', port, user: 'postgres', password,
    database: 'postgres', ssl: false, connectionTimeoutMillis: 4000,
    statement_timeout: 6000, lock_timeout: 3000, query_timeout: 8000,
    application_name: `n122-owned-${runId}`, options: '-c search_path=pg_catalog' });
  clients.add(c); await c.connect();
  const proof = (await c.query(`select current_setting('data_directory') as dir,
    host(inet_server_addr()) as host, inet_server_port() as port, version() as version`)).rows[0];
  assert.equal(path.resolve(proof.dir), data); assert.equal(proof.host, '127.0.0.1'); assert.equal(proof.port, port);
  report.serverVersion = proof.version;
  return c;
}
const lease = action => command('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n122-permanent-activity-waiting-slots-20261019.json','-OwnerToken',runId,'-WaitSeconds','0']);
let leaseOwned=false;
let failure;
try {
  report.lease=lease('acquire').trim(); leaseOwned=true;
  reservation = await bind(); port = reservation.address().port; report.port = port;
  await writeFile(passwordFile, password, { flag: 'wx' });
  command(path.join(bin, 'initdb.exe'), ['-D', data, '-U', 'postgres', '--pwfile', passwordFile,
    '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', '--no-instructions']);
  await unlink(passwordFile);
  await writeFile(path.join(data, 'postgresql.auto.conf'), `listen_addresses = '127.0.0.1'\nport = ${port}\nshared_buffers = '16MB'\nmax_connections = 12\nwork_mem = '1MB'\nmaintenance_work_mem = '16MB'\nstatement_timeout = '6s'\nlock_timeout = '3s'\nidle_in_transaction_session_timeout = '20s'\nlog_statement = 'none'\nlog_min_error_statement = 'panic'\nlog_error_verbosity = 'terse'\nlog_connections = off\nlog_disconnections = off\nmax_wal_size = '64MB'\nmin_wal_size = '32MB'\nfsync = on\nsynchronous_commit = on\nfull_page_writes = on\n`);
  await closeServer(reservation); reservation = null;
  control(['-D', data, '-l', path.join(phase, 'server.log'), '-w', '-t', '20', 'start']);
  started = true;
  const a = await connect(), b = await connect();
  report.connections = [(await a.query('select pg_backend_pid() as pid')).rows[0].pid,
    (await b.query('select pg_backend_pid() as pid')).rows[0].pid];
  assert.notEqual(...report.connections);
  const sql = await readFile(path.join(root, 'supabase/migrations/20261019091500_n122_non_teaching_slots.sql'), 'utf8');
  report.schemaSha256 = createHash('sha256').update(sql).digest('hex');
  await qualify({ a, b, sql, report, root });
} catch (e) {
  failure = e;
  // Do not print PostgreSQL DETAIL, bind values, credentials or arbitrary errors.
  report.failure = { name: e.name, code: e.code ?? null,
    message: /^[0-9A-Z]{5}$/.test(e.code ?? '') ? 'SQL operation failed; see named check and SQLSTATE' : String(e.message).slice(0, 600),
    location: e.stack?.split('\n').find(line=>line.includes('.mjs:'))?.trim() ?? null };
} finally {
  for (const c of clients) { try { await c.end(); } catch { /* cleanup continues */ } }
  if (reservation) await closeServer(reservation);
  try {
    // A failed start may still have produced a server: inspect only our new dir.
    try { await access(path.join(data, 'postmaster.pid')); started = true; } catch { /* no pid file */ }
    if (started) {
      await proveIdentity();
      control(['-D', data, '-m', 'fast', '-w', '-t', '20', 'stop']);
      assert.equal(processInfo(identity.pid), null);
      const free = net.createServer();
      await new Promise((resolve, reject) => { free.once('error', reject); free.listen({ host: '127.0.0.1', port, exclusive: true }, resolve); });
      await closeServer(free);
      report.cleanup = { stopped: true, shutdown: 'pg_ctl fast/wait 20s; no immediate kill',
        exactPidAbsent: true, exactPortReboundAndReleased: true, retainedStoppedCheckpoint: phase };
    }
  } catch (e) { report.cleanup.error = String(e.message).slice(0, 300); failure ??= e; }
  try { await unlink(passwordFile); } catch { /* already removed */ }
  if (report.cleanup.stopped) { assert.ok(phase.startsWith(path.join(root, 'tests/fixtures/n122-1019', 'n122-native-pg-'))); await rm(phase, { recursive: true }); report.cleanup.ownedDirectoryRemoved=true; }
  if(leaseOwned) report.cleanup.lease=lease('release').trim();
  report.finishedAt = new Date().toISOString();
  report.status = failure ? 'FAIL' : 'PASS';
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure,
  cleanup: report.cleanup, reportPath }, null, 2));
if (failure) process.exitCode = 1;
