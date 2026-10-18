import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildControllerReloadScript } from '../reviewed-controller-reload.mjs';
const run = promisify(execFile);
const hash = value => createHash('sha256').update(value).digest('hex');
const powershell = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

// Every process/scheduler mutation in the generated script is shadowed by these
// fixture functions. Native Windows commands are never invoked for those names.
const mockCommands = String.raw`
$ErrorActionPreference='Stop'
$script:fixture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixture.json') -Raw|ConvertFrom-Json
$script:events=New-Object Collections.Generic.List[string]
$script:oldAlive=$true; $script:newAlive=$false; $script:taskState='Running'; $script:foreign=$false; $script:reused=$false; $script:actionChanged=$false
function Save-Events { [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'events.json'),(ConvertTo-Json -InputObject @($script:events.ToArray()))) }
function Start-Sleep { param([int]$Milliseconds) }
function Get-ScheduledTask {
  param($TaskName,$TaskPath)
  $args=$script:fixture.action.arguments
  if ($script:actionChanged) {$args+=' unexpected'}
  return [pscustomobject]@{TaskName='RAKEEZ-Continuous-Delivery';TaskPath='\';State=$script:taskState;Actions=@([pscustomobject]@{Execute=$script:fixture.action.execute;Arguments=$args;WorkingDirectory=$script:fixture.action.workingDirectory})}
}
function Stop-ScheduledTask {
  param($TaskName,$TaskPath)
  $script:events.Add('stop-task');Save-Events;$script:taskState='Ready'
  if ($script:fixture.mode -eq 'pid-reuse') {$script:reused=$true}
  if ($script:fixture.mode -eq 'action-drift') {$script:actionChanged=$true}
  if ($script:fixture.mode -eq 'stop-owner-drift') {[IO.File]::WriteAllText((Join-Path $script:fixture.runtime 'STOP'),'foreign owner')}
  if ($script:fixture.mode -eq 'queue-race') {[IO.File]::WriteAllText((Join-Path $script:fixture.runtime 'queue\race.json'),'{"status":"running"}')}
}
function Stop-Process {
  param([int]$Id,$ErrorAction)
  if ($Id -ne 101 -or !$script:oldAlive -or $script:reused) {throw 'Fixture refused a non-owned process termination'}
  $script:events.Add('stop-exact-controller');Save-Events;$script:oldAlive=$false
  if ($script:fixture.mode -eq 'foreign-controller') {$script:foreign=$true}
}
function Start-ScheduledTask {
  param($TaskName,$TaskPath)
  $script:events.Add('start-task');Save-Events
  $script:newAlive=$true;$script:taskState='Running'
  $new=$script:fixture.newIdentity
  $cap=if($script:fixture.mode -eq 'missing-capability'){3}else{5}
  $snapshot=[ordered]@{at=[DateTime]::UtcNow.ToString('o');activationId='active';controllerPid=$new.pid;instanceId=$new.instanceId;paused=$true;controllerAlive=$true;processInventoryKnown=$true;active=@();runningCount=0;deliveryInFlight=$null;supportedMaxWorkers=$cap;maxWorkers=3}
  # These writes simulate the NEW controller's own initialization/adoption.
  foreach($name in @('CONTROLLER_IDENTITY.json','controller.lock')){[IO.File]::WriteAllText((Join-Path $script:fixture.runtime $name),($new|ConvertTo-Json))}
  [IO.File]::WriteAllText((Join-Path $script:fixture.runtime 'ACTIVE_TASKS.json'),($snapshot|ConvertTo-Json -Depth 5))
}
function Get-CimInstance {
  param($ClassName,$Filter)
  $rows=@()
  foreach($entry in @(@(101,201,$script:oldAlive),@(102,202,$script:newAlive),@(103,203,$script:foreign))){
    if(!$entry[2]){continue}
    $birth=if($entry[0] -eq 101){$script:fixture.oldIdentity.createdAt}else{$script:fixture.newIdentity.createdAt}
    if($entry[0] -eq 101 -and $script:reused){$birth='2026-10-18T09:00:01.1234567Z'}
    $rows+=([pscustomobject]@{ProcessId=[int]$entry[0];ParentProcessId=[int]$entry[1];CreationDate=[DateTime]::Parse($birth);Name='node.exe';CommandLine=('node.exe "'+(Join-Path $script:fixture.repo 'scripts\ops-supervisor-v4\controller.mjs')+'" --runtime "'+$script:fixture.runtime+'"')})
    $rows+=([pscustomobject]@{ProcessId=[int]$entry[1];ParentProcessId=1;CreationDate=[DateTime]::Parse($birth);Name='powershell.exe';CommandLine=('powershell.exe -File "'+(Join-Path $script:fixture.repo 'scripts\ops-supervisor-v4\start-ops.ps1')+'"')})
  }
  if($Filter -match '^ProcessId=(\d+)$') {return @($rows|Where-Object {$_.ProcessId -eq [int]$Matches[1]})}
  if($Filter -eq "Name='node.exe'"){return @($rows|Where-Object {$_.Name -eq 'node.exe'})}
  if($script:fixture.mode -eq 'worker-alive'){$rows+=([pscustomobject]@{ProcessId=501;Name='powershell.exe';CommandLine=('run-task.ps1 -TaskFile "'+$script:fixture.runtime+'\queue\orphan.json"')})}
  return $rows
}
`;

