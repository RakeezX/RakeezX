/** AI: exact affected verification and component-only historical reuse. No live operation. */
import {spawnSync,execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const taskId='continuous-n44-actual-browser-service-integration-20261018',runId='9bb93382-ce73-4221-9f3e-8ff1b3f5f594';
const report={taskId,runId,baseSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),checks:[],reuse:[]};
assertBase();function assertBase(){if(report.baseSha!=='ddddd901b321acd432c54426faa3f09873c1987f')throw Error('Unexpected candidate base');}
let failed=false;
function run(name,args){const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:1024*1024});
 const evidence=(r.stdout??'')+(r.stderr??'');report.checks.push({name,status:r.status===0?'PASS':'FAIL',command:[process.execPath,...args],evidence:evidence.trim()});
 if(r.status!==0){failed=true;process.stdout.write(evidence);}return r.status===0;}
run('n44_actual_browser_service_journey',['tests/n44-client-binding.mjs']);
run('n44_client_binding_units',['--test','tests/n44-client-binding.unit.mjs']);
run('n44_affected_client_owner_and_action_regressions',['--test','--test-name-pattern=payload|dedupe|consent|owner/workspace|cleanup failures|action independently|inactive_import','tests/n44-push-preparation.test.mjs']);
run('n44_affected_registration_and_delivery_regressions',['--test','--test-name-pattern=registration:|delivery: concurrent|delivery: disabled|delivery: revocation','tests/n44-server-preactivation.test.mjs']);
const journey=JSON.parse(await readFile('tests/n44-client-binding.result.json','utf8'));
for(const name of ['n44_actual_browser_service_consent_sync_and_subscription_journey','n44_client_sw_owner_stale_click_default_off_and_offline_guards']){
 const c=journey.checks.find(c=>c.name===name);report.checks.push(c??{name,status:'FAIL',evidence:'Missing exact required gate'});if(c?.status!=='PASS')failed=true;
}
const files=[...new Set([...Object.keys(journey.sourceSha256),'drafts/n44-push/existing-host.mjs','drafts/n44-push/session-policy.mjs','tests/n44-client-binding.verify.mjs'])];
report.sourceSha256={};let syntax=0;
for(const file of files){const raw=await readFile(file),normalized=raw.toString('utf8').replace(/\r\n/g,'\n');report.sourceSha256[file]=createHash('sha256').update(normalized).digest('hex');
 if(journey.sourceSha256[file]&&journey.sourceSha256[file]!==report.sourceSha256[file]){failed=true;report.checks.push({name:'exact_journey_source_hash',status:'FAIL',evidence:file+' changed after journey'});}
 if(/\.m?js$/.test(file)){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});if(r.status!==0){failed=true;report.checks.push({name:'syntax',status:'FAIL',evidence:file});}syntax++;}
}
report.checks.push({name:'affected_syntax',status:failed?'FAIL':'PASS',evidence:syntax+' affected JS/module files parsed; journey hashes compared to current exact source.'});
const diff=spawnSync('git',['diff','--check'],{encoding:'utf8',windowsHide:true});if(diff.status!==0)failed=true;
report.checks.push({name:'git_diff_check',status:diff.status===0?'PASS':'FAIL',evidence:diff.status===0?'No whitespace errors':diff.stdout});
for(const [file,field,count] of [['tests/n44-crypto-sender.result.json','sourceHashes',18],['tests/n44-crypto-sender.boundary-repair-result.json','sourceHashes',16],['tests/n44-existing-host.result.json','sourceSha256',12]]){
 const prior=JSON.parse(await readFile(file,'utf8'));const matching=[],changed=[];
 for(const [source,hash] of Object.entries(prior[field]??{})){const raw=await readFile(source);const norm=raw.toString('utf8').replace(/\r\n/g,'\n');const actual=createHash('sha256').update(raw).digest('hex'),normalized=createHash('sha256').update(norm).digest('hex');
  (hash===actual||hash===normalized?matching:changed).push({source,sha256:normalized,priorSha256:hash});
 }
 report.reuse.push({path:file,runId:prior.runId,historicalCases:count,matching,changed,scope:'Component evidence only. Changed client/envelope/lease/helper/policy/server paths use new affected checks; historical total is not a new whole-suite result.'});
}
report.checks.push({name:'unchanged_evidence_reuse',status:'PASS',evidence:'18 crypto / corrected16 boundary / 12 existing-host historical records compared by actual source hashes; matching components only reused, changed scopes explicitly listed.'});
report.checks.push({name:'owned_phase_cleanup',status:journey.cleanup.httpClosed&&journey.cleanup.browserClosed&&journey.cleanup.postgresStopped&&journey.cleanup.exactPidAbsent&&journey.cleanup.leaseRelease==='RELEASED integration'?'PASS':'FAIL',evidence:JSON.stringify(journey.cleanup)});
report.checks.push({name:'synthetic_cluster_file_removal',status:'NOT_RUN',evidence:'Ownership-checked PowerShell recursive removal rejected: blocked by policy. Stopped task-owned cluster files retained untracked/outside candidate; no alternate deletion operation.'});
report.checks.push({name:'hosted_policy_service_device_production',status:'NOT_RUN',evidence:'Inactive source-only authority. Actual Auth policy readback and all hosted service/provider/OS/Production activation and verification remain separate exact gates.'});
if(report.checks.some(c=>c.status==='FAIL'))failed=true;
report.state=failed?'FAIL':'PASS';report.finishedAt=new Date().toISOString();
await writeFile('tests/n44-client-binding.checks.json',JSON.stringify(report,null,2)+'\n');
console.log('N44 exact affected verification '+report.state+'; see tests/n44-client-binding.checks.json');if(failed)process.exitCode=1;
