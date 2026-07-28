# Static preview server for FPV Tactical OS (WebApp.html demo mode)
# Root = project folder (parent of .claude). No Cyrillic literals here:
# PowerShell 5.1 reads BOM-less .ps1 as ANSI and mangles them.
$root = Split-Path -Parent $PSScriptRoot
$port = 8765
$defaultDoc = Get-ChildItem $root -Recurse -Filter 'WebApp.html' | Select-Object -First 1
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Output "Serving $root on http://localhost:$port/"

$types = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'
  '.txt'='text/plain; charset=utf-8'; '.gs'='text/plain; charset=utf-8'
  '.css'='text/css; charset=utf-8';   '.js'='text/javascript; charset=utf-8'
  '.json'='application/json';         '.png'='image/png'
  '.jpg'='image/jpeg';                '.svg'='image/svg+xml'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.LocalPath).TrimStart('/')
    if ([string]::IsNullOrEmpty($path)) {
      $file = if ($defaultDoc) { $defaultDoc.FullName } else { '' }
    } else {
      $file = Join-Path $root ($path -replace '/', '\')
    }
    if ((Test-Path $file -PathType Leaf) -and $file.StartsWith($root)) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ct = $types[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentType = $ct
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404: $path")
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.Close()
  } catch { }
}
