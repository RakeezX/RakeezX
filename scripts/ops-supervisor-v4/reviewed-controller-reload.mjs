// One reviewed reload of the existing idle Scheduled Task. No worker dispatch.
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9._-]{0,159}$/;
const insist = (value, message) => { if (!value) throw Error(message); };
export function validateControllerReload(value) {
  insist(value && typeof value === 'object' && !Array.isArray(value), 'Expected controllerReload object');
  const keys = ['expectedIdentity', 'expectedControllerSha256', 'expectedStartOpsSha256', 'expectedScheduledLauncherSha256', 'expectedScheduledActionSha256', 'authorityRef', 'reason'];
  insist(Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)), 'Unexpected controller reload field');
  const id = value.expectedIdentity;
  insist(id && Object.keys(id).length === 3 && Object.keys(id).every(key => ['pid', 'createdAt', 'instanceId'].includes(key))
    && Number.isSafeInteger(id.pid) && id.pid > 0 && ID.test(id.instanceId ?? '')
    && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|[+-]\d\d:\d\d)$/.test(id.createdAt ?? '') && Number.isFinite(Date.parse(id.createdAt)), 'Expected exact controller PID/birth/instance');
  for (const key of keys.filter(key => key.endsWith('Sha256'))) insist(SHA256.test(value[key] ?? ''), 'Expected reviewed ' + key);
  insist(ID.test(value.authorityRef ?? '') && value.authorityRef.startsWith('po-'), 'A PO authority reference is required for reload');
  insist(typeof value.reason === 'string' && value.reason.trim().length >= 20 && value.reason.length <= 1000, 'A concrete controller reload reason is required');
  return structuredClone(value);
}

