# Evolution PO · Telegram Mini App

30-дневный курс Product Owner для перехода Junior → Middle. B2B SaaS, ADHD-friendly, item-bank тестирования по стандартам NBME/ETS.

## Структура

```
.
├── index.html              # Стартовая страница / дашборд
├── course.html             # SPA со всеми 30 уроками (роутинг через #day-N)
├── flashcards.html         # Spaced repetition флэш-карты
├── day-0-diagnostic.html   # Стартовая диагностика (14 вопросов)
├── tma-init.js             # Telegram WebApp интеграция (BackButton, haptic, theme)
├── mobile.css              # iPhone-адаптация (safe-area, 44pt тапы, dvh viewport)
├── vercel.json             # Конфиг для деплоя на Vercel
├── netlify.toml            # Конфиг для деплоя на Netlify
└── package.json            # NPM-скрипты для локального запуска
```

## Деплой за 60 секунд

### Vercel (рекомендую — самый простой)

```bash
npm install -g vercel
vercel deploy --prod
```

После деплоя получишь HTTPS-URL вида `https://evolution-po.vercel.app/`.

### Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=.
```

### Cloudflare Pages

1. Залить папку в git-репозиторий
2. В Cloudflare Pages → Create project → Connect to Git
3. Build command: оставить пустым
4. Output directory: `.`

### GitHub Pages

1. Push в репозиторий
2. Settings → Pages → Source: main branch / root
3. URL появится за 1-2 минуты

## Привязка к боту в Telegram

1. Открой [@BotFather](https://t.me/BotFather)
2. Введи `/newapp` (или `/myapps` чтобы добавить к существующему боту)
3. Выбери своего бота
4. Title: `Evolution PO`
5. Description: `30-дневный курс Product Owner`
6. Photo: загрузить (опционально)
7. GIF demo: можно пропустить
8. Web App URL: вставь URL после деплоя (например `https://evolution-po.vercel.app/`)
9. Short name (для прямой ссылки): `evolution`

После этого мини-приложение будет доступно:
- По кнопке в меню бота (нужно настроить через `/setmenubutton`)
- По прямой ссылке `https://t.me/your_bot/evolution`

## Локальный запуск для теста

```bash
npx serve .
# или
python3 -m http.server 8080
# или
npm run dev
```

Открыть `http://localhost:3000` (или порт сервера).

Для тестирования в Telegram — нужен публичный HTTPS-URL. Можно использовать [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
# Скопировать https-URL в BotFather как Web App URL
```

## Хранение прогресса

Используется `localStorage` браузера Telegram WebApp:
- `po_progress` — пройденные дни, страйк, точность ответов
- `po_diagnostic_day0` — результаты стартовой диагностики
- `po_flashcards` — состояние spaced repetition

**Ограничение:** данные привязаны к устройству, не синхронизируются между ними. Для cross-device sync можно мигрировать на `Telegram.WebApp.CloudStorage` (требует асинхронной обёртки).

## Кастомизация

### Изменить цвета темы

В `tma-init.js` найди:
```js
try { tg.setHeaderColor('#0f0f14'); } catch (e) {}
try { tg.setBackgroundColor('#0f0f14'); } catch (e) {}
```

### Добавить новые уроки

В `course.html` найди `const COURSE = [];` и `COURSE.push({...})`. Скопируй любой существующий день, измени `d`, `t`, `s1/s2/s3`, `L`.

### Изменить курс на другую профессию

Замени:
- Содержимое `course.html` — там вся учебная логика
- Вопросы в `day-0-diagnostic.html` — поменяй areas и questions_flat
- Текст в `index.html` (название, иконки)
- Карточки в `flashcards.html` (массив `CARDS`)

## Технологии

- Pure HTML/CSS/JS, без сборщиков
- Никаких зависимостей кроме Telegram WebApp SDK (загружается с CDN)
- localStorage для прогресса
- Fisher-Yates shuffle для item bank
- NBME/ETS-стандарт длин опций для тестов

## Лицензия

Используй и модифицируй свободно. Это твой курс.
