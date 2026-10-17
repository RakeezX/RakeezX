/** AI: explicit single synthetic runtime journey; never hosted SQL/Auth or secrets. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { readFile,writeFile,mkdir,unlink } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { journey } from './fixtures/n88-client-binding/journey.mjs';
const root=process.cwd(),runId='56295855-e4bb-4826-b632-ce4ae5589a81';
const taskId='continuous-n88-actual-client-service-bindings-20261018';
const denoExecutable=process.argv[2]==='--deno-executable'?process.argv[3]:null;
const bin='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin';
const {Client,Pool}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
const phase=path.join(root,'tests/fixtures/n88-client-binding','owned-'+randomUUID()),data=path.join(phase,'data');
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:bin+';C:\\Windows\\System32',TEMP:phase,TMP:phase,LANG:'C'};
const cmd=(file,args,stdio='pipe')=>execFileSync(file,args,{env,encoding:'utf8',windowsHide:true,timeout:30000,stdio,maxBuffer:1024*1024});
const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const lease=action=>cmd(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1',
  '-Name','integration','-Action',action,'-TaskFile','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',
  '-RuntimeRoot','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId]);
const report={taskId,runId,baseSha:'7537657e8351fb7cb314a53ac4027c0976b3cf45',startedAt:new Date().toISOString(),checks:[],cleanup:{}};
let owned=false,started=false,reservation,admin,pool,identity;
const control=args=>cmd(path.join(bin,'pg_ctl.exe'),args,'ignore');
await mkdir(phase,{recursive:false});
const marker={runId,token:randomUUID(),runnerPid:process.pid,data};await writeFile(path.join(phase,'owner.json'),JSON.stringify(marker),{flag:'wx'});
async function prove() {
  assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),marker);
  const p=(await readFile(path.join(data,'postmaster.pid'),'utf8')).split(/\r?\n/);
  assert.equal(path.resolve(p[1]),data);
  const info=JSON.parse(cmd(ps,['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(p[0])}'; if($p){@{pid=$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;commandLine=$p.CommandLine}|ConvertTo-Json -Compress}else{'null'}`]));
  assert.ok(info);assert.equal(info.executable.toLowerCase().replaceAll('\\','/'),(bin+'/postgres.exe').toLowerCase());
  assert.ok(info.commandLine.replaceAll('/','\\').includes(data));
  if(identity)assert.deepEqual(info,identity);else identity=info;
}
let failed;
try {
  const result=lease('acquire').trim();assert.match(result,/^(ACQUIRED|ALREADY OWNED) integration$/);owned=true;
  report.checks.push({name:'owned_integration_phase',status:'PASS',evidence:result});
  reservation=net.createServer();await new Promise((ok,fail)=>{reservation.once('error',fail);reservation.listen(0,'127.0.0.1',ok);});
  const port=reservation.address().port,password=randomBytes(32).toString('hex'),passwordFile=path.join(phase,'password.tmp');
  await writeFile(passwordFile,password,{flag:'wx'});
  cmd(path.join(bin,'initdb.exe'),['-D',data,'-U','n88_local_admin','--pwfile',passwordFile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--no-instructions']);
  await unlink(passwordFile);
  await writeFile(path.join(data,'postgresql.auto.conf'),`listen_addresses='127.0.0.1'\nport=${port}\nshared_buffers='16MB'\nmax_connections=12\nlog_statement='none'\nlog_min_error_statement='panic'\nlog_parameter_max_length=0\nlog_parameter_max_length_on_error=0\nlog_connections=off\nlog_disconnections=off\nfsync=on\nsynchronous_commit=on\nfull_page_writes=on\n`);
  await new Promise(ok=>reservation.close(ok));reservation=null;
  control(['-D',data,'-l',path.join(phase,'server.log'),'-w','-t','20','start']);started=true;await prove();
  const config={host:'127.0.0.1',port,user:'n88_local_admin',password,database:'postgres',ssl:false,connectionTimeoutMillis:2000,
    statement_timeout:5000,query_timeout:8000,application_name:'n88-runtime-synthetic',max:3};
  admin=new Client(config);await admin.connect();
  const actual=(await admin.query("select current_setting('data_directory') as dir,inet_server_port() as port,version() as version")).rows[0];
  assert.equal(path.resolve(actual.dir),data);assert.equal(actual.port,port);assert.match(actual.version,/PostgreSQL 17\.6/);
  report.database='owned native PostgreSQL 17.6; synthetic source rows only';
  for(const file of ['drafts/n88-student-portal/schema-proposal.sql','drafts/n88-student-portal/postgres-repository-schema.sql',
    'drafts/n88-student-portal/canonical-state-schema.inactive.sql','tests/fixtures/n88-existing-host/canonical.sql','drafts/n88-student-portal/canonical-lock.inactive.sql','drafts/n88-student-portal/auth-session.inactive.sql','drafts/n88-student-portal/ingress.inactive.sql']) await admin.query(await readFile(file,'utf8'));
  await admin.query(await readFile('tests/fixtures/n88-existing-host/roles.sql','utf8'));
  await admin.query(await readFile('drafts/n88-student-portal/roles.inactive.sql','utf8'));
  pool=new Pool({...config,max:4});
  pool.on('connect',client=>{void client.query('set role n88_backend');});
  await journey({pool,admin,report});
} catch(e) {
  failed=e;
  // No SQL/URL/token/body/error-detail capture. Keep factual initial assertion only.
  report.checks.push({name:'runtime_journey_execution',status:'FAIL',evidence:e.code==='ERR_ASSERTION'?'Assertion failed; inspect local test stack (no private values retained).':'Phase operation failed; no alternative invocation or live retry.'});
  console.error(e.code||e.name,e.stack?.split('\n').filter(x=>x.includes(' at ')).join('\n'));
} finally {
  try {if(pool)await pool.end();if(admin)await admin.end();if(reservation)await new Promise(ok=>reservation.close(ok));
    if(started){await prove();control(['-D',data,'-m','fast','-w','-t','20','stop']);started=false;report.cleanup.postgresStopped=true;}
    if(owned){report.cleanup.leaseRelease=lease('release').trim();owned=false;}
  }catch(e){failed??=e;report.cleanup.failure='Owned cleanup failed; no unrelated process touched';}
  report.cleanup.clusterFilesRetained=true; // Preserve evidence, no recursive removal.
  report.finishedAt=new Date().toISOString();report.sourceSha256={};
  for(const file of ['src/lib/student-portal-runtime.js','src/lib/student-portal-client.js','src/views/student-portal-teacher.js','src/views/student-portal.js','src/styles/student-portal.css','src/router.js','sw.js','tests/fixtures/n88-client-binding/journey.mjs'])
    report.sourceSha256[file]=createHash('sha256').update((await readFile(file,'utf8')).replace(/\r\n/g,'\n')).digest('hex');
  await writeFile('tests/n88-client-binding.result.json',JSON.stringify(report,null,2)+'\n');
}
if(failed)process.exitCode=1;else console.log('N88 actual client/UI binding PASS; owned browser/HTTP/PG/lease closed.');
