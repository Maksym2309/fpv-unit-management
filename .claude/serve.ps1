# Static preview server for FPV Tactical OS (WebApp.html demo mode)
# Root = project folder (parent of .claude). No Cyrillic literals here:
# PowerShell 5.1 reads BOM-less .ps1 as ANSI and mangles them.
#
# Port: the harness runs this with "autoPort": true and passes the port it
# picked in the PORT environment variable. Nothing here needs a fixed port
# (static files only - no OAuth callback, webhook or CORS origin depends on
# it), so letting the harness choose means a leftover process can never block
# a restart. -Port is kept for running the script by hand; 8790 is the last
# resort default.
#
# WHY TcpListener AND NOT HttpListener
#   HttpListener goes through the http.sys kernel driver. That has two nasty
#   effects when a dev session is closed without a clean shutdown:
#     1. the port stays registered in the kernel, so a restart is refused with
#        "port is reserved by the OS" - which is misleading, nothing about the
#        OS is involved, it is our own leftover;
#     2. the socket owner shows up as PID 4 (System), so the real culprit is
#        invisible and cannot be killed by PID.
#   A plain TCP socket is owned by this process: closing or killing it frees
#   the port immediately, and the owner is visible in Get-NetTCPConnection.
#   Only .NET is used, so this behaves the same on any Windows machine.
param([int]$Port = 0)

if ($Port -le 0 -and $env:PORT) { $Port = [int]$env:PORT }
if ($Port -le 0) { $Port = 8790 }

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$root = Split-Path -Parent $PSScriptRoot
$defaultDoc = Get-ChildItem $root -Recurse -Filter 'WebApp.html' | Select-Object -First 1

$types = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'
  '.txt'='text/plain; charset=utf-8'; '.gs'='text/plain; charset=utf-8'
  '.css'='text/css; charset=utf-8';   '.js'='text/javascript; charset=utf-8'
  '.json'='application/json';         '.webmanifest'='application/manifest+json'
  '.png'='image/png';                 '.jpg'='image/jpeg'
  '.svg'='image/svg+xml';             '.ico'='image/x-icon'
}

# Read one CRLF-terminated line. Returns $null when the peer closed.
function Read-Line($stream) {
  $sb = New-Object System.Text.StringBuilder
  $buf = New-Object byte[] 1
  while ($true) {
    $n = $stream.Read($buf, 0, 1)
    if ($n -le 0) { if ($sb.Length -eq 0) { return $null } else { break } }
    $ch = [char]$buf[0]
    if ($ch -eq "`n") { break }
    if ($ch -ne "`r") { [void]$sb.Append($ch) }
  }
  return $sb.ToString()
}

function Send-Response($stream, $code, $status, $contentType, [byte[]]$body) {
  # no-store: the app registers a service worker, and a cached index.html
  # would quietly hide the change you just rebuilt.
  $head = "HTTP/1.1 $code $status`r`n" +
          "Content-Type: $contentType`r`n" +
          "Content-Length: $($body.Length)`r`n" +
          "Cache-Control: no-store`r`n" +
          "Connection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

function New-Listener([int]$p) {
  $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
  # Exclusive on purpose. With a shared bind Windows lets a second instance
  # attach to the same port without error, the takeover branch below never
  # runs, and servers pile up while the oldest one keeps answering - exactly
  # the "it stopped starting" symptom. A hard conflict is what we want.
  $l.ExclusiveAddressUse = $true
  return $l
}

# Bind first, kill only if that fails. Killing unconditionally would be
# symmetric: two instances starting near each other would shoot each other
# down in a loop instead of one of them simply winning the port.
$listener = New-Listener $Port
$started = $false
try { $listener.Start(); $started = $true } catch { }

if (-not $started) {
  # Port busy. Take over ONLY if the holder is a leftover of this same script
  # (a dev session closed without stopping the process). Killing every
  # matching process would be wrong: with autoPort another instance may be
  # legitimately serving a different port.
  $holder = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty OwningProcess
  if ($holder) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$holder" -ErrorAction SilentlyContinue
    if ($proc -and $proc.CommandLine -and $proc.CommandLine -like '*serve.ps1*') {
      Write-Output "Port $Port held by a stale instance of this script (PID $holder) - stopping it"
      try { Stop-Process -Id $holder -Force -ErrorAction Stop } catch { }
    } else {
      $who = 'unknown'
      if ($proc) { $who = $proc.Name }
      throw "Port $Port is used by PID $holder ($who), which is not this dev server - refusing to kill it"
    }
  }
  # Retry: a just-freed socket can linger briefly.
  foreach ($try in 1..15) {
    Start-Sleep -Milliseconds 300
    $listener = New-Listener $Port
    try { $listener.Start(); $started = $true; break } catch { }
  }
}
if (-not $started) { throw "Cannot bind port $Port - something else is holding it" }

Write-Output "Serving $root on http://localhost:$Port/"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      # Browsers open speculative connections and send nothing. Without a
      # timeout one of those would block the whole accept loop.
      $client.ReceiveTimeout = 5000
      $client.SendTimeout    = 5000
      $stream = $client.GetStream()

      $reqLine = Read-Line $stream
      if ($reqLine) {
        while ($true) { $h = Read-Line $stream; if ($null -eq $h -or $h -eq '') { break } }

        $parts   = $reqLine -split ' '
        $rawPath = ''
        if ($parts.Count -ge 2) { $rawPath = $parts[1] }
        $qm = $rawPath.IndexOf('?')
        if ($qm -ge 0) { $rawPath = $rawPath.Substring(0, $qm) }
        $path = [System.Uri]::UnescapeDataString($rawPath).TrimStart('/')

        $file = ''
        if ([string]::IsNullOrEmpty($path)) {
          if ($defaultDoc) { $file = $defaultDoc.FullName }
        } else {
          try { $file = [System.IO.Path]::GetFullPath((Join-Path $root ($path -replace '/', '\'))) } catch { $file = '' }
        }

        $inRoot = $file -and $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)
        if ($inRoot -and (Test-Path $file -PathType Leaf)) {
          $ext = [System.IO.Path]::GetExtension($file).ToLower()
          $ct = $types[$ext]
          if (-not $ct) { $ct = 'application/octet-stream' }
          Send-Response $stream 200 'OK' $ct ([System.IO.File]::ReadAllBytes($file))
        } else {
          Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes("404: $path"))
        }
      }
    } catch {
    } finally {
      try { $client.Close() } catch { }
    }
  }
} finally {
  try { $listener.Stop() } catch { }
}
