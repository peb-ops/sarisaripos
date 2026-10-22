# Installs (or updates) the Sari-Sari POS for the current Windows user:
# copies the app to %LOCALAPPDATA%\SariSariPOS, adds Desktop and Start menu
# icons, then opens it. No admin rights or internet needed. Store data lives
# in the browser, so reinstalling or updating never erases sales records.
$ErrorActionPreference = 'Stop'
$source = Split-Path $PSScriptRoot -Parent
$dest = Join-Path $env:LOCALAPPDATA 'SariSariPOS'

Add-Type -AssemblyName PresentationFramework

try {
  Write-Host 'Installing Sari-Sari POS...'

  # Stop an older running copy so its files can be replaced.
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -like '*SariSariPOS*server.ps1*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  foreach ($folder in 'app', 'system') {
    $target = Join-Path $dest $folder
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    Copy-Item (Join-Path $source $folder) $target -Recurse
  }

  $shell = New-Object -ComObject WScript.Shell
  foreach ($dir in [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs')) {
    $link = $shell.CreateShortcut((Join-Path $dir 'Sari-Sari POS.lnk'))
    $link.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $link.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$dest\system\launch.ps1`""
    $link.WorkingDirectory = $dest
    $link.IconLocation = "$dest\system\app.ico"
    $link.WindowStyle = 7 # minimized
    $link.Description = 'Open the Sari-Sari POS'
    $link.Save()
  }

  [System.Windows.MessageBox]::Show(
    "Sari-Sari POS is installed!`n`nFrom now on, open it with the 'Sari-Sari POS' icon on your Desktop.`n`nClick OK to open it now.",
    'Sari-Sari POS', 'OK', 'Information') | Out-Null

  & (Join-Path $dest 'system\launch.ps1')
} catch {
  [System.Windows.MessageBox]::Show(
    "Installation did not finish.`n`n" + $_.Exception.Message,
    'Sari-Sari POS', 'OK', 'Error') | Out-Null
  exit 1
}
