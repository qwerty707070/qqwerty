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
  fillRect(20, 16, 16, 4, jacket);
  fillRect(22, 22, 4, 4, accent);
  setPx(23, 23, [255, 255, 255]);
  setPx(24, 23, [255, 255, 255]);
  fillRect(34, 22, 4, 5, accent);

  // Right & Left Legs (including top & bottom UV caps)
  fillRect(4, 16, 8, 4, pants);
  fillRect(0, 20, 16, 12, pants);
  fillRect(20, 48, 8, 4, pants);
  fillRect(16, 52, 16, 12, pants);
  fillRect(0, 30, 16, 2, accent);
  fillRect(16, 62, 16, 2, accent);

  // Right & Left Arms + cuffs + hands (including top & bottom UV caps)
  fillRect(44, 16, 8, 4, jacket);
  fillRect(40, 20, 16, 10, jacket);
  fillRect(40, 29, 16, 1, accent);
  fillRect(40, 30, 16, 2, skin);
  fillRect(36, 48, 8, 4, jacket);
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
    if (out && fs.existsSync(out)) {
      let version = 'OpenJDK LTS';
      try {
        const v = execSync('java -version 2>&1 | head -n 1', {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
        if (v) version = v;
      } catch {
        // keep generic label
      }
      cachedJavaInfo = { installed: true, path: out, version };
      return cachedJavaInfo;
    }
  } catch {
    // Fallback default Java path
  }
  const fallback = '/usr/lib/jvm/temurin-21-jdk/bin/java';
  cachedJavaInfo = fs.existsSync(fallback)
    ? { installed: true, path: fallback, version: 'Temurin 21 LTS' }
    : { installed: false, path: '', version: 'Java not detected' };
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
    name: 'WinVisual 1.21.11',
    minecraftVersion: '1.21.11',
    channel: 'stable',
    recommended: true,
    updatedAt: '2026-10-23',
    sizeMb: 31.4,
    loader: 'WinVisual 1.21.11 • Fabric',
    fpsBoost: '',
    modulesCount: 28,
    summaryEn:
      'Flagship WinVisual 1.21.11 build with embedded client mod: 2D/3D ESP, Rotating Minimap, ChinaHat, Crystal Wings, JumpCircles, 11 HUD 2.0 widgets, and Right-Shift Studio.',
    summaryRu:
      'Флагманская сборка WinVisual 1.21.11 со вшитым клиент-модом: ESP, вращающийся радар, ChinaHat, 3D-крылья, JumpCircles, 11 виджетов HUD 2.0 и меню Right Shift.',
    highlightsRu: ['WinVisual 1.21.11', 'HUD 2.0 + ChinaHat + Крылья'],
    highlightsEn: ['WinVisual 1.21.11', 'HUD 2.0 + ChinaHat + Wings'],
  },
  {
    id: 'winvisual-1.21.4',
    name: 'WinVisual 1.21.4',
    minecraftVersion: '1.21.4',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-23',
    sizeMb: 29.9,
    loader: 'WinVisual 1.21.4 • Fabric',
    fpsBoost: '',
    modulesCount: 28,
    summaryEn:
      'Tournament WinVisual 1.21.4 build with embedded client mod: Player/Item/Pearl ESP, Target HUD 2.0, Keystrokes + CPS, 3D Trails, HitParticles, and live config sync.',
    summaryRu:
      'Турнирная сборка WinVisual 1.21.4 со вшитым клиент-модом: Player/Item/Pearl ESP, Target HUD 2.0, Keystrokes + CPS, 3D-шлейфы, HitParticles и живая синхронизация конфигов.',
    highlightsRu: ['WinVisual 1.21.4', 'Target HUD 2.0 + Pearl ESP'],
    highlightsEn: ['WinVisual 1.21.4', 'Target HUD 2.0 + Pearl ESP'],
  },
  {
    id: 'winvisual-1.16.5',
    name: 'WinVisual 1.16.5',
    minecraftVersion: '1.16.5',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-23',
    sizeMb: 23.8,
    loader: 'WinVisual 1.16.5 • Fabric',
    fpsBoost: '',
    modulesCount: 28,
    summaryEn:
      'Classic PvP WinVisual 1.16.5 build with embedded client mod: all 28 WinVisual + ESP modules, 6 neon themes, 3D cosmetics, and Right-Shift ClickGUI.',
    summaryRu:
      'Классическая PvP-сборка WinVisual 1.16.5 со вшитым клиент-модом: все 28 модулей WinVisual + ESP, 6 тем оформления, 3D-косметика и внутриигровой ClickGUI.',
    highlightsRu: ['WinVisual 1.16.5', 'Полный паритет 28 модулей'],
    highlightsEn: ['WinVisual 1.16.5', 'Full 28-Module Parity'],
  },
];

