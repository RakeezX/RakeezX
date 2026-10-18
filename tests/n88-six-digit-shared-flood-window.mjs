/** AI: bounded high-water/expiry fixtures, not 1200 redundant real HTTP claims. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {A,SESSION} from './fixtures/n88-existing-host/provider.mjs';
import {diagnosticError} from './n88-six-digit-redaction.mjs';
const taskId='continuous-n88-shared-network-success-budget-20261018',runId='151cbf7c-52a6-4fc7-96a5-b899497b8c6f';
const root='C:/Users/Abody/Projects/RakeezX',taskFile=root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',root+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{}};let owned=false,review,failure;
try {
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;
  review=await startIntegratedReview({ttl:180});const t=review.testing,q=t.query,origin=new URL(review.url).origin;
  const binding={ownerId:A,sessionId:SESSION,leaseId:'flood-window-fixture',teachingId:'teaching',classId:'class',termId:'term',contextRevision:'1'};
  const teacher=async(action,body={})=>{const r=await fetch(origin+'/api/n88/teacher/class/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1',Authorization:'Bearer '+t.provider.token()},body:JSON.stringify({teachingId:'teaching',binding,...body})});assert.equal(r.status,200);return (await r.json()).data;};
  const claim=async code=>{const r=await fetch(origin+'/api/n88/student/claim',{method:'POST',headers:{'Content-Type':'application/json','X-N88-CSRF':'1'},body:JSON.stringify({code})});return {status:r.status,body:await r.json()};};
  const list=await teacher('list'),batch=await teacher('issue-missing',{requestId:'flood-window-batch-01',expectedRosterRevision:list.rosterRevision});
  let code=batch.created[0].credential;
  assert.equal((await claim(code)).status,200);t.trustedSource(2);assert.equal((await claim(code)).status,200);
  const globalFlood=(await q("select payload from n88_private.numeric_rates where payload->>'count'='2'")).rows[0].payload;
  assert.ok(globalFlood.key!=='global');
  // An explicit owned fixture sets ONLY the all-request global high-water mark.
  await q("update n88_private.numeric_rates set payload=jsonb_set(payload,'{count}','1199') where row_key=$1",[globalFlood.key]);
  assert.equal((await claim(code)).status,200);t.trustedSource(3);
  const reads=t.metrics.credentialReads;assert.deepEqual(await claim(code),{status:401,body:{error:'unavailable'}});assert.equal(t.metrics.credentialReads,reads);
  await t.restart();assert.deepEqual(await claim(code),{status:401,body:{error:'unavailable'}});
  assert.equal((await q("select payload->>'count' as n from n88_private.numeric_rates where row_key='global'")).rows[0].n,'0');
  // Elapsed-window fixture; actual admission must replace epoch rather than reuse credit.
  await q("update n88_private.numeric_rates set payload=jsonb_set(payload,'{until}',to_jsonb($1::bigint))",[Date.now()-1]);
  assert.equal((await claim(code)).status,200);
  const newFlood=(await q('select payload from n88_private.numeric_rates where row_key=$1',[globalFlood.key])).rows[0].payload;
  assert.notEqual(newFlood.epoch,globalFlood.epoch);assert.equal(newFlood.count,1);
  assert.ok(newFlood.until>Date.now());code='';
  report.checks.push({name:'global_all_request_flood_and_elapsed_window',status:'PASS',evidence:'Two actual trusted sources identify shared all-request bucket. Owned fabricated high-water1199 permits one committed success, then rejects fresh-source valid claim before numeric lookup at1200; global failed-guess remains zero. NativePG/service restart retains flood cap. Explicit elapsed-window fixture allows next real claim with new epoch/count1, no transfer of prior debit/credit. Source120 cap is independently exercised by120 actual successes in main report.'});
}catch(e){failure=e;report.failure=diagnosticError(e);}
finally{await review?.close();report.cleanup.ownedHttpAndNativePgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-shared-flood-window.json',JSON.stringify(report,null,2)+'\n');}
if(failure){console.error(report.failure);process.exitCode=1;}else console.log('N88 shared global flood/window fixture PASS');
