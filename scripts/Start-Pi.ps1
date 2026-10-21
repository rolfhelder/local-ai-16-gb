[CmdletBinding()]
param([string]$WorkingDirectory, [switch]$DryRun)
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
if (-not $WorkingDirectory) { $WorkingDirectory = $labRoot }
$config = Get-Content -Raw -LiteralPath (Join-Path $labRoot 'machine.local.json') | ConvertFrom-Json
$agentDirectory = Join-Path $labRoot '.state/agent'
$launchEnvironment = [ordered]@{
    PI_CODING_AGENT_DIR = $agentDirectory
    LLAMA_BASE_URL = $config.RouterUrl
    PI_OFFLINE = '1'
    PI_TELEMETRY = '0'
    PI_SKIP_VERSION_CHECK = '1'
    CAMOUFOX_INSTALL_DIR = (Join-Path $labRoot 'runtime/research-browser-cache')
    PLAYWRIGHT_BROWSERS_PATH = (Join-Path $labRoot 'runtime/playwright-cache')
    PI_RESEARCH_KNOWLEDGE_STORE_RETRIEVAL = 'bm25'
    PI_RESEARCH_STATE_DIR = (Join-Path $labRoot '.state/research')
    PI_RESEARCH_MAX_RESEARCHERS = '1'
    PI_RESEARCH_WORKER_THREADS = '1'
    PI_RESEARCH_WORKER_CONCURRENCY = '1'
    PI_RESEARCH_MAX_CONCURRENT_SCRAPES = '1'
    PI_COMPUTER_USE_WINDOWS_HELPER_PATH = (Join-Path $labRoot 'runtime/computer/windows-bridge.exe')
    PI_COMPUTER_USE_BROWSER_USE = '0'
    PATH = (@((Join-Path $labRoot 'runtime/node'), (Join-Path $labRoot 'runtime/pnpm/node_modules/.bin'), (Join-Path $labRoot 'node_modules/.bin'), $env:PATH) -join ';')
}
if ($DryRun) {
    [ordered]@{ executable = $config.PiExecutable; workingDirectory = $WorkingDirectory; environment = $launchEnvironment } | ConvertTo-Json -Depth 5
    return
}
if (-not (Test-Path -LiteralPath $config.PiExecutable -PathType Leaf)) { throw 'Set PiExecutable in machine.local.json.' }
if (-not (Test-Path -LiteralPath (Join-Path $agentDirectory 'settings.json'))) { throw 'Run Initialize-Lab.ps1 first.' }
$previousEnvironment = @{}
foreach ($key in $launchEnvironment.Keys) {
    $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $launchEnvironment[$key], 'Process')
}
try {
    Push-Location -LiteralPath $WorkingDirectory
    try { & $config.PiExecutable } finally { Pop-Location }
} finally {
    foreach ($key in $launchEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process') }
}
