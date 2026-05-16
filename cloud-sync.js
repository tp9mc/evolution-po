// ===================================================================
// Durable progress layer for Evolution PO.
//
// Проблема, которую решает: чистый localStorage в Telegram Web App
// нестабилен — теряется при смене домена, переустановке, а у
// мини-аппов из бота webview-хранилище бывает неперсистентным.
//
// Решение: Telegram.WebApp.CloudStorage (привязан к аккаунту, живёт
// на сервере Telegram) как durable-зеркало. localStorage остаётся
// рабочим синхронным стором (код приложения не меняется) — этот
// модуль прозрачно зеркалит запись в облако и при пустом локальном
// сторе восстанавливает данные из облака.
//
// Подключается в <head> сразу после telegram-web-app.js, ДО кода
// приложения, чтобы обёртка стояла раньше любых loadProg().
// ===================================================================
(function () {
  var KEYS = ['po_progress', 'po_diagnostic_day0', 'po_flashcards'];
  var CS_LIMIT = 4096; // лимит значения Telegram CloudStorage
  var tg = window.Telegram && window.Telegram.WebApp;
  var cs = tg && tg.CloudStorage;
  var canCloud = !!cs &&
    typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('6.9');

  function isEmptyVal(v) {
    return v === null || v === '' || v === '{}' || v === 'null';
  }

  // po_progress с рефлексиями может превысить лимит CloudStorage.
  // Тогда в облако кладём компактную проекцию (без текста reflection):
  // факт прохождения дня + score сохраняются, личные заметки —
  // только локально. Так важная часть прогресса всегда durable.
  function cloudValue(key, val) {
    if (val == null || val.length <= CS_LIMIT) return val;
    if (key === 'po_progress') {
      try {
        var p = JSON.parse(val), out = {};
        Object.keys(p).forEach(function (k) {
          var d = p[k] || {};
          out[k] = { date: d.date, score: d.score, seeded: d.seeded };
        });
        var c = JSON.stringify(out);
        return c.length <= CS_LIMIT ? c : null;
      } catch (e) { return null; }
    }
    return null; // слишком большое и не сжать — пропускаем облако
  }

  function pushCloud(key, val) {
    if (!canCloud) return;
    var cv = cloudValue(key, val);
    if (cv == null) return;
    try { cs.setItem(key, cv, function () {}); } catch (e) {}
  }

  // --- 1. write-through: оборачиваем localStorage ---
  var _set = window.localStorage.setItem.bind(window.localStorage);
  var _rem = window.localStorage.removeItem.bind(window.localStorage);
  try {
    window.localStorage.setItem = function (k, v) {
      _set(k, v);
      if (KEYS.indexOf(k) >= 0) pushCloud(k, String(v));
    };
    window.localStorage.removeItem = function (k) {
      _rem(k);
      if (KEYS.indexOf(k) >= 0 && canCloud) {
        try { cs.removeItem(k, function () {}); } catch (e) {}
      }
    };
  } catch (e) { /* среды, где Storage не патчится — деградируем тихо */ }

  // --- 2. one-time seed через URL (?po_seed=days:1-7 или days:1,2,5) ---
  // Восстановление прохождения без выдуманных баллов: дни помечаются
  // пройденными (seeded:true), score НЕ ставим — точность не врёт.
  function applySeed() {
    var m = /[?&]po_seed=([^&]+)/.exec(window.location.search);
    if (!m) return false;
    var spec = decodeURIComponent(m[1]);
    var days = [];
    spec.split(';').forEach(function (part) {
      var mm = /days:(.+)/.exec(part.trim());
      if (!mm) return;
      mm[1].split(',').forEach(function (tok) {
        tok = tok.trim();
        var r = /^(\d+)-(\d+)$/.exec(tok);
        if (r) { for (var i = +r[1]; i <= +r[2]; i++) days.push(i); }
        else if (/^\d+$/.test(tok)) days.push(+tok);
      });
    });
    if (!days.length) return false;
    var prog = {};
    try { prog = JSON.parse(window.localStorage.getItem('po_progress') || '{}'); } catch (e) {}
    var now = new Date().toISOString();
    days.forEach(function (d) {
      if (!prog['day' + d]) prog['day' + d] = { date: now, seeded: true };
    });
    window.localStorage.setItem('po_progress', JSON.stringify(prog)); // -> и в облако
    // убрать параметр из URL и перезагрузить чисто
    var clean = window.location.pathname + window.location.hash;
    window.location.replace(clean);
    return true;
  }
  if (applySeed()) return;

  // --- 3. hydrate: облако -> локально для пустых ключей ---
  if (canCloud) {
    try {
      cs.getItems(KEYS, function (err, data) {
        if (err || !data) return;
        var restored = false;
        KEYS.forEach(function (k) {
          var cloudVal = data[k];
          var localVal = window.localStorage.getItem(k);
          if (cloudVal && !isEmptyVal(cloudVal) && isEmptyVal(localVal)) {
            _set(k, cloudVal);            // тихо, без обратной записи в облако
            restored = true;
          } else if (localVal && !isEmptyVal(localVal) &&
                     (cloudVal === undefined || isEmptyVal(cloudVal))) {
            pushCloud(k, localVal);        // локально есть, в облаке нет — поднять
          }
        });
        if (restored && !sessionStorage.getItem('po_cloud_hydrated')) {
          sessionStorage.setItem('po_cloud_hydrated', '1');
          window.location.reload();        // дать синхронному коду увидеть данные
        }
      });
    } catch (e) { /* CloudStorage недоступен — работаем на localStorage */ }
  }
})();
