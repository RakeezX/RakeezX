param([Parameter(Mandatory=$true)][string]$Directory,[Parameter(Mandatory=$true)][string]$RunId)
$ErrorActionPreference='Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Use PowerShell 7 for fresh-directory protection' }
if ($RunId -notmatch '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') { throw 'Invalid current-run identity' }
$card=Get-Content -LiteralPath 'C:\Users\Abody\Projects\RakeezX\artifacts\ops-supervisor-v4\queue\continuous-n71-unified-restore-20261012.json' -Raw | ConvertFrom-Json
if ($card.attempt.runId -ne $RunId -or $card.productId -ne 'N71' -or $card.preparationAuthority.supabase.correctedVerificationPhase.retiredPair.runId -eq $RunId) { throw 'Directory must belong to the activated fresh N71 phase' }
$expected=Join-Path 'C:\Users\Abody\Projects\RakeezX\artifacts\ops-supervisor-v4\capabilities\n71' $RunId
$resolved=(Resolve-Path -LiteralPath $Directory).Path
if($resolved -ne $expected -or @(Get-ChildItem -LiteralPath $resolved -Force).Count -ne 0){throw 'Only the new empty N71 private directory may be protected'}
$identitySid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls $resolved /inheritance:r /grant:r "*$($identitySid):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F'
if($LASTEXITCODE -ne 0){throw 'Fresh-directory protection failed; do not write secrets'}
