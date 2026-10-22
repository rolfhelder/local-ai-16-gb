# Bootstrap-compatible setup menu; no action runs until selected explicitly.
$ErrorActionPreference = 'Stop'
if ($args.Count -lt 1 -or $args[0] -ne 'install') { throw 'Expected local-ai install' }
$mapping = @{ '--plan'='Plan'; '--check'='Check'; '--json'='Json'; '--no-color'='NoColor'; '--ascii'='Ascii' }
$options = @{}; $execute=$false; $test=$false; $model='gemma'
for ($i=1; $i -lt $args.Count; $i++) {
    $argument=$args[$i]
    if ($argument -eq '--run') { $execute=$true }
    elseif ($argument -eq '--test') { $test=$true }
    elseif ($argument -eq '--model') {
        $i++; if ($i -ge $args.Count -or $args[$i] -notin @('gemma','qwen','omnicoder','gpt-oss')) { throw '--model requires gemma, qwen, omnicoder or gpt-oss' }
        $model=$args[$i]
    }
    elseif ($mapping.ContainsKey($argument)) { $options[$mapping[$argument]]=$true }
    else { throw ('Unknown installation option: ' + $argument) }
}
$actions=@($options.ContainsKey('Plan'),$options.ContainsKey('Check'),$test | Where-Object { $_ })
if ($actions.Count -gt 1 -or ($execute -and ($options.ContainsKey('Plan') -or $options.ContainsKey('Check')))) { throw 'Choose one action: --plan, --check, --run, --test or --test --run' }
if ($options.ContainsKey('Json') -and $actions.Count -eq 0) { throw '--json requires --plan, --check or --test' }
$project=Split-Path -Parent $PSScriptRoot
function Invoke-Acceptance([bool]$Run) {
    $node=Join-Path $project 'runtime/node/node.exe'
    if (-not (Test-Path -LiteralPath $node)) { throw 'Install core components first (menu option 3).' }
    $testArgs=@((Join-Path $PSScriptRoot 'acceptance.mjs'),'--model',$model)
    if ($Run) { $testArgs+='--run' }
    if ($options.ContainsKey('Json')) { $testArgs+='--json' }
    if ($options.ContainsKey('NoColor')) { $testArgs+='--no-color' }
    if ($options.ContainsKey('Ascii')) { $testArgs+='--ascii' }
    & $node @testArgs
    if ($LASTEXITCODE) { throw 'Acceptance failed; see the report above.' }
}
if ($test) { Invoke-Acceptance $execute; return }
if ($actions.Count -or $execute) { & (Join-Path $PSScriptRoot 'Install-Core.ps1') @options; return }
$color=-not ($options.ContainsKey('NoColor') -or $env:NO_COLOR -or [Console]::IsOutputRedirected) -and $Host.UI.SupportsVirtualTerminal
function Accent([string]$Text) { if ($color) { return "$([char]27)[38;5;80m$Text$([char]27)[0m" }; return $Text }
while ($true) {
    Write-Output ''
    Write-Output (Accent '+--------------------------------------------------------------------+')
    Write-Output (Accent '|  LOCAL AI / INSTALL & FIRST RUN                                    |')
    Write-Output (Accent '+--------------------------------------------------------------------+')
    Write-Output '  1  Preview installation       Read-only installation route'
    Write-Output '  2  Check installation         Inspect core files and versions'
    Write-Output '  3  Install core components    Download dependencies; register commands'
    Write-Output '  4  Preview acceptance test    Explain checks; no model loading'
    Write-Output ("  5  Run acceptance test        Load $model; answer + coding repair")
    Write-Output '  6  Verify model + health      Doctor with full model checksum'
    Write-Output '  0  Exit'
    Write-Output ''
    $choice=Read-Host '  Choose [0-6]'
    if ([string]::IsNullOrWhiteSpace($choice) -or $choice -eq '0') { return }
    try {
        $view=@{}; foreach ($key in @('NoColor','Ascii')) { if ($options.ContainsKey($key)) { $view[$key]=$true } }
        switch ($choice) {
            '1' { & (Join-Path $PSScriptRoot 'Install-Core.ps1') -Plan @view }
            '2' { & (Join-Path $PSScriptRoot 'Install-Core.ps1') -Check @view }
            '3' { & (Join-Path $PSScriptRoot 'Install-Core.ps1') @view }
            '4' { Invoke-Acceptance $false }
            '5' { Invoke-Acceptance $true }
            '6' {
                $node=Join-Path $project 'runtime/node/node.exe'
                if (-not (Test-Path -LiteralPath $node)) { throw 'Install core components first (option 3).' }
                & $node (Join-Path $PSScriptRoot 'doctor.mjs') --model $model --verify-model
            }
            default { Write-Output '  Choose a number from 0 to 6.' }
        }
    } catch { Write-Output ('  Action failed: ' + $_.Exception.Message) }
}
