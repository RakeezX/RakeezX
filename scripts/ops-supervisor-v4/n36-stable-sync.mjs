import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const ROOT='C:/Users/Abody/Projects/RakeezX';
const BASE=ROOT+'/artifacts/private-tools/n36-current';
const HEX=/^[a-f0-9]{40}$/;
const ID=/^continuous-n36-[a-z0-9-]{8,140}$/;
const ver=v=>/^0\.5\.\d+$/.test(v??'')?Number(v.split('.')[2]):null;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
export function eligibleRelease(t) {
 const d=t?.deliveryReceipt,b=d?.binding;
 if(t?.productId!=='N36'||t.status!=='awaiting_po'||!ID.test(t.id??'')||d?.taskId!==t.id||d.ticketId!=='N36'
   ||d.status!=='deployed'||d.productionDeployed!==true||d.provider?.status!=='completed'||d.provider?.conclusion!=='success'
   ||!HEX.test(d.publishedSha??'')||d.provider.headSha!==d.publishedSha||!Number.isFinite(Date.parse(d.verifiedAt))
   ||d.evidence?.immutable?.passed!==true||d.evidence?.production?.passed!==true
   ||d.candidateSha!==t.candidateSha||d.baseSha!==t.baseSha||b?.candidateSha!==t.candidateSha||b?.publishedSha!==d.publishedSha) return null;
 const paths=new Set([...(d.changedPaths??[]),...(d.changedAssets??[])]);
 const versions=[...paths].flatMap(p=>{const m=/^assets\/extensions\/rakeez-teacher-import-helper-(0\.5\.\d+)\.zip$/.exec(p);return m?[m[1]]:[];});
 const valid=versions.filter(v=>{
  const stem='assets/extensions/rakeez-teacher-import-helper-'+v;
  return ['.zip','.manifest.json'].every(ext=>paths.has(stem+ext)&&['immutable','production'].every(scope=>{
   const a=d.evidence[scope].assets?.find(a=>a.repoPath===stem+ext);
   return a?.verified===true&&a.statusCode===200&&/^[a-f0-9]{64}$/.test(a.expectedSha256??'')&&a.expectedSha256===a.observedSha256;
  }));
 });
 const version=valid.sort((a,b)=>ver(b)-ver(a))[0];
 return version?{taskId:t.id,version,publishedSha:d.publishedSha,verifiedAt:d.verifiedAt}:null;
}
export function chooseRelease(tasks,current) {
 const candidates=tasks.map(eligibleRelease).filter(Boolean).sort((a,b)=>ver(b.version)-ver(a.version)||Date.parse(b.verifiedAt)-Date.parse(a.verifiedAt));
 const selected=candidates[0];if(!selected)return {status:'NO_VERIFIED_RELEASE'};
 if(ver(current?.version)!==null&&ver(current.version)>ver(selected.version))return {status:'NO_DOWNGRADE'};
 if(current?.version===selected.version)return {status:'ALREADY_CURRENT',version:current.version};
 return {status:'UPDATE_REQUIRED',...selected};
}
export async function syncOnce({root=ROOT,now=Date.now,execute=execFileSync}={}) {
 const base=root+'/artifacts/private-tools/n36-current',queue=root+'/artifacts/ops-supervisor-v4/queue';
 if(fs.existsSync(base+'/update.lock.json'))return {status:'UPDATER_BUSY'};
 const tasks=fs.readdirSync(queue).filter(n=>n.endsWith('.json')).flatMap(n=>{try{return [read(path.join(queue,n))]}catch{return []}});
 const current=read(base+'/STABLE_CURRENT.json'),decision=chooseRelease(tasks,current);
 if(decision.status!=='UPDATE_REQUIRED')return decision;
 const failurePath=base+'/AUTO_SYNC_FAILURE.json';let failure;try{failure=read(failurePath)}catch{}
 if(failure?.taskId===decision.taskId&&failure.version===decision.version&&now()<failure.retryAfter)return {status:'RETRY_LATER',version:decision.version};
 try {
  const output=execute(process.execPath,[base+'/update-stable.mjs','--version',decision.version,'--task',decision.taskId,'--apply'],{encoding:'utf8',windowsHide:true,timeout:110000,maxBuffer:200000});
  const after=read(base+'/STABLE_CURRENT.json');
  if(after.version!==decision.version||after.sourceTaskId!==decision.taskId||after.publishedSha!==decision.publishedSha)throw Error('Receipt mismatch');
  const result={status:'UPDATED',version:after.version,taskId:decision.taskId,publishedSha:decision.publishedSha,at:new Date(now()).toISOString(),chromeReloaded:false};
  fs.writeFileSync(base+'/AUTO_SYNC_LAST_UPDATE.json',JSON.stringify(result,null,2)+'\n');
  if(fs.existsSync(failurePath))fs.unlinkSync(failurePath);
  return result;
 }catch{
  const attempts=failure?.taskId===decision.taskId?Math.min((failure.attempts??0)+1,6):1;
  const pauseMinutes=Math.min(2**(attempts-1),30);
  const result={status:'UPDATE_FAILED_PRESERVED',taskId:decision.taskId,version:decision.version,attempts,retryAfter:now()+pauseMinutes*60000,at:new Date(now()).toISOString()};
  fs.writeFileSync(failurePath,JSON.stringify(result,null,2)+'\n');
  return result;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv.slice(2).join(' ')!=='--once'){process.stderr.write('Usage: node n36-stable-sync.mjs --once\n');process.exitCode=2;}
 else try{const result=await syncOnce();fs.writeFileSync(BASE+'/AUTO_SYNC_HEALTH.json',JSON.stringify({...result,checkedAt:new Date().toISOString(),scope:'verified-local-files-only',chromeReloaded:false},null,2)+'\n');if(result.status==='UPDATED'||result.status==='UPDATE_FAILED_PRESERVED')process.stdout.write(JSON.stringify(result)+'\n');}
 catch{process.stderr.write('N36_AUTO_SYNC_FAILED_SAFE\n');process.exitCode=1;}
}