async function fixture(t, mode = 'success') {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'rakeez-reload-fixture-'));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  const runtime = path.join(repo, 'artifacts', 'ops-supervisor-v4'), evidenceRoot = path.join(runtime, 'maintenance-fixture');
  for (const dir of [path.join(repo, 'scripts', 'ops-supervisor-v4'), path.join(runtime, 'operator-monitor'), path.join(runtime, 'queue'), evidenceRoot]) await fs.mkdir(dir, { recursive: true });
  const files = { controller: 'reviewed controller fixture', start: 'reviewed start fixture', launcher: 'reviewed silent launcher fixture' };
  await fs.writeFile(path.join(repo, 'scripts', 'ops-supervisor-v4', 'controller.mjs'), files.controller);
  await fs.writeFile(path.join(repo, 'scripts', 'ops-supervisor-v4', 'start-ops.ps1'), files.start);
  const launcherPath = path.join(runtime, 'operator-monitor', 'launch-ops-no-console.vbs'); await fs.writeFile(launcherPath, files.launcher);
  const oldIdentity = { pid: 101, createdAt: '2026-10-18T09:00:00.1234567Z', instanceId: 'old-controller' };
  const newIdentity = { pid: 102, createdAt: '2026-10-18T09:01:00.1234567Z', instanceId: 'new-controller' };
  const write = (name, value) => fs.writeFile(path.join(runtime, name), JSON.stringify(value));
  const snapshot = { at: new Date().toISOString(), activationId: 'active', controllerPid: oldIdentity.pid, instanceId: oldIdentity.instanceId, paused: true, controllerAlive: true, processInventoryKnown: true, active: [], runningCount: 0, deliveryInFlight: mode === 'publisher-active' ? { taskId: 'fixture-active' } : null };
  await write('ACTIVE_TASKS.json', snapshot); await write('CONTROLLER_IDENTITY.json', oldIdentity); await write('controller.lock', oldIdentity);
  if (mode === 'queue-active') await write('queue/active.json', { status: 'running' });
  await fs.writeFile(path.join(runtime, 'maintenance.lock.json'), 'owned maintenance'); await fs.writeFile(path.join(runtime, 'STOP'), 'owned stop');
  const action = { execute: path.win32.join(process.env.SystemRoot, 'System32', 'wscript.exe'), arguments: '//B //Nologo "' + launcherPath + '"', workingDirectory: path.dirname(launcherPath) };
  const reload = { expectedIdentity: oldIdentity, expectedControllerSha256: hash(files.controller), expectedStartOpsSha256: hash(files.start), expectedScheduledLauncherSha256: hash(files.launcher), expectedScheduledActionSha256: hash(JSON.stringify(action)), authorityRef: 'po-20261018-five-workers', reason: 'Load the reviewed capacity code through the single existing Scheduled Task.' };
  await fs.writeFile(path.join(repo, 'fixture.json'), JSON.stringify({ repo, runtime, oldIdentity, newIdentity, action, mode }));
  const script = mockCommands + buildControllerReloadScript({ reload, repoRoot: repo, runtimeRoot: runtime, activationId: 'active', maintenanceLockSha256: hash('owned maintenance'), stopSha256: hash('owned stop'), pauseStartedAt: new Date(Date.now() - 1000).toISOString(), evidenceRoot });
  const scriptPath = path.join(repo, 'fixture.ps1'); await fs.writeFile(scriptPath, script);
  let output, error;
  try { output = await run(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', scriptPath], { timeout: 15000, windowsHide: true }); } catch (caught) { error = caught; }
  const events = await fs.readFile(path.join(repo, 'events.json'), 'utf8').then(JSON.parse).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
  const receipt = await fs.readFile(path.join(evidenceRoot, 'controller-reload-progress.json'), 'utf8').then(JSON.parse).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  return { output, error, events, receipt };
}
test('reviewed reload uses one existing scheduled restart while leaving lock adoption to the new controller', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t);
  assert.ifError(f.error);
  assert.deepEqual(f.events, ['stop-task', 'stop-exact-controller', 'start-task']);
  assert.equal(f.receipt.status, 'RELOADED_SINGLE_CURRENT_CONTROLLER');
  assert.equal(f.receipt.scheduledStarts, 1); assert.equal(f.receipt.newIdentity.instanceId, 'new-controller');
  assert.equal(f.receipt.controllerLockEdited, false); assert.equal(f.receipt.queueEdited, false);
});
for (const [mode, expectedEvents] of [
  ['queue-active', []], ['publisher-active', []], ['worker-alive', []], ['pid-reuse', ['stop-task']], ['queue-race', ['stop-task']],
  ['action-drift', ['stop-task']], ['stop-owner-drift', ['stop-task']],
  ['foreign-controller', ['stop-task', 'stop-exact-controller']],
  ['missing-capability', ['stop-task', 'stop-exact-controller', 'start-task']]
]) test('reviewed reload fails safely for ' + mode, { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t, mode);
  assert.ok(f.error, 'The guarded reload must fail');
  assert.deepEqual(f.events, expectedEvents);
  assert.equal(f.receipt?.status, 'RELOAD_FAILED');
  assert.ok((f.receipt?.scheduledStarts ?? 0) <= 1);
});
