param(
  [string]$Archive = 'D:\Abdullah Projects\RakeezX\font\Thmanyah-Font-Family.zip'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($Archive)
try {
  $weights = [ordered]@{ '400' = 'Regular'; '500' = 'Medium'; '700' = 'Bold'; '900' = 'Black' }
  $result = @('// Generated from original Thmanyah Sans WOFF2 bytes. Application data, not a font endpoint.', 'export const protectedFaces = {')
  foreach ($weight in $weights.Keys) {
    $name = $weights[$weight]
    $path = "thmanyah typeface/thmanyahsans/woff2/thmanyahsans-$name.woff2"
    $entry = $zip.GetEntry($path)
    if ($null -eq $entry) { throw "Missing original font: $name" }
    $stream = $entry.Open()
    try {
      $memory = [System.IO.MemoryStream]::new()
      try { $stream.CopyTo($memory); $original = $memory.ToArray() }
      finally { $memory.Dispose() }
    } finally { $stream.Dispose() }
    if ([Text.Encoding]::ASCII.GetString($original, 0, 4) -ne 'wOF2') { throw "Invalid WOFF2: $name" }
    $digest = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($digest.ComputeHash($original)).Replace('-', '').ToLowerInvariant() }
    finally { $digest.Dispose() }
    $masked = [byte[]]::new($original.Length)
    for ($i = 0; $i -lt $original.Length; $i++) {
      $masked[$i] = $original[$i] -bxor (($i * 73 + [int]$weight + 41) -band 255)
    }
    $encoded = [Convert]::ToBase64String($masked)
    $result += "  '$weight': { name: '$name', length: $($original.Length), sha256: '$hash', data: '$encoded' },"
    Write-Output "$weight $name $($original.Length) $hash"
  }
  $result += '};'
  [IO.File]::WriteAllLines((Join-Path $PSScriptRoot '../src/lib/thmanyah-payload.js'), $result, [Text.UTF8Encoding]::new($false))
} finally { $zip.Dispose() }
