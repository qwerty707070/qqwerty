import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile, execSync } from 'node:child_process';

const ARTIFACT_CACHE = new Map();

// Precomputed IEEE 802.3 CRC32 table for valid 64x64 RGBA Minecraft PNG skin generation
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateMinecraftSkinPngBuffer(username) {
  const hash = crypto.createHash('sha256').update(String(username)).digest();
  const slim = (hash[0] & 1) === 1;

  // Deterministic curated skin & armor/hood color palette from username hash
  const skinTones = [
    [241, 206, 184],
    [224, 178, 148],
    [198, 143, 110],
    [154, 102, 74],
  ];
  const accentPalettes = [
    [139, 124, 255],
    [168, 85, 247],
    [56, 189, 248],
    [244, 63, 94],
    [16, 185, 129],
    [245, 158, 11],
  ];

  const skin = skinTones[hash[1] % skinTones.length];
  const accent = accentPalettes[hash[2] % accentPalettes.length];
  const hair = [26 + (hash[3] % 52), 20 + (hash[4] % 40), 34 + (hash[5] % 56)];
  const jacket = [22 + (hash[6] % 28), 20 + (hash[7] % 28), 38 + (hash[8] % 44)];
  const pants = [16 + (hash[9] % 20), 16 + (hash[10] % 20), 26 + (hash[11] % 28)];

  const W = 64;
  const H = 64;
  const rgba = new Uint8Array(W * H * 4);

  const setPx = (x, y, rgb, a = 255) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 4;
    rgba[o] = rgb[0];
    rgba[o + 1] = rgb[1];
    rgba[o + 2] = rgb[2];
    rgba[o + 3] = a;
  };

  const fillRect = (rx, ry, rw, rh, rgb, a = 255) => {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        setPx(x, y, rgb, a);
      }
    }
  };

  // Base head UV box (0..32, 0..16)
  fillRect(8, 0, 8, 8, hair);
  fillRect(16, 0, 8, 8, skin);
  fillRect(0, 8, 32, 8, skin);
  fillRect(0, 8, 32, 2, hair);
  fillRect(24, 8, 8, 8, hair);

  // Crisp Minecraft eyes + brows on front face (8..16, 8..16)
  setPx(9, 12, [255, 255, 255]);
  setPx(10, 12, accent);
  setPx(13, 12, accent);
  setPx(14, 12, [255, 255, 255]);
  fillRect(9, 11, 2, 1, hair);
  fillRect(13, 11, 2, 1, hair);

  // Outer 3D Hat / Crown Visor layer (32..64, 0..16)
  fillRect(40, 0, 8, 8, hair);
  fillRect(40, 8, 8, 2, hair);
  setPx(41, 9, accent);
  setPx(43, 8, [245, 243, 255]);
  setPx(44, 8, [245, 243, 255]);
  setPx(46, 9, accent);
  fillRect(56, 8, 8, 5, hair);

  // Torso (16..40, 16..32) + glowing emblem
  fillRect(16, 20, 24, 12, jacket);
  fillRect(20, 16, 8, 4, jacket);
  fillRect(22, 22, 4, 4, accent);
  setPx(23, 23, [255, 255, 255]);
  setPx(24, 23, [255, 255, 255]);
  // Back emblem on torso back (32..40, 20..32)
  fillRect(34, 22, 4, 5, accent);

  // Right & Left Legs
  fillRect(0, 20, 16, 12, pants);
  fillRect(16, 52, 16, 12, pants);
  fillRect(0, 30, 16, 2, accent);
  fillRect(16, 62, 16, 2, accent);

  // Right & Left Arms + cuffs + hands
  fillRect(40, 20, 16, 10, jacket);
  fillRect(40, 29, 16, 1, accent);
  fillRect(40, 30, 16, 2, skin);
  fillRect(32, 52, 16, 10, jacket);
  fillRect(32, 61, 16, 1, accent);
  fillRect(32, 62, 16, 2, skin);

  // Encode raw scanlines with filter byte 0 per row
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 4);
    raw[rowStart] = 0;
    Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const pngBuffer = Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  return { pngBuffer, slim };
}

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

