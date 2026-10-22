# Downloads and installs a Sari-Sari POS update from GitHub, then reopens
# the POS. Started by launch.ps1 after the owner clicks "Yes".
param(
  [Parameter(Mandatory = $true)][string]$ZipUrl,
  [string]$Version = '',
  [string]$Digest = '' # "sha256:<hex>" from the GitHub API, when available
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # the progress bar makes downloads very slow in Windows PowerShell
$Host.UI.RawUI.WindowTitle = 'Sari-Sari POS update'
Set-Location $env:TEMP # don't hold the install folder open while it's replaced

$installDir = Split-Path $PSScriptRoot -Parent
$lock = Join-Path $installDir 'updating.lock'
$work = Join-Path $env:TEMP 'SariSariPOS-update'

Add-Type -AssemblyName PresentationFramework

# Saves the store's records to backups\before-update-v<Version>-<time>\ and
# returns that folder. Two copies, so at least one is usable:
#  - the app's latest automatic backup (restorable from Settings > Restore)
#  - a raw copy of Edge's storage for the POS (works even if the app never
#    made an automatic backup, e.g. on its first update)
# Throws if records exist but neither copy could be made.
function Backup-Records {
  $backups = Join-Path $installDir 'backups'
  $dir = Join-Path $backups ("before-update-v$Version-" + (Get-Date -Format 'yyyy-MM-dd-HHmmss'))
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $saved = 0

  $auto = Get-ChildItem $backups -Filter 'auto-*.json' -ErrorAction SilentlyContinue |
    Where-Object { $_.Length -gt 0 } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($auto) {
    Copy-Item $auto.FullName (Join-Path $dir 'sari-sari-backup.json')
    $saved++
  }

  $edgeStores = @(Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data') -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'IndexedDB\http_localhost_4173.indexeddb.leveldb' } |
    Where-Object { Test-Path $_ })
  $i = 0
  foreach ($store in $edgeStores) {
    $i++
    $target = Join-Path $dir "edge-storage-$i"
    Copy-Item $store $target -Recurse -Force -ErrorAction SilentlyContinue # Edge's LOCK file may be in use; skip it
    if (Get-ChildItem $target -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'LOCK' }) { $saved++ }
  }

  if ($saved -eq 0) {
    Remove-Item $dir -Recurse -Force
    if ($auto -or $edgeStores.Count -gt 0) {
      throw 'Could not make a backup of your records, so the update was NOT installed.'
    }
    return $null # the POS was never used on this computer: nothing to back up
  }

  Get-ChildItem $backups -Directory -Filter 'before-update-*' | Sort-Object CreationTime -Descending |
    Select-Object -Skip 5 | Remove-Item -Recurse -Force
  return $dir
}

Write-Host ''
Write-Host "  Updating Sari-Sari POS to version $Version ..."
Write-Host '  Please wait. Do not close this window.'
Write-Host ''
Write-Host '  Nag-a-update. Hintay lang po. Huwag isara ang window na ito.'
Write-Host ''

try {
  Set-Content -Path $lock -Value (Get-Date)

  Write-Host '  Backing up your records...'
  $backupFolder = Backup-Records
  if ($backupFolder) { Write-Host "  Backup saved: $backupFolder" }

  if (Test-Path $work) { Remove-Item $work -Recurse -Force }
  New-Item -ItemType Directory -Path $work | Out-Null

  Write-Host '  Downloading...'
  $zip = Join-Path $work 'update.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $ZipUrl -OutFile $zip -UseBasicParsing -Headers @{ 'User-Agent' = 'SariSariPOS' }

  if ($Digest -like 'sha256:*') {
    $actual = (Get-FileHash -Path $zip -Algorithm SHA256).Hash
    if ($actual -ne $Digest.Substring(7)) { throw 'The download was damaged. Please try again tomorrow.' }
  }

  Write-Host '  Installing...'
  Expand-Archive -Path $zip -DestinationPath $work
  $installer = Join-Path $work 'SariSariPOS\system\install.ps1'
  if (-not (Test-Path $installer)) { throw 'The downloaded file is not a Sari-Sari POS update.' }

  Remove-Item $lock -Force # the installer opens the POS, which checks this lock
  & $installer -Quiet
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
} catch {
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
  [System.Windows.MessageBox]::Show(
    "The update did not finish.`n`n$($_.Exception.Message)`n`nYour records are safe. The POS will open now.",
    'Sari-Sari POS update', 'OK', 'Warning') | Out-Null
  $launcher = Join-Path $PSScriptRoot 'launch.ps1'
  if (Test-Path $launcher) { & $launcher }
}
