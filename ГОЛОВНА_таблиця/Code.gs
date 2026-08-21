// ============================================================
// ІНВЕНТАРИЗАЦІЯ v4.1 — ВИПРАВЛЕНО: sidebar через окремий HTML-файл
// ============================================================
// ВСТАНОВЛЕННЯ:
// 1. Apps Script → New File → HTML → назви "AddForm"  → вставити вміст з AddForm.html
// 2. Apps Script → New File → HTML → назви "EditForm" → вставити вміст з EditForm.html
// 3. Цей файл — основний скрипт (Code.gs або будь-яка назва .gs)
// 4. Запустити buildInventorySystem() один раз
// ============================================================

const COLS = {
  ID:          1,
  NAME:        2,
  TYPE:        3,
  ASSIGNMENT:  4,
  STATUS:      5,
  RESPONSIBLE: 6,
  DATE:        7,
  KIT:         8,
  NOTE:        9,
  STATUS_TS:  10,  // Timestamp останньої зміни статусу (прихована)
};

const TYPE_LIST = [
  // ── Борти ──────────────────────────────────────────
  'FPV — FPV дрон (4+ мотори)',
  'STNG — Sting',
  'WING — Літак / крило',
  // ── Керування ──────────────────────────────────────
  'RMT — Пульт (RadioMaster тощо)',
  'TX — Передавач (окремий модуль)',
  // ── Наземна станція — компоненти ───────────────────
  'GNST — Наземна станція (комплект)',
  'TRK — Поворотка (antenna tracker)',
  'ANT — Антена (будь-яка)',
  'VRX — Аналоговий відеоприймач',
  // ── Відео / окуляри ────────────────────────────────
  'GGL — Окуляри FPV',
  // ── Живлення ───────────────────────────────────────
  'BAT — Батарея',
  'CHG — Зарядний пристрій',
  // ── Симулятор ──────────────────────────────────────
  'PC — Комп\'ютер',
  'MON — Монітор',
  'KEY — Клавіатура',
  'MSE — Мишка',
  // ── Інше ───────────────────────────────────────────
  'HTR — Обігрівач',
  'TOOL — Інструмент',
  'MST — Щогла',
  'OTHER — Інше',
];

const ASSIGNMENT_LIST = ['Школа', 'На виїзд', 'Sting', 'Симулятор', 'Інше', 'Майстерня', 'Літак'];
const STATUS_LIST     = ['Робочий', 'Ремонт', 'На перевірці', 'Несправний', 'Втрачений', 'Списаний', 'Резерв'];

// ============================================================
// ВІДЕОСИСТЕМИ ТА ЧАСТОТИ
// ============================================================

// Повна сітка бендів і каналів (бенд → [частоти каналів 1-8])
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

// Явний порядок бендів для відображення (5.8GHz зверху, 3.3G внизу)
const BAND_ORDER = [
  'A','B','E','F','R','H','HV-H','L','L (Foxeer)','HV-L','U','O','S','X',
  '3.3G A','3.3G B',
  '3.3G A (GepRC)','3.3G B (GepRC)','3.3G C (GepRC)','3.3G D (GepRC)','3.3G E (GepRC)',
];

// Плоский список усіх частот (для аналізу конфліктів)
const FREQ_LIST = Object.values(BANDS).reduce((acc, arr) => acc.concat(arr), []);

// Частоти доступні для Hornet Vision (тільки ці)
const HV_FREQS = [5240,5260,5280,5300,5320,5745,5765,5785,5805,5825];

// Нерекомендовані частоти (жовте попередження) → текст попередження
const WARNING_FREQS = {
  5240: 'Канал HV-L1 (5240 МГц) — використання НЕ рекомендовано. Можливі проблеми зі зв\'язком. Літати тільки короткочасно.',
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

// Відеосистеми: назва → ширина каналу (МГц)
const VIDEO_SYSTEMS = {
  'Аналог':         20,
  'HDZero':         27,
  'DJI':            20,
  'Walksnail':      20,
  'Hornet Vision':  20,
};

// Суфікси назв бортів → відеосистема
// Формат: СИСТЕМА + D(день) / T(термал)
const NAME_SUFFIXES = {
  'AD':  'Аналог',         'AT':  'Аналог',
  'HVD': 'Hornet Vision',  'HVT': 'Hornet Vision',
  'HDD': 'HDZero',         'HDT': 'HDZero',
  'DJD': 'DJI',            'DJT': 'DJI',
  'WSD': 'Walksnail',      'WST': 'Walksnail',
};

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

// ============================================================
// РУШІЙ КОНФЛІКТІВ ЧАСТОТ
// ============================================================

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
  const myEmail = apiUserEmail_() || '';

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

// Інфо про активні екіпажі: основна частота, резервні, автор
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
      crew: id,
      system: String(r[14] || ''),
      main: String(r[15] || '').trim(),
      reserves: String(r[16] || '').split('|').map(s => s.trim()).filter(Boolean),
      author: String(r[13] || ''),
    });
  });
  return out;
}


// ДІАГНОСТИКА — запусти вручну, подивись Logger (Перегляд → Логи виконання)
function diagFrequencies() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet) { Logger.log('НЕМАЄ аркуша Журнал польоту'); return; }
  Logger.log('Останній рядок: ' + sheet.getLastRow() + ', колонок: ' + sheet.getLastColumn());

  if (sheet.getLastRow() >= 3) {
    const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 17).getValues();
    rows.forEach((r, i) => {
      const id = String(r[0]).trim();
      if (!id) return;
      Logger.log('Рядок ' + (i+3) + ': ID=' + id +
        ' | Статус(L)=' + r[11] +
        ' | Система(O)=' + r[14] +
        ' | Частота(P)=' + r[15] +
        ' | Резервні(Q)=' + r[16]);
    });
  }

  // Перевірка що повертає getFrequencyAnalysis
  const fa = getFrequencyAnalysis();
  Logger.log('getFrequencyAnalysis.active: ' + JSON.stringify(fa.active));
  Logger.log('getFrequencyAnalysis.crewFreqInfo: ' + JSON.stringify(fa.crewFreqInfo));
}

function getFrequencyAnalysis() {
  const active   = getActiveFrequencyData();
  const external = getExternalFreqs();
  const myEmail  = apiUserEmail_() || '';

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

  // Інфо про екіпажі для швидкої зміни частоти (основна + резервні + хто автор)
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

  const myEmail = apiUserEmail_() || '';
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

const COLORS = {
  headerBg: '#1a3a5c',
  headerFg: '#ffffff',
  subBg:    '#2e6da4',
  altRow:   '#f0f4f8',
  white:    '#ffffff',
};

// Email адміністратора — може завершувати будь-який виліт
// Заміни на свій email після першого запуску
const ADMIN_EMAIL = 'YOUR_EMAIL@gmail.com';

// Список email яким показуються ВСІ аркуші (крім прихованих системних)
// Редагуй через Адміністрування → Керування доступом
const ALLOWED_EMAILS_KEY = 'allowedEmails';
const ADMIN_EMAILS_KEY   = 'adminEmails';

// Аркуші які бачать усі авторизовані користувачі
const SHEETS_FOR_ALL = [
  'Sinotrack',
  'SIM-карти',
  'Журнал польоту',
  'Дашборд',
  'Витратники',
  'Списання',
  'Втрачені',
  'Школа',
  'На виїзд',
  'Sting',
  'Симулятор',
  'Інше',
  'Майстерня',
  'Літак',
];

// Аркуші тільки для адміна (застосовується в applySheetVisibility)
const SHEETS_ADMIN_ONLY = [
  'Інвентар',
  'Журнал руху',
  'Довідник назв',
  // «Персонал» містить колонку з хешами паролів (F). Приховування тут —
  // лише щоб аркуш не потрапляв на очі: будь-хто з правом читання таблиці
  // може показати прихований аркуш чи колонку. Реальний захист у тому,
  // що хеші існують ТІЛЬКИ в цій таблиці (див. secretCols у mergeByTimestamp).
  'Персонал',
];

// Системні аркуші — завжди приховані для всіх
const SHEETS_HIDDEN = [
  '_tmp',
  '_access',
];

function typeCode(typeVal) {
  return String(typeVal).split(' ')[0];
}

// Безпечне отримання аркушу — кілька стратегій пошуку
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

// ============================================================
// МЕНЮ
// ============================================================
// Очистити всі застарілі тригери (запусти один раз якщо є проблеми)
function clearAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const count = triggers.length;
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Видалено ' + count + ' тригерів. Перезавантаж таблицю.',
    '✅ Готово', 5
  );
}

// ============================================================
// TIMESTAMP СТАТУСУ
// ============================================================

// Записати статус і timestamp в рядок інвентарю
function setItemStatus(sheet, row, status) {
  sheet.getRange(row, COLS.STATUS).setValue(status);
  sheet.getRange(row, COLS.STATUS_TS).setValue(new Date().toISOString());
}

// Пріоритет статусів (більше = вищий пріоритет)
function statusPriority(st) {
  const p = { 'Втрачений':6, 'Несправний':5, 'Списаний':4, 'Ремонт':3, 'Резерв':2, 'На перевірці':1, 'Робочий':0 };
  return p[st] !== undefined ? p[st] : -1;
}

// Порівняти два статуси з урахуванням timestamp
// Повертає статус який треба зберегти в основній таблиці
function resolveStatus(mainSt, mainTs, opSt, opTs) {
  // «Втрачений» — пріоритетний, але НЕ поза часом: якщо в головній
  // ПІЗНІШЕ свідомо поставили інший статус (Знайдений/Списаний/Робочий),
  // операторська зі старим «Втрачений» не має його відкочувати.
  // Раніше тут було безумовне «return opSt» — і борт після списання
  // в PWA повертався у «Втрачений» на кожному синку.
  if (mainSt === 'Втрачений' && opSt === 'Втрачений') return null;
  if (opSt === 'Втрачений') {
    if (mainTs && opTs && new Date(mainTs).getTime() > new Date(opTs).getTime()) return null; // головна новіша
    return opSt;
  }
  if (mainSt === 'Втрачений') {
    // Операторська хоче зняти «Втрачений» — тільки якщо вона новіша
    if (mainTs && opTs && new Date(opTs).getTime() > new Date(mainTs).getTime()) return opSt;
    return null;
  }

  // Якщо є обидва timestamp — беремо новіший
  if (mainTs && opTs) {
    const mt = new Date(mainTs).getTime();
    const ot = new Date(opTs).getTime();
    if (ot > mt) return opSt;
    return null; // основна новіша — не міняти
  }

  // Якщо тільки в операторській є timestamp — довіряємо їй
  if (!mainTs && opTs) return opSt;

  // Обидва без timestamp — пріоритет критичних статусів
  if (!mainTs && !opTs) {
    const CRITICAL = ['Втрачений','Несправний','Ремонт'];
    if (CRITICAL.includes(opSt) && !CRITICAL.includes(mainSt)) return opSt;
  }

  return null; // не міняти
}

// ============================================================
// УПРАВЛІННЯ ДОСТУПОМ ТА ВИДИМІСТЮ АРКУШІВ
// ============================================================

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

function getAllowedEmails() {
  try {
    const sheet = getAccessSheet();
    const vals = sheet.getRange('B2:B100').getValues().flat()
      .map(String).filter(e => e.includes('@'));
    return vals;
  } catch(e) { return []; }
}

function setAllowedEmails(emails) {
  const sheet = getAccessSheet();
  sheet.getRange('B2:B100').clearContent();
  if (emails.length) {
    sheet.getRange(2, 2, emails.length, 1).setValues(emails.map(e => [e]));
  }
}

function getAdminEmails() {
  try {
    const sheet = getAccessSheet();
    const vals = sheet.getRange('A2:A100').getValues().flat()
      .map(String).filter(e => e.includes('@'));
    if (!vals.includes(ADMIN_EMAIL)) vals.unshift(ADMIN_EMAIL);
    return vals;
  } catch(e) { return [ADMIN_EMAIL]; }
}

function setAdminEmails(emails) {
  const sheet = getAccessSheet();
  sheet.getRange('A2:A100').clearContent();
  const filtered = emails.filter(e => e !== ADMIN_EMAIL);
  const all = [ADMIN_EMAIL, ...filtered];
  if (all.length) {
    sheet.getRange(2, 1, all.length, 1).setValues(all.map(e => [e]));
  }
}

function isAdmin(email) {
  return getAdminEmails().includes(email);
}

function isAllowed(email) {
  if (isAdmin(email)) return true;
  return getAllowedEmails().includes(email);
}

// Показати/сховати аркуші залежно від поточного користувача
function applySheetVisibility() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const email = apiUserEmail_() || '';

  // Визначаємо рівень доступу
  let level = 'none'; // невідомий
  if (email && isAdmin(email))   level = 'admin';
  else if (email && isAllowed(email)) level = 'allowed';

  const MINIMAL   = ['Журнал польоту', 'Дашборд'];
  // Джерело правди — константа зверху файлу, щоб список не доводилось
  // правити у двох місцях (раніше тут лежала його ручна копія).
  const HIDDEN_FOR_ALLOWED = SHEETS_ADMIN_ONLY;

  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();

    if (SHEETS_HIDDEN.includes(name)) {
      try { sheet.hideSheet(); } catch(e) {}
      return;
    }

    if (level === 'admin') {
      // Адмін бачить все
      try { sheet.showSheet(); } catch(e) {}
    } else if (level === 'allowed') {
      // Авторизований — все крім Журналу руху та Довідника назв
      if (HIDDEN_FOR_ALLOWED.includes(name)) {
        try { sheet.hideSheet(); } catch(e) {}
      } else {
        try { sheet.showSheet(); } catch(e) {}
      }
    } else {
      // Не авторизований — тільки Журнал польоту і Дашборд
      if (MINIMAL.includes(name)) {
        try { sheet.showSheet(); } catch(e) {}
      } else {
        try { sheet.hideSheet(); } catch(e) {}
      }
    }
  });

  Logger.log('Visibility applied: email=' + email + ' level=' + level);
}

