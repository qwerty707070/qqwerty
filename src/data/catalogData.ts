import type { ClientVersion, NewsArticle } from '../types/launcher';

export const GITHUB_RELEASE_URL =
  'https://github.com/qwerty707070/qqwerty/releases/tag/v2.7.0';

export const CANONICAL_VERSIONS: ClientVersion[] = [
  {
    id: 'winvisual-1.21.11',
    name: 'Fabric 1.21.11',
    minecraftVersion: '1.21.11',
    channel: 'stable',
    recommended: true,
    updatedAt: '2026-10-23',
    sizeMb: 31.4,
    loader: 'Fabric • EvoVis + ESP 2.7',
    fpsBoost: '+165% FPS',
    modulesCount: 28,
    summaryEn:
      'Flagship Minecraft 1.21.11 build with embedded winvisual-client-1.21.11.jar: EvoVis 2D/3D ESP, Rotating Minimap, ChinaHat, Crystal Wings, JumpCircles, 11 HUD 2.0 widgets, and Right-Shift Studio.',
    summaryRu:
      'Флагманская сборка 1.21.11 со вшитым модом winvisual-client-1.21.11.jar: полный пакет EvoVis + ESP, миникарта-радар, ChinaHat, 3D-крылья, JumpCircles, 11 виджетов HUD 2.0 и меню Right Shift.',
    highlightsRu: ['Вшитый EvoVis + ESP .jar', 'HUD 2.0 + ChinaHat + Крылья'],
    highlightsEn: ['Embedded EvoVis + ESP .jar', 'HUD 2.0 + ChinaHat + Wings'],
  },
  {
    id: 'winvisual-1.21.4',
    name: 'Fabric 1.21.4',
    minecraftVersion: '1.21.4',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-23',
    sizeMb: 29.9,
    loader: 'Fabric • EvoVis + ESP 2.7',
    fpsBoost: '+148% FPS',
    modulesCount: 28,
    summaryEn:
      'Tournament Minecraft 1.21.4 build with embedded winvisual-client-1.21.4.jar: Player/Item/Pearl ESP, Target HUD 2.0, Keystrokes + CPS, 3D Trails, HitParticles, and live config sync.',
    summaryRu:
      'Турнирная сборка 1.21.4 со вшитым модом winvisual-client-1.21.4.jar: Player/Item/Pearl ESP, Target HUD 2.0, Keystrokes + CPS, 3D-шлейфы, HitParticles и живая синхронизация конфигов.',
    highlightsRu: ['Вшитый EvoVis + ESP .jar', 'Target HUD 2.0 + Pearl ESP'],
    highlightsEn: ['Embedded EvoVis + ESP .jar', 'Target HUD 2.0 + Pearl ESP'],
  },
  {
    id: 'winvisual-1.16.5',
    name: 'Fabric 1.16.5',
    minecraftVersion: '1.16.5',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-23',
    sizeMb: 23.8,
    loader: 'Fabric • EvoVis + ESP 2.7',
    fpsBoost: '+125% FPS',
    modulesCount: 28,
    summaryEn:
      'Classic PvP Minecraft 1.16.5 build with embedded winvisual-client-1.16.5.jar: full parity 28 EvoVisual + ESP modules, 6 neon themes, 3D cosmetics, and Right-Shift ClickGUI.',
    summaryRu:
      'Классическая PvP-сборка 1.16.5 со вшитым модом winvisual-client-1.16.5.jar: все 28 модулей EvoVisual + ESP, 6 тем оформления, 3D-косметика и внутриигровой ClickGUI.',
    highlightsRu: ['Вшитый EvoVis + ESP .jar', 'Полный паритет 28 модулей'],
    highlightsEn: ['Embedded EvoVis + ESP .jar', 'Full 28-Module Parity'],
  },
];

