/** AI: explicit, local-only native PG qualification. No default DSN or installer.
 * Reuses installed tools only; creates a NEW SCRAM-authenticated loopback cluster.
 * Run from the activated worktree: node tests/n88-backend-package-1028/run-local.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { ownLocalPublicationV2, createInactivePublicationV2Host, publicationV2FunctionReadback } from '../../drafts/n88-student-portal/publication-v2-host.inactive.mjs';
import { createCanonicalPublicationV2Ports } from '../../drafts/n88-student-portal/publication-v2-canonical.inactive.mjs';
import { createPublicationV2PostgresRepository } from '../../drafts/n88-student-portal/publication-v2-postgres.inactive.mjs';
import { createRolloutGuard } from '../../drafts/n88-student-portal/rollout-guard.mjs';
import { CANONICAL_PROJECTION_REQUIREMENTS } from '../../drafts/n88-student-portal/student-projection.mjs';
import { publicationCommand, reconcilePublication } from '../../src/lib/n88-item-publication-proposal.js';
import { providerFixture, A, B, SESSION, authUrl } from '../fixtures/n88-existing-host/provider.mjs';
import { attachPublicationRetirement } from '../../drafts/n88-student-portal/activation/v2-package-1028/lifecycle-attach.inactive.mjs';


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
assert.equal(path.resolve(process.cwd()), root);
const taskId = 'n88-backend-package-1028', runId = 'ee57b00d-1c90-4926-8819-77989368fcc1';
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
  await writeFile(path.join(data, 'pg_hba.conf'), 'host all n88_local_admin 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n');
  await writeFile(path.join(data, 'postgresql.auto.conf'), `listen_addresses='127.0.0.1'\nport=${port}\nmax_connections=20\nshared_buffers='16MB'\nlog_statement='none'\nlog_min_error_statement='panic'\n`);
  await close(reservation); reservation = null;
  control(['-D', data, '-l', path.join(phase, 'server.log'), '-w', '-t', '20', 'start']); started = true; await proveIdentity();
  const admin = await connect('observer');
  report.localConfig = (await admin.query("select current_setting('listen_addresses') as listen, current_setting('port') as port, current_setting('password_encryption') as password_encryption")).rows[0];
  assert.equal(report.localConfig.listen, '127.0.0.1'); assert.equal(report.localConfig.password_encryption, 'scram-sha-256');
  report.hba = (await admin.query('select type,address,auth_method,error from pg_hba_file_rules order by rule_number')).rows;
  assert(report.hba.every(r => r.error === null)); assert.equal(report.hba[0].auth_method, 'scram-sha-256');
  const verifyRestart = await qualify({ root, admin, connect, report, phase, marker });
  report.restart = { prior: await stop() }; identity = undefined;
  control(['-D', data, '-l', path.join(phase, 'server.log'), '-w', '-t', '20', 'start']); started = true; await proveIdentity();
  const fresh = await connect('restart'); report.restart.newIdentity = { pid: identity.pid, birth: identity.birth };
  await verifyRestart(fresh);
  report.checks.push({ name: 'native_clean_restart_persists_original_receipts_and_tombstones', status: 'PASS' });
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
  if (!process.argv.includes('--identity-only')) await writeFile(path.join(root,'tests/n88-backend-package-1028/results.json'), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ status: report.status, reportPath: path.join(phase, 'report.json'), checks: report.checks, cleanup: report.cleanup, failure: report.failure }));
}
if (failure) process.exitCode = 1;

async function qualify({ root, admin, connect, report, phase, marker }) {
  const check = async (name, fn) => { console.log('CHECK '+name); report.checks.push({name,status:'PASS',evidence:await fn()}); };
  const source = async file => { const s = await readFile(path.join(root, file), 'utf8'); report.sourceSha256[file] = hash(s); return s.replace(/^\uFEFF/, ''); }; // Strip encoding BOM only, retain raw-byte identity.
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

  for (const owner of [A, B]) {
    await admin.query('insert into auth.users(id) values($1::uuid)', [owner]);
    await admin.query('insert into n88_private.contexts(namespace,owner_id,active) values($1,$2::uuid,true)', ['synthetic_canonical_' + owner.replaceAll('-', ''), owner]);
    await admin.query("insert into rakeezx.years(owner_id,id,label,hijri_start,hijri_end) values($1::uuid,'year','1448',1448,1449)", [owner]);
    await admin.query("insert into rakeezx.terms(owner_id,id,year_id,name,\"index\",status,start_date,end_date) values($1::uuid,'term','year','Term',1,'active','2026-08-01','2027-06-01')", [owner]);
    await admin.query("insert into rakeezx.subjects(owner_id,id,name,slug) values($1::uuid,'subject','Subject','subject')", [owner]);
    await admin.query("insert into rakeezx.sections(owner_id,id,year_id,grade,label,name) values($1::uuid,'class','year',4,'A','Fabricated')", [owner]);
    await admin.query("insert into rakeezx.teachings(owner_id,id,section_id,term_id,subject_id) values($1::uuid,'teaching','class','term','subject')", [owner]);
    await admin.query("insert into rakeezx.items(owner_id,id,teaching_id,name,max,score_mode,\"order\") values($1::uuid,'parent','teaching','Distribution',10,'subitems',0),($1::uuid,'direct','teaching','Direct',10,'direct',1)", [owner]);
    await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,name,value,late_points,start_date,due_date,\"order\") values($1::uuid,'a','parent','Work a',5,2,'2026-10-20','2026-10-30',0),($1::uuid,'b','parent','Work b',5,null,null,null,1)", [owner]);
  }
  await admin.query('insert into auth.sessions(id,user_id,not_after) values($1::uuid,$2::uuid,clock_timestamp()+interval \'1 hour\')', [SESSION, A]);

  const packetDir = path.join(root,'drafts/n88-student-portal/activation/v2-package-1028');
  const operations = JSON.parse(await readFile(path.join(packetDir,'boundary-operations.json'),'utf8')).operations;
  await admin.query("select set_config('n88.v2_package_install',$1,false)", [marker.runId]);
  await admin.query(await source('drafts/n88-student-portal/activation/v2-package-1028/schema.sql'));
  await admin.query('alter table n88_private.contexts enable row level security');
  for (const table of names) await admin.query(`alter table rakeezx.${table} enable row level security`);
  const functions = (await admin.query(publicationV2FunctionReadback,[operations.map(o=>o.name)])).rows;
  assert.equal(functions.length,14); assert(functions.every(f=>f.definer && f.owner==='n88_v2_guard' && JSON.stringify(f.config)==='["search_path=pg_catalog"]' && !f.acl.some(p=>p.startsWith('PUBLIC:'))));
  const manifestFile=path.join(packetDir,'manifest.json');
  const manifest=JSON.parse(await readFile(manifestFile,'utf8')); manifest.functions=functions;
  await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  report.functions=functions;
  const provider=providerFixture(), tokens=[];
  const rollout=createRolloutGuard(k=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'f'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[k]);
  const origin='https://synthetic.invalid';
  const canonical={rollout, studentTeachingId:'teaching', teacher:{authUrl,apiKey:'FABRICATED_PUBLIC_KEY',fetch:provider.fetch},
    numeric:{keys:new Map([['v1',Buffer.alloc(32,1)]]),activeKeyVersion:'v1',reservationKey:Buffer.alloc(32,2)},
    verifyIngress:async r=>r.headers['x-fixture-ingress']==='1'?{clientKey:'fabricated-ingress'}:null};
  const control={gate:null,late:null,pids:new Set(),calls:[]};
  const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
  const gate=sql=>({sql,entered:deferred(),release:deferred()});
  const fixtureConnect=async label=>{
    const c=await connect(label);control.pids.add(c.processID);const query=c.query.bind(c);
    c.query=async(sql,args)=>{control.calls.push(typeof sql==='string'?sql:'native-query');
      report.lastStatement={sha256:hash(sql),operation:operations.find(o=>o.callSql===sql)?.id??(sql.includes('lock_current_session')?'original-current-session':sql.includes('from rakeezx.')?'original-canonical-read':sql.includes('lock_projection_sources')?'original-projection-lock':sql.startsWith('select set_config')?'transaction-config':sql)};
      let r;try{r=await query(sql,args);}catch(e){report.nativeError={code:e.code,routine:e.routine,statementSha256:hash(sql)};throw e;}
      report.trace??=[];report.trace.push({...report.lastStatement,rows:r.rowCount});if(report.trace.length>40)report.trace.shift();
      const hold=control.gate?.sql===sql?control.gate:control.late&&sql==='commit'?control.late:null;
      if(hold){if(hold===control.gate)control.gate=null;else control.late=null;hold.entered.resolve(c.processID);await hold.release.promise;}return r;};return c;
  };
  const capability=await ownLocalPublicationV2({workspace:root,phase,taskId:marker.taskId,runId:marker.runId,ownerToken:marker.token,connect:fixtureConnect});
  const host=await createInactivePublicationV2Host({enabled:true,capability,canonical,origin});
  const headers={origin,'x-fixture-ingress':'1','x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin'};
  const binding={sessionId:SESSION,leaseId:'echo-only',contextRevision:'context-only'};
  const scope={ownerId:A,teachingId:'teaching',sectionId:'class',termId:'term',subjectId:'subject'};
  const flags={required:false,scheduled:false,completed:false,grade:false};
  const teacherRequest=(body)=>({path:'/teacher/class/publication-v2',method:'POST',body,headers:{...headers,authorization:'Bearer '+provider.token()}});
  const request=body=>host.handle(teacherRequest(body));
  const list=async()=>{const r=await request({action:'list',scope,binding});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
  const command=(l,id='a',decisions={...flags,grade:true})=>{const row=l.rows.find(r=>r.sourceId===id);assert(row);return publicationCommand({draft:{scope,rows:[{...row,decisions}]},scope,binding,rowId:row.id,requestId:'intent_'+randomUUID().replaceAll('-',''),expectedPublicationRevision:row.publicationRevision,expectedMembershipRevision:l.membershipRevision});};
  const student=i=>host.handle({path:'/student/publication-v2/read',method:'GET',headers:{...headers,cookie:'__Secure-n88-student='+tokens[i]?.token}});
  const applied=r=>{assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.receipt.state,'applied');};
  async function addPupil(i,owner=A){
    await admin.query("insert into rakeezx.students(owner_id,id,name) values($1::uuid,$2,'Fabricated')",[owner,'student'+i]);
    await admin.query("insert into rakeezx.enrollments(owner_id,id,student_id,section_id,roll_no) values($1::uuid,$2,$3,'class',$4)",[owner,'enrollment'+i,'student'+i,i+1]);
    await admin.query("insert into rakeezx.scores(owner_id,id,student_id,item_id,value) values($1::uuid,$2,$3,'direct',$4)",[owner,'score'+i,'student'+i,i%10]);
    for(const sub of ['a','b'])await admin.query("insert into rakeezx.score_subitem_completions(owner_id,id,student_id,subitem_id,checked,completion_state) values($1::uuid,$2,$3,$4,true,'regular')",[owner,'completion'+i+sub,'student'+i,sub]);
    const token=randomBytes(32).toString('base64url'),credentialId=randomUUID(),sessionId=randomUUID();
    const credential={id:credentialId,ownerId:owner,studentId:'student'+i,version:1,format:'six-v1',keyVersion:'v1',reservation:hash(credentialId),verifier:'1'.repeat(64),revokedAt:null};
    const session={id:sessionId,credentialId,ownerId:owner,studentId:'student'+i,classId:'class',enrollmentId:'enrollment'+i,membershipRevision:1,canonicalStamp:hash(JSON.stringify(['n88-lineage-v1','1','1','1','1'])),version:1,tokenHash:hash(token),expiresAt:Date.now()+3600000,revokedAt:null};
    await admin.query('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)',[credentialId,JSON.stringify(credential)]);
    await admin.query('insert into n88_private.numeric_sessions(row_key,payload) values($1,$2::jsonb)',[sessionId,JSON.stringify(session)]);
    if(owner===A)tokens[i]={token,sessionId};return {token,sessionId};
  }
  await check('owned_host_original_sdk_actual_finite_functions_empty_class',async()=>{
    assert.equal((await list()).rows.length,3);
    assert(control.calls.some(sql=>sql===operations.find(o=>o.id==='insert-scope').callSql));
    assert(!control.calls.some(sql=>operations.some(o=>o.sql===sql)));
    return {actualRole:'n88_v2_runtime',actualFiniteFunctions:14,noDirectV2Sql:true,originalSDK:true,emptyPupils:true};
  });
  if (process.argv.includes('--identity-only')) return async fresh=>{
    assert.equal((await fresh.query('select count(*)::int as n from n88_private.publication_v2_scopes')).rows[0].n,1);
    report.restartPersistence={scopes:1,receipts:0,tombstones:0};
  };
  let count=0;
  for(const n of [1,30,50])await check('native_bridge_numeric_codec_own_privacy_'+n,async()=>{
    while(count<n)await addPupil(count++);
    let l=await list();applied(await request(command(l,'a',{...flags,completed:true})));l=await list();applied(await request(command(l,'b')));l=await list();applied(await request(command(l,'direct')));
    for(const i of n===1?[0]:[0,n-1]){const r=await student(i);assert.equal(r.status,200,JSON.stringify(r.body));assert.deepEqual(Object.fromEntries(r.body.grades.map(g=>[g.title,g.value])),{Direct:i%10,'Work b':5});assert(!JSON.stringify(r.body).match(/"(?:total|rank|raw|ownerId|studentId)":/));}
    return {pupils:n,actualBridgeNumericCodec:true,hiddenChildAndParentAggregateAbsent:true};
  });
  await check('real_role_acl_nonexposure_and_denied_privileges',async()=>{
    const c=await connect('privilege-denials');await c.query('set role n88_v2_runtime');
    for(const sql of ["select * from auth.sessions","delete from rakeezx.items","select * from n88_private.numeric_credentials","update n88_private.numeric_sessions set row_key=row_key","delete from n88_private.publication_v2_receipts","create table n88_private.forbidden(id int)"]){await assert.rejects(c.query(sql),e=>e.code==='42501');}
    const role=(await c.query("select rolsuper,rolbypassrls,rolinherit,rolcanlogin from pg_roles where rolname=current_user")).rows[0];assert.deepEqual(role,{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:false});await c.end();
    const other=await addPupil(0,B);const r=await host.handle({path:'/student/publication-v2/read',method:'GET',headers:{...headers,cookie:'__Secure-n88-student='+other.token}});assert.equal(r.status,200);assert.deepEqual(r.body.grades,[]);
    return {denials42501:6,noRuntimeAuthScanOrCanonicalWriteOrRawPrivateRead:true,foreignOwnScopeOnly:true,role};
  });
  await check('real_bridge_owner_fk_writer_lock_and_cas_race',async()=>{
    const sql='select n88_private.lock_projection_sources($1::uuid,$2::integer)',hold=gate(sql);control.gate=hold;
    const pending=student(0),blocker=await hold.entered.promise;
    const writer=await connect('independent-source-writer');
    const writing=writer.query("insert into rakeezx.items(owner_id,id,teaching_id,name,max) values($1::uuid,'phantom','teaching','New source',10)",[A]);
    let wait;try{const deadline=Date.now()+2000;while(Date.now()<deadline){wait=(await admin.query('select pid,wait_event_type,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1 and $2=any(pg_blocking_pids(pid))',[writer.processID,blocker])).rows[0];if(wait)break;await new Promise(r=>setTimeout(r,15));}assert(wait);assert.equal(wait.wait_event_type,'Lock');}finally{hold.release.resolve();}
    assert.equal((await pending).status,200);await writing;await writer.end();
    const l=await list();assert(l.rows.find(r=>r.sourceId==='phantom').decisions.grade===false);
    const a=command(l,'a'),b={...a,requestId:'race_'+randomUUID().replaceAll('-','')};const results=await Promise.all([request(a),request(b)]);assert.deepEqual(results.map(r=>r.body.receipt.state).sort(),['applied','rejected']);
    return {wait,twoRealConnections:true,oneCasWinner:true,newSourceUnpublished:true};
  });
  await check('native_bridge_lost_commit_ack_unknown_original_status_no_replay',async()=>{
    const cmd=command(await list()),hold=gate('commit');control.late=hold;const pending=request(cmd);await hold.entered.promise;
    const receipts=async()=>(await admin.query('select count(*)::int as n from n88_private.publication_v2_receipts where owner_id=$1::uuid and request_id=$2',[A,cmd.requestId])).rows[0].n;
    assert.equal(await receipts(),1);try{assert.deepEqual((await pending).body,{state:'unknown',retry:false});}finally{hold.release.resolve();}
    const status=await request({action:'status',scope,binding,command:cmd});assert.equal(reconcilePublication(cmd,scope,status.body.receipt,status.body.fresh,binding).state,'confirmed');assert.equal(await receipts(),1);
    return {committedReceiptBeforeAck:true,unknownNoReplay:true,originalStatusConfirmed:true};
  });
  await check('original_session_revocation_and_numeric_expiry_deny',async()=>{
    await admin.query("update n88_private.numeric_sessions set payload=jsonb_set(payload,'{expiresAt}',$2::jsonb) where row_key=$1",[tokens[49].sessionId,String(Date.now()-1)]);assert.equal((await student(49)).status,503);
    await admin.query('delete from auth.sessions where id=$1::uuid',[SESSION]);assert.equal((await request({action:'list',scope,binding})).status,503);
    await admin.query('insert into auth.sessions(id,user_id,not_after) values($1::uuid,$2::uuid,clock_timestamp()+interval \'1 hour\')',[SESSION,A]);
    return {originalTeacherCurrentSession:true,originalNumericExpiry:true};
  });
  // Genuine original writer transaction contract, not a runtime-role escalation.
  // Exact existing receipt relation; writer DML fabricated in this local test only.
  const syncSource=await source('supabase/migrations/0012_sync_v2_server_protocol.sql');
  await admin.query(syncSource.match(/create table if not exists rakeezx\.sync_mutation_receipts \([\s\S]*?\n\);/)[0]);
  const originalRepo=createPublicationV2PostgresRepository({executionMode:'synthetic',acquire:async()=>{const c=await connect('original-lifecycle-writer');return {query:(sql,args)=>c.query(sql,args),release:()=>c.end().catch(()=>{})};}});
  const originalPorts=createCanonicalPublicationV2Ports({executionMode:'synthetic',repository:originalRepo,origin,...canonical});
  const events=[];const mutationId='delete_'+randomUUID().replaceAll('-','');
  const retire=({rollback=false,incomplete=false}={})=>originalPorts.transaction(async tx=>attachPublicationRetirement({tx,ports:originalPorts,request:teacherRequest({}),lifecycle:{
    validateOriginalCommand:async({auth})=>{events.push('validate');return {ownerId:A,sessionId:auth.sessionId,requestId:mutationId,scope,kind:'item',sourceId:'parent',expectedRevision:'1'};},
    findOriginalReceipt:async()=>{events.push('lookup-original');return (await tx.query('select result from rakeezx.sync_mutation_receipts where owner_id=$1::uuid and mutation_id=$2',[A,mutationId])).rows[0]?.result??null;},
    applyOriginalMutation:async()=>{events.push('original-mutation');if(incomplete)await tx.query("update rakeezx.items set deleted_at=clock_timestamp(),revision=revision+1 where owner_id=$1::uuid and id='parent'",[A]);else await tx.query("delete from rakeezx.items where owner_id=$1::uuid and id='parent'",[A]);},
    writeOriginalReceipt:async()=>{events.push('write-original-receipt');await tx.query("insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,request_envelope,outcome,result) values($1::uuid,$2,'items','parent','fabricated-device',1,'delete','{}'::jsonb,'applied','{\"retired\":true}'::jsonb)",[A,mutationId]);if(rollback)throw Error('fabricated-original-writer-rollback');return {retired:true};}
  }}));
  await check('original_writer_parent_child_receipt_atomic_rollback_and_restore_no_revival',async()=>{
    await assert.rejects(retire({incomplete:true}));await assert.rejects(retire({rollback:true}));
    assert.equal((await admin.query("select count(*)::int as n from rakeezx.score_subitems where owner_id=$1::uuid and item_id='parent'",[A])).rows[0].n,2);
    assert.equal((await admin.query('select count(*)::int as n from rakeezx.sync_mutation_receipts')).rows[0].n,0);
    await retire();const before=events.filter(e=>e==='original-mutation').length;assert.deepEqual(await retire(),{retired:true});assert.equal(events.filter(e=>e==='original-mutation').length,before);
    const tombstones=(await admin.query('select count(*)::int as n from n88_private.publication_v2_items where owner_id=$1::uuid and tombstone',[A])).rows[0].n;assert(tombstones>=2);
    await admin.query("insert into rakeezx.items(owner_id,id,teaching_id,name,max,score_mode,revision) values($1::uuid,'parent','teaching','Restored',10,'subitems',3)",[A]);
    await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,name,value,revision) values($1::uuid,'a','parent','Restored child',5,3)",[A]);
    assert(!(await list()).rows.some(r=>r.sourceId==='a'));assert(!(await student(0)).body.grades.some(g=>g.title.includes('Restored')));
    return {events,parentChildRollback:true,originalReceiptAtomic:true,noReceiptReplay:true,tombstones,restoreNoRevival:true,liveSyncWriterUnmodified:true};
  });
  report.nativePids=[...control.pids];
  report.storageCatalog=(await admin.query("select c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='n88_private' and c.relkind='r' and c.relname like 'publication_v2_%' order by c.relname")).rows;
  const persistence=(await admin.query('select (select count(*)::int from n88_private.publication_v2_receipts) as receipts,(select count(*)::int from n88_private.publication_v2_items where tombstone) as tombstones,(select count(*)::int from rakeezx.sync_mutation_receipts) as original_receipts')).rows[0];
  return async fresh=>{assert.deepEqual((await fresh.query('select (select count(*)::int from n88_private.publication_v2_receipts) as receipts,(select count(*)::int from n88_private.publication_v2_items where tombstone) as tombstones,(select count(*)::int from rakeezx.sync_mutation_receipts) as original_receipts')).rows[0],persistence);report.restartPersistence=persistence;};
}
