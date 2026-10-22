param([string]$Model='gemma',[string]$WorkingDirectory='')
$ErrorActionPreference='Stop'
$labRoot=Split-Path -Parent $PSScriptRoot
$launchArgs=@((Join-Path $labRoot 'scripts/pi-app.mjs'),'--model',$Model)
if($WorkingDirectory){$launchArgs+=@('--cwd',$WorkingDirectory)}
& (Join-Path $labRoot 'runtime/node/node.exe') @launchArgs 2>&1 | Out-File -LiteralPath (Join-Path $labRoot '.state/pi-app-start-menu.log') -Append -Encoding utf8
if($LASTEXITCODE -ne 0){
 Add-Type -AssemblyName System.Windows.Forms
 [System.Windows.Forms.MessageBox]::Show('Pi App could not start. Close the existing Pi App and pia CLI session, then try again. Details: '+(Join-Path $labRoot '.state/pi-app-launcher.log'),'Pi App startup') | Out-Null
}
