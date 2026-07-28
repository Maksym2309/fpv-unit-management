// ============================================================
// ОПЕРАТОР — Функції польоту та Sinotrack v2
// Вставити в Apps Script операторської таблиці
// ============================================================

// Замінити на email адміна (хто може завершувати будь-який виліт)
const ADMIN_EMAIL = 'YOUR_EMAIL@gmail.com';

const COLORS = {
  headerBg: '#1a3a5c',
  headerFg: '#ffffff',
  subBg:    '#2e6da4',
  altRow:   '#f0f4f8',
  white:    '#ffffff',
};

const COLS = {
  ID:          1,
  NAME:        2,
  TYPE:        3,
  ASSIGNMENT:  4,
  STATUS:      5,
  RESPONSIBLE: 6,
  DATE:        7,
  KIT:         8,  // Комплект — ID головного об'єкта або назва комплекту
  NOTE:        9,
  STATUS_TS:  10,  // Timestamp останньої зміни статусу (прихована)
};

// ===== ЧАСТОТНИЙ МОДУЛЬ =====
const BANDS = {
  // ── 5.8 GHz ──
  'A': [5865,5845,5825,5805,5785,5765,5745,5725],
  'B': [5733,5752,5771,5790,5809,5828,5847,5866],
  'E': [5705,5685,5665,5645,5885,5905,5925,5945],
  'F': [5740,5760,5780,5800,5820,5840,5860,5880],
  'R': [5658,5695,5732,5769,5806,5843,5880,5917],
  'H': [5653,5693,5733,5773,5813,5853,5893,5933],
  'HV-H': [5745,5765,5785,5805,5825],
  'L': [5362,5399,5436,5473,5510,5547,5584,5621],
  'L (Foxeer)': [5333,5373,5413,5453,5493,5533,5573,5613],
  'HV-L': [5240,5260,5280,5300,5320],
  'U': [5325,5348,5366,5384,5402,5420,5438,5456],
  'O': [5474,5492,5510,5528,5546,5564,5582,5600],
  'S': [6002,6028,6054,6080,6106,6132,6158,6184],
  'X': [4990,5020,5050,5080,5110,5140,5170,5200],
  // ── 3.3 GHz ──
  '3.3G A': [3330,3350,3370,3390,3410,3430,3450,3470],
  '3.3G B': [3170,3190,3210,3230,3250,3270,3290,3310],
  '3.3G A (GepRC)': [3083,3114,3145,3176,3207,3238,3269,3300],
  '3.3G B (GepRC)': [3215,3235,3255,3275,3295,3315,3335,3355],
  '3.3G C (GepRC)': [3170,3190,3210,3230,3250,3270,3290,3310],
  '3.3G D (GepRC)': [3320,3345,3370,3395,3420,3445,3470,3495],
  '3.3G E (GepRC)': [3310,3330,3355,3380,3405,3430,3455,3480],
};

const BAND_ORDER = [
  'A','B','E','F','R','H','HV-H','L','L (Foxeer)','HV-L','U','O','S','X',
  '3.3G A','3.3G B',
  '3.3G A (GepRC)','3.3G B (GepRC)','3.3G C (GepRC)','3.3G D (GepRC)','3.3G E (GepRC)',
];

const FREQ_LIST = Object.values(BANDS).reduce((acc, arr) => acc.concat(arr), []);

const HV_FREQS = [5240,5260,5280,5300,5320,5745,5765,5785,5805,5825];

const WARNING_FREQS = {
  5240: 'Канал HV-L1 (5240 МГц) — використання НЕ рекомендовано. Можливі проблеми зі зв\'язком. Літати тільки короткочасно.',
};

const VIDEO_SYSTEMS = {
  'Аналог':         20,
  'HDZero':         27,
  'DJI':            20,
  'Walksnail':      20,
  'Hornet Vision':  20,
};

const NAME_SUFFIXES = {
  'AD':  'Аналог',         'AT':  'Аналог',
  'HVD': 'Hornet Vision',  'HVT': 'Hornet Vision',
  'HDD': 'HDZero',         'HDT': 'HDZero',
  'DJD': 'DJI',            'DJT': 'DJI',
  'WSD': 'Walksnail',      'WST': 'Walksnail',
};

// Знайти бенд+канал за частотою → 'F4'
function freqToCode(freq) {
  for (const band in BANDS) {
    const idx = BANDS[band].indexOf(Number(freq));
    if (idx !== -1) return band + (idx + 1);
  }
  return '';
}

// Розпарсити 'F4 (5800)' або 'F4' → частота МГц
function codeToFreq(code) {
  if (!code) return 0;
  const m = String(code).match(/\((\d+)\)/);
  if (m) return Number(m[1]);
  const cm = String(code).match(/^(.+?)(\d)$/);
  if (cm && BANDS[cm[1]]) return BANDS[cm[1]][Number(cm[2]) - 1] || 0;
  return Number(code) || 0;
}

