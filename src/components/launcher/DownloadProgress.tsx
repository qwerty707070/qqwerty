import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  DownloadCloud,
  RotateCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { useLauncherStore } from '../../stores/launcherStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useNotificationStore } from '../../stores/notificationStore';

export const DownloadProgressModal: React.FC = () => {
  const open = useLauncherStore((s) => s.downloadDrawerOpen);
  const setOpen = useLauncherStore((s) => s.setDownloadDrawerOpen);
  const launchPhase = useLauncherStore((s) => s.launchPhase);
  const progress = useLauncherStore((s) => s.downloadProgress);
  const simulateNetworkDrop = useLauncherStore((s) => s.simulateNetworkDrop);
  const setSimulateNetworkDrop = useLauncherStore((s) => s.setSimulateNetworkDrop);
  const startLaunchSequence = useLauncherStore((s) => s.startLaunchSequence);
  const cancelDownload = useLauncherStore((s) => s.cancelDownload);
  const language = useSettingsStore((s) => s.language);

  const isRu = language === 'ru';
  const isBusy =
    progress.active ||
    launchPhase === 'preparing' ||
    launchPhase === 'downloading' ||
    launchPhase === 'verifying' ||
    launchPhase === 'launching';

  const pct =
    progress.totalBytes > 0
      ? Math.min(100, (progress.downloadedBytes / progress.totalBytes) * 100)
      : launchPhase === 'running'
        ? 100
        : 0;

  const dlMb = (progress.downloadedBytes / (1024 * 1024)).toFixed(1);
  const totalMb = (progress.totalBytes / (1024 * 1024)).toFixed(1);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      maxWidthClass="max-w-[580px]"
      title={isRu ? 'Менеджер установки клиента' : 'Client Installation & Integrity Manager'}
      description={
        isRu
          ? 'Потоковая загрузка подписанных пакетов с криптографической проверкой SHA-256.'
          : 'Real-time streaming package transfer with WebCrypto SHA-256 integrity verification.'
      }
    >
      <div className="space-y-5">
        {/* Active Package Card */}
        <div className="rounded-[14px] bg-[var(--background-secondary)] border border-[var(--border-primary)] p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-secondary)]">
                {progress.versionName}
              </p>
              <p className="text-[14.5px] font-semibold text-[var(--text-primary)] truncate">
                {progress.stageLabel ||
                  (isRu ? 'Ожидание запуска проверки файлов' : 'Ready to verify & launch client')}
              </p>
              {progress.currentFile && (
                <p className="text-[12px] font-mono text-[var(--text-muted)] truncate">
                  {progress.currentFile}
                </p>
              )}
            </div>

            <span className="text-[20px] font-mono font-semibold text-[var(--text-primary)] shrink-0">
              {pct.toFixed(0)}%
            </span>
          </div>

          {/* Smooth Hardware-Accelerated Progress Bar */}
          <div className="h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden border border-white/[0.05]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] transition-all duration-150 ease-out shadow-[0_0_16px_var(--accent-glow)]"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Real Telemetry Readouts */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-[12px]">
            <div className="rounded-[10px] bg-white/[0.025] px-3 py-2 border border-white/[0.04]">
              <p className="text-[10.5px] text-[var(--text-muted)] uppercase">
                {isRu ? 'Объём' : 'Transferred'}
              </p>
              <p className="font-mono font-medium text-[var(--text-primary)] mt-0.5">
                {progress.totalBytes > 0 ? `${dlMb} / ${totalMb} MB` : '0.0 / 30.8 MB'}
              </p>
            </div>

            <div className="rounded-[10px] bg-white/[0.025] px-3 py-2 border border-white/[0.04]">
              <p className="text-[10.5px] text-[var(--text-muted)] uppercase">
                {isRu ? 'Скорость' : 'Throughput'}
              </p>
              <p className="font-mono font-medium text-[var(--text-primary)] mt-0.5">
                {progress.speedMbps > 0 ? `${progress.speedMbps.toFixed(1)} MB/s` : '—'}
              </p>
            </div>

            <div className="rounded-[10px] bg-white/[0.025] px-3 py-2 border border-white/[0.04]">
              <p className="text-[10.5px] text-[var(--text-muted)] uppercase">
                {isRu ? 'Осталось' : 'Remaining'}
              </p>
              <p className="font-mono font-medium text-[var(--text-primary)] mt-0.5">
                {progress.etaSeconds !== null && isBusy
                  ? `${progress.etaSeconds.toFixed(1)}s`
                  : launchPhase === 'running'
                    ? isRu
                      ? 'Завершено'
                      : 'Complete'
                    : '—'}
              </p>
            </div>
          </div>

          {progress.lastSha256 && (
            <div className="flex items-center justify-between gap-2 text-[11.5px] px-3 py-2 rounded-[10px] bg-emerald-500/[0.07] border border-emerald-500/20 text-emerald-300">
              <span className="inline-flex items-center gap-2 truncate">
                <ShieldCheck size={15} strokeWidth={1.75} className="shrink-0" />
                <span className="truncate font-mono">
                  Checksum ({progress.verifiedFiles}/{progress.totalFiles}): {progress.lastSha256.slice(0, 28)}…
                </span>
              </span>
              <CheckCircle2 size={14} strokeWidth={2} className="shrink-0" />
            </div>
          )}

          {progress.errorMessage && (
            <div className="flex items-start gap-2.5 text-[12px] p-3 rounded-[10px] bg-rose-500/10 border border-rose-500/25 text-rose-200">
              <AlertTriangle size={16} strokeWidth={1.75} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">
                  {isRu ? 'Ошибка передачи пакета' : 'Artifact Stream Error'}
                </p>
                <p className="text-rose-300/90 text-[11.5px]">{progress.errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Network Resilience Test Switch */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[12px] bg-white/[0.02] border border-[var(--border-primary)]">
          <div>
            <p className="text-[12.5px] font-medium text-[var(--text-primary)]">
              {isRu ? 'Тест обрыва соединения CDN' : 'Simulate Edge Connection Fault'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {isRu
                ? 'Проверяет обработку ошибки HTTP 503 и повторную докачку.'
                : 'Triggers a real HTTP 503 stream interruption to verify retry recovery.'}
            </p>
          </div>
          <Toggle
            checked={simulateNetworkDrop}
            onCheckedChange={setSimulateNetworkDrop}
            aria-label="Simulate network drop"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-end gap-2.5">
          {isBusy ? (
            <>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                {isRu ? 'Свернуть окно' : 'Hide Window'}
              </Button>
              <Button variant="danger" type="button" onClick={() => cancelDownload()}>
                <XCircle size={15} strokeWidth={1.85} />
                {isRu ? 'Отменить запуск' : 'Cancel Launch'}
              </Button>
            </>
          ) : launchPhase === 'error' ? (
            <Button
              variant="primary"
              type="button"
              onClick={() => {
                setSimulateNetworkDrop(false);
                startLaunchSequence();
              }}
            >
              <RotateCcw size={15} strokeWidth={1.75} />
              {isRu ? 'Исправить и повторить' : 'Disable Fault & Retry'}
            </Button>
          ) : (
            <Button variant="primary" type="button" onClick={() => startLaunchSequence()}>
              <DownloadCloud size={15} strokeWidth={1.75} />
              {launchPhase === 'running'
                ? isRu
                  ? 'Остановить сессию'
                  : 'Stop Active Session'
                : isRu
                  ? 'Проверить и запустить'
                  : 'Verify & Launch Build'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export const LogsViewerModal: React.FC = () => {
  const open = useLauncherStore((s) => s.logsModalOpen);
  const setOpen = useLauncherStore((s) => s.setLogsModalOpen);
  const logs = useLauncherStore((s) => s.logs);
  const clearLogs = useLauncherStore((s) => s.clearLogs);
  const language = useSettingsStore((s) => s.language);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const isRu = language === 'ru';

  const handleCopy = () => {
    navigator.clipboard?.writeText(logs.join('\n')).catch(() => {});
    pushToast({
      type: 'success',
      title: isRu ? 'Журнал скопирован в буфер обмена' : 'Diagnostic logs copied',
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      maxWidthClass="max-w-[640px]"
      title={isRu ? 'Журнал диагностики лаунчера' : 'Launcher Diagnostic Console'}
      description={
        isRu
          ? 'Реальные события инициализации, потоковой проверки SHA-256 и параметров JVM.'
          : 'Live runtime events, package stream telemetry, and SHA-256 verification digests.'
      }
    >
      <div className="space-y-4">
        <div className="h-[290px] overflow-y-auto rounded-[12px] bg-[#07080C] border border-[var(--border-primary)] p-3.5 font-mono text-[11.5px] leading-relaxed text-[var(--text-secondary)] space-y-1">
          {logs.map((entry, idx) => (
            <div
              key={`${idx}-${entry.slice(0, 12)}`}
              className={
                entry.includes('[ERROR]')
                  ? 'text-rose-400'
                  : entry.includes('[ABORT]')
                    ? 'text-amber-300'
                    : entry.includes('[SHA-256]')
                      ? 'text-emerald-300'
                      : ''
              }
            >
              {entry}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={clearLogs}>
            <Trash2 size={14} strokeWidth={1.75} />
            {isRu ? 'Очистить журнал' : 'Clear Buffer'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            <Copy size={14} strokeWidth={1.75} />
            {isRu ? 'Копировать лог' : 'Copy Logs'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
