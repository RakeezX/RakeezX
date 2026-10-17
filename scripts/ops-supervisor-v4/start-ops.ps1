param(
  [string]$RepoRoot = (Split-Path (Split-Path $PSScriptRoot)),
  [string]$RuntimeRoot = (Join-Path $RepoRoot 'artifacts\ops-supervisor-v4'),
  [string]$NodePath = 'node.exe'
)
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$RuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot).Path
$script = Join-Path $PSScriptRoot 'controller.mjs'
if (!(Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Controller script is missing' }
# Recover a Codex Desktop per-release path only from an already-running executable,
# not from arbitrary filesystem search or a second Codex process.
$configFile = Join-Path $RuntimeRoot 'workflow-v5.json'
$configText = [IO.File]::ReadAllText($configFile, [Text.Encoding]::UTF8)
$config = $configText | ConvertFrom-Json
if (-not $config.controller.codexPath) { throw 'Configured Codex executable is missing' }
if (-not [IO.File]::Exists([string]$config.controller.codexPath)) {
  if (-not $env:LOCALAPPDATA) { throw 'Cannot resolve authorized Codex install root' }
  $trustedRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin')).TrimEnd('\') + '\'
  $candidates = @(
    Get-Process -Name codex -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -and $_.Path.StartsWith($trustedRoot, [StringComparison]::OrdinalIgnoreCase) } |
      ForEach-Object { [IO.Path]::GetFullPath($_.Path) } |
      Where-Object {
        $subpath = $_.Substring($trustedRoot.Length)
        $subpath -match '^[a-fA-F0-9]{16}\\codex\.exe$' -and [IO.File]::Exists($_)
      } | Sort-Object -Unique
  )

  if ($candidates.Count -ne 1) {
    throw 'Codex CLI version changed and no single running trusted Codex Desktop executable was found. Launch Codex Desktop and allow scheduled recovery; do not guess a path.'
  }
  $config.controller.codexPath = [string]$candidates[0]
  $updated = $config | ConvertTo-Json -Depth 40
  $temp = $configFile + '.codex-path-' + [guid]::NewGuid().ToString('N') + '.tmp'
  try {
    [IO.File]::WriteAllText($temp, $updated + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
    if ([IO.File]::ReadAllText($configFile, [Text.Encoding]::UTF8) -cne $configText) {
      throw 'Controller config changed while resolving Codex path'
    }
    [IO.File]::Replace($temp, $configFile, [NullString]::Value)
  } finally {
    if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) }
  }
}

# Keep this Scheduled Task alive for the lifetime of the controller. Its existing
# Codex wrappers are separately recoverable; the next start adopts their IDs.
& $NodePath $script --repo $RepoRoot --runtime $RuntimeRoot --instance-id ([Guid]::NewGuid().ToString())
if ($null -eq $LASTEXITCODE) { exit 1 }; exit $LASTEXITCODE