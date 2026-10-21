import React, { useEffect } from 'react';
import { AppProviders } from './providers/AppProviders';
import { MainLayout } from '../components/layout/MainLayout';
import { AppRouter } from './router';
import { useLauncherStore } from '../stores/launcherStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { tauriListenEvent } from '../services/tauriBridge';
import type { DownloadProgressState } from '../types/launcher';

export const App: React.FC = () => {
  const loadInitialData = useLauncherStore((s) => s.loadInitialData);
  const refreshTelemetry = useLauncherStore((s) => s.refreshTelemetry);
  const appendLog = useLauncherStore((s) => s.appendLog);

  useKeyboardShortcuts();

  useEffect(() => {
    loadInitialData();
    const timer = window.setInterval(() => {
      refreshTelemetry();
    }, 15000);

    let unlistenLogs = () => {};
    let unlistenProgress = () => {};

    tauriListenEvent<string>('logs://line', (line) => {
      appendLog(line);
    }).then((fn) => {
      unlistenLogs = fn;
    });

    tauriListenEvent<Partial<DownloadProgressState>>('download://progress', (prog) => {
      useLauncherStore.setState((prev) => ({
        launchPhase: 'downloading',
        downloadProgress: {
          ...prev.downloadProgress,
          ...prog,
          active: true,
        },
      }));
    }).then((fn) => {
      unlistenProgress = fn;
    });

    return () => {
      window.clearInterval(timer);
      unlistenLogs();
      unlistenProgress();
    };
  }, [loadInitialData, refreshTelemetry, appendLog]);

  return (
    <AppProviders>
      <MainLayout>
        <AppRouter />
      </MainLayout>
    </AppProviders>
  );
};

export default App;
