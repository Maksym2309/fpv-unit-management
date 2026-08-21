// ═══════════════════════════════════════════════════════════
// JSON API ДЛЯ PWA (рівень 2 — незалежний веб-додаток)
//
// Фронтенд (GitHub Pages) шле POST на /exec:
//   { fn: 'getFlightList', args: [...], token: '...' }
// Відповідь: { ok: true, result: ... } або { ok: false, error: '...' }
//
// ДЕПЛОЙ ЦЬОГО ПРОЄКТУ:
//   Execute as:      Me (власник)
//   Who has access:  Anyone
// Безпека: БЕЗ валідного токена жодна функція (крім authLogin) не виконується.
// ═══════════════════════════════════════════════════════════

// Запасний список позивних-адміністраторів (бутстрап/аварійний доступ).
// ОСНОВНИЙ спосіб — чекбокс «Адмін» в аркуші «Персонал»: ставиться при
// створенні особи в застосунку або прямо в аркуші, код правити не треба.
const API_ADMIN_CALLSIGNS = [];

// Дозволені для виклику через API функції (рівно ті, що використовує застосунок)
const API_FUNCTIONS = [
  // auth
  'authLogin', 'authLogout', 'authWhoAmI', 'authChangePassword', 'authChangeMyRole',
  // читання
  'getCurrentUserEmail', 'getAdminEmail', 'getInventoryList', 'getInventoryCaps',
  'getSinotrackList', 'getSimList', 'getFlightList', 'getFrequencyAnalysis',
  'getPersonnelList',
  // персонал (адмінські функції самі перевіряють права)
  'adminListPersonnel', 'adminSavePerson', 'adminDeletePerson',
  'setPersonStatus', 'setPersonRole',
  // польоти та екіпажі
  'startFlight', 'endFlight', 'createCrew', 'updateCrew',
  // частоти
  'addExternalFreq', 'removeExternalFreq', 'swapCrewFrequency',
  // трекери й SIM
  'addSinotrack', 'addSim', 'bindSimToTracker', 'unbindSimFromTracker',
  'updateSinotrackStatus', 'updateSimStatus',
  // інвентар (видалення з обліку у PWA немає — тільки списання через статус)
  'acceptItem', 'updateItemStatusById',
  'webAddInventoryItem', 'getFormData', 'getNextIdNum', 'webSetItemAssignment',
  'webSetItemNote', 'webSetTrackerNote', 'webLogStatusChange', 'getLostMapData',
  'webUpdateLossRecord',
  // комплекти (перевіряють право «Інвентар» усередині)
  'assignToKit', 'removeFromKit',
  // інформація (документи підрозділу) — права перевіряють самі функції
  'infoListFolder', 'infoGetFile', 'infoCreateFolder', 'infoUploadFile', 'infoRenameFolder', 'infoUploadSession', 'infoTrashFolder', 'infoFileInfo', 'infoGetFileChunk',
  // витратники
  'getConsumablesList', 'getCompatOptions', 'webUpdateConsumable',
  'webAddConsumable', 'webWriteOffConsumable', 'webDeleteConsumable',
];

// Контекст поточного API-виклику (на час одного виконання doPost)
var __API_CTX = null;

// Email поточного користувача.
// - Звичайний виклик (таблиця, sidebar, doGet-версія): Google-акаунт.
// - API-виклик: ідентичність з токена. Адмін-позивний отримує ADMIN_EMAIL,
//   тому ВСІ існуючі перевірки прав по email працюють без змін.
//   Решта — стабільний псевдо-email opId@op.local (авторство «мій/чужий» працює).
function apiUserEmail_() {
  if (__API_CTX) return __API_CTX.email;
  return Session.getActiveUser().getEmail() || '';
}

function doPost(e) {
  var out;
  __API_CTX = null;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = String(req.fn || '');
    if (API_FUNCTIONS.indexOf(fn) === -1) throw new Error('Невідома функція: ' + fn);

    if (fn !== 'authLogin') {
      var p = authSession(String(req.token || ''));
      if (!p) throw new Error('AUTH_REQUIRED');
      var isAdm = p.admin === true || API_ADMIN_CALLSIGNS.some(function(cs){
        return String(cs).toLowerCase() === p.callsign.toLowerCase();
      });
      __API_CTX = {
        person: p,
        isAdmin: isAdm,
        email: isAdm ? ADMIN_EMAIL : (p.id + '@op.local'),
      };
    }

    var result = globalThis[fn].apply(null, Array.isArray(req.args) ? req.args : []);
    out = { ok: true, result: result === undefined ? null : result };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  } finally {
    __API_CTX = null;
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
