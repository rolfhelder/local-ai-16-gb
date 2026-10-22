[CmdletBinding()]
param([ValidateSet('folder','file')][string]$Kind='folder')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$owner=New-Object System.Windows.Forms.Form
$owner.Text='Local AI - Choose model location'
$owner.TopMost=$true
$owner.StartPosition='CenterScreen'
$owner.Size=New-Object System.Drawing.Size(420,100)
$label=New-Object System.Windows.Forms.Label
$label.Text='Choose a model location in the dialog. Cancel returns to the terminal.'
$label.Dock='Fill'
$owner.Controls.Add($label)
$dialog=$null
try {
    if ($Kind -eq 'file') {
        $dialog=New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title='Local AI - Choose a language model (GGUF)'
        $dialog.Filter='GGUF model (*.gguf)|*.gguf'
        $dialog.CheckFileExists=$true
    } else {
        $dialog=New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description='Local AI - Choose your model folder (subfolders are searched)'
        $dialog.ShowNewFolderButton=$false
    }
    $owner.Show();$owner.Activate()
    $result=$dialog.ShowDialog($owner)
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        $selected=if ($Kind -eq 'file') { $dialog.FileName } else { $dialog.SelectedPath }
        @{cancelled=$false;path=$selected} | ConvertTo-Json -Compress
    } else { @{cancelled=$true} | ConvertTo-Json -Compress }
} finally { if ($dialog) { $dialog.Dispose() };$owner.Dispose() }
