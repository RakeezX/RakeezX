/** AI: final-source executable launcher/start/owned stop; UI proof reused separately. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {diagnosticError} from './n88-six-digit-redaction.mjs';
const taskId='continuous-n88-shared-network-success-budget-20261018',runId='151cbf7c-52a6-4fc7-96a5-b899497b8c6f';
const root='C:/Users/Abody/Projects/RakeezX',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const ps=(file,args)=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',file,...args],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1024*1024});
const lease=action=>ps(root+'/scripts/ops-supervisor-v4/resource-lease.ps1',['-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',root+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId]).trim();
const launcher=path.resolve('drafts/n88-student-portal/current-review-launch.ps1'),receipt=path.resolve('tests/fixtures/n88-integrated-class/receipts/'+randomUUID()+'.json');
const report={taskId,runId,checks:[],cleanup:{}};let owned=false,started=false,failure;
try {
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
  const r=JSON.parse(ps(launcher,['-TtlSeconds','180','-Receipt',receipt]));started=true;
  assert.equal(r.review.status,'running');assert.equal(r.review.budgetPolicy,'committed-success-settlement-v1');assert.equal(r.review.credentialFormat,'six-v1');
  assert.ok(r.review.url.endsWith('/#/teaching/teaching'));
  assert.equal((await fetch(r.review.url)).status,200);assert.equal((await fetch(new URL('/student',r.review.url))).status,200);
  const stopped=JSON.parse(ps(launcher,['-Stop','-Receipt',receipt]));started=false;
  assert.equal(stopped.review.status,'stopped');assert.equal(stopped.review.reason,'owned-request');
  assert.deepEqual(stopped.review.cleanup,{httpClosed:true,postgresStopped:true,ownedFilesRemoved:true});
  await assert.rejects(fetch(r.review.url));await unlink(receipt);
  report.checks.push({name:'final_source_review_launcher',status:'PASS',evidence:'Actual hidden PowerShell launcher returns six-v1/committed-success-settlement-v1 receipt and actual teacher class/student documents over owned loopback HTTP. Owned PID/birth shutdown closes server/native PG and removes cluster; own receipt removed. Actual app DOM login is covered by shared-network report.'});
}catch(e){failure=e;report.failure=diagnosticError(e);}
finally{if(started)ps(launcher,['-Stop','-Receipt',receipt]);if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-shared-launcher.json',JSON.stringify(report,null,2)+'\n');}
if(failure){console.error(report.failure);process.exitCode=1;}else console.log('N88 final-source launcher PASS');
