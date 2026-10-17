$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\Abody\Projects\RakeezX'
$taskName = 'RAKEEZ-N36-Verified-Local-Update'
$node = 'C:\Program Files\nodejs\node.exe'
$vbs = Join-Path $repo 'scripts\ops-supervisor-v4\n36-stable-sync-hidden.vbs'
$script = Join-Path $repo 'scripts\ops-supervisor-v4\n36-stable-sync.mjs'
if (!(Test-Path -LiteralPath $node) -or !(Test-Path -LiteralPath $vbs) -or !(Test-Path -LiteralPath $script)) { throw 'Verified local updater files missing' }
$action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\wscript.exe" -Argument ('"' + $vbs + '"') -WorkingDirectory $repo
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$triggers = @(
  (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)),
  (New-ScheduledTaskTrigger -AtLogOn -User $principal.UserId)
)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Description -ne 'RAKEEZ N36 verified package to stable local folder only; PO 2026-10-17 12:48. No Chrome control, model worker or service change.' -or $existing.Actions.Execute -ne $action.Execute -or $existing.Actions.Arguments -ne $action.Arguments) { throw 'Existing task is not owned by this updater' }
}
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'RAKEEZ N36 verified package to stable local folder only; PO 2026-10-17 12:48. No Chrome control, model worker or service change.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
$task = Get-ScheduledTask -TaskName $taskName
[pscustomobject]@{ taskName=$task.TaskName; state=[string]$task.State; execute=$task.Actions.Execute; arguments=$task.Actions.Arguments; cadence='PT1M'; scope='local-verified-files-only' } | ConvertTo-Json -Compress
