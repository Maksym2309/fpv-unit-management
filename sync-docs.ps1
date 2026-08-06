# Збірка PWA: ВЕБ_ЗАСТОСУНОК/WebApp.html → docs/index.html (+ PWA-блок у <head>)
# Запускати після кожної зміни WebApp.html: powershell -File sync-docs.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$src  = Get-ChildItem $root -Recurse -Filter 'WebApp.html' | Where-Object { $_.FullName -notmatch '\\docs\\' } | Select-Object -First 1
if (-not $src) { throw 'WebApp.html not found' }
$docs = Join-Path $root 'docs'
New-Item -ItemType Directory -Force $docs | Out-Null

$c = [System.IO.File]::ReadAllText($src.FullName, [System.Text.Encoding]::UTF8)

$pwaBlock = @'
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#131313">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<script>
// PWA: service worker (https або localhost)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', function(){ navigator.serviceWorker.register('./sw.js').catch(function(){}); });
}
</script>
'@

$marker = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
if ($c.IndexOf($marker) -lt 0) { throw 'viewport meta not found in WebApp.html' }
$c = $c.Replace($marker, $marker + "`n" + $pwaBlock)

[System.IO.File]::WriteAllText((Join-Path $docs 'index.html'), $c, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "OK: docs/index.html zibrano z $($src.FullName)"
