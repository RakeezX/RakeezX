/** AI: extracted owned native PG lifecycle; no hosted connection or service changes. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,unlink,rm} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
export const canonicalRoot='C:/Users/Abody/Projects/RakeezX';
const bin=canonicalRoot+'/artifacts/n77-native-pg17/package/native/bin';
export const powershell='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
export function processIdentity(pid) {
  assert.ok(Number.isSafeInteger(pid)&&pid>0);
  return JSON.parse(execFileSync(powershell,['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($p){@{pid=$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;commandLine=$p.CommandLine}|ConvertTo-Json -Compress}else{'null'}`],{encoding:'utf8',windowsHide:true,timeout:10000}));
}
export async function startNativePg(root) {
  const {Client,Pool}=createRequire(import.meta.url)(canonicalRoot+'/artifacts/n77-native-pg17/client/node_modules/pg');
  const parent=path.join(root,'tests/fixtures/n88-integrated-class'),phase=path.join(parent,'owned-'+randomUUID()),data=path.join(phase,'data');
  await mkdir(phase,{recursive:false});
  const marker={pid:process.pid,birth:processIdentity(process.pid).birth,data};
  await writeFile(path.join(phase,'owner.json'),JSON.stringify(marker),{flag:'wx'});
  const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:bin+';C:\\Windows\\System32',TEMP:phase,TMP:phase,LANG:'C'};
  const cmd=(file,args,stdio='pipe')=>execFileSync(file,args,{env,encoding:'utf8',windowsHide:true,timeout:30000,stdio,maxBuffer:1024*1024});
  const control=args=>cmd(path.join(bin,'pg_ctl.exe'),args,'ignore');
  let started=false,admin,pool,reservation,identity,closed=false;
  async function prove() {
    assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),marker);
    const lines=(await readFile(path.join(data,'postmaster.pid'),'utf8')).split(/\r?\n/);
    assert.equal(path.resolve(lines[1]),data);
    const info=processIdentity(Number(lines[0]));
    assert.ok(info);assert.equal(info.executable.toLowerCase().replaceAll('\\','/'),(bin+'/postgres.exe').toLowerCase());
    assert.ok(info.commandLine.replaceAll('/','\\').includes(data));
    if(identity)assert.deepEqual(info,identity);else identity=info;
  }
  async function close() {
    if(closed)return;
    await pool?.end();await admin?.end();
    if(reservation)await new Promise(ok=>reservation.close(ok));
    // pg_ctl targets this exact verified data directory; never kill by name/PID alone.
    if(started){await prove();control(['-D',data,'-m','fast','-w','-t','20','stop']);started=false;assert.equal(processIdentity(identity.pid),null);}
    assert.deepEqual(JSON.parse(await readFile(path.join(phase,'owner.json'),'utf8')),marker);
    assert.equal(path.dirname(phase),parent);assert.ok(path.basename(phase).startsWith('owned-'));
    await rm(phase,{recursive:true});closed=true;
  }
  try {
    reservation=net.createServer();await new Promise((ok,fail)=>{reservation.once('error',fail);reservation.listen(0,'127.0.0.1',ok);});
    const port=reservation.address().port,password=randomBytes(32).toString('hex'),passwordFile=path.join(phase,'password.tmp');
    await writeFile(passwordFile,password,{flag:'wx'});
    try {cmd(path.join(bin,'initdb.exe'),['-D',data,'-U','n88_local_admin','--pwfile',passwordFile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C','--no-instructions']);}
    finally {await unlink(passwordFile);}
    await writeFile(path.join(data,'postgresql.auto.conf'),`listen_addresses='127.0.0.1'\nport=${port}\nshared_buffers='16MB'\nmax_connections=12\nlog_statement='none'\nlog_min_error_statement='panic'\nlog_parameter_max_length=0\nlog_parameter_max_length_on_error=0\nlog_connections=off\nlog_disconnections=off\nfsync=on\nsynchronous_commit=on\nfull_page_writes=on\n`);
    await new Promise(ok=>reservation.close(ok));reservation=null;
    control(['-D',data,'-l',path.join(phase,'server.log'),'-w','-t','20','start']);started=true;await prove();
    const config={host:'127.0.0.1',port,user:'n88_local_admin',password,database:'postgres',ssl:false,connectionTimeoutMillis:2000,statement_timeout:5000,query_timeout:8000,max:4};
    admin=new Client(config);await admin.connect();
    const actual=(await admin.query("select current_setting('data_directory') as dir,inet_server_port() as port,version() as version")).rows[0];
    assert.equal(path.resolve(actual.dir),data);assert.equal(actual.port,port);assert.match(actual.version,/PostgreSQL 17\.6/);
    await admin.query(await readFile(path.join(root,'tests/fixtures/n88-activation/canonical.sql'),'utf8'));
    await admin.query(await readFile(path.join(parent,'canonical-extension.sql'),'utf8'));
    await admin.query('set role postgres');
    await admin.query(await readFile(path.join(root,'supabase/migrations/20261018034356_n88_exact_activation_staged.sql'),'utf8'));
    await admin.query(await readFile(path.join(root,'supabase/migrations/20261018102843_n88_integrated_class_staged.sql'),'utf8'));
    await admin.query('reset role');
    await admin.query(await readFile(path.join(parent,'seed.sql'),'utf8'));
    pool=new Pool(config);
    return {phase,identity,port,close,fixtureQuery:(...a)=>admin.query(...a),async acquire(){const c=await pool.connect();try{await c.query('set role n88_backend');return {query:(...a)=>c.query(...a),release:e=>c.release(e)};}catch(e){c.release(e);throw e;}}};
  } catch(e) {await close();throw e;}
}
