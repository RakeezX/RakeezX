/** AI: one owned native PG SCRAM challenge-equality proof; no hosted operation. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {deriveScram} from '../scripts/n44-activation-custody.mjs';
import {expectedKeys,challengeSql,comparisonSql,validateComparison} from '../scripts/n44-activation-equality.mjs';
const runId='4c096417-b07a-4bc5-b8c1-538c9d9b1260',taskId='continuous-n44-finish-bounded-service-activation-20261018';
const bin='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/package/native/bin';
const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
const phase=path.resolve('tests/fixtures/n44-finish','owned-'+randomUUID()),data=path.join(phase,'data'),log=path.join(phase,'server.log');
const passwordFile=path.join(phase,'password.tmp');
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:bin+';C:\\Windows\\System32',TEMP:phase,TMP:phase,LANG:'C'};
const cmd=(f,a,stdio='pipe')=>execFileSync(f,a,{env,encoding:'utf8',windowsHide:true,timeout:30000,stdio,maxBuffer:1048576});
const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const lease=a=>cmd(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',a,'-TaskFile','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-RuntimeRoot','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId]);
const report={aiAuthored:true,taskId,runId,recordedAt:new Date().toISOString(),scope:'Fresh owned native PG17.6 synthetic SCRAM equality only; no canonical schema, migrations or old suite.',hostedAuthenticationAttempts:0,cleanup:{}};
let owned=false,started=false,reservation,admin,client,identity,keys,wrongKeys,password,rolePassword;
await mkdir(phase,{recursive:false});
const marker={runId,token:randomUUID(),runnerPid:process.pid,data};await writeFile(path.join(phase,'owner.json'),JSON.stringify(marker),{flag:'wx'});
const control=a=>cmd(path.join(bin,'pg_ctl.exe'),a,'ignore');
async function prove(){
 assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),marker);
 const p=(await readFile(path.join(data,'postmaster.pid'),'utf8')).split(/\r?\n/);assert.equal(path.resolve(p[1]),data);
 const info=JSON.parse(cmd(ps,['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(p[0])}';if($p){@{pid=$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;commandLine=$p.CommandLine}|ConvertTo-Json -Compress}else{'null'}`]));
 assert.ok(info);assert.equal(info.executable.toLowerCase().replaceAll('\\','/'),(bin+'/postgres.exe').toLowerCase());
 assert.ok(info.commandLine.replaceAll('/','\\').includes(data));if(identity)assert.deepEqual(info,identity);else identity=info;
}
try{
 assert.match(lease('acquire').trim(),/^(ACQUIRED|ALREADY OWNED) integration$/);owned=true;
 reservation=net.createServer();await new Promise((ok,fail)=>{reservation.once('error',fail);reservation.listen(0,'127.0.0.1',ok);});
 const port=reservation.address().port;password=randomBytes(32).toString('hex');rolePassword=randomBytes(32).toString('hex');
 await writeFile(passwordFile,password,{flag:'wx'});
 cmd(path.join(bin,'initdb.exe'),['-D',data,'-U','n44_local_admin','--pwfile',passwordFile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--no-instructions']);await unlink(passwordFile);
 await writeFile(path.join(data,'postgresql.auto.conf'),`listen_addresses='127.0.0.1'\nport=${port}\nshared_buffers='16MB'\nmax_connections=8\nlog_statement='ddl'\nlog_min_error_statement='error'\nlog_error_verbosity='default'\nlog_parameter_max_length_on_error=0\n`);
 await new Promise(ok=>reservation.close(ok));reservation=null;
 control(['-D',data,'-l',log,'-w','-t','20','start']);started=true;await prove();
 const config={host:'127.0.0.1',port,database:'postgres',connectionTimeoutMillis:2000,query_timeout:5000};
 admin=new Client({...config,user:'n44_local_admin',password});await admin.connect();
 const actual=(await admin.query("select version() as version,current_setting('data_directory') as dir")).rows[0];assert.match(actual.version,/PostgreSQL 17\.6/);assert.equal(path.resolve(actual.dir),data);
 await admin.query(`create role n44_service_login login nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit password '${deriveScram(rolePassword)}'`);
 client=new Client({...config,user:'n44_service_login',password:rolePassword});await client.connect();
 assert.equal((await client.query('select current_user as role')).rows[0].role,'n44_service_login');await client.end();client=null;
 report.nativeScramLogin=true;
 await admin.query('alter role n44_service_login nologin');
 const challenge=(await admin.query(challengeSql)).rows[0];keys=expectedKeys(rolePassword,challenge);
 report.correct=validateComparison((await admin.query(comparisonSql(keys,challenge))).rows);
 assert.equal(report.correct.storedKeyMatchesRecoveredCredential,true);assert.equal(report.correct.serverKeyMatchesRecoveredCredential,true);
 wrongKeys=expectedKeys('0'.repeat(64)===rolePassword?'1'.repeat(64):'0'.repeat(64),challenge);
 report.wrong=validateComparison((await admin.query(comparisonSql(wrongKeys,challenge))).rows);
 assert.equal(report.wrong.storedKeyMatchesRecoveredCredential,false);assert.equal(report.wrong.serverKeyMatchesRecoveredCredential,false);
 const logs=await readFile(log,'utf8');report.rawPasswordsAbsentFromServerLog=!logs.includes(rolePassword)&&!logs.includes(password);assert.equal(report.rawPasswordsAbsentFromServerLog,true);
 report.fixedOwnRoleOnly=challengeSql.includes("rolname='n44_service_login'")&&!/select\s+rolpassword\s+from/i.test(challengeSql);
 assert.equal(report.fixedOwnRoleOnly,true);
 report.sourceSha256=createHash('sha256').update(await readFile('scripts/n44-activation-equality.mjs')).digest('hex');
 report.status='PASS';
}catch(e){report.status='FAIL';report.failure='n44_local_equality_failed_private_details_suppressed';report.failureLocation=e.stack?.split('\n').find(s=>s.includes('.mjs:'))?.replace(/.*\((.*)\).*/, '$1');process.exitCode=1;}
finally{
 keys?.stored.fill(0);keys?.server.fill(0);wrongKeys?.stored.fill(0);wrongKeys?.server.fill(0);
 try{await client?.end();await admin?.end();if(reservation)await new Promise(ok=>reservation.close(ok));if(started){await prove();control(['-D',data,'-m','fast','-w','-t','20','stop']);report.cleanup.postgresStopped=true;}}
 catch{report.status='FAIL';report.cleanup.failure='Owned PG cleanup failed; no broad kill/delete used';process.exitCode=1;}
 finally{
  try{if(owned){report.cleanup.leaseReleased=lease('release').trim()==='RELEASED integration';}}
  catch{report.status='FAIL';report.cleanup.leaseReleased=false;process.exitCode=1;}
 }
 // Only exact owned transient inputs/log; no recursive deletion. DDL audit was kept enabled.
 for(const f of [passwordFile,...(report.cleanup.postgresStopped?[log]:[])])await unlink(f).catch(e=>{if(e.code!=='ENOENT')throw e;});
 password=null;rolePassword=null;report.cleanup.syntheticDdlLogNotCopiedToEvidence=report.cleanup.postgresStopped===true;
 report.phase=phase;report.cleanup.stoppedClusterRetained=true;
 await writeFile('tests/n44-finish-scram-equality.local.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
