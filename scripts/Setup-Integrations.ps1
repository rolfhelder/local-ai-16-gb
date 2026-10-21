[CmdletBinding()]
param([switch]$SkipResearchBrowser)
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
$oldPath = $env:PATH
$oldBrowserCache = $env:CAMOUFOX_INSTALL_DIR
$oldStrictSetup = $env:PI_RESEARCH_STRICT_SETUP
$oldHelper = $env:PI_COMPUTER_USE_WINDOWS_HELPER_PATH
$oldPlaywrightCache = $env:PLAYWRIGHT_BROWSERS_PATH
try {
    . (Join-Path $PSScriptRoot 'Activate-Tools.ps1')
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $labRoot 'runtime/playwright-cache'
    Push-Location -LiteralPath $labRoot
    try {
        pnpm install --ignore-scripts --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'Dependency restore failed.' }
        $env:PI_COMPUTER_USE_WINDOWS_HELPER_PATH = Join-Path $labRoot 'runtime/computer/windows-bridge.exe'
        node (Join-Path $labRoot 'node_modules/@injaneity/pi-computer-use/scripts/setup-helper.mjs') --platform windows
        if ($LASTEXITCODE -ne 0) { throw 'Windows helper installation failed.' }
        if (-not $SkipResearchBrowser) {
            $env:CAMOUFOX_INSTALL_DIR = Join-Path $labRoot 'runtime/research-browser-cache'
            $env:PI_RESEARCH_STRICT_SETUP = '1'
            node (Join-Path $labRoot 'node_modules/@lincoln504/pi-research/scripts/setup.cjs')
            if ($LASTEXITCODE -ne 0) { throw 'Research browser setup failed.' }
        }
        $settingsPath = Join-Path $labRoot '.state/agent/settings.json'
        $settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
        Push-Location -LiteralPath (Join-Path $labRoot '.state')
        try {
            playwright-cli install --skills agents
            if ($LASTEXITCODE -ne 0) { throw 'Playwright skill setup failed.' }
        } finally { Pop-Location }
        $skillDirectory = Join-Path $labRoot '.state/.agents/skills'
        $skillPaths = @($skillDirectory)
        if ($settings.PSObject.Properties.Name -contains 'skills') { $skillPaths = @(@($settings.skills) + $skillDirectory | Select-Object -Unique) }
        $settings | Add-Member -NotePropertyName skills -NotePropertyValue $skillPaths -Force
        $localPackages = @(
            (Join-Path $labRoot 'node_modules/@lincoln504/pi-research'),
            (Join-Path $labRoot 'node_modules/@injaneity/pi-computer-use')
        )
        $settings.packages = @(@($settings.packages) + $localPackages | Select-Object -Unique)
        $settings | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $settingsPath -Encoding UTF8
        $machinePath = Join-Path $labRoot 'machine.local.json'
        $machine = Get-Content -Raw -LiteralPath $machinePath | ConvertFrom-Json
        $machine.PiExecutable = Join-Path $labRoot 'node_modules/.bin/pi.cmd'
        $machine | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $machinePath -Encoding UTF8
        Write-Output 'Selected Node-based Pi 1.3.0; standalone executable was incompatible with Research in the local load check.'
        Write-Output 'Registered the two local extension packages in the isolated Pi profile.'
    } finally { Pop-Location }
} finally {
    $env:PATH = $oldPath
    $env:CAMOUFOX_INSTALL_DIR = $oldBrowserCache
    $env:PI_RESEARCH_STRICT_SETUP = $oldStrictSetup
    $env:PI_COMPUTER_USE_WINDOWS_HELPER_PATH = $oldHelper
    $env:PLAYWRIGHT_BROWSERS_PATH = $oldPlaywrightCache
}
