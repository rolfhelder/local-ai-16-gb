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
Write-Output 'pia is registered in your user PATH. New terminals will pick it up; run bin/pia.cmd in an existing terminal.'
