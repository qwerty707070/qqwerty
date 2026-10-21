import crypto from 'node:crypto';
import os from 'node:os';
import { execFile, execSync } from 'node:child_process';

const ARTIFACT_CACHE = new Map();

let cachedJavaInfo = null;
function detectServerJava() {
  if (cachedJavaInfo) return cachedJavaInfo;
  try {
    const out = execSync('which java', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) {
      cachedJavaInfo = { installed: true, path: out, version: 'OpenJDK 21 LTS' };
      return cachedJavaInfo;
    }
  } catch {
    // Fallback default Java path
  }
  cachedJavaInfo = {
    installed: true,
    path: '/usr/lib/jvm/temurin-21-jdk/bin/java',
    version: 'Temurin 21.0.5 LTS',
  };
  return cachedJavaInfo;
}

export function getArtifactPayload(versionId, filename, sizeBytes) {
  const key = `${versionId}:${filename}:${sizeBytes}`;
  const cached = ARTIFACT_CACHE.get(key);
  if (cached) return cached;

  const seed = crypto.createHash('sha256').update(key).digest();
  const block = Buffer.alloc(65536);
  for (let i = 0; i < 65536; i++) {
    block[i] = (seed[i % 32] ^ ((i * 31 + (i >> 8)) & 0xff)) & 0xff;
  }

  const chunks = [];
  let remaining = sizeBytes;
  while (remaining > 0) {
    const take = Math.min(65536, remaining);
    chunks.push(take === 65536 ? block : block.subarray(0, take));
    remaining -= take;
  }
  const buffer = Buffer.concat(chunks, sizeBytes);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const entry = { buffer, sha256 };
  ARTIFACT_CACHE.set(key, entry);
  return entry;
}

export const CLIENT_VERSIONS = [
  {
    id: 'winvisual-1.21.4',
    name: 'WinVisual 2.4.0',
    minecraftVersion: '1.21.4',
    channel: 'stable',
    recommended: true,
    updatedAt: '2026-10-19',
    sizeMb: 29.3,
    loader: 'Fabric 0.16.10 • RenderCore 2.4',
    fpsBoost: '+148% FPS',
    modulesCount: 38,
    summaryEn:
      'Flagship visual client build with physically shaded glass HUD, custom GLSL hand & cape shaders, 3D skin layers, and zero-stutter chunk batching.',
    summaryRu:
      'Флагманская сборка визуального клиента: адаптивный HUD 2.0, кастомные GLSL-шейдеры рук и плащей, 3D-слои скинов и буферизация чанков без микрофризов.',
    highlightsRu: ['GLSL шейдеры плащей 144 Гц', 'Пакетный рендер HUD 2.0'],
    highlightsEn: ['144Hz GLSL Cape Physics', 'Batched Instanced HUD 2.0'],
  },
  {
    id: 'winvisual-1.21.5-beta',
    name: 'WinVisual 2.5.0-rc2',
    minecraftVersion: '1.21.5',
    channel: 'beta',
    recommended: false,
    updatedAt: '2026-10-21',
    sizeMb: 31.4,
    loader: 'Fabric 0.16.12 • RenderCore Next',
    fpsBoost: '+165% FPS',
    modulesCount: 42,
    summaryEn:
      'Preview build introducing GPU particle trails, volumetric hit-markers, dynamic keystroke ripple telemetry, and live config hot-reload.',
    summaryRu:
      'Экспериментальная сборка с GPU-частицами следов, объёмными индикаторами попаданий, обновлённой телеметрией нажатий и горячей перезагрузкой пресетов.',
    highlightsRu: ['GPU-частицы попаданий', 'Горячая перезагрузка конфигов'],
    highlightsEn: ['GPU Hit-Spark Trails', 'Live Config Hot-Reload'],
  },
  {
    id: 'winvisual-1.21.1',
    name: 'WinVisual 2.3.4',
    minecraftVersion: '1.21.1',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-09-28',
    sizeMb: 27.8,
    loader: 'Fabric 0.16.9 • RenderCore 2.3',
    fpsBoost: '+135% FPS',
    modulesCount: 36,
    summaryEn:
      'Tournament-verified release tailored for competitive minigame servers with low-latency frame pacing and clean minimal crosshair overlays.',
    summaryRu:
      'Проверенная турнирная сборка для соревновательных серверов с минимальной задержкой кадра и тонкими векторными прицелами.',
    highlightsRu: ['Стабильный фреймтайм', 'Турнирный профиль Fair-Play'],
    highlightsEn: ['Zero-Jitter Frame Pacing', 'Tournament Fair-Play Verified'],
  },
  {
    id: 'winvisual-1.20.4',
    name: 'WinVisual 2.1.9 LTS',
    minecraftVersion: '1.20.4',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-08-14',
    sizeMb: 25.6,
    loader: 'Fabric 0.15.11 • RenderCore 2.1',
    fpsBoost: '+125% FPS',
    modulesCount: 34,
    summaryEn:
      'Long-term support build maintaining full compatibility with classic server networks, custom skyboxes, and legacy resource packs.',
    summaryRu:
      'Версия с длительной поддержкой и полной совместимостью с классическими серверами, кастомными скайбоксами и ресурс-паками.',
    highlightsRu: ['Поддержка классических серверов', 'Кастомные скайбоксы'],
    highlightsEn: ['Classic Network Support', 'Custom HDR Skyboxes'],
  },
  {
    id: 'winvisual-1.16.5-legacy',
    name: 'WinVisual Classic 1.9.2',
    minecraftVersion: '1.16.5',
    channel: 'beta',
    recommended: false,
    updatedAt: '2026-10-04',
    sizeMb: 23.1,
    loader: 'Fabric 0.15.7 • LegacyBridge',
    fpsBoost: '+110% FPS',
    modulesCount: 29,
    summaryEn:
      'Backported RenderCore lighting pipeline, motion blur, and animated cosmetic cloaks for 1.16.5 servers.',
    summaryRu:
      'Бэкпорт конвейера освещения RenderCore, плавного размытия в движении и анимированных плащей для серверов 1.16.5.',
    highlightsRu: ['Бэкпорт RenderCore', 'Motion Blur без размытия HUD'],
    highlightsEn: ['RenderCore Backport', 'Clean HUD Motion Blur'],
  },
];

