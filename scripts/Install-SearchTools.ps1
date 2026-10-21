$ErrorActionPreference='Stop'
$labRoot=Split-Path -Parent $PSScriptRoot
$manifest=Get-Content -LiteralPath (Join-Path $labRoot 'manifests/search-tools.json') -Raw | ConvertFrom-Json
$target=Join-Path $labRoot 'runtime/search'
New-Item -ItemType Directory -Force -Path $target | Out-Null
foreach($tool in $manifest){
    $archive=Join-Path $target $tool.Archive
    if(-not(Test-Path -LiteralPath $archive)){& curl.exe --fail --location --retry 3 --output $archive $tool.Url;if($LASTEXITCODE){throw 'Search-tool download failed'}}
    if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $tool.SHA256){throw 'Search-tool archive SHA256 mismatch'}
    Expand-Archive -LiteralPath $archive -DestinationPath $target -Force
    $binary=Join-Path $target ($tool.Directory+'/'+$tool.Binary)
    & $binary --version
    if($LASTEXITCODE){throw 'Search-tool binary did not run'}
}