// Розпізнати відеосистему за назвою борту (по суфіксу)
function detectVideoSystem(name) {
  if (!name) return '';
  const upper = String(name).toUpperCase().trim();
  // Шукаємо суфікс в кінці назви (через пробіл або в кінці)
  // Сортуємо ключі за довжиною (довші спочатку) щоб HVD спрацював раніше за HD
  const keys = Object.keys(NAME_SUFFIXES).sort((a, b) => b.length - a.length);
  for (const suf of keys) {
    const re = new RegExp('(^|\\s)' + suf + '($|\\s)');
    if (re.test(upper)) return NAME_SUFFIXES[suf];
  }
  return ''; // не розпізнано — ручний вибір
}

// Тип сигналу (день/термал) за назвою
function detectThermal(name) {
  if (!name) return '';
  const upper = String(name).toUpperCase().trim();
  if (/\bT\b/.test(upper) || /(AT|HVT|HDT|DJT|WST)($|\s)/.test(upper)) return 'Термал';
  if (/(AD|HVD|HDD|DJD|WSD)($|\s)/.test(upper)) return 'День';
  return '';
}

function systemWidth(system) {
  return VIDEO_SYSTEMS[system] || 20;
}

// active = [{crew, drone, system, freq, pilot}]
function analyzeFrequencyConflicts(active) {
  const txs = active.filter(a => a.freq && a.system).map(a => ({
    crew: a.crew, drone: a.drone, system: a.system,
    freq: Number(a.freq), width: systemWidth(a.system), pilot: a.pilot || '',
  }));

  const result = {};
  FREQ_LIST.forEach(f => {
    const conflicts = [];
    txs.forEach(tx => {
      const gap = Math.abs(f - tx.freq);
      const minGap = (20 + tx.width) / 2;
      if (gap < minGap) {
        conflicts.push({ level: 'critical', type: 'Прямий', crew: tx.crew,
          detail: tx.crew + ' (' + tx.system + ' @' + tx.freq + ') Δ' + gap + 'МГц' });
      }
    });
    for (let i = 0; i < txs.length; i++) {
      for (let j = 0; j < txs.length; j++) {
        if (i === j) continue;
        const imd = 2 * txs[i].freq - txs[j].freq;
        if (Math.abs(f - imd) < 10) {
          conflicts.push({ level: 'serious', type: 'IMD3',
            crew: txs[i].crew + '+' + txs[j].crew,
            detail: 'IMD3: 2×' + txs[i].freq + '−' + txs[j].freq + '=' + imd + ' (' + txs[i].crew + '+' + txs[j].crew + ')' });
        }
      }
    }
    txs.forEach(tx => {
      const h2 = 2 * tx.freq;
      if (Math.abs(f - h2) < 15) {
        conflicts.push({ level: 'moderate', type: '2-а гармоніка', crew: tx.crew,
          detail: '2×' + tx.freq + '=' + h2 + ' (' + tx.crew + ')' });
      }
    });
    let topLevel = 'free';
    if (conflicts.some(c => c.level === 'critical')) topLevel = 'critical';
    else if (conflicts.some(c => c.level === 'serious')) topLevel = 'serious';
    else if (conflicts.some(c => c.level === 'moderate')) topLevel = 'moderate';
    result[f] = { level: topLevel, conflicts };
  });
  return result;
}

function getActiveFrequencyData() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return [];
  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 17).getValues();
  const result = [];
  const myEmail = Session.getActiveUser().getEmail() || '';

  rows.forEach(r => {
    const id = String(r[0]).trim();
    if (!id || String(r[11]).trim() !== 'Активний') return;
    const fc = String(r[15] || '');
    if (!fc) return;

    if (id.startsWith('CRW-')) {
      // Основна частота активного екіпажу — показуємо як зайняту (своя/підрозділ)
      result.push({
        id, crew: String(r[2]), drone: '', pilot: '',
        system: String(r[14] || ''),
        freqCode: fc, freq: codeToFreq(fc),
        creatorEmail: String(r[13] || ''),
        isCrewMain: true,
      });
    } else {
      // Конкретний виліт
      result.push({
        id, crew: String(r[2]), drone: String(r[4]),
        pilot: String(r[6]), system: String(r[14] || ''),
        freqCode: fc, freq: codeToFreq(fc),
        creatorEmail: String(r[13] || ''),
      });
    }
  });
  return result;
}

// Зібрати резервні VTX частоти активних екіпажів
function getCrewReserves() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return [];

  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 17).getValues();
  const reserves = [];
  rows.forEach(r => {
    const id = String(r[0]).trim();
    // Тільки активні екіпажі (CRW-) зі статусом Активний
    if (!id.startsWith('CRW-') || String(r[11]).trim() !== 'Активний') return;
    const resStr = String(r[16] || '').trim();
    if (!resStr) return;
    const crew = String(r[2]);
    const system = String(r[14] || '');
    resStr.split('|').filter(Boolean).forEach(code => {
      const freq = codeToFreq(code.trim());
      if (freq) reserves.push({ crew, system, freq, freqCode: code.trim() });
    });
  });
  return reserves;
}

