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

Write-Host ''
Write-Host "  Updating Sari-Sari POS to version $Version ..."
Write-Host '  Please wait. Do not close this window.'
Write-Host ''
Write-Host '  Nag-a-update. Hintay lang po. Huwag isara ang window na ito.'
Write-Host ''

try {
  Set-Content -Path $lock -Value (Get-Date)
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
