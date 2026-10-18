/** AI: exact executable launcher/owned graceful stop, no repeated UI journey. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const taskId='continuous-n88-integrated-class-student-journey-20261018',runId='01c87cee-6ed3-4bf6-a51c-503fa03b1248';
const base='C:/Users/Abody/Projects/RakeezX',taskFile=base+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const ps=(file,args)=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',file,...args],{encoding:'utf8',windowsHide:true,timeout:80000,maxBuffer:1024*1024});
const lease=action=>ps(base+'/scripts/ops-supervisor-v4/resource-lease.ps1',['-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',base+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId]).trim();
const launcher=path.resolve('drafts/n88-student-portal/current-review-launch.ps1'),receipt=path.resolve('tests/fixtures/n88-integrated-class/receipts/'+randomUUID()+'.json');
const report={taskId,runId,checks:[],cleanup:{}};let owned=false,started=false;
try{
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
  const initial=JSON.parse(ps(launcher,['-TtlSeconds','180','-Receipt',receipt]));started=true;
  assert.equal(initial.receiptPath,receipt);assert.equal(initial.review.status,'running');assert.ok(initial.review.url.endsWith('/#/teaching/teaching'));
  assert.equal((await fetch(initial.review.url)).status,200);assert.equal((await fetch(new URL('/student',initial.review.url))).status,200);
  const stopped=JSON.parse(ps(launcher,['-Stop','-Receipt',receipt]));assert.equal(stopped.review.status,'stopped');assert.equal(stopped.review.reason,'owned-request');
  assert.deepEqual(stopped.review.cleanup,{httpClosed:true,postgresStopped:true,ownedFilesRemoved:true});started=false;
  await assert.rejects(fetch(initial.review.url));await unlink(receipt);
  report.checks.push({name:'exact_review_launcher_start_and_owned_stop',status:'PASS',evidence:'Actual PowerShell launcher returns live actual-app teacher URL, /student HTTP 200 and PID/birth receipt; owned -Stop gracefully closes HTTP/native PG and removes owned cluster. Receipt removed by this test only; no browser replay or hosted call.'});
}finally{
  if(started)ps(launcher,['-Stop','-Receipt',receipt]);
  if(owned)report.cleanup.lease=lease('release');
  await writeFile('tests/n88-integrated-class-launcher.json',JSON.stringify(report,null,2)+'\n');
}
console.log('N88 executable review launcher/owned shutdown PASS');