// Sidebar для управління доступом
function openAccessForm() {
  const html = HtmlService.createHtmlOutputFromFile('AccessForm')
    .setTitle('👥 Управління доступом')
    .setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getAccessData() {
  return {
    adminEmail:    ADMIN_EMAIL,
    adminEmails:   getAdminEmails(),
    allowedEmails: getAllowedEmails(),
    currentUser:   apiUserEmail_() || '',
  };
}

function addAdminEmail(email) {
  if (!email || !email.includes('@')) throw new Error('Невірний email');
  if (email === ADMIN_EMAIL) throw new Error('Головний адмін вже є в списку');
  const list = getAdminEmails().filter(e => e !== ADMIN_EMAIL);
  if (!list.includes(email)) {
    list.push(email);
    setAdminEmails([...list, ADMIN_EMAIL]);
  }
  return getAdminEmails();
}

function removeAdminEmail(email) {
  if (email === ADMIN_EMAIL) throw new Error('Неможливо видалити головного адміна');
  setAdminEmails(getAdminEmails().filter(e => e !== email && e !== ADMIN_EMAIL));
  return getAdminEmails();
}

function addAllowedEmail(email) {
  if (!email || !email.includes('@')) throw new Error('Невірний email');
  const list = getAllowedEmails();
  if (!list.includes(email)) {
    list.push(email);
    setAllowedEmails(list);
  }
  return list;
}

function removeAllowedEmail(email) {
  const list = getAllowedEmails().filter(e => e !== email);
  setAllowedEmails(list);
  return list;
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  const userEmail = apiUserEmail_() || '';
  const userIsAdmin = isAdmin(userEmail);

  // Меню Польоти — для всіх
  ui.createMenu('✈️ Польоти')
    .addItem('🚀 Відкрити застосунок', 'openApp')
    .addItem('🌐 Веб-застосунок', 'openWebApp')
    .addSeparator()
    .addItem('✈️ Журнал польоту', 'openFlightLogForm')
    .addItem('📡 Sinotrack', 'openSinotrackForm')
    .addItem('📻 Частоти', 'openFrequencyForm')
    .addToUi();

  // Меню Інвентаризація — тільки для адмінів
  if (userIsAdmin) {
    ui.createMenu('🗂️ Інвентаризація')
    .addItem('➕ Додати предмет', 'openAddForm')
    .addItem('✏️ Змінити статус', 'openEditForm')
    .addItem('📤 Передача / видача', 'openMovementForm')
    .addItem('📥 Повернення', 'openReturnForm')
    .addItem('🗑️ Видалити виділені рядки', 'deleteSelectedRows')
    .addItem('🗑️ Видалити за ID', 'openDeleteForm')
    .addItem('🔗 Комплекти', 'openKitForm')

    .addSeparator()
    // ── Витратники ──
    .addSubMenu(ui.createMenu('🔧 Витратники')
      .addItem('➕ Додати витратник', 'openAddConsumableForm')
      .addItem('📊 Змінити стан', 'openConsumablesForm')
      .addItem('📉 Списати (кількісний)', 'openWriteOffConsumableForm')
      .addItem('🗑️ Видалити витратник', 'openDeleteConsumableForm'))
    .addSeparator()
    // ── Бекап на видному місці ──
    .addSubMenu(ui.createMenu('💾 Бекап')
      .addItem('💾 Зробити бекап', 'createBackup')
      .addItem('📋 Список бекапів', 'listBackups')
      .addItem('♻️ Відновити з JSON', 'restoreFromJson')
      .addItem('⚙️ Автобекап щодня', 'setupAutoBackup')
      .addItem('🗑️ Вимкнути автобекап', 'removeAutoBackup')
      .addItem('🔑 Авторизувати XLSX', 'authorizeUrlFetch'))
    .addSeparator()
    // ── Адміністрування ──
    .addSubMenu(ui.createMenu('⚙️ Адміністрування')
      .addItem('🔄 Оновити дашборд', 'refreshDashboard')
      .addItem('🕐 Виправити формат часу', 'fixFlightLogTimeFormat')
      .addItem('🔧 Виправити колонки журналу', 'fixFlightLogColumns')
      .addItem('🔁 Перестворити дашборд', 'recreateDashboard')
      .addItem('📊 Оновити міні-дашборди', 'rebuildMiniDashboards')
      .addItem('📋 Оновити довідник назв', 'rebuildNamesReference')
      .addItem('🔁 Перестворити Журнал руху', 'recreateMovementLog')
      .addSeparator()
      .addItem('🔄 Оновити структуру таблиць', 'reapplyInventoryStructure')
      .addItem('🔧 Відновити захист і списки', 'reapplyAll')
      .addItem('➕ Додати відсутні аркуші', 'addMissingSheets')
      .addItem('🧹 Очистити тригери', 'clearAllTriggers')
      .addItem('⚠️ Перебудувати систему', 'buildInventorySystemSafe')
      .addSeparator()
      .addItem('👥 Управління доступом', 'openAccessForm')
      .addSeparator()
      .addItem('🔄 Синхронізація таблиць', 'openSyncForm')
      .addItem('🔧 Перестворити журнал у операторів', 'rebuildOperatorFlightLog')
      .addItem('🔒 Захистити Sinotrack та SIM-карти', 'protectSinotrackSheets'))
    .addToUi();
  } // end if userIsAdmin
}

// ============================================================
// SIDEBAR — відкриває HTML-файл з проекту
// ============================================================
function openAddForm() {
  const html = HtmlService.createHtmlOutputFromFile('AddForm')
    .setTitle('➕ Новий предмет')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openEditForm() {
  const html = HtmlService.createHtmlOutputFromFile('EditForm')
    .setTitle('✏️ Змінити статус')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

// ============================================================
// ДАНІ ДЛЯ ФОРМ — викликаються з HTML через google.script.run
// ============================================================
// Отримати email поточного користувача для sidebar
function getCurrentUserEmail() {
  return apiUserEmail_() || '';
}

function getAdminEmail() {
  return ADMIN_EMAIL;
}

function getFormData() {
  return {
    types:       TYPE_LIST,
    assignments: ASSIGNMENT_LIST,
    statuses:    STATUS_LIST,
    today:       Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
  };
}

// ============================================================
// ДОДАТИ ПРЕДМЕТ — викликається з AddForm.html
// ============================================================
function addItemFromForm(d) {
  return withScriptLock(function() { return addItemCore(d); });
}

// Ядро додавання предмета — викликати тільки під локом (addItemFromForm/addItemsFromForm)
function addItemCore(d) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Інвентар');

  const code    = typeCode(d.type);
  const dateStr = (d.date || '').replace(/-/g, '') ||
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');

  // Знайти наступний порядковий номер по цьому типу (4 цифри, по типу окремо)
  let max = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    sheet.getRange(3, COLS.ID, lastRow - 2, 1).getValues().flat().forEach(id => {
      if (String(id).startsWith(code + '-')) {
        // ID формат: TYPE-NNNN-YYYYMMDD або TYPE-NNNN
        const parts = String(id).split('-');
        const n = parseInt(parts[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
  }
  const seqNum = String(max + 1).padStart(4, '0');

  // Повний ID в таблиці: TYPE-NNNN-YYYYMMDD (для архіву і пошуку)
  const newId = code + '-' + seqNum + '-' + dateStr;

  // Короткий ID для наклейки: TYPE-NNNN (відображається окремо у формі)
  const shortId = code + '-' + seqNum;

  const dateFormatted = d.date ||
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const newRow = [newId, d.name, d.type, d.assignment, d.status,
    d.responsible || '', dateFormatted, '', d.note || ''];
  sheet.appendRow(newRow);

  const insertedRow = sheet.getLastRow();
  sheet.getRange(insertedRow, 1, 1, 8)
    .setBackground(insertedRow % 2 === 0 ? COLORS.altRow : COLORS.white);

  // Журнал
  const logSheet = getSheet(ss, 'Журнал руху');
  if (logSheet) {
    logSheet.appendRow([dateFormatted, newId, d.name, 'Надходження',
      '—', d.assignment, apiUserEmail_() || '—', '', 'Форма']);
  }

  // Якщо назва нова — зберегти в довідник
  addNameToReference(code, d.name);

  // Повертаємо і повний ID (для таблиці) і короткий (для наклейки)
  return { fullId: newId, shortId: shortId, name: d.name };
}

// ============================================================
// ОТРИМАТИ ІНФО ПРО ПРЕДМЕТ — для EditForm
// ============================================================
function getItemInfoById(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Інвентар');
  const last  = sheet.getLastRow();
  if (last < 3) return null;
  const rows = sheet.getRange(3, 1, last - 2, 8).getValues();
  const r    = rows.find(row => String(row[0]) === String(id));
  if (!r) return null;
  return { name: r[1], type: r[2], assignment: r[3], status: r[4], responsible: r[5] };
}

// ============================================================
// ОНОВИТИ СТАТУС — викликається з EditForm.html
// ============================================================
function updateItemStatusById(d) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Інвентар') || ss.getSheetByName('Інвентар');
  const last  = sheet.getLastRow();
  const ids   = sheet.getRange(3, COLS.ID, last - 2, 1).getValues().flat().map(String);
  const idx   = ids.indexOf(String(d.id));
  if (idx === -1) throw new Error('ID не знайдено: ' + d.id);
  const row = idx + 3;

  const oldStatus = String(sheet.getRange(row, COLS.STATUS).getValue());
  const name      = String(sheet.getRange(row, COLS.NAME).getValue());
  const today     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const user      = apiUserEmail_() || '—';
  const log       = getSheet(ss, 'Журнал руху');

  setItemStatus(sheet, row, d.status);
  if (d.responsible !== undefined) sheet.getRange(row, COLS.RESPONSIBLE).setValue(d.responsible);
  if (d.status === 'Списаний') sheet.getRange(row, COLS.RESPONSIBLE).setValue('');

  // Коментар до клітинки статусу
  const statusCell = sheet.getRange(row, COLS.STATUS);
  const existingComment = statusCell.getComment() || '';

  if (d.cellComment) {
    // Новий коментар (при встановленні Втрачений)
    statusCell.setComment(d.cellComment);
    // Зберегти деталі втрати в Журнал руху
    if (d.status === 'Втрачений' && log) {
      log.appendRow([today, d.id, name, 'Втрата', oldStatus, 'Втрачений',
        user, '', d.cellComment]);
    }
  } else if (d.status !== 'Втрачений' && existingComment.includes('ВТРАЧЕНО')) {
    // Борт знайдений — зберегти архів в журнал і очистити коментар
    if (log) {
      log.appendRow([today, d.id, name, 'Знайдено', 'Втрачений', d.status,
        user, '', 'Архів втрати: ' + existingComment.replace(/\n/g, ' | ')]);
    }
    statusCell.clearComment();
  }

  // Нотатка на клітинку Статус — коментар до зміни (накопичується)
  if (d.comment && d.comment.trim()) {
    const prev = sheet.getRange(row, COLS.STATUS).getNote() || '';
    const note = today + ' [' + oldStatus + '→' + d.status + ']: ' + d.comment.trim() +
      (prev ? '\n─────\n' + prev : '');
    sheet.getRange(row, COLS.STATUS).setNote(note);
  }

  // Втрачений — деталі як нотатка на клітинку ID
  if (d.status === 'Втрачений') {
    const ld = d.lostData || {};
    let note = '⚠️ ВТРАЧЕНО ' + today + '\n';
    if (ld.coords)     note += '📍 ' + ld.coords + '\n';
    if (ld.mapsLink)   note += '🗺️ ' + ld.mapsLink + '\n';
    if (ld.conditions) note += '📋 ' + ld.conditions + '\n';
    note += '👤 ' + user;
    sheet.getRange(row, COLS.ID).setNote(note);
  }

  // Якщо борт Втрачений — каскадно позначити прив'язаний Sinotrack і SIM
  if (d.status === 'Втрачений' && oldStatus !== 'Втрачений') {
    const sntSheet = getSheet(ss, 'Sinotrack');
    if (sntSheet && sntSheet.getLastRow() >= 3) {
      const sntData = sntSheet.getRange(3, 1, sntSheet.getLastRow() - 2, 8).getValues();
      sntData.forEach((r, i) => {
        // Перевіряємо прив'язку до борту (col 6) або збіг в колонці Борт
        if (String(r[5]).trim() === d.id || String(r[5]).trim() === name) {
          sntSheet.getRange(3 + i, 3).setValue('Втрачений');
          // Каскадно на SIM
          const simNum = String(r[4]).trim();
          if (simNum) {
            const simSheet = getSheet(ss, 'SIM-карти');
            if (simSheet && simSheet.getLastRow() >= 3) {
              const simData = simSheet.getRange(3, 1, simSheet.getLastRow() - 2, 4).getValues();
              simData.forEach((sr, si) => {
                if (String(sr[2]).trim() === simNum) {
                  simSheet.getRange(3 + si, 4).setValue('Втрачена');
                }
              });
            }
          }
        }
      });
    }
  }

  // Знайдений після втрати — архів нотатки, очистити попередню
  if (oldStatus === 'Втрачений' && d.status !== 'Втрачений') {
    const lostNote = sheet.getRange(row, COLS.ID).getNote() || '';
    if (lostNote) {
      const prev = sheet.getRange(row, COLS.STATUS).getNote() || '';
      sheet.getRange(row, COLS.STATUS).setNote(
        '✅ ЗНАЙДЕНО ' + today + '\n─────\n' + lostNote +
        (prev ? '\n─────\n' + prev : '')
      );
      sheet.getRange(row, COLS.ID).clearNote();
    }
  }

  if (log) log.appendRow([today, d.id, name, 'Зміна статусу', oldStatus, d.status,
    user, d.responsible || '', d.comment || '']);

  return '"' + name + '": ' + oldStatus + ' → ' + d.status;
}


// ============================================================
// ТРИГЕР onEdit
// ============================================================
function onEdit(e) {
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  // Ручне редагування приміток → мітка часу, щоб синхронізація не губила примітки
  if (sheetName === 'Sinotrack' && e.range.getRow() >= 3 && e.range.getColumn() === 8) {
    touchSinotrackNote(sheet, e.range.getRow());
    return;
  }
  if (sheetName === 'Журнал польоту' && e.range.getRow() >= 3 && e.range.getColumn() === 13) {
    touchFlightNote(sheet, e.range.getRow());
    return;
  }

  if (sheetName !== 'Інвентар') return;

  const row      = e.range.getRow();
  const col      = e.range.getColumn();
  const newVal   = e.range.getValue();
  const oldVal   = e.oldValue || '—';

  if (row < 3) return;

  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const log = getSheet(ss, 'Журнал руху');
  const id  = sheet.getRange(row, COLS.ID).getValue();
  const name = sheet.getRange(row, COLS.NAME).getValue();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const user  = apiUserEmail_() || '—';

  // Зміна СТАТУСУ (col E = 5)
  if (col === COLS.STATUS) {
    // Очищаємо пробіли щоб COUNTIF знаходив правильно
    const trimmedVal = String(newVal).trim();
    if (trimmedVal !== newVal) {
      setItemStatus(sheet, row, trimmedVal);
    }
    if (trimmedVal === 'Списаний') {
      sheet.getRange(row, COLS.RESPONSIBLE).setValue('');
    }
    if (log && id) {
      log.appendRow([today, id, name, 'Зміна статусу', oldVal, newVal, user, '', 'Зі списку в таблиці']);
    }
    ss.toast('"' + name + '": статус → ' + newVal, '✅ Зафіксовано', 3);
  }

  // Зміна ЗАКРІПЛЕННЯ (col D = 4) — запобіжник
  if (col === COLS.ASSIGNMENT) {
    if (log && id) {
      log.appendRow([today, id, name, 'Зміна закріплення', oldVal, newVal, user, '', 'Зі списку в таблиці']);
    }
    ss.toast('"' + name + '": закріплення змінено ' + oldVal + ' → ' + newVal, '⚠️ Зафіксовано', 4);
  }

  // Зміна ВІДПОВІДАЛЬНОГО (col F = 6)
  if (col === COLS.RESPONSIBLE && id) {
    if (log && newVal && newVal !== oldVal) {
      log.appendRow([today, id, name, 'Зміна відповідального', oldVal || '—', newVal, user, newVal, 'Зі списку в таблиці']);
    }
  }
}

// ============================================================
// ПЕРЕДАЧА / ПОВЕРНЕННЯ
// ============================================================
function openMovementForm() {
  const html = HtmlService.createHtmlOutputFromFile('MovementForm')
    .setTitle('📤 Передача / видача')
    .setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openReturnForm() {
  const html = HtmlService.createHtmlOutputFromFile('ReturnForm')
    .setTitle('📥 Повернення')
    .setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Унікальні відповідальні для autocomplete
function getResponsibleList() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) return [];
  return [...new Set(
    inv.getRange(3, COLS.RESPONSIBLE, inv.getLastRow() - 2, 1)
      .getValues().flat()
      .map(String)
      .filter(v => v.trim() !== '')
  )].sort();
}

// Отримати назви для конкретного типу з довідника
function getNamesByType(typeCode) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Довідник назв');
  if (!sheet || sheet.getLastRow() < 3) return [];
  return sheet.getRange(3, 1, sheet.getLastRow() - 2, 2).getValues()
    .filter(row => String(row[0]).trim() === typeCode && String(row[1]).trim() !== '')
    .map(row => String(row[1]).trim());
}

// Додати нову назву в довідник
function addNameToReference(typeCode, name) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Довідник назв');
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    const existing = sheet.getRange(3, 1, lastRow - 2, 2).getValues();
    if (existing.some(row => String(row[0]).trim() === typeCode && String(row[1]).trim() === name.trim())) return;
  }
  sheet.appendRow([typeCode, name, '']);
}

// Наступний порядковий номер для типу (для preview в формі)
function getNextIdNum(code) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) return 1;
  let max = 0;
  inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().forEach(id => {
    if (String(id).startsWith(code + '-')) {
      const n = parseInt(String(id).split('-')[1], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return max + 1;
}

// Унікальні назви для автодоповнення в полі Назва
function getNameSuggestions() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) return [];
  const names = inv.getRange(3, COLS.NAME, inv.getLastRow() - 2, 1).getValues().flat()
    .map(String).filter(n => n.trim() !== '');
  // Унікальні, відсортовані
  return [...new Set(names)].sort();
}

// Додати кілька предметів одразу (qty штук)
function addItemsFromForm(d) {
  return withScriptLock(function() {
    const qty = Math.min(20, Math.max(1, parseInt(d.qty, 10) || 1));
    const results = [];
    for (let i = 0; i < qty; i++) {
      results.push(addItemCore(d));
    }
    return results;
  });
}

// ============================================================
// КОМПЛЕКТИ
// ============================================================
function openKitForm() {
  const html = HtmlService.createHtmlOutputFromFile('KitForm')
    .setTitle('🔗 Комплекти')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Отримати всі комплекти (унікальні значення колонки Комплект)
function getKitList() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) return [];
  const data = inv.getRange(3, 1, inv.getLastRow() - 2, COLS.KIT).getValues();
  const kits = new Set();
  data.forEach(row => {
    const kit = String(row[COLS.KIT - 1] || '').trim();
    if (kit) kits.add(kit);
  });
  return [...kits].sort();
}

// Отримати всі предмети комплекту
function getKitMembers(kitId) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) return [];
  return inv.getRange(3, 1, inv.getLastRow() - 2, COLS.KIT).getValues()
    .filter(row => String(row[COLS.KIT - 1] || '').trim() === kitId)
    .map(row => ({
      id:         String(row[0]),
      name:       String(row[1]),
      type:       String(row[2]),
      assignment: String(row[3]),
      status:     String(row[4]),
    }));
}

// Призначити предмет до комплекту
function assignToKit(itemId, kitId) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv) throw new Error('Інвентар не знайдено');
  const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(itemId);
  if (idx === -1) throw new Error('ID не знайдено: ' + itemId);
  const row = idx + 3;
  inv.getRange(row, COLS.KIT).setValue(kitId);
  // Оновити коментар на клітинці KIT
  updateKitComment(inv, kitId);
  return { id: itemId, kit: kitId };
}

// Видалити предмет з комплекту
function removeFromKit(itemId) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv) throw new Error('Інвентар не знайдено');
  const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(itemId);
  if (idx === -1) throw new Error('ID не знайдено: ' + itemId);
  const row = idx + 3;
  const kitId = String(inv.getRange(row, COLS.KIT).getValue()).trim();
  inv.getRange(row, COLS.KIT).clearContent().clearComment();
  if (kitId) updateKitComment(inv, kitId);
  return { id: itemId };
}

// Оновити коментар на всіх клітинках комплекту
function updateKitComment(inv, kitId) {
  if (!inv || !kitId) return;
  const lastRow = inv.getLastRow();
  if (lastRow < 3) return;
  const data = inv.getRange(3, 1, lastRow - 2, COLS.KIT).getValues();
  // Зібрати всіх членів
  const members = data
    .filter(row => String(row[COLS.KIT - 1] || '').trim() === kitId)
    .map(row => String(row[0]) + ' — ' + String(row[1]));
  const comment = members.length > 0
    ? '🔗 Комплект: ' + kitId + '\n' + members.join('\n')
    : '';
  // Записати коментар на кожну клітинку KIT
  data.forEach((row, i) => {
    if (String(row[COLS.KIT - 1] || '').trim() === kitId) {
      const cell = inv.getRange(3 + i, COLS.KIT);
      if (comment) cell.setComment(comment);
      else cell.clearComment();
    }
  });
}

// Список предметів для форм
function getInventoryList() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) return [];
  return inv.getRange(3, 1, inv.getLastRow() - 2, 12).getDisplayValues()
    .filter(row => String(row[0]).trim() !== '')
    .map(row => ({
      id:          String(row[0]),
      name:        String(row[1]),
      type:        String(row[2]),
      assignment:  String(row[3]),
      status:      String(row[4]),
      responsible: String(row[5]),
      date:        String(row[COLS.DATE - 1] || ''),
      kit:         String(row[COLS.KIT - 1] || ''),
      note:        String(row[COLS.NOTE - 1] || ''),
      accepted:    String(row[10] || ''),  // col 11 — Прийнято / Не прийнято / ''
      acceptReason: String(row[11] || ''), // col 12 — Причина неприйняття
    }));
}

// Права поточного користувача на сторінці Інвентар веб-застосунку
function getInventoryCaps() {
  const email = apiUserEmail_() || '';
  let admin = false;
  try { admin = isAdmin(email); } catch(e) { admin = !!email && email === ADMIN_EMAIL; }
  return { mode: 'full', admin: admin, email: email, statuses: STATUS_LIST };
}

// Прийняти / не прийняти обладнання. Головний відповідальний екіпажу (за токеном)
// або адмін (за Google-акаунтом). accepted: true/false, reason — причина відмови.
function acceptItem(token, itemId, accepted, reason) {
  let allowed = false;
  if (token) {
    const p = authSession(token);
    if (!p) throw new Error('Сесія завершилась — увійди знову');
    const crew = findPersonCrew(p.id);
    if (crew && crew.isMain) allowed = true;
    else throw new Error('Приймати обладнання може тільки головний відповідальний екіпажу');
  } else {
    const email = apiUserEmail_() || '';
    if (isAdmin(email)) allowed = true;
    else throw new Error('Потрібен вхід відповідальної особи');
  }
  if (!allowed) throw new Error('Недостатньо прав');
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) throw new Error('Інвентар не знайдено');
  const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(String(itemId));
  if (idx === -1) throw new Error('ID не знайдено: ' + itemId);
  const row = idx + 3;
  inv.getRange(row, 11).setValue(accepted ? 'Прийнято' : 'Не прийнято');
  inv.getRange(row, 12).setValue(accepted ? '' : String(reason || ''));
  inv.getRange(row, 13).setValue(nowTS());
  return { id: itemId, accepted: !!accepted };
}

// Видалити предмет з обліку через веб-застосунок — тільки адмін
// Видалення з обліку прибрано з PWA (тільки списання через статус) —
// функція лишається для sidebar-форм таблиці, у whitelist API її немає.
function webDeleteInventoryItem(id, reason) {
  const email = apiUserEmail_() || '';
  if (!isAdmin(email)) throw new Error('Видаляти предмети може тільки адміністратор');
  return deleteItemsByIds([id], reason || 'Видалено через веб-застосунок');
}

// Створити предмети інвентаря з веб-застосунку (адмін або право «Інвентар»).
// qty 1–20 — як у sidebar-формі AddForm. Повертає масив {fullId, shortId, name}
// для показу наклейок.
function webAddInventoryItem(d) {
  const email = apiUserEmail_() || '';
  if (!isAdmin(email) && !apiRight_('inv')) throw new Error('Потрібне право «Інвентар» або права адміністратора');
  if (!d || !String(d.name || '').trim()) throw new Error('Вкажи назву предмета');
  if (!d.type) throw new Error('Вкажи тип предмета');
  return addItemsFromForm({
    name: String(d.name).trim(),
    type: d.type,
    assignment: d.assignment || 'Інше',
    status: d.status || 'Робочий',
    responsible: String(d.responsible || '').trim(),
    note: String(d.note || '').trim(),
    qty: d.qty || 1,
  });
}

// Змінити закріплення предмета (тільки адмін), із записом у Журнал руху
function webSetItemAssignment(id, assignment) {
  const email = apiUserEmail_() || '';
  if (!isAdmin(email) && !apiRight_('inv')) throw new Error('Потрібне право «Інвентар» або права адміністратора');
  if (ASSIGNMENT_LIST.indexOf(assignment) === -1) throw new Error('Невідоме закріплення: ' + assignment);
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv) throw new Error('Інвентар не знайдено');
  const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(String(id));
  if (idx === -1) throw new Error('ID не знайдено: ' + id);
  const row = idx + 3;
  const old = String(inv.getRange(row, COLS.ASSIGNMENT).getValue());
  if (old === assignment) return { id: id, assignment: assignment };
  inv.getRange(row, COLS.ASSIGNMENT).setValue(assignment);
  const log = getSheet(ss, 'Журнал руху');
  if (log) {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const name = String(inv.getRange(row, COLS.NAME).getValue());
    log.appendRow([today, id, name, 'Зміна закріплення', old || '—', assignment, email || '—', '', 'Веб-застосунок']);
  }
  return { id: id, assignment: assignment };
}

// ── Примітки з веб-застосунку (адмін, право «Інвентар» або головний екіпажу) ──
function webNoteGuard_(token) {
  const email = apiUserEmail_() || '';
  if (isAdmin(email)) return;
  if (apiRight_('inv')) return;
  if (token) {
    const p = authSession(token);
    if (p) {
      const crew = findPersonCrew(p.id);
      if (crew && crew.isMain) return;
    }
  }
  throw new Error('Немає прав змінювати примітку');
}

function webSetItemNote(id, note, token) {
  webNoteGuard_(token);
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  if (!inv) throw new Error('Інвентар не знайдено');
  const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
  const i = ids.indexOf(String(id));
  if (i === -1) throw new Error('ID не знайдено: ' + id);
  inv.getRange(i + 3, COLS.NOTE).setValue(String(note || ''));
  return { id: id, note: String(note || '') };
}

function webSetTrackerNote(id, note, token) {
  webNoteGuard_(token);
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const snt = getSheet(ss, 'Sinotrack');
  if (!snt || snt.getLastRow() < 3) throw new Error('Аркуш Sinotrack не знайдено');
  const rows = snt.getRange(3, 1, snt.getLastRow() - 2, 8).getValues();
  let idx = rows.findIndex(r => String(r[0]).trim() === String(id));
  if (idx === -1) idx = rows.findIndex(r => String(r[6]).trim() === String(id)); // за IMEI
  if (idx === -1) throw new Error('Трекер не знайдено: ' + id);
  const row = idx + 3;
  snt.getRange(row, 8).setValue(String(note || ''));
  touchSinotrack(snt, row);
  return { id: id, note: String(note || '') };
}

// Уточнення причини зміни статусу (після факту) → Журнал руху.
// kind: 'item' | 'trk' | 'sim'. Для інвентаря коментар дублюється
// нотаткою на клітинку статусу (як робить updateItemStatusById).
function webLogStatusChange(kind, id, fromSt, toSt, comment) {
  comment = String(comment || '').trim();
  if (!comment) throw new Error('Порожній коментар');
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const log = getSheet(ss, 'Журнал руху');
  if (!log) throw new Error('Журнал руху не знайдено');
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const email = apiUserEmail_() || '—';
  let name = '';
  if (kind === 'trk') {
    const snt = getSheet(ss, 'Sinotrack');
    if (snt && snt.getLastRow() >= 3) {
      const r = snt.getRange(3, 1, snt.getLastRow() - 2, 8).getValues()
        .find(x => String(x[0]).trim() === String(id) || String(x[6]).trim() === String(id));
      if (r) name = String(r[1] || '');
    }
  } else if (kind === 'sim') {
    const sim = getSheet(ss, 'SIM-карти');
    if (sim && sim.getLastRow() >= 3) {
      const r = sim.getRange(3, 1, sim.getLastRow() - 2, 3).getValues()
        .find(x => String(x[0]).trim() === String(id));
      if (r) name = String(r[1] || '');
    }
  } else {
    const inv = getSheet(ss, 'Інвентар');
    if (inv && inv.getLastRow() >= 3) {
      const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
      const i = ids.indexOf(String(id));
      if (i !== -1) {
        const row = i + 3;
        name = String(inv.getRange(row, COLS.NAME).getValue());
        const prev = inv.getRange(row, COLS.STATUS).getNote() || '';
        const note = today + ' [' + fromSt + '→' + toSt + ']: ' + comment + (prev ? '\n─────\n' + prev : '');
        inv.getRange(row, COLS.STATUS).setNote(note);
      }
    }
  }
  log.appendRow([today, id, name, 'Зміна статусу', fromSt || '—', toSt || '—', email, '', comment]);
  return { ok: true };
}

