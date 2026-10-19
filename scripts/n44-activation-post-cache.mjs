/** AI: one owned phase for the materially authorized post-cache connection. */
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {execute} from './n44-activation-custody.mjs';
const runId='071a93c7-00b3-4cdd-b5a1-42d47796b1eb',taskId='continuous-n44-finish-bounded-service-activation-20261018';
const report={aiAuthored:true,taskId,runId,recordedAt:new Date().toISOString(),cacheEventId:'390bbf31-fab1-42ae-afb0-1b212fc61889',privateValuesReturned:false};
function lease(action){const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','live-mutation','-Action',action,'-TaskFile','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-RuntimeRoot','C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{windowsHide:true,timeout:20000});if(r.status!==0)throw Error('n44_post_cache_lease_failed');return r.stdout.toString().trim();}
let owned=false;
try{if(!/^(ACQUIRED|ALREADY OWNED) live-mutation$/.test(lease('acquire')))throw Error('n44_post_cache_lease_mismatch');owned=true;report.proof=await execute('--post-cache-session');report.status='PASS';}
catch(e){report.status='FAIL';report.failure=/^n44_[a-zA-Z0-9_]+$/.test(e.message)?e.message:'n44_post_cache_private_details_suppressed';process.exitCode=1;}
finally{if(owned)report.leaseReleased=lease('release')==='RELEASED live-mutation';await writeFile('tests/n44-finish-post-cache-session.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
