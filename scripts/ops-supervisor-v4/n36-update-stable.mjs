import {approvedPackageBoundary} from './n36-extension-package-policy.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {inflateRawSync} from 'node:zlib';
const repo='C:/Users/Abody/Projects/RakeezX',base=repo+'/artifacts/private-tools/n36-current',runtime=base+'/runtime',rt=repo+'/artifacts/ops-supervisor-v4';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const insist=(v,m)=>{if(!v)throw Error('N36_STABLE_UPDATE: '+m)};
const args=process.argv.slice(2),apply=args.includes('--apply');
const named=n=>{const i=args.indexOf(n);return i<0?null:args[i+1]};
let version=named('--version'),taskId=named('--task');
const token=randomUUID(),lockPath=base+'/update.lock.json',owner=JSON.stringify({owner:'n36-stable-updater',token,pid:process.pid,at:new Date().toISOString()}),changed=[],created=[];
let locked=false,backup=null,prior=null,priorBytes=null,oldReceiptBytes=null,newFiles=null;
function cleanName(n){insist(typeof n==='string'&&n.length<181&&!/[\\:\x00-\x1f<>|"*?]/.test(n)&&!n.startsWith('/')&&!n.split('/').some(s=>!s||s==='.'||s==='..'||/[. ]$/.test(s)||/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(s)),'unsafe package path');return n}
function noLink(p){for(let q=p;;q=path.dirname(q)){if(fs.existsSync(q))insist(!fs.lstatSync(q).isSymbolicLink(),'symlink/junction '+q);const parent=path.dirname(q);if(parent===q)break}}
function list(dir,prefix=''){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const rel=prefix+e.name,full=path.join(dir,e.name);insist(!fs.lstatSync(full).isSymbolicLink(),'linked runtime entry');if(e.isDirectory())out.push(...list(full,rel+'/'));else{insist(e.isFile(),'unsupported runtime entry');out.push(rel)}}return out.sort()}
function checkFolder(dir,files,v){noLink(dir);const expected=files.map(f=>cleanName(f.file)).sort();insist(expected.length>=15&&expected.length<=40&&new Set(expected.map(n=>n.toLowerCase())).size===expected.length,'file set');insist(JSON.stringify(list(dir))===JSON.stringify(expected),'unknown/missing local files; preserving user edits');for(const f of files){const b=fs.readFileSync(path.join(dir,f.file));insist(sha(b)===f.sha256&&b.length===f.bytes,'content drift '+f.file)}insist(json(path.join(dir,'manifest.json')).version===v,'version mismatch')}
function proof(t){const d=t?.deliveryReceipt,b=d?.binding;insist(t?.productId==='N36'&&t.status==='awaiting_po'&&d?.status==='deployed'&&d.provider?.conclusion==='success'&&d.provider?.status==='completed'&&d.provider.headSha===d.publishedSha&&d.evidence?.immutable?.passed===true&&d.evidence?.production?.passed===true&&/^[a-f0-9]{40}$/.test(d.publishedSha)&&Number.isFinite(Date.parse(d.verifiedAt)),'provider and served-source proof missing');insist(d.candidateSha===t.candidateSha&&d.baseSha===t.baseSha&&b?.candidateSha===t.candidateSha&&b?.publishedSha===d.publishedSha,'candidate publication binding');return d}
function gitBlob(sha,p){return execFileSync('C:/Program Files/Git/cmd/git.exe',['-C',repo,'show',sha+':'+p],{timeout:15000,windowsHide:true,maxBuffer:4000000})}
async function download(url){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});insist(r.ok,'download status '+r.status);const b=Buffer.from(await r.arrayBuffer());insist(b.length<=2000000,'package size');return b}
function unzip(zip,manifest){const files=new Map(manifest.files.map(f=>[cleanName(f.file),f])),out=new Map();let end=-1;
 for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50){end=i;break}
 insist(end>=0&&zip.readUInt16LE(end+4)===0&&zip.readUInt16LE(end+6)===0,'zip end/disks');
 const count=zip.readUInt16LE(end+10),offset=zip.readUInt32LE(end+16),size=zip.readUInt32LE(end+12);
 insist(zip.readUInt16LE(end+8)===count&&count===files.size&&offset+size===end&&end+22+zip.readUInt16LE(end+20)===zip.length,'zip directory');
 let cursor=offset,total=0;
 for(let i=0;i<count;i++){insist(cursor+46<=end&&zip.readUInt32LE(cursor)===0x02014b50,'zip entry');const flags=zip.readUInt16LE(cursor+8),method=zip.readUInt16LE(cursor+10),compressed=zip.readUInt32LE(cursor+20),length=zip.readUInt32LE(cursor+24),nl=zip.readUInt16LE(cursor+28),el=zip.readUInt16LE(cursor+30),cl=zip.readUInt16LE(cursor+32),attrs=zip.readUInt32LE(cursor+38),local=zip.readUInt32LE(cursor+42);
  insist(cursor+46+nl+el+cl<=end&&!(flags&1)&&[0,8].includes(method)&&((attrs>>>16)&0xf000)!==0xa000,'unsupported zip entry');
  const name=cleanName(zip.subarray(cursor+46,cursor+46+nl).toString('utf8')),f=files.get(name);insist(f&&!out.has(name)&&length===f.bytes&&length<=2000000,'unexpected zip file');
  insist(local+30<=offset&&zip.readUInt32LE(local)===0x04034b50&&zip.readUInt16LE(local+8)===method,'zip local header');
  const ln=zip.readUInt16LE(local+26),le=zip.readUInt16LE(local+28),start=local+30+ln+le;insist(start+compressed<=offset&&zip.subarray(local+30,local+30+ln).toString('utf8')===name,'zip bounds/name');
  const input=zip.subarray(start,start+compressed),b=method===0?Buffer.from(input):inflateRawSync(input,{maxOutputLength:Math.max(1,length)});total+=b.length;
  insist(total<=4000000&&b.length===length&&sha(b)===f.sha256,'zip file hash');out.set(name,b);cursor+=46+nl+el+cl}
 insist(cursor===end&&out.size===files.size,'zip trailing entries');return out}
