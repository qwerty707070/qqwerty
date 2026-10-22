import type { ClientVersion, NewsArticle } from '../types/launcher';

export const GITHUB_RELEASE_URL =
  'https://github.com/qwerty707070/qqwerty/releases/tag/v2.6.0';

export const CANONICAL_VERSIONS: ClientVersion[] = [
  {
    id: 'winvisual-1.21.11',
    name: 'Fabric 1.21.11',
    minecraftVersion: '1.21.11',
    channel: 'stable',
    recommended: true,
    updatedAt: '2026-10-22',
    sizeMb: 30.8,
    loader: 'Fabric • RenderCore 2.6',
    fpsBoost: '+165% FPS',
    modulesCount: 40,
    summaryEn:
      'Latest Minecraft 1.21.11 Fabric visual client build with auto-synced Sodium + Iris Shaders, 144Hz GLSL cloth physics, draggable HUD 2.0, and instant disk config sync.',
    summaryRu:
      'Актуальная сборка Fabric 1.21.11 с авто-синхронизацией Sodium + Iris Shaders, GLSL-плащами 144 Гц, адаптивным HUD 2.0 и сохранением конфигов на диск.',
    highlightsRu: ['Minecraft 1.21.11 Fabric', 'Sodium + Iris & HUD 2.0'],
    highlightsEn: ['Minecraft 1.21.11 Fabric', 'Sodium + Iris & HUD 2.0'],
  },
  {
    id: 'winvisual-1.21.4',
    name: 'Fabric 1.21.4',
    minecraftVersion: '1.21.4',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-22',
    sizeMb: 29.3,
    loader: 'Fabric • RenderCore 2.6',
    fpsBoost: '+148% FPS',
    modulesCount: 38,
    summaryEn:
      'Flagship Minecraft 1.21.4 Fabric build featuring physically shaded HUD panels, custom GLSL hand & cape shaders, 3D pixel skin layers, and zero-stutter chunk batching.',
    summaryRu:
      'Стабильная сборка Fabric 1.21.4: пакетный рендер HUD 2.0, кастомные GLSL-шейдеры рук и плащей, пиксельные 3D-слои скинов и буферизация чанков без микрофризов.',
    highlightsRu: ['Minecraft 1.21.4 Fabric', 'GLSL шейдеры плащей 144 Гц'],
    highlightsEn: ['Minecraft 1.21.4 Fabric', '144Hz GLSL Cape Physics'],
  },
  {
    id: 'winvisual-1.16.5',
    name: 'Fabric 1.16.5',
    minecraftVersion: '1.16.5',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-22',
    sizeMb: 23.1,
    loader: 'Fabric • LegacyBridge',
    fpsBoost: '+125% FPS',
    modulesCount: 32,
    summaryEn:
      'Dedicated Minecraft 1.16.5 Fabric build with backported RenderCore lighting pipeline, isolated legacy mod cache, crisp HUD motion blur, Target HUD, and animated cloaks.',
    summaryRu:
      'Специальная сборка Fabric 1.16.5 с бэкпортом конвейера освещения RenderCore, изолированным кэшем модов, плавным Motion Blur, Target HUD и плащами.',
    highlightsRu: ['Minecraft 1.16.5 Fabric', 'Бэкпорт RenderCore + Motion Blur'],
    highlightsEn: ['Minecraft 1.16.5 Fabric', 'RenderCore Backport + Motion Blur'],
  },
];

export const CANONICAL_NEWS: NewsArticle[] = [
  {
    id: 'release-2-6-obsidian',
    featured: true,
    image: '/images/news-release.jpg',
    categoryEn: 'MAJOR UPDATE',
    categoryRu: 'КРУПНЫЙ РЕЛИЗ',
    dateEn: 'October 22, 2026',
    dateRu: '22 октября 2026',
    readTimeEn: '3 min read',
    readTimeRu: '3 мин чтения',
    titleEn: 'WinVisual 2.6 — Native Modrinth Bundle, 3D Pixel Skin Studio & Disk HUD Sync',
    titleRu: 'WinVisual 2.6 — авто-пакет Sodium + Iris, 3D-студия PNG скинов и HUD на диске',
    excerptEn:
      'Automatic per-version Modrinth optimization bundle (Fabric API + Sodium + Iris), real javaw PID lifecycle & instant Stop, custom .png / nickname 3D skin rendering, and automatic winvisual-hud.json disk persistence.',
    excerptRu:
      'Автоматическая установка Fabric API + Sodium + Iris под каждую версию, контроль процесса javaw с мгновенной остановкой, загрузка своих .png скинов в 3D и запись winvisual-hud.json на диск.',
    bodyEn: [
      'WinVisual 2.6 upgrades both the native Rust launcher core and visual studio specifically around Fabric 1.21.11, 1.21.4, and 1.16.5.',
      'Version-isolated Modrinth caching automatically provisions compatible Fabric API, Sodium, Iris Shaders, and Lithium jars without version conflicts when switching builds.',
      'Upload any 64x64 Minecraft skin PNG or load by nickname to preview crisp 3D pixel layers with 144Hz GLSL capes directly on the Home hero stage.',
    ],
    bodyRu: [
      'В WinVisual 2.6 обновлены как нативное ядро Tauri/Rust, так и визуальная студия для трёх сборок Fabric: 1.21.11, 1.21.4 и 1.16.5.',
      'Изолированный кэш модов автоматически подтягивает совместимые Fabric API, Sodium, Iris Shaders и Lithium без конфликтов при переключении версий.',
      'Загружайте любой скин 64x64 .png с диска или по нику игрока — пиксельные 3D-слои мгновенно отображаются в профиле и на главном экране.',
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
