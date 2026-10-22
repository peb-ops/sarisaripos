# Tiny local web server for the Sari-Sari POS, using Windows' built-in
# PowerShell, so the store computer needs nothing installed.
# Serves ..\app on http://localhost:<Port>/ (localhost only, not the network).
param([int]$Port = 4173)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\app')).Path.TrimEnd('\')
$index = Join-Path $root 'index.html'

$mime = @{
  '.html'        = 'text/html; charset=utf-8'
  '.js'          = 'text/javascript; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.json'        = 'application/json'
  '.webmanifest' = 'application/manifest+json'
  '.svg'         = 'image/svg+xml'
  '.png'         = 'image/png'
  '.ico'         = 'image/x-icon'
  '.txt'         = 'text/plain; charset=utf-8'
}
# Files that must always be re-checked so app updates show up.
$noCache = @('index.html', 'sw.js', 'registerSW.js', 'manifest.webmanifest')

$backupDir = Join-Path (Split-Path $root -Parent) 'backups'
$keepDays = 30

function Send-Json($res, [int]$status, $value) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Compress))
  $res.StatusCode = $status
  $res.ContentType = 'application/json'
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# POST /api/backup: the app sends a full backup after each change; keep one
# file per day (the latest) for $keepDays days. The custom header can't be
# sent by other websites without a CORS preflight, which this server never
# approves, so only the POS itself can write here.
function Save-Backup($ctx) {
  $req = $ctx.Request
  $res = $ctx.Response
  $origin = $req.Headers['Origin']
  if ($req.HttpMethod -ne 'POST' -or $req.Headers['X-SariSari-POS'] -ne '1' -or ($origin -and $origin -ne "http://localhost:$Port")) {
    return Send-Json $res 403 @{ error = 'forbidden' }
  }

  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $tmp = Join-Path $backupDir 'incoming.tmp'
  $file = [IO.File]::Create($tmp)
  try { $req.InputStream.CopyTo($file) } finally { $file.Dispose() }

  $expected = '{"app":"sari-sari-pos"'
  $head = New-Object byte[] $expected.Length
  $file = [IO.File]::OpenRead($tmp)
  try { $read = $file.Read($head, 0, $head.Length) } finally { $file.Dispose() }
  if ([Text.Encoding]::ASCII.GetString($head, 0, $read) -ne $expected) {
    Remove-Item $tmp -Force
    return Send-Json $res 400 @{ error = 'not a Sari-Sari POS backup' }
  }

  $name = 'auto-' + (Get-Date).ToString('yyyy-MM-dd') + '.json'
  Move-Item $tmp (Join-Path $backupDir $name) -Force
  Get-ChildItem $backupDir -Filter 'auto-*.json' | Sort-Object Name -Descending | Select-Object -Skip $keepDays | Remove-Item -Force
  Send-Json $res 200 @{ folder = $backupDir; file = $name }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    if ($ctx.Request.Url.AbsolutePath -eq '/api/backup') {
      Save-Backup $ctx
      continue # the finally block still closes the response
    }
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
    $inside = $path.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)

    if (-not ($inside -and (Test-Path -LiteralPath $path -PathType Leaf))) {
      # App screens like /utang/3 are handled by the page itself.
      $path = if ([IO.Path]::HasExtension($rel)) { $null } else { $index }
    }

    if ($null -eq $path) {
      $res.StatusCode = 404
    } else {
      $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      if ($noCache -contains [IO.Path]::GetFileName($path)) { $res.AddHeader('Cache-Control', 'no-cache') }
      $bytes = [IO.File]::ReadAllBytes($path)
      $res.ContentLength64 = $bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