try{
 noLink(base);noLink(runtime);fs.writeFileSync(lockPath,owner,{flag:'wx'});locked=true;
 if(!taskId){const candidates=fs.readdirSync(rt+'/queue').filter(n=>n.endsWith('.json')).flatMap(n=>{try{const t=json(rt+'/queue/'+n);if(t.productId==='N36'&&t.status==='awaiting_po'&&t.deliveryReceipt?.status==='deployed'&&t.deliveryReceipt.changedAssets?.some(p=>/rakeez-teacher-import-helper-0\.5\.\d+\.zip$/.test(p)))return[t];}catch{}return[]}).sort((a,b)=>Date.parse(b.deliveryReceipt.verifiedAt)-Date.parse(a.deliveryReceipt.verifiedAt));insist(candidates.length,'no verified extension release');taskId=candidates[0].id;version??=candidates[0].deliveryReceipt.changedAssets.find(p=>/rakeez-teacher-import-helper-0\.5\.\d+\.zip$/.test(p)).match(/helper-(0\.5\.\d+)\.zip$/)[1]}
 insist(/^continuous-n36-[a-z0-9-]{8,140}$/.test(taskId??'')&&/^0\.5\.\d+$/.test(version??''),'task/version arguments');
 const taskPath=rt+'/queue/'+taskId+'.json',task=json(taskPath),d=proof(task),stem='rakeez-teacher-import-helper-'+version,mp='assets/extensions/'+stem+'.manifest.json',zp='assets/extensions/'+stem+'.zip';
 const manifestBytes=gitBlob(d.publishedSha,mp),pinnedZip=gitBlob(d.publishedSha,zp),manifest=JSON.parse(manifestBytes);
 for(const [p,b]of[[mp,manifestBytes],[zp,pinnedZip]]){const a=d.evidence.production.assets.find(a=>a.repoPath===p);insist(a?.verified&&a.expectedSha256===sha(b)&&a.observedSha256===sha(b),'served asset binding '+p)}
 insist(manifest.schema==='rakeez-private-extension-package'&&manifest.version===version&&manifest.archive.file===stem+'.zip'&&manifest.archive.sha256===sha(pinnedZip)&&manifest.archive.bytes===pinnedZip.length,'package identity');
 console.log('N36 update: verifying public package '+version);
 const [publicManifest,publicZip]=await Promise.all([download('https://rakeezx.com/'+mp),download('https://rakeezx.com/'+zp)]);
 insist(publicManifest.equals(manifestBytes)&&publicZip.equals(pinnedZip),'public package changed from verified release');
 newFiles=unzip(publicZip,manifest);const extensionManifest=JSON.parse(newFiles.get('manifest.json'));
 insist(extensionManifest.version===version&&approvedPackageBoundary(extensionManifest),'permissions/CSP changed');
 oldReceiptBytes=fs.readFileSync(base+'/STABLE_CURRENT.json');prior=JSON.parse(oldReceiptBytes);checkFolder(runtime,prior.files,prior.version);insist(Number(version.split('.')[2])>=Number(prior.version.split('.')[2]),'downgrade refused');
 const oldNames=new Set(prior.files.map(f=>f.file));insist(prior.files.every(f=>newFiles.has(f.file)),'release removes/renames installed files');
 for(const [name]of newFiles)if(!oldNames.has(name)){insist(!fs.existsSync(path.join(runtime,name))&&fs.statSync(path.dirname(path.join(runtime,name))).isDirectory(),'new path collision/directory')}
 if(!apply)console.log(JSON.stringify({status:'VERIFIED_PREVIEW_ONLY',version,oldVersion:prior.version,files:newFiles.size,archiveSha256:sha(publicZip),publishedSha:d.publishedSha,target:runtime,chromeReloadRequired:true}));
 else if(prior.version===version&&manifest.files.every(f=>prior.files.some(o=>o.file===f.file&&o.sha256===f.sha256)))console.log(JSON.stringify({status:'ALREADY_CURRENT',version,target:runtime,files:newFiles.size,chromeReloadRequired:true}));
 else{
  checkFolder(runtime,prior.files,prior.version);insist(proof(json(taskPath)).publishedSha===d.publishedSha,'publication changed');
  backup=base+'/runtime-backup-before-'+version+'-'+token;fs.mkdirSync(backup);priorBytes=new Map();
  for(const f of prior.files){const b=fs.readFileSync(path.join(runtime,f.file));priorBytes.set(f.file,b);const dst=path.join(backup,f.file);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,b,{flag:'wx'})}checkFolder(backup,prior.files,prior.version);
  // Explicitly authorized disk update; Chrome keeps running. User performs Reload after complete verification.
  const plan=[...newFiles.keys()].filter(n=>n!=='manifest.json').concat('manifest.json');
  for(const name of plan){const dst=path.join(runtime,name),b=newFiles.get(name);if(oldNames.has(name)){if(sha(fs.readFileSync(dst))===sha(b))continue;insist(fs.readFileSync(dst).equals(priorBytes.get(name)),'concurrent file edit '+name);changed.push(name);fs.writeFileSync(dst,b)}else{created.push(name);fs.writeFileSync(dst,b,{flag:'wx'})}insist(fs.readFileSync(dst).equals(b),'destination verification '+name)}
  checkFolder(runtime,manifest.files,version);
  const receipt={schema:'rakeez-single-stable-extension',version,target:runtime.replaceAll('/','\\'),files:manifest.files,archiveSha256:sha(publicZip),sourceTaskId:taskId,publishedSha:d.publishedSha,installedAt:new Date().toISOString(),previousVersion:prior.version,backupFolder:backup.replaceAll('/','\\'),chromeReloaded:false,updateMode:'verified-files-manifest-last-user-reload',replacedFileCount:changed.length,addedFileCount:created.length};
  insist(fs.readFileSync(base+'/STABLE_CURRENT.json').equals(oldReceiptBytes),'stable receipt changed');fs.writeFileSync(base+'/STABLE_CURRENT.json',JSON.stringify(receipt,null,2)+'\n');insist(json(base+'/STABLE_CURRENT.json').version===version,'receipt verification');
  fs.writeFileSync(base+'/UPDATE_'+version+'_RECEIPT.json',JSON.stringify({status:'INSTALLED_SAME_STABLE_PATH',...receipt},null,2)+'\n');
  console.log(JSON.stringify({status:'INSTALLED_SAME_STABLE_PATH',version,previousVersion:prior.version,files:newFiles.size,replaced:changed.length,added:created.length,publishedSha:d.publishedSha,archiveSha256:sha(publicZip),target:runtime,backupFolder:backup,chromeClosed:false,chromeReloaded:false,chromeReloadRequired:true}));
 }
}catch(e){
 const rollbackErrors=[];
 if(priorBytes){for(const n of created.reverse())try{const p=path.join(runtime,n);if(fs.existsSync(p)){insist(fs.readFileSync(p).equals(newFiles.get(n)),'new file changed '+n);fs.unlinkSync(p)}}catch(x){rollbackErrors.push(x.message)}
 for(const n of changed.reverse())try{const p=path.join(runtime,n);insist(fs.readFileSync(p).equals(newFiles.get(n)),'modified file changed '+n);fs.writeFileSync(p,priorBytes.get(n))}catch(x){rollbackErrors.push(x.message)}
 try{checkFolder(runtime,prior.files,prior.version);if(oldReceiptBytes)fs.writeFileSync(base+'/STABLE_CURRENT.json',oldReceiptBytes)}catch(x){rollbackErrors.push(x.message)}}
 console.error(JSON.stringify({status:rollbackErrors.length?'ROLLBACK_NEEDS_INSPECTION':'FAILED_PRESERVED_OR_ROLLED_BACK',error:e.message,rollbackErrors,backupFolder:backup}));process.exitCode=1;
}finally{if(locked&&fs.existsSync(lockPath)&&fs.readFileSync(lockPath,'utf8')===owner)fs.unlinkSync(lockPath)}