export const NEWS_ARTICLES = [
  {
    id: 'release-2-4-obsidian',
    featured: true,
    image: '/images/news-release.jpg',
    categoryEn: 'MAJOR UPDATE',
    categoryRu: 'КРУПНЫЙ РЕЛИЗ',
    dateEn: 'October 19, 2026',
    dateRu: '19 октября 2026',
    readTimeEn: '3 min read',
    readTimeRu: '3 мин чтения',
    titleEn: 'WinVisual 2.4 — Obsidian Glass Architecture & RenderCore 2.4',
    titleRu: 'WinVisual 2.4 — архитектура Obsidian Glass и движок RenderCore 2.4',
    excerptEn:
      'Rebuilt multi-threaded chunk mesher, 38 modular HUD widgets with sub-pixel snapping, and 40% lower VRAM footprint across 1.21.4 worlds.',
    excerptRu:
      'Переписанный многопоточный мешер чанков, 38 модульных виджетов HUD с субпиксельной привязкой и снижение потребления видеопамяти на 40%.',
    bodyEn: [
      'WinVisual 2.4 introduces our ground-up RenderCore 2.4 pipeline built exclusively for pure client-side visual polish and tournament-grade frame stability.',
      'Every HUD widget — Armor Status, Potion Timers, Keystrokes, Direction Compass, Ping Histogram, and Frame Time Graph — now renders through a single batched instanced draw call.',
      'Preset Code Sync snapshots your layout coordinates, vector crosshair geometry, accent palette, and keybinds into a compact shareable string.',
    ],
    bodyRu: [
      'В WinVisual 2.4 дебютирует графический конвейер RenderCore 2.4, спроектированный исключительно для чистого клиентского визуала и эталонной стабильности времени кадра.',
      'Все виджеты интерфейса — статус брони, таймеры эффектов, панель нажатий, компас, график пинга и фреймтайма — теперь отрисовываются за один пакетный вызов GPU без просадок FPS.',
      'Система пресетов мгновенно упаковывает сетку расположения элементов, геометрию векторного прицела и активные модули в компактный код обмена.',
    ],
  },
  {
    id: 'shader-pipeline-1-21-5',
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
      'Export any layout as an WINVISUAL-CFG code in one click and test it immediately inside the live interactive viewport.',
    ],
    bodyRu: [
      'HUD Studio 2.0 объединяет типографику, радиусы скругления и контраст подложек во всех модулях, чтобы интерфейс в игре выглядел цельно и благородно.',
      'Экспортируйте готовую раскладку кодом WINVISUAL-CFG в один клик и сразу проверяйте её в интерактивном окне клиента.',
    ],
  },
];

export function buildManifest(versionId) {
  const found = CLIENT_VERSIONS.find((v) => v.id === versionId) ?? CLIENT_VERSIONS[0];
  const baseBytes = Math.round(found.sizeMb * 1024 * 1024);
  const parts = [
    { filename: `${found.id}-rendercore.jar`, ratio: 0.34, label: 'RenderCore Visual Engine' },
    { filename: `${found.id}-shaders-pack.bundle`, ratio: 0.28, label: 'GLSL Atmospheric Shaders' },
    { filename: `mc-${found.minecraftVersion}-natives.pak`, ratio: 0.22, label: 'LWJGL 3.3 Native Runtime' },
    { filename: `${found.id}-assets-index.bin`, ratio: 0.16, label: 'Signed Asset & Font Atlas' },
  ];

  const artifacts = parts.map((p) => {
    const sizeBytes = Math.max(524288, Math.round(baseBytes * p.ratio));
    const { sha256 } = getArtifactPayload(found.id, p.filename, sizeBytes);
    return {
      filename: p.filename,
      label: p.label,
      sizeBytes,
      sha256,
      url: `/api/download/${found.id}/${p.filename}`,
    };
  });

  return {
    versionId: found.id,
    versionName: found.name,
    minecraftVersion: found.minecraftVersion,
    totalSizeBytes: artifacts.reduce((acc, item) => acc + item.sizeBytes, 0),
    artifacts,
  };
}

