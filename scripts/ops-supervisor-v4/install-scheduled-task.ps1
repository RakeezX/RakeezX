[CmdletBinding()]
param(
  [string]$RepoRoot = 'C:\Users\Abody\Projects\RakeezX',
  [string]$RuntimeRoot = '',
  [string]$NodePath = '',
  [string]$TaskName = 'RAKEEZ-Continuous-Delivery',
  [switch]$StartNow
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
Import-Module ScheduledTasks -ErrorAction Stop

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$expectedUser = 'ABDULLAH-MSI\Abody'
if (!$identity.Name.Equals($expectedUser, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Register under $expectedUser, not a different service account. No credentials are copied."
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path.TrimEnd('\')
if (!$RuntimeRoot) { $RuntimeRoot = Join-Path $RepoRoot 'artifacts\ops-supervisor-v4' }
$RuntimeRoot = [IO.Path]::GetFullPath($RuntimeRoot).TrimEnd('\')
$launcher = Join-Path $RepoRoot 'scripts\ops-supervisor-v4\start-ops.ps1'
if (!(Test-Path -LiteralPath $launcher -PathType Leaf)) { throw "Install launcher before scheduling: $launcher" }
if (!$NodePath) { $NodePath = (Get-Command node.exe -ErrorAction Stop).Source }
$NodePath = (Resolve-Path -LiteralPath $NodePath).Path
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (!(Test-Path -LiteralPath $powershellPath -PathType Leaf)) { throw 'Windows PowerShell executable was not found' }
foreach ($value in @($RepoRoot, $RuntimeRoot, $launcher, $NodePath)) {
  if ($value -match '["\r\n]') { throw 'Unexpected character in a scheduled command path' }
}
if ($TaskName -ne 'RAKEEZ-Continuous-Delivery') { throw 'This installer updates only RAKEEZ-Continuous-Delivery' }

$taskPath = '\'
$existing = Get-ScheduledTask -TaskName $TaskName -TaskPath $taskPath -ErrorAction SilentlyContinue
if ($existing) {
  $matchesLauncher = @($existing.Actions | Where-Object {
    $_.Arguments -and $_.Arguments.IndexOf($launcher, [StringComparison]::OrdinalIgnoreCase) -ge 0
  }).Count -gt 0
  if (!$matchesLauncher) { throw 'Task name is already used by a different action; inspect it before replacement' }
}

function Xml-Text([string]$Value) { [Security.SecurityElement]::Escape($Value) }
$arguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File "' + $launcher +
  '" -RepoRoot "' + $RepoRoot + '" -RuntimeRoot "' + $RuntimeRoot + '" -NodePath "' + $NodePath + '"'
$accountSid = Xml-Text $identity.User.Value
$commandXml = Xml-Text $powershellPath
$argumentsXml = Xml-Text $arguments
$workingDirectoryXml = Xml-Text $RepoRoot
$dailyStart = (Get-Date).Date.ToString("yyyy-MM-dd'T'HH:mm:ss")

# RemoteSigned applies only to this reviewed local-script process; do not change
# global execution policy or override a managed MachinePolicy/UserPolicy.
# One task, two triggers. IgnoreNew prevents periodic recovery from overlapping
# the waiting launcher. The controller also verifies its own single-instance lock.
# This requires an existing Abody logon. It does not recover a failed Scheduler service.
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>RAKEEZ controller under the existing Abody session. PO authority 2026-10-12 11:44 Asia/Riyadh. No quota resets or legacy daemons.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$accountSid</UserId>
    </LogonTrigger>
    <CalendarTrigger>
      <Repetition>
        <Interval>PT5M</Interval>
        <Duration>P1D</Duration>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>$dailyStart</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$accountSid</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec><Command>$commandXml</Command><Arguments>$argumentsXml</Arguments><WorkingDirectory>$workingDirectoryXml</WorkingDirectory></Exec>
  </Actions>
</Task>
"@
[xml]$parsedXml = $taskXml

New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
if ($existing) {
  $backupDirectory = Join-Path $RuntimeRoot ('scheduler-backup-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ'))
  New-Item -ItemType Directory -Path $backupDirectory -ErrorAction Stop | Out-Null
  Export-ScheduledTask -TaskName $TaskName -TaskPath $taskPath |
    Set-Content -LiteralPath (Join-Path $backupDirectory 'task-before.xml') -Encoding Unicode
}

# Registration may make the periodic trigger eligible immediately. Install config
# first; the controller honors STOP/STOP-REFILL. This script never removes them.
Register-ScheduledTask -TaskName $TaskName -TaskPath $taskPath -Xml $taskXml -Force | Out-Null
if ($StartNow) { Start-ScheduledTask -TaskName $TaskName -TaskPath $taskPath }

$registered = Get-ScheduledTask -TaskName $TaskName -TaskPath $taskPath
[pscustomobject]@{
  taskName = $registered.TaskName
  taskPath = $registered.TaskPath
  user = $expectedUser
  logonType = [string]$registered.Principal.LogonType
  runLevel = [string]$registered.Principal.RunLevel
  executionTimeLimit = [string]$registered.Settings.ExecutionTimeLimit
  multipleInstances = [string]$registered.Settings.MultipleInstances
  triggers = @($registered.Triggers).Count
  state = [string]$registered.State
  requestedImmediateStart = [bool]$StartNow
} | ConvertTo-Json -Compress
