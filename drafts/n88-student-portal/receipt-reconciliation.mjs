/** AI: bounded metadata from the existing transaction snapshot; no query or authority grant. */
import {createHash} from 'node:crypto';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const command=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(v);
export function credentialStateRevision(db,members){
 return digest(members.map(m=>[m.studentId,m.enrollmentId,...db.numericCredentials.filter(c=>c.ownerId===m.ownerId&&c.studentId===m.studentId).map(c=>[c.version,c.revokedAt===null]).sort((a,b)=>a[0]-b[0])]).sort((a,b)=>a[0].localeCompare(b[0])));
}
export function reconcileIssuanceReceipts(db,scope,members,requests){
 if(!scope?.current||members.some(m=>m.ownerId!==scope.ownerId||m.classId!==scope.classId)||!Array.isArray(requests)||requests.length>8||requests.some(r=>!r||Object.keys(r).sort().join(',')!=='expectedCredentialRevision,expectedRosterRevision,requestId'||!command(r.requestId)||!hex(r.expectedRosterRevision)||!hex(r.expectedCredentialRevision))||new Set(requests.map(r=>r.requestId)).size!==requests.length)throw Error('n88_receipt_read_denied');
 return requests.map(r=>{
  const matches=db.classReceipts.filter(x=>x.ownerId===scope.ownerId&&x.requestId===r.requestId);
  if(matches.length!==1)return {state:'unknown',created:0,skipped:0,failed:0};
  const receipt=matches[0],binding=digest(['batch',scope.teachingId,r.expectedRosterRevision,null,null,null,null,r.expectedCredentialRevision]);
  if(receipt.binding!==binding||!Array.isArray(receipt.results)||receipt.results.length>2000||receipt.results.some(x=>!members.some(m=>m.studentId===x.studentId&&m.enrollmentId===x.enrollmentId)||!['created','skipped','failed'].includes(x.status)))return {state:'unknown',created:0,skipped:0,failed:0};
  return {state:'committed',...Object.fromEntries(['created','skipped','failed'].map(k=>[k,receipt.results.filter(x=>x.status===k).length]))};
 });
}
