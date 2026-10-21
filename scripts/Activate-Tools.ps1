# Dot-source from PowerShell: . .\scripts\Activate-Tools.ps1
$labToolsRoot = Split-Path -Parent $PSScriptRoot
$labNodeDirectory = Join-Path $labToolsRoot 'runtime/node'
$labPnpmDirectory = Join-Path $labToolsRoot 'runtime/pnpm/node_modules/.bin'
$labPackageBin = Join-Path $labToolsRoot 'node_modules/.bin'
foreach ($labBinPath in @($labPackageBin, $labPnpmDirectory, $labNodeDirectory,(Join-Path $labToolsRoot 'runtime/search/fd-v10.5.0-x86_64-pc-windows-msvc'),(Join-Path $labToolsRoot 'runtime/search/ripgrep-15.2.0-x86_64-pc-windows-msvc'))) {
    if ((Test-Path -LiteralPath $labBinPath) -and (($env:PATH -split ';') -notcontains $labBinPath)) {
        $env:PATH = $labBinPath + ';' + $env:PATH
    }
}
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $labToolsRoot 'runtime/playwright-cache'
