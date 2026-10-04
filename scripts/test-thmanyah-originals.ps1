param([string]$Archive = 'D:\Abdullah Projects\RakeezX\font\Thmanyah-Font-Family.zip')

$ErrorActionPreference = 'Stop'
$decoded = @(node scripts/guard-thmanyah-assets.mjs)
if ($LASTEXITCODE -ne 0) { throw 'Protected payload guard failed' }
$map = @{}
foreach ($line in $decoded) {
  if ($line -match '^(400|500|700|900) (Regular|Medium|Bold|Black) (\d+) ([0-9a-f]{64})$') {
    $map[$Matches[1]] = @{ Name = $Matches[2]; Length = [int]$Matches[3]; Hash = $Matches[4] }
  }
}
if ($map.Count -ne 4) { throw 'Protected face inventory incomplete' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
try {
  foreach ($weight in @('400','500','700','900')) {
    $face = $map[$weight]
    $entry = $zip.GetEntry("thmanyah typeface/thmanyahsans/woff2/thmanyahsans-$($face.Name).woff2")
    if ($null -eq $entry) { throw "Original missing for weight $weight" }
    $stream = $entry.Open()
    try {
      $sha = [Security.Cryptography.SHA256]::Create()
      try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
      finally { $sha.Dispose() }
    } finally { $stream.Dispose() }
    if ($entry.Length -ne $face.Length -or $hash -ne $face.Hash) { throw "Original mismatch for weight $weight" }
  }
} finally { $zip.Dispose() }
Write-Output 'PASS: 4 reconstructed faces match local original bytes by SHA-256 and length'
