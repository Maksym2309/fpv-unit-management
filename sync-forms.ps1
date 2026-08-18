<#
  Синхронізація дубльованих HTML-форм.

  Форми лежать у трьох папках, бо кожна папка — це окремий проєкт
  Apps Script, куди файли потрапляють копіюванням. Щоб копії не
  розходились мовчки, тут закріплено два інваріанти:

    1. ГОЛОВНА_таблиця → ОПЕРАТОРСЬКА_таблиця
       Спільні форми побайтово однакові; джерело правди — ГОЛОВНА.
       Скрипт копіює.

    2. ГОЛОВНА_таблиця ↔ ТАКТИЧНІ_ФОРМИ_SIDEBAR_опційно
       Тактичні форми — та сама логіка в темній темі. Отже вміст
       <script> має збігатися з базовим із точністю до hex-кольорів
       (у коді трапляються кольори легенди прямо в рядках).
       Скрипт лише ПЕРЕВІРЯЄ і не чіпає файли: стилі різні навмисно,
       автоматично звести їх не можна.

  Використання:
    powershell -File sync-forms.ps1          синхронізувати і перевірити
    powershell -File sync-forms.ps1 -Check   тільки перевірити, нічого не писати
                                             (код виходу 1, якщо є розходження)

  Після синхронізації не забудь перенести змінені форми у відповідні
  проєкти Apps Script — скрипт працює лише з файлами репозиторію.
#>
param([switch]$Check)
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$main = Join-Path $root 'ГОЛОВНА_таблиця'
$op   = Join-Path $root 'ОПЕРАТОРСЬКА_таблиця'
$tac  = Join-Path $root 'ТАКТИЧНІ_ФОРМИ_SIDEBAR_опційно'

foreach ($d in @($main, $op, $tac)) {
  if (-not (Test-Path $d)) { throw "Не знайдено папку: $d" }
}

# Форми, які операторська таблиця використовує спільно з головною
$shared = @('AppShell.html', 'FlightLogForm.html', 'FrequencyForm.html', 'SinotrackForm.html')

# Логіка форми = увесь вміст <script> з нормалізованими hex-кольорами.
# Так порівняння бачить розбіжність у коді й не спотикається об тему.
function Get-FormLogic([string]$path) {
  $text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  $blocks = [regex]::Matches($text, '(?is)<script\b[^>]*>.*?</script>')
  $js = ($blocks | ForEach-Object { $_.Value }) -join "`n"
  $js = $js -replace '#[0-9a-fA-F]{3,8}\b', '#C'
  $js = $js -replace "`r`n", "`n"
  return $js
}

$problems = 0
$copied   = 0

Write-Output '-- Спільні форми: ГОЛОВНА -> ОПЕРАТОРСЬКА --'
foreach ($f in $shared) {
  $src = Join-Path $main $f
  $dst = Join-Path $op   $f
  if (-not (Test-Path $src)) { throw "Немає джерела: $src" }

  $same = $false
  if (Test-Path $dst) {
    $same = (Get-FileHash $src).Hash -eq (Get-FileHash $dst).Hash
  }

  if ($same) {
    Write-Output "   =  $f"
  } elseif ($Check) {
    Write-Output "   !  $f - розійшлась із головною"
    $problems++
  } else {
    Copy-Item $src $dst -Force
    Write-Output "   +  $f - скопійовано"
    $copied++
  }
}

Write-Output ''
Write-Output '-- Тактичні форми: логіка проти ГОЛОВНОЇ --'
foreach ($file in (Get-ChildItem $tac -Filter '*.html')) {
  $base = Join-Path $main $file.Name
  if (-not (Test-Path $base)) {
    Write-Output "   ?  $($file.Name) - базової форми немає, пропущено"
    continue
  }
  if ((Get-FormLogic $base) -eq (Get-FormLogic $file.FullName)) {
    Write-Output "   =  $($file.Name)"
  } else {
    Write-Output "   !  $($file.Name) - логіка розійшлась із базовою формою"
    $problems++
  }
}

Write-Output ''
if ($problems -gt 0) {
  Write-Output "РОЗХОДЖЕНЬ: $problems"
  Write-Output 'Тактичні форми зводяться вручну: перенеси зміну логіки, стилі лишай як є.'
  exit 1
}
if ($copied -gt 0) {
  Write-Output "Готово: синхронізовано файлів - $copied"
} else {
  Write-Output 'Готово: усі копії збігаються.'
}
exit 0
