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
