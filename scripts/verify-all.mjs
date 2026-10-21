import crypto from 'node:crypto';
import fs from 'node:fs';

// Minimal DOM globals so client stores/hooks mount cleanly during full-tree SSR verification
class Element {}
globalThis.Element = Element;
globalThis.HTMLElement = class HTMLElement extends Element {};
globalThis.SVGElement = class SVGElement extends Element {};
globalThis.window = globalThis;
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

// 1. Validate live HTTP API endpoints + strict 3-version Fabric catalog
const [status, verAll, verStable, newsData, oauth] = await Promise.all([
  fetch(`${base}/api/status`).then((r) => r.json()),
  fetch(`${base}/api/versions?channel=all`).then((r) => r.json()),
  fetch(`${base}/api/versions?channel=stable`).then((r) => r.json()),
  fetch(`${base}/api/news`).then((r) => r.json()),
  fetch(`${base}/api/auth/device-session`).then((r) => r.json()),
]);

if (!status.operational || status.launcherVersion !== '2.4.2' || typeof status.hostTotalMemoryMb !== 'number' || !status.java?.path) {
  throw new Error('Invalid /api/status telemetry schema: ' + JSON.stringify(status));
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
  if (!v.loader.includes('Fabric') || !Array.isArray(v.highlightsRu) || !Array.isArray(v.highlightsEn)) {
    throw new Error(`Invalid Fabric version schema on ${v.id}`);
  }
}

if (!Array.isArray(newsData.items) || newsData.items.length !== 4) {
  throw new Error('Missing news items array');
}
for (const n of newsData.items) {
  if (!n.image || !Array.isArray(n.bodyRu) || !Array.isArray(n.bodyEn)) {
    throw new Error(`Incomplete article schema on ${n.id}`);
  }
}

// 2. Verify all 4 binary SHA-256 artifacts across ALL 3 Fabric builds (12 bundles total)
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

// 3. Full React Component Tree Render Verification across ALL 6 pages x 2 languages + modals
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
    if (!html || html.length < 1500 || html.includes('NaN')) {
      throw new Error(`Render check failed on route=${route} lang=${lang}`);
    }
    if (!html.includes(activeNick)) {
      throw new Error(`Active userXXXXX nick missing from rendered route=${route}`);
    }
    for (const removedVer of ['1.21.5', '1.21.1"', '1.20.4', 'WinVisual 2.5.0', 'WinVisual 2.3.4', 'WinVisual 2.1.9', 'WinVisual Classic']) {
      if (html.includes(removedVer)) {
        throw new Error(`Removed version "${removedVer}" leaked into route=${route}`);
      }
    }
    console.log(`[RENDER OK] route=${route.padEnd(9)} lang=${lang} html=${html.length} chars`);
  }
}

const sessionHtml = ssrEntry.renderLiveSessionSnapshot();
if (!sessionHtml || sessionHtml.length < 1000 || !sessionHtml.includes(activeNick)) {
  throw new Error('LiveClientSessionModal render failed');
}
console.log(
  `[ALL CHECKS PASSED] nick=${activeNick} + 3/3 Fabric versions (1.21.11, 1.21.4, 1.16.5) + 12/12 SHA-256 bundles + 12/12 SSR pages + OAuth (${oauth.userCode}) + ${(
    tarBuf.length /
    (1024 * 1024)
  ).toFixed(2)} MB .tar.gz`
);
