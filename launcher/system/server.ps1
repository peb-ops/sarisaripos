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
  $bytes = [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Compress -Depth 5))
  $res.StatusCode = $status
  $res.ContentType = 'application/json'
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# The /api/ endpoints need a custom header, which other websites can't send
# without a CORS preflight that this server never approves, so only the POS
# itself can write or read backups.
function Test-PosRequest($req, [string]$method) {
  $origin = $req.Headers['Origin']
  $req.HttpMethod -eq $method -and $req.Headers['X-SariSari-POS'] -eq '1' -and (-not $origin -or $origin -eq "http://localhost:$Port")
}

# POST /api/backup: the app sends a full backup after each change; keep one
# file per day (the latest) for $keepDays days.
function Save-Backup($ctx) {
  $req = $ctx.Request
  $res = $ctx.Response
  if (-not (Test-PosRequest $req 'POST')) { return Send-Json $res 403 @{ error = 'forbidden' } }

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

  # ?kind=before-restore: a copy of the records just before a restore
  # replaces them (the last 5 are kept), so a wrong restore can be undone.
  if ($req.QueryString['kind'] -eq 'before-restore') {
    $prefix, $stamp, $keep = 'before-restore-', 'yyyy-MM-dd-HHmmss', 5
  } else {
    $prefix, $stamp, $keep = 'auto-', 'yyyy-MM-dd', $keepDays
  }
  $name = $prefix + (Get-Date).ToString($stamp) + '.json'
  Move-Item $tmp (Join-Path $backupDir $name) -Force
  Get-ChildItem $backupDir -Filter "$prefix*.json" | Sort-Object Name -Descending | Select-Object -Skip $keep | Remove-Item -Force
  Send-Json $res 200 @{ folder = $backupDir; file = $name }
}

# GET /api/backups: the automatic, before-restore and before-update backups, newest first,
# so the owner can restore one from Settings without opening any folder.
function Get-BackupList($ctx) {
  if (-not (Test-PosRequest $ctx.Request 'GET')) { return Send-Json $ctx.Response 403 @{ error = 'forbidden' } }
  $auto = @(Get-ChildItem $backupDir -Filter '*.json' -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(auto|before-restore)-' })
  $before = @(Get-ChildItem $backupDir -Directory -Filter 'before-update-*' -ErrorAction SilentlyContinue |
    ForEach-Object { Get-Item -LiteralPath (Join-Path $_.FullName 'sari-sari-backup.json') -ErrorAction SilentlyContinue })
  $items = @(foreach ($f in @($auto + $before)) {
    if (-not $f -or $f.Length -eq 0) { continue }
    $inFolder = $f.Name -eq 'sari-sari-backup.json'
    [pscustomobject]@{
      id       = if ($inFolder) { $f.Directory.Name + '/' + $f.Name } else { $f.Name }
      kind     = if ($inFolder) { 'before-update' } elseif ($f.Name -like 'auto-*') { 'auto' } else { 'before-restore' }
      modified = [DateTimeOffset]::new($f.LastWriteTimeUtc).ToUnixTimeMilliseconds()
      size     = $f.Length
    }
  })
  $items = @($items | Sort-Object modified -Descending)
  Send-Json $ctx.Response 200 @{ folder = $backupDir; backups = $items }
}

# GET /api/backups/file?id=<id from the list>: one backup's JSON. Only ids
# shaped like the list's are accepted, so no other file can be read.
function Send-BackupFile($ctx) {
  $res = $ctx.Response
  if (-not (Test-PosRequest $ctx.Request 'GET')) { return Send-Json $res 403 @{ error = 'forbidden' } }
  $id = [string]$ctx.Request.QueryString['id']
  if ($id -cnotmatch '^(auto-\d{4}-\d{2}-\d{2}\.json|before-restore-\d{4}-\d{2}-\d{2}-\d{6}\.json|before-update-[A-Za-z0-9.-]+/sari-sari-backup\.json)$') {
    return Send-Json $res 400 @{ error = 'bad id' }
  }
  $path = Join-Path $backupDir $id.Replace('/', '\')
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return Send-Json $res 404 @{ error = 'not found' } }
  $bytes = [IO.File]::ReadAllBytes($path)
  $res.ContentType = 'application/json'
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

$api = @{ '/api/backup' = 'Save-Backup'; '/api/backups' = 'Get-BackupList'; '/api/backups/file' = 'Send-BackupFile' }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $handler = $api[$ctx.Request.Url.AbsolutePath]
    if ($handler) {
      & $handler $ctx
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
