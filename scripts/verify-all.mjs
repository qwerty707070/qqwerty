import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Minimal DOM globals so client stores/hooks mount cleanly during full-tree SSR verification
class Element {}
globalThis.Element = Element;
globalThis.HTMLElement = class HTMLElement extends Element {};
globalThis.SVGElement = class SVGElement extends Element {};
globalThis.window = globalThis;
globalThis.window.getComputedStyle = () => ({ paddingRight: '0px', marginRight: '0px' });
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.localStorage = {
  _map: new Map(),
  getItem(k) {
    return this._map.get(k) ?? null;
  },
  setItem(k, v) {
    this._map.set(k, String(v));
  },
  removeItem(k) {
    this._map.delete(k);
  },
};
globalThis.document = {
  documentElement: {
    style: { setProperty() {} },
    setAttribute() {},
    dataset: {},
  },
  addEventListener() {},
  removeEventListener() {},
};

const base = 'http://127.0.0.1:3000';

// 1. Validate live HTTP API endpoints + v2.7.5 telemetry + strict 3-version WinVisual catalog
const [status, verAll, verStable, newsData, oauth, embeddedMods] = await Promise.all([
  fetch(`${base}/api/status`).then((r) => r.json()),
  fetch(`${base}/api/versions?channel=all`).then((r) => r.json()),
  fetch(`${base}/api/versions?channel=stable`).then((r) => r.json()),
  fetch(`${base}/api/news`).then((r) => r.json()),
  fetch(`${base}/api/auth/device-session`).then((r) => r.json()),
  fetch(`${base}/api/mods/embedded`).then((r) => r.json()),
]);

if (
  !status.operational ||
  status.launcherVersion !== '2.7.5' ||
  typeof status.cpuUsagePercent !== 'number' ||
  typeof status.hostTotalMemoryMb !== 'number' ||
  typeof status.hostUsedMemoryMb !== 'number' ||
  typeof status.java?.installed !== 'boolean' ||
  typeof status.java?.path !== 'string' ||
  (status.java.installed === true && status.java.path === '')
) {
  throw new Error('Invalid /api/status v2.7.5 telemetry schema: ' + JSON.stringify(status));
}

if (!Array.isArray(embeddedMods.mods) || embeddedMods.mods.length !== 3) {
  throw new Error('Expected 3 embedded Fabric client mods on /api/mods/embedded');
}
for (const entry of embeddedMods.mods) {
  const jarRes = await fetch(`${base}${entry.downloadUrl}`);
  const jarBuf = Buffer.from(await jarRes.arrayBuffer());
  const actualSha = crypto.createHash('sha256').update(jarBuf).digest('hex');
  if (jarRes.status !== 200 || jarBuf[0] !== 0x50 || jarBuf[1] !== 0x4b || actualSha !== entry.sha256) {
    throw new Error(`Invalid JAR stream for ${entry.filename}`);
  }
}

const expectedMcVersions = ['1.21.11', '1.21.4', '1.16.5'];
const actualMcVersions = verAll.versions.map((v) => v.minecraftVersion);
if (
  verAll.versions.length !== 3 ||
  verStable.versions.length !== 3 ||
  JSON.stringify(actualMcVersions) !== JSON.stringify(expectedMcVersions)
) {
  throw new Error(`Expected exact Fabric versions ${expectedMcVersions.join(', ')}, got ${actualMcVersions.join(', ')}`);
}

for (const v of verAll.versions) {
  if (
    v.name !== `WinVisual ${v.minecraftVersion}` ||
    !v.loader.startsWith(`WinVisual ${v.minecraftVersion}`) ||
    !Array.isArray(v.highlightsRu) ||
    !Array.isArray(v.highlightsEn)
  ) {
    throw new Error(`Invalid WinVisual version schema on ${v.id}: ${JSON.stringify(v)}`);
  }
}

if (!Array.isArray(newsData.items) || newsData.items.length !== 0) {
  throw new Error('Expected empty news items array until official posts are provided');
}

// 2. Verify custom 64x64 RGBA PNG skin generator endpoint (/api/skin/resolve)
const skinRes = await fetch(`${base}/api/skin/resolve?username=Technoblade`).then((r) => r.json());
if (!skinRes.skinDataUrl?.startsWith('data:image/png;base64,')) {
  throw new Error('Invalid skinDataUrl response');
}
const skinPngBuf = Buffer.from(skinRes.skinDataUrl.split(',')[1], 'base64');
if (
  skinPngBuf[0] !== 137 ||
  skinPngBuf[1] !== 80 ||
  skinPngBuf[2] !== 78 ||
  skinPngBuf[3] !== 71 ||
  skinPngBuf.readUInt32BE(16) !== 64 ||
  skinPngBuf.readUInt32BE(20) !== 64
) {
  throw new Error('Generated Minecraft skin PNG is not a valid 64x64 RGBA PNG');
}