// ── Карта втрат: втрачені борти й трекери з координатами з нотаток ──
// Координати беруться з деталей втрати (📍 у нотатці на клітинці ID
// інвентаря / у примітці трекера). Повертає і записи без координат —
// вони показуються списком під картою.
// Розбір нотатки втрати: дата, координати (у тексті або в URL Google Maps),
// посилання, обставини, імовірний борт (для трекерів)
function parseLossNote_(text) {
  text = String(text || '');
  const dateM = text.match(/ВТРАЧЕНО\s+(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i);
  let date = dateM ? dateM[1] : '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(date)) date = date.split('.').reverse().join('-');

  // Посилання: у нотатках таблиці URL часто розірваний переносом рядка
  // (".../maps?\nq=+50.6,+30.6") — склеюємо переноси всередині URL
  let link = '';
  const lm = text.match(/https?:\/\/[^\s]+(?:\s*\n\s*[^\s]+)*/);
  if (lm) {
    const cut = lm[0].replace(/\s*\n\s*/g, '');
    // обрізаємо хвіст, що явно не URL (кирилиця/емодзі після пробілу)
    link = (cut.match(/https?:\/\/[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+/) || [''])[0];
  }

  // Координати: 1) явні lat lng у тексті — через кому, крапку з комою АБО
  // просто пробіл («GPS: 48.1234 37.5678»), з опційним «+»; 2) з URL
  // (?q=lat,lng / @lat,lng / ll= / query=)
  const coordReStrict = /\+?(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*\+?(-?\d{1,3}\.\d{3,})/;
  const noUrl = text.replace(/https?:\/\/[^\s]+/g, ' ');
  let m = noUrl.match(coordReStrict);
  if (!m && link) m = decodeURIComponent(link.replace(/\+/g, ' ')).match(coordReStrict);
  if (!m) m = text.replace(/\n/g, ' ').match(coordReStrict); // останній шанс — весь текст
  // Захист від хибного збігу з датою («2026.05 25.06» тощо): lat 44–53, lng 22–41 — Україна
  if (m) {
    const la = Number(m[1]), lo = Number(m[2]);
    if (!(la >= 44 && la <= 53 && lo >= 22 && lo <= 41)) {
      // спробувати знайти інший збіг далі в тексті
      const all = [];
      const g = new RegExp(coordReStrict.source, 'g');
      let mm; while ((mm = g.exec(text.replace(/\n/g, ' '))) !== null) all.push(mm);
      m = all.find(x => { const a = Number(x[1]), b = Number(x[2]); return a >= 44 && a <= 53 && b >= 22 && b <= 41; }) || null;
    }
  }

  // Обставини: «📋 ...», «Умови: ...», «Обставини: ...» — до кінця рядка
  const cm = text.match(/(?:📋|Умови|Обставини)\s*:?\s*([^\n]+)/i);
  const cond = cm ? cm[1].replace(/^(?:Умови|Обставини)\s*:?\s*/i, '').trim() : '';

  // Імовірний борт: «імовірно борт: X», «борт X», ID виду STNG-0099(-дата)
  const probable = (text.match(/(?:борт|імовірно)\s*:?\s*([A-ZА-Я]{2,5}-\d{3,4}(?:-\d{8})?)/i) || ['', ''])[1];

  // Згаданий трекер у нотатці борта: «ID:7000000000» / «(ID: 7000…)»
  const trk = (text.match(/ID\s*:?\s*(\d{9,12})/i) || ['', ''])[1];

  return {
    date: date, lat: m ? Number(m[1]) : null, lng: m ? Number(m[2]) : null,
    link: link, conditions: cond, probableDrone: probable, trackerRef: trk
  };
}

// ── Карта втрат: втрачені борти й трекери з координатами з нотаток ──
function getLostMapData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const out = [];
  const inv = getSheet(ss, 'Інвентар');
  if (inv && inv.getLastRow() >= 3) {
    const rows = inv.getRange(3, 1, inv.getLastRow() - 2, COLS.STATUS).getValues();
    rows.forEach(function(r, i) {
      if (String(r[COLS.STATUS - 1]).trim() !== 'Втрачений') return;
      // Деталі втрати могли писатись у РІЗНІ місця різними версіями sidebar:
      // нотатка на ID, нотатка на Статусі, коментар на Статусі, нотатка на
      // Примітці, сама Примітка. Беремо всі непорожні й склеюємо.
      const rowN = 3 + i;
      const parts = [
        inv.getRange(rowN, COLS.ID).getNote(),
        inv.getRange(rowN, COLS.STATUS).getNote(),
        inv.getRange(rowN, COLS.STATUS).getComment(),
        inv.getRange(rowN, COLS.NOTE).getNote(),
        String(inv.getRange(rowN, COLS.NOTE).getValue() || '')
      ].map(function(s){ return String(s || '').trim(); }).filter(Boolean);
      const note = parts.join('\n');
      const p = parseLossNote_(note);
      out.push({ kind: 'drone', id: String(r[0]), name: String(r[COLS.NAME - 1] || ''),
        date: p.date, lat: p.lat, lng: p.lng, link: p.link, conditions: p.conditions,
        trackerRef: p.trackerRef, note: note, _v: 3 });
    });
  }
  const snt = getSheet(ss, 'Sinotrack');
  if (snt && snt.getLastRow() >= 3) {
    snt.getRange(3, 1, snt.getLastRow() - 2, 8).getValues().forEach(function(r) {
      if (String(r[2]).trim() !== 'Втрачений') return;
      const note = String(r[7] || '');
      const p = parseLossNote_(note);
      out.push({ kind: 'tracker', id: String(r[0]), name: String(r[1] || ''),
        imei: String(r[6] || ''), binding: String(r[5] || ''),
        date: p.date, lat: p.lat, lng: p.lng, link: p.link, conditions: p.conditions,
        probableDrone: p.probableDrone, note: note });
    });
  }
  return out;
}

// ДІАГНОСТИКА (запусти з редактора → Журнал виконання): що парсер бачить
// у кожного втраченого борта і чому запис без координат
function diagLossNotes() {
  const data = getLostMapData().filter(x => x.kind === 'drone');
  Logger.log('Втрачених бортів: %s, з координатами: %s', data.length, data.filter(x => x.lat && x.lng).length);
  data.forEach(x => {
    Logger.log('%s | date=%s | %s,%s | link=%s | raw=%s', x.id, x.date || '—',
      x.lat, x.lng, (x.link || '—').slice(0, 60), JSON.stringify((x.note || '').slice(0, 160)));
  });
}

// Редагувати запис втрати (адмін або головний екіпажу): перезаписує нотатку
// втрати у стандартному форматі. d = {kind, id, date, coords, link, conditions,
// probableDrone?}. Не змінює статус — лише деталі. Пише в Журнал руху.
function webUpdateLossRecord(d, token) {
  webNoteGuard_(token);
  if (!d || !d.id) throw new Error('Немає ID');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const date = String(d.date || '').trim() || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  let note = '⚠️ ВТРАЧЕНО ' + date;
  if (d.coords)     note += '\n📍 ' + String(d.coords).trim();
  if (d.link)       note += '\n🗺️ ' + String(d.link).trim();
  if (d.conditions) note += '\n📋 ' + String(d.conditions).trim();
  if (d.kind === 'tracker' && d.probableDrone) note += '\n🛸 імовірно борт: ' + String(d.probableDrone).trim();
  note += '\n👤 ' + (apiUserEmail_() || '—');

  const log = getSheet(ss, 'Журнал руху');
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (d.kind === 'tracker') {
    const snt = getSheet(ss, 'Sinotrack');
    if (!snt || snt.getLastRow() < 3) throw new Error('Аркуш Sinotrack не знайдено');
    const rows = snt.getRange(3, 1, snt.getLastRow() - 2, 8).getValues();
    let idx = rows.findIndex(r => String(r[0]).trim() === String(d.id));
    if (idx === -1) idx = rows.findIndex(r => String(r[6]).trim() === String(d.id));
    if (idx === -1) throw new Error('Трекер не знайдено: ' + d.id);
    const row = idx + 3;
    snt.getRange(row, 8).setValue(note);
    touchSinotrack(snt, row);
    if (log) log.appendRow([today, d.id, String(rows[idx][1] || ''), 'Деталі втрати', '', '', apiUserEmail_() || '—', '', note.replace(/\n/g, ' | ')]);
  } else {
    const inv = getSheet(ss, 'Інвентар');
    if (!inv) throw new Error('Інвентар не знайдено');
    const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
    const i = ids.indexOf(String(d.id));
    if (i === -1) throw new Error('ID не знайдено: ' + d.id);
    const row = i + 3;
    inv.getRange(row, COLS.ID).setNote(note);
    if (log) log.appendRow([today, d.id, String(inv.getRange(row, COLS.NAME).getValue()), 'Деталі втрати', '', '', apiUserEmail_() || '—', '', note.replace(/\n/g, ' | ')]);
  }
  return { ok: true, note: note };
}

// ── Витратники з веб-застосунку (редагування — тільки адмін) ──
function webConsGuard_() {
  const email = apiUserEmail_() || '';
  if (!isAdmin(email) && !apiRight_('inv')) throw new Error('Потрібне право «Інвентар» або права адміністратора');
}
function webUpdateConsumable(data) { webConsGuard_(); return updateConsumable(data); }
function webAddConsumable(data) { webConsGuard_(); return addConsumableFromForm(data); }
function webWriteOffConsumable(data) { webConsGuard_(); return writeOffConsumableById(data); }
function webDeleteConsumable(id, reason) { webConsGuard_(); return deleteConsumableById(id, reason); }

// Виконати передачу
function executeMovement(data) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  const log = getSheet(ss, 'Журнал руху');
  if (!inv) throw new Error('Інвентар не знайдено');
  const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(data.id);
  if (idx === -1) throw new Error('ID не знайдено: ' + data.id);
  const row     = idx + 3;
  const name    = inv.getRange(row, COLS.NAME).getValue();
  const oldResp = inv.getRange(row, COLS.RESPONSIBLE).getValue();
  const today   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  // Відповідальний
  const respValue = data.responsible || data.to;
  inv.getRange(row, COLS.RESPONSIBLE).setValue(respValue);

  // Закріплення — оновлюємо якщо передаємо підрозділу
  const assignList = ['Школа','На виїзд','Sting','Симулятор','Інше','Майстерня','Літак'];
  if (assignList.includes(data.to)) {
    inv.getRange(row, COLS.ASSIGNMENT).setValue(data.to);
  }

  if (data.status) setItemStatus(inv, row, data.status);
  if (log) log.appendRow([today, data.id, name, 'Передача', oldResp || '—', data.to,
    apiUserEmail_() || '—', data.to, data.comment || '']);
  return { id: data.id, name, from: oldResp || '—', to: data.to };
}

// Виконати повернення
function executeReturn(data) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  const log = getSheet(ss, 'Журнал руху');
  if (!inv) throw new Error('Інвентар не знайдено');
  const ids = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(data.id);
  if (idx === -1) throw new Error('ID не знайдено: ' + data.id);
  const row     = idx + 3;
  const name    = inv.getRange(row, COLS.NAME).getValue();
  const oldResp = inv.getRange(row, COLS.RESPONSIBLE).getValue();
  const today   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  setItemStatus(inv, row, data.status || 'На перевірці');
  inv.getRange(row, COLS.RESPONSIBLE).setValue('');
  if (log) log.appendRow([today, data.id, name, 'Повернення', oldResp || '—', '—',
    oldResp || '—', apiUserEmail_() || '—', 'Статус: ' + (data.status || 'На перевірці')]);
  return { id: data.id, name, from: oldResp || '—', status: data.status };
}


// ============================================================
// SIDEBAR — ВИТРАТНИКИ
// ============================================================
function openConsumablesForm() {
  const html = HtmlService.createHtmlOutputFromFile('ConsumablesForm')
    .setTitle('🔧 Витратники — стан')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openAddConsumableForm() {
  const html = HtmlService.createHtmlOutputFromFile('AddConsumableForm')
    .setTitle('➕ Новий витратник')
    .setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Список витратників для форми
function getConsumablesList() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Витратники');
  if (!sheet || sheet.getLastRow() < 3) return [];
  return sheet.getRange(3, 1, sheet.getLastRow() - 2, 9).getValues()
    .filter(row => String(row[0]).trim() !== '')
    .map(row => ({
      id:          String(row[0]),
      name:        String(row[1]),
      category:    String(row[2]),
      compat:      String(row[3]),
      trackType:   String(row[4]),  // Кількісний / Статусний
      qty:         row[5],
      minQty:      row[6],
      status:      String(row[7]),
      note:        String(row[8]),
    }));
}

// Отримати типи для сумісності (префікси + Універсальне)
function getCompatOptions() {
  return TYPE_LIST.map(t => t.split(' ')[0]).concat(['Універсальне']);
}

// Оновити стан витратника
function updateConsumable(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Витратники');
  if (!sheet) throw new Error('Аркуш Витратники не знайдено');

  const ids = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(data.id);
  if (idx === -1) throw new Error('ID не знайдено: ' + data.id);
  const row = idx + 3;

  const trackType = sheet.getRange(row, 5).getValue();

  if (trackType === 'Кількісний') {
    if (data.qty !== undefined && data.qty !== '') {
      sheet.getRange(row, 6).setValue(Number(data.qty));
    }
    if (data.minQty !== undefined && data.minQty !== '') {
      sheet.getRange(row, 7).setValue(Number(data.minQty));
    }
    // Статус перераховується формулою автоматично
  } else {
    // Статусний — ставимо вручну
    if (data.status) sheet.getRange(row, 8).setValue(data.status);
  }

  if (data.note !== undefined) sheet.getRange(row, 9).setValue(data.note);

  return {
    id:     data.id,
    name:   sheet.getRange(row, 2).getValue(),
    status: sheet.getRange(row, 8).getDisplayValue(),
  };
}

// Формула автостану кількісного витратника, СУМІСНА З ЛОКАЛЛЮ таблиці.
// Роздільник аргументів залежить від локалі (укр./євро — «;», en — «,»).
// Ставимо варіант із «;», перевіряємо, чи Sheets розпарсив; якщо ні —
// перезаписуємо з «,». Раніше писалася лише з комами → #ERROR! в укр. локалі.
function setConsStatusFormula_(sheet, r) {
  const cell = sheet.getRange(r, 8);
  const body = (sep) =>
    '=IF(F' + r + '=""' + sep + '""' + sep +
    'IF(F' + r + '<=G' + r + sep + '"Критично"' + sep +
    'IF(F' + r + '<=G' + r + '*2' + sep + '"Мало"' + sep +
    'IF(F' + r + '<=G' + r + '*4' + sep + '"Достатньо"' + sep + '"Багато"))))';
  cell.setFormula(body(';'));
  SpreadsheetApp.flush();
  const v = String(cell.getDisplayValue() || '');
  if (/^#/.test(v)) {            // #ERROR! / #NAME? — не та локаль
    cell.setFormula(body(','));
    SpreadsheetApp.flush();
  }
}

// Одноразовий ремонт: перевстановити формулу стану всім кількісним витратникам
// (запусти з редактора, якщо в аркуші є #ERROR! у колонці Стан)
function fixConsumableStatusFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Витратники');
  if (!sheet || sheet.getLastRow() < 3) return;
  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 5).getValues();
  let n = 0;
  rows.forEach((row, i) => {
    if (String(row[0]).trim() && String(row[4]).trim() === 'Кількісний') { setConsStatusFormula_(sheet, 3 + i); n++; }
  });
  Logger.log('Формули стану перевстановлено: ' + n);
}

// Додати новий витратник
function addConsumableFromForm(data) {
  return withScriptLock(function() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Витратники');
  if (!sheet) throw new Error('Аркуш Витратники не знайдено');

  // Генерувати ID
  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, 1).getValues().flat().forEach(id => {
      const m = String(id).match(/CONS-(\d+)/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
    });
  }
  const newId = 'CONS-' + String(maxNum + 1).padStart(3, '0');

  const newRow = [
    newId,
    data.name || '',
    data.category || '',
    data.compat || 'Універсальне',
    data.trackType || 'Статусний',
    data.trackType === 'Кількісний' ? (Number(data.qty) || 0) : '',
    data.trackType === 'Кількісний' ? (Number(data.minQty) || 0) : '',
    data.trackType === 'Статусний' ? (data.status || 'Достатньо') : '',
    data.note || '',
  ];

  sheet.appendRow(newRow);
  const insertedRow = sheet.getLastRow();

  // Для кількісних — встановити формулу статусу
  if (data.trackType === 'Кількісний') {
    setConsStatusFormula_(sheet, insertedRow);
  }

  sheet.getRange(insertedRow, 1, 1, 9)
    .setBackground(insertedRow % 2 === 0 ? COLORS.altRow : COLORS.white);

  return newId;
  });
}

// ============================================================
// СПИСАННЯ ВИТРАТНИКА
// ============================================================
// ============================================================
// SIDEBAR — СПИСАННЯ І ВИДАЛЕННЯ ВИТРАТНИКІВ
// ============================================================
function openWriteOffConsumableForm() {
  const html = HtmlService.createHtmlOutputFromFile('WriteOffConsumableForm')
    .setTitle('📉 Списання витратника').setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openDeleteConsumableForm() {
  const html = HtmlService.createHtmlOutputFromFile('DeleteConsumableForm')
    .setTitle('🗑️ Видалення витратника').setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Списання кількісного витратника
function writeOffConsumableById(data) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = getSheet(ss, 'Витратники');
  const logSheet = getSheet(ss, 'Списання');
  if (!sheet) throw new Error('Аркуш Витратники не знайдено');
  const ids = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(data.id);
  if (idx === -1) throw new Error('ID не знайдено: ' + data.id);
  const row = idx + 3;
  const trackType = sheet.getRange(row, 5).getValue();
  if (trackType !== 'Кількісний') throw new Error('Списання тільки для кількісних витратників');
  const currentQty = Number(sheet.getRange(row, 6).getValue()) || 0;
  const writeOff   = Number(data.qty) || 0;
  if (writeOff <= 0) throw new Error('Кількість має бути > 0');
  if (writeOff > currentQty) throw new Error('Списуємо більше ніж є: ' + writeOff + ' > ' + currentQty);
  sheet.getRange(row, 6).setValue(currentQty - writeOff);
  const name  = String(sheet.getRange(row, 2).getValue());
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (logSheet) logSheet.appendRow([today, data.id, name, writeOff,
    data.purpose || '', data.reason || '', apiUserEmail_() || '—', '']);
  return { id: data.id, name, written: writeOff, left: currentQty - writeOff,
    status: sheet.getRange(row, 8).getDisplayValue() };
}

// Видалення витратника
function deleteConsumableById(id, reason) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Витратники');
  const log   = getSheet(ss, 'Списання');
  if (!sheet) throw new Error('Аркуш Витратники не знайдено');
  const ids = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx = ids.indexOf(id);
  if (idx === -1) throw new Error('ID не знайдено: ' + id);
  const row  = idx + 3;
  const name = String(sheet.getRange(row, 2).getValue());
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (log) log.appendRow([today, id, name, '—', 'Видалення', reason || '', apiUserEmail_() || '—', '']);
  sheet.deleteRow(row);
  return { id, name };
}

function writeOffConsumable() {
  const ui       = SpreadsheetApp.getUi();
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const cons     = ss.getSheetByName('Витратники');
  const writeoff = ss.getSheetByName('Списання');

  const r1 = ui.prompt('📉 Списання', 'ID витратника (CONS-001 тощо):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const id = r1.getResponseText().trim();

  const ids  = cons.getRange(3, 1, cons.getLastRow() - 2, 1).getValues().flat().map(String);
  const idx  = ids.indexOf(id);
  if (idx === -1) { ui.alert('❌ ID не знайдено'); return; }
  const name = cons.getRange(idx + 3, 2).getValue();

  const r2 = ui.prompt('📉 Кількість', '"' + name + '"\nСкільки списуємо:', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const qty = parseFloat(r2.getResponseText().trim());
  if (isNaN(qty) || qty <= 0) { ui.alert('❌ Невірна кількість'); return; }

  const r3 = ui.prompt('📉 Причина', 'Причина / для чого:', ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK) return;

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  writeoff.appendRow([today, id, name, qty, '—', r3.getResponseText().trim(),
    apiUserEmail_() || '—', '']);
  ui.alert('✅ Списано: "' + name + '", ' + qty + ' од.');
}

// ============================================================
// ПОБУДОВА СИСТЕМИ
// ============================================================
function buildInventorySystemSafe() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('⚠️ Видалить УСІ ДАНІ!\n\nПродовжити?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const c = ui.prompt('Напиши  ВИДАЛИТИ  для підтвердження:', ui.ButtonSet.OK_CANCEL);
  if (c.getSelectedButton() !== ui.Button.OK || c.getResponseText().trim() !== 'ВИДАЛИТИ') {
    ui.alert('❌ Скасовано.'); return;
  }
  if (ui.alert('💾 Зробити бекап перед перебудовою?', ui.ButtonSet.YES_NO) === ui.Button.YES) {
    createBackup();
  }
  buildInventorySystem();
}

function buildInventorySystem() {
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();

  // Крок 1: Видалити всі аркуші крім одного
  // Отримуємо свіжий об'єкт ss кожного разу
  const ss0 = SpreadsheetApp.openById(ssId);
  const allSheets = ss0.getSheets();
  allSheets[0].setName('_tmp');
  for (let i = allSheets.length - 1; i >= 1; i--) {
    ss0.deleteSheet(allSheets[i]);
  }
  SpreadsheetApp.flush();

  // Крок 2: Отримуємо свіжий ss після видалення і будуємо аркуші
  const ss = SpreadsheetApp.openById(ssId);

  createInventorySheet(ss);
  createMovementLogSheet(ss);
  createConsumablesSheet(ss);
  createWriteOffSheet(ss);
  createFilterSheet(ss, 'Школа');
  createFilterSheet(ss, 'На виїзд');
  createFilterSheet(ss, 'Sting');
  createFilterSheet(ss, 'Симулятор');
  createFilterSheet(ss, 'Інше');
  createFilterSheet(ss, 'Майстерня');
  createLostSheet(ss);
  createNamesSheet(ss);
  createDashboard(ss);

  SpreadsheetApp.flush();
  try { ss.deleteSheet(ss.getSheetByName('_tmp')); } catch (e) {}

  // Повертаємось до активної таблиці щоб викликати getUi()
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  try { activeSs.setActiveSheet(activeSs.getSheetByName('Інвентар')); } catch(e) {}
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ Систему інвентаризації створено!', 'Готово', 5);
}

// ============================================================
// АРКУШ ІНВЕНТАР
// ============================================================
function createInventorySheet(ss) {
  const sheet = ss.insertSheet('Інвентар');

  sheet.getRange('A1:H1').merge()
    .setValue('📦 ІНВЕНТАР — Реєстр майна')
    .setBackground(COLORS.headerBg).setFontColor(COLORS.headerFg)
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 40);

  const headers = ['ID','Назва','Тип','Закріплення','Статус','Відповідальний','Дата','Комплект','Примітка'];
  sheet.getRange(2, 1, 1, 9).setValues([headers])
    .setBackground(COLORS.subBg).setFontColor(COLORS.headerFg)
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(2, 30);

  [185, 210, 190, 110, 115, 155, 105, 130, 240].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(2);
  // setFrozenColumns прибрано — конфліктує з merged заголовком A1:H1

  // Без демо-даних — таблиця починається порожньою
  applyAltRows(sheet, 3, 200, 8);
  applyDropdowns(sheet);
  applyStatusColors(sheet);

  // Захист заголовків інвентарю — дані лишаються вільними для роботи
  sheet.hideColumns(COLS.STATUS_TS); // Timestamp — прихований
  sheet.getRange('A1:H2').protect().setDescription('Заголовки інвентарю').setWarningOnly(true);
}

function applyDropdowns(sheet) {
  [[COLS.TYPE, TYPE_LIST], [COLS.ASSIGNMENT, ASSIGNMENT_LIST], [COLS.STATUS, STATUS_LIST]]
    .forEach(([col, list]) => {
      sheet.getRange(3, col, 500, 1).clearDataValidations();
      sheet.getRange(3, col, 500, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build()
      );
    });
}

function applyStatusColors(sheet) {
  const statusRules = [
    ['Робочий',      '#d4edda','#155724'],
    ['На перевірці', '#fff3cd','#856404'],
    ['Ремонт',       '#fde8c8','#7d4e00'],
    ['Несправний',   '#f8d7da','#721c24'],
    ['Втрачений',    '#2d0a0a','#ff9999'],
    ['Списаний',     '#e2e3e5','#383d41'],
    ['Резерв',       '#d1ecf1','#0c5460'],
  ].map(([val, bg, fg]) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(val).setBackground(bg).setFontColor(fg)
      .setRanges([sheet.getRange('E3:E500')]).build()
  );

  // Весь рядок червоний якщо статус Втрачений
  statusRules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$E3="Втрачений"')
      .setBackground('#3d0000').setFontColor('#ffaaaa')
      .setRanges([sheet.getRange('A3:I500')]).build()
  );

  sheet.setConditionalFormatRules(statusRules);
}

function applyAltRows(sheet, start, count, cols) {
  for (let i = 0; i < count; i++) {
    sheet.getRange(start + i, 1, 1, cols)
      .setBackground(i % 2 === 0 ? COLORS.white : COLORS.altRow);
  }
}