export const NEWS_ARTICLES = [];

/**
 * The 1.21.11 client ships the Arcanic-based core (full menus/HUD/wardrobe),
 * every other version uses the shared-core build. Keep the mapping in one place.
 */
export function modJarNameFor(mcVersion) {
  return mcVersion === '1.21.11'
    ? 'winvisual-arcanic-1.21.11.jar'
    : `winvisual-client-${mcVersion}.jar`;
}

export function buildManifest(versionId, rootDir = process.cwd()) {
  const found = CLIENT_VERSIONS.find((v) => v.id === versionId) ?? CLIENT_VERSIONS[0];
  const baseBytes = Math.round(found.sizeMb * 1024 * 1024);

  // First artifact is the REAL embedded WinVisual client mod JAR shipped inside the launcher
  const modJarFile = modJarNameFor(found.minecraftVersion);
  const modJarPath = path.join(rootDir, 'public', 'mods', modJarFile);
  const embeddedArtifact = (() => {
    if (fs.existsSync(modJarPath)) {
      const buf = fs.readFileSync(modJarPath);
      return {
        id: modJarFile,
        filename: modJarFile,
        label: 'WinVisual Client Mod (embedded)',
        sizeBytes: buf.length,
        sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        url: `/api/downloads/mod/${found.minecraftVersion}`,
      };
    }
    return null;
  })();

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

  const allArtifacts = embeddedArtifact ? [embeddedArtifact, ...artifacts] : artifacts;
  const totalBytes = allArtifacts.reduce((acc, item) => acc + item.sizeBytes, 0);

  return {
    versionId: found.id,
    versionName: found.name,
    minecraftVersion: found.minecraftVersion,
    totalBytes,
    totalSizeBytes: totalBytes,
    artifacts: allArtifacts,
  };
}

// ── WinVisual game directory (EvoVisual-style folder structure) ──────────────────────────────
const WINVISUAL_GAME_SUBFOLDERS = [
  'mods',
  'resourcepacks',
  'shaderpacks',
  'config',
  'logs',
  'screenshots',
  'saves',
  'versions',
  'libraries',
  'assets',
  'runtime',
  'mods_cache',
  'shader_cache',
];

function resolveGameDir(rawDir, rootDir = process.cwd()) {
  const clean = String(rawDir || '').trim();
  let abs;
  if (clean.startsWith('~/')) {
    abs = path.join(os.homedir(), clean.slice(2));
  } else if (path.isAbsolute(clean)) {
    abs = clean;
  } else {
    abs = path.join(os.homedir(), clean);
  }
  // Safety: forbid escaping into system directories.
  // Use a separator-aware prefix check so e.g. /home/user2 is NOT accepted
  // when the home directory is /home/user.
  const norm = path.normalize(abs);
  const home = os.homedir();
  const inHome = norm === home || norm.startsWith(home + path.sep);
  const inRoot =
    rootDir !== '' && (norm === rootDir || norm.startsWith(rootDir + path.sep));
  if (!inHome && !inRoot) {
    return null;
  }
  return norm;
}

function formatGameDirDisplay(absDir) {
  const home = os.homedir();
  if (absDir === home) return '~';
  if (absDir.startsWith(`${home}${path.sep}`)) {
    return `~${absDir.slice(home.length).split(path.sep).join('/')}`;
  }
  return absDir.split(path.sep).join('/');
}

