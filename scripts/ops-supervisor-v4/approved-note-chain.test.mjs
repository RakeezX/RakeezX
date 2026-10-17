import test from 'node:test';
import assert from 'node:assert/strict';
const p=process.env.RAKEEZ_REVIEW_HELPERS;
const url=p?new URL('file:///'+p.replaceAll('\\','/')):new URL('./apply-reviewed-maintenance.mjs',import.meta.url);
const {catalogSourceBinding}=await import(url);
const taskId='continuous-n36-madrasati-roster-official-feedback-20261017',file='scripts/ops-supervisor-v4/n36-madrasati-real-roster-evidence-20261017.json';
const first='a'.repeat(64),second='b'.repeat(64),third='c'.repeat(64),commit='d'.repeat(40),path='C:\\Users\\Abody\\Projects\\RakeezX\\'+file.replaceAll('/','\\');
const make=()=>({
 task:{id:taskId,sessionId:'session01',approvedNote:{source:'n36-madrasati-real-roster-evidence-20261017.json',sha256:first},recoveryHistory:[{kind:'reviewed-material-maintenance',commit,sessionId:'session01'}]},
 update:{card:{id:taskId}},followups:[{sourceFile:path,sourceSha256:second,commit,updatedTaskIds:[taskId]}]
});
const check=x=>catalogSourceBinding([],x.task,x.update,file,second,x.followups);
test('reviewed next-step card follows only previous owned maintenance source hash',()=>{const v=make();const r=check(v);assert.equal(r.kind,'approved-note');assert.equal(r.approvedNoteSha256,first)});
test('first direct approved note works without followup',()=>{const v=make();assert.equal(catalogSourceBinding([],v.task,v.update,file,first,[]).kind,'approved-note')});
for(const [label,mutate] of [
 ['missing previous reviewed chain',x=>x.followups=[]],
 ['mismatched source filename',x=>x.followups[0].sourceFile='C:\\Users\\Abody\\other.json'],
 ['mismatched published source hash',x=>x.followups[0].sourceSha256=third],
 ['mismatched chain commit',x=>x.followups[0].commit='e'.repeat(40)],
 ['different activated card id',x=>x.followups[0].updatedTaskIds=['other']],
 ['different saved session',x=>x.task.sessionId='foreign-session'],
 ['changed source note origin',x=>x.task.approvedNote.source='forged.json'],
 ['latest chain is different even if an older one matched',x=>x.followups.push({sourceFile:path,sourceSha256:third,commit:'f'.repeat(40),updatedTaskIds:[taskId]})],
 ])test('reject '+label,()=>{const x=make();mutate(x);assert.throws(()=>check(x))});