// Оновити структуру Інвентарю без втрати даних
// — dropdown статусів, типів, закріплень
// — умовне форматування
// — заморозка рядків
function reapplyInventoryStructure() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const done = [];

  // 1. ІНВЕНТАР — dropdown + форматування + заморозка
  const inv = getSheet(ss, 'Інвентар');
  if (inv) {
    [[COLS.TYPE, TYPE_LIST], [COLS.ASSIGNMENT, ASSIGNMENT_LIST], [COLS.STATUS, STATUS_LIST]]
      .forEach(([col, list]) => {
        inv.getRange(3, col, 500, 1).setDataValidation(
          SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build()
        );
      });
    applyStatusColors(inv);
    inv.setFrozenRows(2);
    done.push('✅ Інвентар — dropdown, форматування');
  }

  // 2. ЖУРНАЛ РУХУ — dropdown операцій
  const log = getSheet(ss, 'Журнал руху');
  if (log) {
    log.getRange('D3:D500').setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(['Надходження','Передача','Повернення','Зміна статусу',
          'Передача в ремонт','Повернення з ремонту','Списання',
          'Видалення з обліку','Зміна закріплення','Зміна відповідального'], true)
        .setAllowInvalid(true).build()
    );
    done.push('✅ Журнал руху — dropdown операцій');
  }

  // 3. ВИТРАТНИКИ — всі dropdown
  const cons = getSheet(ss, 'Витратники');
  if (cons) {
    const catList    = ['Рами','Мотори','ESC','Пропелери','Антени','Кабелі','Пайка','Електроніка','Кріплення','Загальне','Інше'];
    const compatList = TYPE_LIST.map(t => t.split(' ')[0]).concat(['Універсальне']);
    cons.getRange('C3:C200').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(catList, true).setAllowInvalid(false).build()
    );
    cons.getRange('D3:D200').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(compatList, true).setAllowInvalid(true).build()
    );
    cons.getRange('E3:E200').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Кількісний','Статусний'], true).setAllowInvalid(false).build()
    );
    cons.getRange('H3:H200').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Багато','Достатньо','Мало','Критично'], true).setAllowInvalid(true).build()
    );
    done.push('✅ Витратники — категорії, сумісність, тип, статус');
  }

  // 4. ДОВІДНИК НАЗВ — dropdown типів
  const ref = getSheet(ss, 'Довідник назв');
  if (ref) {
    ref.getRange('A3:A200').setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(TYPE_LIST.map(t => t.split(' ')[0]), true)
        .setAllowInvalid(false).build()
    );
    done.push('✅ Довідник назв — типи');
  }

  // 5. ДАШБОРД — критерії типів у прихованих стовпцях
  const dash = getSheet(ss, 'Дашборд');
  if (dash) {
    TYPE_LIST.forEach((typeVal, i) => {
      const r = 6 + i;
      const label = typeVal.includes(' — ') ? typeVal.split(' — ')[1] : typeVal;
      dash.getRange(r, 7).setValue(label);
      dash.getRange(r, 18).setValue(typeVal);
      dash.getRange(r, 19).setValue('Робочий');
      dash.getRange(r, 20).setValue('Ремонт');
      dash.getRange(r, 21).setValue('Несправний');
      dash.getRange(r, 22).setValue('Резерв');
      dash.getRange(r, 23).setValue('Втрачений');
    });
    done.push('✅ Дашборд — критерії типів');
  }

  // 6. Оновити dropdown SIM-карт
  const sim = getSheet(ss, 'SIM-карти');
  if (sim) {
    sim.getRange('D3:D200').setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(['Активна','Заблокована','Втрачена','Невідомо'], true)
        .setAllowInvalid(true).build()
    );
    done.push('✅ SIM-карти — статуси');
  }

  ui.alert('Оновлено:\n\n' + done.join('\n'));
}

function reapplyAll() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Інвентар');
  applyDropdowns(sheet);
  applyStatusColors(sheet);
  // Захист заголовків інвентарю — дані лишаються вільними для роботи
  sheet.getRange('A1:H2').protect().setDescription('Заголовки інвентарю').setWarningOnly(true);
  SpreadsheetApp.getUi().alert('✅ Списки і захист оновлено');
}

// ============================================================
// ЖУРНАЛ РУХУ
// ============================================================
function createMovementLogSheet(ss) {
  const sheet   = ss.insertSheet('Журнал руху');
  const headers = ['Дата','ID','Назва','Операція','Від кого','Кому','Хто фіксував','Відповідальний','Коментар'];
  const widths  = [105,185,200,145,145,145,155,155,240];

  sheet.getRange('A1:I1').merge()
    .setValue('📋 ЖУРНАЛ РУХУ')
    .setBackground(COLORS.headerBg).setFontColor(COLORS.headerFg)
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);
  sheet.getRange(2, 1, 1, 9).setValues([headers])
    .setBackground(COLORS.subBg).setFontColor(COLORS.headerFg)
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 28);
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(2);
  // setFrozenColumns(2) прибрано — конфліктує з merged заголовком A1:I1
  applyAltRows(sheet, 3, 200, 9);

  sheet.getRange('D3:D500').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Надходження','Передача','Повернення','Зміна статусу',
        'Передача в ремонт','Повернення з ремонту','Списання',
        'Видалення з обліку','Зміна закріплення','Зміна відповідального'], true)
      .setAllowInvalid(true).build() // true — щоб не блокувати при відновленні з JSON
  );

  const opRange = sheet.getRange('D3:D500');
  sheet.setConditionalFormatRules([
    ['Надходження',          '#d4edda','#155724'],
    ['Списання',             '#f8d7da','#721c24'],
    ['Передача',             '#fff3cd','#856404'],
    ['Передача в ремонт',    '#fde8c8','#7d4e00'],
    ['Повернення',           '#d1ecf1','#0c5460'],
    ['Повернення з ремонту', '#d1ecf1','#0c5460'],
  ].map(([val, bg, fg]) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(val).setBackground(bg).setFontColor(fg)
      .setRanges([opRange]).build()
  ));
}

// ============================================================
// ВИТРАТНИКИ
// ============================================================
function createConsumablesSheet(ss) {
  const sheet = ss.insertSheet('Витратники');

  // Нова структура:
  // ID | Назва | Категорія | Сумісність | Тип обліку | Кількість | Мін.кількість | Статус | Примітка
  const headers = ['ID','Назва','Категорія','Сумісність','Тип обліку',
    'Кількість','Мін. к-сть','Статус','Примітка'];
  const widths  = [110, 220, 130, 160, 110, 100, 90, 120, 220];

  sheet.getRange('A1:I1').merge()
    .setValue('\uD83D\uDD27 ВИТРАТНІ МАТЕРІАЛИ')
    .setBackground(COLORS.headerBg).setFontColor(COLORS.headerFg)
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);

  sheet.getRange(2, 1, 1, 9).setValues([headers])
    .setBackground(COLORS.subBg).setFontColor(COLORS.headerFg)
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 28);

  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(2);

  // Демо-дані
  const sample = [
    ['CONS-001','Рама 5"','Рами','FPV','Кількісний',10,3,'',''],
    ['CONS-002','Мотори 2306','Мотори','FPV, STNG','Кількісний',20,4,'',''],
    ['CONS-003','Пропи 5" HQ','Пропелери','FPV','Статусний','','','Достатньо',''],
    ['CONS-004','Пропи 5" Gemfan','Пропелери','FPV, STNG','Статусний','','','Достатньо',''],
    ['CONS-005','XT60 конектор','Електроніка','Універсальне','Статусний','','','Багато',''],
    ['CONS-006','Термоусадка','Кабелі','Універсальне','Статусний','','','Достатньо',''],
    ['CONS-007','Припій ПОС-60','Пайка','Універсальне','Статусний','','','Достатньо',''],
    ['CONS-008','ESC 4в1 45A','Електроніка','FPV','Кількісний',6,2,'',''],
  ];
  sheet.getRange(3, 1, sample.length, 9).setValues(sample);

  // Формули автостатусу для кількісних
  // Статус = авто якщо Тип обліку = Кількісний
  // Якщо Статусний — ставиться вручну
  for (let i = 0; i < sample.length; i++) {
    const r = 3 + i;
    if (sample[i][4] === 'Кількісний') {
      setConsStatusFormula_(sheet, r);
    }
  }

  applyAltRows(sheet, 3, 100, 9);

  // Dropdown — Категорія
  sheet.getRange('C3:C200').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Рами','Мотори','ESC','Пропелери','Антени','Кабелі','Пайка','Електроніка','Кріплення','Загальне','Інше'], true)
      .setAllowInvalid(false).build()
  );

  // Dropdown — Сумісність: префікси з TYPE_LIST + Універсальне + комбінації
  const compatList = TYPE_LIST.map(t => t.split(' ')[0]).concat(['Універсальне']);
  sheet.getRange('D3:D200').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(compatList, true)
      .setAllowInvalid(true) // true — бо можна вписати "FPV, STNG" вручну
      .build()
  );

  // Dropdown — Тип обліку
  sheet.getRange('E3:E200').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Кількісний','Статусний'], true)
      .setAllowInvalid(false).build()
  );

  // Dropdown — Статус (для статусних; кількісні мають формулу)
  sheet.getRange('H3:H200').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Багато','Достатньо','Мало','Критично'], true)
      .setAllowInvalid(true).build() // allowInvalid=true бо формула теж пише сюди
  );

  // Умовне форматування статусу
  const statusRange = sheet.getRange('H3:H200');
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Багато')
      .setBackground('#d4edda').setFontColor('#155724').setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Достатньо')
      .setBackground('#d1ecf1').setFontColor('#0c5460').setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Мало')
      .setBackground('#fff3cd').setFontColor('#856404').setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Критично')
      .setBackground('#f8d7da').setFontColor('#721c24').setRanges([statusRange]).build(),
  ]);

  // Захист Витратників — тільки попередження
  sheet.protect().setDescription('Витратники — змінюй через меню').setWarningOnly(true);
}
function createWriteOffSheet(ss) {
  const sheet   = ss.insertSheet('Списання');
  const headers = ['Дата','ID витратника','Назва','Кількість','Куди','Причина','Хто','Коментар'];
  const widths  = [105,130,220,90,130,190,140,210];

  sheet.getRange('A1:H1').merge()
    .setValue('📉 СПИСАННЯ ВИТРАТНИКІВ')
    .setBackground(COLORS.headerBg).setFontColor(COLORS.headerFg)
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);
  sheet.getRange(2, 1, 1, 8).setValues([headers])
    .setBackground(COLORS.subBg).setFontColor(COLORS.headerFg)
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 28);
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(2);
  applyAltRows(sheet, 3, 100, 8);
  sheet.protect().setDescription('Списання — тільки читання').setWarningOnly(true);
}

// ============================================================
// ФІЛЬТР-ВКЛАДКИ
// ============================================================
function createFilterSheet(ss, name) {
  const sheet = ss.insertSheet(name);
  const bgMap = { 'Школа':'#1e3a8a','На виїзд':'#7f1d1d','Sting':'#713f12','Симулятор':'#14532d','Інше':'#4a1d96','Майстерня':'#7d4e00','Втрачені':'#2d0a0a' };
  const bg    = bgMap[name] || COLORS.headerBg;

  sheet.getRange('A1:H1').merge()
    .setValue('🔍 ' + name.toUpperCase())
    .setBackground(bg).setFontColor('#fff')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);

  sheet.getRange('A2:H2').merge()
    .setValue('Автоматично з "Інвентар" де Закріплення = "' + name + '". Редагуй тільки в Інвентарі.')
    .setFontSize(9).setFontStyle('italic').setBackground('#f0f4f8');
  sheet.setRowHeight(2, 20);

  sheet.getRange(3, 1, 1, 8)
    .setValues([['ID','Назва','Тип','Закріплення','Статус','Відповідальний','Дата','Примітка']])
    .setBackground(bg).setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(3, 28);

  sheet.getRange('J1').setValue(name);
  const q = 'SELECT A,B,C,D,E,F,G,H WHERE D = \'' + name + '\' ORDER BY C,B';
  sheet.getRange('A4').setFormula(
    '=IFERROR(QUERY(Інвентар!A3:H;"' + q + '";0);"— Немає записів —")'
  );
  sheet.getRange('G4:G500').setNumberFormat('yyyy-mm-dd');

  [185,210,190,110,115,155,105,240].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(3);

  // ── Міні-дашборд праворуч (стовпці K-R) ──
  buildMiniDashboard(sheet, name);

  sheet.protect().setDescription(name + ' — тільки читання').setWarningOnly(true);
}

function buildMiniDashboard(sheet, assignment) {
  const DC = 11; // Колонка K
  const W  = 8;  // K-R
  const fg = '#ffffff';
  const statHdr = ['Всього','✅ Роб.','🔧 Рем.','❌ Несп.','🔍 Втр.','🗑 Сп.','⏸ Рез.'];

  // Ширини K-R
  [170,60,60,60,60,60,60,60].forEach((w,i) => sheet.setColumnWidth(DC+i, w));

  // Критерії в прихованих стовпцях S(19) і T(20)
  sheet.getRange(1,19).setValue(assignment);
  sheet.hideColumns(19);
  sheet.hideColumns(20);

  // ── РЯД 1: ЗАГОЛОВОК ─────────────────────────────────
  sheet.getRange(1, DC, 1, W).merge()
    .setValue('📊 ' + assignment.toUpperCase() + ' — ЗВЕДЕННЯ')
    .setBackground('#1a3a5c').setFontColor(fg).setFontWeight('bold')
    .setFontSize(12).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  // ── РЯД 2: Загальний — шапка + назва в K ─────────────
  sheet.getRange(2, DC).setValue('Загальний')
    .setBackground('#2e6da4').setFontColor(fg).setFontWeight('bold').setFontSize(9)
    .setHorizontalAlignment('center');
  sheet.getRange(2, DC+1, 1, 7).setValues([statHdr])
    .setBackground('#2e6da4').setFontColor(fg).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center');
  sheet.setRowHeight(2, 22);

  // ── РЯД 3: Цифри загального ──────────────────────────
  sheet.getRange(3, DC).setValue('').setBackground('#e8f4fd');
  [
    '=COUNTIF(Інвентар!D3:D;S1)',
    '=COUNTIFS(Інвентар!D3:D;S1;Інвентар!E3:E;"Робочий")',
    '=COUNTIFS(Інвентар!D3:D;S1;Інвентар!E3:E;"Ремонт")',
    '=COUNTIFS(Інвентар!D3:D;S1;Інвентар!E3:E;"Несправний")',
    '=COUNTIFS(Інвентар!D3:D;S1;Інвентар!E3:E;"Втрачений")',
    '=COUNTIFS(Інвентар!D3:D;S1;Інвентар!E3:E;"Списаний")',
    '=COUNTIFS(Інвентар!D3:D;S1;Інвентар!E3:E;"Резерв")',
  ].forEach((f,i) => {
    sheet.getRange(3, DC+1+i).setFormula(f)
      .setHorizontalAlignment('center').setFontWeight('bold').setFontSize(13)
      .setBackground('#e8f4fd');
  });
  sheet.setRowHeight(3, 32);

  // ── РЯД 4: ПО ТИПАХ — шапка + назва в K ─────────────
  sheet.getRange(4, DC).setValue('🚁 ПО ТИПАХ')
    .setBackground('#4a1d96').setFontColor(fg).setFontWeight('bold').setFontSize(9)
    .setHorizontalAlignment('center');
  sheet.getRange(4, DC+1, 1, 7).setValues([statHdr])
    .setBackground('#4a1d96').setFontColor(fg).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center');
  sheet.setRowHeight(4, 22);

  // Типи
  const types = [
    ['FPV','FPV — FPV дрон (4+ мотори)'],
    ['STNG','STNG — Sting'],
    ['WING','WING — Літак / крило'],
    ['RMT','RMT — Пульт (RadioMaster тощо)'],
    ['TX','TX — Передавач (окремий модуль)'],
    ['GNST','GNST — Наземна станція (комплект)'],
    ['TRK','TRK — Поворотка (antenna tracker)'],
    ['ANT','ANT — Антена (будь-яка)'],
    ['VRX','VRX — Аналоговий відеоприймач'],
    ['GGL','GGL — Окуляри FPV'],
    ['BAT','BAT — Батарея'],
    ['CHG','CHG — Зарядний пристрій'],
    ['PC',"PC — Комп'ютер"],
    ['MON','MON — Монітор'],
    ['KEY','KEY — Клавіатура'],
    ['MSE','MSE — Мишка'],
    ['HTR','HTR — Обігрівач'],
    ['TOOL','TOOL — Інструмент'],
    ['MST','MST — Щогла'],
    ['OTHER','OTHER — Інше'],
  ];

  types.forEach((t, i) => {
    const r   = 5 + i;
    const bg2 = i % 2 === 0 ? '#f5f0ff' : '#ffffff';
    sheet.getRange(r, 20).setValue(t[1]); // T — критерій типу
    const tr = 'T' + r;
    sheet.getRange(r, DC).setValue(t[0])
      .setBackground(bg2).setFontWeight('bold').setFontSize(9);
    [
      `=COUNTIFS(Інвентар!C3:C;${tr};Інвентар!D3:D;S1)`,
      `=COUNTIFS(Інвентар!C3:C;${tr};Інвентар!D3:D;S1;Інвентар!E3:E;"Робочий")`,
      `=COUNTIFS(Інвентар!C3:C;${tr};Інвентар!D3:D;S1;Інвентар!E3:E;"Ремонт")`,
      `=COUNTIFS(Інвентар!C3:C;${tr};Інвентар!D3:D;S1;Інвентар!E3:E;"Несправний")`,
      `=COUNTIFS(Інвентар!C3:C;${tr};Інвентар!D3:D;S1;Інвентар!E3:E;"Втрачений")`,
      `=COUNTIFS(Інвентар!C3:C;${tr};Інвентар!D3:D;S1;Інвентар!E3:E;"Списаний")`,
      `=COUNTIFS(Інвентар!C3:C;${tr};Інвентар!D3:D;S1;Інвентар!E3:E;"Резерв")`,
    ].forEach((f,j) => {
      sheet.getRange(r, DC+1+j).setFormula(f)
        .setHorizontalAlignment('center').setFontSize(9).setBackground(bg2);
    });
    sheet.setRowHeight(r, 19);
  });

  // ── РЯД nameHdrRow: ПО НАЗВАХ — шапка + назва в K ────
  const nameHdrRow = 5 + types.length;
  sheet.getRange(nameHdrRow, DC).setValue('📋 ПО НАЗВАХ')
    .setBackground('#14532d').setFontColor(fg).setFontWeight('bold').setFontSize(9)
    .setHorizontalAlignment('center');
  sheet.getRange(nameHdrRow, DC+1, 1, 7).setValues([statHdr])
    .setBackground('#14532d').setFontColor(fg).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center');
  sheet.setRowHeight(nameHdrRow, 22);

  // Дані по назвах — починаємо з наступного рядка
  const nr = nameHdrRow + 1;
  const Kcol = 'K'; // стовпець K = DC = 11

  // Унікальні назви
  sheet.getRange(nr, DC).setFormula(
    `=IFERROR(SORT(UNIQUE(FILTER(Інвентар!B3:B;Інвентар!D3:D=S1;Інвентар!B3:B<>"")));"-")`
  );
  // Всього
  sheet.getRange(nr, DC+1).setFormula(
    `=ARRAYFORMULA(IF(${Kcol}${nr}:${Kcol}="";;COUNTIFS(Інвентар!B3:B;${Kcol}${nr}:${Kcol};Інвентар!D3:D;S1)))`
  );
  // Роб.
  sheet.getRange(nr, DC+2).setFormula(
    `=ARRAYFORMULA(IF(${Kcol}${nr}:${Kcol}="";;COUNTIFS(Інвентар!B3:B;${Kcol}${nr}:${Kcol};Інвентар!D3:D;S1;Інвентар!E3:E;"Робочий")))`
  );
  // Рем.
  sheet.getRange(nr, DC+3).setFormula(
    `=ARRAYFORMULA(IF(${Kcol}${nr}:${Kcol}="";;COUNTIFS(Інвентар!B3:B;${Kcol}${nr}:${Kcol};Інвентар!D3:D;S1;Інвентар!E3:E;"Ремонт")))`
  );
  // Несп.
  sheet.getRange(nr, DC+4).setFormula(
    `=ARRAYFORMULA(IF(${Kcol}${nr}:${Kcol}="";;COUNTIFS(Інвентар!B3:B;${Kcol}${nr}:${Kcol};Інвентар!D3:D;S1;Інвентар!E3:E;"Несправний")))`
  );
  // Втр.
  sheet.getRange(nr, DC+5).setFormula(
    `=ARRAYFORMULA(IF(${Kcol}${nr}:${Kcol}="";;COUNTIFS(Інвентар!B3:B;${Kcol}${nr}:${Kcol};Інвентар!D3:D;S1;Інвентар!E3:E;"Втрачений")))`
  );
  // Сп.
  sheet.getRange(nr, DC+6).setFormula(
    `=ARRAYFORMULA(IF(${Kcol}${nr}:${Kcol}="";;COUNTIFS(Інвентар!B3:B;${Kcol}${nr}:${Kcol};Інвентар!D3:D;S1;Інвентар!E3:E;"Списаний")))`
  );
  // Рез.
  sheet.getRange(nr, DC+7).setFormula(
    `=ARRAYFORMULA(IF(${Kcol}${nr}:${Kcol}="";;COUNTIFS(Інвентар!B3:B;${Kcol}${nr}:${Kcol};Інвентар!D3:D;S1;Інвентар!E3:E;"Резерв")))`
  );
}


// ============================================================
// ДАШБОРД
// ============================================================
// Записує один рядок статистики на дашборді
// Формули з українськими рядками пишемо через setValue щоб уникнути проблем кодування
function dashTitle(sheet, row, col, span, title, color) {
  sheet.getRange(row, col, 1, span).merge()
    .setValue(title).setBackground(color).setFontColor('#fff')
    .setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(row, 28);
}

// ============================================================
// АРКУШ ДОВІДНИК НАЗВ
// ============================================================
function createNamesSheet(ss) {
  const sheet = ss.insertSheet('Довідник назв');

  sheet.getRange('A1:C1').merge()
    .setValue('📋 ДОВІДНИК НАЗВ ОБЛАДНАННЯ')
    .setBackground(COLORS.headerBg).setFontColor(COLORS.headerFg)
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);

  sheet.getRange(2, 1, 1, 3).setValues([['Тип (префікс)', 'Назва', 'Опис/модель']])
    .setBackground(COLORS.subBg).setFontColor(COLORS.headerFg)
    .setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 28);

  const defaultNames = [
    ['FPV', 'Geprc Mark 5 5"', ''],
    ['FPV', 'Geprc Mark 7 7"', ''],
    ['FPV', 'iFlight Nazgul5 V3 5"', ''],
    ['FPV', 'iFlight XL8 V5 8"', ''],
    ['FPV', 'TBS Source One 10"', ''],
    ['FPV', 'Custom 5"', ''],
    ['FPV', 'Custom 7"', ''],
    ['FPV', 'Custom 8"', ''],
    ['FPV', 'Custom 10"', ''],
    ['FPV', 'Custom 15"', ''],
    ['FPV', 'Geprc CineLog 35 3.5" (cinewhoop)', ''],
    ['FPV', 'iFlight Chimera7 Pro 7" (cinewhoop)', ''],
    ['MST',  'Телескопічна щогла 9+3м', ''],
    ['MST',  'Складна щогла', ''],
    ['STNG', 'Sting борт', ''],
    ['RMT', 'RadioMaster Boxer', ''],
    ['RMT', 'RadioMaster TX16S', ''],
    ['TX',  'TBS Crossfire TX', ''],
    ['TX',  'ExpressLRS TX', ''],
    ['GGL', 'DJI Goggles 2', ''],
    ['GGL', 'Walksnail Avatar HD', ''],
    ['GGL', 'Skyzone SKY04X', ''],
    ['PC',  'PC Intel', ''],
    ['PC',  'PC AMD', ''],
    ['TRK', 'TBS Crossfire Tracker', ''],
    ['VRX', 'Rapidfire VRX', ''],
    ['DGA', 'Hornet Vision', ''],
    ['GNST','Наземна станція аналог', ''],
    ['GNST','Наземна станція цифрова', ''],
  ];

  sheet.getRange(3, 1, defaultNames.length, 3).setValues(defaultNames);
  applyAltRows(sheet, 3, 100, 3);

  [120, 220, 200].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(2);

  sheet.getRange('A3:A200').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(TYPE_LIST.map(t => t.split(' ')[0]), true)
      .setAllowInvalid(false).build()
  );

  sheet.getRange('A1:C2').protect().setDescription('Заголовки').setWarningOnly(true);
}

