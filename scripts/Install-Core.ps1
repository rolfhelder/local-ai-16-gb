<#
.SYNOPSIS
Preview, inventory or install the pinned Windows core stack.
.DESCRIPTION
-Plan previews actions. -Check inspects installed components and registration.
Both modes are read-only and load no model. Add -Json for automation.
Use local-ai doctor for hardware/model health and local-ai test --run for inference.
#>
[CmdletBinding()]
param([switch]$Plan, [switch]$Check, [switch]$Json, [switch]$NoColor, [switch]$Ascii, [ValidateSet('gemma','qwen','omnicoder','gpt-oss')][string]$AcceptModel)
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
if ($Plan -and $Check) { throw 'Choose -Plan or -Check.' }
if ($Json -and -not ($Plan -or $Check)) { throw '-Json requires -Plan or -Check.' }
if ($Check -and $AcceptModel) { throw '-AcceptModel starts inference during installation; it cannot be used with -Check.' }
$useColor = -not ($NoColor -or $env:NO_COLOR -or [Console]::IsOutputRedirected) -and $Host.UI.SupportsVirtualTerminal
function Paint([string]$Text, [string]$Code='38;5;80') {
    if ($useColor) { return "$([char]27)[$($Code)m$Text$([char]27)[0m" }; return $Text
}
# Keep source ASCII so Windows PowerShell 5.1 parses UTF-8 files without a BOM.
$symbols = if ($Ascii) { @('+','-','|','+','+','+','OK','X','>') } else {
    @(0x256D,0x2500,0x2502,0x256E,0x2570,0x256F,0x2713,0x2717,0x203A | ForEach-Object { [string][char]$_ })
}
function Banner([string]$Title, [string]$Subtitle) {
    Write-Output (Paint ($symbols[0] + ($symbols[1] * 70) + $symbols[3]))
    Write-Output ((Paint $symbols[2]) + '  ' + (Paint ($Title.PadRight(68)) '1;38;5;159') + (Paint $symbols[2]))
    Write-Output ((Paint $symbols[2]) + '  ' + $Subtitle.PadRight(68) + (Paint $symbols[2]))
    Write-Output (Paint ($symbols[4] + ($symbols[1] * 70) + $symbols[5]))
}
function Section([string]$Title) { Write-Output ''; Write-Output (Paint $Title '1;38;5;159') }
$steps = @('Portable Node 24.22.1 + pnpm 12.14.0 + rg/fd', 'Frozen dependencies including Pi 1.3.0; lifecycle scripts disabled', 'Official llama.cpp b11669 Windows CUDA 12.4 binaries + runtime, SHA256 verified', 'Create missing machine.local.json; preserve existing configuration', 'Register local-ai/local-ai-app commands', 'Run doctor; model download and inference acceptance are explicit separate steps')
if ($Plan) {
    if ($Json) { [ordered]@{Mode='plan';Platform='Windows x64';Root=$labRoot;Steps=$steps;ModelDownload='None';OptionalAssets='None';AcceptModel=$AcceptModel;ChangesMade=$false} | ConvertTo-Json -Depth 4; return }
    Banner 'LOCAL AI / INSTALL PREVIEW' 'Windows x64 / pinned core stack'
    Write-Output ('  Project  ' + (Paint $labRoot '90'))
    Section '  01 / INSTALLATION ROUTE'
    $i=0
    $labels=@('Toolchain','Pi harness','Inference runtime','Configuration','Launchers','Health report')
    foreach ($step in $steps) {
        $i++
        Write-Output ('  ' + (Paint ($symbols[8] + ' ' + $i.ToString('00'))) + '  ' + $labels[$i-1])
        Write-Output ('        ' + (Paint $step '90'))
    }
    Section '  02 / SCOPE'
    Write-Output ('  ' + (Paint $symbols[6] '32') + '  Preview only: no downloads, file changes or model loading')
    Write-Output '     Model weights and optional apps are separate steps.'
    if ($AcceptModel) { Write-Output "     Installation will also run acceptance for: $AcceptModel" }
    Section '  NEXT'
    Write-Output '  Install    local-ai install'
    Write-Output '  Inventory  local-ai install --check'
    Write-Output '  Health     local-ai doctor'
    Write-Output ''
    return
}
if (-not [Environment]::Is64BitOperatingSystem -or $env:OS -ne 'Windows_NT') { throw 'This installer supports Windows x64 only; see README for other platforms.' }
$configPath = Join-Path $labRoot 'machine.local.json'
if ($Check) {
    $rows = [System.Collections.Generic.List[object]]::new()
    function Add-Check([string]$Name, [bool]$Passed, [string]$Detail) {
        $rows.Add([pscustomobject]@{Name=$Name;Passed=$Passed;Detail=$Detail})
    }
    foreach ($entry in @(
        @{Name='Node';Path='runtime/node/node.exe';Version='24.22.1';Execute=$true},
        @{Name='pnpm';Path='runtime/pnpm/node_modules/pnpm/package.json';Version='12.14.0'},
        @{Name='Pi';Path='node_modules/@earendil-works/pi-coding-agent/package.json';Version='1.3.0'})) {
        $file=Join-Path $labRoot $entry.Path
        try {
            if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw ('Missing: ' + $entry.Path) }
            if ($entry.Execute) { $actual=(& $file --version | Out-String).Trim().TrimStart('v'); if ($LASTEXITCODE) { throw 'Version query failed' } }
            else { $actual=(Get-Content -Raw -LiteralPath $file | ConvertFrom-Json).version }
            Add-Check $entry.Name ($actual -eq $entry.Version) ("$actual / expected " + $entry.Version)
        } catch { Add-Check $entry.Name $false $_.Exception.Message }
    }
    foreach ($entry in @(
        @{Name='pnpm launcher';Path='runtime/pnpm/node_modules/.bin/pnpm.cmd'},
        @{Name='Pi launcher';Path='node_modules/.bin/pi.cmd'},
        @{Name='ripgrep';Path='runtime/search/ripgrep-15.2.0-x86_64-pc-windows-msvc/rg.exe'},
        @{Name='fd';Path='runtime/search/fd-v10.5.0-x86_64-pc-windows-msvc/fd.exe'},
        @{Name='CLI launcher';Path='bin/local-ai.cmd'},
        @{Name='App launcher';Path='bin/local-ai-app.cmd'})) {
        $present=Test-Path -LiteralPath (Join-Path $labRoot $entry.Path) -PathType Leaf
        Add-Check $entry.Name $present $(if ($present) {'Present (file check)'} else {'Missing: ' + $entry.Path})
    }
    $configured=$null
    try {
        $configured=Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
        if (-not $configured.LlamaExecutable -or -not $configured.ModelsDirectory -or -not $configured.PiExecutable) { throw 'Required configuration paths are missing' }
        Add-Check 'Configuration' $true 'Required runtime, model-directory and Pi paths defined'
    } catch { Add-Check 'Configuration' $false $_.Exception.Message }
    if ($configured -and $configured.LlamaExecutable) {
        try {
            $llama=$configured.LlamaExecutable
            if (-not [IO.Path]::IsPathRooted($llama)) { $llama=Join-Path $labRoot $llama }
            if (-not (Test-Path -LiteralPath $llama -PathType Leaf)) { throw 'Configured runtime executable is missing' }
            # Windows PowerShell wraps native stderr as error records, even for
            # successful --version output. Capture it without terminating early.
            $previousPreference=$ErrorActionPreference
            try {
                $ErrorActionPreference='Continue'
                $version=(& $llama --version 2>&1 | Out-String)
            } finally { $ErrorActionPreference=$previousPreference }
            $valid=$LASTEXITCODE -eq 0 -and $version -match 'build 11669'
            Add-Check 'llama.cpp' $valid $(if ($valid) {'b11669 / version query only'} else {'Expected build 11669; inspect configured runtime'})
        } catch { Add-Check 'llama.cpp' $false $_.Exception.Message }
    } else { Add-Check 'llama.cpp' $false 'Cannot locate runtime until configuration is repaired' }
    $userPath=[Environment]::GetEnvironmentVariable('Path','User')
    $registered=@($userPath -split ';' | ForEach-Object { $_.TrimEnd('\','/') }) -contains (Join-Path $labRoot 'bin').TrimEnd('\','/')
    Add-Check 'Command PATH' $registered $(if ($registered) {'Project bin registered in user PATH'} else {'Run scripts/Install-LocalAI.ps1 to register commands'})
    $failed=@($rows | Where-Object { -not $_.Passed })
    if ($Json) { [ordered]@{Mode='inventory';Root=$labRoot;Checks=@($rows.ToArray());Passed=($failed.Count -eq 0);ChangesMade=$false} | ConvertTo-Json -Depth 5 }
    else {
        Banner 'LOCAL AI / CORE INVENTORY' 'Installed components / read-only / no model loading'
        Section '  01 / COMPONENTS'
        foreach ($row in $rows) {
            $symbol=if ($row.Passed) { Paint $symbols[6] '32' } else { Paint $symbols[7] '31' }
            Write-Output ('  ' + $symbol + '  ' + $row.Name.PadRight(17) + $row.Detail)
        }
        Section '  RESULT'
        if ($failed.Count) {
            Write-Output (Paint ("  $($failed.Count) checks need attention: " + (($failed | ForEach-Object {$_.Name}) -join ', ')) '31')
            Write-Output '  Review the failed items above before installing or repairing components.'
        } else { Write-Output (Paint "  $($rows.Count)/$($rows.Count) core checks passed" '32') }
        Write-Output ''
        Write-Output '  Hardware + model health  local-ai doctor'
        Write-Output '  Actual answer + repair   local-ai test --run'
        Write-Output (Paint '  File presence and version checks do not prove inference works.' '90')
        Write-Output ''
    }
    if ($failed.Count) { exit 1 }
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
        $previousPreference=$ErrorActionPreference
        try {
            $ErrorActionPreference='Continue'
            $version = (& $llama --version 2>&1 | Out-String)
        } finally { $ErrorActionPreference=$previousPreference }
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
