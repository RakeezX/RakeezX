param(
  [Parameter(Mandatory=$true)][string]$TaskFile,
  [Parameter(Mandatory=$true)][string]$AttemptFile
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read-Json([string]$File) { [System.IO.File]::ReadAllText($File, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
function Get-WorkerExecutionProfile($Task, $Spec) {
  # Latest PO choice supersedes historical model/speed annotations, never data authority.
  $profile = Read-Json (Join-Path $PSScriptRoot 'worker-profile-policy.json')
  if ($profile.version -ne 1 -or $profile.authorityRef -ne 'PO-20261031-USER-UNIFORM-SOL-MEDIUM-STANDARD' -or
      $profile.model -ne 'gpt-6.1-sol' -or $profile.effort -ne 'medium' -or $profile.speed -ne 'Standard' -or
      $profile.serviceTier -ne 'default' -or $profile.fastMode -ne $false) { throw 'Current PO worker profile mismatch' }
  $singleAgent = $Task.executionProfile.singleAgent -eq $true
  $settings = @('features.fast_mode=false','service_tier=default')
  if ($singleAgent) { $settings += @('features.multi_agent=false','features.multi_agent_v2=false') }
  return @{ model=$profile.model; effort=$profile.effort; speed=$profile.speed; serviceTier=$profile.serviceTier;
    fastMode=$false; singleAgent=$singleAgent; authorityRef=$profile.authorityRef; config=$settings }
}
function Save-Checkpoint {
  $checkpoint.heartbeatAt = [DateTime]::UtcNow.ToString('o')
  $temporary = "$($spec.checkpointPath).$PID.tmp"
  [System.IO.File]::WriteAllText($temporary, ($checkpoint | ConvertTo-Json -Depth 8), $utf8)
  # AI: a bounded sharing collision must not abort the owned worker. Keep atomic replacement.
  try {
    for ($checkpointRetry = 0; ; $checkpointRetry++) {
      try {
        if ([System.IO.File]::Exists($spec.checkpointPath)) { [System.IO.File]::Replace($temporary, $spec.checkpointPath, [NullString]::Value) }
        else { [System.IO.File]::Move($temporary, $spec.checkpointPath) }
        break
      } catch {
        $checkpointFailure = $_.Exception.GetBaseException()
        $checkpointNativeCode = $checkpointFailure.HResult -band 0xffff
        if ($checkpointRetry -ge 10 -or $checkpointNativeCode -notin @(32, 33, 1175)) { throw }
        Start-Sleep -Milliseconds 50
      }
    }
  } finally {
    if ([System.IO.File]::Exists($temporary)) { [System.IO.File]::Delete($temporary) }
  }
}
function Quote-Argument([string]$Value) {
  # CommandLineToArgvW quoting, including literal quotes and trailing backslashes.
  $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
  $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
  return '"' + $escaped + '"'
}
function Birth-Time([int]$ProcessId) {
  $row = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
  if (!$row) { return $null }; return $row.CreationDate.ToUniversalTime().ToString('o')
}
function Capture-Session {
  if ($checkpoint.sessionId -or ![System.IO.File]::Exists($spec.jsonlPath)) { return }
  $reader = $null; $stream = $null
  try {
    $stream = [System.IO.File]::Open($spec.jsonlPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $bytes = New-Object byte[] ([Math]::Min(65536, $stream.Length))
    $count = $stream.Read($bytes, 0, $bytes.Length)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes, 0, $count)
    foreach ($line in ($text -split "`n")) {
      try { $event = $line | ConvertFrom-Json } catch { continue }
      if ($event.type -eq 'thread.started' -and $event.thread_id) { $checkpoint.sessionId = [string]$event.thread_id; break }
    }
  } finally { if ($stream) { $stream.Dispose() } }
}

$TaskFile = (Resolve-Path -LiteralPath $TaskFile).Path
$AttemptFile = (Resolve-Path -LiteralPath $AttemptFile).Path
$spec = Read-Json $AttemptFile; $task = Read-Json $TaskFile
if ($spec.taskId -ne $task.id -or $spec.runId -ne $task.attempt.runId -or $spec.activationId -ne $task.activationId -or $task.status -ne 'running') { throw 'Attempt is not the currently activated running card' }
if (![System.IO.Path]::GetFullPath($spec.taskFile).Equals($TaskFile, [StringComparison]::OrdinalIgnoreCase)) { throw 'Attempt task path mismatch' }
$attemptLock = [System.IO.File]::Open((Join-Path (Split-Path $AttemptFile) 'wrapper.lock'), [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
$checkpoint = [ordered]@{
  version = 1; taskId = $task.id; activationId = $task.activationId; runId = $spec.runId
  runnerPid = $PID; runnerCreatedAt = (Birth-Time $PID); codexPid = $null; codexCreatedAt = $null
  sessionId = $spec.sessionId; startedAt = [DateTime]::UtcNow.ToString('o'); heartbeatAt = $null
  status = 'starting'; codexExitedAt = $null; finishedAt = $null; exitCode = $null; error = $null
}
$child = $null; $outStream = $null; $errStream = $null; $copyOut = $null; $copyErr = $null
try {
  Save-Checkpoint
  if (!(Test-Path -LiteralPath $spec.codexPath -PathType Leaf)) { throw 'Configured tested Codex executable is missing' }
  if (!(Test-Path -LiteralPath $spec.cwd -PathType Container)) { throw 'Candidate worktree is missing' }
  $arguments = New-Object System.Collections.Generic.List[string]
  $arguments.Add('exec')
  if ($spec.sessionId) { $arguments.Add('resume') }
  $executionProfile = Get-WorkerExecutionProfile $task $spec
  $arguments.Add('--model'); $arguments.Add([string]$executionProfile.model)
  $arguments.Add('-c'); $arguments.Add('model_reasoning_effort=' + [string]$executionProfile.effort)
  foreach ($setting in $executionProfile.config) { $arguments.Add('-c'); $arguments.Add([string]$setting) }
  $checkpoint['executionProfile'] = $executionProfile
  $arguments.Add('-c'); $arguments.Add('approval_policy=never')
  if ($spec.sessionId) {
    # The installed exec-resume has no -C/--sandbox option. Preserve exact cwd
    # through ProcessStartInfo and set sandbox through the supported config flag.
    $arguments.Add('-c'); $arguments.Add($(if ($spec.readOnly) { 'sandbox_mode=read-only' } else { 'sandbox_mode=danger-full-access' }))
  } else {
    $arguments.Add('--sandbox'); $arguments.Add($(if ($spec.readOnly) { 'read-only' } else { 'danger-full-access' }))
  }
  $arguments.Add('--json'); $arguments.Add('--output-schema'); $arguments.Add([string]$spec.schemaPath)
  $arguments.Add('-o'); $arguments.Add([string]$spec.outputPath)
  if ($spec.sessionId) { $arguments.Add([string]$spec.sessionId) }
  $arguments.Add('-')
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = [string]$spec.codexPath
  $start.Arguments = (($arguments | ForEach-Object { Quote-Argument $_ }) -join ' ')
  $start.WorkingDirectory = [string]$spec.cwd
  $start.UseShellExecute = $false; $start.CreateNoWindow = $true
  $start.RedirectStandardInput = $true; $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
  $start.StandardOutputEncoding = $utf8; $start.StandardErrorEncoding = $utf8
  # Readers (controller/recovery) may inspect event logs while the child writes.
  $outStream = [System.IO.File]::Open($spec.jsonlPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
  $errStream = [System.IO.File]::Open($spec.stderrPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
  $child = New-Object System.Diagnostics.Process; $child.StartInfo = $start
  if (!$child.Start()) { throw 'Codex process did not start' }
  $checkpoint.codexPid = $child.Id; $checkpoint.codexCreatedAt = Birth-Time $child.Id; $checkpoint.status = 'running'
  Save-Checkpoint
  $copyOut = $child.StandardOutput.BaseStream.CopyToAsync($outStream)
  $copyErr = $child.StandardError.BaseStream.CopyToAsync($errStream)
  # Windows PowerShell 5.1 / .NET Framework does not expose StandardInputEncoding.
  # Write explicit UTF-8 bytes and close the raw pipe without the default writer.
  $promptBytes = $utf8.GetBytes([System.IO.File]::ReadAllText($spec.promptPath, [System.Text.Encoding]::UTF8))
  $inputPipe = $child.StandardInput.BaseStream
  $inputPipe.Write($promptBytes, 0, $promptBytes.Length); $inputPipe.Flush(); $inputPipe.Close()
  $terminalCleanupLastAttempt = $null
  $monitorTerminal = {
    # A saved final turn can outlive its CLI teardown. This does not stop active work.
    if ([System.IO.File]::Exists($spec.outputPath) -and [System.IO.File]::Exists($spec.jsonlPath)) {
      $now = [DateTime]::UtcNow
      $quietSince = [System.IO.File]::GetLastWriteTimeUtc($spec.outputPath)
      $logWritten = [System.IO.File]::GetLastWriteTimeUtc($spec.jsonlPath)
      if ($logWritten -gt $quietSince) { $quietSince = $logWritten }
      if (($now - $quietSince).TotalSeconds -ge 120 -and (!$terminalCleanupLastAttempt -or ($now - $terminalCleanupLastAttempt).TotalSeconds -ge 60)) {
        $terminalCleanupLastAttempt = $now
        try {
          $cleanupNode = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
          $cleanupText = & $cleanupNode (Join-Path $PSScriptRoot 'terminal-worker-cleanup.mjs') $TaskFile $AttemptFile
          if ($LASTEXITCODE -eq 0 -and $cleanupText) { $checkpoint['terminalCleanup'] = ($cleanupText | ConvertFrom-Json) }
          else { $checkpoint['terminalCleanupError'] = 'Terminal cleanup declined; saved result and ordinary lifecycle preserved' }
        } catch { $checkpoint['terminalCleanupError'] = 'Terminal cleanup unavailable; saved result and ordinary lifecycle preserved' }
        Save-Checkpoint
      }
    }
  }
  while (!$child.WaitForExit(2000)) { $outStream.Flush(); $errStream.Flush(); Capture-Session; Save-Checkpoint; . $monitorTerminal }
  $checkpoint.codexExitedAt = [DateTime]::UtcNow.ToString('o'); Save-Checkpoint
  while (!$copyOut.IsCompleted -or !$copyErr.IsCompleted) { . $monitorTerminal; Start-Sleep -Milliseconds 2000 }
  $copyOut.GetAwaiter().GetResult(); $copyErr.GetAwaiter().GetResult()
  $outStream.Flush(); $errStream.Flush(); Capture-Session
  $checkpoint.exitCode = $child.ExitCode; $checkpoint.status = 'exited'; $checkpoint.finishedAt = [DateTime]::UtcNow.ToString('o')
  Save-Checkpoint
} catch {
  $checkpoint.error = $_.Exception.Message; $checkpoint.status = 'wrapper_error'; $checkpoint.finishedAt = [DateTime]::UtcNow.ToString('o')
  $checkpoint.exitCode = 1
  try { Capture-Session; Save-Checkpoint } catch { Write-Error $_ -ErrorAction Continue }
} finally {
  if ($outStream) { $outStream.Dispose() }; if ($errStream) { $errStream.Dispose() }
  if ($child) { $child.Dispose() }; if ($attemptLock) { $attemptLock.Dispose() }
}
# The wrapper never rewrites queue states and never invokes another scheduler.
exit ([int]$checkpoint.exitCode)
