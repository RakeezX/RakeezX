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
# Keep this Scheduled Task alive for the lifetime of the controller. Its existing
# Codex wrappers are separately recoverable; the next start adopts their IDs.
& $NodePath $script --repo $RepoRoot --runtime $RuntimeRoot --instance-id ([Guid]::NewGuid().ToString())
if ($null -eq $LASTEXITCODE) { exit 1 }; exit $LASTEXITCODE
