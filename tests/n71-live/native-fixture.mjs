// AI: exact deployed N71 stage/finalize + additive creation-history roundtrip.
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
export async function withNativeRestore(callback){
const run=process.env.N71_RUN_ID;assert.match(run??'',/^[a-f0-9-]{36}$/);
const root=path.resolve('coverage/n71-live',run),binding=JSON.parse(await fs.readFile('coverage/n71-live/eac6bb16-dfe9-4d72-bafe-866e21ebe767/server-history-before.json','utf8'));
const schema=JSON.parse(await fs.readFile('coverage/n71-current/live-schema.json','utf8'));
// Refresh only the affected table from this run's actual catalog readback.
schema.tables.find(t=>t.name==='score_subitems').columns=binding.subitemColumns;
const migrationFile='supabase/migrations/20261013110000_n71_restore_creation_history.sql';
const sql=await fs.readFile(migrationFile,'utf8'),hash=v=>createHash('sha256').update(v).digest('hex');
const shared='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const {Client}=createRequire(import.meta.url)(path.join(shared,'client/node_modules/pg/lib/index.js'));
const bin=path.join(shared,'package/native/bin'),exec=promisify(execFile);
const cluster=path.join(root,'preflight-pg-'+randomUUID()),log=path.join(root,'preflight-pg.log');
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const pgctl=args=>new Promise((resolve,reject)=>{const c=spawn(path.join(bin,'pg_ctl.exe'),args,{windowsHide:true,stdio:'ignore'});c.on('error',reject);c.on('exit',code=>code===0?resolve():reject(Error('Owned pg_ctl '+code)));});
const q=v=>'"'+v.replaceAll('"','""')+'"',A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
await fs.mkdir(root,{recursive:true});let pg,started=false;
try{
 await exec(path.join(bin,'initdb.exe'),['-D',cluster,'-U','postgres','-A','trust','--encoding=UTF8','--no-locale'],{windowsHide:true});
 await pgctl(['-D',cluster,'-l',log,'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
 pg=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});await pg.connect();
 await pg.query(`create schema auth;create schema rakeezx;create schema realtime;create role authenticated;create role anon;create role service_role;
 create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;set check_function_bodies=off;`);
 for(const t of schema.tables)await pg.query(`create table rakeezx.${q(t.name)} (${t.columns.map(c=>`${q(c.name)} ${c.type}${c.notnull?' not null':''}${c.default?' default '+c.default:''}`).join(',')})`);
 for(const foreign of [false,true])for(const t of schema.tables)for(const c of t.constraints??[])if(c.sql.startsWith('FOREIGN KEY')===foreign)await pg.query(`alter table rakeezx.${q(t.name)} add constraint ${q(c.name)} ${c.sql}`);
 for(const f of schema.functions)await pg.query(f.sql);
 for(const t of schema.tables)for(const trigger of t.triggers??[])await pg.query(trigger);
 for(const idx of schema.indexes)if(idx.includes(' UNIQUE ')&&idx.includes(' WHERE '))await pg.query(idx);
 await pg.query(await fs.readFile('supabase/migrations/20261012163000_n71_unified_restore.sql','utf8'));
 for(const f of binding.functions)await pg.query(f.definition);
 for(const f of binding.triggers.triggers)await pg.query(f.definition);
 const current=JSON.parse(await fs.readFile('coverage/n71-live/eac6bb16-dfe9-4d72-bafe-866e21ebe767/server-history-after.json','utf8'));
 for(const f of current.functions)await pg.query(f.definition);
 await pg.query('insert into auth.users values($1),($2)',[A,B]);
 await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);

 return await callback(pg,A);
}finally{
 await pg?.end().catch(()=>{});if(started)await pgctl(['-D',cluster,'-m','fast','-w','stop']);
 const checked=path.resolve(cluster);assert.ok(checked.startsWith(root+path.sep)&&path.dirname(checked)===root&&path.basename(checked).startsWith('preflight-pg-'));await fs.rm(checked,{recursive:true,force:true});
}
}
