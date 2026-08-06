// ═══════════════════════════════════════════════════════════
// ВЕБ-ЗАСТОСУНОК «WILD HORNETS — Tactical OS»
// Додай цей код в Apps Script проект таблиці окремим файлом
// з назвою WebAppBackend (НЕ «WebApp» — це ім'я зайняте HTML-файлом,
// Apps Script не дозволяє два файли з однаковою назвою).
// Або просто встав цей код у кінець Code.gs / OperatorCode.gs.
// ═══════════════════════════════════════════════════════════

// ── РІВЕНЬ 2 (PWA) ──
// Адреса PWA на GitHub Pages (напр. 'https://maksym2309.github.io/fpv-unit-management/').
// ВАЖЛИВО: коли деплой перемкнено на «Execute as: Me» + «Anyone», сторінку /exec
// відкривати не можна (кожен відвідувач діяв би від імені власника) — тому при
// заповненому PWA_URL doGet лише переадресовує на PWA. Порожній PWA_URL —
// стара поведінка (віддає застосунок; тоді деплой має бути «User accessing»).
var PWA_URL = '';

// Точка входу веб-застосунку
function doGet(e) {
  if (PWA_URL) {
    return HtmlService.createHtmlOutput(
      '<meta http-equiv="refresh" content="0; url=' + PWA_URL + '">' +
      '<style>body{background:#131313;color:#a8a5a2;font-family:monospace;text-align:center;padding-top:60px}a{color:#ffb800}</style>' +
      '<p>Застосунок переїхав:<br><br><a href="' + PWA_URL + '">' + PWA_URL + '</a></p>'
    ).setTitle('WILD HORNETS — Tactical OS');
  }
  return HtmlService.createHtmlOutputFromFile('WebApp')
    .setTitle('WILD HORNETS — Tactical OS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ── ВСТАВ СЮДИ РОБОЧИЙ URL ДЕПЛОЮ ──
// Скопіюй його з: Ввести в дію → Керувати введеннями в дію → Веб-додаток → URL-адреса
// (закінчується на /exec). ScriptApp.getService().getUrl() повертає URL
// службового/тестового деплою, який не працює — тому константа надійніша.
var WEBAPP_URL = '';

// URL застосунку для меню таблиці: PWA (якщо налаштовано) → константа → службовий
function getWebAppUrl() {
  if (PWA_URL) return PWA_URL;
  if (WEBAPP_URL) return WEBAPP_URL;
  try { return ScriptApp.getService().getUrl() || ''; } catch (err) { return ''; }
}

// Відкрити застосунок ОДРАЗУ в новій вкладці (без діалогу з посиланням).
// В onOpen() використовуй саме цю функцію:
//   .addItem('🌐 Веб-застосунок', 'openWebApp')
function openWebApp() {
  var url = getWebAppUrl();
  if (!url) { openWebAppDialog(); return; }
  var t = HtmlService.createTemplate(
    '<style>body{font-family:Arial;font-size:12px;color:#666;text-align:center;padding-top:12px}</style>' +
    '<div id="m">Відкриваю застосунок…</div>' +
    '<a id="lnk" href="<?= u ?>" target="_blank" style="display:none">Відкрити вручну</a>' +
    '<script>' +
    'var w = window.open(document.getElementById("lnk").href, "_blank");' +
    'if (w) { setTimeout(function(){ google.script.host.close(); }, 500); }' +
    'else {' +
    '  document.getElementById("m").innerHTML = "Браузер заблокував вікно:<br><br>";' +
    '  var l = document.getElementById("lnk"); l.style.display = "inline";' +
    '  l.onclick = function(){ setTimeout(function(){ google.script.host.close(); }, 300); };' +
    '}' +
    '</script>');
  t.u = url;
  SpreadsheetApp.getUi().showModalDialog(
    t.evaluate().setWidth(280).setHeight(90), '🌐 Tactical OS');
}

// Діалог з посиланням (запасний варіант, якщо URL ще не прописано)
function openWebAppDialog() {
  var url = getWebAppUrl();
  var html = HtmlService.createHtmlOutput(
    url
      ? '<div style="font-family:monospace;font-size:12px;word-break:break-all">' +
          '<a href="' + url + '" target="_blank">' + url + '</a></div>' +
        '<p style="font-family:Arial,sans-serif;font-size:12px;color:#666">' +
          'Застосунок відкриється у новій вкладці браузера.</p>'
      : '<p style="font-family:Arial,sans-serif;font-size:13px">' +
          'Застосунок ще не задеплоєно.<br><br>' +
          'В редакторі Apps Script: <b>Deploy → New deployment → Web app</b><br>' +
          'Execute as: <b>User accessing the web app</b><br>' +
          'Who has access: <b>Anyone with Google account</b> (або домен)</p>'
  ).setWidth(480).setHeight(150);
  SpreadsheetApp.getUi().showModalDialog(html, '🌐 Веб-застосунок');
}
