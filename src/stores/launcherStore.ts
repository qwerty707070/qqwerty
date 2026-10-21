import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ClientVersion,
  DownloadProgressState,
  LaunchPhase,
  NewsArticle,
  PageRoute,
  SystemTelemetry,
  VersionChannel,
} from '../types/launcher';
import {
  fetchClientVersions,
  fetchNewsFeed,
  fetchSystemTelemetry,
} from '../services/launcherService';
import { installAndVerifyClientBuild } from '../services/downloadService';
import {
  isTauriDesktop,
  tauriCloseWindow,
  tauriLaunchMinecraft,
  tauriMinimizeWindow,
} from '../services/tauriBridge';
import { useSettingsStore } from './settingsStore';
import { useAccountStore } from './accountStore';
import { useVisualClientStore } from './visualClientStore';
import { useNotificationStore } from './notificationStore';

interface LauncherState {
  currentPage: PageRoute;
  setCurrentPage: (page: PageRoute) => void;

  windowMinimized: boolean;
  setWindowMinimized: (minimized: boolean) => void;

  versions: ClientVersion[];
  selectedVersionId: string;
  versionChannelFilter: VersionChannel;
  versionsLoading: boolean;
  versionsError: string | null;

  news: NewsArticle[];
  newsLoading: boolean;
  newsError: string | null;

  telemetry: SystemTelemetry | null;
  telemetryLoading: boolean;

  launchPhase: LaunchPhase;
  downloadDrawerOpen: boolean;
  simulateNetworkDrop: boolean;
  logsModalOpen: boolean;
  logs: string[];
  downloadProgress: DownloadProgressState;

  loadInitialData: () => Promise<void>;
  refreshTelemetry: () => Promise<void>;
  setVersionFilter: (channel: VersionChannel) => Promise<void>;
  selectVersion: (versionId: string) => void;
  setDownloadDrawerOpen: (open: boolean) => void;
  setSimulateNetworkDrop: (val: boolean) => void;
  setLogsModalOpen: (open: boolean) => void;
  appendLog: (line: string) => void;
  clearLogs: () => void;
  startLaunchSequence: () => Promise<void>;
  cancelDownload: () => void;
  stopRunningSession: () => void;
}

let activeAbortController: AbortController | null = null;

const INITIAL_PROGRESS: DownloadProgressState = {
  active: false,
  versionId: 'aether-1.21.4',
  versionName: 'Aether Visual 2.4.0',
  currentFile: '',
  stageLabel: '',
  downloadedBytes: 0,
  totalBytes: 0,
  speedMbps: 0,
  etaSeconds: null,
  verifiedFiles: 0,
  totalFiles: 4,
  lastSha256: '',
  errorMessage: null,
};

