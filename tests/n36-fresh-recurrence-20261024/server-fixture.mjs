// AI-authored: disposable native PostgreSQL; existing provisioning contract only.
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
const exec=promisify(execFile), shared='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const {default:pg}=await import(pathToFileURL(shared+'/client/node_modules/pg/lib/index.js'));
export async function provisioningServer(){
 const cluster=path.resolve('tests/n36-fresh-recurrence-20261024/runtime-'+randomUUID());
 const bin=n=>path.join(shared,'package/native/bin',n+'.exe');
 const ctl=args=>new Promise((resolve,reject)=>{const child=spawn(bin('pg_ctl'),args,{windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('exit',c=>c===0?resolve():reject(Error('pg_ctl '+c)));});
 let client,started=false,serial=Promise.resolve();const hashes={};
 const close=async()=>{await serial.catch(()=>{});await client?.end();if(started)await ctl(['-D',cluster,'-m','fast','-w','stop']);if(!cluster.startsWith(path.resolve('tests/n36-fresh-recurrence-20261024')+path.sep))throw Error('Owned cluster path mismatch');await fs.rm(cluster,{recursive:true,force:true});};
 try{
  await fs.mkdir(cluster,{recursive:true});
  const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  await exec(bin('initdb'),['-D',cluster,'-U','postgres','-A','trust','--encoding=UTF8','--no-locale'],{windowsHide:true,timeout:30000});
  await ctl(['-D',cluster,'-l',path.join(cluster,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
  client=new pg.Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});await client.connect();
  await client.query(`create schema auth;create schema realtime;create role authenticated;create role anon;create role service_role;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable security definer set search_path='' as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;
   create table realtime.messages(extension text,topic text);alter table realtime.messages enable row level security;
   create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
   create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;`);
  // Same historical service dependencies as the existing N117 qualification.
  const saved=['20261004070000_n58_calendar_persistence.sql','20261004070001_n58_extra_term_compatibility.sql','20261004070002_n58_effective_scope_revalidation.sql'];
  for(const file of [...new Set([...await fs.readdir('supabase/migrations'),...saved])].sort().filter(x=>/^\d+.*\.sql$/.test(x)&&!/_n(?:88|44)_/.test(x))){
   const sql=(saved.includes(file)?(await exec('git',['show','4fa6fb8b98415a42dd0a835bfdd7038ab65b8979:supabase/migrations/'+file],{windowsHide:true,maxBuffer:20000000})).stdout:await fs.readFile('supabase/migrations/'+file,'utf8')).replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
   if(file==='20261014090000_n100_automatic_safe_copy.sql')for(const row of JSON.parse(await fs.readFile('tests/n100-automatic-provider-source.json','utf8')))await client.query(row.definition);
   hashes[file]=createHash('sha256').update(sql).digest('hex');await client.query(sql);
  }
  const rpc=(owner,name,args=[])=>{const job=serial.then(async()=>{await client.query('set role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);try{return (await client.query(`select rakeezx.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;}finally{await client.query('reset role');}});serial=job.catch(()=>{});return job;};
  return {hashes,close,rpc,async newOwner(owner){const job=serial.then(async()=>{await client.query('reset role');await client.query('insert into auth.users(id,email) values($1,$2)',[owner,'synthetic@example.invalid']);});serial=job.catch(()=>{});return job;}};
 }catch(e){await close();throw e;}
}
