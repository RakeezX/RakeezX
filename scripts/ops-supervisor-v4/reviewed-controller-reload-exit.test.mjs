// Execute the actual emitted PowerShell identity functions with bounded in-memory process observations.
import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {buildControllerReloadScript} from './reviewed-controller-reload.mjs';
const reload={expectedIdentity:{pid:24696,createdAt:'2026-10-30T12:48:17.7813390Z',instanceId:'2e21a1fa-8d5d-4616-9863-1bba415a7f15'},expectedControllerSha256:'a'.repeat(64),expectedStartOpsSha256:'b'.repeat(64),expectedScheduledLauncherSha256:'c'.repeat(64),expectedScheduledActionSha256:'d'.repeat(64),authorityRef:'po-20261031-reload-exit-fix',reason:'Qualify exact original process exit observation without stopping or starting a real process.'};
const script=buildControllerReloadScript({reload,repoRoot:'C:/Users/Abody/Projects/RakeezX',runtimeRoot:'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4',activationId:'po-20261012-continuous',maintenanceLockSha256:'e'.repeat(64),stopSha256:'f'.repeat(64),pauseStartedAt:'2026-10-30T23:40:00Z',evidenceRoot:'C:/owned-test'});
test('actual generated Windows identity guards distinguish authorization from process exit',()=>{
 const functions=script.slice(script.indexOf('function Exact-Process('),script.indexOf('function Check-Task'));
 const fixture=String.raw`$ErrorActionPreference='Stop'
$scriptPath='C:\Users\Abody\Projects\RakeezX\scripts\ops-supervisor-v4\controller.mjs'
$rt='C:\Users\Abody\Projects\RakeezX\artifacts\ops-supervisor-v4'
$id=[pscustomobject]@{pid=24696;createdAt='2026-10-30T12:48:17.7813390Z';instanceId='2e21a1fa-8d5d-4616-9863-1bba415a7f15'}
$original=[pscustomobject]@{Name='node.exe';CreationDate=[DateTime]::Parse($id.createdAt);CommandLine='node.exe '+$scriptPath+' --runtime '+$rt}
$script:sample=$original
function Get-CimInstance {param($ClassName,$Filter);return $script:sample}
function Must($v,$m){if(!$v){throw $m}}
function Reject($action,$m){$rejected=$false;try{& $action|Out-Null}catch{$rejected=$true};Must $rejected $m}
`+functions+String.raw`
Must ($null -ne (Exact-Process $id)) 'exact pre-stop identity'
Must ($null -ne (Observe-OriginalExit $id)) 'exact post-stop pending'
$original.CommandLine=$null
Reject {Exact-Process $id} 'null command may not authorize stop'
Must ($null -ne (Observe-OriginalExit $id)) 'null command must remain pending'
$started=$false
try{if(Observe-OriginalExit $id){throw 'Old controller/task still active; no duplicate start'};$started=$true}catch{}
Must (!$started) 'pending timeout cannot start'
$original.CreationDate=$original.CreationDate.AddTicks(1)
Reject {Observe-OriginalExit $id} 'PID birth reuse cannot be absence'
$original.CreationDate=[DateTime]::Parse($id.createdAt)
$original.Name='foreign.exe'
Reject {Observe-OriginalExit $id} 'foreign executable cannot be absence'
$original.Name='node.exe';$original.CommandLine='node.exe C:\foreign\controller.mjs'
Reject {Observe-OriginalExit $id} 'foreign command cannot be absence'
$started=$false
try{if(Observe-OriginalExit $id){throw 'still present'};$started=$true}catch{}
Must (!$started) 'identity error cannot start'
$script:sample=$null
Must ($null -eq (Exact-Process $id)) 'absent strict'
Must ($null -eq (Observe-OriginalExit $id)) 'absent exit'
'ACTUAL_POWERSHELL_IDENTITY_CASES_PASS'
`;
 const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',fixture],{encoding:'utf8',windowsHide:true,timeout:15000}).trim();assert.equal(output,'ACTUAL_POWERSHELL_IDENTITY_CASES_PASS');
});
test('emitted control flow retains strict stops, exit deadline and singleton startup gates',()=>{
 assert.match(script,/\$rt = \[IO\.Path\]::GetFullPath\(\[string\]\$p\.runtimeRoot\)/);assert.match(script,/\$repo = \[IO\.Path\]::GetFullPath\(\[string\]\$p\.repoRoot\)/);
 const stop=script.indexOf('Stop-Process -Id'),observer=script.indexOf('$remaining=Observe-OriginalExit $old'),deadline=script.indexOf("if ((Observe-OriginalExit $old) -or"),singleton=script.indexOf('if (@(Controllers).Count -ne 0)'),start=script.indexOf('Start-ScheduledTask -TaskName');
 assert.ok(stop>0&&observer>stop&&deadline>observer&&singleton>deadline&&start>singleton);assert.match(script.slice(0,stop),/\$proc=Exact-Process \$old/);assert.equal((script.match(/Start-ScheduledTask -TaskName/g)||[]).length,1);
});
