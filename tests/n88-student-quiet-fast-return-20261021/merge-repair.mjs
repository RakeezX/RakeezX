/** AI: scoped read-only reconciliation of the publisher's exact failed merge. */
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const dir='tests/n88-student-quiet-fast-return-20261021/';
const prior='75cefb0ace49318fb1674c008663cb3e49c0ae49',base='c6e91a85035e2d5f9403f002ffd8254392df2d34';
const integration='C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/delivery/continuous-n88-student-quiet-fast-return-20261021/integration-75cefb0ace49-1-304fd474';
const sourcePath='drafts/n88-student-portal/official-activation.mjs';
const normal=s=>s.toString().replaceAll('\r\n','\n'),sha=s=>createHash('sha256').update(s).digest('hex');
const git=(args,cwd=process.cwd())=>execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:2097152});
const report={taskId:'continuous-n88-student-quiet-fast-return-20261021',runId:'5ef47f0b-74e7-4ea5-a005-ed5094b9a52c',baseSha:base,priorCandidate:prior,status:'FAIL',checks:[],providerOperations:0,uploads:0,uiReruns:0};
const temporary=[];
try{
 git(['merge-base','--is-ancestor',prior,'HEAD']);
 const main=git(['rev-parse','HEAD'],integration).trim();
 assert.equal(main,'f3f4fe4c074881e5eac9a4a767cb1140d023be32');report.observedPublisherMain=main;
 const unmerged=git(['ls-files','-u','--',sourcePath],integration);
 assert.match(unmerged,/ 1\t/);assert.match(unmerged,/ 2\t/);assert.match(unmerged,/ 3\t/);
 const ancestor=normal(git(['show',':1:'+sourcePath],integration)),currentMain=normal(git(['show',':2:'+sourcePath],integration)),oldCandidate=normal(git(['show',':3:'+sourcePath],integration));
 assert.equal(oldCandidate,normal(git(['show',prior+':'+sourcePath])));assert.equal(ancestor,normal(git(['show',base+':'+sourcePath])));
 const repaired=normal(await readFile(sourcePath));
 const start=" if(['--student-quiet-static-owned-preflight'",next=" if(['--student-reopen-static-owned-preflight'";
 const extract=(text,endMarker)=>{const a=text.indexOf(start),b=text.indexOf(endMarker,a);assert(a>=0&&b>a);return {block:text.slice(a,b),remaining:text.slice(0,a)+text.slice(b)};};
 const old=extract(oldCandidate," if(['--student-pending-static-owned-preflight'"),now=extract(repaired,next);
 assert.equal(now.block,old.block,'Exact completed static handler retained');assert.equal(now.remaining,old.remaining,'Only handler placement changed');
 const file=async(name,text)=>{const target=path.resolve(dir+'merge-repair-'+name+'.tmp.mjs');assert(target.startsWith(path.resolve(dir)+path.sep));await writeFile(target,text,{flag:'wx'});temporary.push(target);return target;};
 const ours=await file('main',currentMain),common=await file('base',ancestor),theirs=await file('candidate',repaired);
 const merged=spawnSync('git',['merge-file','--stdout',ours,common,theirs],{encoding:'utf8',windowsHide:true,maxBuffer:2097152});
 assert.equal(merged.status,0,merged.stderr);assert(!/^(<<<<<<<|=======|>>>>>>>)/m.test(merged.stdout));
 const importLine="import {STUDENT_QUIET_STATIC,runStudentQuietStaticPhase} from './activation/static-student-quiet-return-20261021-gate.mjs';";
 const importAnchor="import {STUDENT_PENDING_STATIC,runStudentPendingStaticPhase} from './activation/static-student-pending-20261021-gate.mjs';";
 let expected=currentMain.replace(importAnchor,importAnchor+'\n'+importLine);
 const point=expected.indexOf(next);assert(point>0);expected=expected.slice(0,point)+now.block+expected.slice(point);
 assert.equal(normal(merged.stdout),expected,'Exact observed main plus this task handler/import; no unrelated main bytes removed');
 const mergedPath=await file('merged',merged.stdout);
 for(const f of [sourcePath,mergedPath])execFileSync(process.execPath,['--check',f],{windowsHide:true});
 const rejected=spawnSync(process.execPath,[sourcePath,'--student-quiet-static-owned-preflight'],{encoding:'utf8',windowsHide:true,env:{...process.env,N88_STUDENT_QUIET_RUN_ID:report.runId}});
 assert.equal(rejected.status,1);assert.match(rejected.stderr,/n88_student_static_original_root/);
 const proof=JSON.parse(await readFile(dir+'qualification.json')),final=JSON.parse(await readFile(dir+'final-checks.json'));
 for(const [f,hash] of Object.entries(proof.changedSourceHashes))assert.equal(sha(normal(await readFile(f))),hash);
 for(const [f,hash] of Object.entries(proof.evidence))assert.equal(sha(await readFile(f.startsWith('tests/')?f:dir+f)),hash);
 assert.equal(final.status,'PASS');assert.equal(final.checks.length,5);assert(final.checks.every(c=>c.status==='PASS'));
 for(const [f,hash] of Object.entries(final.receiptHashes))assert.equal(sha(await readFile(dir+f)),hash);
 // Prior custody hash describes the exact entry that performed the consumed
 // upload. Keep that historical receipt intact; record the relocation bridge.
 const custody=JSON.parse(await readFile(dir+'custody.json'));assert.equal(sha(oldCandidate),custody.officialEntrySha256);
 report.priorOfficialEntrySha256=custody.officialEntrySha256;report.repairedOfficialEntrySha256=sha(repaired);
 report.reusedFinalChecksSha256=sha(await readFile(dir+'final-checks.json'));
 report.checks=['same handler bytes and surrounding candidate bytes preserved','exact failed publisher-main file merges without conflict','merged result retains exact other-task handler/imports','candidate and simulated merged syntax PASS','actual wrong-root entry denies before custody or provider access','all source/UI/static-receipt hashes unchanged; five completed checks reused'];
 assert.equal(git(['ls-files','-u','--',sourcePath],integration),unmerged,'Diagnostic integration index untouched');
 report.status='PASS';report.limits='Original worktree/base retained. No adoption of unrelated main changes, integration worktree mutation, provider call, gate replay, upload, browser/server or frontend publication.';
}catch(e){report.failure=e.message;process.exitCode=1;}finally{
 for(const f of temporary)await unlink(f);
 await writeFile(dir+'merge-repair.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
