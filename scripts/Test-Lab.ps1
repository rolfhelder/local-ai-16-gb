[CmdletBinding()]
param([switch]$CheckServer)
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw -LiteralPath (Join-Path $labRoot 'machine.local.json') | ConvertFrom-Json
foreach ($key in @('PiExecutable', 'LlamaExecutable', 'ModelsDirectory')) {
    [pscustomobject]@{ Check = $key; Available = (Test-Path -LiteralPath $config.$key); Value = $config.$key }
}
foreach ($name in @('git', 'node', 'npm', 'npx', 'pwsh', 'yt-dlp', 'ffmpeg', 'nvidia-smi')) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    [pscustomobject]@{ Check = $name; Available = [bool]$command; Value = $(if ($command) { $command.Source } else { 'Optional or not on PATH' }) }
}
$completeModels = @(Get-ChildItem -LiteralPath $config.ModelsDirectory -Recurse -Filter '*.gguf' -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '*mmproj*' })
[pscustomobject]@{ Check = 'CompleteModelFiles'; Available = ($completeModels.Count -gt 0); Value = $completeModels.Count }
if ($CheckServer) {
    foreach ($route in @('/health', '/models')) {
        $result = Invoke-RestMethod -Uri ($config.RouterUrl.TrimEnd('/') + $route) -TimeoutSec 10
        [pscustomobject]@{ Check = $route; Available = $true; Value = ($result | ConvertTo-Json -Depth 8 -Compress) }
    }
}
