[CmdletBinding()]
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw -LiteralPath (Join-Path $labRoot 'machine.local.json') | ConvertFrom-Json
$serverArgs = @('--models-dir', $config.ModelsDirectory, '--no-models-autoload', '--models-max', '1',
    '--jinja', '--host', '127.0.0.1', '--port', [string]$config.Port,
    '-ngl', [string]$config.GpuLayers, '-c', [string]$config.ContextSize,
    '--parallel', [string]$config.ParallelSlots)
if ($DryRun) {
    [ordered]@{ executable = $config.LlamaExecutable; arguments = $serverArgs } | ConvertTo-Json -Depth 5
    return
}
if (-not (Test-Path -LiteralPath $config.LlamaExecutable -PathType Leaf)) { throw 'Set LlamaExecutable in machine.local.json.' }
if (-not (Test-Path -LiteralPath $config.ModelsDirectory -PathType Container)) { throw 'Set ModelsDirectory in machine.local.json.' }
if (-not (Get-ChildItem -LiteralPath $config.ModelsDirectory -Recurse -Filter '*.gguf' -File | Where-Object { $_.Name -notlike '*mmproj*' } | Select-Object -First 1)) {
    throw 'No completed GGUF model found. Finish downloading a model first; .part files cannot be loaded.'
}
Write-Output 'Starting router in this terminal. Ctrl+C stops it. Models load explicitly through Pi /llama.'
& $config.LlamaExecutable @serverArgs
if ($LASTEXITCODE -ne 0) { throw "llama-server exited with code $LASTEXITCODE" }
