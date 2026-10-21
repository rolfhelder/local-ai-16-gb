[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidatePattern('^[1-9][0-9]*[KMG]?$')][string]$RateLimit)
$ErrorActionPreference='Stop'
$labRoot=Split-Path -Parent $PSScriptRoot
$config=Get-Content -Raw -LiteralPath (Join-Path $labRoot 'machine.local.json') | ConvertFrom-Json
$queue=Get-Content -Raw -LiteralPath (Join-Path $labRoot 'manifests/coding-model-downloads.json') | ConvertFrom-Json
$stateDirectory=Join-Path $labRoot '.state'
New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
$lockPath=Join-Path $stateDirectory 'coding-downloads.lock'
$queueLock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$statusPath=Join-Path $stateDirectory 'coding-downloads.json'
$status=[ordered]@{Pid=$PID;Started=(Get-Date).ToUniversalTime().ToString('o');RateLimit=$RateLimit;Order='sequential';State='running';Files=@()}
function Save-QueueStatus { $status | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statusPath -Encoding UTF8 }
function Get-ModelSha256([string]$ModelPath) {
    $modelStream=[IO.File]::OpenRead($ModelPath)
    $algorithm=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash($modelStream))).Replace('-','').ToLowerInvariant() }
    finally { $algorithm.Dispose();$modelStream.Dispose() }
}
try {
    foreach($item in $queue) {
        if($item.Repo -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' -or $item.File -notmatch '^[A-Za-z0-9_.-]+\.gguf$' -or $item.Revision -notmatch '^[a-f0-9]{40}$') { throw 'Invalid model manifest entry' }
        $targetDirectory=Join-Path $config.ModelsDirectory $item.Repo
        New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
        $target=Join-Path $targetDirectory $item.File
        $partial=$target+'.part'
        $entry=[ordered]@{Repo=$item.Repo;File=$item.File;State='downloading';ExpectedBytes=$item.Size;SHA256=$item.SHA256;Started=(Get-Date).ToUniversalTime().ToString('o')}
        $status.Files+=,$entry;Save-QueueStatus
        Write-Output ('Downloading '+$item.File+' at cap '+$RateLimit)
        if(Test-Path -LiteralPath $target) {
            if((Get-Item -LiteralPath $target).Length -ne $item.Size -or (Get-ModelSha256 $target) -ne $item.SHA256) { throw 'Existing final model has unexpected size or hash; preserved it.' }
            $entry.State='already-verified';Save-QueueStatus;continue
        }
        $alreadyComplete=(Test-Path -LiteralPath $partial) -and (Get-Item -LiteralPath $partial).Length -eq $item.Size
        if(-not $alreadyComplete) {
            $url='https://huggingface.co/'+$item.Repo+'/resolve/'+$item.Revision+'/'+$item.File
            & curl.exe --fail --location --continue-at - --limit-rate $RateLimit --retry 8 --retry-delay 10 --retry-all-errors --connect-timeout 30 --speed-limit 1024 --speed-time 120 --no-progress-meter --output $partial $url
            if($LASTEXITCODE -ne 0) { throw ('curl failed ('+$LASTEXITCODE+'); partial file retained for resume.') }
        }
        $entry.State='verifying';Save-QueueStatus
        if((Get-Item -LiteralPath $partial).Length -ne $item.Size) { throw 'Downloaded size mismatch; partial retained.' }
        $actualHash=Get-ModelSha256 $partial
        if($actualHash -ne $item.SHA256) { throw 'Downloaded SHA256 mismatch; partial retained.' }
        Move-Item -LiteralPath $partial -Destination $target
        $entry.State='verified';$entry.Finished=(Get-Date).ToUniversalTime().ToString('o');Save-QueueStatus
        Write-Output ('Verified '+$item.File)
    }
    $status.State='complete';Save-QueueStatus
} catch { $status.State='failed';$status.Error=$_.Exception.Message;Save-QueueStatus;throw }
finally { $queueLock.Dispose() }
