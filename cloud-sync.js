// ===================================================================
// Durable progress layer for Evolution PO  ·  window.POCloud
//
// Зачем: чистый localStorage в Telegram Web App нестабилен — теряется
// при смене домена, переустановке, неперсистентном webview мини-аппа.
// Решение: Telegram.WebApp.CloudStorage (привязан к аккаунту, на
// сервере Telegram) как durable-зеркало localStorage.
//
// ВАЖНО: Storage-объект НЕЛЬЗЯ безопасно monkeypatch-ить
// (localStorage.setItem = fn у Storage просто создаёт ключ "setItem";
// патч прототипа ломается brand-проверкой this в части движков).
// Поэтому НЕ патчим Storage, а даём явный API:
//   window.POCloud.mirror(key, value)  — продублировать в облако
//   window.POCloud.drop(key)           — удалить из облака
// Места записи прогресса в приложении вызывают mirror/drop явно.
// Гидратация (облако -> localStorage при пустом локальном сторе)
// делается тут на загрузке, без всякого патчинга.
//
// Подключается в <head> сразу после telegram-web-app.js, ДО кода
// приложения (чтобы гидратация успела до первых loadProg()).
// ===================================================================
(function () {
  var KEYS = ['po_progress', 'po_diagnostic_day0', 'po_flashcards', 'po_achievements', 'po_metrics'];
  var CS_LIMIT = 4096; // лимит значения Telegram CloudStorage
  var tg = window.Telegram && window.Telegram.WebApp;
  var cs = tg && tg.CloudStorage;
  var canCloud = !!cs &&
    typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('6.9');
  var LS = window.localStorage;

  function isEmptyVal(v) {
    return v === null || v === undefined || v === '' ||
           v === '{}' || v === 'null';
  }

  // po_progress с рефлексиями может превысить лимит CloudStorage —
  // тогда в облако кладём компактную проекцию (без текста reflection):
  // факт прохождения дня + score сохраняются, заметки — только локально.
  function cloudValue(key, val) {
    if (val == null) return null;
    val = String(val);
    if (val.length <= CS_LIMIT) return val;
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
    return null;
  }

  // --- публичный API ---
  var POCloud = {
    available: canCloud,
    mirror: function (key, val) {
      if (!canCloud || KEYS.indexOf(key) === -1) return;
      var cv = cloudValue(key, val);
      if (cv == null) return;
      try { cs.setItem(key, cv, function () {}); } catch (e) {}
    },
    drop: function (key) {
      if (!canCloud || KEYS.indexOf(key) === -1) return;
      try { cs.removeItem(key, function () {}); } catch (e) {}
    }
  };
  window.POCloud = POCloud;

  // --- one-time seed через URL (?po_seed=days:1-7 или days:1,2,5) ---
  // Восстановление без выдуманных баллов: дни помечаются пройденными
  // (seeded:true), score НЕ ставим — точность остаётся честной.
  function applySeed() {
    var m = /[?&]po_seed=([^&]+)/.exec(window.location.search);
    if (!m) return false;
    var spec = decodeURIComponent(m[1]), days = [];
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
    try { prog = JSON.parse(LS.getItem('po_progress') || '{}'); } catch (e) {}
    var now = new Date().toISOString();
    days.forEach(function (d) {
      if (!prog['day' + d]) prog['day' + d] = { date: now, seeded: true };
    });
    var json = JSON.stringify(prog);
    try { LS.setItem('po_progress', json); } catch (e) {}
    POCloud.mirror('po_progress', json);
    window.location.replace(window.location.pathname + window.location.hash);
    return true;
  }
  if (applySeed()) return;

  // --- hydrate: облако -> localStorage для пустых ключей ---
  if (canCloud) {
    try {
      cs.getItems(KEYS, function (err, data) {
        if (err || !data) return;
        var restored = false;
        KEYS.forEach(function (k) {
          var cloudVal = data[k], localVal = null;
          try { localVal = LS.getItem(k); } catch (e) {}
          if (!isEmptyVal(cloudVal) && isEmptyVal(localVal)) {
            try { LS.setItem(k, cloudVal); restored = true; } catch (e) {}
          } else if (!isEmptyVal(localVal) && isEmptyVal(cloudVal)) {
            POCloud.mirror(k, localVal);      // локально есть, в облаке нет
          }
        });
        if (restored && !sessionStorage.getItem('po_cloud_hydrated')) {
          sessionStorage.setItem('po_cloud_hydrated', '1');
          window.location.reload();           // дать синхронному коду данные
        }
      });
    } catch (e) { /* CloudStorage недоступен — работаем на localStorage */ }
  }
})();
