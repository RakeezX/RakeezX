/** Explicitly invoked, synthetic-only native PG17 qualification. Never auto-started. */
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { qualify } from './fixtures/n88-postgres-service-repository/cases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(path.resolve(process.cwd()), root, 'run from task worktree');
const runId = 'd80c7450-1db7-4c65-8945-1007808c042b';
const bin = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin';
const clientPath = 'C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg';
const { Client, Pool } = createRequire(import.meta.url)(clientPath);
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
const processInfoAsync = async pid => {
  const { stdout } = await promisify(execFile)('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    ['-NoProfile','-NonInteractive','-Command',`$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(pid)}'; if ($p) { @{ pid=$p.ProcessId; birth=$p.CreationDate.ToUniversalTime().ToString('o'); executable=$p.ExecutablePath; commandLine=$p.CommandLine } | ConvertTo-Json -Compress } else { 'null' }`],
    {encoding:'utf8',windowsHide:true,timeout:10000,env:childEnv,maxBuffer:1024*1024});
  return JSON.parse(stdout);
};
const phase = path.join(root, 'artifacts', `n88-repository-pg-${runId}-${randomUUID()}`);
assert.ok(phase.startsWith(path.join(root, 'artifacts', `n88-repository-pg-${runId}-`)));
const data = path.join(phase, 'data');
await mkdir(phase, { recursive: false }); // New ownership boundary, never reuse data.
const marker = { runId, token: randomUUID(), runnerPid: process.pid, phase, data };
await writeFile(path.join(phase, 'owner.json'), JSON.stringify(marker), { flag: 'wx' });
const reportPath = path.join(root, 'tests/n88-postgres-service-repository.result.json');
const report = { taskId: 'continuous-n88-postgres-service-repository-20261017', runId,
  baseSha: '98d8e7ab2905a2786461745af970f0b8f4fb9288', sourceHead:command('git', ['rev-parse', 'HEAD']).trim(), startedAt: new Date().toISOString(),
  version: command(path.join(bin, 'pg_ctl.exe'), ['--version']).trim(),
  phase, data, checks: [], negativeSqlstates: [], cleanup: { stopped: false } };
const password = randomBytes(32).toString('hex'); // Only this disposable cluster.
const passwordFile = path.join(phase, 'password.tmp');
const clients = new Set();
const pools = new Set();
let leaseOwned=false;
const leaseArgs=action=>['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1',
  '-Name','integration','-Action',action,'-TaskFile','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n88-postgres-service-repository-20261017.json',
  '-RuntimeRoot','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId];
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
  const info = await processInfoAsync(Number(pidLines[0]));
  assert.ok(info && info.executable.toLowerCase() === path.join(bin, 'postgres.exe').toLowerCase().replaceAll('/', '\\'));
  const normalizedCommand = info.commandLine.replaceAll('/', '\\');
  const escapedDirectory=data.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  assert.ok(new RegExp(`-D\\s+"?${escapedDirectory}"?(?:\\s|$)`,'i').test(normalizedCommand));
  if (identity) {assert.equal(info.pid,identity.pid);assert.equal(info.birth, identity.birth);}
  else {
    assert.ok(Math.abs(Date.parse(info.birth) - Number(pidLines[2]) * 1000) < 3000);
    identity = info;
    report.ownership = { pid: info.pid, birth: info.birth, data, port, pidFileDirectoryMatches: true,
      executableMatches: true, commandLineDirectoryMatches: true };
    (report.ownershipHistory ??= []).push(report.ownership);
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
  report.serverVersion = proof.version;
  return c;
}
let failure;
try {
  try {
    report.integrationLeaseAcquire=command('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',leaseArgs('acquire')).trim();
    report.checks.push({name:'integration_lease_prerequisite',status:'PASS',evidence:report.integrationLeaseAcquire});
  } catch(e) {
    const policyDenied=String(e.stderr??'').includes('running scripts is disabled');
    report.checks.push({name:'integration_lease_prerequisite',status:'FAIL',evidence:policyDenied?
      'Windows PowerShell refused resource-lease.ps1: running scripts is disabled on this system; SecurityError / UnauthorizedAccess. No policy change, alternative host, or retry attempted.':
      'Lease acquisition failed (details redacted). No alternative acquisition path attempted.'});
    throw e;
  }
  assert.match(report.integrationLeaseAcquire,/^(ACQUIRED|ALREADY OWNED) integration$/);leaseOwned=true;
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
  const config = {host:'127.0.0.1',port,user:'n88_local_admin',password,database:'postgres',ssl:false,
    connectionTimeoutMillis:4000,statement_timeout:6000,lock_timeout:3000,query_timeout:8000,
    application_name:'n88-repository-fixture',options:'-c search_path=pg_catalog',max:2};
  let poolNumber=0;
  const pool = () => {
    const name=`n88-repository-fixture-${++poolNumber}`;
    const p=new Pool({...config,application_name:name}), originalConnect=p.connect.bind(p);
    p.fixtureName=name;
    const proven=new WeakSet();
    p.connect=async()=>{
      const c=await originalConnect();
      try {
        // New physical connections only; verification never blocks the event loop
        // or pretends that pg's client queue is a database lock observation.
        if(!proven.has(c)) await proveIdentity();
        const proof=(await c.query("select current_setting('data_directory') as dir, host(inet_server_addr()) as host, inet_server_port() as port")).rows[0];
        assert.equal(path.resolve(proof.dir),data);assert.equal(proof.host,'127.0.0.1');assert.equal(proof.port,port);
        proven.add(c);
      } catch(e) {c.release(e);throw e;}
      return c;
    };
    pools.add(p); return p;
  };
  const supplement=await readFile(path.join(root,'drafts/n88-student-portal/postgres-repository-schema.sql'),'utf8');
  const verifyRestart=await qualify({a,b,sql,supplement,report,root,pool});
  for(const p of pools) await p.end(); pools.clear();
  for(const c of clients) await c.end(); clients.clear();
  await proveIdentity();
  const previousIdentity=identity;
  control(['-D',data,'-m','fast','-w','-t','20','stop']); started=false;
  assert.equal(processInfo(previousIdentity.pid),null);
  report.restart={stoppedPid:previousIdentity.pid,stoppedBirth:previousIdentity.birth,controlledFastShutdown:true};
  identity=undefined;
  control(['-D',data,'-l',path.join(phase,'server.log'),'-w','-t','20','start']); started=true;
  const fresh=await connect();
  report.restart.newPid=identity.pid; report.restart.newBirth=identity.birth;
  await verifyRestart(pool());
} catch (e) {
  failure = e;
  // Do not print PostgreSQL DETAIL, bind values, credentials or arbitrary errors.
  report.failure = { name: e.name, code: e.code ?? null,
    message: /^[0-9A-Z]{5}$/.test(e.code ?? '') ? 'SQL operation failed; see named check and SQLSTATE' : e.name === 'AssertionError' ? 'Assertion failed (values redacted)' : 'Harness/repository operation failed (details redacted)',
    location: e.stack?.split('\n').find(line=>line.includes('.mjs:'))?.trim() ?? null };
} finally {
  for (const p of pools) { try { await p.end(); } catch {} }
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
  } catch (e) { report.cleanup.error = 'Owned cleanup failed (details redacted)'; failure ??= e; }
  if(!port) report.cleanup={stopped:false,notStarted:true,noServerOrSqlConnectionsOpened:true,retainedOwnershipMarker:phase};
  try { await unlink(passwordFile); } catch { /* already removed */ }
  report.sourceHashes={};
  for(const file of ['drafts/n88-student-portal/postgres-repository.mjs','drafts/n88-student-portal/postgres-repository-schema.sql',
    'tests/n88-postgres-service-repository.mjs','tests/fixtures/n88-postgres-service-repository/cases.mjs']) {
    report.sourceHashes[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
  }
  if(leaseOwned) {
    try { report.integrationLeaseRelease=command('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',leaseArgs('release')).trim();
      assert.match(report.integrationLeaseRelease,/^RELEASED integration$/);
    } catch(e) {failure??=e;report.integrationLeaseRelease='FAILED';}
  }
  report.checks.push({name:'owned_cleanup_and_inactive_limits',status:(report.cleanup.stopped&&report.integrationLeaseRelease==='RELEASED integration')||(!leaseOwned&&report.cleanup.notStarted)?'PASS':'FAIL',
    evidence:{...report.cleanup,integrationLeaseReleased:report.integrationLeaseRelease==='RELEASED integration',
      noBrowserOrAppChanges:true,hostedAuth:'NOT_RUN',canonicalMembershipResolver:'NOT_RUN',ingress:'NOT_RUN',hosting:'NOT_RUN',keyCustody:'NOT_RUN',studentAccess:'NOT_RUN'}});
  const groups=[
    ['n88_real_postgres_repository_runs_actual_portal_issue_claim_read_publish_revoke',[
      'actual_service_issue_claim_read_publish_rotate_revoke_and_projection']],
    ['n88_two_service_sql_budget_serialization_term_identity_rollback_and_restart',[
      'two_independent_pools_actual_advisory_wait_collision_and_unique_credentials',
      'actual_global_source_context_failure_debits_and_mixed_concurrent_limits',
      'actual_owner_entry_namespace_session_version_and_membership_guards',
      'actual_term_transition_and_login_rotate_revoke_serialization',
      'async_callback_deadline_detachment_acquisition_flush_rollback_commit_faults',
      'new_pool_service_after_controlled_stop_restart_persistence']],
    ['n88_owned_cleanup_bounded_inactive_port_honest_hosted_auth_and_privacy_limits',[
      'bounded_snapshot_strict_mapping_retention_and_inactive_bindings','owned_cleanup_and_inactive_limits']]
  ];
  report.requiredChecks=groups.map(([name,dependencies])=>{
    const states=dependencies.map(n=>report.checks.find(c=>c.name===n)?.status);
    return{name,status:states.includes('FAIL')?'FAIL':states.every(s=>s==='PASS')?'PASS':'NOT_RUN',dependencies};
  });
  report.finishedAt = new Date().toISOString();
  if(report.requiredChecks.some(c=>c.status!=='PASS')) failure??=new Error('required_check_incomplete');
  report.status = failure ? 'FAIL' : 'PASS';
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure,
  cleanup: report.cleanup, reportPath }, null, 2));
if (failure) process.exitCode = 1;
