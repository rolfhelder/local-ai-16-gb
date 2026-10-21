$ErrorActionPreference='Stop'
$labRoot=Split-Path -Parent $PSScriptRoot
$manifest=Get-Content -LiteralPath (Join-Path $labRoot 'manifests/pi-app.json') -Raw | ConvertFrom-Json
$executable=Join-Path $labRoot ('runtime/pi-app/'+$manifest.asset)
if(-not(Test-Path -LiteralPath $executable)){throw 'Run Download-PiApp.ps1 first'}
if((Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256){throw 'pi-app checksum mismatch'}
$programs=[Environment]::GetFolderPath('Programs')
$shortcutPath=Join-Path $programs 'Pi App.lnk'
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut($shortcutPath)
if((Test-Path -LiteralPath $shortcutPath) -and $shortcut.TargetPath -ne $executable){throw 'Existing Pi App shortcut points elsewhere; preserved it'}
$shortcut.TargetPath=$executable
$shortcut.WorkingDirectory=Split-Path -Parent $executable
$shortcut.IconLocation=$executable+',0'
$shortcut.Description='Pi coding agent desktop application (portable)'
$shortcut.Save()
$verified=$shell.CreateShortcut($shortcutPath)
if($verified.TargetPath -ne $executable){throw 'Shortcut target verification failed'}
Write-Output ('Start menu shortcut created: '+$shortcutPath)
