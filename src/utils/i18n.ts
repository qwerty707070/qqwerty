import type { LanguageCode, LaunchPhase } from '../types/launcher';

export const UI_COPY = {
  ru: {
    nav: {
      home: 'Главная',
      modules: 'Модули и HUD',
      news: 'Новости',
      versions: 'Версии',
      resources: 'Моды и ресурспаки',
      settings: 'Настройки',
      account: 'Аккаунт',
    },
    sidebar: {
      operational: 'Все сервисы активны',
      degraded: 'Проверка соединения',
      discord: 'Сообщество Discord',
      downloads: 'Менеджер загрузок',
    },
    hero: {
      badge: 'NEXT-GEN VISUAL ENGINE',
      line1: 'НОВЫЙ ВЗГЛЯД',
      line2: 'НА MINECRAFT',
      subtitle:
        'Кастомные GLSL-шейдеры, перетаскиваемый редактор HUD 2.0, физика плащей 144 Гц и безупречная плавность каждого кадра без вмешательства в механику игры.',
      statModules: '38 визуальных модулей',
      statEngine: 'GLSL 4.6 + Sodium',
      statSync: 'Облачные профили',
      changelogBtn: 'Настроить HUD и модули',
      versionsBtn: 'Выбрать сборку',
    },
    launchPanel: {
      versionLabel: 'ВЕРСИЯ КЛИЕНТА',
      accountLabel: 'АККАУНТ',
      statusLabel: 'СТАТУС ЯДРА',
      ready: 'Готов к запуску',
      running: 'Клиент активен',
      error: 'Ошибка загрузки',
      playButton: 'ИГРАТЬ',
      stopButton: 'ЗАВЕРШИТЬ',
      retryButton: 'ПОВТОРИТЬ',
    },
    phases: {
      idle: 'Готов к запуску',
      preparing: 'Подготовка окружения...',
      downloading: 'Загрузка компонентов...',
      verifying: 'Проверка SHA-256...',
      launching: 'Запуск Minecraft...',
      running: 'Клиент запущен',
      error: 'Ошибка соединения',
    } as Record<LaunchPhase, string>,
  },
  en: {
    nav: {
      home: 'Home',
      modules: 'Modules & HUD',
      news: 'News',
      versions: 'Versions',
      resources: 'Mods & Resource Packs',
      settings: 'Settings',
      account: 'Account',
    },
    sidebar: {
      operational: 'All systems operational',
      degraded: 'Checking edge status',
      discord: 'Official Discord',
      downloads: 'Download Manager',
    },
    hero: {
      badge: 'NEXT-GEN VISUAL ENGINE',
      line1: 'YOUR GAME.',
      line2: 'YOUR VISION.',
      subtitle:
        'First-class GLSL shaders, draggable HUD 2.0 studio, 144Hz cloth-simulated capes, and razor-sharp frame pacing — built purely for aesthetics.',
      statModules: '38 Visual Modules',
      statEngine: 'GLSL 4.6 + Sodium',
      statSync: 'Cloud Config Sync',
      changelogBtn: 'Customize HUD & Modules',
      versionsBtn: 'Switch Build',
    },
    launchPanel: {
      versionLabel: 'CLIENT VERSION',
      accountLabel: 'ACCOUNT',
      statusLabel: 'STATUS',
      ready: 'Ready to launch',
      running: 'Client active',
      error: 'Transfer failed',
      playButton: 'LAUNCH CLIENT',
      stopButton: 'STOP SESSION',
      retryButton: 'RETRY TRANSFER',
    },
    phases: {
      idle: 'Ready to launch',
      preparing: 'Preparing environment...',
      downloading: 'Downloading dependencies...',
      verifying: 'Verifying SHA-256...',
      launching: 'Launching Minecraft...',
      running: 'Session running',
      error: 'Connection interrupted',
    } as Record<LaunchPhase, string>,
  },
};

export function t(lang: LanguageCode) {
  return UI_COPY[lang];
}
