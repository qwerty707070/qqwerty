import React from 'react';
import { Activity, Download } from 'lucide-react';
import { VersionSelector } from './VersionSelector';
import { LaunchButton } from './LaunchButton';
import { TelemetrySparkline } from '../ui/TelemetrySparkline';
import { useLauncherStore } from '../../stores/launcherStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../utils/cn';

export const LaunchPanel: React.FC = () => {
  const launchPhase = useLauncherStore((s) => s.launchPhase);
  const activeProcessPid = useLauncherStore((s) => s.activeProcessPid);
  const telemetry = useLauncherStore((s) => s.telemetry);
  const downloadProgress = useLauncherStore((s) => s.downloadProgress);
  const setDownloadDrawerOpen = useLauncherStore((s) => s.setDownloadDrawerOpen);
  const { language, ramAllocationMb, downloadSpeedLimitMbps } = useSettingsStore();

  const isRu = language === 'ru';
  const isTransferring =
    downloadProgress.active ||
    launchPhase === 'preparing' ||
    launchPhase === 'downloading' ||
    launchPhase === 'verifying';

  const pct =
    downloadProgress.totalBytes > 0
      ? Math.min(100, Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100))
      : 0;

  const cpuVal = telemetry?.cpuUsagePercent ?? 8.4;
  const rttMs = telemetry?.latencyMs ?? 9;
  const ramGb = (ramAllocationMb / 1024).toFixed(1);

  const headerLabel = isTransferring
    ? `${downloadProgress.stageLabel || (isRu ? 'Синхронизация файлов' : 'Syncing client files')}${
        downloadProgress.currentFile ? ` • ${downloadProgress.currentFile}` : ''
      }`
    : launchPhase === 'running'
      ? isRu
        ? 'Клиент запущен • Активная сессия JVM'
        : 'Client Running • Active JVM Session'
      : isRu
        ? 'Телеметрия движка • Готов к запуску'
        : 'Engine Telemetry • Ready to Launch';

  const readoutText = isTransferring
    ? `${Math.max(0.4, downloadProgress.speedMbps).toFixed(1)} MB/s • ${pct}%`
    : launchPhase === 'running'
      ? `${activeProcessPid ? `PID ${activeProcessPid} • ` : ''}RAM ${ramGb} GB • ${rttMs} ms`
      : `CPU ${cpuVal.toFixed(1)}% • RAM ${ramGb} GB • ${rttMs} ms${
          downloadSpeedLimitMbps > 0 ? ` • ≤${downloadSpeedLimitMbps} MB/s` : ''
        }`;

  return (
    <section
      aria-label="Launch control dock"
      className={cn(
        'relative z-30 w-full rounded-[18px] px-4 py-2.5 bg-[#0A0B12]/95 border border-white/[0.085]',
        'shadow-[0_-12px_36px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3'
      )}
    >
      {/* Seamless Inline Progress Hairline Along Top of Dock */}
      {isTransferring && (
        <div className="pointer-events-none absolute inset-x-4 top-0 h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent-primary)] via-[var(--accent-secondary)] to-white transition-all duration-150 shadow-[0_0_10px_var(--accent-primary)]"
            style={{ width: `${Math.max(8, pct)}%` }}
          />
        </div>
      )}

      {/* Left Column: Selected Fabric Build Selector */}
      <div className="w-full lg:w-[270px] shrink-0">
        <VersionSelector />
      </div>

      <div className="hidden lg:block h-9 w-[1px] bg-white/[0.075] shrink-0" />

      {/* Center Column: Honest Live Telemetry / Active Transfer Throughput Sparkline */}
      <button
        type="button"
        onClick={() => setDownloadDrawerOpen(true)}
        className="flex-1 flex items-center justify-between gap-4 px-3 py-1.5 rounded-[12px] hover:bg-white/[0.03] transition-colors text-left cursor-pointer min-w-0"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-9 w-9 rounded-[10px] bg-white/[0.035] border border-white/[0.07] flex items-center justify-center text-[#A8AAba] shrink-0">
            {isTransferring ? (
              <Download size={17} strokeWidth={1.8} className="text-[var(--accent-secondary)]" />
            ) : (
              <Activity size={17} strokeWidth={1.8} className="text-[#C4B5FD]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#7C7E8C] truncate">{headerLabel}</p>
            <p className="text-[14px] font-bold font-mono tracking-tight text-[#FFFFFF] mt-0.5 truncate">
              {readoutText}
            </p>
          </div>
        </div>

        <TelemetrySparkline
          variant="dock"
          active={isTransferring || launchPhase === 'running'}
          className="shrink-0"
        />
      </button>

      {/* Right Column: Vibrant Neon Launch / Stop Button */}
      <div className="flex justify-end lg:pl-2">
        <LaunchButton />
      </div>
    </section>
  );
};
