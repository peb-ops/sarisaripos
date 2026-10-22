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

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
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
