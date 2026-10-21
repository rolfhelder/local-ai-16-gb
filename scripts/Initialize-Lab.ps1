[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
$siblingAssets = Join-Path (Split-Path -Parent $labRoot) 'local-ai'
$configPath = Join-Path $labRoot 'machine.local.json'
if (-not (Test-Path -LiteralPath $configPath)) {
    $assetsRoot = $labRoot
    if (Test-Path -LiteralPath (Join-Path $siblingAssets 'tools/pi/1.3.0/pi.exe')) { $assetsRoot = $siblingAssets }
    $piPath = Join-Path $assetsRoot 'tools/pi/1.3.0/pi.exe'
    $llamaPath = Join-Path $assetsRoot 'tools/llama.cpp/b11669/llama-server.exe'
    if ($assetsRoot -eq $labRoot) {
        $piPath = Join-Path $labRoot 'runtime/pi/pi.exe'
        $llamaPath = Join-Path $labRoot 'runtime/llama.cpp/llama-server.exe'
    }
    [ordered]@{
        PiExecutable = $piPath
        LlamaExecutable = $llamaPath
        ModelsDirectory = (Join-Path $assetsRoot 'models')
        RouterUrl = 'http://127.0.0.1:48763'
        Port = 48763
        ContextSize = 204800
        GpuLayers = 999
        ParallelSlots = 1
        Reasoning = $true
        ReasoningBudget = 2048
        MaxTokens = 8192
    } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    Write-Output 'Created machine.local.json; check executable and model paths.'
} else { Write-Output 'Preserved existing machine.local.json.' }
$agentDirectory = Join-Path $labRoot '.state/agent'
New-Item -ItemType Directory -Force -Path $agentDirectory | Out-Null
$settingsPath = Join-Path $agentDirectory 'settings.json'
if (-not (Test-Path -LiteralPath $settingsPath)) {
    $settings = Get-Content -Raw -LiteralPath (Join-Path $labRoot 'config/settings.example.json') | ConvertFrom-Json
    $settings | Add-Member -NotePropertyName prompts -NotePropertyValue @((Join-Path $labRoot 'prompts'))
    $settings | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $settingsPath -Encoding UTF8
    Write-Output 'Created isolated Pi settings with repository prompt paths.'
} else { Write-Output 'Preserved existing isolated Pi settings.' }
