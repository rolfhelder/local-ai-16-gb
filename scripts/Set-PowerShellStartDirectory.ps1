[CmdletBinding()]
param([string]$CodeDirectory)
$ErrorActionPreference='Stop'
$labRoot=Split-Path -Parent $PSScriptRoot
if(-not $CodeDirectory){$CodeDirectory=Split-Path -Parent $labRoot}
$CodeDirectory=(Resolve-Path -LiteralPath $CodeDirectory).Path
$quoted=$CodeDirectory.Replace("'","''")
$documents=@((Join-Path $HOME 'Documents'),(Join-Path $HOME 'OneDrive/Documents'),[Environment]::GetFolderPath('MyDocuments')) | Select-Object -Unique
$snippet=@'
# BEGIN pia workspace startup
$piaStartDirectory = '__CODE__'
$piaDefaultStarts = @($HOME, (Join-Path $HOME 'Documents'), (Join-Path $HOME 'OneDrive/Documents'), [Environment]::GetFolderPath('MyDocuments'), (Join-Path $env:WINDIR 'System32'))
if ((Test-Path -LiteralPath $piaStartDirectory) -and ($PWD.Path -in $piaDefaultStarts)) {
    Set-Location -LiteralPath $piaStartDirectory
}
Remove-Variable piaStartDirectory,piaDefaultStarts -ErrorAction SilentlyContinue
# END pia workspace startup
'@
$snippet=$snippet.Replace('__CODE__',$quoted)
foreach($document in $documents){foreach($edition in @('PowerShell','WindowsPowerShell')){
    $directory=Join-Path $document $edition
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $target=Join-Path $directory 'profile.ps1'
    $text=if(Test-Path -LiteralPath $target){Get-Content -LiteralPath $target -Raw}else{''}
    if($text -and $text.Contains($snippet)){Write-Output ('Already configured: '+$target);continue}
    if($text){Copy-Item -LiteralPath $target -Destination ($target+'.pia-backup-'+(Get-Date -Format yyyyMMddHHmmss))}
    $text=[regex]::Replace($text,'(?ms)^# BEGIN pia workspace startup.*?^# END pia workspace startup\r?\n?','')
    [IO.File]::WriteAllText($target,($text.TrimEnd()+[Environment]::NewLine+$snippet+[Environment]::NewLine),(New-Object Text.UTF8Encoding($true)))
    Write-Output ('Configured: '+$target)
}}