// Дані для вкладки частот: активні + аналіз
// Чужі частоти (зовнішні підрозділи) — зберігаємо в _access аркуші, колонка C
function getExternalFreqs() {
  try {
    const sheet = getAccessSheet();
    const vals = sheet.getRange('C2:D200').getValues();
    return vals.filter(r => r[0]).map(r => ({
      freq: Number(r[0]),
      desc: String(r[1] || 'Чужий підрозділ'),
    }));
  } catch(e) { return []; }
}

function addExternalFreq(freq, desc) {
  const sheet = getAccessSheet();
  const vals = sheet.getRange('C2:C200').getValues().flat();
  let row = 2;
  for (let i = 0; i < vals.length; i++) {
    if (!vals[i]) { row = i + 2; break; }
    row = i + 3;
  }
  sheet.getRange(row, 3).setValue(Number(freq));
  sheet.getRange(row, 4).setValue(desc || 'Чужий підрозділ');
  return getExternalFreqs();
}

function removeExternalFreq(freq) {
  const sheet = getAccessSheet();
  const vals = sheet.getRange('C2:C200').getValues().flat();
  for (let i = 0; i < vals.length; i++) {
    if (Number(vals[i]) === Number(freq)) {
      sheet.getRange(i + 2, 3, 1, 2).clearContent();
    }
  }
  return getExternalFreqs();
}

function getCrewFreqInfo() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return [];
  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 17).getValues();
  const out = [];
  rows.forEach(r => {
    const id = String(r[0]).trim();
    if (!id.startsWith('CRW-') || String(r[11]).trim() !== 'Активний') return;
    out.push({
      crew: id, system: String(r[14] || ''),
      main: String(r[15] || '').trim(),
      reserves: String(r[16] || '').split('|').map(s => s.trim()).filter(Boolean),
      author: String(r[13] || ''),
    });
  });
  return out;
}

function getFrequencyAnalysis() {
  const active   = getActiveFrequencyData();
  const external = getExternalFreqs();
  const myEmail  = Session.getActiveUser().getEmail() || '';

  // Позначити джерело кожного активного вильоту
  active.forEach(a => {
    if (a.isCrewMain) {
      a.source = 'crew';  // основна частота екіпажу (не конкретний виліт)
    } else {
      a.source = (a.creatorEmail && a.creatorEmail === myEmail) ? 'mine' : 'unit';
    }
  });

  // Прибрати дублювання: якщо є активний виліт на тій самій частоті що й його екіпаж,
  // не показувати екіпаж окремо (виліт головніший)
  const flightFreqsByCrew = {};
  active.forEach(a => {
    if (!a.isCrewMain && a.freq) {
      flightFreqsByCrew[a.crew] = flightFreqsByCrew[a.crew] || [];
      flightFreqsByCrew[a.crew].push(a.freq);
    }
  });
  const filtered = active.filter(a => {
    if (a.isCrewMain) {
      const flightFreqs = flightFreqsByCrew[a.crew] || [];
      // Якщо виліт цього екіпажу вже на цій частоті — ховаємо дубль екіпажу
      if (flightFreqs.indexOf(a.freq) !== -1) return false;
    }
    return true;
  });
  active.length = 0;
  filtered.forEach(a => active.push(a));

  // Додати чужі як псевдо-вильоти
  external.forEach(e => {
    active.push({
      crew: e.desc, drone: '', pilot: '', system: 'Зовнішній',
      freq: e.freq, source: 'external', external: true,
    });
  });

  const crewFreqInfo = getCrewFreqInfo();
  return {
    active:        active,
    reserves:      getCrewReserves(),
    analysis:      analyzeFrequencyConflicts(active),
    bands:         BANDS,
    bandOrder:     BAND_ORDER,
    systems:       Object.keys(VIDEO_SYSTEMS),
    hvFreqs:       HV_FREQS,
    warningFreqs:  WARNING_FREQS,
    myEmail:       myEmail,
    adminEmail:    ADMIN_EMAIL,
    crewFreqInfo:  crewFreqInfo,
  };
}

// Швидка зміна основної частоти екіпажу (основна ↔ резервна)
// Тільки свій екіпаж або адмін. newMainCode має бути серед резервних.
function swapCrewFrequency(crewId, newMainCode) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) throw new Error('Журнал порожній');

  const myEmail = Session.getActiveUser().getEmail() || '';
  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 17).getValues();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[0]).trim() !== crewId) continue;

    // Перевірка прав: свій екіпаж або адмін
    const author = String(r[13] || '');
    if (author !== myEmail && myEmail !== ADMIN_EMAIL) {
      throw new Error('Можна міняти частоту тільки свого екіпажу');
    }

    const curMain = String(r[15] || '').trim();       // P — основна
    const reserves = String(r[16] || '').split('|').map(s => s.trim()).filter(Boolean); // Q

    const idx = reserves.indexOf(newMainCode);
    if (idx === -1) throw new Error('Ця частота не серед резервних');

    // Міняємо: нова основна = newMainCode, стара основна йде в резерв на її місце
    reserves[idx] = curMain;
    const rowNum = 3 + i;
    sheet.getRange(rowNum, 16).setValue(newMainCode);       // P — нова основна
    sheet.getRange(rowNum, 17).setValue(reserves.join('|')); // Q — оновлені резервні
    return { crew: crewId, main: newMainCode };
  }
  throw new Error('Екіпаж не знайдено');
}

