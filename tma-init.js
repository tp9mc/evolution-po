// ===================================================================
// Telegram Mini App initialization
// Подключается во всех HTML файлах. Если Telegram WebApp не доступен
// (открытие через обычный браузер), работает как no-op fallback.
// ===================================================================
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) {
    console.log('[TMA] Not in Telegram — running in browser mode');
    return;
  }

  // 1. Подготовить viewport
  try { tg.ready(); } catch (e) {}
  try { tg.expand(); } catch (e) {}

  // 2. Цвет фона / заголовка под темнy app
  try { tg.setHeaderColor('#0f0f14'); } catch (e) {}
  try { tg.setBackgroundColor('#0f0f14'); } catch (e) {}

  // 3. Кнопка «назад» по контексту
  function updateBackButton() {
    const hash = window.location.hash || '';
    const path = window.location.pathname || '';
    const fileName = path.split('/').pop() || '';
    const isHome = (fileName === '' || fileName === 'index.html') && (!hash || hash === '#home');
    const isLessonRoute = fileName === 'course.html' && hash && hash.startsWith('#day-');

    if (isHome) {
      try { tg.BackButton.hide(); } catch (e) {}
    } else {
      try { tg.BackButton.show(); } catch (e) {}
    }
  }

  try {
    tg.BackButton.onClick(function () {
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      const fileName = path.split('/').pop() || '';

      if (fileName === 'course.html' && hash && hash !== '#home') {
        // На уроке курса — возврат к карте курса
        window.location.hash = '#home';
      } else if (fileName === 'course.html' || fileName === 'flashcards.html' || fileName === 'day-0-diagnostic.html') {
        // На вторичной странице — возврат на главную
        window.location.href = 'index.html';
      } else {
        // На главной — закрыть мини-приложение
        try { tg.close(); } catch (e) {}
      }
    });
  } catch (e) {}

  updateBackButton();
  window.addEventListener('hashchange', updateBackButton);

  // 4. Haptic feedback на тапы по кнопкам и опциям
  document.addEventListener('click', function (e) {
    const target = e.target;
    if (!target) return;
    if (target.closest && target.closest('button, .btn, .hero-btn, .day, .map-day, label, a.nav-pills, .nav-pills a, .nav-pills button')) {
      try { tg.HapticFeedback.impactOccurred('light'); } catch (err) {}
    }
  });

  // 5. Двойной тап по логотипу/h1 запускает haptic как easter egg
  // (helpful для тестирования, что SDK работает)
  let lastTap = 0;
  document.addEventListener('click', function (e) {
    if (e.target && e.target.tagName === 'H1') {
      const now = Date.now();
      if (now - lastTap < 400) {
        try { tg.HapticFeedback.notificationOccurred('success'); } catch (err) {}
      }
      lastTap = now;
    }
  });

  console.log('[TMA] Telegram WebApp initialized', {
    version: tg.version,
    platform: tg.platform,
    colorScheme: tg.colorScheme
  });
})();