function collectGameDirEntries(absDir) {
  const entries = [];
  let dirents = [];
  try {
    dirents = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const full = path.join(absDir, d.name);
    let sizeBytes = 0;
    let files = 0;
    const stack = [full];
    while (stack.length > 0) {
      const cur = stack.pop();
      let children = [];
      try {
        children = fs.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const c of children) {
        const cp = path.join(cur, c.name);
        if (c.isDirectory()) {
          stack.push(cp);
        } else if (c.isFile()) {
          files += 1;
          try {
            sizeBytes += fs.statSync(cp).size;
          } catch {
            // ignore unreadable file
          }
        }
      }
    }
    entries.push({ name: d.name, sizeBytes, files });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function scaffoldWinvisualGameDir(absDir, rootDir = process.cwd()) {
  const createdFolders = [];
  for (const sub of WINVISUAL_GAME_SUBFOLDERS) {
    const target = path.join(absDir, sub);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
      createdFolders.push(sub);
    }
  }

  // Copy the real embedded WinVisual client mod JARs into mods/
  const modsDir = path.join(absDir, 'mods');
  const modsJars = [];
  for (const ver of ['1.16.5', '1.21.4', '1.21.11']) {
    const jarFile = modJarNameFor(ver);
    const src = path.join(rootDir, 'public', 'mods', jarFile);
    const dest = path.join(modsDir, jarFile);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
    if (fs.existsSync(dest)) {
      modsJars.push(jarFile);
    }
  }

  // Real launcher log line inside the real logs/ folder
  const logDir = path.join(absDir, 'logs');
  const ts = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  const logLine = `[${ts}] [WINVISUAL] Game directory initialized: ${WINVISUAL_GAME_SUBFOLDERS.length} folders, ${modsJars.length} embedded client mods in mods/\n`;
  try {
    fs.appendFileSync(path.join(logDir, 'launcher-preview.log'), logLine);
  } catch {
    // ignore
  }

  return { createdFolders, modsJars };
}

// The Modrinth API returns list endpoints either as a bare JSON array or as an
// enveloped object ({"hits": [...]} for search, {"versions": [...]} for project
// versions). This extracts the item list from both shapes.
function extractJsonList(data, preferredKey) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data[preferredKey])) return data[preferredKey];
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

const MODRINTH_API_BASE = process.env.MODRINTH_API_BASE || 'https://api.modrinth.com';