// Зберігаємо email в прихованому аркуші _access щоб всі користувачі могли читати
function getAccessSheet(ss) {
  const s = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = s.getSheetByName('_access');
  if (!sheet) {
    sheet = s.insertSheet('_access');
    sheet.hideSheet();
    sheet.getRange('A1').setValue('admins');
    sheet.getRange('B1').setValue('allowed');
  }
  return sheet;
}


// Безпечне отримання аркушу — кілька стратегій пошуку
// Записати статус і timestamp
function setItemStatus(sheet, row, status) {
  sheet.getRange(row, COLS.STATUS).setValue(status);
  sheet.getRange(row, COLS.STATUS_TS).setValue(new Date().toISOString());
}

function getSheet(ss, name) {
  // 1. Точний пошук
  let sh = ss.getSheetByName(name);
  if (sh) return sh;

  const all = ss.getSheets();

  // 2. Нормалізований пошук (без зайвих пробілів, trim)
  sh = all.find(s => s.getName().replace(/\s+/g, ' ').trim() === name.replace(/\s+/g, ' ').trim());
  if (sh) return sh;

  // 3. Пошук без регістру
  sh = all.find(s => s.getName().toLowerCase().trim() === name.toLowerCase().trim());
  if (sh) return sh;

  // 4. Пошук за ключовим словом (перше слово назви)
  const keyword = name.split(' ')[0].toLowerCase();
  sh = all.find(s => s.getName().toLowerCase().startsWith(keyword));
  if (sh) return sh;

  Logger.log('Аркуш "' + name + '" не знайдено. Наявні: ' + all.map(s => '"' + s.getName() + '"').join(', '));
  return null;
}
// Список предметів для форм
function getInventoryList() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) return [];
  return inv.getRange(3, 1, inv.getLastRow() - 2, COLS.KIT).getValues()
    .filter(row => String(row[0]).trim() !== '')
    .map(row => ({
      id:          String(row[0]),
      name:        String(row[1]),
      type:        String(row[2]),
      assignment:  String(row[3]),
      status:      String(row[4]),
      responsible: String(row[5]),
      kit:         String(row[COLS.KIT - 1] || ''),
    }));
}
// Отримати список трекерів
function getSinotrackList() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Sinotrack');
  if (!sheet || sheet.getLastRow() < 3) return [];
  return sheet.getRange(3, 1, sheet.getLastRow() - 2, 8).getValues()
    .filter(row => String(row[0]).trim() !== '')
    .map(row => ({
      id:         String(row[0]),
      model:      String(row[1]),
      status:     String(row[2]),  // Робочий / Зламаний / Втрачений
      simContact: String(row[3]),  // Назва контакту SIM
      simNumber:  String(row[4]),  // Номер SIM
      binding:    String(row[5]),  // До якого борту прив'язаний
      imei:       String(row[6]),
      note:       String(row[7]),
    }));
}
// Отримати список SIM-карт
function getSimList() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'SIM-карти');
  if (!sheet || sheet.getLastRow() < 3) return [];
  return sheet.getRange(3, 1, sheet.getLastRow() - 2, 5).getValues()
    .filter(row => String(row[0]).trim() !== '')
    .map(row => ({
      id:        String(row[0]),
      contact:   String(row[1]),
      number:    String(row[2]),
      status:    String(row[3]),  // Активна / Заблокована
      binding:   String(row[4]),  // До якого трекера прив'язана
    }));
}
// ============================================================
// ЖУРНАЛ ПОЛЬОТУ
// ============================================================
function getFlightList() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return [];
  return sheet.getRange(3, 1, sheet.getLastRow() - 2, 17).getValues()
    .filter(row => String(row[0]).trim() !== '')
    .map(row => ({
      id:           String(row[0]),
      date:         String(row[1]),
      crew:         String(row[2]),
      gnst:         String(row[3]),
      drones:       String(row[4]),
      bind:         String(row[5]),
      pilot:        String(row[6]),   // Відповідальна особа вильоту
      tracker:      String(row[7]),
      trackerOk:    String(row[8]),
      start:        String(row[9]),
      end:          String(row[10]),
      status:       String(row[11]),
      note:         String(row[12]),
      creatorEmail: String(row[13] || ''),
      system:       String(row[14] || ''),
      freq:         String(row[15] || ''),
      reserves:     String(row[16] || ''),
    }));
}
// Отримати список екіпажів
function getCrewList() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return [];
  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 17).getValues();
  // Унікальні екіпажі по полю crew (col 3) — беремо тільки рядки де це "crew definition"
  // Crew definition: рядки де col 9 (start) порожнє — це заголовки екіпажу
  const crews = {};
  rows.filter(r => String(r[0]).trim() !== '').forEach(r => {
    const crewId = String(r[2]).trim();
    if (!crews[crewId]) {
      crews[crewId] = {
        id:      crewId,
        gnst:    String(r[3]),
        drones:  String(r[4]),
        bind:    String(r[5]),
        tracker: String(r[7]),   // col H — Sinotrack
        status:  String(r[11]),  // col L — Статус
        system:  String(r[14] || ''),  // col O — Відеосистема
        freq:    String(r[15] || ''),  // col P — Частота
        reserves: String(r[16] || ''), // col Q — Резервні VTX
      };
    }
  });
  return Object.values(crews);
}
// ============================================================
// ДАНІ ДЛЯ ФОРМ — викликаються з HTML через google.script.run
// ============================================================
// Отримати email поточного користувача для sidebar
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail() || '';
}
function getAdminEmail() {
  return ADMIN_EMAIL;
}
// Почати виліт
function startFlight(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet) throw new Error('Аркуш Журнал польоту не знайдено');

  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, 1).getValues().flat().forEach(id => {
      const m = String(id).match(/FLT-(\d+)/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  const newId = 'FLT-' + String(maxNum + 1).padStart(4, '0');
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const now   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');

  const creatorEmail = Session.getActiveUser().getEmail() || '';
  sheet.appendRow([
    newId, today,
    data.crew      || '',    // C: Екіпаж
    data.gnst      || '',    // D: Наземна станція
    data.drones    || '',    // E: Борти
    data.bind      || '',    // F: Bind фраза
    data.pilot     || '',    // G: Пілот (відповідальна особа вильоту)
    data.tracker   || '',    // H: Sinotrack
    data.trackerOk || '',    // I: Трекер ОК
    now,                     // J: Початок
    '',                      // K: Кінець
    'Активний',              // L: Статус
    data.note      || '',    // M: Примітка
    creatorEmail,            // N: Автор
    data.system    || '',    // O: Відеосистема
    data.freq      || '',    // P: Частота
  ]);
  const insertedRow = sheet.getLastRow();
  sheet.getRange(insertedRow, 10).setNumberFormat('@'); // початок
  sheet.getRange(insertedRow, 11).setNumberFormat('@'); // кінець
  // Захист не ставимо тут — рядок ще активний (Кінець порожній)
  const row = sheet.getLastRow();
  sheet.getRange(row, 1, 1, 16)
    .setBackground(row % 2 === 0 ? COLORS.altRow : COLORS.white);

  return { id: newId, start: now };
}
// Завершити виліт
function endFlight(flightId, droneStatuses, note) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = getSheet(ss, 'Журнал польоту');
  const inv     = getSheet(ss, 'Інвентар');
  if (!sheet) throw new Error('Аркуш Журнал польоту не знайдено');

  const ids = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(flightId);
  if (idx === -1) throw new Error('Виліт не знайдено: ' + flightId);
  const row = idx + 3;

  // Перевірка прав: тільки автор або адмін може завершити
  const currentEmail  = Session.getActiveUser().getEmail() || '';
  const creatorEmail  = String(sheet.getRange(row, 14).getValue()); // col N — Автор
  const isAdmin       = currentEmail === ADMIN_EMAIL;
  const isCreator     = !creatorEmail || creatorEmail === currentEmail;
  if (!isAdmin && !isCreator) {
    throw new Error('Ви не можете завершити чужий виліт. Автор: ' + creatorEmail);
  }

  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  sheet.getRange(row, 11).setValue(now);         // col K — Кінець
  sheet.getRange(row, 12).setValue('Завершено'); // col L — Статус
  // Примітку запишемо нижче (після збору деталей втрати)

  // Оновити статуси бортів
  const updated = [];
  let cascadeLost = false;
  let lostSummary = '';  // деталі втрати для примітки вильоту
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const user  = Session.getActiveUser().getEmail() || '';
  if (droneStatuses && inv) {
    const invIds = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
    droneStatuses.forEach(ds => {
      const invIdx = invIds.indexOf(ds.id);
      if (invIdx !== -1) {
        const invRow = invIdx + 3;
        setItemStatus(inv, invRow, ds.status);
        updated.push(ds.id + ' → ' + ds.status);
        if (ds.status === 'Втрачений') {
          cascadeLost = true;
          // Уніфікована нотатка втрати (як в основній формі)
          const ld = ds.lostData || {};
          let lostNote = '⚠️ ВТРАЧЕНО ' + today + '\n';
          if (ld.coords)     lostNote += '📍 ' + ld.coords + '\n';
          if (ld.mapsLink)   lostNote += '🗺️ ' + ld.mapsLink + '\n';
          if (ld.conditions) lostNote += '📋 ' + ld.conditions + '\n';
          lostNote += '👤 ' + user;
          lostSummary = lostNote;
          try {
            inv.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => { try { p.remove(); } catch(e){} });
            inv.getRange(invRow, COLS.ID).setNote(lostNote);
          } catch(e) { Logger.log('setNote помилка: ' + e); }
        }
      }
    });
  }

  // Каскадна втрата: борт втрачено → трекер вильоту → його SIM
  if (cascadeLost) {
    const trackerCell = String(sheet.getRange(row, 8).getValue()); // col H — Sinotrack
    const trackerIds = trackerCell.split('|').map(s => s.trim()).filter(Boolean);
    trackerIds.forEach(tid => {
      try {
        const lostInfo = cascadeLoseTracker(tid, note);
        if (lostInfo) updated.push.apply(updated, lostInfo);
      } catch(e) { Logger.log('Каскад втрати трекера ' + tid + ': ' + e); }
    });
  }

  // Записати примітку вильоту (включно з деталями втрати якщо є)
  let finalNote = note || '';
  if (lostSummary) {
    finalNote = finalNote ? (lostSummary + ' | ' + finalNote) : lostSummary;
  }
  if (finalNote) sheet.getRange(row, 13).setValue(finalNote); // col M

  // Захистити завершений рядок від редагування
  try { protectRow(sheet, row); } catch(e) {}

  return { id: flightId, end: now, updated };
}

