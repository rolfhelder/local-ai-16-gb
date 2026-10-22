[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidatePattern('^[1-9][0-9]*[KMG]?$')][string]$RateLimit,[string]$Manifest='coding-model-downloads.json',[string]$StatusName='coding-downloads',[switch]$Unlimited)
$ErrorActionPreference='Stop'
$labRoot=Split-Path -Parent $PSScriptRoot
$config=Get-Content -Raw -LiteralPath (Join-Path $labRoot 'machine.local.json') | ConvertFrom-Json
if($Manifest -notmatch '^[A-Za-z0-9_.-]+\.json$' -or $StatusName -notmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid manifest or status name'}
$queue=Get-Content -Raw -LiteralPath (Join-Path $labRoot ('manifests/'+$Manifest)) | ConvertFrom-Json
$stateDirectory=Join-Path $labRoot '.state'
New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
$rateOverridePath=Join-Path $stateDirectory ($StatusName+'-rate.json')
if(Test-Path -LiteralPath $rateOverridePath){
    $rateOverride=Get-Content -Raw -LiteralPath $rateOverridePath | ConvertFrom-Json
    if([string]$rateOverride.RateLimit -notmatch '^[1-9][0-9]*$'){throw 'Invalid download rate override'}
    $RateLimit=[string]$rateOverride.RateLimit
}
$lockPath=Join-Path $stateDirectory ($StatusName+'.lock')
$queueLock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$statusPath=Join-Path $stateDirectory ($StatusName+'.json')
$status=[ordered]@{Pid=$PID;Started=(Get-Date).ToUniversalTime().ToString('o');RateLimit=$RateLimit;Order='sequential';State='running';Files=@()}
if($Unlimited){$status.RateLimit='unlimited'}
$curlRate=if($Unlimited){'0'}else{$RateLimit}
$rateUnit=$RateLimit.Substring($RateLimit.Length-1)
$rateMultiplier=switch($rateUnit){'K'{1024};'M'{1048576};'G'{1073741824};default{1}}
$rateBytes=[double]($RateLimit -replace '[KMG]$','')*$rateMultiplier
$lowSpeedLimit=[long][math]::Max(1,[math]::Min(65536,[math]::Floor($rateBytes*0.1)))
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
        Write-Output ('Downloading '+$item.File+'; rate '+$status.RateLimit)
        if(Test-Path -LiteralPath $target) {
            if((Get-Item -LiteralPath $target).Length -ne $item.Size -or (Get-ModelSha256 $target) -ne $item.SHA256) { throw 'Existing final model has unexpected size or hash; preserved it.' }
            $entry.State='already-verified';Save-QueueStatus;continue
        }
        $alreadyComplete=(Test-Path -LiteralPath $partial) -and (Get-Item -LiteralPath $partial).Length -eq $item.Size
        if(-not $alreadyComplete) {
            # Bounded ranges avoid the observed long-response CDN stall. Reuse one
            # scratch chunk; append only fully received ranges, never partial ones.
            $chunkPath=$partial+'.chunk'
            $offset=if(Test-Path -LiteralPath $partial){[long](Get-Item -LiteralPath $partial).Length}else{[long]0}
            $startingOffset=$offset
            $transferClock=[Diagnostics.Stopwatch]::StartNew()
            if($offset -gt $item.Size){throw 'Partial file exceeds expected size; preserved it.'}
            while($offset -lt $item.Size){
                $rangeEnd=[long][math]::Min([long]$item.Size-1,$offset+33554432-1)
                $chunkBytes=$rangeEnd-$offset+1
                $url='https://huggingface.co/'+$item.Repo+'/resolve/'+$item.Revision+'/'+$item.File+'?download=true&queue_range='+$offset+'&request='+[DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
                $httpCode=& curl.exe --fail --location --http1.1 --range ($offset.ToString()+'-'+$rangeEnd.ToString()) --limit-rate $curlRate --retry 4 --retry-delay 10 --retry-all-errors --connect-timeout 30 --max-time 120 --max-filesize $chunkBytes --speed-limit $lowSpeedLimit --speed-time 90 --no-progress-meter --write-out '%{http_code}' --output $chunkPath $url
                if($LASTEXITCODE -ne 0 -or $httpCode -ne '206'){throw ('Range transfer failed; partial file retained. HTTP '+$httpCode)}
                if((Get-Item -LiteralPath $chunkPath).Length -ne $chunkBytes){throw 'Incomplete range; partial file preserved.'}
                $destination=[IO.File]::Open($partial,[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::Read)
                $source=[IO.File]::OpenRead($chunkPath)
                try{if($destination.Length -ne $offset){throw 'Partial changed during range transfer.'};$source.CopyTo($destination)}finally{$source.Dispose();$destination.Dispose()}
                $offset+=$chunkBytes;$entry.DownloadedBytes=$offset
                # Curl's short-request burst allowance resets for each range.
                # Pace the whole file as well, retaining the aggregate cap.
                $waitSeconds=if($Unlimited){0}else{(($offset-$startingOffset)/$rateBytes)-$transferClock.Elapsed.TotalSeconds}
                if($waitSeconds -gt 0){Start-Sleep -Milliseconds ([int][math]::Ceiling($waitSeconds*1000))}
                $entry.AverageBytesPerSecond=[long](($offset-$startingOffset)/[math]::Max(0.001,$transferClock.Elapsed.TotalSeconds));Save-QueueStatus
            }
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