// ============================================================
// АРКУШ ВТРАЧЕНІ
// ============================================================
function createLostSheet(ss) {
  const sheet = ss.insertSheet('Втрачені');
  const bg    = '#2d0a0a';

  sheet.getRange('A1:J1').merge()
    .setValue('🔍 ВТРАЧЕНІ БОРТИ')
    .setBackground(bg).setFontColor('#ff9999')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);

  sheet.getRange('A2:J2').merge()
    .setValue('Автоматично з "Інвентар" де Статус = "Втрачений". Редагуй тільки в Інвентарі.')
    .setFontSize(9).setFontStyle('italic').setBackground('#1a0505').setFontColor('#ff9999');
  sheet.setRowHeight(2, 20);

  sheet.getRange(3, 1, 1, 8)
    .setValues([['ID','Назва','Тип','Закріплення','Статус','Відповідальний','Дата','Примітка']])
    .setBackground('#5a0a0a').setFontColor('#ffaaaa').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(3, 28);

  // Використовуємо FILTER замість QUERY — надійніше для українських рядків
  sheet.getRange('J1').setValue('Втрачений');
  sheet.getRange('A4').setFormula(
    '=IFERROR(FILTER(Інвентар!A3:H;TRIM(Інвентар!E3:E)="Втрачений");"— Втрачених немає —")'
  );
  sheet.getRange('G4:G500').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('G4:G500').setNumberFormat('yyyy-mm-dd');

  [185,210,190,110,115,155,105,240].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(3);
  sheet.hideColumns(10); // сховати допоміжну J

  // Захист всього аркушу — редагування тільки в Інвентарі
  sheet.protect()
    .setDescription('Втрачені — тільки читання')
    .setWarningOnly(true);
}

function createDashboard(ss) {
  const sheet = ss.insertSheet('Дашборд');

  sheet.getRange('A1:L1').merge()
    .setValue('📊 ДАШБОРД — Зведення інвентарю')
    .setBackground(COLORS.headerBg).setFontColor(COLORS.headerFg)
    .setFontSize(15).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 46);

  sheet.getRange('A2:L2').merge()
    .setFormula('="⏱ Оновлено: "&TEXT(NOW();"DD.MM.YYYY о HH:MM")')
    .setFontSize(9).setFontStyle('italic').setHorizontalAlignment('right').setFontColor('#888');

  // ── БЛОК 1: Загалом ──
  dashTitle(sheet, 4, 1, 2, '📦 ЗАГАЛОМ', '#1a3a5c');

  const statCriteria = ['Робочий','Ремонт','Несправний','Втрачений','Списаний','Резерв','На перевірці'];
  statCriteria.forEach((val, i) => sheet.getRange(5 + i, 16).setValue(val));

  const statRows = [
    ['Всього одиниць',   '=COUNTA(Інвентар!A3:A)'],
    ['✅ Робочих',       '=COUNTIF(Інвентар!E3:E;P5)'],
    ['🔧 Ремонт',        '=COUNTIF(Інвентар!E3:E;P6)'],
    ['❌ Несправних',    '=COUNTIF(Інвентар!E3:E;P7)'],
    ['🔍 Втрачених',     '=COUNTIF(Інвентар!E3:E;P8)'],
    ['🗑 Списаних',      '=COUNTIF(Інвентар!E3:E;P9)'],
    ['⏸ Резерв',        '=COUNTIF(Інвентар!E3:E;P10)'],
    ['⚠️ На перевірці', '=COUNTIF(Інвентар!E3:E;P11)'],
  ];
  statRows.forEach(([label, formula], i) => {
    const r  = 5 + i;
    const bg = i % 2 === 0 ? COLORS.white : COLORS.altRow;
    sheet.getRange(r, 1).setValue(label).setBackground(bg).setFontSize(11);
    sheet.getRange(r, 2).setFormula(formula)
      .setFontWeight('bold').setHorizontalAlignment('center').setFontSize(14).setBackground(bg);
    sheet.setRowHeight(r, 26);
  });

  // ── БЛОК 2: По закріпленнях ──
  dashTitle(sheet, 4, 4, 2, '🏷️ ЗАКРІПЛЕННЯ', '#14532d');
  ASSIGNMENT_LIST.forEach((a, i) => {
    const r  = 5 + i;
    const bg = i % 2 === 0 ? COLORS.white : COLORS.altRow;
    sheet.getRange(r, 17).setValue(a);
    sheet.getRange(r, 4).setValue(a).setBackground(bg).setFontSize(11);
    sheet.getRange(r, 5).setFormula('=COUNTIF(Інвентар!D3:D;Q' + r + ')')
      .setFontWeight('bold').setHorizontalAlignment('center').setFontSize(14).setBackground(bg);
    sheet.setRowHeight(r, 26);
  });

  // ── БЛОК 3: По типах — 5 колонок ──
  dashTitle(sheet, 4, 7, 7, '🚁 ПО ТИПАХ', '#4a1d96');
  sheet.getRange(5, 7, 1, 7)
    .setValues([['Тип','Всього','Робочих','Ремонт','Несправних','Резерв','Втрачених']])
    .setBackground('#4472c4').setFontColor('#fff').setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBorder(true,true,true,true,true,false,'#2a4a8a',SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(5, 26);
  sheet.setRowHeight(5, 26);

  // Критерії: R(18)=тип, S(19)=Робочий, T(20)=Ремонт, U(21)=Несправний, V(22)=Втрачений
  TYPE_LIST.forEach((typeVal, i) => {
    const label = typeVal.includes(' — ') ? typeVal.split(' — ')[1] : typeVal;
    const r  = 6 + i;
    const bg = i % 2 === 0 ? COLORS.white : COLORS.altRow;
    sheet.getRange(r, 18).setValue(typeVal);
    sheet.getRange(r, 19).setValue('Робочий');
    sheet.getRange(r, 20).setValue('Ремонт');
    sheet.getRange(r, 21).setValue('Несправний');
    sheet.getRange(r, 22).setValue('Резерв');
    sheet.getRange(r, 23).setValue('Втрачений');
    sheet.getRange(r, 7).setValue(label).setBackground(bg).setFontSize(10);
    sheet.getRange(r, 8)
      .setFormula('=COUNTIF(Інвентар!C3:C;R' + r + ')')
      .setHorizontalAlignment('center').setFontWeight('bold').setFontSize(13).setBackground(bg);
    sheet.getRange(r, 9)
      .setFormula('=COUNTIFS(Інвентар!C3:C;R' + r + ';Інвентар!E3:E;S' + r + ')')
      .setHorizontalAlignment('center').setFontColor('#155724').setBackground(bg);
    sheet.getRange(r, 10)
      .setFormula('=COUNTIFS(Інвентар!C3:C;R' + r + ';Інвентар!E3:E;T' + r + ')')
      .setHorizontalAlignment('center').setFontColor('#7d4e00').setBackground(bg);
    sheet.getRange(r, 11)
      .setFormula('=COUNTIFS(Інвентар!C3:C;R' + r + ';Інвентар!E3:E;U' + r + ')')
      .setHorizontalAlignment('center').setFontColor('#721c24').setBackground(bg);
    sheet.getRange(r, 12)
      .setFormula('=COUNTIFS(Інвентар!C3:C;R' + r + ';Інвентар!E3:E;V' + r + ')')
      .setHorizontalAlignment('center').setFontColor('#0c5460').setBackground(bg);
    sheet.getRange(r, 13)
      .setFormula('=COUNTIFS(Інвентар!C3:C;R' + r + ';Інвентар!E3:E;W' + r + ')')
      .setHorizontalAlignment('center').setFontColor('#ff9999').setFontWeight('bold')
      .setBackground('#3d0000')
      .setBorder(true,true,true,true,false,false,'#5a0a0a',SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(r, 24);
  });

  // Сховати допоміжні стовпці P,Q,R,S,T,U,V,W
  sheet.hideColumns(16, 8);

  // ── БЛОК 4: Витратники ──
  const lowRow = 6 + TYPE_LIST.length + 2;
  dashTitle(sheet, lowRow, 1, 5, '🔧 ВИТРАТНИКИ — СТАН', '#7d4e00');

  sheet.getRange(lowRow + 1, 1, 1, 5)
    .setValues([['Назва','Сумісність','Тип обліку','К-сть','Статус']])
    .setFontWeight('bold').setBackground('#c8a97e').setFontColor('#fff');
  sheet.setRowHeight(lowRow + 1, 24);

  // QUERY витратників: Назва(B), Сумісність(D), Тип обліку(E), К-сть(F), Статус(H)
  // Сортуємо: Критично першими
  sheet.getRange(lowRow + 2, 1)
    .setFormula('=IFERROR(QUERY(Витратники!B3:H;"SELECT B,D,E,F,H WHERE B IS NOT NULL ORDER BY H";0);"Даних немає")');

  // Кольори статусів витратників на дашборді
  const consRange = sheet.getRange(lowRow + 2, 5, 50, 1);
  const rules = sheet.getConditionalFormatRules();
  [
    ['Багато',      '#d4edda','#155724'],
    ['Достатньо',   '#d1ecf1','#0c5460'],
    ['Мало',        '#fff3cd','#856404'],
    ['Критично',    '#f8d7da','#721c24'],
  ].forEach(([val, bg, fg]) => {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(val).setBackground(bg).setFontColor(fg)
      .setRanges([consRange]).build());
  });
  sheet.setConditionalFormatRules(rules);

  // Ширини
  [180, 80, 20, 180, 80, 20, 170, 75, 75, 75, 75].forEach((w, i) =>
    sheet.setColumnWidth(i + 1, w));

  // Захист дашборду — тільки попередження
  sheet.protect()
    .setDescription('Дашборд — не редагуй вручну')
    .setWarningOnly(true);
}


// Виправити формат часу в Журналі польоту
// Виправити старі рядки Журналу польоту (зсув колонок після додавання Відповідальна особа)
function fixFlightLogColumns() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return;
  const ui = SpreadsheetApp.getUi();

  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(3, 1, lastRow - 2, 14).getValues();
  let fixed = 0;

  data.forEach((row, i) => {
    const htmlRow = 3 + i;
    // Старий формат: col G = Sinotrack (не порожній і починається з SNT або є назва)
    // Новий формат: col G = Відповідальна особа (може бути порожня або ім'я)
    // Ознака старого: col H порожня але col G не порожня і схожа на трекер
    const colG = String(row[6]).trim(); // G
    const colH = String(row[7]).trim(); // H
    const colL = String(row[11]).trim(); // L (статус в новому форматі)

    // Якщо col G виглядає як ID трекера (SNT-) або порожня H і є дані після G
    // і при цьому col L порожня — значить рядок старого формату
    const looksLikeTracker = colG.startsWith('SNT-') || colG.startsWith('snT-');
    const statusInWrongPlace = looksLikeTracker && !colH;

    if (statusInWrongPlace) {
      // Зсунути колонки G-N на одну вправо, вставити порожню G
      const newRow = [
        row[0], row[1], row[2], row[3], row[4], row[5], // A-F без змін
        '',       // G — Відповідальна особа (порожня)
        row[6],   // H — Sinotrack (було G)
        row[7],   // I — Трекер ОК (було H)
        row[8],   // J — Початок (було I)
        row[9],   // K — Кінець (було J)
        row[10],  // L — Статус (було K)
        row[11],  // M — Примітка (було L)
        row[12],  // N — Автор (було M)
      ];
      sheet.getRange(htmlRow, 1, 1, 14).setValues([newRow]);
      fixed++;
    }
  });

  // Виправити формат часу
  sheet.getRange(3, 10, lastRow - 2, 2).setNumberFormat('@STRING@');

  ui.alert('✅ Виправлено ' + fixed + ' рядків');
}

function fixFlightLogTimeFormat() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) {
    SpreadsheetApp.getUi().alert('Журнал польоту порожній');
    return;
  }

  const lastRow = sheet.getLastRow();
  // Колонки 9 (Початок) і 10 (Кінець) — формат тексту
  sheet.getRange(3, 9, lastRow - 2, 2).setNumberFormat('@STRING@');

  // Перезаписати значення як рядки
  const vals = sheet.getRange(3, 9, lastRow - 2, 2).getValues();
  const fixed = vals.map(row => row.map(cell => {
    if (!cell) return '';
    // Якщо це Date або число — конвертуємо в HH:mm
    if (cell instanceof Date) {
      return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'HH:mm');
    }
    if (typeof cell === 'number' && cell > 0 && cell < 1) {
      // Частка доби → HH:mm
      const totalMin = Math.round(cell * 24 * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
    }
    return String(cell);
  }));

  sheet.getRange(3, 9, lastRow - 2, 2).setValues(fixed);
  SpreadsheetApp.getUi().alert('✅ Формат часу виправлено!');
}

// Перебудувати всі міні-дашборди на аркушах закріплень
function rebuildMiniDashboards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const assignments = ['Школа','На виїзд','Sting','Симулятор','Інше','Майстерня','Літак'];
  let done = 0;
  assignments.forEach(name => {
    const sheet = getSheet(ss, name);
    if (sheet) {
      // Очистити старий дашборд (стовпці K-U)
      const lr = sheet.getLastRow();
      if (lr > 0) sheet.getRange(1, 11, Math.max(lr, 50), 12).clear();
      buildMiniDashboard(sheet, name);
      done++;
    }
  });
  SpreadsheetApp.getUi().alert('✅ Міні-дашборди оновлено для ' + done + ' аркушів');
}

function refreshDashboard() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Дашборд');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Аркуш "Дашборд" не знайдено.');
    return;
  }
  // Формули оновлюються автоматично — примусово перераховуємо NOW()
  sheet.getRange('A2').setFormula('="⏱ Оновлено: "&TEXT(NOW();"DD.MM.YYYY о HH:MM")');
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('✅ Дашборд оновлено');
}

// ============================================================
// ВИДАЛЕННЯ — СПОСІБ 1: виділені рядки в таблиці
// ============================================================
function deleteSelectedRows() {
  const ui  = SpreadsheetApp.getUi();
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = ss.getSheetByName('Інвентар');
  const log = ss.getSheetByName('Журнал руху');

  if (!inv) { ui.alert('❌ Аркуш "Інвентар" не знайдено.'); return; }

  // Перевірити що ми на аркуші Інвентар
  if (ss.getActiveSheet().getName() !== 'Інвентар') {
    ui.alert('❌ Перейди на аркуш "Інвентар" і виділи рядки які хочеш видалити.');
    return;
  }

  const selection = inv.getActiveRange();
  if (!selection) { ui.alert('❌ Нічого не виділено.'); return; }

  const firstRow = selection.getRow();
  const lastRow  = selection.getLastRow();

  // Захист від видалення заголовків
  if (firstRow <= 2) {
    ui.alert('❌ Рядки 1-2 — заголовки, їх не можна видаляти.\nВиділи тільки рядки з даними (з 3-го і нижче).');
    return;
  }

  // Зібрати дані виділених рядків для підтвердження
  const numRows = lastRow - firstRow + 1;
  const rowData = inv.getRange(firstRow, 1, numRows, 8).getValues();

  // Фільтруємо тільки непорожні рядки з даними
  const toDelete = rowData
    .map((row, i) => ({ row: firstRow + i, id: String(row[0]), name: String(row[1]), assign: String(row[3]) }))
    .filter(r => r.id && r.id !== '');

  if (toDelete.length === 0) { ui.alert('❌ Серед виділених рядків немає записів з ID.'); return; }

  // Показати що буде видалено
  const preview = toDelete.map(r => '  • ' + r.id + ' — ' + r.name).join('\n');
  const confirm = ui.alert(
    '⚠️ Видалення ' + toDelete.length + ' предмет(ів)',
    'Будуть ВИДАЛЕНІ:\n\n' + preview + '\n\nЗаписи збережуться в Журналі руху.\nПродовжити?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // Причина
  const r2 = ui.prompt('🗑️ Причина видалення', 'Для всіх обраних предметів:', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const reason = r2.getResponseText().trim() || 'не вказано';

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const user  = apiUserEmail_() || '—';

  // Журнал для всіх
  toDelete.forEach(r => {
    if (log) log.appendRow([today, r.id, r.name, 'Видалення з обліку', r.assign, '—', user, '', reason]);
  });

  // Видаляємо з кінця щоб не зміщувались індекси
  const rowNums = toDelete.map(r => r.row).sort((a, b) => b - a);
  rowNums.forEach(rowNum => inv.deleteRow(rowNum));

  ui.alert('✅ Видалено ' + toDelete.length + ' предмет(ів).\nЗаписи збережено в Журналі руху.');
}

// ============================================================
// ВИДАЛЕННЯ — СПОСІБ 2: sidebar за ID (один або кілька)
// ============================================================
function openDeleteForm() {
  const html = HtmlService.createHtmlOutputFromFile('DeleteForm')
    .setTitle('🗑️ Видалення предметів')
    .setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Пошук предмета за ID — для sidebar
function lookupItemsForDelete(rawIds) {
  const inv = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Інвентар');
  if (!inv || inv.getLastRow() < 3) return [];

  const ids  = rawIds.map(id => id.trim()).filter(Boolean);
  const data = inv.getRange(3, 1, inv.getLastRow() - 2, 8).getValues();

  return ids.map(id => {
    const row = data.find(r => String(r[0]) === id);
    if (!row) return { id: id, found: false };
    return {
      id:     String(row[0]),
      name:   String(row[1]),
      type:   String(row[2]),
      assign: String(row[3]),
      status: String(row[4]),
      found:  true,
    };
  });
}

// Виконати видалення — викликається з DeleteForm.html
function deleteItemsByIds(ids, reason) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = ss.getSheetByName('Інвентар');
  const log = ss.getSheetByName('Журнал руху');
  if (!inv) throw new Error('Аркуш "Інвентар" не знайдено');

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const user  = apiUserEmail_() || '—';
  const deleted = [];
  const notFound = [];

  // Знайти всі рядки (збираємо перед видаленням)
  const allIds  = inv.getRange(3, COLS.ID, inv.getLastRow() - 2, 1).getValues().flat().map(String);
  const toDelete = [];

  ids.forEach(id => {
    const idx = allIds.indexOf(id);
    if (idx === -1) { notFound.push(id); return; }
    const row = idx + 3;
    toDelete.push({
      row,
      id,
      name:   inv.getRange(row, COLS.NAME).getValue(),
      assign: inv.getRange(row, COLS.ASSIGNMENT).getValue(),
    });
  });

  // Журнал
  toDelete.forEach(r => {
    if (log) log.appendRow([today, r.id, r.name, 'Видалення з обліку', r.assign, '—', user, '', reason || 'не вказано']);
    deleted.push(r.id + ' — ' + r.name);
  });

  // Видаляємо з кінця
  toDelete.map(r => r.row).sort((a, b) => b - a).forEach(row => inv.deleteRow(row));

  return { deleted, notFound };
}

// ============================================================
// БЕКАП
// ============================================================
const BACKUP_FOLDER = 'Інвентаризація — Бекапи';

function getBackupFolder() {
  const f = DriveApp.getFoldersByName(BACKUP_FOLDER);
  return f.hasNext() ? f.next() : DriveApp.createFolder(BACKUP_FOLDER);
}

function createBackup() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const folder = getBackupFolder();
  const stamp  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');

  // КРОК 1: Спочатку читаємо всі дані в пам'ять (до копіювання!)
  const FIXED_COLS = {
    'Інвентар':    8,
    'Журнал руху': 9,
    'Витратники':  10,
    'Списання':    8,
  };

  const json = {
    meta: {
      exportedAt:    new Date().toISOString(),
      spreadsheetId: ss.getId(),
      version:       '4.2',
    },
    sheets: {}
  };

  const stats = [];

  Object.entries(FIXED_COLS).forEach(([name, numCols]) => {
    // Використовуємо getSheet() — знаходить аркуш навіть якщо назва трохи відрізняється
    const sh = getSheet(ss, name);
    if (!sh) {
      json.sheets[name] = [];
      // Показати реальну назву для діагностики
      const allNames = ss.getSheets().map(s => s.getName()).join(', ');
      stats.push(name + ': ❌ не знайдено (є: ' + allNames + ')');
      return;
    }
    const lastRow = sh.getLastRow();
    if (lastRow < 3) {
      json.sheets[name] = [];
      stats.push(sh.getName() + ': 0 записів');
      return;
    }
    const headers = sh.getRange(2, 1, 1, numCols).getValues()[0];
    const rawData = sh.getRange(3, 1, lastRow - 2, numCols).getValues();
    const rows = [];
    rawData.forEach(row => {
      if (!row.some(cell => cell !== '' && cell !== null && cell !== undefined)) return;
      const obj = {};
      headers.forEach((header, i) => {
        if (!header) return;
        const val = row[i];
        obj[header] = val instanceof Date
          ? Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : (val === null || val === undefined ? '' : String(val));
      });
      rows.push(obj);
    });
    json.sheets[name] = rows;
    stats.push(sh.getName() + ': ' + rows.length + ' записів');
  });

  // КРОК 2: Зберегти JSON (це завжди працює)
  folder.createFile('[JSON] ' + stamp + '.json', JSON.stringify(json, null, 2), MimeType.PLAIN_TEXT);

  // КРОК 3: Експорт таблиці як XLSX через Sheets export URL
  // Це завжди працює без додаткових дозволів і без ліміту копій
  SpreadsheetApp.flush();

  let copyStatus = '';
  try {
    const ssId    = ss.getId();
    const token   = ScriptApp.getOAuthToken();
    const xlsxUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=xlsx';

    const response = UrlFetchApp.fetch(xlsxUrl, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() === 200) {
      const blob = response.getBlob().setName('[XLSX] ' + stamp + '.xlsx');
      folder.createFile(blob);
      copyStatus = '✅ XLSX-експорт збережено';
    } else {
      copyStatus = '⚠️ XLSX не збережено (код ' + response.getResponseCode() + ')';
    }
  } catch (e) {
    copyStatus = '⚠️ XLSX не збережено: ' + e.message;
  }

  SpreadsheetApp.getUi().alert(
    '✅ Бекап збережено!\n\n' +
    stats.join('\n') +
    '\n\n' + copyStatus +
    '\n\nПапка: ' + folder.getUrl()
  );
}
function listBackups() {
  const folder = getBackupFolder();
  const files  = folder.getFiles();
  const list   = [];
  while (files.hasNext()) list.push('• ' + files.next().getName());
  SpreadsheetApp.getUi().alert(
    list.length
      ? 'Бекапи (' + list.length + '):\n\n' + list.slice(-12).reverse().join('\n') + '\n\n' + folder.getUrl()
      : 'Бекапів ще немає.'
  );
}

function restoreFromJson() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('♻️ Перезапише дані! Продовжити?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const r = ui.prompt('Посилання на JSON-файл у Drive:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const match = r.getResponseText().trim().match(/[-\w]{25,}/);
  if (!match) { ui.alert('❌ Невірне посилання'); return; }
  let json;
  try { json = JSON.parse(DriveApp.getFileById(match[0]).getBlob().getDataAsString()); }
  catch (e) { ui.alert('❌ ' + e.message); return; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(json.sheets || {}).forEach(([name, rows]) => {
    const sh = ss.getSheetByName(name);
    if (!sh || !rows.length) return;
    const headers = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
    if (sh.getLastRow() >= 3)
      sh.getRange(3, 1, sh.getLastRow() - 2, sh.getLastColumn()).clearContent();
    sh.getRange(3, 1, rows.length, headers.length)
      .setValues(rows.map(obj => headers.map(h => obj[h] || '')));
  });
  ui.alert('✅ Відновлено!');
}

function setupAutoBackup() {
  const ui = SpreadsheetApp.getUi();
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'createBackup')) {
    ui.alert('Автобекап вже налаштований.'); return;
  }
  const r = ui.prompt('О котрій годині щодня? (0-23):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const h = parseInt(r.getResponseText().trim(), 10);
  if (isNaN(h) || h < 0 || h > 23) { ui.alert('❌ Невірна година'); return; }
  ScriptApp.newTrigger('createBackup').timeBased().everyDays(1).atHour(h).create();
  ui.alert('✅ Автобекап о ' + h + ':00 щодня');
}

function removeAutoBackup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'createBackup')
    .forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getUi().alert('✅ Автобекап вимкнено');
}

