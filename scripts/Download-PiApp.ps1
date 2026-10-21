$ErrorActionPreference='Stop'
$labRoot=Split-Path -Parent $PSScriptRoot
$item=Get-Content -LiteralPath (Join-Path $labRoot 'manifests/pi-app.json') -Raw | ConvertFrom-Json
$directory=Join-Path $labRoot 'runtime/pi-app'
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$target=Join-Path $directory $item.asset
if(-not(Test-Path -LiteralPath $target)){
    & curl.exe --fail --location --retry 3 --limit-rate 3523895 --no-progress-meter --output $target $item.url
    if($LASTEXITCODE){throw 'pi-app download failed'}
}
if((Get-Item -LiteralPath $target).Length -ne $item.bytes -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw 'pi-app size or SHA256 verification failed; file preserved'}
Write-Output ('Verified pi-app '+$item.version+': '+$target)