// Каскадна втрата трекера + його SIM. Повертає список змін.
function cascadeLoseTracker(trackerId, note) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const snt = getSheet(ss, 'Sinotrack');
  const sim = getSheet(ss, 'SIM-карти');
  if (!snt || snt.getLastRow() < 3) return [];

  const changes = [];
  // Витягти трекер по ID (може бути IMEI або SNT-XXX)
  const sntData = snt.getRange(3, 1, snt.getLastRow() - 2, 8).getValues();
  let sntIdx = sntData.findIndex(r => String(r[0]).trim() === trackerId);
  // Якщо не знайшли по ID — пробуємо по IMEI (col 7)
  if (sntIdx === -1) sntIdx = sntData.findIndex(r => String(r[6]).trim() === trackerId);
  if (sntIdx === -1) return [];

  const sntRow = sntIdx + 3;
  const sntStatus = String(sntData[sntIdx][2]).trim();
  // Втрачений незворотній — ставимо тільки якщо ще не втрачений
  if (sntStatus !== 'Втрачений') {
    snt.getRange(sntRow, 3).setValue('Втрачений');
    touchSinotrack(snt, sntRow);
    changes.push('Трекер ' + String(sntData[sntIdx][0]) + ' → Втрачений');
  }

  // Знайти SIM прив'язану до цього трекера і втратити
  const simNumber = String(sntData[sntIdx][4]).trim(); // SIM-номер у трекері
  if (sim && sim.getLastRow() >= 3 && simNumber) {
    const simData = sim.getRange(3, 1, sim.getLastRow() - 2, 5).getValues();
    simData.forEach((r, i) => {
      const num = String(r[2]).trim();
      const binding = String(r[4]).trim();
      const sntId = String(sntData[sntIdx][0]).trim();
      // SIM прив'язана до цього трекера (по номеру або по binding)
      if ((num && num === simNumber) || binding === sntId) {
        if (String(r[3]).trim() !== 'Втрачена') {
          sim.getRange(3 + i, 4).setValue('Втрачена');
          touchSim(sim, 3 + i);
          changes.push('SIM ' + String(r[0]) + ' → Втрачена');
        }
      }
    });
  }
  return changes;
}
// Створити екіпаж (зберігається як рядок з порожнім start/end)
function createCrew(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet) throw new Error('Аркуш Журнал польоту не знайдено');
  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, 1).getValues().flat().forEach(id => {
      const m = String(id).match(/(?:FLT|CRW)-(\d+)/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  const crewId = 'CRW-' + String(maxNum + 1).padStart(3, '0');
  const today  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const email  = Session.getActiveUser().getEmail() || '';
  sheet.appendRow([
    crewId, today, crewId,    // A:ID, B:Дата, C:Екіпаж
    data.gnst||'',             // D:Наземна станція
    data.drones||'',           // E:Борти
    data.bind||'',             // F:Bind фраза
    '',                        // G:Відповідальна особа (порожня для екіпажу)
    data.tracker||'',          // H:Sinotrack
    '',                        // I:Трекер ОК
    '', '',                    // J:Початок, K:Кінець
    'Активний',                // L:Статус
    data.note||'',             // M:Примітка
    email,                     // N:Автор
    data.system||'',           // O:Відеосистема
    data.freq||'',             // P:Частота
    data.reserves||'',         // Q:Резервні VTX (через |)
  ]);
  return crewId;
}
// Оновити екіпаж
function updateCrew(crewId, data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet) throw new Error('Журнал польоту не знайдено');
  const ids = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(crewId);
  if (idx === -1) throw new Error('Екіпаж не знайдено: ' + crewId);
  const row = idx + 3;
  if (data.gnst    !== undefined) sheet.getRange(row, 4).setValue(data.gnst);
  if (data.drones  !== undefined) sheet.getRange(row, 5).setValue(data.drones);
  if (data.bind    !== undefined) sheet.getRange(row, 6).setValue(data.bind);
  // col G (7) = Відповідальна особа — не змінюємо для екіпажу
  if (data.tracker !== undefined) sheet.getRange(row, 8).setValue(data.tracker);
  if (data.system  !== undefined) sheet.getRange(row, 15).setValue(data.system); // col O
  if (data.freq    !== undefined) sheet.getRange(row, 16).setValue(data.freq);   // col P
  if (data.reserves!== undefined) sheet.getRange(row, 17).setValue(data.reserves); // col Q
  return { id: crewId };
}
// Оновити статус трекера
function updateSinotrackStatus(id, status, note) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Sinotrack');
  if (!sheet) throw new Error('Аркуш Sinotrack не знайдено');
  const ids = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(id);
  if (idx === -1) throw new Error('Трекер не знайдено: ' + id);
  const row = idx + 3;
  sheet.getRange(row, 3).setValue(status);
  if (note) sheet.getRange(row, 8).setValue(note);
  touchSinotrack(sheet, row);
  return { id, status };
}
// Оновити статус SIM
function updateSimStatus(simId, status) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'SIM-карти');
  if (!sheet) throw new Error('SIM-карти не знайдено');
  const ids = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(simId);
  if (idx === -1) throw new Error('SIM не знайдено: ' + simId);
  sheet.getRange(idx + 3, 4).setValue(status);
  touchSim(sheet, idx + 3);
  return { id: simId, status };
}
// Прив'язати SIM до трекера
function bindSimToTracker(simId, trackerId, force) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const snt = getSheet(ss, 'Sinotrack');
  const sim = getSheet(ss, 'SIM-карти');
  if (!snt || !sim) throw new Error('Аркуші не знайдено');

  // Перевірити статус трекера
  if (snt.getLastRow() >= 3) {
    const sntData = snt.getRange(3, 1, snt.getLastRow() - 2, 3).getValues();
    const sntRow  = sntData.find(r => String(r[0]) === trackerId);
    if (sntRow) {
      const trkStatus = String(sntRow[2]).trim();
      if (trkStatus === 'Втрачений') throw new Error('❌ Неможливо прив\'язати SIM до ВТРАЧЕНОГО трекера ' + trackerId);
      if (trkStatus === 'Зламаний' && !force) throw new Error('⚠️ Трекер ' + trackerId + ' ЗЛАМАНИЙ. Прив\'язка заблокована.');
    }
  }

  // Перевірити статус SIM
  if (sim.getLastRow() >= 3) {
    const simData = sim.getRange(3, 1, sim.getLastRow() - 2, 4).getValues();
    const simRow  = simData.find(r => String(r[0]) === simId);
    if (simRow) {
      const simStatus = String(simRow[3]).trim();
      if (simStatus === 'Втрачена') throw new Error('❌ Неможливо прив\'язати ВТРАЧЕНУ SIM ' + simId);
      if (simStatus === 'Заблокована' && !force) throw new Error('⚠️ SIM ' + simId + ' ЗАБЛОКОВАНА. Передай force=true для примусової прив\'язки.');
    }
  }


  // Перевірити чи SIM не в іншому робочому трекері
  if (!force) {
    const conflict = checkSimConflict(simId, trackerId);
    if (conflict) {
      throw new Error('⚠️ SIM вже прив\'язана до робочого трекера ' + conflict.conflictId + ' (' + conflict.model + ')');
    }
  }

  // Оновити трекер
  const sntIds = snt.getRange(3, 1, snt.getLastRow() - 2, 1).getValues().flat().map(String);
  const sntIdx = sntIds.indexOf(trackerId);
  if (sntIdx !== -1) {
    const row = sntIdx + 3;
    const simData = sim.getRange(3, 1, sim.getLastRow() - 2, 3).getValues()
      .find(r => String(r[0]) === simId);
    if (simData) {
      snt.getRange(row, 4).setValue(String(simData[1])); // contact
      snt.getRange(row, 5).setValue(String(simData[2])); // number
    }
    snt.getRange(row, 6).setValue(''); // binding to drone - cleared
    touchSinotrack(snt, row);
  }

  // Оновити SIM
  const simIds = sim.getRange(3, 1, sim.getLastRow() - 2, 1).getValues().flat().map(String);
  const simIdx = simIds.indexOf(simId);
  if (simIdx !== -1) { sim.getRange(simIdx + 3, 5).setValue(trackerId); touchSim(sim, simIdx + 3); }

  return { simId, trackerId };
}
// Відв'язати SIM від трекера
function unbindSimFromTracker(trackerId) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const snt = getSheet(ss, 'Sinotrack');
  const sim = getSheet(ss, 'SIM-карти');
  if (!snt) throw new Error('Sinotrack не знайдено');

  const sntIds = snt.getRange(3, 1, snt.getLastRow() - 2, 1).getValues().flat().map(String);
  const sntIdx = sntIds.indexOf(trackerId);
  if (sntIdx === -1) throw new Error('Трекер не знайдено: ' + trackerId);
  const row = sntIdx + 3;

  // Очистити SIM поля в трекері
  snt.getRange(row, 4).setValue('');
  snt.getRange(row, 5).setValue('');
  touchSinotrack(snt, row);

  // Очистити прив'язку в SIM-картах
  if (sim && sim.getLastRow() >= 3) {
    const simData = sim.getRange(3, 1, sim.getLastRow() - 2, 5).getValues();
    simData.forEach((r, i) => {
      if (String(r[4]).trim() === trackerId) {
        sim.getRange(3 + i, 5).setValue('');
        touchSim(sim, 3 + i);
      }
    });
  }
  return { id: trackerId };
}
// Перевірити чи SIM вже прив'язана до іншого робочого трекера
function checkSimConflict(simId, targetTrackerId) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const snt = getSheet(ss, 'Sinotrack');
  if (!snt || snt.getLastRow() < 3) return null;

  const sim = getSheet(ss, 'SIM-карти');
  if (!sim || sim.getLastRow() < 3) return null;

  // Знайти номер SIM
  const simData = sim.getRange(3, 1, sim.getLastRow() - 2, 3).getValues();
  const simRow = simData.find(r => String(r[0]) === simId);
  if (!simRow) return null;
  const simNumber = String(simRow[2]);

  // Перевірити чи цей номер є в інших робочих трекерах
  const sntData = snt.getRange(3, 1, snt.getLastRow() - 2, 8).getValues();
  const conflict = sntData.find(r =>
    String(r[0]) !== targetTrackerId &&
    String(r[4]).trim() === simNumber.trim() &&
    String(r[2]).trim() === 'Робочий'
  );
  return conflict ? { conflictId: String(conflict[0]), model: String(conflict[1]) } : null;
}

