// Focused compatibility certification of the exact deployed N71 stage body.
// No live writes; only the new owned loopback PostgreSQL cluster is mutated.
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {planCloudRestore,PORTABLE_CLOUD_RESTORE_STORES} from '../src/lib/backup-v2.js';
const run=process.env.N71_RUN_ID;assert.match(run??'',/^[a-f0-9-]{36}$/);
const root=path.resolve('coverage/n71-live',run);
const binding=JSON.parse(await fs.readFile(path.join(root,'server-stage-binding.json'),'utf8'));
const shared='C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17';
const {Client}=createRequire(import.meta.url)(path.join(shared,'client/node_modules/pg/lib/index.js'));
const bin=path.join(shared,'package/native/bin'),exec=promisify(execFile);
const cluster=path.join(root,'created-at-pg-'+randomUUID()),log=path.join(root,'created-at-pg.log');
const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
const pgctl=args=>new Promise((resolve,reject)=>{const child=spawn(path.join(bin,'pg_ctl.exe'),args,{windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Owned pg_ctl exit '+code)));});
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const data={years:[{id:'year'}],terms:[{id:'term',yearId:'year',status:'active'}],subjects:[{id:'subject'}],
 sections:[{id:'section',yearId:'year'}],teachings:[{id:'teaching',sectionId:'section',subjectId:'subject',termId:'term'}],
 items:[{id:'item',teachingId:'teaching',name:'N94 history',max:10,scoreMode:'subitems',distributionMode:'manual',distributionVersion:1}],
 scoreSubitems:[{id:'definition',itemId:'item',name:'N94 criterion',value:10,order:0,distributionVersion:1,
  startDate:'2026-10-01',dueDate:'2026-10-10',latePoints:5,createdAt:Date.parse('2026-10-01T07:00:00Z')}]};
const plan=planCloudRestore({version:5,sourceOwnerId:A,data,baselines:{}},Object.fromEntries(PORTABLE_CLOUD_RESTORE_STORES.map(name=>[name,[]])),{ownerId:A,ownerHistoryRevision:'0'});
assert.equal(plan.ready,true,JSON.stringify(plan.entries));
const operation=plan.operations.find(op=>op.entity==='score_subitems');assert.equal(operation.patch.created_at,'2026-10-01T07:00:00.000Z');
let pg,started=false,result;
try{
 await exec(path.join(bin,'initdb.exe'),['-D',cluster,'-U','postgres','-A','trust','--encoding=UTF8','--no-locale'],{windowsHide:true});
 await pgctl(['-D',cluster,'-l',log,'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
 pg=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});await pg.connect();
 await pg.query(`create schema auth;create schema rakeezx;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table rakeezx.sync_restore_stages(owner_id uuid,restore_id text,backup_hash text,backup_version integer,stage_hash text,source_manifest jsonb,operations jsonb,state text default 'staged',finalized_at timestamptz);
 create table rakeezx.score_subitems(owner_id uuid,id text);
 create table rakeezx.items(owner_id uuid,id text,score_mode text);
 create function rakeezx.lock_student_lifecycle(uuid) returns void language sql as $$select$$;
 create function rakeezx.n71_restore_entities() returns text[] language sql as $$select array['score_subitems']::text[]$$;
 create function rakeezx.n71_restore_manifest(uuid) returns jsonb language sql as $$select '[]'::jsonb$$;
 create function rakeezx.sync_v2_field_map(text) returns jsonb language sql as $$select '${JSON.stringify(binding.subitemFieldMap)}'::jsonb$$;`);
 await pg.query(binding.stageDefinition);
 await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const stage=async(id,op,owner=A)=>pg.query('select rakeezx.stage_n71_restore($1,$2,5,$3::jsonb,$4::jsonb,$5::uuid) result',[id,'a'.repeat(64),'[]',JSON.stringify([op]),owner]);
 let nativeError;try{await stage('created-history',operation);}catch(error){nativeError={code:error.code,message:error.message};}
 assert.equal(nativeError?.code,'22023');assert.match(nativeError.message,/Unsupported V5 restore field/);
 assert.equal((await pg.query('select count(*)::int n from rakeezx.sync_restore_stages')).rows[0].n,0);
 await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
 await assert.rejects(stage('wrong-owner',operation,A),error=>error.code==='42501');
 await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const legacy=structuredClone(operation);delete legacy.patch.created_at;
 assert.equal((await stage('legacy-compatible',legacy)).rows[0].result.state,'staged');
 result={runId:run,nativeVersion:(await pg.query('select version()')).rows[0].version,
  stageDefinitionSha256:createHash('sha256').update(binding.stageDefinition).digest('hex'),appliedMigration:binding.migration,
  clientOperation:operation,nativeError,invalidRequestStageWrites:0,wrongOwner:'42501',legacyFieldsStillStage:true,
  compatibility:'FAIL: exact deployed stage rejects current-main backed-up N94 creation history before any stage write',
  scope:'Local disposable cluster only; helper fixtures isolate the deployed whitelist boundary; no live RPC/account/schema mutation',
  observedAt:new Date().toISOString()};
}finally{
 await pg?.end().catch(()=>{});if(started)await pgctl(['-D',cluster,'-m','fast','-w','stop']);
 const checked=path.resolve(cluster);assert.equal(checked,cluster);assert.ok(checked.startsWith(root+path.sep)&&path.basename(checked).startsWith('created-at-pg-'));
 await fs.rm(checked,{recursive:true,force:true});
}
await fs.writeFile(path.join(root,'created-at-native.json'),JSON.stringify({...result,ownedClusterStoppedAndRemoved:true},null,2));
console.log(JSON.stringify({compatibility:result.compatibility,nativeError:result.nativeError,ownedClusterStoppedAndRemoved:true}));