export const CANONICAL_NEWS: NewsArticle[] = [
  {
    id: 'release-2-6-obsidian',
    featured: true,
    image: '/images/news-release.jpg',
    categoryEn: 'MAJOR UPDATE',
    categoryRu: 'КРУПНЫЙ РЕЛИЗ',
    dateEn: 'October 23, 2026',
    dateRu: '23 октября 2026',
    readTimeEn: '3 min read',
    readTimeRu: '3 мин чтения',
    titleEn: 'WinVisual 2.7 — Embedded EvoVisual & ESP Client Mod for Fabric 1.16.5 / 1.21.4 / 1.21.11',
    titleRu: 'WinVisual 2.7 — вшитый визуальный мод EvoVisual + ESP на 1.16.5, 1.21.4 и 1.21.11',
    excerptEn:
      'Compiled Fabric client jars embedded directly in WinVisual Launcher: 28 EvoVisual + ESP modules, 11 draggable HUD 2.0 widgets, ChinaHat, 3D Crystal Wings, JumpCircles, Trails, and Right-Shift Studio.',
    excerptRu:
      'Вшитые прямо в лаунчер Fabric-моды для 1.16.5, 1.21.4 и 1.21.11: 28 модулей EvoVisual + ESP, 11 перетаскиваемых виджетов HUD 2.0, ChinaHat, 3D-крылья, JumpCircles, шлейфы и меню Right Shift.',
    bodyEn: [
      'WinVisual 2.7 ships real compiled Fabric client jars embedded inside every native desktop installer across Minecraft 1.16.5, 1.21.4, and 1.21.11.',
      'Includes full Player/Item/Pearl ESP, Rotating Minimap radar, Target HUD 2.0, ChinaHat 3D halo, Crystal Wings, JumpCircles, 3D Trails, and two-way winvisual-hud.json sync.',
      'Press Right Shift anywhere in-game to open the interactive WinVisual × EvoVisual ClickGUI and drag HUD widgets directly across your screen.',
    ],
    bodyRu: [
      'В WinVisual 2.7 прямо внутрь бинарника лаунчера вшиты скомпилированные Fabric-моды winvisual-client для версий 1.16.5, 1.21.4 и 1.21.11.',
      'Доступны все 28 модулей в стиле EvoVisual + ESP: Player/Item/Pearl ESP, вращающийся радар-миникарта, Target HUD 2.0, 3D ChinaHat, крылья, JumpCircles, 3D-шлейфы и живая синхронизация winvisual-hud.json.',
      'В самой игре нажмите Right Shift, чтобы открыть интерактивное меню WinVisual × EvoVisual и свободно перетаскивать элементы HUD мышкой.',
    ],
  },
  {
    id: 'shader-pipeline-1-21-11',
    featured: false,
    image: '/images/news-shaders.jpg',
    categoryEn: 'ENGINEERING',
    categoryRu: 'ИНЖЕНЕРИЯ',
    dateEn: 'October 12, 2026',
    dateRu: '12 октября 2026',
    readTimeEn: '4 min read',
    readTimeRu: '4 мин чтения',
    titleEn: 'Zero-Overhead Atmospheric Bloom & Volumetric Fog Presets',
    titleRu: 'Атмосферное свечение и объёмный туман без потери кадровой частоты',
    excerptEn:
      'How we engineered half-resolution dual-Kawase bloom and biome-aware horizon grading that runs above 360 FPS on midrange GPUs.',
    excerptRu:
      'Как мы реализовали двухпроходное свечение Kawase и биомную цветокоррекцию горизонта с частотой свыше 360 FPS.',
    bodyEn: [
      'Traditional shader packs sacrifice competitive visibility and input latency. WinVisual solves both with native post-processing passes integrated directly into Fabric.',
      'Switch seamlessly between Evo Atmospheric, Pulse Competitive, or Feather Ultra FPS directly from the Home deck or in-game Right-Shift ClickGUI.',
    ],
    bodyRu: [
      'Тяжёлые шейдер-паки часто ухудшают читаемость сцены и увеличивают задержку ввода. В WinVisual постобработка встроена напрямую в конвейер рендера Fabric.',
      'Переключайтесь между профилями Evo Atmospheric, Pulse Competitive и Feather Ultra FPS прямо на главном экране или в игре по правому Shift.',
    ],
  },
  {
    id: 'cosmetics-season-autumn',
    featured: false,
    image: '/images/news-cosmetics.jpg',
    categoryEn: 'COSMETICS',
    categoryRu: 'КОСМЕТИКА',
    dateEn: 'October 3, 2026',
    dateRu: '3 октября 2026',
    readTimeEn: '2 min read',
    readTimeRu: '2 мин чтения',
    titleEn: 'Nebula Cloth Physics: 144Hz Simulated Capes & Subtle Auras',
    titleRu: 'Физика ткани 144 Гц: коллекция плащей Nebula и деликатные эффекты',
    excerptEn:
      'Spring-mass cloth simulation interpolated at monitor refresh rate, paired with optional clean silhouette mode for competitive duels.',
    excerptRu:
      'Пружинная симуляция ткани с интерполяцией под герцовку монитора и возможностью мгновенного отключения чужих эффектов.',
    bodyEn: [
      'All WinVisual cosmetics follow strict visual discipline: zero blinding neon wings or screen clutter. Every player can toggle cosmetic visibility per category at any time.',
      'Preview Nebula Starlight, Pulse Crimson, Aurora Borealis, and Obsidian Monarch in real time inside the Account 3D Skin & Cape viewer.',
    ],
    bodyRu: [
      'Вся косметика WinVisual следует строгому визуальному коду: никаких слепящих эффектов или визуального шума. Видимость любых элементов настраивается по категориям.',
      'Оцените волновую физику плащей Nebula Starlight, Pulse Crimson, Aurora Borealis и Obsidian Monarch прямо в 3D-просмотрщике раздела «Аккаунт».',
    ],
  },
  {
    id: 'hud-studio-2',
    featured: false,
    image: '/images/news-hud.jpg',
    categoryEn: 'INTERFACE',
    categoryRu: 'ИНТЕРФЕЙС',
    dateEn: 'September 21, 2026',
    dateRu: '21 сентября 2026',
    readTimeEn: '3 min read',
    readTimeRu: '3 мин чтения',
    titleEn: 'HUD Studio 2.0: Drag-and-Drop Viewport & Shareable Config Strings',
    titleRu: 'HUD Studio 2.0: свободное перетаскивание и мгновенный обмен кодами',
    excerptEn:
      'Design pixel-accurate minimalist overlays with live crosshair tuning and one-click preset code sharing.',
    excerptRu:
      'Создавайте выверенные минималистичные оверлеи с живой настройкой прицела и кодами быстрого импорта.',
    bodyEn: [
      'HUD Studio 2.0 unifies typography, corner radius tokens, and backdrop contrast across all client modules so your interface looks native rather than stitched together.',
      'Export any layout as a WINVISUAL-CFG code in one click and test it immediately inside the live interactive viewport.',
    ],
    bodyRu: [
      'HUD Studio 2.0 объединяет типографику, радиусы скругления и контраст подложек во всех модулях, чтобы интерфейс в игре выглядел цельно и благородно.',
      'Экспортируйте готовую раскладку кодом WINVISUAL-CFG в один клик и сразу проверяйте её в интерактивном окне клиента.',
    ],
  },
];
