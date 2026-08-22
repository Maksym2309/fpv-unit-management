/**
 * Медіа-проксі для розділу «Інформація».
 *
 * НАВІЩО. Apps Script не вміє віддавати бінарні дані — тільки текст. Тому
 * файл із Drive доводилось гнати через нього в base64: +33% обсягу, весь
 * файл у памʼяті скрипта, жодної перемотки й кешу браузера. Цей Worker
 * прибирає Apps Script зі шляху даних: віддає файл потоком, з підтримкою
 * Range, тож відео перемотується, а звичайні файли йдуть на повній
 * швидкості й кешуються браузером.
 *
 * ЧОМУ ЦЕ НЕ ВІДКРИТИЙ ПРОКСІ. Worker нікого не пускає «за id файлу».
 * Apps Script спершу перевіряє право «Інформація» і лише тоді видає
 * КВИТОК: підпис HMAC-SHA256 від рядка "<fileId>.<коли протухає>".
 * Worker перевіряє підпис своїм примірником секрету — локально, без
 * звернень назад. Квиток дійсний на ОДИН файл і недовго; підробити його,
 * не знаючи секрету, не можна. Токен власника Drive лишається тут і
 * браузеру не потрапляє.
 *
 * Розгортання — див. README.md поруч.
 */

const DRIVE_MEDIA = 'https://www.googleapis.com/drive/v3/files/';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

// ЧОМУ СЕРВІСНИЙ АКАУНТ, А НЕ OAuth. drive.readonly — чутливий scope.
// Зі звичайним Google-акаунтом застосунок лишається в статусі Testing,
// а там refresh token протухає приблизно раз на тиждень: усе працює,
// а потім раптом файли перестають відкриватись. Опублікувати застосунок
// із таким scope — це верифікація в Google, зайва для внутрішнього
// інструмента. Сервісний акаунт цього не має взагалі: він сам собі
// видає токен і бачить рівно ту теку, яку йому розшарили.
let tokenCache = { value: '', exp: 0 };

function b64url(bytes) {
  let s = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PEM із JSON-ключа. Через wrangler його вставляють по-різному: як
// справжні переноси або як послідовність \n — приймаємо обидва варіанти.
async function importPrivateKey(pem) {
  const clean = String(pem)
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(clean);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey(
    'pkcs8', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']);
}

async function makeAssertion(email, pem) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  })));
  const data = header + '.' + claim;
  const key = await importPrivateKey(pem);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return data + '.' + b64url(sig);
}

async function getAccessToken(env) {
  const now = Date.now();
  if (tokenCache.value && tokenCache.exp > now + 60_000) return tokenCache.value;
  if (!env.GOOGLE_SA_EMAIL || !env.GOOGLE_SA_PRIVATE_KEY) {
    throw new Error('не задано GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY');
  }

  const assertion = await makeAssertion(env.GOOGLE_SA_EMAIL, env.GOOGLE_SA_PRIVATE_KEY);
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion,
    }).toString(),
  });
  if (!r.ok) throw new Error('token ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  tokenCache = { value: j.access_token, exp: now + (j.expires_in || 3600) * 1000 };
  return tokenCache.value;
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Порівняння за сталий час — щоб підпис не можна було підібрати побайтово
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyTicket(secret, msg, sigB64url) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  let got;
  try { got = b64urlToBytes(sigB64url); } catch (e) { return false; }
  return timingSafeEqual(mac, got);
}

function corsHeaders(env, req) {
  // ALLOWED_ORIGIN обмежує, звідки можна тягнути. Без нього — будь-звідки,
  // але квиток усе одно потрібен.
  const allow = env.ALLOWED_ORIGIN || '*';
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': allow === '*' ? '*' : (origin === allow ? allow : allow),
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range',
    // Без цього JS у браузері не побачить заголовків діапазону,
    // а плеєр не зрозуміє, що перемотка можлива
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(env, req);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405, headers: cors });
    }

    const u = new URL(req.url);
    const f = u.searchParams.get('f');           // id файлу
    const e = u.searchParams.get('e');           // коли протухає (unix, секунди)
    const s = u.searchParams.get('s');           // підпис
    const dl = u.searchParams.get('dl') === '1'; // зберегти, а не показати
    const nm = u.searchParams.get('n') || '';    // імʼя для збереження

    if (!f || !e || !s) return new Response('bad request', { status: 400, headers: cors });
    if (!/^\d+$/.test(e) || Number(e) * 1000 < Date.now()) {
      return new Response('ticket expired', { status: 403, headers: cors });
    }
    if (!env.TICKET_SECRET) return new Response('worker not configured', { status: 500, headers: cors });
    if (!(await verifyTicket(env.TICKET_SECRET, f + '.' + e, s))) {
      return new Response('bad ticket', { status: 403, headers: cors });
    }

    let token;
    try { token = await getAccessToken(env); }
    catch (err) { return new Response('auth: ' + err.message, { status: 502, headers: cors }); }

    const range = req.headers.get('Range');
    const g = await fetch(DRIVE_MEDIA + encodeURIComponent(f) + '?alt=media&supportsAllDrives=true', {
      method: req.method,
      headers: Object.assign(
        { Authorization: 'Bearer ' + token },
        range ? { Range: range } : {}),
    });

    const h = new Headers();
    // Переносимо лише те, що потрібно плеєру й браузеру
    ['Content-Type', 'Content-Length', 'Content-Range', 'ETag', 'Last-Modified'].forEach(k => {
      const v = g.headers.get(k);
      if (v) h.set(k, v);
    });
    h.set('Accept-Ranges', 'bytes');
    Object.entries(cors).forEach(([k, v]) => h.set(k, v));
    if (dl) {
      const safe = nm.replace(/["\\\r\n]/g, '');
      h.set('Content-Disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(safe || 'file'));
    }
    // Кеш приватний: файл підрозділу не має осідати в проміжних кешах
    h.set('Cache-Control', 'private, max-age=300');

    return new Response(g.body, { status: g.status, headers: h });
  },
};