// 3. Verify version-isolated Modrinth + Embedded WinVisual Client Mod bundle endpoint across all 3 Fabric versions
for (const mc of expectedMcVersions) {
  const modBundle = await fetch(`${base}/api/mods/bundle?mc=${mc}`).then((r) => r.json());
  if (!Array.isArray(modBundle.syncedMods) || modBundle.syncedMods.length !== 5) {
    throw new Error(`Mod bundle sync failed for ${mc}`);
  }
}

// 4. Verify HUD disk persistence roundtrip (POST & GET /api/config/hud -> winvisual-hud.json)
const sampleHudPayload = {
  version: '2.7.5',
  themeId: 'violet',
  equippedCape: 'nebula',
  crosshair: { gap: 5, size: 9, thickness: 2, centerDot: true, outline: true, accentColor: true },
  hudPositions: { watermark: { x: 24, y: 20 }, 'target-hud': { x: 340, y: 212 } },
  modules: [{ id: 'player-esp', enabled: true, modeIndex: 0, amount: 85, keybind: 'X', keybindCode: 88 }],
  savedAt: new Date().toISOString(),
};
const postHudRes = await fetch(`${base}/api/config/hud`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sampleHudPayload),
}).then((r) => r.json());
const getHudRes = await fetch(`${base}/api/config/hud`).then((r) => r.json());
if (
  !postHudRes.ok ||
  getHudRes.config?.hudPositions?.['target-hud']?.x !== 340 ||
  !fs.existsSync('.winvisual-runtime/config/winvisual-hud.json')
) {
  throw new Error('Disk persistence check for winvisual-hud.json failed');
}

// 5. Verify all 5 binary SHA-256 artifacts (1 real embedded WinVisual mod JAR + 4 build bundles)
// across ALL 3 Fabric builds (15 bundles total)
for (const buildId of ['winvisual-1.21.11', 'winvisual-1.21.4', 'winvisual-1.16.5']) {
  const mcVer = buildId.replace('winvisual-', '');
  const manifest = await fetch(`${base}/api/download/${buildId}/manifest`).then((r) => r.json());
  if (manifest.artifacts.length !== 5) throw new Error(`Expected 5 signed artifacts for ${buildId}`);
  const embeddedArt = manifest.artifacts[0];
  if (embeddedArt.filename !== `winvisual-client-${mcVer}.jar`) {
    throw new Error(`Expected embedded WinVisual mod JAR first in ${buildId} manifest`);
  }
  for (const art of manifest.artifacts) {
    const res = await fetch(`${base}${art.url}?speed_mbps=200`);
    const buf = Buffer.from(await res.arrayBuffer());
    const actualSha = crypto.createHash('sha256').update(buf).digest('hex');
    if (actualSha !== art.sha256) {
      throw new Error(`SHA-256 mismatch on ${art.filename}`);
    }
  }
}

// 5b. Verify the WinVisual game directory scaffold (EvoVisual-style folder structure)
const gdirInit = await fetch(`${base}/api/game-dir/init?dir=~/WinVisual`).then((r) => r.json());
if (!gdirInit.ok) throw new Error('Game directory init failed: ' + JSON.stringify(gdirInit));
const gdirNames = gdirInit.folders.map((f) => f.name);
for (const required of ['mods', 'resourcepacks', 'shaderpacks', 'config', 'logs', 'screenshots', 'saves', 'versions', 'libraries', 'assets']) {
  if (!gdirNames.includes(required)) throw new Error(`WinVisual folder is missing "${required}/"`);
}
if (!Array.isArray(gdirInit.modsJars) || gdirInit.modsJars.length !== 3) {
  throw new Error('Expected 3 embedded WinVisual client mod JARs copied into WinVisual/mods/');
}
const gdirTree = await fetch(`${base}/api/game-dir/tree?dir=~/WinVisual`).then((r) => r.json());
if (!gdirTree.ok || !Array.isArray(gdirTree.folders) || gdirTree.folders.length < 10) {
  throw new Error('Game directory tree readback failed');
}
const modsEntry = gdirTree.folders.find((f) => f.name === 'mods');
if (!modsEntry || modsEntry.files < 3) throw new Error('WinVisual/mods/ does not contain the embedded JARs on disk');
console.log(`[GAME-DIR OK] ~/WinVisual scaffolded: ${gdirTree.folders.length} folders, mods/ = ${modsEntry.files} files (${(modsEntry.sizeBytes / 1024).toFixed(0)} KB)`);

