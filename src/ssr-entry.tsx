import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { AppProviders } from './app/providers/AppProviders';
import { MainLayout } from './components/layout/MainLayout';
import { HomePage } from './pages/HomePage';
import { ModulesPage } from './pages/ModulesPage';
import { NewsPage } from './pages/NewsPage';
import { VersionsPage } from './pages/VersionsPage';
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
    settings: <SettingsPage />,
    account: <AccountPage />,
  };

  return ReactDOMServer.renderToString(
    <AppProviders>
      <MainLayout>{pageMap[route]}</MainLayout>
    </AppProviders>
  );
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