// Авторизація UrlFetchApp — запусти один раз щоб дати дозвіл
function authorizeUrlFetch() {
  const ui = SpreadsheetApp.getUi();
  try {
    const token = ScriptApp.getOAuthToken();
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const url   = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
    const resp  = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() === 200) {
      ui.alert('✅ Дозвіл надано! XLSX-експорт працює.\nТепер бекап зберігатиме і XLSX-файл.');
    } else {
      ui.alert('⚠️ Статус: ' + resp.getResponseCode() + '\n' + resp.getContentText().substring(0, 200));
    }
  } catch (e) {
    ui.alert('❌ ' + e.message);
  }
}

// Діагностика — показує назви всіх аркушів
function diagSheetNames() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const names = ss.getSheets().map(s => '"' + s.getName() + '"').join('\n');
  SpreadsheetApp.getUi().alert('Аркуші в таблиці:\n\n' + names);
}

// Перестворити конкретний аркуш (видалити і створити заново)
function recreateMovementLog() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (ui.alert('Видалити і перестворити "Журнал руху"?\n\nДані журналу будуть втрачені.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  const existing = ss.getSheetByName('Журнал руху');
  if (existing) ss.deleteSheet(existing);

  createMovementLogSheet(ss);
  ui.alert('✅ "Журнал руху" перестворено');
}

// Додати відсутні аркуші без перебудови всієї системи
function rebuildNamesReference() {
  const ui  = SpreadsheetApp.getUi();
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const inv = getSheet(ss, 'Інвентар');
  const ref = getSheet(ss, 'Довідник назв');

  if (!inv || !ref) {
    ui.alert('Аркуші не знайдено. Спочатку запусти Додати відсутні аркуші.');
    return;
  }

  // Зчитати існуючі пари тип+назва з довідника
  const lastRefRow = ref.getLastRow();
  const existing = new Set();
  if (lastRefRow >= 3) {
    ref.getRange(3, 1, lastRefRow - 2, 2).getValues().forEach(row => {
      const code = String(row[0]).trim();
      const name = String(row[1]).trim();
      if (code && name) existing.add(code + '|||' + name);
    });
  }

  // Зчитати TYPE і NAME з Інвентарю окремо
  const lastInvRow = inv.getLastRow();
  if (lastInvRow < 3) { ui.alert('Інвентар порожній'); return; }

  const typeData = inv.getRange(3, COLS.TYPE, lastInvRow - 2, 1).getValues().flat();
  const nameData = inv.getRange(3, COLS.NAME, lastInvRow - 2, 1).getValues().flat();
  const toAdd = [];

  typeData.forEach((rawType, i) => {
    const typeVal = String(rawType || '').trim();
    const name    = String(nameData[i] || '').trim();
    if (!typeVal || !name) return;
    const code = typeVal.split(' ')[0];
    const key  = code + '|||' + name;
    if (!existing.has(key)) {
      existing.add(key);
      toAdd.push([code, name, '']);
    }
  });

  if (toAdd.length > 0) {
    ref.getRange(ref.getLastRow() + 1, 1, toAdd.length, 3).setValues(toAdd);
  }

  // Оновити dropdown у колонці Тип в Інвентарі
  inv.getRange(3, COLS.TYPE, 500, 1).clearDataValidations();
  inv.getRange(3, COLS.TYPE, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(TYPE_LIST, true)
      .setAllowInvalid(false).build()
  );

  // Оновити критерії R на дашборді
  const dash = getSheet(ss, 'Дашборд');
  if (dash) {
    TYPE_LIST.forEach((typeVal, i) => {
      const r = 6 + i;
      const label = typeVal.includes(' — ') ? typeVal.split(' — ')[1] : typeVal;
      dash.getRange(r, 18).setValue(typeVal);
      dash.getRange(r, 7).setValue(label);
    });
  }

  ui.alert('Довідник оновлено! Додано: ' + toAdd.length + ' записів.');
}

function recreateDashboard() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existing = getSheet(ss, 'Дашборд');
  if (existing) ss.deleteSheet(existing);
  createDashboard(ss);
  ui.alert('Дашборд перестворено!');
}

// ============================================================
// SINOTRACK — ТРЕКЕРИ
// ============================================================
function openFrequencyForm() {
  const html = HtmlService.createHtmlOutputFromFile('FrequencyForm')
    .setTitle('📻 Частоти')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Та сама карта частот але в широкому modal діалозі (на весь екран)
function openFrequencyModal() {
  const html = HtmlService.createHtmlOutputFromFile('FrequencyForm')
    .setWidth(1400)
    .setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, '📻 Карта частот');
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

function openFlightLogModal() {
  const html = HtmlService.createHtmlOutputFromFile('FlightLogForm').setWidth(1400).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, '✈️ Журнал польоту');
}

function openSinotrackModal() {
  const html = HtmlService.createHtmlOutputFromFile('SinotrackForm').setWidth(1400).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, '📡 Sinotrack');
}

function openSinotrackForm() {
  const html = HtmlService.createHtmlOutputFromFile('SinotrackForm')
    .setTitle('📡 Sinotrack')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openFlightLogForm() {
  const html = HtmlService.createHtmlOutputFromFile('FlightLogForm')
    .setTitle('✈️ Журнал польоту')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
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

// Додати трекер
// Поточний ISO timestamp
function nowTS() { return new Date().toISOString(); }

// Виконати fn під глобальним локом скрипта — захист від дублікатів
// при паралельних викликах (подвійний клік, два користувачі одночасно)
function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

// Записати timestamp у вказану колонку рядка
function touchSinotrack(sheet, row) { sheet.getRange(row, 9).setValue(nowTS()); }
function touchSim(sheet, row) { sheet.getRange(row, 6).setValue(nowTS()); }
// Мітка часу зміни примітки (окрема від рядкової — щоб синк не губив примітки)
function touchSinotrackNote(sheet, row) { sheet.getRange(row, 10).setValue(nowTS()); }
function touchFlightNote(sheet, row) { sheet.getRange(row, 18).setValue(nowTS()); }

function addSinotrack(data) {
  return withScriptLock(function() {
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
    data.simContact || '', data.simNumber || '', '', data.imei || '', data.note || '', nowTS(),
    data.note ? nowTS() : '']);
  return newId;
  });
}

// Додати SIM-карту
function addSim(data) {
  return withScriptLock(function() {
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
  });
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
  if (note) { sheet.getRange(row, 8).setValue(note); touchSinotrackNote(sheet, row); }
  touchSinotrack(sheet, row);
  return { id, status };
}

// ============================================================
// ЖУРНАЛ ПОЛЬОТУ
// ============================================================
function getFlightList() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return [];
  return sheet.getRange(3, 1, sheet.getLastRow() - 2, 22).getValues()
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
      equip:        String(row[18] || ''), // col S — Спорядження екіпажу (щогли, екрани…)
      main:         String(row[19] || ''), // col T — Головний відповідальний (OP-ID)
      members:      String(row[20] || ''), // col U — Члени екіпажу (OP-ID через |)
      crewName:     String(row[21] || ''), // col V — Назва екіпажу
    }));
}

// Почати виліт. data.token (опційно): якщо переданий — зліт фіксує
// тільки член екіпажу data.crew (головний або додатковий).
function startFlight(data) {
  if (data && data.token) {
    const p = authSession(data.token);
    if (!p) throw new Error('Сесія завершилась — увійди знову');
    const crew = findPersonCrew(p.id);
    if (!crew || crew.crewId !== String(data.crew)) {
      throw new Error('Фіксувати зліт може тільки член екіпажу ' + data.crew);
    }
    if (!data.pilot) data.pilot = p.callsign;
  }
  return withScriptLock(function() {
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

  const creatorEmail = apiUserEmail_() || '';
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
  if (data.note) touchFlightNote(sheet, insertedRow);
  // Захист не ставимо тут — рядок ще активний (Кінець порожній)
  const row = sheet.getLastRow();
  sheet.getRange(row, 1, 1, 16)
    .setBackground(row % 2 === 0 ? COLORS.altRow : COLORS.white);

  return { id: newId, start: now };
  });
}

// Отримати список екіпажів
function getCrewList() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return [];
  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 22).getValues();
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
        equip:   String(r[18] || ''),  // col S — Спорядження
        main:    String(r[19] || ''),  // col T — Головний (OP-ID)
        members: String(r[20] || ''),  // col U — Члени (OP-ID через |)
        crewName: String(r[21] || ''), // col V — Назва
      };
    }
  });
  return Object.values(crews);
}

// Створити екіпаж (зберігається як рядок з порожнім start/end)
function createCrew(data) {
  return withScriptLock(function() {
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
  const email  = apiUserEmail_() || '';
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
  const newRow = sheet.getLastRow();
  if (data.note) touchFlightNote(sheet, newRow);
  // S:Спорядження, T:Головний, U:Члени, V:Назва, W:_TS_CREW
  sheet.getRange(newRow, 19, 1, 5).setValues([[
    data.equip || '', data.main || '', data.members || '', data.crewName || '', nowTS()
  ]]);
  return crewId;
  });
}

// Оновити екіпаж. token (опційно): якщо переданий — зміну може робити
// тільки головний відповідальний цього екіпажу (адмін працює без токена).
function updateCrew(crewId, data, token) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet) throw new Error('Журнал польоту не знайдено');
  if (token !== undefined && token !== null && token !== '') {
    const p = authSession(token);
    if (!p) throw new Error('Сесія завершилась — увійди знову');
    const crew = findPersonCrew(p.id);
    // Головний — свій екіпаж; право «Екіпажі» — будь-який
    if (!apiRight_('crew') && (!crew || crew.crewId !== crewId || !crew.isMain)) {
      throw new Error('Змінювати екіпаж може тільки його головний відповідальний');
    }
  }
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
  if (data.equip   !== undefined) sheet.getRange(row, 19).setValue(data.equip);  // col S — Спорядження
  if (data.main    !== undefined) sheet.getRange(row, 20).setValue(data.main);   // col T — Головний
  if (data.members !== undefined) sheet.getRange(row, 21).setValue(data.members);// col U — Члени
  if (data.crewName!== undefined) sheet.getRange(row, 22).setValue(data.crewName);// col V — Назва
  sheet.getRange(row, 23).setValue(nowTS()); // col W — _TS_CREW: визначення екіпажу оновлено
  return { id: crewId };
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
  const currentEmail  = apiUserEmail_() || '';
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
  const user  = apiUserEmail_() || '';
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
  if (finalNote) { sheet.getRange(row, 13).setValue(finalNote); touchFlightNote(sheet, row); } // col M

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

// ============================================================
// СТВОРЕННЯ АРКУШІВ SINOTRACK І ПОЛЬОТУ
// ============================================================
function createSinotrackSheet(ss) {
  const sheet = ss.insertSheet('Sinotrack');
  const headers = ['ID','Модель','Статус','SIM-контакт','SIM-номер','Прив\'язка до борту','IMEI','Примітка','_TS','_TS_NOTE'];
  const widths  = [90, 160, 100, 140, 130, 170, 150, 200, 10, 10];

  sheet.getRange('A1:H1').merge()
    .setValue('📡 SINOTRACK — GPS ТРЕКЕРИ')
    .setBackground('#1a3a5c').setFontColor('#fff')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);
  sheet.getRange(2, 1, 1, 10).setValues([headers])
    .setBackground('#2e6da4').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 28);
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(2);

  sheet.getRange('C3:C200').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Робочий','Зламаний','Втрачений'], true)
      .setAllowInvalid(false).build()
  );

  const statusRules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Робочий')
      .setBackground('#d4edda').setFontColor('#155724').setRanges([sheet.getRange('C3:C200')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Зламаний')
      .setBackground('#f8d7da').setFontColor('#721c24').setRanges([sheet.getRange('C3:C200')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Втрачений')
      .setBackground('#3d0000').setFontColor('#ff9999').setRanges([sheet.getRange('C3:C200')]).build(),
  ];
  sheet.setConditionalFormatRules(statusRules);
  applyAltRows(sheet, 3, 100, 8);
  sheet.hideColumns(9); // _TS timestamp
  sheet.hideColumns(10); // _TS_NOTE timestamp примітки
}

function createSimSheet(ss) {
  const sheet = ss.insertSheet('SIM-карти');
  const headers = ['ID','Контакт','Номер','Статус','Прив\'язка до трекера','_TS'];
  const widths  = [80, 160, 140, 100, 160, 10];

  sheet.getRange('A1:E1').merge()
    .setValue('📱 SIM-КАРТИ')
    .setBackground('#1a3a5c').setFontColor('#fff')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);
  sheet.getRange(2, 1, 1, 6).setValues([headers])
    .setBackground('#2e6da4').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 28);
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(2);

  sheet.getRange('D3:D200').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Активна','Заблокована','Втрачена','Невідомо'], true)
      .setAllowInvalid(true).build()
  );
  applyAltRows(sheet, 3, 100, 5);
  sheet.hideColumns(6); // _TS timestamp
}

function createFlightLogSheet(ss) {
  const sheet = ss.insertSheet('Журнал польоту');
  const headers = ['ID вильоту','Дата','Екіпаж','Наземна станція','Борти','Bind фраза',
    'Відповідальна особа','Sinotrack','Трекер ОК','Початок','Кінець','Статус','Примітка','Автор',
    'Відеосистема','Частота','Резервні VTX','_TS_NOTE','Спорядження','Головний','Члени','Назва','_TS_CREW'];
  const widths  = [100,100,120,160,180,130,140,120,90,80,80,100,200,180,130,90,180,10,160,90,180,110,10];

  sheet.getRange('A1:Q1').merge()
    .setValue('✈️ ЖУРНАЛ ПОЛЬОТУ')
    .setBackground('#1a3a5c').setFontColor('#fff')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);
  sheet.getRange(2, 1, 1, 23).setValues([headers])
    .setBackground('#2e6da4').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(2, 28);
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(2);
  sheet.hideColumns(18); // _TS_NOTE timestamp примітки
  sheet.hideColumns(23); // _TS_CREW timestamp визначення екіпажу

  // Форматуємо колонки часу як текст
  sheet.getRange('J3:K500').setNumberFormat('@STRING@');

  sheet.getRange('L3:L500').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Активний','Завершено','Перерваний'], true)
      .setAllowInvalid(false).build()
  );

  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Активний')
      .setBackground('#fff3cd').setFontColor('#856404').setRanges([sheet.getRange('L3:L500')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Завершено')
      .setBackground('#d4edda').setFontColor('#155724').setRanges([sheet.getRange('L3:L500')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Перерваний')
      .setBackground('#f8d7da').setFontColor('#721c24').setRanges([sheet.getRange('L3:L500')]).build(),
  ];
  sheet.setConditionalFormatRules(rules);
  applyAltRows(sheet, 3, 200, 12);
  sheet.protect().setDescription('Журнал польоту — не редагуй вручну').setWarningOnly(true);
}

// ============================================================
// ЗАХИСТ РЯДКІВ
// ============================================================

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

// Зняти захист з конкретного рядка (для синхронізації)
function unprotectRow(sheet, rowNum) {
  try {
    sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => {
      const r = p.getRange();
      if (r.getRow() === rowNum) p.remove();
    });
  } catch(e) {
    Logger.log('unprotectRow error: ' + e);
  }
}

// Захистити весь аркуш крім заголовків
function protectSheetExceptHeaders(sheet, description) {
  try {
    // Видалити старі захисти
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
    const p = sheet.protect();
    p.setDescription(description);
    p.setWarningOnly(false);
    // Залишити заголовки (рядки 1-2) вільними
    p.setUnprotectedRanges([sheet.getRange('A1:Z2')]);
    const me = Session.getEffectiveUser();
    p.addEditor(me);
    p.removeEditors(p.getEditors().filter(e => e.getEmail() !== me.getEmail()));
  } catch(e) {
    Logger.log('protectSheet error: ' + e);
  }
}

// Захистити Sinotrack і SIM-карти в таблиці
function protectSinotrackSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const snt = getSheet(ss, 'Sinotrack');
  const sim = getSheet(ss, 'SIM-карти');
  if (snt) protectSheetExceptHeaders(snt, 'Sinotrack — редагуй через меню Sinotrack');
  if (sim) protectSheetExceptHeaders(sim, 'SIM-карти — редагуй через меню Sinotrack');
  SpreadsheetApp.getUi().alert('✅ Захист Sinotrack та SIM-карт встановлено!');
}

// ============================================================
// ПЕРСОНАЛ ТА АВТОРИЗАЦІЯ (відповідальні особи)
// ============================================================
// Аркуш «Персонал»: ID | Позивний | Ім'я | Роль | Статус | Пароль (сіль$хеш) | _TS | Адмін | Інвентар | Екіпажі | Інформація
// Ролі — декоративні мітки; права визначає членство в екіпажі (головний/додатковий).
// «Адмін» (чекбокс) — права адміністратора у PWA; ставиться адміном у застосунку або в аркуші.
// «Інвентар» / «Екіпажі» (чекбокси) — гранульовані права: редагування інвентарю
// (статуси, додавання, закріплення, примітки, витратники) та редагування екіпажів
// (склад, створення, особовий склад). Роздає тільки адмін; адмін має всі права.
const PERSONNEL_COLS = 11;
const PERSON_ROLES = ['Пілот','Штурман','Технік','Сапер','Оператор','Командир'];

function ensurePersonnelSheet(ss) {
  const s = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getSheet(s, 'Персонал');
  if (!sheet) {
    sheet = s.insertSheet('Персонал');
    sheet.getRange('A1:E1').merge().setValue('👤 ПЕРСОНАЛ — ВІДПОВІДАЛЬНІ ОСОБИ')
      .setBackground('#1a3a5c').setFontColor('#fff').setFontSize(13).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.setRowHeight(1, 38);
    sheet.getRange(2, 1, 1, PERSONNEL_COLS)
      .setValues([['ID','Позивний','Ім\'я','Роль','Статус','Пароль','_TS','Адмін','Інвентар','Екіпажі','Інформація']])
      .setBackground('#2e6da4').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(2);
    [90, 140, 180, 110, 110, 10, 10, 70, 90, 90, 100].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
    try { sheet.hideColumns(6, 2); } catch(e) {} // пароль і _TS приховані
  }
  // Міграція: чекбокс-колонки для аркушів, створених раніше
  [[8, 'Адмін', 70], [9, 'Інвентар', 90], [10, 'Екіпажі', 90], [11, 'Інформація', 100]].forEach(([col, title, width]) => {
    if (String(sheet.getRange(2, col).getValue()).trim() === title) return;
    sheet.getRange(2, col).setValue(title)
      .setBackground('#2e6da4').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setColumnWidth(col, width);
    try {
      sheet.getRange(3, col, 300, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireCheckbox().build());
    } catch(e) {}
  });
  return sheet;
}

// Значення чекбокса з аркуша (true або текстові варіанти)
function chk_(v) { return v === true || /^(true|так|✓|1)$/i.test(String(v || '').trim()); }

function makeSalt() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function hashPassword(pw, salt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + String(pw), Utilities.Charset.UTF_8)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function readPersonnel() {
  const sheet = ensurePersonnelSheet();
  if (sheet.getLastRow() < 3) return [];
  return sheet.getRange(3, 1, sheet.getLastRow() - 2, PERSONNEL_COLS).getValues()
    .map((r, i) => ({ row: 3 + i,
      id: String(r[0]).trim(), callsign: String(r[1]).trim(), name: String(r[2]).trim(),
      role: String(r[3]).trim(), status: String(r[4]).trim(), pass: String(r[5]).trim(),
      admin: chk_(r[7]), rightInv: chk_(r[8]), rightCrew: chk_(r[9]), rightInfo: chk_(r[10]) }))
    .filter(p => p.id && p.status !== 'Видалений');
}

// Екіпаж особи: активні CRW-рядки Журналу польоту (Головний col 20, Члени col 21)
function findPersonCrew(opId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet(ss, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3 || !opId) return null;
  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 22).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = String(r[0]).trim();
    if (!id.startsWith('CRW-')) continue;
    if (String(r[11]).trim() !== 'Активний') continue;
    const main = String(r[19] || '').trim();
    const members = String(r[20] || '').split('|').map(s => s.trim()).filter(Boolean);
    if (main === opId) return { crewId: id, crewName: String(r[21] || '').trim(), isMain: true };
    if (members.indexOf(opId) !== -1) return { crewId: id, crewName: String(r[21] || '').trim(), isMain: false };
  }
  return null;
}

// Публічна інформація про особу (без пароля)
function personPublic(p) {
  const crew = findPersonCrew(p.id);
  return { id: p.id, callsign: p.callsign, name: p.name, role: p.role, status: p.status,
    crewId: crew ? crew.crewId : '', crewName: crew ? crew.crewName : '',
    isMain: !!(crew && crew.isMain), admin: !!p.admin,
    // Гранульовані права: rightInv/rightCrew — чекбокси, canInv/canCrew — фактичні
    // права (адмін має все). Фронтенд дивиться на canInv/canCrew.
    rightInv: !!p.rightInv, rightCrew: !!p.rightCrew, rightInfo: !!p.rightInfo,
    canInv: !!(p.admin || p.rightInv), canCrew: !!(p.admin || p.rightCrew),
    canInfo: !!(p.admin || p.rightInfo) };
}

