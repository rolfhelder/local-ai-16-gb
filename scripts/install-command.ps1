# Bootstrap-compatible setup menu; no action runs until selected explicitly.
$ErrorActionPreference = 'Stop'
if ($args.Count -lt 1 -or $args[0] -ne 'install') { throw 'Expected local-ai install' }
$mapping = @{ '--plan'='Plan'; '--check'='Check'; '--json'='Json'; '--no-color'='NoColor'; '--ascii'='Ascii' }
$options = @{}; $execute=$false; $test=$false; $model=$null
for ($i=1; $i -lt $args.Count; $i++) {
    $argument=$args[$i]
    if ($argument -eq '--run') { $execute=$true }
    elseif ($argument -eq '--test') { $test=$true }
    elseif ($argument -eq '--model') {
        $i++; if ($i -ge $args.Count -or [string]::IsNullOrWhiteSpace($args[$i])) { throw '--model requires a registered name or GGUF path' }
        $model=$args[$i]
    }
    elseif ($mapping.ContainsKey($argument)) { $options[$mapping[$argument]]=$true }
    else { throw ('Unknown installation option: ' + $argument) }
}
$actions=@($options.ContainsKey('Plan'),$options.ContainsKey('Check'),$test | Where-Object { $_ })
if ($actions.Count -gt 1 -or ($execute -and ($options.ContainsKey('Plan') -or $options.ContainsKey('Check')))) { throw 'Choose one action: --plan, --check, --run, --test or --test --run' }
if ($options.ContainsKey('Json') -and $actions.Count -eq 0) { throw '--json requires --plan, --check or --test' }
$project=Split-Path -Parent $PSScriptRoot
function Browse-ModelLocation {
    $node=Join-Path $project 'runtime/node/node.exe'
    if (-not (Test-Path -LiteralPath $node)) { throw 'Install core components first (option 1).' }
    $kind='location'
    Write-Host ('  Opening ' + $kind + ' picker in a separate window...')
    Write-Host '  Select a GGUF, or open a folder and leave Use this folder in the file-name box.'
    Write-Host '  Click Open to confirm. Cancel or Ctrl+C exits; timeout: 3 minutes.'
    $raw=& $node (Join-Path $PSScriptRoot 'browse-model.mjs') $kind
    if ($LASTEXITCODE) { Write-Host '  Picker ended; no model location was saved.'; return }
    $result=($raw -join "`n") | ConvertFrom-Json
    if ($result.cancelled) { Write-Host '  Selection cancelled; configuration unchanged.'; return }
    $folder=if ($result.kind -eq 'file') { Split-Path -Parent $result.path } else { $result.path }
    & $node (Join-Path $PSScriptRoot 'model-folders.mjs') $folder
    if ($LASTEXITCODE) { throw 'Model folder was not saved; see the error above.' }
    if ($result.kind -eq 'file') { $script:model=$result.path; Write-Host ('  Selected for this menu session: ' + $script:model) }
    Write-Host '  Models remain in their current location. No weights are copied or loaded.'
}
function Select-InstalledModel {
    if ($model) { return $model }
    $node=Join-Path $project 'runtime/node/node.exe'
    $raw=& $node (Join-Path $PSScriptRoot 'model-selection.mjs')
    if ($LASTEXITCODE) { throw 'Cannot discover models; check machine.local.json.' }
    # PS 5.1 emits a JSON array as one pipeline object; enumerate after parsing.
    $parsed=($raw -join "`n") | ConvertFrom-Json
    $models=@($parsed)
    if ($models.Count -eq 1) { Write-Host ('Selected installed model: ' + $models[0].name); return $models[0].selection }
    Write-Host ''; Write-Host '  Installed models'
    for ($n=0; $n -lt $models.Count; $n++) { Write-Host ('  ' + ($n+1) + '  ' + $models[$n].name) }
    $answer=Read-Host '  Choose a number, registered name or full GGUF path (blank cancels)'
    if ([string]::IsNullOrWhiteSpace($answer)) { throw 'No model selected; cancelled.' }
    $number=0
    if ([int]::TryParse($answer,[ref]$number) -and $number -ge 1 -and $number -le $models.Count) { return $models[$number-1].selection }
    return $answer.Trim('"')
}
function Invoke-Acceptance([bool]$Run) {
    $node=Join-Path $project 'runtime/node/node.exe'
    if (-not (Test-Path -LiteralPath $node)) { throw 'Install core components first (menu option 1).' }
    $selected=Select-InstalledModel
    $testArgs=@((Join-Path $PSScriptRoot 'acceptance.mjs'),'--model',$selected)
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
    Write-Output '  1  Install core components    Download dependencies; register commands'
    Write-Output '  2  Check installation         Inspect core files and versions'
    Write-Output '  3  Run acceptance test        Select installed model; answer + repair'
    Write-Output '  4  Verify model + health      Doctor with full model checksum'
    Write-Output '  5  Add model location        Choose a folder or GGUF; remember folder'
    Write-Output '  0  Exit'
    Write-Output ''
    $choice=Read-Host '  Choose [0-5]'
    if ([string]::IsNullOrWhiteSpace($choice) -or $choice -eq '0') { return }
    try {
        $view=@{}; foreach ($key in @('NoColor','Ascii')) { if ($options.ContainsKey($key)) { $view[$key]=$true } }
        switch ($choice) {
            '1' { & (Join-Path $PSScriptRoot 'Install-Core.ps1') @view }
            '2' { & (Join-Path $PSScriptRoot 'Install-Core.ps1') -Check @view }
            '3' { Invoke-Acceptance $true }
            '4' {
                $node=Join-Path $project 'runtime/node/node.exe'
                if (-not (Test-Path -LiteralPath $node)) { throw 'Install core components first (option 1).' }
                $selected=Select-InstalledModel
                & $node (Join-Path $PSScriptRoot 'doctor.mjs') --model $selected --verify-model
            }
            '5' { Browse-ModelLocation }
            default { Write-Output '  Choose a number from 0 to 5.' }
        }
    } catch { Write-Output ('  Action failed: ' + $_.Exception.Message) }
}
