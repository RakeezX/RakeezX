/** AI: explicit single synthetic runtime journey; never hosted SQL/Auth or secrets. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { readFile,writeFile,mkdir,unlink } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { journey } from './fixtures/n44-existing-host/journey.mjs';
const root=process.cwd(),runId='a7060142-87f7-4876-af30-bcb92ca2796b';
const taskId='continuous-n44-existing-host-auth-context-and-scheduler-20261018';
const denoExecutable=process.argv[2]==='--deno-executable'?process.argv[3]:null;
const bin='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin';
const {Client,Pool}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
const phase=path.join(root,'tests/fixtures/n44-existing-host','owned-'+randomUUID()),data=path.join(phase,'data');
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:bin+';C:\\Windows\\System32',TEMP:phase,TMP:phase,LANG:'C'};
const cmd=(file,args,stdio='pipe')=>execFileSync(file,args,{env,encoding:'utf8',windowsHide:true,timeout:30000,stdio,maxBuffer:1024*1024});
const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const lease=action=>{try{return cmd(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1',
  '-Name','integration','-Action',action,'-TaskFile','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json',
  '-RuntimeRoot','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4','-WaitSeconds','20','-OwnerToken',runId]);}catch(e){console.error('Lease phase refusal: '+String(e.stdout||e.stderr||e.code).trim());throw e;}};
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
  cmd(path.join(bin,'initdb.exe'),['-D',data,'-U','n44_local_admin','--pwfile',passwordFile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--no-instructions']);
  await unlink(passwordFile);
  await writeFile(path.join(data,'postgresql.auto.conf'),`listen_addresses='127.0.0.1'\nport=${port}\nshared_buffers='16MB'\nmax_connections=12\nlog_statement='none'\nlog_min_error_statement='panic'\nlog_parameter_max_length=0\nlog_parameter_max_length_on_error=0\nlog_connections=off\nlog_disconnections=off\nfsync=on\nsynchronous_commit=on\nfull_page_writes=on\n`);
  await new Promise(ok=>reservation.close(ok));reservation=null;
  control(['-D',data,'-l',path.join(phase,'server.log'),'-w','-t','20','start']);started=true;await prove();
  const config={host:'127.0.0.1',port,user:'n44_local_admin',password,database:'postgres',ssl:false,connectionTimeoutMillis:2000,
    statement_timeout:5000,query_timeout:8000,application_name:'n44-runtime-synthetic',max:3};
  admin=new Client(config);await admin.connect();
  const actual=(await admin.query("select current_setting('data_directory') as dir,inet_server_port() as port,version() as version")).rows[0];
  assert.equal(path.resolve(actual.dir),data);assert.equal(actual.port,port);assert.match(actual.version,/PostgreSQL 17\.6/);
  report.database='owned native PostgreSQL 17.6; synthetic source rows only';
  for(const file of ['tests/fixtures/n44-existing-host/canonical.sql','drafts/n44-push/schema-proposal.sql','drafts/n44-push/existing-host.inactive.sql','drafts/n44-push/canonical-source.inactive.sql'])await admin.query(await readFile(file,'utf8'));
  pool=new Pool({...config,max:4});
  pool.on('connect',client=>{void client.query('set role n44_backend');});
  if(denoExecutable) {
    const syntheticConfig=path.join(phase,'deno-config.json');
    await writeFile(syntheticConfig,JSON.stringify(config),{flag:'wx'});
    try {
      const output=cmd(denoExecutable,['run','--cached-only','--frozen','--config','supabase/functions/n44-notifications/deno.json',
        '--allow-env','--allow-net=127.0.0.1:'+port,'--allow-read='+syntheticConfig,'tests/n44-existing-host-deno.mjs',syntheticConfig]);
      assert.match(output,/N44 Deno composition PASS/);
      const local=JSON.parse(output.slice(output.indexOf('N44 Deno composition PASS ')+26).trim());report.cases=local.cases;report.checks.push(...local.checks);report.fabricatedPushAttempts=local.fabricatedPushAttempts;
      report.checks.push({name:'deno_existing_host_runtime_crypto_and_pg',status:'PASS',evidence:'Deno 2.2.12: same '+local.cases.length+' cases PASS; actual AuthClient/WebCrypto, portable P256, pg and audited encrypted sender; external network denied, sanitized environment, owned PG fixture only.'});
    }finally{await unlink(syntheticConfig);}
  } else await journey({pool,admin,report});
} catch(e) {
  failed=e;
  // No SQL/URL/token/body/error-detail capture. Keep factual initial assertion only.
  report.checks.push({name:'runtime_journey_execution',status:'FAIL',evidence:e.code==='ERR_ASSERTION'?'Assertion failed; inspect local test stack (no private values retained).':'Phase operation failed; no alternative invocation or live retry.'});
  console.error(e.code||e.name,e.stack?.split('\n').filter(x=>x.includes(' at ')).join('\n'));
} finally {
  try {if(pool)await pool.end();if(admin)await admin.end();if(reservation)await new Promise(ok=>reservation.close(ok));
    if(started){await prove();control(['-D',data,'-m','fast','-w','-t','20','stop']);started=false;report.cleanup.postgresStopped=true;
      const p=JSON.parse(cmd(ps,['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${identity.pid}';if($p){'true'}else{'false'}`]));assert.equal(p,false);report.cleanup.exactPidAbsent=true;}
    if(owned){report.cleanup.leaseRelease=lease('release').trim();owned=false;}
  }catch(e){failed??=e;report.cleanup.failure='Owned cleanup failed; no unrelated process touched';}
  report.cleanup.clusterFilesRetained=true; // Preserve evidence, no recursive removal.
  report.finishedAt=new Date().toISOString();report.sourceSha256={};
  const sourceFiles=['provider-policy','auth-verifier','backend','canonical-source','web-entry','web-protocol','cloudflare-entry','scheduler-entry','existing-host','node-globals','postgres-repository','runtime-gateway'];
  for(const file of [...sourceFiles.map(n=>'drafts/n44-push/'+n+'.mjs'),'drafts/n44-push/existing-host.inactive.sql','drafts/n44-push/canonical-source.inactive.sql','supabase/functions/n44-notifications/index.ts','supabase/functions/n44-notifications/deno.lock','drafts/n44-push/package-lock.json','tests/fixtures/n44-existing-host/journey.mjs','tests/fixtures/n44-existing-host/canonical.sql'])
    report.sourceSha256[file]=createHash('sha256').update((await readFile(file,'utf8')).replace(/\r\n/g,'\n')).digest('hex');
  if(failed)await writeFile('tests/n44-existing-host.failure-'+Date.now()+'.json',JSON.stringify(report,null,2)+'\n');
  await writeFile(denoExecutable?'tests/n44-existing-host.deno.result.json':'tests/n44-existing-host.result.json',JSON.stringify(report,null,2)+'\n');
}
if(failed)process.exitCode=1;else console.log('N44 existing host PASS; owned HTTP/PG/lease closed.');
