[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$labRoot = Split-Path -Parent $PSScriptRoot
$binDirectory = Join-Path $labRoot 'bin'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $binDirectory) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $binDirectory), 'User')
}
if (($env:PATH -split ';') -notcontains $binDirectory) { $env:PATH = $binDirectory + ';' + $env:PATH }
Write-Output 'local-ai and local-ai-app are registered in your user PATH. Open a new terminal or run bin/local-ai.cmd here. Legacy pia aliases remain available.'