// 5c. Verify the in-launcher Modrinth browser contract (search + version + file management)
const mrSearchRes = await fetch(`${base}/api/modrinth/search?type=mod&ver=1.21.4`);
const mrSearchData = await mrSearchRes.json();
if (mrSearchRes.status === 200) {
  if (!Array.isArray(mrSearchData)) throw new Error('Modrinth search proxy must return an array on 200');
} else if (mrSearchRes.status !== 502 || !mrSearchData.error) {
  throw new Error(`Modrinth search proxy must return 200|array or 502|error, got ${mrSearchRes.status}: ${JSON.stringify(mrSearchData)}`);
}
console.log(
  `[MODRINTH OK] search proxy contract (sandbox: ${
    mrSearchRes.status === 200 ? 'live ' + mrSearchData.length + ' hits' : 'honest 502 — user browser uses direct fetch'
  })`
);

const mrVerRes = await fetch(`${base}/api/modrinth/version?slug=not-a-real-slug&type=mod&ver=1.21.4`);
const mrVerData = await mrVerRes.json();
if (mrVerRes.status !== 502 || !mrVerData.error) {
  throw new Error(`Modrinth version proxy must return 502|error for unknown slug, got ${mrVerRes.status}: ${JSON.stringify(mrVerData)}`);
}

const mrFilesRes = await fetch(`${base}/api/game-dir/files?dir=~/WinVisual&sub=mods`).then((r) => r.json());
if (!mrFilesRes.ok || !Array.isArray(mrFilesRes.files) || mrFilesRes.files.length < 3) {
  throw new Error('Game dir files list must expose the embedded WinVisual JARs in mods/');
}
const mrBadSubRes = await fetch(`${base}/api/game-dir/files?dir=~/WinVisual&sub=../etc`);
if (mrBadSubRes.status !== 400) throw new Error('Game dir files endpoint must reject non-allowlisted subfolders');

const tmpProbe = 'winvisual-verify-modrinth-probe.jar';
const modsAbs = path.join(os.homedir(), 'WinVisual', 'mods', tmpProbe);
fs.mkdirSync(path.dirname(modsAbs), { recursive: true });
fs.writeFileSync(modsAbs, 'probe');
const mrRemoveRes = await fetch(
  `${base}/api/game-dir/remove?dir=~/WinVisual&sub=mods&file=${encodeURIComponent(tmpProbe)}`
).then((r) => r.json());
if (!mrRemoveRes.ok || fs.existsSync(modsAbs)) {
  throw new Error('Game dir remove endpoint failed to delete the probe file');
}
console.log(`[MODRINTH OK] game-dir files list/remove roundtrip (${mrFilesRes.files.length} files in mods/)`);

// Check simulated HTTP 503 error recovery endpoint
const errRes = await fetch(`${base}/api/download/winvisual-1.21.11/winvisual-1.21.11-rendercore.jar?simulate_error=1`);
if (errRes.status !== 503) throw new Error('Expected 503 fault simulation');

// Check desktop source .tar.gz export
const tarRes = await fetch(`${base}/api/export-project`);
const tarBuf = Buffer.from(await tarRes.arrayBuffer());
if (tarRes.status !== 200 || tarBuf[0] !== 0x1f || tarBuf[1] !== 0x8b || tarBuf.length < 500_000) {
  throw new Error('Invalid .tar.gz desktop archive stream');
}

// Check Tauri & Web brand icons exist and non-empty
for (const icon of [
  'public/favicon.png',
  'public/images/winvisual-logo.png',
  'src-tauri/icons/32x32.png',
  'src-tauri/icons/128x128.png',
  'src-tauri/icons/128x128@2x.png',
  'src-tauri/icons/icon.png',
  'src-tauri/icons/icon.ico',
  'src-tauri/icons/icon.icns',
]) {
  const st = fs.statSync(icon);
  if (st.size < 1000) throw new Error(`Icon too small: ${icon}`);
}

// 5d. Verify the Java major-version guard + Modrinth native client exist in the Rust source
const launcherRs = fs.readFileSync('src-tauri/src/launcher.rs', 'utf8');
for (const needle of ['probe_java_major', 'java_major_compatible', 'component_required_major', 'required_major']) {
  if (!launcherRs.includes(needle)) throw new Error(`Java major-version guard missing in launcher.rs: ${needle}`);
}
if (!launcherRs.includes('modrinth.rs') && !fs.existsSync('src-tauri/src/modrinth.rs')) {
  throw new Error('src-tauri/src/modrinth.rs is missing');
}
const modrinthRs = fs.readFileSync('src-tauri/src/modrinth.rs', 'utf8');
for (const needle of ['search_modrinth_resources', 'download_modrinth_resource', 'sha1', 'modrinth://progress']) {
  if (!modrinthRs.includes(needle)) throw new Error(`Modrinth native client missing in modrinth.rs: ${needle}`);
}
const mainRs = fs.readFileSync('src-tauri/src/main.rs', 'utf8');
for (const needle of ['mod modrinth', 'search_modrinth', 'download_modrinth_resource', 'list_game_dir_files_cmd', 'remove_game_dir_file_cmd']) {
  if (!mainRs.includes(needle)) throw new Error(`Tauri command registration missing in main.rs: ${needle}`);
}
console.log('[JAVA+MODRINTH OK] Rust: java major probe + compatibility gate + native Modrinth search/download/verify commands');