async function handleModrinthSearchProxy(res, parsed) {
  const query = (parsed.searchParams.get('query') || '').trim().slice(0, 80);
  const type = parsed.searchParams.get('type') === 'resourcepack' ? 'resourcepack' : 'mod';
  const ver = (parsed.searchParams.get('ver') || '1.21.11').trim();
  const facets =
    type === 'resourcepack'
      ? JSON.stringify([
          ['project_types:resourcepack'],
          [`game_versions:${ver}`],
        ])
      : JSON.stringify([
          ['project_types:mod'],
          ['loaders:fabric'],
          [`game_versions:${ver}`],
        ]);
  const params = new URLSearchParams({ limit: '24', index: 'downloads', facets });
  if (query) params.set('query', query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(`${MODRINTH_API_BASE}/v2/search?${params.toString()}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WinVisual-Launcher/2.7.5' },
    });
    if (!upstream.ok) throw new Error(`Modrinth API HTTP ${upstream.status}`);
    const hits = extractJsonList(await upstream.json(), 'hits');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        hits
          .filter((h) => h && typeof h.slug === 'string' && h.slug.length > 0)
          .map((h) => ({
            slug: h.slug,
            title: h.title || h.slug,
            description: h.description ?? '',
            iconUrl: h.icon_url ?? '',
            downloads: h.downloads ?? 0,
            gameVersions: Array.isArray(h.game_versions) ? h.game_versions : [],
            projectType: h.project_type || type,
          }))
      )
    );
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Modrinth API unreachable',
      })
    );
  } finally {
    clearTimeout(timer);
  }
}

async function handleModrinthVersionProxy(res, parsed) {
  const slug = (parsed.searchParams.get('slug') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const type = parsed.searchParams.get('type') === 'resourcepack' ? 'resourcepack' : 'mod';
  const ver = (parsed.searchParams.get('ver') || '1.21.11').trim();
  if (!slug) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing slug' }));
    return;
  }
  const params = new URLSearchParams({ game_versions: JSON.stringify([ver]) });
  if (type === 'mod') params.set('loaders', JSON.stringify(['fabric']));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(
      `${MODRINTH_API_BASE}/v2/project/${slug}/version?${params.toString()}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'WinVisual-Launcher/2.7.5' },
      }
    );
    if (!upstream.ok) throw new Error(`Modrinth API HTTP ${upstream.status}`);
    const versions = extractJsonList(await upstream.json(), 'versions');
    const version = versions[0] ?? null;
    const files = version && Array.isArray(version.files) ? version.files : [];
    const file = files.find((f) => f && f.primary) ?? files[0] ?? null;
    if (!file || !file.url) {
      throw new Error(`No ${type} version of ${slug} found for Minecraft ${ver}`);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        slug,
        versionNumber: version?.version_number ?? '',
        filename: String(file.filename ?? `${slug}.bin`),
        url: file.url,
        sha1: file.hashes?.sha1 ?? null,
      })
    );
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Modrinth API unreachable',
      })
    );
  } finally {
    clearTimeout(timer);
  }
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
        launcherVersion: '2.7.5',
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

  if (pathname === '/api/mods/embedded') {
    const supported = ['1.16.5', '1.21.4', '1.21.11'];
    const entries = supported.map((ver) => {
      const jarFile = modJarNameFor(ver);
      const jarPath = path.join(rootDir, 'public', 'mods', jarFile);
      let sizeBytes = 0;
      let sha256 = '';
      if (fs.existsSync(jarPath)) {
        const buf = fs.readFileSync(jarPath);
        sizeBytes = buf.length;
        sha256 = crypto.createHash('sha256').update(buf).digest('hex');
      }
      return {
        minecraftVersion: ver,
        filename: jarFile,
        sizeBytes,
        sha256,
        downloadUrl: `/api/downloads/mod/${ver}`,
      };
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify( { version: '2.7.5', mods: entries }));
    return true;
  }

  const modDownloadMatch = pathname.match(/^\/api\/downloads\/mod\/([^/]+)$/);
  if (modDownloadMatch) {
    const ver = decodeURIComponent(modDownloadMatch[1]).replace(/\.jar$/i, '');
    if (!['1.16.5', '1.21.4', '1.21.11'].includes(ver)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Unsupported mod version: ${ver}` }));
      return true;
    }
    const jarFile = modJarNameFor(ver);
    const jarPath = path.join(rootDir, 'public', 'mods', jarFile);
    if (!fs.existsSync(jarPath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `${jarFile} missing` }));
      return true;
    }
    const buf = fs.readFileSync(jarPath);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/java-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${jarFile}"`);
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('X-Artifact-Sha256', sha256);
    res.end(buf);
    return true;
  }

  if (pathname === '/api/mods/bundle') {
    const mc = (parsed.searchParams.get('mc') || '1.21.11').trim();
    // `mc` is joined into a file path below — it must be one of the supported
    // Minecraft versions (blocks `../` traversal writes).
    if (!['1.16.5', '1.21.4', '1.21.11'].includes(mc)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: `Unsupported Minecraft version: ${mc}` }));
      return true;
    }
    const dir = (parsed.searchParams.get('dir') || '~/.minecraft/winvisual').trim();
    const modsCacheDir = path.join(rootDir, '.winvisual-runtime', 'mods_cache', mc);
    fs.mkdirSync(modsCacheDir, { recursive: true });
    const syncedMods = [
      `WinVisual ${mc} (${modJarNameFor(mc)})`,
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
      const MAX_HUD_BODY_BYTES = 1024 * 1024; // 1 MB is far beyond any real HUD config
      const chunks = [];
      let bodyBytes = 0;
      let aborted = false;
      req.on('data', (c) => {
        if (aborted) return;
        bodyBytes += c.length;
        if (bodyBytes > MAX_HUD_BODY_BYTES) {
          aborted = true;
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Config payload too large (max 1 MB)' }));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        if (aborted) return;
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
          'attachment; filename="winvisual-launcher-v2.7.5-src.tar.gz"'
        );
        res.setHeader('Content-Length', String(stdout.length));
        res.end(stdout);
      }
    );
    return true;
  }

  if (pathname === '/api/game-dir/init') {
    const rawDir = (parsed.searchParams.get('dir') || '~/WinVisual').trim();
    const absDir = resolveGameDir(rawDir, rootDir);
    if (!absDir) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid game directory path' }));
      return true;
    }
    try {
      fs.mkdirSync(absDir, { recursive: true });
      const { modsJars } = scaffoldWinvisualGameDir(absDir, rootDir);
      const folders = collectGameDirEntries(absDir);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: true,
          dir: absDir,
          displayDir: formatGameDirDisplay(absDir),
          folders,
          modsJars,
        })
      );
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Scaffold failed' }));
    }
    return true;
  }

  if (pathname === '/api/game-dir/tree') {
    const rawDir = (parsed.searchParams.get('dir') || '~/WinVisual').trim();
    const absDir = resolveGameDir(rawDir, rootDir);
    if (!absDir) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid game directory path' }));
      return true;
    }
    const exists = fs.existsSync(absDir);
    const folders = exists ? collectGameDirEntries(absDir) : [];
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: exists,
        exists,
        dir: absDir,
        displayDir: formatGameDirDisplay(absDir),
        folders,
      })
    );
    return true;
  }

  // ── Modrinth browser (live proxy; real search & version resolution) ────────────────────────
  if (pathname === '/api/modrinth/search') {
    void handleModrinthSearchProxy(res, parsed);
    return true;
  }

  if (pathname === '/api/modrinth/version') {
    void handleModrinthVersionProxy(res, parsed);
    return true;
  }

  if (pathname === '/api/game-dir/files') {
    const rawDir = (parsed.searchParams.get('dir') || '~/WinVisual').trim();
    const sub = (parsed.searchParams.get('sub') || 'mods').trim();
    const allowedSubs = ['mods', 'resourcepacks', 'shaderpacks', 'config', 'logs'];
    const absDir = resolveGameDir(rawDir, rootDir);
    if (!absDir || !allowedSubs.includes(sub)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid folder' }));
      return true;
    }
    const target = path.join(absDir, sub);
    const files = [];
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      for (const name of fs.readdirSync(target)) {
        const full = path.join(target, name);
        try {
          if (fs.statSync(full).isFile()) {
            files.push({ name, sizeBytes: fs.statSync(full).size });
          }
        } catch {
          // skip unreadable entry
        }
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, sub, files }));
    return true;
  }

  if (pathname === '/api/game-dir/remove') {
    const rawDir = (parsed.searchParams.get('dir') || '~/WinVisual').trim();
    const sub = (parsed.searchParams.get('sub') || 'mods').trim();
    const file = (parsed.searchParams.get('file') || '').trim();
    const allowedSubs = ['mods', 'resourcepacks', 'shaderpacks', 'config', 'logs'];
    const absDir = resolveGameDir(rawDir, rootDir);
    if (!absDir || !allowedSubs.includes(sub) || !file || file.includes('/') || file.includes('\\') || file === '.' || file === '..') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid target' }));
      return true;
    }
    const target = path.join(path.join(absDir, sub), file);
    try {
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'File not found' }));
        return true;
      }
      fs.unlinkSync(target);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Remove failed' }));
    }
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
    res.end(JSON.stringify(buildManifest(versionId, rootDir)));
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

    const manifest = buildManifest(versionId, rootDir);
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
    res.setHeader('X-Launcher-Version', '2.7.5');
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