// Values enter PowerShell only as one JSON/base64 data object. The action below
// is fixed to the currently installed silent launcher and existing task name.
export function buildControllerReloadScript(options) {
  validateControllerReload(options.reload);
  const execution = { ...options, reload: { ...options.reload } };
  delete execution.reload.reason; delete execution.reload.authorityRef;
  const encoded = Buffer.from(JSON.stringify(execution), 'utf8').toString('base64');
  return String.raw`
$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json
$rt = [IO.Path]::GetFullPath([string]$p.runtimeRoot)
$repo = [IO.Path]::GetFullPath([string]$p.repoRoot)
$old = $p.reload.expectedIdentity
$scriptPath = Join-Path $repo 'scripts\ops-supervisor-v4\controller.mjs'
$startPath = Join-Path $repo 'scripts\ops-supervisor-v4\start-ops.ps1'
$launcherPath = Join-Path $rt 'operator-monitor\launch-ops-no-console.vbs'
$lockPath = Join-Path $rt 'controller.lock'
$receiptPath = Join-Path $p.evidenceRoot 'controller-reload-progress.json'
$r = [ordered]@{status='PREPARED';oldIdentity=$old;scheduledStarts=0;exactControllerStopped=$false;controllerLockEdited=$false;queueEdited=$false}
function Save-Reload([string]$stage) { $r.status=$stage; $r.at=[DateTime]::UtcNow.ToString('o'); [IO.File]::WriteAllText($receiptPath,($r|ConvertTo-Json -Depth 10),(New-Object Text.UTF8Encoding($false))) }
function File-Hash([string]$file) { $alg=[Security.Cryptography.SHA256]::Create(); $stream=[IO.File]::OpenRead($file); try {return ([BitConverter]::ToString($alg.ComputeHash($stream))).Replace('-','').ToLowerInvariant()} finally {$stream.Dispose();$alg.Dispose()} }
function Same-Identity($a,$b) { return $a -and $b -and [int]$a.pid -eq [int]$b.pid -and [string]$a.instanceId -ceq [string]$b.instanceId -and ([DateTime]::Parse($a.createdAt)).ToUniversalTime().Ticks -eq ([DateTime]::Parse($b.createdAt)).ToUniversalTime().Ticks }
function Exact-Process($id) {
  $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$id.pid)
  if (!$proc) { return $null }
  if ($proc.CreationDate.ToUniversalTime().Ticks -ne ([DateTime]::Parse($id.createdAt)).ToUniversalTime().Ticks) { throw 'Controller PID reused; no process action permitted' }
  if ($proc.Name -ne 'node.exe' -or !$proc.CommandLine -or $proc.CommandLine.IndexOf($scriptPath,[StringComparison]::OrdinalIgnoreCase) -lt 0 -or $proc.CommandLine.IndexOf($rt,[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'Controller command identity mismatch' }
  return $proc
}
# Post-stop observation only: Windows may clear CommandLine before the process exits.
# Missing command metadata means still present; it never authorizes another stop/start.
function Observe-OriginalExit($id) {
  $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$id.pid)
  if (!$proc) { return $null }
  if ($proc.CreationDate.ToUniversalTime().Ticks -ne ([DateTime]::Parse($id.createdAt)).ToUniversalTime().Ticks -or $proc.Name -ne 'node.exe') { throw 'Original process identity changed while waiting for exit' }
  if ($proc.CommandLine -and ($proc.CommandLine.IndexOf($scriptPath,[StringComparison]::OrdinalIgnoreCase) -lt 0 -or $proc.CommandLine.IndexOf($rt,[StringComparison]::OrdinalIgnoreCase) -lt 0)) { throw 'Original process command changed while waiting for exit' }
  return $proc
}
function Check-Task {
  $task=Get-ScheduledTask -TaskName 'RAKEEZ-Continuous-Delivery' -TaskPath '\'
  if (@($task.Actions).Count -ne 1) { throw 'Scheduled action count changed' }
  $a=$task.Actions[0]
  $expectedArgs='//B //Nologo "'+$launcherPath+'"'
  if (![string]::Equals($a.Execute,(Join-Path $env:SystemRoot 'System32\wscript.exe'),[StringComparison]::OrdinalIgnoreCase) -or $a.Arguments -cne $expectedArgs -or ![string]::Equals($a.WorkingDirectory,(Split-Path $launcherPath),[StringComparison]::OrdinalIgnoreCase)) { throw 'Scheduled launcher identity changed' }
  $binding=[ordered]@{execute=[string]$a.Execute;arguments=[string]$a.Arguments;workingDirectory=[string]$a.WorkingDirectory}
  $data=[Text.Encoding]::UTF8.GetBytes(($binding|ConvertTo-Json -Compress))
  $alg=[Security.Cryptography.SHA256]::Create()
  try { $hash=([BitConverter]::ToString($alg.ComputeHash($data))).Replace('-','').ToLowerInvariant() } finally { $alg.Dispose() }
  if ($hash -cne $p.reload.expectedScheduledActionSha256) { throw 'Scheduled action differs from review' }
  return $task
}
function Check-Ownership {
  foreach ($item in @(@('maintenance.lock.json',$p.maintenanceLockSha256),@('STOP',$p.stopSha256))) {
    $file=Join-Path $rt $item[0]
    if (!(Test-Path -LiteralPath $file -PathType Leaf) -or (File-Hash $file) -cne $item[1]) { throw 'Reload maintenance ownership changed' }
  }
  if (Test-Path -LiteralPath (Join-Path $rt 'STOP-REFILL')) { throw 'Another stop marker appeared' }
  if (Test-Path -LiteralPath (Join-Path $rt 'leases\integration.json')) { throw 'Publisher integration lease is active' }
  $cards=@(Get-ChildItem -LiteralPath (Join-Path $rt 'queue') -Filter '*.json' | ForEach-Object {Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json})
  if (@($cards|Where-Object {$_.status -in @('running','delivery')}).Count) { throw 'Authoritative queue has active work' }
  $workers=@(Get-CimInstance Win32_Process | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($rt,[StringComparison]::OrdinalIgnoreCase) -ge 0 -and ($_.CommandLine -match 'worker-broker\.mjs|run-task\.ps1')})
  if ($workers.Count) { throw 'An actual worker process remains alive' }
}
function Check-Hashes {
  foreach ($item in @(@($scriptPath,$p.reload.expectedControllerSha256),@($startPath,$p.reload.expectedStartOpsSha256),@($launcherPath,$p.reload.expectedScheduledLauncherSha256))) {
    if ((File-Hash $item[0]) -cne $item[1]) { throw 'Reviewed reload source changed' }
  }
}
function Check-Paused($id,[bool]$requireCapacity) {
  Check-Ownership; Check-Hashes
  $actual=Get-Content -LiteralPath (Join-Path $rt 'CONTROLLER_IDENTITY.json') -Raw | ConvertFrom-Json
  $lock=Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
  if (!(Same-Identity $actual $id) -or !(Same-Identity $lock $id)) { throw 'Controller identity/lock binding changed' }
  $s=Get-Content -LiteralPath (Join-Path $rt 'ACTIVE_TASKS.json') -Raw | ConvertFrom-Json
  $age=([DateTime]::UtcNow-[DateTime]::Parse($s.at).ToUniversalTime()).TotalSeconds
  if ($age -lt -1 -or $age -gt 15 -or [DateTime]::Parse($s.at).ToUniversalTime() -lt [DateTime]::Parse($p.pauseStartedAt).ToUniversalTime() -or $s.activationId -cne $p.activationId -or $s.instanceId -cne $id.instanceId -or [int]$s.controllerPid -ne [int]$id.pid -or !$s.paused -or !$s.controllerAlive -or !$s.processInventoryKnown -or @($s.active).Count -ne 0 -or [int]$s.runningCount -ne 0 -or $null -ne $s.deliveryInFlight) { throw 'Fresh paused idle controller proof is missing' }
  if ($requireCapacity -and $s.supportedMaxWorkers -ne 5) { throw 'Reloaded controller lacks reviewed five-worker support' }
  return $s
}
function Controllers { return @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($scriptPath,[StringComparison]::OrdinalIgnoreCase) -ge 0}) }
try {
  Check-Paused $old $false | Out-Null
  $proc=Exact-Process $old
  if (!$proc) { throw 'Expected idle controller is absent before reload' }
  $parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$proc.ParentProcessId)
  if (!$parent -or $parent.Name -notmatch '^(powershell|pwsh)\.exe$' -or !$parent.CommandLine -or $parent.CommandLine.IndexOf($startPath,[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'Controller parent is not the existing launcher' }
  if (@(Controllers).Count -ne 1) { throw 'Controller uniqueness changed before reload' }
  $task=Check-Task
  Save-Reload 'VERIFIED_IDLE_OWNED_PAUSE'
  Stop-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath
  Check-Ownership; Check-Hashes; Check-Task | Out-Null
  $proc=Exact-Process $old
  if ($proc) {
    Check-Paused $old $false | Out-Null
    $proc=Exact-Process $old
    if (!$proc) { throw 'Expected controller disappeared before exact termination' }
    Stop-Process -Id ([int]$old.pid) -ErrorAction Stop
    $r.exactControllerStopped=$true
  }
  Save-Reload 'OLD_CONTROLLER_STOP_REQUESTED'
  for ($i=0;$i -lt 20;$i++) {
    $remaining=Observe-OriginalExit $old
    $task=Check-Task
    if (!$remaining -and [string]$task.State -ne 'Running') { break }
    Start-Sleep -Milliseconds 250
  }
  if ((Observe-OriginalExit $old) -or [string]$task.State -eq 'Running') { throw 'Old controller/task still active; no duplicate start' }
  Check-Ownership; Check-Hashes
  if (@(Controllers).Count -ne 0) { throw 'Unexpected controller exists; no duplicate start' }
  $actual=Get-Content -LiteralPath (Join-Path $rt 'CONTROLLER_IDENTITY.json') -Raw | ConvertFrom-Json
  if (!(Same-Identity $actual $old)) { throw 'Controller changed before scheduled restart' }
  if (Test-Path -LiteralPath $lockPath) { $lock=Get-Content -LiteralPath $lockPath -Raw|ConvertFrom-Json; if (!(Same-Identity $lock $old)) { throw 'Foreign controller lock appeared' } }
  $task=Check-Task
  $r.scheduledStarts=1; Save-Reload 'STARTING_EXISTING_SCHEDULED_TASK_ONCE'
  Start-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath
  $next=$null
  for ($i=0;$i -lt 40;$i++) {
    Start-Sleep -Milliseconds 500
    $candidate=Get-Content -LiteralPath (Join-Path $rt 'CONTROLLER_IDENTITY.json') -Raw|ConvertFrom-Json
    if ([string]$candidate.instanceId -cne [string]$old.instanceId -and !(Same-Identity $candidate $old)) {
      $candidateProcess=Exact-Process $candidate
      $s=Get-Content -LiteralPath (Join-Path $rt 'ACTIVE_TASKS.json') -Raw|ConvertFrom-Json
      if ($candidateProcess -and $s.instanceId -ceq $candidate.instanceId -and $s.paused -and $s.supportedMaxWorkers -eq 5) { $next=$candidate;break }
    }
  }
  if (!$next) { throw 'Fresh scheduled replacement controller was not observed' }
  Check-Paused $next $true | Out-Null
  Check-Task | Out-Null
  $newProcess=Exact-Process $next
  $newParent=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$newProcess.ParentProcessId)
  if (!$newParent -or $newParent.Name -notmatch '^(powershell|pwsh)\.exe$' -or !$newParent.CommandLine -or $newParent.CommandLine.IndexOf($startPath,[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'Replacement controller parent differs from existing launcher' }
  if (@(Controllers).Count -ne 1) { throw 'Replacement controller uniqueness failed' }
  $r.newIdentity=$next; Save-Reload 'RELOADED_SINGLE_CURRENT_CONTROLLER'
  $r|ConvertTo-Json -Depth 10 -Compress
} catch {
  $r.error=$_.Exception.Message
  Save-Reload 'RELOAD_FAILED'
  throw
}
`;
}