// Список персоналу для сторінки екіпажів (доступний після входу або адміну)
function getPersonnelList() {
  return readPersonnel().map(p => personPublic(p));
}

// ── Сесії: токен у Script Properties, 30 днів (ковзне продовження) ──
// Вхід на пристрої робиться один раз; поки людина користується застосунком,
// сесія продовжується сама. Вихід або 30 днів простою — токен вмирає.
const AUTH_SESSION_DAYS = 30;

function authLogin(callsign, password) {
  callsign = String(callsign || '').trim();
  const p = readPersonnel().find(x => x.callsign.toLowerCase() === callsign.toLowerCase());
  if (!p) throw new Error('Невірний позивний або пароль');
  const parts = p.pass.split('$');
  if (parts.length !== 2 || hashPassword(password, parts[0]) !== parts[1]) {
    throw new Error('Невірний позивний або пароль');
  }
  const token = Utilities.getUuid();
  authPurgeExpired_();
  PropertiesService.getScriptProperties().setProperty('auth_' + token,
    JSON.stringify({ op: p.id, exp: Date.now() + AUTH_SESSION_DAYS * 24 * 3600 * 1000 }));
  return { token: token, op: personPublic(p) };
}

function authSession(token) {
  if (!token) return null;
  const props = PropertiesService.getScriptProperties();
  const key = 'auth_' + String(token);
  const raw = props.getProperty(key);
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch (e) { props.deleteProperty(key); return null; }
  if (!s || !s.op || !s.exp || s.exp < Date.now()) { props.deleteProperty(key); return null; }
  // Ковзне продовження: якщо лишилось менше половини строку — продовжуємо
  if (s.exp - Date.now() < AUTH_SESSION_DAYS * 12 * 3600 * 1000) {
    s.exp = Date.now() + AUTH_SESSION_DAYS * 24 * 3600 * 1000;
    props.setProperty(key, JSON.stringify(s));
  }
  return readPersonnel().find(x => x.id === s.op) || null;
}

// Прибрати протухлі сесії (викликається при кожному вході)
function authPurgeExpired_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = Date.now();
  Object.keys(all).forEach(k => {
    if (k.indexOf('auth_') !== 0) return;
    try {
      const s = JSON.parse(all[k]);
      if (!s.exp || s.exp < now) props.deleteProperty(k);
    } catch (e) { props.deleteProperty(k); }
  });
}

function authWhoAmI(token) {
  const p = authSession(token);
  return p ? personPublic(p) : null;
}

function authLogout(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('auth_' + String(token));
  return { ok: true };
}

function authChangePassword(token, oldPw, newPw) {
  const p = authSession(token);
  if (!p) throw new Error('Сесія завершилась — увійди знову');
  const parts = p.pass.split('$');
  if (parts.length !== 2 || hashPassword(oldPw, parts[0]) !== parts[1]) throw new Error('Старий пароль невірний');
  if (!newPw || String(newPw).length < 4) throw new Error('Новий пароль закороткий (мінімум 4 символи)');
  const salt = makeSalt();
  const sheet = ensurePersonnelSheet();
  sheet.getRange(p.row, 6).setValue(salt + '$' + hashPassword(newPw, salt));
  sheet.getRange(p.row, 7).setValue(nowTS());
  return { ok: true };
}

// Особа може змінити власну декоративну роль
function authChangeMyRole(token, role) {
  const p = authSession(token);
  if (!p) throw new Error('Сесія завершилась — увійди знову');
  const sheet = ensurePersonnelSheet();
  sheet.getRange(p.row, 4).setValue(String(role || '').trim());
  sheet.getRange(p.row, 7).setValue(nowTS());
  return personPublic(readPersonnel().find(x => x.id === p.id));
}

// Змінити роль особи: сам собі, головний — членам свого екіпажу, адмін — будь-кому
function setPersonRole(opId, role, token) {
  const sheet = ensurePersonnelSheet();
  const target = readPersonnel().find(x => x.id === opId);
  if (!target) throw new Error('Не знайдено: ' + opId);
  let allowed = false;
  if (token) {
    const p = authSession(token);
    if (!p) throw new Error('Сесія завершилась — увійди знову');
    if (p.id === opId) allowed = true;
    else if (apiRight_('crew')) allowed = true;
    else {
      const crew = findPersonCrew(p.id);
      const tCrew = findPersonCrew(opId);
      if (crew && crew.isMain && tCrew && tCrew.crewId === crew.crewId) allowed = true;
    }
  } else {
    const email = apiUserEmail_() || '';
    if (isAdmin(email)) allowed = true;
  }
  if (!allowed) throw new Error('Немає прав змінювати роль цієї особи');
  sheet.getRange(target.row, 4).setValue(String(role || '').trim());
  sheet.getRange(target.row, 7).setValue(nowTS());
  return { id: opId, role: role };
}

// Змінити статус особи: сам собі, головний — членам свого екіпажу, адмін — будь-кому
function setPersonStatus(opId, status, token) {
  const sheet = ensurePersonnelSheet();
  const target = readPersonnel().find(x => x.id === opId);
  if (!target) throw new Error('Не знайдено: ' + opId);
  let allowed = false;
  if (token) {
    const p = authSession(token);
    if (!p) throw new Error('Сесія завершилась — увійди знову');
    if (p.id === opId) allowed = true;
    else if (apiRight_('crew')) allowed = true;
    else {
      const crew = findPersonCrew(p.id);
      const tCrew = findPersonCrew(opId);
      if (crew && crew.isMain && tCrew && tCrew.crewId === crew.crewId) allowed = true;
    }
  } else {
    const email = apiUserEmail_() || '';
    if (isAdmin(email)) allowed = true;
  }
  if (!allowed) throw new Error('Немає прав змінювати статус цієї особи');
  sheet.getRange(target.row, 5).setValue(String(status || '').trim());
  sheet.getRange(target.row, 7).setValue(nowTS());
  return { id: opId, status: status };
}

// ── Гранульовані права API-користувача ──
// 'inv' — редагувати інвентар/витратники, 'crew' — редагувати екіпажі/О.С.
// Діє лише в API-контексті (PWA): __API_CTX ставить doPost в ApiEndpoint.gs.
// У sidebar-контексті (Google-акаунт) прав немає — там вирішує isAdmin(email).
function apiRight_(kind) {
  if (typeof __API_CTX === 'undefined' || !__API_CTX || !__API_CTX.person) return false;
  const p = __API_CTX.person;
  if (p.admin) return true;
  return kind === 'inv' ? !!p.rightInv : kind === 'crew' ? !!p.rightCrew : kind === 'info' ? !!p.rightInfo : false;
}

// ── Адміністрування персоналу ──
// Адмін — усе; право «Екіпажі» — керування О.С. без ескалації (див. adminSavePerson).
function adminGuard() {
  const email = apiUserEmail_() || '';
  if (isAdmin(email) || apiRight_('crew')) return;
  throw new Error('Потрібне право «Екіпажі» або права адміністратора');
}

function adminListPersonnel() {
  adminGuard();
  return readPersonnel().map(p => personPublic(p));
}

// Створити/оновити особу. d = {id?, callsign, name, role, status, newPassword?,
// admin?, rightInv?, rightCrew?}. Захист від ескалації: право «Екіпажі» дозволяє
// вести О.С., але НЕ роздавати права/адмінку й НЕ чіпати адміністраторів —
// це може тільки справжній адмін.
function adminSavePerson(d) {
  adminGuard();
  const fullAdmin = isAdmin(apiUserEmail_() || '');
  if (!fullAdmin) { delete d.admin; delete d.rightInv; delete d.rightCrew; delete d.rightInfo; }
  return withScriptLock(function() {
    const sheet = ensurePersonnelSheet();
    const list = readPersonnel();
    if (d.id) {
      const p = list.find(x => x.id === d.id);
      if (!p) throw new Error('Не знайдено: ' + d.id);
      if (p.admin && !fullAdmin) throw new Error('Редагувати адміністратора може тільки адмін');
      if (d.callsign !== undefined) {
        const cs = String(d.callsign).trim();
        if (!cs) throw new Error('Позивний не може бути порожнім');
        const dup = list.find(x => x.id !== d.id && x.callsign.toLowerCase() === cs.toLowerCase());
        if (dup) throw new Error('Позивний вже зайнятий: ' + cs);
        sheet.getRange(p.row, 2).setValue(cs);
      }
      if (d.name   !== undefined) sheet.getRange(p.row, 3).setValue(d.name);
      if (d.role   !== undefined) sheet.getRange(p.row, 4).setValue(d.role);
      if (d.status !== undefined) sheet.getRange(p.row, 5).setValue(d.status);
      if (d.admin  !== undefined) sheet.getRange(p.row, 8).setValue(!!d.admin);
      if (d.rightInv  !== undefined) sheet.getRange(p.row, 9).setValue(!!d.rightInv);
      if (d.rightCrew !== undefined) sheet.getRange(p.row, 10).setValue(!!d.rightCrew);
      if (d.rightInfo !== undefined) sheet.getRange(p.row, 11).setValue(!!d.rightInfo);
      if (d.newPassword) {
        const salt = makeSalt();
        sheet.getRange(p.row, 6).setValue(salt + '$' + hashPassword(d.newPassword, salt));
      }
      sheet.getRange(p.row, 7).setValue(nowTS());
      return { id: d.id };
    }
    // Нова особа
    const cs = String(d.callsign || '').trim();
    if (!cs) throw new Error('Вкажи позивний');
    if (!d.newPassword) throw new Error('Вкажи початковий пароль');
    const dup2 = list.find(x => x.callsign.toLowerCase() === cs.toLowerCase());
    if (dup2) throw new Error('Позивний вже зайнятий: ' + cs);
    let maxN = 0;
    // Рахуємо і «видалених», щоб ID не повторювались
    const sheetIds = sheet.getLastRow() >= 3
      ? sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().flat() : [];
    sheetIds.forEach(id => { const m = String(id).match(/OP-(\d+)/); if (m) maxN = Math.max(maxN, parseInt(m[1], 10)); });
    const newId = 'OP-' + String(maxN + 1).padStart(3, '0');
    const salt = makeSalt();
    sheet.appendRow([newId, cs, d.name || '', d.role || '', d.status || 'Активний',
      salt + '$' + hashPassword(d.newPassword, salt), nowTS(), !!d.admin, !!d.rightInv, !!d.rightCrew, !!d.rightInfo]);
    return { id: newId };
  });
}

// «Видалення» — tombstone-статус, щоб синхронізація не воскрешала запис
function adminDeletePerson(id) {
  adminGuard();
  const sheet = ensurePersonnelSheet();
  const p = readPersonnel().find(x => x.id === id);
  if (!p) throw new Error('Не знайдено: ' + id);
  if (p.admin && !isAdmin(apiUserEmail_() || '')) throw new Error('Видалити адміністратора може тільки адмін');
  sheet.getRange(p.row, 5).setValue('Видалений');
  sheet.getRange(p.row, 7).setValue(nowTS());
  return { ok: true };
}

// ============================================================
// СИНХРОНІЗАЦІЯ З ТАБЛИЦЕЮ ОПЕРАТОРІВ
// ============================================================
const OPERATOR_SS_KEY = 'operatorSpreadsheetId';

function getOperatorSsId() {
  return PropertiesService.getScriptProperties().getProperty(OPERATOR_SS_KEY) || '';
}

function setOperatorSsId(id) {
  PropertiesService.getScriptProperties().setProperty(OPERATOR_SS_KEY, id);
}

// Відкрити налаштування синхронізації
function openSyncForm() {
  const html = HtmlService.createHtmlOutputFromFile('SyncForm')
    .setTitle('🔄 Синхронізація таблиць')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSyncSettings() {
  return {
    operatorSsId:  getOperatorSsId(),
    currentSsId:   SpreadsheetApp.getActiveSpreadsheet().getId(),
    currentSsUrl:  SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  };
}

function saveSyncSettings(data) {
  setOperatorSsId(data.operatorSsId || '');
  return { ok: true };
}

// Встановити тригер синхронізації кожні 5 хвилин
function installSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncToOperators')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncToOperators')
    .timeBased().everyMinutes(5).create();

  return { ok: true };
}

function removeSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncToOperators')
    .forEach(t => ScriptApp.deleteTrigger(t));
  return { ok: true };
}

// Основна функція синхронізації
// Перестворити Журнал польоту в операторській таблиці
function rebuildOperatorFlightLog() {
  const opId = getOperatorSsId();
  if (!opId) throw new Error('Таблиця операторів не налаштована');
  const opSs = SpreadsheetApp.openById(opId);
  const existing = getSheet(opSs, 'Журнал польоту');
  if (existing) opSs.deleteSheet(existing);
  createFlightLogSheet(opSs);
  // Синхронізувати дані
  const mainSs = SpreadsheetApp.getActiveSpreadsheet();
  ensureNoteTsColumns(mainSs);
  ensureNoteTsColumns(opSs);
  pushSheet(mainSs, opSs, 'Журнал польоту', 23);
  SpreadsheetApp.getUi().alert('✅ Журнал польоту в операторській таблиці перестворено!');
}

function syncToOperators() {
  const opId = getOperatorSsId();
  if (!opId) return;

  try {
    const mainSs = SpreadsheetApp.getActiveSpreadsheet();
    const opSs   = SpreadsheetApp.openById(opId);

    // 0. Міграція: колонки міток часу приміток (_TS_NOTE)
    ensureNoteTsColumns(mainSs);
    ensureNoteTsColumns(opSs);

    // 1. Журнал польоту — merge в обидва боки по ID
    mergeFlightLog(mainSs, opSs);

    // 2. Sinotrack — merge статусів (беремо найновіший)
    mergeSinotrack(mainSs, opSs);

    // 3. Статуси бортів — оператори можуть змінювати
    mergeDroneStatuses(mainSs, opSs);

    // 4. SIM-карти — двосторонній merge по timestamp
    mergeSim(mainSs, opSs);

    // 5. Персонал (відповідальні особи) — двосторонній merge по timestamp
    // УВАГА: _TS — колонка 7 (PERSONNEL_COLS тепер 10, останні —
    // «Адмін», «Інвентар», «Екіпажі»)
    // Колонка 6 (хеш пароля) — secretCol: лишається лише в головній таблиці.
    // Вхід за позивним обслуговує API головної таблиці, тож операторській
    // паролі не потрібні. Якщо колись знадобиться вхід і там — прибрати [6]
    // не можна, треба виносити хеші зі стовпця у Script Properties.
    ensurePersonnelSheet(mainSs);
    ensurePersonnelSheet(opSs);
    mergeByTimestamp(mainSs, opSs, 'Персонал', PERSONNEL_COLS, 7, null, null, [6]);

    pushDashboard(mainSs, opSs);
    pushDronesForOps(mainSs, opSs); // завжди оновлюємо інвентар
    syncLostNotes(mainSs); // перенести деталі втрати в нотатки бортів

    Logger.log('Sync OK: ' + new Date().toISOString());
    return { ok: true, time: new Date().toISOString() };
  } catch(e) {
    Logger.log('Sync error: ' + e);
    throw e;
  }
}

// Merge Журналу польоту — додаємо нові рядки, не перезаписуємо існуючі
function mergeFlightLog(mainSs, opSs) {
  const mainSheet = getSheet(mainSs, 'Журнал польоту');
  const opSheet   = getSheet(opSs,   'Журнал польоту');
  if (!mainSheet || !opSheet) return;

  // Зібрати існуючі рядки основної (23 колонки: _TS_NOTE R, Спорядження S,
  // Головний T, Члени U, Назва V, _TS_CREW W)
  const mainIds = new Set();
  let mainRows = [];
  if (mainSheet.getLastRow() >= 3) {
    mainRows = mainSheet.getRange(3, 1, mainSheet.getLastRow() - 2, 23).getDisplayValues();
    mainRows.forEach(r => { const id = String(r[0]).trim(); if (id) mainIds.add(id); });
  }

  // Знайти нові рядки в операторській
  if (opSheet.getLastRow() >= 3) {
    const opData = opSheet.getRange(3, 1, opSheet.getLastRow() - 2, 23).getDisplayValues();
    opData.forEach(row => {
      const id = String(row[0]).trim();
      if (id && !mainIds.has(id)) {
        mainSheet.appendRow(row);
        mainIds.add(id);
      } else if (id && mainIds.has(id)) {
        // Оновити статус і час завершення якщо змінились
        const idx = mainRows.findIndex(r => String(r[0]).trim() === id);
        if (idx !== -1) {
          const mainRow = mainRows[idx];
          // Колонки: Кінець=K(11,idx10), Статус=L(12,idx11), Примітка=M(13,idx12), _TS_NOTE=R(18,idx17)
          // Оновлюємо кінець якщо в основній порожній
          if (String(row[10]) && !String(mainRow[10])) {
            mainSheet.getRange(3 + idx, 11).setValue(row[10]);
          }
          // Оновлюємо статус якщо оператор завершив (не Активний)
          if (String(row[11]) && String(row[11]) !== 'Активний' && String(mainRow[11]) === 'Активний') {
            mainSheet.getRange(3 + idx, 12).setValue(row[11]);
          }
          // Примітка: новіша (за _TS_NOTE) перемагає, щоб push не стирав операторську
          const opNote    = String(row[12] || '');
          const opNoteTs  = String(row[17] || '').trim();
          const mnNote    = String(mainRow[12] || '');
          const mnNoteTs  = String(mainRow[17] || '').trim();
          if (opNote !== mnNote) {
            const opNewer = opNoteTs && (!mnNoteTs || opNoteTs > mnNoteTs);
            // Без жодної мітки часу не губимо єдину наявну примітку
            const fillEmpty = !mnNote && opNote && !mnNoteTs && !opNoteTs;
            if (opNewer || fillEmpty) {
              mainSheet.getRange(3 + idx, 13).setValue(opNote);
              mainSheet.getRange(3 + idx, 18).setValue(opNoteTs || nowTS());
            }
          }
          // Визначення екіпажу (CRW-рядки): новіша сторона за _TS_CREW перемагає —
          // головний відповідальний редагує склад з операторської таблиці
          if (id.startsWith('CRW-')) {
            const opCrewTs = String(row[22] || '').trim();
            const mnCrewTs = String(mainRow[22] || '').trim();
            if (opCrewTs && (!mnCrewTs || opCrewTs > mnCrewTs)) {
              // D:наземка E:борти F:bind H:трекери O:система P:частота Q:резервні
              // S:спорядження T:головний U:члени V:назва W:_TS_CREW
              [[4,3],[5,4],[6,5],[8,7],[15,14],[16,15],[17,16],[19,18],[20,19],[21,20],[22,21],[23,22]]
                .forEach(([col, i]) => mainSheet.getRange(3 + idx, col).setValue(row[i]));
            }
          }
        }
      }
    });
  }

  // Push оновленого журналу назад в операторську
  pushSheet(mainSs, opSs, 'Журнал польоту', 23);
}

// Міграція: додати колонки, яких ще немає
// (мітки часу приміток, спорядження, головний/члени/назва екіпажу, прийняття обладнання)
function ensureNoteTsColumns(ss) {
  const fl = getSheet(ss, 'Журнал польоту');
  if (fl) {
    const flCols = [
      [18, '_TS_NOTE', true],
      [19, 'Спорядження', false],
      [20, 'Головний', false],
      [21, 'Члени', false],
      [22, 'Назва', false],
      [23, '_TS_CREW', true],
    ];
    flCols.forEach(([col, header, hidden]) => {
      if (String(fl.getRange(2, col).getValue()) !== header) {
        if (fl.getMaxColumns() < col) fl.insertColumnsAfter(fl.getMaxColumns(), col - fl.getMaxColumns());
        const cell = fl.getRange(2, col).setValue(header);
        if (hidden) { try { fl.hideColumns(col); } catch(e) {} }
        else cell.setBackground('#2e6da4').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
      }
    });
  }
  const snt = getSheet(ss, 'Sinotrack');
  if (snt && String(snt.getRange(2, 10).getValue()) !== '_TS_NOTE') {
    if (snt.getMaxColumns() < 10) snt.insertColumnsAfter(snt.getMaxColumns(), 10 - snt.getMaxColumns());
    snt.getRange(2, 10).setValue('_TS_NOTE');
    try { snt.hideColumns(10); } catch(e) {}
  }
  // Інвентар: колонки прийняття обладнання головним відповідальним
  const inv = getSheet(ss, 'Інвентар');
  if (inv) {
    const invCols = [
      [11, 'Прийнято', false],
      [12, 'Причина', false],
      [13, '_TS_ACCEPT', true],
    ];
    invCols.forEach(([col, header, hidden]) => {
      if (String(inv.getRange(2, col).getValue()) !== header) {
        if (inv.getMaxColumns() < col) inv.insertColumnsAfter(inv.getMaxColumns(), col - inv.getMaxColumns());
        const cell = inv.getRange(2, col).setValue(header);
        if (hidden) { try { inv.hideColumns(col); } catch(e) {} }
        else cell.setBackground('#2e6da4').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
      }
    });
  }
}

