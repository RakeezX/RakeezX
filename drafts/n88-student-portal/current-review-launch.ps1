# AI-authored: hidden bounded local review; no global locks, queue edits or deployment.
[CmdletBinding()]
param(
  [switch]$Help,
  [ValidateRange(1,28800)][int]$TtlSeconds = 14400,
  [string]$Receipt,
  [switch]$Stop,
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$Extra
)
$ErrorActionPreference = 'Stop'
if ($Help -or $Extra -contains '--help') {
  Write-Output 'N88 local synthetic review only. Live service remains disabled.'
  Write-Output 'Start: powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1 [-TtlSeconds 14400] [-Receipt <path>]'
  Write-Output 'Stop:  powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1 -Stop -Receipt <returned receipt path>'
  Write-Output 'TTL defaults to 4 hours, maximum 8 hours. Returns teacher URL, exact PID/birth and expiresAt. Installed Node/PG only; no downloads.'
  Write-Output 'Missing locked service dependencies are restored from the existing npm offline cache only.'
  exit 0
}
if ($Extra.Count) { throw 'Unknown arguments. Use --help.' }
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$receipts = Join-Path $root 'tests/fixtures/n88-current-review/receipts'
$entry = Join-Path $PSScriptRoot 'current-review.mjs'
if (-not $Receipt) {
  if ($Stop) { throw 'Stop requires the exact receipt path.' }
  $Receipt = Join-Path $receipts ('review-' + [guid]::NewGuid().ToString() + '.json')
}
$Receipt = [IO.Path]::GetFullPath($Receipt)
if (-not $Receipt.StartsWith($receipts + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($Receipt) -ne '.json') { throw 'Receipt must be inside the local review receipts directory.' }
function Read-Receipt { Get-Content -LiteralPath $Receipt -Raw | ConvertFrom-Json }
if ($Stop) {
  $r = Read-Receipt
  if ($r.status -eq 'stopped') { Write-Output ($r | ConvertTo-Json -Depth 6); exit 0 }
  $owned = Get-CimInstance Win32_Process -Filter "ProcessId = $($r.pid)"
  if (-not $owned -or $owned.CreationDate.ToUniversalTime().ToString('o') -ne $r.birth -or $owned.ExecutablePath -ne $r.executable -or $owned.CommandLine -ne $r.commandLine) { throw 'Process identity mismatch; no process touched.' }
  $phase = [IO.Path]::GetFullPath($r.phase)
  $fixture = Join-Path $root 'tests/fixtures/n88-integrated-class'
  if ([IO.Path]::GetDirectoryName($phase) -ne $fixture -or -not [IO.Path]::GetFileName($phase).StartsWith('owned-')) { throw 'Owned phase mismatch.' }
  @{pid=$r.pid;birth=$r.birth} | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $phase 'shutdown.request.json') -Encoding UTF8
  $deadline = [DateTime]::UtcNow.AddSeconds(40)
  do {
    Start-Sleep -Milliseconds 250
    $r = Read-Receipt
  } while ($r.status -ne 'stopped' -and [DateTime]::UtcNow -lt $deadline)
  if ($r.status -ne 'stopped') { throw 'Owned graceful shutdown deadline exceeded; no forced kill attempted.' }
} else {
  if (Test-Path -LiteralPath $Receipt) { throw 'Use a new receipt path.' }
  New-Item -ItemType Directory -Path $receipts -Force | Out-Null
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/@supabase/auth-js/package.json'))) {
    & npm.cmd ci --prefix $PSScriptRoot --offline --ignore-scripts --no-audit --no-fund | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Locked service dependencies unavailable in the existing offline npm cache; no server started.' }
  }
  $arguments = '"' + $entry + '" --receipt "' + $Receipt + '" --ttl-seconds ' + $TtlSeconds
  # Use the Windows shell's hidden launch. Redirecting child stdio switches to
  # handle inheritance and can keep a Node caller's pipes open until TTL expiry.
  $child = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  do {
    Start-Sleep -Milliseconds 250
    $child.Refresh()
    if ($child.HasExited -and -not (Test-Path -LiteralPath $Receipt)) { throw 'Review startup failed before its receipt; no private values logged.' }
  } while (-not (Test-Path -LiteralPath $Receipt) -and [DateTime]::UtcNow -lt $deadline)
  if (-not (Test-Path -LiteralPath $Receipt)) { throw 'Startup deadline exceeded. Bounded child retains its TTL; no unknown process killed.' }
  $r = Read-Receipt
  if ($r.pid -ne $child.Id) { throw 'Unexpected receipt process identity.' }
}
Write-Output (@{receiptPath=$Receipt;review=$r} | ConvertTo-Json -Depth 6)
