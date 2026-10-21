import type { ClientVersion, NewsArticle } from '../types/launcher';

export const GITHUB_RELEASE_URL =
  'https://github.com/qwerty707070/qqwerty/releases/tag/v2.4.2';

export const CANONICAL_VERSIONS: ClientVersion[] = [
  {
    id: 'winvisual-1.21.11',
    name: 'Fabric 1.21.11',
    minecraftVersion: '1.21.11',
    channel: 'stable',
    recommended: true,
    updatedAt: '2026-10-21',
    sizeMb: 30.8,
    loader: 'Fabric • RenderCore 2.4',
    fpsBoost: '+165% FPS',
    modulesCount: 40,
    summaryEn:
      'Latest Minecraft 1.21.11 Fabric visual client build with GPU particle trails, 144Hz GLSL cloth shaders, draggable HUD 2.0, and instant preset hot-reload.',
    summaryRu:
      'Актуальная сборка Fabric 1.21.11 с GPU-частицами следов, кастомными GLSL-шейдерами плащей 144 Гц, адаптивным HUD 2.0 и мгновенной подгрузкой пресетов.',
    highlightsRu: ['Minecraft 1.21.11 Fabric', 'GPU-частицы и HUD 2.0'],
    highlightsEn: ['Minecraft 1.21.11 Fabric', 'GPU Trails & HUD 2.0'],
  },
  {
    id: 'winvisual-1.21.4',
    name: 'Fabric 1.21.4',
    minecraftVersion: '1.21.4',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-19',
    sizeMb: 29.3,
    loader: 'Fabric • RenderCore 2.4',
    fpsBoost: '+148% FPS',
    modulesCount: 38,
    summaryEn:
      'Flagship Minecraft 1.21.4 Fabric build featuring physically shaded HUD panels, custom GLSL hand & cape shaders, 3D skin layers, and zero-stutter chunk batching.',
    summaryRu:
      'Стабильная сборка Fabric 1.21.4: пакетный рендер HUD 2.0, кастомные GLSL-шейдеры рук и плащей, 3D-слои скинов и буферизация чанков без микрофризов.',
    highlightsRu: ['Minecraft 1.21.4 Fabric', 'GLSL шейдеры плащей 144 Гц'],
    highlightsEn: ['Minecraft 1.21.4 Fabric', '144Hz GLSL Cape Physics'],
  },
  {
    id: 'winvisual-1.16.5',
    name: 'Fabric 1.16.5',
    minecraftVersion: '1.16.5',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-04',
    sizeMb: 23.1,
    loader: 'Fabric • LegacyBridge',
    fpsBoost: '+125% FPS',
    modulesCount: 32,
    summaryEn:
      'Dedicated Minecraft 1.16.5 Fabric build with backported RenderCore lighting pipeline, crisp HUD motion blur, Target HUD, and animated cosmetic cloaks.',
    summaryRu:
      'Специальная сборка Fabric 1.16.5 с бэкпортом конвейера освещения RenderCore, плавным Motion Blur без размытия интерфейса, Target HUD и плащами.',
    highlightsRu: ['Minecraft 1.16.5 Fabric', 'Бэкпорт RenderCore + Motion Blur'],
    highlightsEn: ['Minecraft 1.16.5 Fabric', 'RenderCore Backport + Motion Blur'],
  },
];

export const CANONICAL_NEWS: NewsArticle[] = [
  {
    id: 'release-2-4-obsidian',
    featured: true,
    image: '/images/news-release.jpg',
    categoryEn: 'MAJOR UPDATE',
    categoryRu: 'КРУПНЫЙ РЕЛИЗ',
    dateEn: 'October 21, 2026',
    dateRu: '21 октября 2026',
    readTimeEn: '3 min read',
    readTimeRu: '3 мин чтения',
    titleEn: 'WinVisual 2.4.2 — Unified Fabric 1.21.11, 1.21.4 & 1.16.5 Engine',
    titleRu: 'WinVisual 2.4.2 — единый движок для Fabric 1.21.11, 1.21.4 и 1.16.5',
    excerptEn:
      'Rebuilt multi-threaded chunk mesher, modular HUD widgets with sub-pixel snapping, and 40% lower VRAM footprint across Fabric 1.21.11, 1.21.4, and 1.16.5.',
    excerptRu:
      'Переписанный многопоточный мешер чанков, модульные виджеты HUD с субпиксельной привязкой и снижение потребления видеопамяти на 40%.',
    bodyEn: [
      'WinVisual 2.4.2 unifies our RenderCore 2.4 visual pipeline specifically around the three most played Fabric versions: 1.21.11, 1.21.4, and 1.16.5.',
      'Every HUD widget — Armor Status, Potion Timers, Keystrokes, Direction Compass, Ping Histogram, and Frame Time Graph — renders through a single batched instanced draw call.',
      'Preset Code Sync snapshots your layout coordinates, vector crosshair geometry, accent palette, and keybinds into a compact shareable string.',
    ],
    bodyRu: [
      'В WinVisual 2.4.2 графический конвейер RenderCore сфокусирован на трёх ключевых версиях Minecraft Fabric: 1.21.11, 1.21.4 и 1.16.5.',
      'Все виджеты интерфейса — статус брони, таймеры эффектов, панель нажатий, компас, график пинга и фреймтайма — отрисовываются за один пакетный вызов GPU без просадок FPS.',
      'Система пресетов мгновенно упаковывает сетку расположения элементов, геометрию векторного прицела и активные модули в компактный код обмена.',
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
