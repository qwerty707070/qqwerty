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
  tauriCancelNativeLaunch,
  tauriCloseWindow,
  tauriLaunchMinecraft,
  tauriMinimizeWindow,
  tauriStopClientProcess,
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
  activeProcessPid: number | null;
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
  stopRunningSession: () => Promise<void>;
  notifyNativeProcessExited: (pid: number, exitCode: number) => void;
}

let activeAbortController: AbortController | null = null;
let currentLaunchRunId = 0;

const INITIAL_PROGRESS: DownloadProgressState = {
  active: false,
  versionId: 'winvisual-1.21.11',
  versionName: 'WinVisual 1.21.11',
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
      selectedVersionId: 'winvisual-1.21.11',
      versionChannelFilter: 'all',
      versionsLoading: true,
      versionsError: null,

      news: [],
      newsLoading: true,
      newsError: null,

      telemetry: null,
      telemetryLoading: true,

      launchPhase: 'idle',
      activeProcessPid: null,
      downloadDrawerOpen: false,
      simulateNetworkDrop: false,
      logsModalOpen: false,
      logs: [
        `[${new Date().toLocaleTimeString('en-GB')}] [BOOT] WinVisual Shell v2.7.1 initialized (WinVisual 1.16.5 / 1.21.4 / 1.21.11)`,
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
            : list[0]?.id ?? 'winvisual-1.21.11';
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
          const cleanName = `WinVisual ${found.minecraftVersion}`;
          useNotificationStore.getState().pushToast({
            type: 'info',
            title:
              settings.language === 'ru'
                ? `Выбрана сборка ${cleanName}`
                : `Selected ${cleanName}`,
            description: cleanName,
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
          // Clicking main action while busy immediately cancels launch
          get().cancelDownload();
          return;
        }

        if (state.launchPhase === 'running') {
          await get().stopRunningSession();
          return;
        }

        const selected =
          state.versions.find((v) => v.id === state.selectedVersionId) ?? state.versions[0];
        if (!selected) return;

        activeAbortController?.abort();
        const controller = new AbortController();
        activeAbortController = controller;
        const myRunId = ++currentLaunchRunId;

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

        await useVisualClientStore.getState().persistHudConfigToDisk().catch(() => null);
        if (myRunId !== currentLaunchRunId || controller.signal.aborted) {
          return;
        }

        try {
          if (isTauriDesktop()) {
            const pid = await tauriLaunchMinecraft({
              minecraftVersion: selected.minecraftVersion,
              fabricLoaderVersion: 'latest',
              username: activeAccount.username,
              uuid: activeAccount.uuid,
              ramMb: settings.ramAllocationMb,
              javaPath: settings.javaPath,
              gameDirectory: settings.gameDirectory,
              jvmArguments: settings.jvmArguments,
              speedLimitMbps: settings.downloadSpeedLimitMbps,
              optimizeModsBundle: settings.optimizeModsBundle,
            });
            if (myRunId !== currentLaunchRunId) {
              await tauriStopClientProcess();
              return;
            }
            get().appendLog(`[TAURI-JVM] Spawned native Minecraft process PID ${pid}`);
            set((prev) => ({
              launchPhase: 'running',
              activeProcessPid: pid,
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
            onLog: (line) => {
              if (myRunId === currentLaunchRunId) get().appendLog(line);
            },
            onPhaseChange: (phase) => {
              if (myRunId === currentLaunchRunId) set({ launchPhase: phase });
            },
            onProgress: (payload) => {
              if (myRunId !== currentLaunchRunId) return;
              set((prev) => ({
                downloadProgress: {
                  ...prev.downloadProgress,
                  ...payload,
                  active: true,
                  errorMessage: null,
                },
              }));
            },
          });

          if (myRunId !== currentLaunchRunId || controller.signal.aborted) {
            return;
          }

          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 240);
            controller.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true }
            );
          });

          if (myRunId !== currentLaunchRunId || controller.signal.aborted) {
            return;
          }

          get().appendLog(
            `[CLIENT] Verified ${summary.verifiedArtifacts} bundles (${(
              summary.totalBytes /
              (1024 * 1024)
            ).toFixed(1)} MB). Opening interactive visual client viewport...`
          );

          set((prev) => ({
            launchPhase: 'running',
            activeProcessPid: null,
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
          const rawMsg =
            typeof err === 'string'
              ? err
              : err instanceof Error
                ? err.message
                : String(err ?? 'Connection interrupted');

          const isCancelled =
            myRunId !== currentLaunchRunId ||
            (err instanceof Error && err.name === 'AbortError') ||
            rawMsg.includes('LAUNCH_CANCELLED') ||
            rawMsg.toLowerCase().includes('abort') ||
            rawMsg.toLowerCase().includes('cancelled');

          if (isCancelled) {
            // If cancelDownload() already reset state synchronously, avoid duplicate toast
            if (get().launchPhase !== 'idle') {
              set({
                launchPhase: 'idle',
                activeProcessPid: null,
                downloadDrawerOpen: false,
                downloadProgress: { ...INITIAL_PROGRESS },
              });
            }
            return;
          }

          get().appendLog(`[ERROR] ${rawMsg}`);
          set((prev) => ({
            launchPhase: 'error',
            activeProcessPid: null,
            downloadProgress: {
              ...prev.downloadProgress,
              active: false,
              errorMessage: rawMsg,
            },
          }));

          if (settings.notificationsEnabled) {
            useNotificationStore.getState().pushToast({
              type: 'error',
              title: isRu ? 'Не удалось загрузить файлы клиента' : 'Failed to download client files',
              description: rawMsg,
            });
          }
        }
      },

      cancelDownload: () => {
        currentLaunchRunId += 1;
        activeAbortController?.abort();
        activeAbortController = null;

        if (isTauriDesktop()) {
          tauriCancelNativeLaunch().catch(() => {});
        }
        useVisualClientStore.getState().setLiveSessionModalOpen(false);

        set({
          launchPhase: 'idle',
          activeProcessPid: null,
          downloadDrawerOpen: false,
          downloadProgress: { ...INITIAL_PROGRESS },
        });

        get().appendLog('[ABORT] Launch cancelled immediately by user.');
        const settings = useSettingsStore.getState();
        if (settings.notificationsEnabled) {
          useNotificationStore.getState().pushToast({
            type: 'warning',
            title: settings.language === 'ru' ? 'Запуск отменён' : 'Launch cancelled',
            description:
              settings.language === 'ru'
                ? 'Загрузка и подготовка клиента мгновенно остановлены.'
                : 'Client download and preparation stopped immediately.',
          });
        }
      },

      stopRunningSession: async () => {
        currentLaunchRunId += 1;
        const settings = useSettingsStore.getState();
        const prevPid = get().activeProcessPid;
        if (isTauriDesktop()) {
          await tauriStopClientProcess();
        }
        useVisualClientStore.getState().setLiveSessionModalOpen(false);
        get().appendLog(
          prevPid
            ? `[SESSION] Terminated native Minecraft process PID ${prevPid} cleanly.`
            : '[SESSION] Client session terminated cleanly.'
        );
        set({ launchPhase: 'idle', activeProcessPid: null, downloadDrawerOpen: false });
        if (settings.notificationsEnabled) {
          useNotificationStore.getState().pushToast({
            type: 'info',
            title: settings.language === 'ru' ? 'Процесс клиента остановлен' : 'Client session stopped',
          });
        }
      },

      notifyNativeProcessExited: (pid, exitCode) => {
        const current = get();
        if (current.launchPhase !== 'running' && current.activeProcessPid === null) {
          return;
        }
        set({ launchPhase: 'idle', activeProcessPid: null, downloadDrawerOpen: false });
        const settings = useSettingsStore.getState();
        if (settings.notificationsEnabled) {
          useNotificationStore.getState().pushToast({
            type: exitCode === 0 ? 'info' : 'warning',
            title:
              settings.language === 'ru'
                ? `Minecraft завершил работу (PID ${pid})`
                : `Minecraft exited (PID ${pid})`,
            description:
              exitCode === 0
                ? settings.language === 'ru'
                  ? 'Сессия закрыта штатно — лаунчер снова готов к запуску.'
                  : 'Exited cleanly — ready for next launch.'
                : `Exit code: ${exitCode}`,
          });
        }
      },
    }),
    {
      name: 'winvisual-launcher-state-v4',
      partialize: (state) => ({
        selectedVersionId: state.selectedVersionId,
      }),
    }
  )
);
