# Opens the Sari-Sari POS: offers a newer release if there is one (once a
# day, only when online), starts the local server if it isn't running, then
# opens the app in its own Edge window. Run by the desktop icon.
$ErrorActionPreference = 'Stop'
$Port = 4173
$Url = "http://localhost:$Port/"
$InstallDir = Split-Path $PSScriptRoot -Parent
$UpdateLock = Join-Path $InstallDir 'updating.lock'

Add-Type -AssemblyName PresentationFramework

function Test-Server {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('localhost', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}

function Show-Message([string]$message, [string]$icon = 'Error') {
  [System.Windows.MessageBox]::Show($message, 'Sari-Sari POS', 'OK', $icon) | Out-Null
}

# Returns $true if the owner chose to update (update.ps1 reopens the POS when done).
function Start-UpdateIfWanted {
  $releaseFile = Join-Path $PSScriptRoot 'release.json'
  if (-not (Test-Path $releaseFile)) { return $false }
  $info = Get-Content $releaseFile -Raw | ConvertFrom-Json
  if (-not $info.repo) { return $false }

  $lastCheckFile = Join-Path $InstallDir 'last-update-check.txt'
  $today = (Get-Date).ToString('yyyy-MM-dd')
  if ((Test-Path $lastCheckFile) -and ((Get-Content $lastCheckFile -Raw).Trim() -eq $today)) { return $false }

  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $latest = Invoke-RestMethod -Uri "https://api.github.com/repos/$($info.repo)/releases/latest" `
      -Headers @{ 'User-Agent' = 'SariSariPOS' } -TimeoutSec 5 -UseBasicParsing
  } catch {
    return $false # offline, or no release yet: try again next time
  }
  Set-Content -Path $lastCheckFile -Value $today

  $newVersion = "$($latest.tag_name)".TrimStart('v')
  try {
    if ([version]$newVersion -le [version]$info.version) { return $false }
  } catch { return $false }
  $asset = $latest.assets | Where-Object { $_.name -like 'SariSariPOS-v*.zip' } | Select-Object -First 1
  if (-not $asset) { return $false }

  $answer = [System.Windows.MessageBox]::Show(
    "A new version of Sari-Sari POS is ready: version $newVersion.`n" +
    "You have version $($info.version).`n`n" +
    "Update now? It takes about a minute and needs internet.`n" +
    "Your sales, products and utang records are kept.`n`n" +
    "May bagong version ng Sari-Sari POS. I-update na ngayon?`n" +
    "Hindi mabubura ang records mo.",
    'Sari-Sari POS update', 'YesNo', 'Question')
  if ("$answer" -ne 'Yes') { return $false }

  Start-Process powershell.exe -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSScriptRoot\update.ps1`"",
    '-ZipUrl', $asset.browser_download_url, '-Version', $newVersion, '-Digest', "`"$($asset.digest)`""
  )
  return $true
}

try {
  if ((Test-Path $UpdateLock) -and (Get-Item $UpdateLock).LastWriteTime -gt (Get-Date).AddMinutes(-10)) {
    Show-Message "Sari-Sari POS is updating. It will open by itself when done.`n`nNag-a-update ang Sari-Sari POS. Kusa itong magbubukas pagkatapos." 'Information'
    return
  }

  $updating = $false
  try { $updating = Start-UpdateIfWanted } catch { $updating = $false } # never let an update problem block the store
  if ($updating) { return }

  if (-not (Test-Server)) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSScriptRoot\server.ps1`"", '-Port', $Port
    )
    $deadline = (Get-Date).AddSeconds(20)
    while (-not (Test-Server)) {
      if ((Get-Date) -gt $deadline) { throw 'The POS did not start in time.' }
      Start-Sleep -Milliseconds 300
    }
  }

  $edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1

  if ($edge) { Start-Process $edge "--app=$Url" } else { Start-Process $Url }
} catch {
  Show-Message ("Sari-Sari POS could not start.`n`n" + $_.Exception.Message + "`n`nTry restarting the computer, then open Sari-Sari POS again.")
}