export const useLauncherStore = create<LauncherState>()(
  persist(
    (set, get) => ({
      currentPage: 'home',
      setCurrentPage: (page) => set({ currentPage: page }),

      windowMinimized: false,
      setWindowMinimized: (minimized) => set({ windowMinimized: minimized }),

      versions: [],
      selectedVersionId: 'aether-1.21.4',
      versionChannelFilter: 'all',
      versionsLoading: true,
      versionsError: null,

      news: [],
      newsLoading: true,
      newsError: null,

      telemetry: null,
      telemetryLoading: true,

      launchPhase: 'idle',
      downloadDrawerOpen: false,
      simulateNetworkDrop: false,
      logsModalOpen: false,
      logs: [
        `[${new Date().toLocaleTimeString('en-GB')}] [BOOT] Aether Visual Shell v2.4.0 initialized`,
      ],
      downloadProgress: INITIAL_PROGRESS,

      appendLog: (line) =>
        set((state) => ({
          logs: [
            ...state.logs.slice(-149),
            `[${new Date().toLocaleTimeString('en-GB')}] ${line}`,
          ],
        })),

      clearLogs: () =>
        set({
          logs: [`[${new Date().toLocaleTimeString('en-GB')}] [INFO] Diagnostic log buffer cleared`],
        }),

      loadInitialData: async () => {
        set({ versionsLoading: true, newsLoading: true, telemetryLoading: true });
        const [verRes, newsRes, telRes] = await Promise.allSettled([
          fetchClientVersions(get().versionChannelFilter),
          fetchNewsFeed(),
          fetchSystemTelemetry(),
        ]);

        if (verRes.status === 'fulfilled') {
          const list = verRes.value;
          const currentSelected = get().selectedVersionId;
          const validSelected = list.some((v) => v.id === currentSelected)
            ? currentSelected
            : list[0]?.id ?? 'aether-1.21.4';
          set({
            versions: list,
            selectedVersionId: validSelected,
            versionsLoading: false,
            versionsError: null,
          });
        } else {
          set({
            versionsLoading: false,
            versionsError: verRes.reason?.message ?? 'Failed to fetch client versions',
          });
        }

        if (newsRes.status === 'fulfilled') {
          set({ news: newsRes.value, newsLoading: false, newsError: null });
        } else {
          set({
            newsLoading: false,
            newsError: newsRes.reason?.message ?? 'Failed to fetch news feed',
          });
        }

        if (telRes.status === 'fulfilled') {
          set({ telemetry: telRes.value, telemetryLoading: false });
          get().appendLog(
            `[TELEMETRY] Connected to runtime engine (${telRes.value.platform}, ${telRes.value.latencyMs}ms RTT)`
          );
        } else {
          set({ telemetryLoading: false });
        }
      },

      refreshTelemetry: async () => {
        try {
          const tel = await fetchSystemTelemetry();
          set({ telemetry: tel });
        } catch {
          set((state) => ({
            telemetry: state.telemetry
              ? { ...state.telemetry, operational: false }
              : null,
          }));
        }
      },

      setVersionFilter: async (channel) => {
        set({ versionChannelFilter: channel, versionsLoading: true, versionsError: null });
        try {
          const list = await fetchClientVersions(channel);
          set({ versions: list, versionsLoading: false, versionsError: null });
        } catch (err) {
          set({
            versionsLoading: false,
            versionsError: err instanceof Error ? err.message : 'Unable to filter versions',
          });
        }
      },

      selectVersion: (versionId) => {
        set({ selectedVersionId: versionId });
        const found = get().versions.find((v) => v.id === versionId);
        const settings = useSettingsStore.getState();
        if (found && settings.notificationsEnabled) {
          useNotificationStore.getState().pushToast({
            type: 'info',
            title:
              settings.language === 'ru'
                ? `Выбрана сборка ${found.name}`
                : `Selected ${found.name}`,
            description: `Minecraft ${found.minecraftVersion} • ${found.loader}`,
          });
        }
      },

      setDownloadDrawerOpen: (open) => set({ downloadDrawerOpen: open }),
      setSimulateNetworkDrop: (val) => set({ simulateNetworkDrop: val }),
      setLogsModalOpen: (open) => set({ logsModalOpen: open }),

      startLaunchSequence: async () => {
        const state = get();
        if (
          state.launchPhase === 'preparing' ||
          state.launchPhase === 'downloading' ||
          state.launchPhase === 'verifying' ||
          state.launchPhase === 'launching'
        ) {
          set({ downloadDrawerOpen: true });
          return;
        }

        if (state.launchPhase === 'running') {
          get().stopRunningSession();
          return;
        }

        const selected =
          state.versions.find((v) => v.id === state.selectedVersionId) ?? state.versions[0];
        if (!selected) return;

        activeAbortController?.abort();
        const controller = new AbortController();
        activeAbortController = controller;

        const settings = useSettingsStore.getState();
        const accState = useAccountStore.getState();
        const activeAccount =
          accState.accounts.find((a) => a.id === accState.activeAccountId) ?? accState.accounts[0];
        const isRu = settings.language === 'ru';

        set({
          launchPhase: 'preparing',
          downloadDrawerOpen: true,
          downloadProgress: {
            ...INITIAL_PROGRESS,
            active: true,
            versionId: selected.id,
            versionName: selected.name,
            stageLabel: isRu ? 'Подготовка окружения...' : 'Preparing environment...',
            errorMessage: null,
          },
        });

        try {
          if (isTauriDesktop()) {
            const fabricVer = selected.loader.split(' ')[1] ?? '0.16.10';
            const pid = await tauriLaunchMinecraft({
              minecraftVersion: selected.minecraftVersion,
              fabricLoaderVersion: fabricVer,
              username: activeAccount.username,
              uuid: activeAccount.uuid,
              ramMb: settings.ramAllocationMb,
              javaPath: settings.javaPath,
              gameDirectory: settings.gameDirectory,
              jvmArguments: settings.jvmArguments,
              speedLimitMbps: settings.downloadSpeedLimitMbps,
            });
            get().appendLog(`[TAURI-JVM] Spawned native Minecraft process PID ${pid}`);
            set((prev) => ({
              launchPhase: 'running',
              downloadDrawerOpen: false,
              downloadProgress: { ...prev.downloadProgress, active: false },
            }));
            if (settings.closeAfterLaunch) {
              await tauriCloseWindow();
            } else if (settings.minimizeOnLaunch) {
              await tauriMinimizeWindow();
            }
            return;
          }

          const summary = await installAndVerifyClientBuild({
            versionId: selected.id,
            speedLimitMbps: settings.downloadSpeedLimitMbps,
            simulateNetworkDrop: get().simulateNetworkDrop,
            signal: controller.signal,
            onLog: (line) => get().appendLog(line),
            onPhaseChange: (phase) => set({ launchPhase: phase }),
            onProgress: (payload) =>
              set((prev) => ({
                downloadProgress: {
                  ...prev.downloadProgress,
                  ...payload,
                  active: true,
                  errorMessage: null,
                },
              })),
          });

          await new Promise((r) => window.setTimeout(r, 380));

          get().appendLog(
            `[CLIENT] Verified ${summary.verifiedArtifacts} bundles (${(
              summary.totalBytes /
              (1024 * 1024)
            ).toFixed(1)} MB). Opening interactive visual client viewport...`
          );

          set((prev) => ({
            launchPhase: 'running',
            downloadDrawerOpen: false,
            downloadProgress: {
              ...prev.downloadProgress,
              active: false,
            },
          }));

          useVisualClientStore.getState().setLiveSessionModalOpen(true);

          if (settings.notificationsEnabled) {
            useNotificationStore.getState().pushToast({
              type: 'success',
              title: isRu ? `${selected.name} запущен` : `${selected.name} active`,
              description: isRu
                ? `Нажмите Right Shift в окне игры для открытия ClickGUI`
                : `Press Right Shift inside viewport to open ClickGUI`,
            });
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            get().appendLog('[ABORT] Client installation cancelled by user.');
            set({
              launchPhase: 'idle',
              downloadProgress: { ...INITIAL_PROGRESS },
            });
            if (settings.notificationsEnabled) {
              useNotificationStore.getState().pushToast({
                type: 'warning',
                title: isRu ? 'Загрузка отменена' : 'Download cancelled',
                description: isRu
                  ? 'Передача файлов остановлена пользователем.'
                  : 'Artifact stream aborted cleanly.',
              });
            }
            return;
          }

          const message = err instanceof Error ? err.message : 'Connection interrupted';
          get().appendLog(`[ERROR] ${message}`);
          set((prev) => ({
            launchPhase: 'error',
            downloadProgress: {
              ...prev.downloadProgress,
              active: false,
              errorMessage: message,
            },
          }));

          if (settings.notificationsEnabled) {
            useNotificationStore.getState().pushToast({
              type: 'error',
              title: isRu ? 'Не удалось загрузить файлы клиента' : 'Failed to download client files',
              description: message,
            });
          }
        }
      },

      cancelDownload: () => {
        activeAbortController?.abort();
        activeAbortController = null;
      },

      stopRunningSession: () => {
        const settings = useSettingsStore.getState();
        useVisualClientStore.getState().setLiveSessionModalOpen(false);
        get().appendLog('[SESSION] Client session terminated cleanly.');
        set({ launchPhase: 'idle', downloadDrawerOpen: false });
        if (settings.notificationsEnabled) {
          useNotificationStore.getState().pushToast({
            type: 'info',
            title: settings.language === 'ru' ? 'Сессия клиента завершена' : 'Client session ended',
          });
        }
      },
    }),
    {
      name: 'aether-visual-launcher-state-v2',
      partialize: (state) => ({
        selectedVersionId: state.selectedVersionId,
      }),
    }
  )
);
