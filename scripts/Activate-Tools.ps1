# Dot-source from PowerShell: . .\scripts\Activate-Tools.ps1
$labToolsRoot = Split-Path -Parent $PSScriptRoot
$labNodeDirectory = Join-Path $labToolsRoot 'runtime/node'
$labPnpmDirectory = Join-Path $labToolsRoot 'runtime/pnpm/node_modules/.bin'
$labPackageBin = Join-Path $labToolsRoot 'node_modules/.bin'
foreach ($labBinPath in @($labPackageBin, $labPnpmDirectory, $labNodeDirectory)) {
    if ((Test-Path -LiteralPath $labBinPath) -and (($env:PATH -split ';') -notcontains $labBinPath)) {
        $env:PATH = $labBinPath + ';' + $env:PATH
    }
}
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $labToolsRoot 'runtime/playwright-cache'
