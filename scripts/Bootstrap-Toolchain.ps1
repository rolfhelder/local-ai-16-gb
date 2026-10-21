[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
$nodeVersion = '24.22.1'
$pnpmVersion = '12.14.0'
$runtimeDirectory = Join-Path $labRoot 'runtime'
$nodeDirectory = Join-Path $runtimeDirectory 'node'
$downloadDirectory = Join-Path $labRoot 'downloads'
New-Item -ItemType Directory -Force -Path $runtimeDirectory, $downloadDirectory | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $nodeDirectory 'node.exe'))) {
    $asset = "node-v$nodeVersion-win-x64.zip"
    $baseUrl = "https://nodejs.org/dist/v$nodeVersion"
    $archive = Join-Path $downloadDirectory $asset
    $checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt").Content
    $checksumLine = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith("  $asset") } | Select-Object -First 1)
    if (-not $checksumLine) { throw 'Official Node checksum entry missing.' }
    $expectedHash = ($checksumLine.Trim() -split '\s+')[0]
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$asset" -OutFile $archive
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash.ToLowerInvariant()) { throw 'Node archive checksum mismatch.' }
    $extractDirectory = Join-Path $downloadDirectory "node-$nodeVersion-extracted"
    if (Test-Path -LiteralPath $extractDirectory) { throw 'Node extraction directory already exists; inspect it before retrying.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $extractDirectory
    Copy-Item -LiteralPath (Join-Path $extractDirectory "node-v$nodeVersion-win-x64") -Destination $nodeDirectory -Recurse
    Write-Output "Installed portable Node $nodeVersion (SHA256 verified)."
}
$nodeExe = Join-Path $nodeDirectory 'node.exe'
$actualNodeVersion = & $nodeExe --version
if ($actualNodeVersion.Trim() -ne "v$nodeVersion") { throw "Unexpected Node version: $actualNodeVersion" }
$oldPath = $env:PATH
try {
    $env:PATH = $nodeDirectory + ';' + $env:PATH
    $pnpmPrefix = Join-Path $runtimeDirectory 'pnpm'
    $pnpmCommand = Join-Path $pnpmPrefix 'node_modules/.bin/pnpm.cmd'
    if (-not (Test-Path -LiteralPath $pnpmCommand)) {
        New-Item -ItemType Directory -Force -Path $pnpmPrefix | Out-Null
        Copy-Item -LiteralPath (Join-Path $labRoot 'config/pnpm-bootstrap/package.json') -Destination (Join-Path $pnpmPrefix 'package.json')
        Copy-Item -LiteralPath (Join-Path $labRoot 'config/pnpm-bootstrap/package-lock.json') -Destination (Join-Path $pnpmPrefix 'package-lock.json')
        & (Join-Path $nodeDirectory 'npm.cmd') ci --prefix $pnpmPrefix --cache (Join-Path $labRoot '.state/npm-cache') --ignore-scripts --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'pnpm installation failed.' }
    }
    $actualPnpmVersion = & $pnpmCommand --version
    if ($actualPnpmVersion.Trim() -ne $pnpmVersion) { throw "Unexpected pnpm version: $actualPnpmVersion" }
    Write-Output "Portable Node $actualNodeVersion and pnpm $actualPnpmVersion are ready."
} finally { $env:PATH = $oldPath }
& (Join-Path $PSScriptRoot 'Install-SearchTools.ps1')
