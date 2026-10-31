// AI: original-custodian dependencies only. No default file/network capability.
import path from 'node:path';
import {createHash} from 'node:crypto';
const MAX=262144,issuers=new WeakMap();
const need=v=>{if(!v)throw Error('n44_manual_ingestion_rejected');};
const sha=b=>createHash('sha256').update(b).digest('hex');
const binding=({challenge,scope,slot})=>{
 need(challenge?.version===2&&challenge.kind==='n44-phone-readiness'&&challenge.taskId==='n44-core-live-1028'&&challenge.grantId==='efedbcea-f227-4a91-bbab-79cad814fc81');
 need(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(challenge.runId)&&/^[a-f0-9]{64}$/.test(challenge.nonce)&&[0,1].includes(slot));
 need(scope&&challenge.ownerHash===sha(scope.ownerId)&&challenge.workspaceHash===sha(scope.workspaceId)&&challenge.deviceHash===sha(scope.deviceId));
 return sha(JSON.stringify({challenge,scope,slot}));
};
const statKey=s=>{need(s?.isFile()&&Number.isSafeInteger(s.size)&&s.size>0&&s.size<=MAX&&[s.dev,s.ino].every(x=>Number.isSafeInteger(x)&&x>=0)&&[s.mtimeMs,s.ctimeMs].every(Number.isFinite));return JSON.stringify([s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs]);};
/** io is the original host's fs/promises; assertOwnedRoot verifies its existing
 * owned private directory. Only a UUID transfer reference reaches this opener.
 * No caller-selected path, fallback root, directory creation or watcher. */
export function createOwnedFileOpener({root,assertOwnedRoot,io}){
 need(typeof root==='string'&&path.isAbsolute(root)&&typeof assertOwnedRoot==='function');
 need(io&&['realpath','lstat','open'].every(k=>typeof io[k]==='function'));
 const configured=path.resolve(root),same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
 const owned=async()=>{await assertOwnedRoot(configured);need(same(path.resolve(await io.realpath(configured)),configured));};
 return async transferRef=>{
  need(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(transferRef));await owned();
  const file=path.join(configured,'manual-'+transferRef+'.encrypted.json');
  const before=await io.lstat(file);need(!before.isSymbolicLink());const key=statKey(before);
  need(same(path.resolve(await io.realpath(file)),file));const handle=await io.open(file,'r');
  try{need(statKey(await handle.stat())===key);}catch(e){await handle.close();throw e;}
  return {stat:()=>handle.stat(),read:(...args)=>handle.read(...args),close:()=>handle.close(),async verify(){await owned();const current=await io.lstat(file);need(!current.isSymbolicLink()&&statKey(current)===key&&same(path.resolve(await io.realpath(file)),file));}};
 };
}
/** Source composition must create this issuer within original custody and inject
 * that exact issuer into the host. Report JSON cannot select/replace an issuer. */
export function createManualFileIntake({assertOwned,openReceivedFile,clock=Date.now}){
 need(typeof assertOwned==='function'&&typeof openReceivedFile==='function'&&typeof clock==='function');
 const receipts=new WeakMap();
 const issuer=Object.freeze({async ingest({transferRef,challenge,scope,slot}){
  need(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(transferRef));
  const expected=structuredClone({challenge,scope,slot}),bound=binding(expected);await assertOwned();
  const now=clock();need(Number.isSafeInteger(now)&&expected.challenge.issuedAt<=now&&now<expected.challenge.expiresAt&&expected.challenge.expiresAt-expected.challenge.issuedAt<=300000);
  let handle,buffer=Buffer.alloc(MAX+1);try{
   handle=await openReceivedFile(transferRef);need(handle&&['stat','read','close','verify'].every(k=>typeof handle[k]==='function'));
   const before=statKey(await handle.stat());let size=0;
   while(size<buffer.length){const r=await handle.read(buffer,size,Math.min(65536,buffer.length-size),size);need(Number.isInteger(r.bytesRead)&&r.bytesRead>=0&&r.bytesRead<=Math.min(65536,buffer.length-size));if(!r.bytesRead)break;size+=r.bytesRead;need(size<=MAX);}
   need(size>0&&statKey(await handle.stat())===before);need(JSON.parse(before)[2]===size);await handle.verify();await assertOwned();
   const ingestedAt=clock();need(Number.isSafeInteger(ingestedAt)&&ingestedAt>=now&&ingestedAt<expected.challenge.expiresAt);
   const bytes=new Uint8Array(buffer.subarray(0,size)),digest=sha(bytes);
   const cap=Object.freeze({kind:'manual-file-ingestion',transferRef,ingestedAt,byteLength:size,receiptSha256:digest,binding:bound});
   receipts.set(cap,{bytes,expected,bound,content:JSON.stringify(cap),consumed:false});return cap;
  }finally{buffer.fill(0);await handle?.close();}
 }});
 issuers.set(issuer,{receipts,assertOwned,clock});return issuer;
}
// Only the configured issuer's internal receipt map can redeem this capability.
export async function consumeManualIngestion(issuer,cap,expected){
 const state=issuers.get(issuer);need(state);await state.assertOwned();const r=state.receipts.get(cap);need(r&&!r.consumed);r.consumed=true;
 try{need(r.content===JSON.stringify(cap)&&cap.kind==='manual-file-ingestion'&&r.bound===binding(expected));need(sha(r.bytes)===cap.receiptSha256&&r.bytes.length===cap.byteLength);
  need(state.clock()<r.expected.challenge.expiresAt);return {bytes:new Uint8Array(r.bytes),digest:cap.receiptSha256,slot:r.expected.slot,
   provenance:{kind:'manual-file-ingestion',transferRef:cap.transferRef,ingestedAt:cap.ingestedAt,receiptSha256:cap.receiptSha256,independentBrowserInspection:false,observedUiExecution:false}};
 }finally{r.bytes.fill(0);}
}
