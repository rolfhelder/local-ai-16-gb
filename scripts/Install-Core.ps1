[CmdletBinding()]
param([switch]$Plan, [switch]$Check, [ValidateSet('gemma','qwen','omnicoder','gpt-oss')][string]$AcceptModel)
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
if ($Plan -and $Check) { throw 'Choose -Plan or -Check.' }
$steps = @('Portable Node 24.22.1 + pnpm 12.14.0 + rg/fd', 'Frozen dependencies including Pi 1.3.0; lifecycle scripts disabled', 'Official llama.cpp b11669 Windows CUDA 12.4 binaries + runtime, SHA256 verified', 'Create missing machine.local.json; preserve existing configuration', 'Register local-ai/local-ai-app commands', 'Run doctor; model download and inference acceptance are explicit separate steps')
if ($Plan) { [ordered]@{Platform='Windows x64';Steps=$steps;ModelDownload='None';OptionalAssets='None';AcceptModel=$AcceptModel} | ConvertTo-Json -Depth 4; return }
if (-not [Environment]::Is64BitOperatingSystem -or $env:OS -ne 'Windows_NT') { throw 'This installer supports Windows x64 only; see README for other platforms.' }
$configPath = Join-Path $labRoot 'machine.local.json'
if ($Check) {
    $required = @('runtime/node/node.exe','runtime/pnpm/node_modules/.bin/pnpm.cmd','node_modules/@earendil-works/pi-coding-agent/package.json','machine.local.json')
    $missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $labRoot $_)) })
    if ($missing.Count) { throw ('Missing core files: ' + ($missing -join ', ')) }
    & (Join-Path $labRoot 'runtime/node/node.exe') (Join-Path $PSScriptRoot 'doctor.mjs')
    if ($LASTEXITCODE) { throw 'Doctor found a failed prerequisite. No files were changed.' }
    return
}
if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) { throw 'NVIDIA driver tools were not found. Install/verify the driver before this CUDA-only installer.' }
& nvidia-smi --query-gpu=name,driver_version --format=csv,noheader
if ($LASTEXITCODE) { throw 'NVIDIA driver query failed; no core assets were changed.' }
& (Join-Path $PSScriptRoot 'Bootstrap-Toolchain.ps1')
. (Join-Path $PSScriptRoot 'Activate-Tools.ps1')
Push-Location -LiteralPath $labRoot
try {
    # A full restore remains explicit, pinned and checked. No arbitrary dependency build scripts.
    & pnpm install --ignore-scripts --frozen-lockfile
    if ($LASTEXITCODE) { throw 'Dependency restore failed; inspect the package-manager error before retrying.' }
    $configured = if (Test-Path -LiteralPath $configPath) { Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json } else { $null }
    $llama = if ($configured) { $configured.LlamaExecutable } else { Join-Path $labRoot 'runtime/llama.cpp/llama-server.exe' }
    if (Test-Path -LiteralPath $llama) {
        $version = (& $llama --version 2>&1 | Out-String)
        if ($LASTEXITCODE -or $version -notmatch 'build 11669') { throw 'Existing llama.cpp is not the pinned build; preserved it. Choose a separate runtime path explicitly.' }
    } else {
        if ($configured) { throw 'Configured llama.cpp path is missing; preserved machine.local.json. Fix the path or install into a new checkout.' }
        $assetDirectory = Join-Path $labRoot 'downloads/core'
        $target = Join-Path $labRoot 'runtime/llama.cpp'
        New-Item -ItemType Directory -Force -Path $assetDirectory,$target | Out-Null
        foreach ($asset in (Get-Content -Raw -LiteralPath (Join-Path $labRoot 'manifests/llama-observed-assets.json') | ConvertFrom-Json)) {
            $archive = Join-Path $assetDirectory $asset.name
            if (-not (Test-Path -LiteralPath $archive)) {
                $partial = $archive + '.part'
                & curl.exe --fail --location --retry 3 --continue-at - --output $partial $asset.browser_download_url
                if ($LASTEXITCODE) { throw 'Runtime download interrupted; partial retained for resume.' }
                if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -ne ($asset.digest -replace '^sha256:','')) { throw 'Runtime checksum mismatch; partial preserved for inspection.' }
                Move-Item -LiteralPath $partial -Destination $archive
            }
            if ((Get-Item -LiteralPath $archive).Length -ne $asset.size -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne ($asset.digest -replace '^sha256:','')) { throw 'Runtime archive mismatch; existing file preserved.' }
            Expand-Archive -LiteralPath $archive -DestinationPath $target -Force
        }
        if (-not (Test-Path -LiteralPath $llama)) { throw 'Runtime extraction did not produce llama-server.exe.' }
    }
    if (-not (Test-Path -LiteralPath $configPath)) {
        $config = Get-Content -Raw -LiteralPath (Join-Path $labRoot 'config/machine.example.json') | ConvertFrom-Json
        $config.PiExecutable = Join-Path $labRoot 'node_modules/.bin/pi.cmd'
        $config.LlamaExecutable = $llama
        $config.ModelsDirectory = Join-Path $labRoot 'models'
        $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    }
    & (Join-Path $PSScriptRoot 'Install-LocalAI.ps1')
    & node (Join-Path $PSScriptRoot 'doctor.mjs')
    if ($LASTEXITCODE) { Write-Warning 'Some prerequisites (usually a not-yet-downloaded model) need attention; inspect the doctor report.' }
    Write-Output 'Core installation complete. Download a model using docs/INSTALL.md section 2.1; then run local-ai doctor --verify-model.'
    if ($AcceptModel) {
        & node (Join-Path $PSScriptRoot 'acceptance.mjs') --model $AcceptModel --run
        if ($LASTEXITCODE) { throw 'First-run acceptance failed; inspect its saved report.' }
    }
} finally { Pop-Location }
