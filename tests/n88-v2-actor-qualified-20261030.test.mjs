/** AI: explicit, local-only native PG qualification. No default DSN or live installer.
 * Reuses installed tools only; creates a NEW SCRAM-authenticated loopback cluster.
 * Run from this worktree: node tests/n88-v2-actor-qualified-20261030.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { CANONICAL_PROJECTION_REQUIREMENTS } from '../drafts/n88-student-portal/student-projection.mjs';


import { evaluateActorCapabilities, requiredHelpers } from '../drafts/n88-student-portal/activation/v2-actor-qualified-20261030/actor-capabilities.mjs';
import { identitySql, baselineInventorySql } from '../drafts/n88-student-portal/activation/v2-external-plan-1028/preflight.mjs';
import { publicationV2FunctionReadback } from '../drafts/n88-student-portal/publication-v2-host.inactive.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(path.resolve(process.cwd()), root);
const taskId = 'continuous-n88-actor-qualified-installer-20261030', runId = '7563b16d-ddf9-4d85-b310-f13767ade597';
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
const report = { taskId, runId, baseSha: git(['rev-parse', 'HEAD']), startedAt: new Date().toISOString(), phase,
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
async function connect(label = 'fixture', user = 'supabase_admin') {
  assert(started && identity); // Identity is proved before the first connection.
  const c = new Client({ host: '127.0.0.1', port, user, password, database: 'postgres', ssl: false,
    connectionTimeoutMillis: 4000, statement_timeout: 8000, lock_timeout: 6000, query_timeout: 10000,
    application_name: `n88-local-${label}`, options: '-c search_path=pg_catalog' });
  c.on('error', () => {}); clients.add(c); await c.connect();
  const r = (await c.query("select host(inet_server_addr()) as host,inet_server_port() as port,version() as version")).rows[0];
  if (user === 'supabase_admin') assert.equal(normalize((await c.query("select current_setting('data_directory') as dir")).rows[0].dir),normalize(data));
  assert.equal(r.host, '127.0.0.1'); assert.equal(r.port, port);
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
  report.leaseAcquire = lease('acquire').trim(); leased = true;
  reservation = await freePort(); port = reservation.address().port; report.port = port;
  await writeFile(passwordFile, password + '\n', { flag: 'wx' });
  command(path.join(bin, 'initdb.exe'), ['-D', data, '--encoding=UTF8', '--locale=C', '--username=supabase_admin', '--auth=scram-sha-256', '--pwfile=' + passwordFile]);
  await unlink(passwordFile);
  await writeFile(path.join(data, 'pg_hba.conf'), 'host all all 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n');
  await writeFile(path.join(data, 'postgresql.auto.conf'), `listen_addresses='127.0.0.1'\nport=${port}\nmax_connections=20\nshared_buffers='16MB'\nlog_statement='none'\nlog_min_error_statement='panic'\n`);
  await close(reservation); reservation = null;
  control(['-D', data, '-l', path.join(phase, 'server.log'), '-w', '-t', '20', 'start']); started = true; await proveIdentity();
  const admin = await connect('observer');
  report.localConfig = (await admin.query("select current_setting('listen_addresses') as listen, current_setting('port') as port, current_setting('password_encryption') as password_encryption")).rows[0];
  assert.equal(report.localConfig.listen, '127.0.0.1'); assert.equal(report.localConfig.password_encryption, 'scram-sha-256');
  report.hba = (await admin.query('select type,address,auth_method,error from pg_hba_file_rules order by rule_number')).rows;
  assert(report.hba.every(r => r.error === null)); assert.equal(report.hba[0].auth_method, 'scram-sha-256');
  await qualify({ root, admin, connect, report, phase, marker });
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
  console.log(JSON.stringify({ status: report.status, reportPath: path.join(phase, 'report.json'), checks: report.checks, cleanup: report.cleanup, failure: report.failure }));
}
if (failure) process.exitCode = 1;


async function qualify({root,admin,connect,report}) {
 const source=async file=>{const b=await readFile(path.join(root,file));report.sourceSha256[file]=hash(b);return b.toString('utf8').replace(/^\uFEFF/,'');};
 const sourceHash=b=>hash(b.toString('utf8').replaceAll('\r\n','\n'));
 const candidateDir='drafts/n88-student-portal/activation/v2-actor-qualified-20261030';
 const candidateManifest=JSON.parse(await source(candidateDir+'/manifest.json'));
 assert.equal(candidateManifest.execute,false);assert.equal(candidateManifest.target,null);assert.equal(candidateManifest.installationAuthority,null);
 for(const [file,expected] of Object.entries(candidateManifest.originalSources)) assert.equal(sourceHash(await readFile(path.join(root,file))),expected,file);
 assert.equal(sourceHash(await readFile(path.join(root,candidateDir,'actor-capabilities.mjs'))),candidateManifest.evaluatorSha256);
  // Exact core table definitions, keys, foreign keys and checks, not JSON snapshots.
  await admin.query(`create schema auth;
    create table auth.users(id uuid primary key,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create role anon nologin; create role authenticated nologin; create role n88_backend nologin;`);
  await admin.query(await source('supabase/migrations/0001_core_schema.sql'));
  const foundation = await source('supabase/migrations/0033_score_subitem_foundation.sql');
  await admin.query(foundation.slice(0, foundation.indexOf('alter table rakeezx.score_subitems enable row level security;')) + '\ncommit;');
  const section = await source('supabase/migrations/0021_section_archive_lifecycle.sql');
  await admin.query(section.slice(0, section.indexOf('-- Preserve the complete existing map')) + '\ncommit;');
  const n94 = await source('supabase/migrations/20261012234116_n94_subitem_dates_late_scoring.sql');
  await admin.query(n94.slice(0, n94.indexOf('CREATE OR REPLACE FUNCTION')));
  // Same additive metadata declarations as 0012; no Sync RPC/trigger installation.
  await source('supabase/migrations/0012_sync_v2_server_protocol.sql');
  const names = CANONICAL_PROJECTION_REQUIREMENTS.tables.map(t => t.replace(/[A-Z]/g, c => '_' + c.toLowerCase()));
  for (const t of names) await admin.query(`alter table rakeezx.${t} add column if not exists revision bigint not null default 1 check(revision>=1),add column if not exists field_revisions jsonb not null default '{}'::jsonb check(jsonb_typeof(field_revisions)='object')`);
  const originalSchema = await source('drafts/n88-student-portal/schema-proposal.sql');
  await admin.query('create schema n88_private; revoke all on schema n88_private from public;');
  await admin.query(originalSchema.match(/create table n88_private\.contexts \([\s\S]*?\n\);/)[0]);
  await admin.query(await source('drafts/n88-student-portal/canonical-lock.inactive.sql'));
  await admin.query(await source('drafts/n88-student-portal/auth-session.inactive.sql'));
  const integrated = await source('drafts/n88-student-portal/integrated-schema.inactive.sql');
  await admin.query(integrated.slice(0, integrated.indexOf('create table n88_private.class_credential_receipts')));
  const lockStart = integrated.indexOf('create function n88_private.lock_projection_sources');
  await admin.query(integrated.slice(lockStart, integrated.indexOf('revoke all on function n88_private.lock_projection_sources', lockStart)));
  await admin.query(await source('drafts/n88-student-portal/six-digit-schema.inactive.sql'));

  // Bootstrap ONLY disposable topology. Installation uses a separate login and
  // connection, never SET ROLE from a superuser installer.
  await admin.query(`create role postgres login nosuperuser createrole bypassrls inherit password '${password}';
    create role n88_guard nologin noinherit nosuperuser nocreaterole nobypassrls;
    set role supabase_admin;
    grant n88_guard to postgres with admin true, inherit false, set false;
    set role postgres;
    grant n88_guard to postgres with admin false, inherit false, set false;
    reset role;
    alter role postgres set createrole_self_grant='';`);
  const objects = (await admin.query(`select n.nspname,c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('n88_private','rakeezx','auth') and c.relkind in ('r','p','S','v')`)).rows;
  const ident = s => '"' + s.replaceAll('"','""') + '"';
  for (const o of objects) await admin.query(`alter ${o.relkind==='S'?'sequence':o.relkind==='v'?'view':'table'} ${ident(o.nspname)}.${ident(o.relname)} owner to postgres`);
  for (const schema of ['n88_private','rakeezx','auth']) await admin.query(`alter schema ${schema} owner to postgres`);
  await admin.query('alter database postgres owner to postgres');
  const functions = (await admin.query(`select p.oid::regprocedure::text as identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('n88_private','auth')`)).rows;
  for (const f of functions) await admin.query(`alter function ${f.identity} owner to ${/lock_(canonical|projection)_sources/.test(f.identity)?'n88_guard':'postgres'}`);
  await admin.query('grant execute on function pg_catalog.pg_control_system() to postgres');
  const actor = await connect('installer','postgres');
  const oldEdges=(await actor.query("select grantor::regrole::text as grantor,admin_option,inherit_option,set_option from pg_auth_members where roleid='n88_guard'::regrole and member='postgres'::regrole order by grantor::regrole::text")).rows;
  assert.deepEqual(oldEdges,[{grantor:'postgres',admin_option:false,inherit_option:false,set_option:false},{grantor:'supabase_admin',admin_option:true,inherit_option:false,set_option:false}]);
  report.oldGuardEdges=oldEdges;
  const actorProfile = (await actor.query(`select current_user,session_user,rolsuper,rolcreaterole,rolbypassrls,rolinherit,current_setting('createrole_self_grant') as self_grant from pg_roles where rolname=current_user`)).rows[0];
  assert.deepEqual(actorProfile,{current_user:'postgres',session_user:'postgres',rolsuper:false,rolcreaterole:true,rolbypassrls:true,rolinherit:true,self_grant:''});
  report.actorProfile=actorProfile;
  const fingerprint = async () => (await admin.query(`select jsonb_build_object(
    'roles',(select jsonb_agg(to_jsonb(r) order by rolname) from pg_roles r where rolname in ('n88_guard','n88_backend')),
    'edges',(select jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor) from pg_auth_members m where roleid in ('n88_guard'::regrole,'n88_backend'::regrole) or member in ('n88_guard'::regrole,'n88_backend'::regrole)),
    'helpers',(select jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl::text,'body',pg_get_functiondef(p.oid)) order by p.oid) from pg_proc p where p.oid in ('n88_private.lock_current_session(uuid,uuid)'::regprocedure,'n88_private.lock_canonical_sources(uuid,integer)'::regprocedure,'n88_private.lock_projection_sources(uuid,integer)'::regprocedure))) as value`)).rows[0].value;
  const metadata = async () => ({version:1,
    target:{physicalIdentityMatched:true,baselineMatched:true,privateNotExposed:true,originalSchemaMatched:true,noV2Collisions:true},
    actor:{name:'postgres',sessionMatches:true,superuser:false,createRole:true,bypassRls:true,inherit:true,createroleSelfGrant:''},
    schema:{databaseCreate:true,privateUsageGrant:true,privateCreateGrant:true,canonicalUsageGrant:true,allAffectedRelationsOwned:true,allRequiredTableColumnGrants:true},
    newRoles:{guardAbsent:true,runtimeAbsent:!(await actor.query("select to_regrole('n88_v2_runtime') as r")).rows[0].r,runtimeMinimalPrerequisite:!!(await actor.query("select to_regrole('n88_v2_runtime') as r")).rows[0].r},
    helpers:await Promise.all(requiredHelpers.map(async identity=>(await actor.query(`select $1::text as identity,true as exists,pg_get_userbyid(p.proowner) as owner,
      has_function_privilege(current_user,p.oid,'EXECUTE') as "actorExecute",has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION') as "actorGrantOption",
      pg_has_role(current_user,p.proowner,'USAGE') as "actorOwnerUsage",pg_has_role(current_user,p.proowner,'SET') as "actorSetOwner",
      case when to_regrole('n88_v2_runtime') is null then false else has_function_privilege('n88_v2_runtime',p.oid,'EXECUTE') end as "runtimeExecute"
      from pg_proc p where p.oid=to_regprocedure($1)`,[identity])).rows[0]))});
  const sql=await source('drafts/n88-student-portal/activation/v2-actor-qualified-20261030/installer.inactive.sql');
  assert.equal(sourceHash(sql),candidateManifest.installerSha256);
  assert.equal(hash(sql.slice(sql.indexOf('-- BEGIN QUALIFIED DERIVATIVE'),sql.indexOf('-- END QUALIFIED DERIVATIVE'))),candidateManifest.qualifiedDeltaSha256);
  const before=await fingerprint(), recorded=await metadata();
  const actual=evaluateActorCapabilities(recorded);
  assert.equal(actual.state,'BLOCKED');
  assert.deepEqual(actual.blocked.filter(b=>b.stage==='existing_helper' && b.requirement==='missing_grant_authority_and_pregranted_runtime_EXECUTE').map(b=>b.functionIdentity),requiredHelpers.slice(1));
  report.actualCapabilityResult=actual;
  // Catch incomplete and contradictory evidence; identity never implies ability.
  assert.equal(evaluateActorCapabilities().state,'BLOCKED');
  for (const key of Object.keys(recorded.target)) {const v=structuredClone(recorded);delete v.target[key];assert.equal(evaluateActorCapabilities(v).state,'BLOCKED');}
  for (const key of Object.keys(recorded.schema)) {const v=structuredClone(recorded);delete v.schema[key];assert.equal(evaluateActorCapabilities(v).state,'BLOCKED');}
  const missing=structuredClone(recorded);missing.helpers.pop();assert.equal(evaluateActorCapabilities(missing).state,'BLOCKED');
  await assert.rejects(actor.query(sql),e=>{
    report.expectedNegativeDenial={code:e.code,message:e.message};
    return e.code==='42501' && e.message.includes('lock_canonical_sources(uuid,integer):no grant authority') && e.message.includes('lock_projection_sources(uuid,integer):no grant authority');
  });
  await actor.query('rollback');
  assert.deepEqual(await fingerprint(),before);
  assert.equal((await actor.query("select count(*)::integer as n from pg_roles where rolname in ('n88_v2_guard','n88_v2_runtime')")).rows[0].n,0);
  assert.equal((await actor.query("select count(*)::integer as n from pg_proc where pronamespace='n88_private'::regnamespace and (proname like 'publication_v2_%' or proname like 'v2_%')")).rows[0].n,0);
  assert.equal((await actor.query("select count(*)::integer as n from pg_class where relnamespace='n88_private'::regnamespace and relname like 'publication_v2_%'")).rows[0].n,0);
  report.checks.push({name:'n88_actual_actor_capability_rejects_before_ddl',status:'PASS',evidence:'Native PG17 separate NOSUPERUSER login; SQLSTATE42501 before V2 DDL; rollback, zero V2 objects/roles; identical legacy role/membership/helper ACL+body fingerprint; evaluator names both denied old helpers.'});

  // Explicit SYNTHETIC owner-supplied prerequisite, unavailable in real project.
  // Not part of candidate SQL. Fingerprint AFTER provisioning, BEFORE install.
  await admin.query(`create role n88_v2_runtime nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
    grant execute on function n88_private.lock_current_session(uuid,uuid),n88_private.lock_canonical_sources(uuid,integer),n88_private.lock_projection_sources(uuid,integer) to n88_v2_runtime;`);
  const supplied=await fingerprint(), positive=await metadata();
  assert.equal(evaluateActorCapabilities(positive).state,'QUALIFIED_INACTIVE_PLAN');
  await assert.rejects(actor.query(sql),e=>e.message==='n88_external_target_and_authority_unbound');
  await actor.query('rollback');assert.deepEqual(await fingerprint(),supplied);
  await admin.query('grant create on schema n88_private to n88_v2_runtime');
  await assert.rejects(actor.query(sql),e=>e.message==='n88_actor_runtime_prerequisite_not_minimal');
  await actor.query('rollback');
  await admin.query('revoke create on schema n88_private from n88_v2_runtime');
  assert.deepEqual(await fingerprint(),supplied);
  for (const h of positive.helpers) {
    const v=structuredClone(positive);delete v.helpers.find(x=>x.identity===h.identity).actorGrantOption;
    assert.equal(evaluateActorCapabilities(v).state,'BLOCKED');
  }
  // Bind ONLY the disposable cluster in memory. Published SQL remains null/null.
  const observed=(await actor.query(identitySql)).rows[0];
  const target={projectRef:'xlrubcwjqktzzunrvuns',databaseName:observed.database_name,databaseOid:observed.database_oid,
    systemIdentifier:observed.system_identifier,serverAddress:observed.server_address,serverPort:String(observed.server_port),
    serverVersionNum:observed.server_version_num,installerSessionRole:'postgres',installerCurrentRole:'postgres',
    baselineInventorySha256:(await actor.query(baselineInventorySql)).rows[0].sha256,nonExposureReadbackSha256:'a'.repeat(64)};
  const jsonDigest=async v=>(await actor.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as h",[JSON.stringify(v)])).rows[0].h;
  const authority={productId:'N88',action:'install-actor-qualified-inactive-candidate',targetSha256:await jsonDigest(target),
    deltaSha256:candidateManifest.qualifiedDeltaSha256,ref:'DISPOSABLE-SYNTHETIC-ONLY',expiresAt:new Date(Date.now()+60000).toISOString()};
  await actor.query("select set_config('n88.external_authority_ref',$1,false),set_config('n88.external_authority_sha256',$2,false),set_config('n88.external_nonexposure_sha256',$3,false)",[authority.ref,await jsonDigest(authority),target.nonExposureReadbackSha256]);
  const literal=v=>JSON.stringify(v).replaceAll("'","''");
  const bound=sql.replace("expected_target jsonb := 'null'::jsonb;",`expected_target jsonb := '${literal(target)}'::jsonb;`)
    .replace("expected_authority jsonb := 'null'::jsonb;",`expected_authority jsonb := '${literal(authority)}'::jsonb;`);
  try { await actor.query(bound); }
  catch(e) { report.installerFailure={code:e.code,routine:e.routine,position:e.position,
    message:e.message.replaceAll(password,'[REDACTED]')};throw e; }
  assert.deepEqual(await fingerprint(),supplied); // No old ACL/owner/body/member change.
  const operations=JSON.parse(await source('drafts/n88-student-portal/activation/v2-package-1028/boundary-operations.json')).operations;
  const readback=(await actor.query(publicationV2FunctionReadback,[operations.map(o=>o.name)])).rows;
  const originalManifest=JSON.parse(await source('drafts/n88-student-portal/activation/v2-package-1028/manifest.json'));
  assert.deepEqual(readback,originalManifest.functions);
  assert.equal(readback.length,14);
  const creatorEdges=(await actor.query("select roleid::regrole::text as role,member::regrole::text as member,grantor::regrole::text as grantor,admin_option,inherit_option,set_option from pg_auth_members where roleid in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole) or member in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole)")).rows;
  assert.deepEqual(creatorEdges,[{role:'n88_v2_guard',member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:false,set_option:false}]);
  report.creatorEdges=creatorEdges;
  assert.equal((await actor.query("select pg_has_role(current_user,'n88_v2_guard','SET') as s,pg_has_role(current_user,'n88_v2_guard','USAGE') as u")).rows[0].s,false);
  report.functions=readback;
  report.checks.push({name:'n88_native_managed_role_new_owner_setup',status:'PASS',evidence:'Installer executed as separate NOSUPERUSER CREATEROLE BYPASSRLS postgres login, empty createrole_self_grant. Synthetic pregranted minimal runtime prerequisite only; 14 exact original function definition/owner/ACL readbacks match; temporary SET edge removed. Mandatory PG17 bootstrap ADMIN edge remains with SET/INHERIT false, exactly as captured before temporary grant.'});
  const rls=(await actor.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='n88_private'::regnamespace and relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts')")).rows;
  assert.equal(rls.length,4);assert(rls.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
  const exposure=(await actor.query(`select p.proname,r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE') as execute
    from pg_proc p cross join pg_roles r where p.pronamespace='n88_private'::regnamespace and p.proname=any($1::text[]) and r.rolname in ('anon','authenticated')`,[operations.map(o=>o.name)])).rows;
  assert.equal(exposure.length,28);assert(exposure.every(r=>!r.execute));
  // Separate runtime client: bootstrap only grants login test role SET capability.
  await admin.query(`create role n88_fixture_runtime login nosuperuser nocreaterole nobypassrls noinherit password '${password}';
    grant n88_v2_runtime to n88_fixture_runtime with inherit false,set true;`);
  const runtime=await connect('runtime','n88_fixture_runtime');await runtime.query('set role n88_v2_runtime');
  for (const table of ['contexts','numeric_credentials','numeric_sessions','publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts']) {
    await assert.rejects(runtime.query(`select * from n88_private.${table}`),e=>e.code==='42501');
  }
  for (const table of ['users','sessions']) await assert.rejects(runtime.query(`select * from auth.${table}`),e=>e.code==='42501');
  for (const table of ['items','scores','score_subitems']) await assert.rejects(runtime.query(`delete from rakeezx.${table}`),e=>e.code==='42501');
  await runtime.end();clients.delete(runtime);
  await admin.query('revoke n88_v2_runtime from n88_fixture_runtime;drop role n88_fixture_runtime');
  assert.deepEqual(await fingerprint(),supplied);
  assert.equal((await actor.query("select count(*)::integer as n from pg_auth_members where roleid in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole) and (set_option or inherit_option)")).rows[0].n,0);
  report.checks.push({name:'n88_legacy_guards_and_runtime_isolation_preserved',status:'PASS',evidence:'Legacy fingerprints identical across candidate; 4 forced-RLS storage tables; PUBLIC absent in all 14 exact ACLs, anon/authenticated 28 negative EXECUTE checks; actual runtime client denied 7 private reads, 2 Auth reads, 3 canonical DELETEs. Fixture login removed; zero V2 SET/INHERIT edges.'});
}