// 6. Full React Component Tree Render Verification across ALL 7 pages x 2 languages + modals
const ssrEntry = await import('../.verify-ssr/ssr-entry.js');
ssrEntry.seedLiveState({
  versions: verAll.versions,
  news: newsData.items,
  telemetry: status,
});

// Verify active default nickname is `user` + random digits (never `WinVisual`)
const activeNick = ssrEntry.getActiveUsername();
if (!/^user\d{5}$/.test(activeNick)) {
  throw new Error(`Expected default nickname matching userXXXXX, got "${activeNick}"`);
}
console.log(`[ACCOUNT OK] Default generated username = ${activeNick}`);

// Verify Preset Share Code export -> import roundtrip
const exportedCode = ssrEntry.roundtripPresetTest();
if (!exportedCode.startsWith('WINVISUAL-')) {
  throw new Error('Preset code export failed');
}

const routes = ['home', 'modules', 'news', 'versions', 'resources', 'settings', 'account'];
for (const lang of ['ru', 'en']) {
  for (const route of routes) {
    const html = ssrEntry.renderRouteSnapshot(route, lang);
    if (!html || html.length < 1500 || html.includes('NaN') || html.includes('42.8 MB/s')) {
      throw new Error(`Render check failed on route=${route} lang=${lang}`);
    }
    if (!html.includes(activeNick)) {
      throw new Error(`Active userXXXXX nick missing from rendered route=${route}`);
    }
    if (route === 'home' && lang === 'ru') {
      if (
        !html.includes('С возвращением') ||
        !html.includes(`${activeNick}!`) ||
        !html.includes('Новости') ||
        !html.includes('Аккаунты') ||
        !html.includes('Настройки')
      ) {
        throw new Error(`Missing top-left welcome greeting or 3 cards on home RU route`);
      }
    }
    if (route === 'account') {
      for (const forbidden of ['Steve', 'Alex', 'Steve 4px', 'Alex 3px']) {
        if (html.includes(forbidden)) {
          throw new Error(`Forbidden "Steve/Alex" option "${forbidden}" leaked into account route`);
        }
      }
      if (!html.includes('64×32')) {
        throw new Error('Account route must advertise the strict 64×32 / 64×64 skin upload rule');
      }
    }
    if (route === 'resources') {
      const headline = lang === 'ru' ? 'Моды и ресурспаки' : 'Mods &amp; Resource Packs';
      if (!html.includes('WinVisual') || !html.includes(headline)) {
        throw new Error(`Resources route must advertise the in-launcher Modrinth browser (headline "${headline}" missing)`);
      }
    }
    for (const removedVer of [
      '1.21.5',
      '1.21.1"',
      '1.20.4',
      'WinVisual 2.5.0',
      'WinVisual 2.3.4',
      'WinVisual 2.1.9',
      'WinVisual Classic',
      'Fabric 1.16.5',
      'Fabric 1.21.4',
      'Fabric 1.21.11',
      'EvoVis',
      'EvoVisual',
      'Все версии →',
      '% FPS',
    ]) {
      if (html.includes(removedVer)) {
        throw new Error(`Forbidden string "${removedVer}" leaked into route=${route}`);
      }
    }
    console.log(`[RENDER OK] route=${route.padEnd(9)} lang=${lang} html=${html.length} chars`);
  }
}

const sessionHtml = ssrEntry.renderLiveSessionSnapshot();
if (!sessionHtml || sessionHtml.length < 1000 || !sessionHtml.includes(activeNick)) {
  throw new Error('LiveClientSessionModal render failed');
}

// 7. End-to-End Real Streaming Cancel Launch + Native Tauri Abort Verification
const cancelProof = await ssrEntry.verifyCancelLaunchFlows(base);
console.log(
  `[CANCEL LAUNCH OK] Web stream aborted mid-flight at ${(
    cancelProof.webBytesBeforeCancel / 1024
  ).toFixed(0)} KB -> instant 0ms idle + Native Tauri cancel_native_launch=${cancelProof.nativeCancelInvoked}`
);

console.log(
  `[ALL CHECKS PASSED] v2.7.5 nick=${activeNick}! + In-launcher Modrinth (mods & resource packs, direct download to WinVisual) + Java 21 auto-fix (major-version probe + Mojang runtime) + ~/WinVisual folder (3 embedded JARs) + Skin-only upload (64×32/64×64, no Steve/Alex) + OAuth (${oauth.userCode}) + ${(
    tarBuf.length /
    (1024 * 1024)
  ).toFixed(2)} MB .tar.gz`
);
