param(
  [Parameter(Mandatory=$true)][ValidateSet('browser','integration','live-mutation')][string]$Name,
  [Parameter(Mandatory=$true)][ValidateSet('acquire','release','status','reap')][string]$Action,
  [Parameter(Mandatory=$true)][string]$TaskFile,
  [string]$RuntimeRoot = (Join-Path (Split-Path (Split-Path $PSScriptRoot)) 'artifacts\ops-supervisor-v4'),
  [ValidateRange(0,90)][int]$WaitSeconds = 30,
  [string]$OwnerToken = ''
)
$ErrorActionPreference = 'Stop'
function Json([string]$File) { [System.IO.File]::ReadAllText($File, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
function Same-Birth($Process, $Owner) {
  return ($Process -and $Owner.createdAt -and [int]$Process.ProcessId -eq [int]$Owner.pid -and
    $Process.CreationDate.ToUniversalTime().Ticks -eq ([DateTime]::Parse($Owner.createdAt)).ToUniversalTime().Ticks)
}
function Reap-Proven($Task, $Lease, $Processes) {
  $reap = $Task.lastWorkerReap
  $matches = $Lease.version -eq 2 -and $Lease.taskId -eq $Task.id -and $Lease.activationId -eq $Task.activationId -and $Lease.owner.type -eq 'worker' -and $reap.exactAbsence -eq $true -and $reap.activationId -eq $Task.activationId -and $reap.runId -eq $Lease.owner.token -and $reap.verifiedAbsentAt
  if (!$matches) { return $false }
  $ownerRecorded = @($reap.owners | Where-Object { $_.pid -eq $Lease.owner.pid -and $_.createdAt -eq $Lease.owner.createdAt }).Count -gt 0
  $surviving = @($reap.owners | Where-Object { $recorded = $_; @($Processes | Where-Object { Same-Birth $_ $recorded }).Count -gt 0 })
  return ($ownerRecorded -and $surviving.Count -eq 0)
}
function Owner-ForTask($Task, $Processes) {
  if ($Task.status -eq 'delivery') {
    $identity = Json (Join-Path $RuntimeRoot 'CONTROLLER_IDENTITY.json')
    if (!$Task.deliveryOwner -or $identity.instanceId -ne $Task.deliveryOwner.instanceId -or $identity.pid -ne $Task.deliveryOwner.pid) { throw 'Delivery controller identity mismatch' }
    $process = @($Processes | Where-Object { Same-Birth $_ $Task.deliveryOwner }) | Select-Object -First 1
    if (!$process -or $process.Name -notmatch '^node(?:\.exe)?$' -or $process.CommandLine -notlike '*controller.mjs*' -or $process.CommandLine -notlike "*$RuntimeRoot*") { throw 'Live delivery controller not verified' }
    return [pscustomobject]@{type='controller';pid=$process.ProcessId;createdAt=$process.CreationDate.ToUniversalTime().ToString('o');token=$identity.instanceId}
  }
  if ($Task.status -ne 'running' -or !$Task.attempt.runId) { throw 'Lease requires an active worker or verified delivery owner' }
  $checkpoint = Json $Task.attempt.checkpointPath
  if ($checkpoint.taskId -ne $Task.id -or $checkpoint.runId -ne $Task.attempt.runId) { throw 'Worker checkpoint mismatch' }
  $identity = [pscustomobject]@{pid=$checkpoint.runnerPid;createdAt=$checkpoint.runnerCreatedAt}
  $process = @($Processes | Where-Object { Same-Birth $_ $identity }) | Select-Object -First 1
  if (!$process -or $process.Name -notmatch '^(powershell|pwsh)\.exe$' -or $process.CommandLine -notlike '*run-task.ps1*' -or $process.CommandLine -notlike "*$TaskFile*" -or $process.CommandLine -notlike "*$($Task.attempt.specPath)*") { throw 'Exact worker process not verified' }
  return [pscustomobject]@{type='worker';pid=$process.ProcessId;createdAt=$process.CreationDate.ToUniversalTime().ToString('o');token=$Task.attempt.runId}
}
$TaskFile = (Resolve-Path -LiteralPath $TaskFile).Path
$RuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot).Path
$queue = (Resolve-Path -LiteralPath (Join-Path $RuntimeRoot 'queue')).Path
if (!(Split-Path $TaskFile).Equals($queue, [StringComparison]::OrdinalIgnoreCase)) { throw 'Lease requires the canonical queue card' }
$task = Json $TaskFile; $config = Json (Join-Path $RuntimeRoot 'workflow-v5.json')
if ($task.workflowVersion -ne 5 -or $task.activationId -ne $config.controller.activationId) { throw 'Card is outside the active controller authorization' }
$directory = Join-Path $RuntimeRoot 'leases'; $file = Join-Path $directory ($Name + '.json')
if ($Action -eq 'status') { if (Test-Path -LiteralPath $file) { Get-Content -Raw -LiteralPath $file -Encoding UTF8 } else { 'FREE' }; exit 0 }
if ($Action -eq 'reap') {
  if (!(Test-Path -LiteralPath $file)) { 'Already free'; exit 0 }
  $processes = @(Get-CimInstance Win32_Process -ErrorAction Stop)
  $identity = Json (Join-Path $RuntimeRoot 'CONTROLLER_IDENTITY.json')
  $controller = @($processes | Where-Object { Same-Birth $_ $identity }) | Select-Object -First 1
  if (!$controller -or $identity.instanceId -ne $OwnerToken -or $controller.Name -notmatch '^node(?:\.exe)?$' -or $controller.CommandLine -notlike '*controller.mjs*' -or $controller.CommandLine -notlike "*$RuntimeRoot*") { throw 'Lease reaping requires the verified live controller' }
  $lease = Json $file
  if (Reap-Proven $task $lease $processes) { Remove-Item -LiteralPath $file -ErrorAction Stop; 'REAPED ' + $Name; exit 0 }
  'NOT_REAPABLE ' + $Name; exit 3
}
if ($Name -eq 'integration' -and !$task.releaseAuthority) { throw 'Integration requires precise release authority' }
if ($Name -eq 'live-mutation' -and !$task.liveAuthorizationRef) { throw 'Live mutation lacks exact data authority' }
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$until = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
do {
  $processes = @(Get-CimInstance Win32_Process -ErrorAction Stop)
  $owner = Owner-ForTask $task $processes
  if ($OwnerToken -and $OwnerToken -ne $owner.token) { throw 'Requested lease token does not match the current owner' }
  if (Test-Path -LiteralPath $file) {
    $lease = Json $file
    $ours = $lease.version -eq 2 -and $lease.taskId -eq $task.id -and $lease.activationId -eq $task.activationId -and $lease.owner.token -eq $owner.token -and $lease.owner.pid -eq $owner.pid -and $lease.owner.createdAt -eq $owner.createdAt
    if ($ours) {
      if ($Action -eq 'release') { Remove-Item -LiteralPath $file -ErrorAction Stop; 'RELEASED ' + $Name } else { 'ALREADY OWNED ' + $Name }; exit 0
    }
    if ($Action -eq 'release') { throw 'Cannot release another owner lease' }
    # Reclaim only this same activated delivery's previous controller lease and
    # only after proving its exact PID/birth is absent. Unknown/legacy leases stay.
    $deadDeliveryOwner = $lease.version -eq 2 -and $Name -eq 'integration' -and $lease.taskId -eq $task.id -and $lease.activationId -eq $task.activationId -and $lease.owner.type -eq 'controller' -and $owner.type -eq 'controller' -and $lease.owner.createdAt -and $lease.owner.token
    if ($deadDeliveryOwner -and @($processes | Where-Object { Same-Birth $_ $lease.owner }).Count -eq 0) { Remove-Item -LiteralPath $file -ErrorAction Stop }
    # A resumed worker may recover its own prior phase lease only with the
    # controller's saved absence proof for every recorded owner/descendant.
    if ($owner.type -eq 'worker' -and (Reap-Proven $task $lease $processes) -and (Test-Path -LiteralPath $file)) { Remove-Item -LiteralPath $file -ErrorAction Stop }
  } elseif ($Action -eq 'release') { 'Already free'; exit 0 }
  if (!(Test-Path -LiteralPath $file)) {
    $stream = $null
    try { $stream = [System.IO.File]::Open($file, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read) }
    catch [System.IO.IOException] { $stream = $null }
    if ($stream) {
      try {
        $lease = [ordered]@{version=2;resource=$Name;taskId=$task.id;activationId=$task.activationId;owner=$owner;at=[DateTime]::UtcNow.ToString('o')}
        $bytes = [System.Text.Encoding]::UTF8.GetBytes(($lease | ConvertTo-Json -Compress -Depth 6)); $stream.Write($bytes, 0, $bytes.Length)
      } finally { $stream.Dispose() }
      'ACQUIRED ' + $Name; exit 0
    }
  }
  if ([DateTime]::UtcNow -lt $until) { Start-Sleep -Seconds 2 }
} while ([DateTime]::UtcNow -lt $until)
'BUSY ' + $Name + '; the recorded owner must finish or be factually recovered'
exit 3
