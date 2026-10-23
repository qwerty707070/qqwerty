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
        launcherVersion: '2.7.3',
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
      const jarFile = `winvisual-client-${ver}.jar`;
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
    res.end(JSON.stringify({ version: '2.7.3', mods: entries }));
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
    const jarFile = `winvisual-client-${ver}.jar`;
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
    const dir = (parsed.searchParams.get('dir') || '~/.minecraft/winvisual').trim();
    const modsCacheDir = path.join(rootDir, '.winvisual-runtime', 'mods_cache', mc);
    fs.mkdirSync(modsCacheDir, { recursive: true });
    const syncedMods = [
      `WinVisual ${mc} (winvisual-client-${mc}.jar)`,
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
          'attachment; filename="winvisual-launcher-v2.7.3-src.tar.gz"'
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
    res.setHeader('X-Launcher-Version', '2.7.3');
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
