[CmdletBinding()]
param([ValidateSet('folder','file','location')][string]$Kind='location', [string]$ResolvePath)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
function Resolve-ModelLocation([string]$Selected) {
    if ((Split-Path -Leaf $Selected) -eq 'Use this folder') { $Selected=Split-Path -Parent $Selected }
    if (Test-Path -LiteralPath $Selected -PathType Container) { return @{cancelled=$false;kind='folder';path=[IO.Path]::GetFullPath($Selected)} }
    if ((Test-Path -LiteralPath $Selected -PathType Leaf) -and [IO.Path]::GetExtension($Selected) -eq '.gguf' -and (Split-Path -Leaf $Selected) -notmatch '^(mmproj|projector)') {
        return @{cancelled=$false;kind='file';path=[IO.Path]::GetFullPath($Selected)}
    }
    throw 'Choose an existing GGUF model, or open a folder and leave Use this folder in the file-name box.'
}
if ($ResolvePath) { Resolve-ModelLocation $ResolvePath | ConvertTo-Json -Compress; return }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$owner=New-Object System.Windows.Forms.Form
$owner.Text='Local AI - Choose model location'
$owner.TopMost=$true
$owner.StartPosition='CenterScreen'
$owner.Size=New-Object System.Drawing.Size(420,100)
$label=New-Object System.Windows.Forms.Label
$label.Text='Select a GGUF file, or navigate to a folder and leave Use this folder in the file-name box, then click Open.'
$label.Dock='Fill'
$owner.Controls.Add($label)
$dialog=$null
try {
    $dialog=New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title='Local AI - Choose a GGUF or use the current folder'
    $dialog.Filter='GGUF model (*.gguf)|*.gguf'
    $dialog.CheckFileExists=$false
    $dialog.CheckPathExists=$true
    $dialog.AddExtension=$false
    $dialog.ValidateNames=$false
    $dialog.FileName='Use this folder'
    $owner.Show();$owner.Activate()
    $result=$dialog.ShowDialog($owner)
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Resolve-ModelLocation $dialog.FileName | ConvertTo-Json -Compress
    } else { @{cancelled=$true} | ConvertTo-Json -Compress }
} finally { if ($dialog) { $dialog.Dispose() };$owner.Dispose() }