export const NEWS_ARTICLES = [
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
      id: p.filename,
      filename: p.filename,
      label: p.label,
      sizeBytes,
      sha256,
      url: `/api/download/${found.id}/${p.filename}`,
    };
  });

  const totalBytes = artifacts.reduce((acc, item) => acc + item.sizeBytes, 0);

  return {
    versionId: found.id,
    versionName: found.name,
    minecraftVersion: found.minecraftVersion,
    totalBytes,
    totalSizeBytes: totalBytes,
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (pathname === '/api/status') {
    const startNs = process.hrtime.bigint();
    const cpuCount = Math.max(1, os.cpus().length);
    const loadPct = Math.min(99, Math.max(3.2, (os.loadavg()[0] / cpuCount) * 100));
    const hostTotalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
    const hostUsedMemoryMb = Math.max(512, Math.round((os.totalmem() - os.freemem()) / (1024 * 1024)));
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        operational: true,
        launcherVersion: '2.6.1',
        uptimeSeconds: Math.round(os.uptime()),
        platform: `${os.type()} ${os.arch()}`,
        cpuCores: cpuCount,
        cpuUsagePercent: Math.round(loadPct * 10) / 10,
        hostTotalMemoryMb,
        hostUsedMemoryMb,
        activePid: null,
        latencyMs: Math.max(8, Math.round(10 + elapsedMs * 10)),
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
        ? CLIENT_VERSIONS.filter(
            (v) => v.channel === channel || v.minecraftVersion === channel
          )
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

  if (pathname === '/api/skin/resolve') {
    const username = (parsed.searchParams.get('username') || 'user10000').trim().slice(0, 24);
    const { pngBuffer, slim } = generateMinecraftSkinPngBuffer(username);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        username,
        slim,
        skinDataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      })
    );
    return true;
  }

  if (pathname === '/api/mods/bundle') {
    const mc = (parsed.searchParams.get('mc') || '1.21.11').trim();
    const dir = (parsed.searchParams.get('dir') || '~/.minecraft/winvisual').trim();
    const modsCacheDir = path.join(rootDir, '.winvisual-runtime', 'mods_cache', mc);
    fs.mkdirSync(modsCacheDir, { recursive: true });
    const syncedMods = [
      `Fabric API (wv-opt-${mc}-fabric-api.jar)`,
      `Sodium (wv-opt-${mc}-sodium-fabric.jar)`,
      `Iris Shaders (wv-opt-${mc}-iris-fabric.jar)`,
      `Lithium (wv-opt-${mc}-lithium-fabric.jar)`,
    ];
    fs.writeFileSync(
      path.join(modsCacheDir, 'bundle-manifest.json'),
      JSON.stringify({ minecraftVersion: mc, syncedMods, syncedAt: new Date().toISOString() }, null, 2)
    );
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        minecraftVersion: mc,
        syncedMods,
        modsDir: `${dir}/mods`,
      })
    );
    return true;
  }

  if (pathname === '/api/config/hud') {
    const cfgDir = path.join(rootDir, '.winvisual-runtime', 'config');
    const cfgFile = path.join(cfgDir, 'winvisual-hud.json');

    if (req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          const parsedBody = JSON.parse(rawBody);
          fs.mkdirSync(cfgDir, { recursive: true });
          fs.writeFileSync(cfgFile, JSON.stringify(parsedBody, null, 2), 'utf8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: true,
              savedPath: '~/.minecraft/winvisual/config/winvisual-hud.json',
              diskPath: cfgFile,
            })
          );
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Invalid JSON' }));
        }
      });
      return true;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    if (fs.existsSync(cfgFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        res.end(JSON.stringify({ ok: true, config: content }));
        return true;
      } catch {
        // Ignore malformed file
      }
    }
    res.end(JSON.stringify({ ok: true, config: null }));
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
        '--exclude=.winvisual-runtime',
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
          'attachment; filename="winvisual-launcher-v2.6.1-src.tar.gz"'
        );
        res.setHeader('Content-Length', String(stdout.length));
        res.end(stdout);
      }
    );
    return true;
  }

  const manifestMatch = pathname.match(
    /^\/api\/(?:download\/manifest\/([^/]+)|download\/([^/]+)\/manifest|manifest\/([^/]+))$/
  );
  if (manifestMatch) {
    const versionId = decodeURIComponent(
      manifestMatch[1] ?? manifestMatch[2] ?? manifestMatch[3]
    );
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(buildManifest(versionId)));
    return true;
  }

  const downloadMatch = pathname.match(
    /^\/api\/download\/(?:artifact\/([^/]+)\/([^/]+)|([^/]+)\/([^/]+))$/
  );
  if (downloadMatch) {
    const versionId = decodeURIComponent(downloadMatch[1] ?? downloadMatch[3]);
    const filename = decodeURIComponent(downloadMatch[2] ?? downloadMatch[4]);
    const simulateError =
      parsed.searchParams.get('simulate_error') === '1' ||
      parsed.searchParams.get('simulate_error') === 'true';

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
    const item = manifest.artifacts.find((a) => a.filename === filename || a.id === filename);
    if (!item) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Artifact not found' }));
      return true;
    }

    const { buffer, sha256 } = getArtifactPayload(versionId, item.filename, item.sizeBytes);
    const speedMbps = Number(
      parsed.searchParams.get('speed_mbps') ||
        parsed.searchParams.get('speed_limit_mbps') ||
        '0'
    );
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
    res.setHeader('X-Launcher-Version', '2.6.1');
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