// Двосторонній merge по ID + timestamp (новіша версія перемагає).
// numCols — кількість колонок даних, tsCol — номер колонки timestamp (1-based).
// noteCol/noteTsCol (опційно) — примітка зливається окремо за власною міткою часу,
// щоб зміна примітки на одній таблиці не губилась через новіший рядок на іншій.
// secretCols (опційно) — номери колонок із таємницями (напр. хеші паролів).
// Такі колонки живуть ТІЛЬКИ в головній таблиці: значення завжди беруться
// з головної (операторська не може їх перезаписати) і при записі в
// операторську підставляється порожнє. Так секрет не розходиться по копіях.
function mergeByTimestamp(mainSs, opSs, sheetName, numCols, tsCol, noteCol, noteTsCol, secretCols) {
  const mainSheet = getSheet(mainSs, sheetName);
  const opSheet   = getSheet(opSs,   sheetName);
  if (!mainSheet || !opSheet) return;
  secretCols = secretCols || [];

  // Зняти захист з обох
  [mainSheet, opSheet].forEach(sh => {
    sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());
    sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  });

  function readRows(sheet) {
    if (sheet.getLastRow() < 3) return [];
    return sheet.getRange(3, 1, sheet.getLastRow() - 2, numCols).getValues();
  }

  const mainRows = readRows(mainSheet);
  const opRows   = readRows(opSheet);

  // Індекс по ID
  const mainMap = {}; mainRows.forEach((r, i) => { const id = String(r[0]).trim(); if (id) mainMap[id] = { row: r, idx: i }; });
  const opMap   = {}; opRows.forEach((r, i)   => { const id = String(r[0]).trim(); if (id) opMap[id]   = { row: r, idx: i }; });

  // Об'єднана множина ID
  const allIds = new Set([...Object.keys(mainMap), ...Object.keys(opMap)]);

  const merged = []; // фінальні рядки
  allIds.forEach(id => {
    const m = mainMap[id], o = opMap[id];
    if (m && !o) { merged.push(m.row); return; }
    if (!m && o) { merged.push(o.row); return; }
    // Обидва є — порівняти timestamp (tsCol-1 індекс)
    const mTs = String(m.row[tsCol - 1] || '');
    const oTs = String(o.row[tsCol - 1] || '');
    // Незворотній "Втрачений" для Sinotrack (статус col 3) / SIM (col 4)
    const winner = (oTs > mTs) ? o.row.slice() : m.row.slice();
    // Примітка зливається окремо — за власною міткою часу
    if (noteCol && noteTsCol) {
      const loser    = (oTs > mTs) ? m.row : o.row;
      const wNote    = String(winner[noteCol - 1] || '');
      const wNoteTs  = String(winner[noteTsCol - 1] || '').trim();
      const lNote    = String(loser[noteCol - 1] || '');
      const lNoteTs  = String(loser[noteTsCol - 1] || '').trim();
      if (lNote !== wNote) {
        if (lNoteTs && (!wNoteTs || lNoteTs > wNoteTs)) {
          winner[noteCol - 1]   = loser[noteCol - 1];
          winner[noteTsCol - 1] = loser[noteTsCol - 1];
        } else if (!wNote && lNote && !wNoteTs && !lNoteTs) {
          // Без жодної мітки часу — не губимо єдину наявну примітку
          winner[noteCol - 1] = loser[noteCol - 1];
        }
      }
    }
    // Таємні колонки не беруть участь у змаганні за timestamp:
    // головна таблиця — єдине джерело правди для них.
    secretCols.forEach(c => { winner[c - 1] = m.row[c - 1]; });
    merged.push(winner);
  });

  // Сортуємо по ID для стабільності
  merged.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  // Записати в обидві таблиці; в операторську — без таємних колонок
  const opRowsOut = secretCols.length
    ? merged.map(r => { const c = r.slice(); secretCols.forEach(i => { c[i - 1] = ''; }); return c; })
    : merged;
  [[mainSheet, merged], [opSheet, opRowsOut]].forEach(([sheet, rows]) => {
    if (sheet.getLastRow() >= 3) {
      sheet.getRange(3, 1, Math.max(sheet.getLastRow() - 2, 1), numCols).clearContent();
    }
    if (rows.length) {
      sheet.getRange(3, 1, rows.length, numCols).setValues(rows);
    }
  });

  // Відновити захист в операторській
  protectSheetExceptHeaders(opSheet, sheetName + ' — редагуй через меню');
}

// Merge Sinotrack — двосторонній по timestamp (col 9), примітка окремо (col 8 / _TS_NOTE col 10)
function mergeSinotrack(mainSs, opSs) {
  mergeByTimestamp(mainSs, opSs, 'Sinotrack', 10, 9, 8, 10);
}

// Merge SIM-карти — двосторонній по timestamp (col 6)
function mergeSim(mainSs, opSs) {
  mergeByTimestamp(mainSs, opSs, 'SIM-карти', 6, 6);
}

// Merge статусів бортів — критичні статуси з операторської перезаписують основну
// Пройти всі втрачені борти і проставити їм нотатки з деталей вильотів
function syncLostNotes(mainSs) {
  const inv = getSheet(mainSs, 'Інвентар');
  if (!inv || inv.getLastRow() < 3) return;
  const invData = inv.getRange(3, 1, inv.getLastRow() - 2, COLS.STATUS).getValues();

  invData.forEach((r, i) => {
    const id = String(r[0]).trim();
    const status = String(r[COLS.STATUS - 1]).trim();
    if (status !== 'Втрачений') return;
    const invRow = 3 + i;
    // Якщо нотатки ще нема — шукаємо в примітках вильотів
    const existingNote = inv.getRange(invRow, COLS.ID).getNote() || '';
    if (existingNote && existingNote.indexOf('ВТРАЧЕНО') !== -1) return; // вже є
    const lostNote = findLostNoteForDrone(mainSs, id);
    if (lostNote) {
      try { inv.getRange(invRow, COLS.ID).setNote(lostNote); } catch(e) { Logger.log('syncLostNotes: ' + e); }
    }
  });
}

// Знайти деталі втрати борту в примітці завершеного вильоту
function findLostNoteForDrone(mainSs, droneId) {
  const sheet = getSheet(mainSs, 'Журнал польоту');
  if (!sheet || sheet.getLastRow() < 3) return '';
  const rows = sheet.getRange(3, 1, sheet.getLastRow() - 2, 17).getValues();
  // Шукаємо вильоти цього борту з ВТРАЧЕНО в примітці (з кінця — найновіший)
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (String(r[0]).startsWith('CRW-')) continue;
    const drone = String(r[4]).trim();
    const note  = String(r[12] || '');
    if (drone === droneId && note.indexOf('ВТРАЧЕНО') !== -1) {
      // Витягти частину з деталями втрати (до роздільника |)
      const parts = note.split(' | ');
      return parts[0]; // деталі втрати
    }
  }
  return '';
}

function mergeDroneStatuses(mainSs, opSs) {
  const CRITICAL = ['Втрачений', 'Несправний', 'Ремонт'];
  const mainInv = getSheet(mainSs, 'Інвентар');
  const opInv   = getSheet(opSs,   'Інвентар');

  if (mainInv && opInv && opInv.getLastRow() >= 3) {
    // 13 колонок: включно зі STATUS_TS (10) і прийняттям (11-13)
    const opData   = opInv.getRange(3, 1, opInv.getLastRow() - 2, 13).getValues();
    const mainData = mainInv.getRange(3, 1, mainInv.getLastRow() - 2, 13).getValues();
    const mainDataTs = mainData;

    // Прийняття обладнання: новіша сторона (за _TS_ACCEPT col 13) перемагає
    opData.forEach(opRow => {
      const id = String(opRow[0]).trim();
      const idx = mainData.findIndex(r => String(r[0]).trim() === id);
      if (idx === -1) return;
      const opAccTs = String(opRow[12] || '').trim();
      const mnAccTs = String(mainData[idx][12] || '').trim();
      if (opAccTs && (!mnAccTs || opAccTs > mnAccTs)) {
        mainInv.getRange(3 + idx, 11).setValue(opRow[10]);
        mainInv.getRange(3 + idx, 12).setValue(opRow[11]);
        mainInv.getRange(3 + idx, 13).setValue(opRow[12]);
      }
    });

    opData.forEach(opRow => {
      const id    = String(opRow[0]).trim();
      const opSt  = String(opRow[COLS.STATUS - 1]).trim();
      const opTs  = String(opRow[COLS.STATUS_TS - 1] || '').trim();
      const idx   = mainData.findIndex(r => String(r[0]).trim() === id);
      if (idx === -1 || !opSt) return;
      const mainSt = String(mainData[idx][COLS.STATUS - 1]).trim();
      const mainTs = String(mainDataTs[idx] ? mainDataTs[idx][COLS.STATUS_TS - 1] || '' : '').trim();

      const resolved = resolveStatus(mainSt, mainTs, opSt, opTs);
      if (resolved && resolved !== mainSt) {
        mainInv.getRange(3 + idx, COLS.STATUS).setValue(resolved);
        mainInv.getRange(3 + idx, COLS.STATUS_TS).setValue(new Date().toISOString());

        // Якщо борт став Втраченим — перенести деталі втрати з примітки вильоту в нотатку борту
        if (resolved === 'Втрачений') {
          try {
            const lostNote = findLostNoteForDrone(mainSs, id);
            if (lostNote) mainInv.getRange(3 + idx, COLS.ID).setNote(lostNote);
          } catch(e) { Logger.log('перенесення нотатки втрати: ' + e); }
        }

        // Записати в журнал руху
        const log = getSheet(mainSs, 'Журнал руху');
        if (log) {
          const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
          log.appendRow([today, id, String(opRow[1]), 'Зміна статусу',
            mainSt, resolved, 'sync-operator', '', 'Оператор через польоти']);
        }
      }
    });
  }

  pushDronesForOps(mainSs, opSs);
}

// Push аркушу цілком (від → до), перезаписує
function pushSheet(fromSs, toSs, sheetName, numCols) {
  const from = getSheet(fromSs, sheetName);
  const to   = getSheet(toSs,   sheetName);
  if (!from || !to) return;

  // Тимчасово зняти всі захисти в аркуші призначення
  const protections = to.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  const sheetProtections = to.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  protections.forEach(p => p.remove());
  sheetProtections.forEach(p => p.remove());

  const lastRow = from.getLastRow();
  if (to.getLastRow() >= 3) {
    to.getRange(3, 1, Math.max(to.getLastRow() - 2, 1), numCols).clearContent();
  }
  if (lastRow >= 3) {
    const data = from.getRange(3, 1, lastRow - 2, numCols).getDisplayValues();
    if (data.length) {
      to.getRange(3, 1, data.length, numCols).setValues(data);
      if (sheetName === 'Журнал польоту') {
        to.getRange(3, 10, data.length, 2).setNumberFormat('@STRING@');
      }
    }
  }

  // Відновити захист для Sinotrack і SIM-карт
  if (sheetName === 'Sinotrack') {
    protectSheetExceptHeaders(to, 'Sinotrack — редагуй через меню');
  } else if (sheetName === 'SIM-карти') {
    protectSheetExceptHeaders(to, 'SIM-карти — редагуй через меню');
  }
}

// Скопіювати дашборд (тільки значення без формул)
function pushDashboard(fromSs, toSs) {
  const from = getSheet(fromSs, 'Дашборд');
  const to   = getSheet(toSs, 'Дашборд');
  if (!from || !to) return;
  const lastRow = from.getLastRow();
  const lastCol = from.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return;
  const values = from.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  to.getRange(1, 1, lastRow, lastCol).setValues(values);
}

// Копіювати борти з інвентарю для вибору в польоті
// 13 колонок: включно з приміткою, STATUS_TS і прийняттям обладнання
function pushDronesForOps(fromSs, toSs) {
  const inv = getSheet(fromSs, 'Інвентар');
  const ops = getSheet(toSs, 'Інвентар');
  if (!inv || !ops) return;
  const lastRow = inv.getLastRow();
  if (lastRow < 3) return;
  const data = inv.getRange(3, 1, lastRow - 2, 13).getValues();
  if (ops.getLastRow() >= 3) {
    ops.getRange(3, 1, ops.getLastRow() - 2, 13).clearContent();
  }
  if (data.length > 0) {
    ops.getRange(3, 1, data.length, 13).setValues(data);
  }
}

// Створити таблицю операторів з нуля
function createOperatorSpreadsheet() {
  const ss   = SpreadsheetApp.create('✈️ Польоти — Оператори');
  const ssId = ss.getId();

  // Аркуші для операторів
  createFlightLogSheet(ss);
  createSinotrackSheet(ss);
  createSimSheet(ss);
  createDashboard(ss);

  // Аркуш Інвентар (тільки для вибору бортів — захищений)
  createInventorySheet(ss);
  const inv = ss.getSheetByName('Інвентар');
  if (inv) {
    inv.protect()
      .setDescription('Тільки читання — дані з основної таблиці')
      .setWarningOnly(false); // жорсткий захист
  }

  // Видалити дефолтний аркуш
  const sheets = ss.getSheets();
  sheets.forEach(sh => {
    if (!['Журнал польоту','Sinotrack','SIM-карти','Дашборд','Інвентар'].includes(sh.getName())) {
      try { ss.deleteSheet(sh); } catch(e) {}
    }
  });

  // Зберегти ID і синхронізувати
  setOperatorSsId(ssId);
  syncToOperators();

  return { id: ssId, url: ss.getUrl() };
}

function addMissingSheets() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const needed = [
    { name: 'Журнал руху',  fn: () => createMovementLogSheet(ss) },
    { name: 'Витратники',   fn: () => createConsumablesSheet(ss) },
    { name: 'Списання',     fn: () => createWriteOffSheet(ss) },
    { name: 'Школа',        fn: () => createFilterSheet(ss, 'Школа') },
    { name: 'На виїзд',     fn: () => createFilterSheet(ss, 'На виїзд') },
    { name: 'Sting',        fn: () => createFilterSheet(ss, 'Sting') },
    { name: 'Симулятор',    fn: () => createFilterSheet(ss, 'Симулятор') },
    { name: 'Інше',         fn: () => createFilterSheet(ss, 'Інше') },
    { name: 'Майстерня',    fn: () => createFilterSheet(ss, 'Майстерня') },
    { name: 'Довідник назв',fn: () => createNamesSheet(ss) },
    { name: 'Втрачені',     fn: () => createLostSheet(ss) },
    { name: 'Sinotrack',    fn: () => createSinotrackSheet(ss) },
    { name: 'SIM-карти',    fn: () => createSimSheet(ss) },
    { name: 'Журнал польоту', fn: () => createFlightLogSheet(ss) },
    { name: 'Дашборд',      fn: () => createDashboard(ss) },
    { name: 'Персонал',     fn: () => ensurePersonnelSheet(ss) },
  ];

  const added = [];
  const skipped = [];

  needed.forEach(({ name, fn }) => {
    if (!ss.getSheetByName(name)) {
      try {
        fn();
        added.push('✅ ' + name);
      } catch (e) {
        added.push('❌ ' + name + ': ' + e.message);
      }
    } else {
      skipped.push('⏭ ' + name + ' (вже є)');
    }
  });

  // Видалити _tmp якщо є
  try {
    const tmp = ss.getSheetByName('_tmp');
    if (tmp) { ss.deleteSheet(tmp); added.push('🗑 _tmp видалено'); }
  } catch(e) {}

  ui.alert(
    'Результат:\n\n' +
    added.concat(skipped).join('\n')
  );
}

// ============================================================
// ІНФОРМАЦІЯ — ДОКУМЕНТИ ПІДРОЗДІЛУ (Google Drive)
// ============================================================
// Спільна тека на Drive, вміст якої показує розділ «Інформація» у PWA.
//
// ЯК ПРАЦЮЄ ДОСТУП. PWA задеплоєний як «Execute as: Me», тому всі звернення
// до Drive йдуть від власника таблиці — Drive не знає операторів (вони
// заходять за позивним, без Google-акаунтів). Отже рідне шарення Drive тут
// нічого не розмежує: права перевіряються ТУТ, чекбоксом «Інформація» в
// аркуші «Персонал». З тієї ж причини файл віддається вмістом через API,
// а не посиланням: посилання в людини без Google-доступу просто не відкриється,
// а робити теку «доступною за посиланням» — це вже витік поза застосунок.
//
// НАЛАШТУВАННЯ: створи теку на Drive, відкрий її і візьми ID з адреси
//   https://drive.google.com/drive/folders/<ЦЕЙ_РЯДОК>
// Порожній INFO_ROOT_ID — розділ показує «сховище не під'єднане».
const INFO_ROOT_ID = '';

// Стеля на віддачу файлу. Apps Script тримає відповідь у пам'яті, а base64
// роздуває розмір на третину — тому великі відео так не віддати.
const INFO_MAX_FILE_MB = 25;

function infoAssertAccess_() {
  // Адмін таблиці (sidebar, за Google-акаунтом) або право «Інформація» у PWA
  if (typeof __API_CTX !== 'undefined' && __API_CTX && __API_CTX.person) {
    if (!apiRight_('info')) throw new Error('Немає доступу до розділу «Інформація»');
    return;
  }
  if (!isAdmin(apiUserEmail_())) throw new Error('Немає доступу до розділу «Інформація»');
}

// Тека має лежати всередині кореневої — інакше знаючи чужий ID можна було б
// прочитати будь-що з Drive власника.
function infoAssertInsideRoot_(folder) {
  const rootId = INFO_ROOT_ID;
  let cur = folder, hops = 0;
  while (cur && hops < 25) {
    if (cur.getId() === rootId) return true;
    const parents = cur.getParents();
    cur = parents.hasNext() ? parents.next() : null;
    hops++;
  }
  throw new Error('Тека поза межами спільної теки підрозділу');
}

function infoFileKind_(mime) {
  if (!mime) return 'file';
  if (mime.indexOf('image/') === 0) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.indexOf('video/') === 0) return 'video';
  if (mime.indexOf('text/') === 0) return 'text';
  if (mime.indexOf('google-apps') !== -1) return 'gdoc';
  return 'file';
}

// Вміст теки: підтеки + файли. folderId порожній — коренева тека.
function infoListFolder(folderId) {
  infoAssertAccess_();
  if (!INFO_ROOT_ID) return { configured: false, folders: [], files: [] };

  const id = String(folderId || '').trim() || INFO_ROOT_ID;
  const folder = DriveApp.getFolderById(id);
  if (id !== INFO_ROOT_ID) infoAssertInsideRoot_(folder);

  const folders = [];
  const it = folder.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    folders.push({ id: f.getId(), name: f.getName() });
  }

  const files = [];
  const fit = folder.getFiles();
  while (fit.hasNext()) {
    const f = fit.next();
    const size = Number(f.getSize() || 0);
    files.push({
      id: f.getId(), name: f.getName(), mime: f.getMimeType(),
      kind: infoFileKind_(f.getMimeType()), size: size,
      tooBig: size > INFO_MAX_FILE_MB * 1024 * 1024,
      date: Utilities.formatDate(f.getLastUpdated(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    });
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Шлях від кореня — для «хлібних крихт» у застосунку
  const path = [];
  let cur = folder, hops = 0;
  while (cur && hops < 25) {
    path.unshift({ id: cur.getId(), name: cur.getName() });
    if (cur.getId() === INFO_ROOT_ID) break;
    const parents = cur.getParents();
    cur = parents.hasNext() ? parents.next() : null;
    hops++;
  }

  return { configured: true, folderId: id, path: path, folders: folders, files: files };
}

// Вміст файлу в base64 — застосунок відкриває його сам, без Drive-посилання.
function infoGetFile(fileId) {
  infoAssertAccess_();
  if (!INFO_ROOT_ID) throw new Error('Сховище не під\'єднане');

  const file = DriveApp.getFileById(String(fileId));
  const parents = file.getParents();
  if (!parents.hasNext()) throw new Error('Файл поза спільною текою');
  infoAssertInsideRoot_(parents.next());

  const size = Number(file.getSize() || 0);
  if (size > INFO_MAX_FILE_MB * 1024 * 1024) {
    throw new Error('Файл завеликий для перегляду в застосунку (' +
      Math.round(size / 1024 / 1024) + ' МБ, стеля ' + INFO_MAX_FILE_MB + ' МБ)');
  }

  // Google Docs/Sheets/Slides не мають бінарного вмісту — віддаємо як PDF,
  // інакше застосунку не було б що показати.
  const isGoogleDoc = String(file.getMimeType()).indexOf('google-apps') !== -1;
  const blob = isGoogleDoc ? file.getAs('application/pdf') : file.getBlob();

  return {
    name: file.getName() + (isGoogleDoc ? '.pdf' : ''),
    mime: blob.getContentType(),
    kind: infoFileKind_(blob.getContentType()),
    size: size,
    exported: isGoogleDoc,
    data: Utilities.base64Encode(blob.getBytes()),
  };
}

// ── Запис: створення тек і завантаження файлів ───────────────
// Право те саме, що й на перегляд («Інформація» в аркуші «Персонал»):
// без нього розділ узагалі не видно. Якщо колись знадобиться рівень
// «дивитись, але не чіпати» — треба буде окремий чекбокс.

// Ім'я теки/файлу: без роздільників шляху й керівних символів,
// щоб не можна було вилізти з теки або зіпсувати показ у списку.
function infoCleanName_(name) {
  const s = String(name || '').replace(/[\/\:*?"<>|\u0000-\u001f]/g, '').trim();
  if (!s) throw new Error('Порожня назва');
  if (s === '.' || s === '..') throw new Error('Недопустима назва');
  if (s.length > 120) throw new Error('Назва задовга (максимум 120 символів)');
  return s;
}

function infoTargetFolder_(parentId) {
  if (!INFO_ROOT_ID) throw new Error('Сховище не під\'єднане');
  const id = String(parentId || '').trim() || INFO_ROOT_ID;
  const folder = DriveApp.getFolderById(id);
  if (id !== INFO_ROOT_ID) infoAssertInsideRoot_(folder);
  return folder;
}

function infoCreateFolder(parentId, name) {
  infoAssertAccess_();
  const folder = infoTargetFolder_(parentId);
  const clean = infoCleanName_(name);

  const existing = folder.getFoldersByName(clean);
  if (existing.hasNext()) throw new Error('Тека «' + clean + '» тут уже є');

  const created = folder.createFolder(clean);
  return { id: created.getId(), name: created.getName() };
}

// dataBase64 — вміст файлу. Приходить у тілі POST, тому діє та сама стеля:
// base64 роздуває розмір на третину, а Apps Script тримає все в пам'яті.
function infoUploadFile(parentId, name, mime, dataBase64) {
  infoAssertAccess_();
  const folder = infoTargetFolder_(parentId);
  const clean = infoCleanName_(name);

  const raw = String(dataBase64 || '');
  if (!raw) throw new Error('Порожній файл');
  // Довжина base64 → приблизний розмір у байтах (4 символи = 3 байти)
  const approx = Math.floor(raw.length * 3 / 4);
  if (approx > INFO_MAX_FILE_MB * 1024 * 1024) {
    throw new Error('Файл завеликий (' + Math.round(approx / 1024 / 1024) +
      ' МБ, стеля ' + INFO_MAX_FILE_MB + ' МБ)');
  }

  let bytes;
  try { bytes = Utilities.base64Decode(raw); }
  catch (e) { throw new Error('Не вдалося прочитати вміст файлу'); }

  const blob = Utilities.newBlob(bytes, mime || 'application/octet-stream', clean);

  // Однакове ім'я — не перезаписуємо мовчки, а додаємо мітку часу:
  // затерти чужий документ гірше, ніж мати два.
  let finalName = clean;
  if (folder.getFilesByName(clean).hasNext()) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
    const dot = clean.lastIndexOf('.');
    finalName = dot > 0
      ? clean.slice(0, dot) + ' (' + stamp + ')' + clean.slice(dot)
      : clean + ' (' + stamp + ')';
    blob.setName(finalName);
  }

  const created = folder.createFile(blob);
  return { id: created.getId(), name: created.getName(), renamed: finalName !== clean };
}

// Перейменування теки. Коренева не чіпається: вона задана INFO_ROOT_ID,
// і зміна її імені збила б орієнтир у крихтах.
function infoRenameFolder(folderId, newName) {
  infoAssertAccess_();
  if (!INFO_ROOT_ID) throw new Error('Сховище не під\'єднане');

  const id = String(folderId || '').trim();
  if (!id || id === INFO_ROOT_ID) throw new Error('Кореневу теку перейменувати не можна');

  const folder = DriveApp.getFolderById(id);
  infoAssertInsideRoot_(folder);

  const clean = infoCleanName_(newName);
  if (clean === folder.getName()) return { id: id, name: clean };

  // Сусідня тека з таким іменем — відмовляємо, щоб не плодити двійників
  const parents = folder.getParents();
  if (parents.hasNext()) {
    const twin = parents.next().getFoldersByName(clean);
    while (twin.hasNext()) {
      if (twin.next().getId() !== id) throw new Error('Тека «' + clean + '» тут уже є');
    }
  }

  folder.setName(clean);
  return { id: id, name: clean };
}