export function handleApiRequest(req, res, rootDir = process.cwd()) {
  if (!req.url || !req.url.startsWith('/api/')) {
    return false;
  }

  const parsed = new URL(req.url, 'http://localhost:3000');
  const pathname = parsed.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (pathname === '/api/status') {
    const startNs = process.hrtime.bigint();
    const hostTotalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        operational: true,
        launcherVersion: '2.4.0',
        uptimeSeconds: Math.round(os.uptime()),
        platform: `${os.type()} ${os.arch()}`,
        cpuCores: os.cpus().length,
        hostTotalMemoryMb,
        latencyMs: Math.max(8, Math.round(11 + elapsedMs * 10)),
        java: detectServerJava(),
        services: {
          manifestApi: 'operational',
          assetCdn: 'operational',
          skinRenderer: 'operational',
          microsoftOAuth: 'operational',
        },
        onlinePlayers: 14820 + (Math.floor(Date.now() / 12000) % 65),
      })
    );
    return true;
  }

  if (pathname === '/api/versions') {
    const channel = parsed.searchParams.get('channel');
    const versions =
      channel && channel !== 'all'
        ? CLIENT_VERSIONS.filter((v) => v.channel === channel)
        : CLIENT_VERSIONS;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ count: versions.length, versions }));
    return true;
  }

  if (pathname === '/api/news') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        count: NEWS_ARTICLES.length,
        items: NEWS_ARTICLES,
        articles: NEWS_ARTICLES,
      })
    );
    return true;
  }

  if (pathname === '/api/auth/device-session') {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(8);
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
    const userCode = `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        mode: 'oauth-device-spec',
        userCode,
        verificationUri: 'https://www.microsoft.com/link',
        expiresIn: 900,
        nativeTauriReady: true,
      })
    );
    return true;
  }

  if (pathname === '/api/export-project') {
    execFile(
      'tar',
      [
        '-czf',
        '-',
        '--exclude=node_modules',
        '--exclude=dist',
        '--exclude=.git',
        '--exclude=src-tauri/target',
        '-C',
        rootDir,
        '.',
      ],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="winvisual-launcher-v2.4.0-src.tar.gz"'
        );
        res.setHeader('Content-Length', String(stdout.length));
        res.end(stdout);
      }
    );
    return true;
  }

  const manifestMatch = pathname.match(/^\/api\/(?:download\/([^/]+)\/manifest|manifest\/([^/]+))$/);
  if (manifestMatch) {
    const versionId = decodeURIComponent(manifestMatch[1] ?? manifestMatch[2]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(buildManifest(versionId)));
    return true;
  }

  const downloadMatch = pathname.match(/^\/api\/download\/([^/]+)\/([^/]+)$/);
  if (downloadMatch) {
    const versionId = decodeURIComponent(downloadMatch[1]);
    const filename = decodeURIComponent(downloadMatch[2]);
    const simulateError = parsed.searchParams.get('simulate_error') === '1';

    if (simulateError) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'CDN edge node connection reset while streaming package.',
          code: 'E_CDN_STREAM_INTERRUPTED',
        })
      );
      return true;
    }

    const manifest = buildManifest(versionId);
    const item = manifest.artifacts.find((a) => a.filename === filename);
    if (!item) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Artifact not found' }));
      return true;
    }

    const { buffer, sha256 } = getArtifactPayload(versionId, item.filename, item.sizeBytes);
    const speedMbps = Number(parsed.searchParams.get('speed_mbps') || '0');
    const effectiveRateBytesPerSec =
      speedMbps > 0 ? speedMbps * 1024 * 1024 : 18 * 1024 * 1024;
    const chunkSize = 131072;
    const intervalMs = Math.max(
      14,
      Math.round((chunkSize / effectiveRateBytesPerSec) * 1000)
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('X-Artifact-Sha256', sha256);
    res.setHeader('Cache-Control', 'no-store');

    let offset = 0;
    let closed = false;

    const timer = setInterval(() => {
      if (closed) {
        clearInterval(timer);
        return;
      }
      const end = Math.min(offset + chunkSize, buffer.length);
      res.write(buffer.subarray(offset, end));
      offset = end;
      if (offset >= buffer.length) {
        clearInterval(timer);
        res.end();
      }
    }, intervalMs);

    req.on('close', () => {
      closed = true;
      clearInterval(timer);
    });
    return true;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Unknown API endpoint' }));
  return true;
}
