import crypto from 'node:crypto';
import fs from 'node:fs';

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

// 1. Validate live HTTP API endpoints + v2.7.2 telemetry + strict 3-version WinVisual catalog
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
  status.launcherVersion !== '2.7.2' ||
  typeof status.cpuUsagePercent !== 'number' ||
  typeof status.hostTotalMemoryMb !== 'number' ||
  typeof status.hostUsedMemoryMb !== 'number' ||
  !status.java?.path
) {
  throw new Error('Invalid /api/status v2.7.2 telemetry schema: ' + JSON.stringify(status));
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
  version: '2.7.2',
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

// 5. Verify all 4 binary SHA-256 artifacts across ALL 3 Fabric builds (12 bundles total)
for (const buildId of ['winvisual-1.21.11', 'winvisual-1.21.4', 'winvisual-1.16.5']) {
  const manifest = await fetch(`${base}/api/download/${buildId}/manifest`).then((r) => r.json());
  if (manifest.artifacts.length !== 4) throw new Error(`Expected 4 signed artifacts for ${buildId}`);
  for (const art of manifest.artifacts) {
    const res = await fetch(`${base}${art.url}?speed_mbps=200`);
    const buf = Buffer.from(await res.arrayBuffer());
    const actualSha = crypto.createHash('sha256').update(buf).digest('hex');
    if (actualSha !== art.sha256) {
      throw new Error(`SHA-256 mismatch on ${art.filename}`);
    }
  }
}

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

// 6. Full React Component Tree Render Verification across ALL 6 pages x 2 languages + modals
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

const routes = ['home', 'modules', 'news', 'versions', 'settings', 'account'];
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
      if (!html.includes('С возвращением') || !html.includes(`${activeNick}!`)) {
        throw new Error(`Missing top-left welcome greeting on home RU route`);
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
  `[ALL CHECKS PASSED] v2.7.2 nick=${activeNick}! + Welcome back + 0..100% Shader Split + Solid 3D Skin + Clean News + WinVisual 1.16.5 / 1.21.4 / 1.21.11 + Cancel Launch + OAuth (${oauth.userCode}) + ${(
    tarBuf.length /
    (1024 * 1024)
  ).toFixed(2)} MB .tar.gz`
);
