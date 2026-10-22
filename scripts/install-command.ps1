# Works before portable Node is installed. All CLI options are allowlisted.
$ErrorActionPreference = 'Stop'
if ($args.Count -lt 1 -or $args[0] -ne 'install') { throw 'Expected local-ai install' }
$mapping = @{ '--plan'='Plan'; '--check'='Check'; '--json'='Json'; '--no-color'='NoColor'; '--ascii'='Ascii' }
$options = @{}
foreach ($argument in @($args | Select-Object -Skip 1)) {
    if (-not $mapping.ContainsKey($argument)) { throw ('Unknown installation option: ' + $argument) }
    $options[$mapping[$argument]] = $true
}
& (Join-Path $PSScriptRoot 'Install-Core.ps1') @options
