import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { AppProviders } from './app/providers/AppProviders';
import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './pages/HomePage';
import { ModulesPage } from './pages/ModulesPage';
import { NewsPage } from './pages/NewsPage';
import { VersionsPage } from './pages/VersionsPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountPage } from './pages/AccountPage';
import { LiveClientSessionModal } from './components/launcher/LiveClientSessionModal';
import { useLauncherStore } from './stores/launcherStore';
import { useSettingsStore } from './stores/settingsStore';
import { useVisualClientStore } from './stores/visualClientStore';
import { useAccountStore } from './stores/accountStore';
import type {
  ClientVersion,
  LanguageCode,
  NewsArticle,
  PageRoute,
  SystemTelemetry,
} from './types/launcher';

function syncServerSnapshots() {
  for (const s of [useLauncherStore, useSettingsStore, useVisualClientStore, useAccountStore]) {
    Object.assign(s.getInitialState(), s.getState());
  }
}

export function seedLiveState(payload: {
  versions: ClientVersion[];
  news: NewsArticle[];
  telemetry: SystemTelemetry;
}) {
  useLauncherStore.setState({
    versions: payload.versions,
    versionsLoading: false,
    versionsError: null,
    news: payload.news,
    newsLoading: false,
    newsError: null,
    telemetry: payload.telemetry,
    telemetryLoading: false,
  });
  syncServerSnapshots();
}

export function roundtripPresetTest(): string {
  const store = useVisualClientStore.getState();
  store.setHudPosition('watermark', 44, 52);
  store.updateCrosshair('gap', 6);
  const code = useVisualClientStore.getState().exportPresetCode();
  store.resetHudPositions();
  const ok = useVisualClientStore.getState().importPresetCode(code);
  if (!ok || useVisualClientStore.getState().hudPositions.watermark.x !== 44) {
    throw new Error('Preset import/export coordinates did not match');
  }
  store.resetHudPositions();
  syncServerSnapshots();
  return code;
}

export function renderRouteSnapshot(route: PageRoute, lang: LanguageCode): string {
  useSettingsStore.getState().updateSetting('language', lang);
  useLauncherStore.getState().setCurrentPage(route);
  syncServerSnapshots();

  const pageMap: Record<PageRoute, React.ReactNode> = {
    home: <HomePage />,
    modules: <ModulesPage />,
    news: <NewsPage />,
    versions: <VersionsPage />,
    resources: <ResourcesPage />,
    settings: <SettingsPage />,
    account: <AccountPage />,
  };

  return ReactDOMServer.renderToString(
    <AppProviders>
      <MainLayout>{pageMap[route]}</MainLayout>
    </AppProviders>
  );
}

export function getActiveUsername(): string {
  const { accounts, activeAccountId } = useAccountStore.getState();
  const active = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  return active.username;
}

export function renderLiveSessionSnapshot(): string {
  useVisualClientStore.getState().setLiveSessionModalOpen(true);
  syncServerSnapshots();
  const html = ReactDOMServer.renderToString(
    <AppProviders>
      <LiveClientSessionModal />
    </AppProviders>
  );
  useVisualClientStore.getState().setLiveSessionModalOpen(false);
  syncServerSnapshots();
  return html;
}

export async function verifyCancelLaunchFlows(baseUrl: string): Promise<{
  webBytesBeforeCancel: number;
  nativeCancelInvoked: boolean;
}> {
  const origFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      return origFetch(`${baseUrl}${input}`, init);
    }
    return origFetch(input, init);
  }) as typeof fetch;

  try {
    // Part A: Real live streaming Web download -> mid-stream cancel -> instant 0ms idle reset
    useSettingsStore.getState().updateSetting('language', 'ru');
    useSettingsStore.getState().updateSetting('downloadSpeedLimitMbps', 4);

    const launchPromise = useLauncherStore.getState().startLaunchSequence();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const st = useLauncherStore.getState();
      if (st.launchPhase === 'downloading' && st.downloadProgress.downloadedBytes > 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }

    const midState = useLauncherStore.getState();
    const webBytesBeforeCancel = midState.downloadProgress.downloadedBytes;
    if (midState.launchPhase !== 'downloading' || webBytesBeforeCancel <= 0) {
      throw new Error(
        `Expected active Web stream before cancel, got phase=${midState.launchPhase} bytes=${webBytesBeforeCancel}`
      );
    }

    // Verify busy UI renders both Dock "ОТМЕНИТЬ ЗАПУСК" and Modal "Отменить запуск"
    const busyHtml = renderRouteSnapshot('home', 'ru');
    if (!busyHtml.includes('ОТМЕНИТЬ ЗАПУСК') || !busyHtml.includes('Отменить запуск')) {
      throw new Error('Busy UI missing explicit Cancel Launch buttons');
    }

    // Click Cancel Launch -> must reset synchronously in 0ms!
    useLauncherStore.getState().cancelDownload();
    const immediateAfter = useLauncherStore.getState();
    if (
      immediateAfter.launchPhase !== 'idle' ||
      immediateAfter.downloadDrawerOpen !== false ||
      immediateAfter.downloadProgress.active !== false
    ) {
      throw new Error(
        `Synchronous Web cancel failed: phase=${immediateAfter.launchPhase}, drawer=${immediateAfter.downloadDrawerOpen}`
      );
    }

    await launchPromise;
    await new Promise((r) => setTimeout(r, 200));

    if (useLauncherStore.getState().launchPhase !== 'idle') {
      throw new Error('Late Web stream callback overwrote idle phase after cancel');
    }

    // Restore normal speed limit
    useSettingsStore.getState().updateSetting('downloadSpeedLimitMbps', 0);

    // Part B: Simulated Tauri v2 Native Desktop IPC launch -> mid-download cancel_native_launch
    let nativeCancelInvoked = false;
    let rejectNativeTask: ((reason?: unknown) => void) | null = null;
    const prevTauri = window.__TAURI_INTERNALS__;

    window.__TAURI_INTERNALS__ = {
      invoke: async <T,>(cmd: string): Promise<T> => {
        if (cmd === 'launch_native_client') {
          return (await new Promise<number>((_resolve, reject) => {
            rejectNativeTask = reject;
          })) as unknown as T;
        }
        if (cmd === 'cancel_native_launch') {
          nativeCancelInvoked = true;
          rejectNativeTask?.('LAUNCH_CANCELLED');
          return true as unknown as T;
        }
        return null as unknown as T;
      },
    };

    try {
      const nativePromise = useLauncherStore.getState().startLaunchSequence();
      await new Promise((r) => setTimeout(r, 40));
      if (useLauncherStore.getState().launchPhase !== 'preparing') {
        throw new Error(
          `Expected Tauri native launch in preparing/downloading phase, got ${useLauncherStore.getState().launchPhase}`
        );
      }

      useLauncherStore.getState().cancelDownload();
      await nativePromise;
      await new Promise((r) => setTimeout(r, 40));

      if (!nativeCancelInvoked || useLauncherStore.getState().launchPhase !== 'idle') {
        throw new Error(
          `Native Tauri cancel failed: invoked=${nativeCancelInvoked}, phase=${useLauncherStore.getState().launchPhase}`
        );
      }
    } finally {
      window.__TAURI_INTERNALS__ = prevTauri;
      syncServerSnapshots();
    }

    return { webBytesBeforeCancel, nativeCancelInvoked };
  } finally {
    globalThis.fetch = origFetch;
  }
}
