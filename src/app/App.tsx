import React, { useEffect } from 'react';
import { AppProviders } from './providers/AppProviders';
import { MainLayout } from '../components/layout/MainLayout';
import { AppRouter } from './router';
import { useLauncherStore } from '../stores/launcherStore';
import { useVisualClientStore } from '../stores/visualClientStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { tauriListenEvent } from '../services/tauriBridge';
import type { DownloadProgressState } from '../types/launcher';

export const App: React.FC = () => {
  const loadInitialData = useLauncherStore((s) => s.loadInitialData);
  const refreshTelemetry = useLauncherStore((s) => s.refreshTelemetry);
  const appendLog = useLauncherStore((s) => s.appendLog);
  const notifyNativeProcessExited = useLauncherStore((s) => s.notifyNativeProcessExited);
  const hydrateHudConfigFromDisk = useVisualClientStore((s) => s.hydrateHudConfigFromDisk);

  useKeyboardShortcuts();

  useEffect(() => {
    loadInitialData();
    hydrateHudConfigFromDisk().catch(() => {});

    const timer = window.setInterval(() => {
      refreshTelemetry();
    }, 6000);

    let unlistenLogs = () => {};
    let unlistenProgress = () => {};
    let unlistenExited = () => {};

    tauriListenEvent<string>('logs://line', (line) => {
      appendLog(line);
    }).then((fn) => {
      unlistenLogs = fn;
    });

    tauriListenEvent<Partial<DownloadProgressState>>('download://progress', (prog) => {
      useLauncherStore.setState((prev) => {
        // Ignore stale in-flight IPC events once user cancelled, errored, or already entered running state
        if (
          prev.launchPhase === 'idle' ||
          prev.launchPhase === 'error' ||
          prev.launchPhase === 'running'
        ) {
          return prev;
        }
        return {
          launchPhase: 'downloading',
          downloadProgress: {
            ...prev.downloadProgress,
            ...prog,
            active: true,
          },
        };
      });
    }).then((fn) => {
      unlistenProgress = fn;
    });

    tauriListenEvent<{ pid: number; exitCode: number }>('client://exited', (payload) => {
      notifyNativeProcessExited(payload.pid, payload.exitCode);
    }).then((fn) => {
      unlistenExited = fn;
    });

    return () => {
      window.clearInterval(timer);
      unlistenLogs();
      unlistenProgress();
      unlistenExited();
    };
  }, [loadInitialData, refreshTelemetry, appendLog, notifyNativeProcessExited, hydrateHudConfigFromDisk]);

  return (
    <AppProviders>
      <MainLayout>
        <AppRouter />
      </MainLayout>
    </AppProviders>
  );
};

export default App;
