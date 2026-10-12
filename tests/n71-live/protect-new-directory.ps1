param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference='Stop'
$expected='C:\Users\Abody\Projects\RakeezX\artifacts\ops-supervisor-v4\capabilities\n71\fc77ae70-4cfa-4d2e-98ba-89232fe3c4f4'
$resolved=(Resolve-Path -LiteralPath $Directory).Path
if($resolved -ne $expected -or @(Get-ChildItem -LiteralPath $resolved -Force).Count -ne 0){throw 'Only the new empty N71 private directory may be protected'}
$identitySid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls $resolved /inheritance:r /grant:r "*$($identitySid):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F'
if($LASTEXITCODE -ne 0){throw 'Fresh-directory protection failed; do not write secrets'}
