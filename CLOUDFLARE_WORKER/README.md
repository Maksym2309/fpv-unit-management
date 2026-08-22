# Медіа-проксі для розділу «Інформація»

## Навіщо

Apps Script **не вміє віддавати бінарні дані** — тільки текст. Тому файл із
Drive доводилось гнати через нього в base64: +33% обсягу, весь файл у пам'яті
скрипта, жодної перемотки відео й жодного кешу браузера. Це не оптимізується —
це властивість платформи.

Worker прибирає Apps Script зі шляху даних. Файл іде **напряму від Google до
браузера**, потоком, із підтримкою Range. Наслідки:

- відео **перемотується** і починає грати одразу, без попереднього завантаження;
- звичайні файли йдуть на повній швидкості й **кешуються браузером**;
- зникає стеля розміру — вона була наслідком пам'яті Apps Script, а не Drive.

## Чому це не відкритий проксі до вашого Drive

Worker нікого не пускає «за id файлу». Право «Інформація» перевіряє Apps Script
і лише тоді видає **квиток** — підпис HMAC-SHA256 від рядка
`<fileId>.<коли протухає>`. Worker перевіряє підпис своїм примірником секрету,
локально, без звернень назад.

- квиток дійсний на **один файл** і на 30 хвилин (`INFO_TICKET_TTL_MIN`);
- підробити його, не знаючи секрету, не можна;
- **токен власника Drive лишається у Worker** і браузеру не потрапляє;
- тека Drive **не стає публічною** — саме цього ми й уникали від початку.

## Розгортання

### 1. Отримати доступ Google

1. https://console.cloud.google.com → створи проєкт (або візьми наявний).
2. APIs & Services → Library → увімкни саме **Google Drive API**
   («Create and manage resources in Google Drive»). Drive Activity API,
   Drive Labels API і Marketplace SDK — не те, вмикати не треба.
3. Далі — розділ **Google Auth Platform** (не «Identity platform»!).
   Google переніс туди те, що в старих інструкціях зветься
   «OAuth consent screen», і перейменував підрозділи:
     Branding    — назва застосунку й пошта підтримки (колишній consent screen)
     Audience    — тип External + **Test users** (додай себе обовʼязково)
     Data access — scopes (тут можна нічого не додавати)
     Clients     — колишній Credentials
4. Clients → Create client → **Web application**.
   В Authorized redirect URIs додай `https://developers.google.com/oauthplayground`.
   Збережи **Client ID** і **Client secret**.

   ⚠ Поки застосунок у статусі **Testing**, refresh token протухає
   приблизно раз на тиждень — і Worker раптом перестане віддавати файли.
   Або додай себе в Test users і памʼятай про це, або опублікуй
   застосунок (Audience → Publish), і токен житиме постійно.
5. https://developers.google.com/oauthplayground → ⚙ (справа вгорі) →
   постав «Use your own OAuth credentials», встав Client ID і Secret.
   У списку зліва обери scope `https://www.googleapis.com/auth/drive.readonly`
   → Authorize APIs → увійди **тим акаунтом, що володіє текою** →
   Exchange authorization code for tokens → скопіюй **Refresh token**.

### 2. Розгорнути Worker

```
npm install -g wrangler
wrangler login
wrangler deploy
```

Далі задай секрети (їх не видно в коді й не потрапляють у git):

```
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REFRESH_TOKEN
wrangler secret put TICKET_SECRET
```

`TICKET_SECRET` — довільний довгий рядок, який ти сам вигадуєш. Він має
збігатися з `INFO_MEDIA_SECRET` у Code.gs.

У `wrangler.toml` заповни `ALLOWED_ORIGIN` адресою свого GitHub Pages —
тоді тягнути файли зможе тільки застосунок, а не будь-яка стороння сторінка.

### 3. Під'єднати до застосунку

У `Code.gs` (головна таблиця):

```js
const INFO_MEDIA_WORKER_URL = 'https://твій-worker.workers.dev';
const INFO_MEDIA_SECRET = 'той самий рядок, що TICKET_SECRET';
```

Далі **Deploy → New version**.

## Якщо не налаштовано

Обидва рядки порожні — застосунок **тихо працює як раніше**, через Apps Script.
Нічого не ламається, просто повільніше й без перемотки. Так само він відкотиться
назад, якщо Worker тимчасово недоступний.

Перевірити, який шлях працює: відкрий велике відео. Якщо воно починає грати
одразу й перемотується — працює Worker. Якщо спершу йде смужка завантаження —
відкат на старий шлях.

## Обмеження

Google-документи (Docs/Sheets) через Worker не йдуть: бінарного вмісту вони не
мають. Для них лишається старий шлях з експортом у PDF — вони маленькі, різниці
не видно.
