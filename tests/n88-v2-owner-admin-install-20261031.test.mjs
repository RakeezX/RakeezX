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
import {preSql,postSql,bind,admit,validatePost,toolLifecycle,TOOL_WINDOW_MS} from '../drafts/n88-student-portal/activation/v2-owner-admin-install-20261031/admission.mjs';
import { identitySql, baselineInventorySql } from '../drafts/n88-student-portal/activation/v2-external-plan-1028/preflight.mjs';
import { publicationV2FunctionReadback } from '../drafts/n88-student-portal/publication-v2-host.inactive.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(path.resolve(process.cwd()), root);
const taskId = 'continuous-n88-owner-admin-storage-install-20261031', runId = '884fde26-bbeb-4f09-bac7-d2bd60a47ca5';
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
  failure = e; report.failure = { name: e.name, code: e.code ?? null, message: e.message.replaceAll(password,'[REDACTED]'),
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
 const candidateDir='drafts/n88-student-portal/activation/v2-owner-admin-install-20261031';
 const candidateManifest=JSON.parse(await source(candidateDir+'/manifest.json'));
 if(process.argv.includes('--timing-only'))return qualifyTiming({source,admin,report,candidateDir,candidateManifest});
 for(const [file,expected] of Object.entries(candidateManifest.pinnedSources)) assert.equal(sourceHash(await readFile(path.join(root,file))),expected,file);
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
  // Exact legacy schema USAGE from staged migration line320, not a V2 prerequisite.
  await admin.query('grant usage on schema n88_private,rakeezx to n88_guard');
  const actor = await connect('installer','postgres');
  const oldEdges=(await actor.query("select grantor::regrole::text as grantor,admin_option,inherit_option,set_option from pg_auth_members where roleid='n88_guard'::regrole and member='postgres'::regrole order by grantor::regrole::text")).rows;
  assert.deepEqual(oldEdges,[{grantor:'postgres',admin_option:false,inherit_option:false,set_option:false},{grantor:'supabase_admin',admin_option:true,inherit_option:false,set_option:false}]);
  report.oldGuardEdges=oldEdges;
  const actorProfile = (await actor.query(`select current_user,session_user,rolsuper,rolcreaterole,rolbypassrls,rolinherit,current_setting('createrole_self_grant') as self_grant from pg_roles where rolname=current_user`)).rows[0];
  assert.deepEqual(actorProfile,{current_user:'postgres',session_user:'postgres',rolsuper:false,rolcreaterole:true,rolbypassrls:true,rolinherit:true,self_grant:''});
  report.actorProfile=actorProfile;
  const fingerprint=async()=>(await admin.query(`select jsonb_build_object('roles',(select jsonb_agg(to_jsonb(r) order by rolname) from pg_roles r where rolname in ('postgres','n88_guard','n88_backend')),'edges',(select coalesce(jsonb_agg(to_jsonb(m) order by m.roleid,m.member,m.grantor),'[]'::jsonb) from pg_auth_members m),'functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'body',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl::text,'config',p.proconfig) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('n88_private','auth','rakeezx'))) as value`)).rows[0].value;
  report.transactionMode=process.argv[2]==='--standalone'?'standalone':'empty-outer';
  const original=await fingerprint();
  const pre=(await actor.query(preSql)).rows[0];
  const admittedRecord=await bind(pre,new Date(Date.now()+120000).toISOString(),{persist:false});
  const prior=await source('drafts/n88-student-portal/activation/v2-actor-qualified-20261030/installer.inactive.sql');
  await assert.rejects(actor.query(prior),e=>{report.oldRouteDenial={code:e.code,message:e.message};return e.code==='42501';});
  await actor.query('rollback');assert.deepEqual(await fingerprint(),original);
  const sql=await source(candidateDir+'/installer.inactive.sql');assert.equal(sourceHash(sql),candidateManifest.installerSha256);
  const observed=(await actor.query(identitySql)).rows[0];
  const target={projectRef:'xlrubcwjqktzzunrvuns',databaseName:observed.database_name,databaseOid:observed.database_oid,systemIdentifier:observed.system_identifier,serverAddress:observed.server_address,serverPort:String(observed.server_port),serverVersionNum:observed.server_version_num,installerSessionRole:'postgres',installerCurrentRole:'postgres',baselineInventorySha256:(await actor.query(baselineInventorySql)).rows[0].sha256,nonExposureReadbackSha256:'a'.repeat(64)};
  const digest=async v=>(await actor.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as h",[JSON.stringify(v)])).rows[0].h;
  const authority={productId:'N88',taskId,runId,action:'install-owner-admin-storage-20261031',targetSha256:await digest(target),deltaSha256:candidateManifest.deltaSha256,ref:'DISPOSABLE-SYNTHETIC-ONLY',expiresAt:new Date(Date.now()+120000).toISOString()};
  const literal=v=>JSON.stringify(v).replaceAll("'","''");
  const bound=sql.replace("expected_target jsonb := 'null'::jsonb;",`expected_target jsonb := '${literal(target)}'::jsonb;`).replace("expected_authority jsonb := 'null'::jsonb;",`expected_authority jsonb := '${literal(authority)}'::jsonb;`);
  const assertAbsent=async()=>{
    assert.deepEqual(await fingerprint(),original);
    assert.equal((await actor.query("select count(*)::int as n from pg_roles where rolname in ('n88_v2_guard','n88_v2_runtime')")).rows[0].n,0);
    assert.equal((await actor.query("select count(*)::int as n from pg_class where relnamespace='n88_private'::regnamespace and relname like 'publication_v2_%'")).rows[0].n,0);
  };
  report.injections=[];
  for(const outer of [false,true])for(const stage of ['after-old-set','after-helper-acls','partial-v2-ddl']){
    if(outer)await actor.query('begin');
    await assert.rejects(actor.query(bound.replace('-- INJECTION '+stage,`DO $fail$ BEGIN RAISE EXCEPTION 'n88_injected_${stage}'; END $fail$;`)),e=>{report.injections.push({outer,stage,code:e.code,message:e.message});return e.message==='n88_injected_'+stage;});
    await actor.query('rollback');await assertAbsent();
  }
  // An adapter outer transaction that already established a snapshot cannot admit
  // serializable setup; this MUST fail before any operational writes.
  await actor.query('begin;select 1');
  await assert.rejects(actor.query(bound),e=>e.code==='25001');await actor.query('rollback');await assertAbsent();
  // Full standalone final assertions, deliberately roll back only in this fixture.
  try{await actor.query(bound.replace(/COMMIT;\s*$/,'ROLLBACK;'));}catch(e){report.nativeFailure={code:e.code,message:e.message,where:e.where};throw e;}
  await assertAbsent();
  // Exact candidate inside an empty outer adapter transaction, sole COMMIT.
  if(process.argv[2]!=='--standalone')await actor.query('begin');
  try{await actor.query(bound);}catch(e){report.nativeFailure={code:e.code,message:e.message,where:e.where};throw e;}
  const operations=JSON.parse(await source('drafts/n88-student-portal/activation/v2-package-1028/boundary-operations.json')).operations;
  const readback=(await actor.query(publicationV2FunctionReadback,[operations.map(o=>o.name)])).rows;
  const originalManifest=JSON.parse(await source('drafts/n88-student-portal/activation/v2-package-1028/manifest.json'));
  assert.deepEqual(readback,originalManifest.functions);report.functions=readback;
  const edges=(await actor.query("select roleid::regrole::text as role,member::regrole::text as member,grantor::regrole::text as grantor,admin_option,inherit_option,set_option from pg_auth_members where roleid in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole) or member in ('n88_v2_guard'::regrole,'n88_v2_runtime'::regrole) order by roleid::regrole::text")).rows;
  assert.deepEqual(edges,['n88_v2_guard','n88_v2_runtime'].map(role=>({role,member:'postgres',grantor:'supabase_admin',admin_option:true,inherit_option:false,set_option:false})));report.creatorEdges=edges;
  const after=await fingerprint();
  assert.deepEqual(after.roles,original.roles);
  const v2oids=(await actor.query("select oid from pg_roles where rolname in ('n88_v2_guard','n88_v2_runtime')")).rows.map(r=>r.oid);
  assert.deepEqual(after.edges.filter(m=>!v2oids.map(String).includes(String(m.roleid))),original.edges);
  for(const before of original.functions){const got=after.functions.find(x=>x.oid===before.oid);assert(got);
    assert.deepEqual({...got,acl:null},{...before,acl:null});
    const strip=acl=>(acl??'').replace(/,?n88_v2_runtime=X\/(?:n88_guard|postgres)(?=,|\})/g,'').replace('{,','{');
    const f=before.body.match(/FUNCTION ([^(]+)/)?.[1];
    if(before.acl===null&&got.acl===null)continue;
    const owner=before.owner;const ownerName=(await actor.query('select rolname from pg_roles where oid=$1',[owner])).rows[0].rolname;
    const aclParts=a=>(a??`{=X/${ownerName},${ownerName}=X/${ownerName}}`).slice(1,-1).split(',').filter(x=>!x.startsWith('n88_v2_runtime=')).sort();
    assert.deepEqual(aclParts(got.acl),aclParts(before.acl));
  }
  await admin.query(`create role n88_fixture_runtime login nosuperuser nocreaterole nobypassrls noinherit password '${password}';grant n88_v2_runtime to n88_fixture_runtime with inherit false,set true;`);
  const runtime=await connect('runtime','n88_fixture_runtime');await runtime.query('set role n88_v2_runtime');
  for(const table of ['contexts','numeric_credentials','numeric_sessions','publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts'])await assert.rejects(runtime.query('select * from n88_private.'+table),e=>e.code==='42501');
  for(const table of ['users','sessions'])await assert.rejects(runtime.query('select * from auth.'+table),e=>e.code==='42501');
  for(const table of ['items','scores','score_subitems'])for(const op of ['select * from','delete from'])await assert.rejects(runtime.query(op+' rakeezx.'+table),e=>e.code==='42501');
  // One bounded fabricated callable-runtime roundtrip, not the old broad campaign.
  const owner=randomUUID(),foreign=randomUUID(),credentialId=randomUUID(),numericSessionId=randomUUID();
  const scope={ownerId:owner,teachingId:'teaching',sectionId:'class',termId:'term',subjectId:'subject'},scopeKey='a'.repeat(64),rowId=JSON.stringify(['item','item','item']);
  const credential={id:credentialId,ownerId:owner,studentId:'pupil',version:1,format:'six-v1',keyVersion:'v1',reservation:'b'.repeat(64),verifier:'c'.repeat(64),revokedAt:null};
  const numericSession={id:numericSessionId,credentialId,ownerId:owner,studentId:'pupil',classId:'class',enrollmentId:'enrollment',membershipRevision:1,canonicalStamp:'d'.repeat(64),version:1,tokenHash:'e'.repeat(64),expiresAt:Date.now()+60000,revokedAt:null};
  await admin.query('insert into auth.users(id) values($1)',[owner]);
  await admin.query('insert into n88_private.contexts(namespace,owner_id,active) values($1,$2,true)',['synthetic_context_20261031_only',owner]);
  await admin.query('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)',[credentialId,JSON.stringify(credential)]);
  await admin.query('insert into n88_private.numeric_sessions(row_key,payload) values($1,$2::jsonb)',[numericSessionId,JSON.stringify(numericSession)]);
  const calls=[];const call=async(id,args)=>{const op=operations.find(o=>o.id===id);assert(op);calls.push(id);return (await runtime.query(op.callSql,args)).rows;};
  await runtime.query('begin');await runtime.query("select set_config('n88.v2_owner',$1,true)",[owner]);
  assert.equal((await call('owner-context',[owner]))[0].owner_id,owner);
  assert.deepEqual((await call('numeric-session',[numericSession.tokenHash]))[0].payload,numericSession);
  assert.deepEqual((await call('numeric-credential',[credentialId,owner,'pupil','1']))[0].payload,credential);
  const scopePayload={scope,manualTasks:[]};
  assert.equal((await call('insert-scope',[owner,scopeKey,JSON.stringify(scopePayload)]))[0].affected,'1');
  assert.equal((await call('cas-scope',[owner,scopeKey,JSON.stringify(scopePayload),'1']))[0].affected,'1');
  const publication={rowId,sourceRevision:'f'.repeat(64),publicationRevision:1,membershipRevision:'b'.repeat(64),decisions:{required:false,scheduled:false,completed:false,grade:false},tombstone:false};
  assert.equal((await call('insert-item',[owner,scopeKey,rowId,'1',false,JSON.stringify(publication)]))[0].affected,'1');
  const changed={...publication,publicationRevision:2};
  assert.equal((await call('cas-item',[owner,scopeKey,rowId,'2',false,JSON.stringify(changed),'1',JSON.stringify(publication)]))[0].affected,'1');
  assert.equal((await call('insert-high-water',[owner,scopeKey,'items:item','1',false]))[0].affected,'1');
  assert.equal((await call('cas-high-water',[owner,scopeKey,'items:item','2',false,'1',false]))[0].affected,'1');
  const requestId='synthetic_request_20261031';const receipt={version:2,scope,binding:{sessionId:'synthetic-session',leaseId:'synthetic-lease',contextRevision:'1'},requestId,rowId,sourceRevision:publication.sourceRevision,state:'applied',publicationRevision:2};
  assert.equal((await call('insert-receipt',[owner,requestId,scopeKey,'c'.repeat(64),JSON.stringify(receipt)]))[0].affected,'1');
  for(const id of ['read-scopes','read-items','read-high_water','read-receipts']){
    const rows=await call(id,[owner,10,65536,262144]);assert.equal(rows.length,1);assert.equal(typeof rows[0].body,'string');
    assert.equal((await call(id,[foreign,10,65536,262144])).length,0);
  }
  await runtime.query('savepoint foreign_owner');
  await assert.rejects(call('insert-scope',[foreign,'b'.repeat(64),JSON.stringify({scope:{...scope,ownerId:foreign},manualTasks:[]})]),e=>e.code==='42501');await runtime.query('rollback to savepoint foreign_owner');
  await runtime.query('rollback');
  assert.equal((await admin.query('select count(*)::int as n from n88_private.publication_v2_scopes')).rows[0].n,0);
  assert.equal(new Set(calls).size,14);report.runtimeRoundtrip={fixedOperations:14,actualRole:'n88_v2_runtime',scopeItemHighwaterReceiptCAS:true,foreignReadsEmpty:true,foreignInsertDenied42501:true,rolledBack:true,oldHelpers:'Exact ACL grant/readback only; original helper business execution reused, not recertified in this bounded fixture.'};
  await runtime.end();clients.delete(runtime);await admin.query('revoke n88_v2_runtime from n88_fixture_runtime;drop role n88_fixture_runtime');
  const post=(await actor.query(postSql)).rows[0];
  report.readback=await validatePost(admittedRecord,post);
  let dispatches=0;const fake={query:async(sql)=>{dispatches++;return {rows:sql===preSql?[pre]:sql===postSql?[post]:[]};}};
  const finite=admit(fake,admittedRecord,{taskId,runId});
  assert.throws(()=>admit(fake,admittedRecord,{taskId,runId}),/admission_denied/);
  assert.throws(()=>admit({},admittedRecord,{taskId,runId:'foreign'}),/admission_denied/);
  const tampered=structuredClone(admittedRecord);tampered.operations[1].sql+='-- tamper';tampered.boundInstallerSha256=hash(tampered.operations[1].sql);
  assert.throws(()=>admit({},tampered,{taskId,runId}),/admission_denied/);
  assert.throws(()=>{admittedRecord.operations[1].sql+='-- tamper';},TypeError);
  await finite.query(preSql);await finite.query(admittedRecord.operations[1].sql);await finite.query(postSql);
  await assert.rejects(finite.query(admittedRecord.operations[1].sql),/statement_denied/);assert.equal(dispatches,3);
  const f2=admit({query:async()=>{throw Error('must not dispatch');}},admittedRecord,{taskId,runId});await assert.rejects(f2.query(preSql+' '),/statement_denied/);
  let lost=0;const f3=admit({query:async()=>{lost++;throw Error('lost acknowledgement');}},admittedRecord,{taskId,runId});await assert.rejects(f3.query(preSql),/lost acknowledgement/);await assert.rejects(f3.query(preSql),/statement_denied/);assert.equal(lost,1);
  report.checks.push({name:'n88_exact_original_target_authority_and_finite_admission',status:'PASS',evidence:'Pinned authority/source bytes; real native pre/post catalog SQL and post-validator qualified. Foreign run, cloned/tampered record, SQL tamper, second install and lost-result replay denied before further dispatch.'});
  report.checks.push({name:'n88_native_actual_actor_atomic_admin_qualification',status:'PASS',evidence:'PG17 actual nonsuperuser postgres creates BOTH V2 roles. Old route fails42501; six injections (3 stages, standalone/outer) roll back original metadata and all V2; busy outer transaction refuses25001. Full standalone final assertions with fixture ROLLBACK; exact candidate COMMIT in selected standalone/empty-outer mode. 14 actual restricted-runtime calls roundtrip scope/item/highwater/receipt CAS with foreign-owner denial and rollback; 14 original identities/ACLs match; both mandatory ADMIN-only creator edges; old roles/body/config/ACL except 3 exact helper grants unchanged; runtime denied all raw private/Auth/canonical reads and canonical deletes.'});
}

/** Narrow continuation: actual guard SQL only, no storage fixture or DDL campaign. */
async function qualifyTiming({source,admin,report,candidateDir,candidateManifest}){
 const archived=JSON.parse(await source(candidateManifest.originalArchive.path));
 const priorFile=archived.files.find(f=>f.file===candidateDir+'/installer.inactive.sql');
 const old=await source(priorFile.path),sql=await source(candidateDir+'/installer.inactive.sql');assert.equal(hash(old),priorFile.sha256);assert.equal(hash(sql),candidateManifest.installerSha256);
 assert.equal(sql.slice(sql.indexOf('DO $original_snapshot$')),old.slice(old.indexOf('DO $original_snapshot$')));
 const qualifiedDelta=sql.slice(sql.indexOf('DO $original_snapshot$'),sql.indexOf('DO $external_readback$'))+sql.slice(sql.indexOf('DO $admin_readback$'),sql.lastIndexOf('COMMIT;'));assert.equal(hash(qualifiedDelta),candidateManifest.deltaSha256);assert.equal((sql.match(/create function n88_private\.v2_/g)??[]).length,14);
 assert.equal(sql.slice(0,sql.indexOf('DO $external_gate$')),old.slice(0,old.indexOf('DO $external_gate$')));
 const priorRecord=JSON.parse(await source(archived.files.find(f=>f.file===candidateDir+'/install-authority.json').path));
 const row={target:priorRecord.target,target_sha256:priorRecord.authority.targetSha256,snapshot:priorRecord.originalSnapshot};
 const start=Date.now(),deadline=new Date(start+TOOL_WINDOW_MS).toISOString();
 const rec=await bind(row,deadline,{persist:false});
 const gate=sql.slice(sql.indexOf('DO $external_gate$'),sql.indexOf(' SELECT * INTO STRICT observed'))+'END\n$external_gate$;';
 const literal=v=>JSON.stringify(v).replaceAll("'","''");
 const bound=(t,a)=>gate.replace("expected_target jsonb := 'null'::jsonb;",`expected_target jsonb := '${literal(t)}'::jsonb;`).replace("expected_authority jsonb := 'null'::jsonb;",`expected_authority jsonb := '${literal(a)}'::jsonb;`);
 await admin.query(bound(rec.target,rec.authority));
 let rejected=0;
 for(const [key,value]of [['expiresAt',new Date(start-1000).toISOString()],['expiresAt',null]]){
  await assert.rejects(admin.query(bound(rec.target,{...rec.authority,[key]:value})),e=>{assert.equal(e.code,'P0001');assert.equal(e.message,'n88_external_authority_expired');rejected++;return true;});
 }
 for(const key of ['productId','taskId','runId','action','targetSha256','deltaSha256','ref']){
  await assert.rejects(admin.query(bound(rec.target,{...rec.authority,[key]:'tampered'})),e=>{assert.equal(e.message,'n88_external_target_delta_action_authority_mismatch');rejected++;return true;});
 }
 for(const key of ['projectRef','nonExposureReadbackSha256'])await assert.rejects(admin.query(bound({...rec.target,[key]:'tampered'},rec.authority)),e=>{assert.equal(e.message,'n88_external_target_delta_action_authority_mismatch');rejected++;return true;});
 let clock=start+9*60000,dispatches=0;
 const fake={query:async statement=>{dispatches++;if(statement===rec.operations[1].sql)clock=start+46*60000;return {rows:statement===preSql?[row]:statement===postSql?[{snapshot:priorRecord.originalSnapshot}]:[],receipt:{terminal:true}};}};
 const admitted=admit(fake,rec,{taskId,runId},{now:()=>clock});await admitted.query(preSql);await admitted.query(rec.operations[1].sql);
 await admitted.query(postSql);
 await assert.rejects(admitted.query(rec.operations[1].sql),/statement_denied/);assert.equal(dispatches,3);
 const restart=admit({query:async statement=>{assert.equal(statement,postSql);return {rows:[{snapshot:priorRecord.originalSnapshot}]};}},rec,{taskId,runId},{reconcile:true,now:()=>clock});await restart.query(postSql);await assert.rejects(restart.query(rec.operations[1].sql),/statement_denied/);
 const tampered=structuredClone(rec);tampered.operations[1].sql+='-- tamper';tampered.boundInstallerSha256=hash(tampered.operations[1].sql);assert.throws(()=>admit({},tampered,{taskId,runId}),/admission_denied/);
 assert.throws(()=>admit({},rec,{taskId,runId:'foreign'}),/admission_denied/);
 const tooLong=await bind(row,new Date(Date.now()+TOOL_WINDOW_MS+60000).toISOString(),{persist:false});assert.throws(()=>admit({},tooLong,{taskId,runId}),/plan_mismatch/);
 clock=start;const lifecycle=toolLifecycle(start+TOOL_WINDOW_MS,{now:()=>clock});clock+=1000;lifecycle.claim();clock=start+46*60000;assert.equal(lifecycle.tick(),'PENDING_AFTER_WINDOW');assert.equal(lifecycle.canRelease,false);lifecycle.terminal();assert.equal(lifecycle.canRelease,true);assert.throws(()=>lifecycle.claim(),/expired_or_spent/);
 clock=start;const unclaimed=toolLifecycle(start+TOOL_WINDOW_MS,{now:()=>clock});clock=start+TOOL_WINDOW_MS;assert.equal(unclaimed.tick(),'EXPIRED_UNCLAIMED');assert.equal(unclaimed.canRelease,true);assert.throws(()=>unclaimed.claim(),/expired_or_spent/);
 report.checks.push({name:'n88_timing_guard_and_tool_lifecycle',status:'PASS',evidence:'Actual native first-guard SQL: valid45min authority accepted; expired/null expiry classified separately; all 9 identity/binding tamper cases rejected. Same qualified DDL/privilege tail, delta hash and14 identities; 15s/3s settings byte-identical. Fake-clock admission accepts after old8min, retains late terminal ACK, preserves post-ACK/restart readonly, rejects foreign/tampered/repeated mutation and >45min authority. Claimed pending cannot release; unclaimed expiry can.'});
 report.reusedNativeQualification=candidateManifest.nativeQualification;report.authorityGuardRejections=rejected;report.storageCampaignRerun=false;
}
