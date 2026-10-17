/** Explicitly invoked, synthetic-only native PG17 qualification. Never auto-started. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { qualify, inactiveBindings } from './fixtures/n88-native-postgres-qualification/cases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(path.resolve(process.cwd()), root, 'run from task worktree');
const runId = 'f114bf86-e397-4064-9ca8-44e6b8384cc4';
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
const phase = path.join(root, 'artifacts', `n88-native-pg-${runId}-${randomUUID()}`);
assert.ok(phase.startsWith(path.join(root, 'artifacts', `n88-native-pg-${runId}-`)));
const data = path.join(phase, 'data');
await mkdir(phase, { recursive: false }); // New ownership boundary, never reuse data.
const marker = { runId, token: randomUUID(), runnerPid: process.pid, phase, data };
await writeFile(path.join(phase, 'owner.json'), JSON.stringify(marker), { flag: 'wx' });
const reportPath = path.join(root, 'tests/n88-native-postgres-qualification.result.json');
const report = { taskId: 'continuous-n88-native-postgres-qualification-20261017', runId,
  baseSha: 'cced9c6f4b6db4ed0de4a63ba3dcc30359407767',
  sourceHead: command('git', ['rev-parse', 'HEAD']).trim(), startedAt: new Date().toISOString(),
  initialTaskOriginMain: 'cced9c6f4b6db4ed0de4a63ba3dcc30359407767',
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
  assert.ok(new RegExp(`-D\\s+"?${data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?(?:\\s|$)`, 'i').test(info.commandLine.replaceAll('/', '\\')));
  if (identity) { assert.equal(info.pid, identity.pid); assert.equal(info.birth, identity.birth); }
  else {
    assert.ok(Math.abs(Date.parse(info.birth) - Number(pidLines[2]) * 1000) < 3000);
    identity = info;
    report.ownership = { pid: info.pid, birth: info.birth, data, port, pidFileDirectoryMatches: true,
      executableMatches: true, commandLineDirectoryMatches: true };
    report.ownershipEpochs ??= []; report.ownershipEpochs.push(report.ownership);
  }
}
async function connect() {
  await proveIdentity(); // No DB connection before PID/birth/directory proof.
  const c = new Client({ host: '127.0.0.1', port, user: 'n88_local_admin', password,
    database: 'postgres', ssl: false, connectionTimeoutMillis: 4000,
    statement_timeout: 6000, lock_timeout: 3000, query_timeout: 8000,
    application_name: `n88-owned-${runId}`, options: '-c search_path=pg_catalog' });
  clients.add(c); await c.connect();
  const proof = (await c.query(`select current_setting('data_directory') as dir,
    host(inet_server_addr()) as host, inet_server_port() as port, version() as version`)).rows[0];
  assert.equal(path.resolve(proof.dir), data); assert.equal(proof.host, '127.0.0.1'); assert.equal(proof.port, port);
  assert.match(proof.version, /^PostgreSQL 17\.6 /);
  report.serverVersion = proof.version;
  return c;
}
let failure;
try {
  const bindings = await inactiveBindings({ root, report });
  report.checks.push({ name:'inactive_source_bindings_and_reused_final_pin_term_evidence',status:'PASS',evidence:bindings });
  report.executedSourceSha256 = {};
  for (const file of ['drafts/n88-student-portal/schema-proposal.sql',
    'tests/n88-native-postgres-qualification.mjs','tests/fixtures/n88-native-postgres-qualification/cases.mjs',
    'tests/fixtures/n88-native-postgres-qualification/protocol.mjs','tests/fixtures/n88-native-postgres-qualification/read-scope.sql',
    'tests/fixtures/n88-native-postgres-qualification/create-session.sql']) {
    report.executedSourceSha256[file] = createHash('sha256').update((await readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n')).digest('hex');
  }
  reservation = await bind(); port = reservation.address().port; report.port = port;
  await writeFile(passwordFile, password, { flag: 'wx' });
  command(path.join(bin, 'initdb.exe'), ['-D', data, '-U', 'n88_local_admin', '--pwfile', passwordFile,
    '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', '--no-instructions']);
  await unlink(passwordFile);
  await writeFile(path.join(data, 'postgresql.auto.conf'), `listen_addresses = '127.0.0.1'\nport = ${port}\nshared_buffers = '16MB'\nmax_connections = 12\nwork_mem = '1MB'\nmaintenance_work_mem = '16MB'\nstatement_timeout = '6s'\nlock_timeout = '3s'\nidle_in_transaction_session_timeout = '20s'\nlog_statement = 'none'\nlog_min_error_statement = 'panic'\nlog_error_verbosity = 'terse'\nlog_parameter_max_length = 0\nlog_parameter_max_length_on_error = 0\nlog_connections = off\nlog_disconnections = off\nmax_wal_size = '64MB'\nmin_wal_size = '32MB'\nfsync = on\nsynchronous_commit = on\nfull_page_writes = on\n`);
  await closeServer(reservation); reservation = null;
  control(['-D', data, '-l', path.join(phase, 'server.log'), '-w', '-t', '20', 'start']);
  started = true;
  const a = await connect(), b = await connect();
  report.connections = [(await a.query('select pg_backend_pid() as pid')).rows[0].pid,
    (await b.query('select pg_backend_pid() as pid')).rows[0].pid];
  assert.notEqual(...report.connections);
  const sql = await readFile(path.join(root, 'drafts/n88-student-portal/schema-proposal.sql'), 'utf8');
  report.schemaSha256 = createHash('sha256').update(sql).digest('hex');
  const verifyRestart = await qualify({ a, b, sql, report, root });
  for (const c of clients) await c.end();
  clients.clear();
  await proveIdentity();
  control(['-D',data,'-m','fast','-w','-t','20','stop']);
  assert.equal(processInfo(identity.pid),null);
  report.controlledRestart = { priorPid:identity.pid,priorBirth:identity.birth,priorPidAbsent:true };
  const restartFree = net.createServer();
  await new Promise((resolve,reject)=>{restartFree.once('error',reject);restartFree.listen({host:'127.0.0.1',port,exclusive:true},resolve);});
  await closeServer(restartFree);
  report.controlledRestart.portFreeBeforeRestart = true;
  started = false; identity = undefined;
  control(['-D',data,'-l',path.join(phase,'server.log'),'-w','-t','20','start']);
  started = true;
  const restarted = await connect();
  report.controlledRestart.newPid = identity.pid;
  report.controlledRestart.newBirth = identity.birth;
  const persistence = await verifyRestart(restarted);
  report.checks.push({name:'controlled_clean_restart_persists_credentials_budgets_and_revocations',status:'PASS',evidence:persistence});
} catch (e) {
  failure = e;
  // Do not print PostgreSQL DETAIL, bind values, credentials or arbitrary errors.
  report.failure = { name: e.name, code: e.code ?? null,
    message: /^[0-9A-Z]{5}$/.test(e.code ?? '') ? 'SQL operation failed; see named check and SQLSTATE' :
      e.name === 'AssertionError' ? 'Qualification assertion failed; see named check and location (values redacted)' : 'Harness operation failed (details redacted)',
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
  report.finishedAt = new Date().toISOString();
  if (!failure) assert.equal(report.cleanup.stopped,true);
  report.status = failure ? 'FAIL' : 'PASS';
  report.checks.push({name:'owned_cluster_final_cleanup',status:report.cleanup.stopped?'PASS':'FAIL',evidence:report.cleanup});
  const groups = [
    ['n88_actual_owned_postgres_schema_constraints_private_grants_and_cleanup',[
      'actual_draft_transaction_rollback_catalog_pk_fk_unique_checks_indexes_rls',
      'actual_crossbinding_and_code_entry_session_uniqueness_constraints',
      'private_public_only_anon_authenticated_nobypass_roles_denied_without_grants','owned_cluster_final_cleanup']],
    ['n88_real_two_connection_code_uniqueness_budget_atomicity_and_term_session_protocol',[
      'two_real_backends_unique_reservation_wait_commit_23505_and_loser_rollback',
      'actual_sql_budget_sorted_locks_db_clock_mixed_attempts_failures_commit_limits',
      'stable_credential_second_term_exact_session_scope_and_fail_closed_protocol',
      'atomic_rotation_revoke_all_term_sessions_rollback_and_concurrent_login_revoke']],
    ['n88_inactive_source_honest_sql_adapter_limits_and_unchanged_final_pin_proof',[
      'inactive_source_bindings_and_reused_final_pin_term_evidence']]
  ];
  report.requiredChecks = groups.map(([name,dependencies])=>{
    const states=dependencies.map(d=>report.checks.find(c=>c.name===d)?.status);
    return {name,status:states.includes('FAIL')?'FAIL':states.every(s=>s==='PASS')?'PASS':'NOT_RUN',dependencies};
  });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure,
  cleanup: report.cleanup, reportPath }, null, 2));
if (failure) process.exitCode = 1;