// Timestamp helpers
function nowTS() { return new Date().toISOString(); }
function touchSinotrack(sheet, row) { sheet.getRange(row, 9).setValue(nowTS()); }
function touchSim(sheet, row) { sheet.getRange(row, 6).setValue(nowTS()); }

function addSinotrack(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Sinotrack');
  if (!sheet) throw new Error('Аркуш Sinotrack не знайдено');
  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, 1).getValues().flat().forEach(id => {
      const m = String(id).match(/SNT-(\d+)/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  const newId = 'SNT-' + String(maxNum + 1).padStart(3, '0');
  sheet.appendRow([newId, data.model || '', data.status || 'Робочий',
    data.simContact || '', data.simNumber || '', '', data.imei || '', data.note || '', nowTS()]);
  return newId;
}
// Додати SIM-карту
function addSim(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'SIM-карти');
  if (!sheet) throw new Error('Аркуш SIM-карти не знайдено');
  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, 1).getValues().flat().forEach(id => {
      const m = String(id).match(/SIM-(\d+)/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  const newId = 'SIM-' + String(maxNum + 1).padStart(3, '0');
  sheet.appendRow([newId, data.contact || '', data.number || '', data.status || 'Активна', '', nowTS()]);
  return newId;
}
// Захистити конкретний рядок в аркуші від редагування
function protectRow(sheet, rowNum) {
  try {
    const protection = sheet.getRange(rowNum, 1, 1, 14).protect();
    protection.setDescription('Запис ' + rowNum + ' — тільки через sidebar');
    protection.setWarningOnly(false);
    // Тільки власник може редагувати
    const me = Session.getEffectiveUser();
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors().filter(e => e.getEmail() !== me.getEmail()));
  } catch(e) {
    Logger.log('protectRow error: ' + e);
  }
}

// ============================================================
// МЕНЮ
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('✈️ Польоти')
    .addItem('🚀 Відкрити застосунок', 'openApp')
    .addSeparator()
    .addItem('✈️ Журнал польоту', 'openFlightLogForm')
    .addItem('📡 Sinotrack', 'openSinotrackForm')
    .addItem('📻 Частоти', 'openFrequencyForm')
    .addToUi();
}

// Застосунок на весь екран з вкладками
function openApp() {
  const html = HtmlService.createHtmlOutputFromFile('AppShell')
    .setTitle('🚀 FPV застосунок')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Повернути HTML форми для вбудовування в застосунок (iframe)
function getFormHtml(formName) {
  var html = HtmlService.createHtmlOutputFromFile(formName).getContent();
  // Додаємо клас wide-mode щоб форма знала що вона в застосунку
  html = html.replace('<body>', '<body class="in-app">');
  return html;
}

function openFlightLogForm() {
  const html = HtmlService.createHtmlOutputFromFile('FlightLogForm')
    .setTitle('✈️ Журнал польоту')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openFlightLogModal() {
  const html = HtmlService.createHtmlOutputFromFile('FlightLogForm').setWidth(1400).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, '✈️ Журнал польоту');
}

function openSinotrackForm() {
  const html = HtmlService.createHtmlOutputFromFile('SinotrackForm')
    .setTitle('📡 Sinotrack')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openSinotrackModal() {
  const html = HtmlService.createHtmlOutputFromFile('SinotrackForm').setWidth(1400).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, '📡 Sinotrack');
}

function openFrequencyForm() {
  const html = HtmlService.createHtmlOutputFromFile('FrequencyForm')
    .setTitle('📻 Частоти')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openFrequencyModal() {
  const html = HtmlService.createHtmlOutputFromFile('FrequencyForm').setWidth(1400).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, '📻 Карта частот');
}
