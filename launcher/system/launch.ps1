# Opens the Sari-Sari POS: starts the local server if it isn't running,
# then opens the app in its own Edge window. Run by the desktop icon.
$ErrorActionPreference = 'Stop'
$Port = 4173
$Url = "http://localhost:$Port/"

function Test-Server {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('localhost', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}

function Show-Error([string]$message) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($message, 'Sari-Sari POS', 'OK', 'Error') | Out-Null
}

try {
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
  Show-Error ("Sari-Sari POS could not start.`n`n" + $_.Exception.Message + "`n`nTry restarting the computer, then open Sari-Sari POS again.")
}
