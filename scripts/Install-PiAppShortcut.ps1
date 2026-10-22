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
$powershell=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$launcher=Join-Path $labRoot 'scripts/Start-PiApp.ps1'
if((Test-Path -LiteralPath $shortcutPath) -and $shortcut.TargetPath -ne $executable -and -not($shortcut.TargetPath -eq $powershell -and $shortcut.Arguments.Contains($launcher))){throw 'Existing Pi App shortcut points elsewhere; preserved it'}
$shortcut.TargetPath=$powershell
$shortcut.Arguments='-NoProfile -WindowStyle Hidden -File "'+$launcher+'"'
$shortcut.WindowStyle=7
$shortcut.WorkingDirectory=Split-Path -Parent $labRoot
$shortcut.IconLocation=$executable+',0'
$shortcut.Description='Pi coding agent desktop application (portable)'
$shortcut.Save()
$verified=$shell.CreateShortcut($shortcutPath)
if($verified.TargetPath -ne $powershell -or -not($verified.Arguments.Contains($launcher))){throw 'Shortcut target verification failed'}
Write-Output ('Start menu shortcut created: '+$shortcutPath)
