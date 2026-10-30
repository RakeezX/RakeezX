import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),policy=JSON.parse(fs.readFileSync(path.join(here,'worker-profile-policy.json'),'utf8')),runner=fs.readFileSync(path.join(here,'run-task.ps1'),'utf8'),controller=fs.readFileSync(path.join(here,'controller.mjs'),'utf8');
test('actual PowerShell profile applies current PO choice to stale risk and N44 overrides',()=>{
 const start=runner.indexOf('function Get-WorkerExecutionProfile('),end=runner.indexOf('function Save-Checkpoint');assert.ok(start>0&&end>start);
 const script="function Read-Json([string]$File) { [System.IO.File]::ReadAllText($File,[Text.Encoding]::UTF8) | ConvertFrom-Json }\n"+runner.slice(start,end)+String.raw`
$ErrorActionPreference='Stop'
$cases=@(
 @{id='fast-copy';productId='N13';model='gpt-6-luna';effort='medium'},
 @{id='critical';productId='N88';model='gpt-6.1-sol';effort='high'},
 @{id='continuous-n44-one-approved-closed-page-push-20261019';productId='N44';model='gpt-6-astra';effort='max';executionProfile=@{version=1;authorityRef='PO-20261027-N44-ASTRA-SINGLE-WORKER';model='gpt-6-astra';effort='max';serviceTier='priority';fastMode=$true;singleAgent=$true}},
 @{id='normal';productId='N88';model='gpt-6.1-sol';effort='medium'}
)
foreach($task in $cases){
 $spec=@{taskId=$task.id;model=$task.model;effort=$task.effort;sessionId='01a14fcd-032c-7ec0-8b0c-0e0395862c61'}
 $p=Get-WorkerExecutionProfile $task $spec
 if($task.executionProfile.singleAgent -eq $true -and ($p.singleAgent -ne $true -or $p.config -notcontains 'features.multi_agent=false' -or $p.config -notcontains 'features.multi_agent_v2=false')){throw 'Original single-agent constraint lost'}
 if($p.model -ne 'gpt-6.1-sol' -or $p.effort -ne 'medium' -or $p.speed -ne 'Standard' -or $p.serviceTier -ne 'default' -or $p.fastMode -ne $false -or $p.config -contains 'features.fast_mode=true' -or $p.config -contains 'service_tier=priority' -or $p.config -notcontains 'features.fast_mode=false' -or $p.config -notcontains 'service_tier=default'){throw 'Unexpected paid execution profile'}
}
'UNIFORM_PROFILE_CASES_PASS'
`;
 const file=path.join(here,'profile-qualification.ps1');fs.writeFileSync(file,script);try{const out=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();assert.equal(out,'UNIFORM_PROFILE_CASES_PASS');}finally{fs.unlinkSync(file);}
});
test('controller and actual CLI arguments consume the same current policy',()=>{
 assert.equal(policy.model,'gpt-6.1-sol');assert.equal(policy.effort,'medium');assert.equal(policy.fastMode,false);assert.equal(policy.serviceTier,'default');
 assert.match(controller,/import workerProfile from '\.\/worker-profile-policy\.json' with \{type:'json'\}/);assert.match(controller,/model: workerProfile\.model, effort: workerProfile\.effort/);assert.doesNotMatch(controller,/model: task\.model \?\? lane\.model/);
 assert.match(runner,/\$executionProfile = Get-WorkerExecutionProfile \$task \$spec/);assert.match(runner,/\$arguments\.Add\(\[string\]\$executionProfile\.model\)/);assert.match(runner,/model_reasoning_effort=' \+ \[string\]\$executionProfile\.effort/);assert.doesNotMatch(runner,/Get-N44ExecutionProfile|gpt-6-astra|features\.fast_mode=true/);
});
