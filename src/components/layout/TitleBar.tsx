import React from 'react';
import {
  Download,
  Laptop,
  Maximize2,
  Minimize2,
  Minus,
  MonitorPlay,
  X,
} from 'lucide-react';
import { BrandMark } from '../ui/BrandMark';
import { Tooltip } from '../ui/Tooltip';
import { useLauncherStore } from '../../stores/launcherStore';
import { useVisualClientStore } from '../../stores/visualClientStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { GITHUB_RELEASE_URL, isTauriDesktop } from '../../services/tauriBridge';
import { cn } from '../../utils/cn';
import { tauriMinimizeWindow, tauriStartDragging } from '../../services/tauriBridge';

interface TitleBarProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onRequestClose: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  isMaximized,
  onToggleMaximize,
  onRequestClose,
}) => {
  const telemetry = useLauncherStore((s) => s.telemetry);
  const launchPhase = useLauncherStore((s) => s.launchPhase);
  const downloadProgress = useLauncherStore((s) => s.downloadProgress);
  const setDownloadDrawerOpen = useLauncherStore((s) => s.setDownloadDrawerOpen);
  const setWindowMinimized = useLauncherStore((s) => s.setWindowMinimized);
  const setLiveSessionModalOpen = useVisualClientStore((s) => s.setLiveSessionModalOpen);
  const { language, updateSetting } = useSettingsStore();

  const pct =
    downloadProgress.totalBytes > 0
      ? Math.min(100, Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100))
      : 0;

  const handleMinimize = async () => {
    const handledNative = await tauriMinimizeWindow();
    if (!handledNative) setWindowMinimized(true);
  };

  return (
    <header
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('.titlebar-no-drag')) return;
        tauriStartDragging();
      }}
      className="titlebar-drag h-[48px] shrink-0 px-4 flex items-center justify-between border-b border-[var(--border-primary)] bg-[var(--background-secondary)]/90 select-none"
    >
      {/* Left Brand Cluster */}
      <div className="flex items-center gap-3">
        <BrandMark size={28} />
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold tracking-[0.02em] text-[var(--text-primary)]">
            Win<span className="text-[var(--accent-secondary)] font-semibold">Visual</span>
          </span>
          <span className="px-2 py-0.5 text-[10.5px] font-mono font-medium rounded-full bg-white/[0.045] border border-white/[0.07] text-[var(--text-secondary)]">
            v{telemetry?.launcherVersion ?? '2.4.1'}
          </span>
        </div>
      </div>

      {/* Right Telemetry & Window Controls */}
      <div className="titlebar-no-drag flex items-center gap-1.5">
        {launchPhase === 'running' && (
          <button
            type="button"
            onClick={() => setLiveSessionModalOpen(true)}
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[8px] text-[11.5px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25 transition-colors cursor-pointer mr-1"
          >
            <MonitorPlay size={13.5} strokeWidth={1.75} />
            <span>{language === 'ru' ? 'Окно игры' : 'In-Game View'}</span>
          </button>
        )}

        {telemetry && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-[8px] bg-white/[0.025] border border-white/[0.05] mr-0.5">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                telemetry.operational ? 'bg-emerald-400' : 'bg-amber-400'
              )}
            />
            <span className="text-[11px] font-mono text-[var(--text-secondary)]">
              {telemetry.latencyMs}ms
            </span>
          </div>
        )}

        {/* Only show web installer button when inside browser preview, NOT inside installed .exe! */}
        {!isTauriDesktop() && (
          <Tooltip
            content={
              language === 'ru'
                ? 'Скачать установщик WinVisual для Windows (.exe / .msi), macOS (.dmg), Linux (.deb)'
                : 'Download WinVisual Desktop Installer (.exe / .msi / .dmg / .deb)'
            }
            side="bottom"
          >
            <a
              href={GITHUB_RELEASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download desktop installer"
              className="h-7 px-2 inline-flex items-center gap-1.5 rounded-[8px] text-[11px] font-medium text-[var(--accent-secondary)] bg-[var(--accent-subtle)] hover:brightness-110 border border-[var(--accent-primary)]/30 transition-all cursor-pointer"
            >
              <Laptop size={13.5} strokeWidth={1.75} />
              <span className="hidden md:inline">.exe / .dmg</span>
            </a>
          </Tooltip>
        )}

        {/* Quick Language Switcher */}
        <Tooltip
          content={
            language === 'ru' ? 'Переключить язык (RU / EN)' : 'Switch language (RU / EN)'
          }
          side="bottom"
        >
          <button
            type="button"
            onClick={() => updateSetting('language', language === 'ru' ? 'en' : 'ru')}
            className="h-7 px-2.5 rounded-[8px] text-[11px] font-semibold tracking-wider uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-colors cursor-pointer"
          >
            {language.toUpperCase()}
          </button>
        </Tooltip>

        {/* Download Manager Trigger */}
        <Tooltip content={language === 'ru' ? 'Менеджер загрузок' : 'Download Manager'} side="bottom">
          <button
            type="button"
            onClick={() => setDownloadDrawerOpen(true)}
            className={cn(
              'h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[8px] text-[11.5px] font-medium transition-colors cursor-pointer border',
              downloadProgress.active
                ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)]/40 text-[var(--accent-secondary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]'
            )}
          >
            <Download size={14} strokeWidth={1.75} />
            {downloadProgress.active && <span className="font-mono">{pct}%</span>}
          </button>
        </Tooltip>

        <div className="h-3.5 w-[1px] bg-white/[0.08] mx-1" />

        {/* System Window Buttons */}
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimize window"
          className="h-7 w-8 inline-flex items-center justify-center rounded-[8px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.07] transition-colors cursor-pointer"
        >
          <Minus size={15} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={onToggleMaximize}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          className="h-7 w-8 inline-flex items-center justify-center rounded-[8px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.07] transition-colors cursor-pointer"
        >
          {isMaximized ? (
            <Minimize2 size={13.5} strokeWidth={1.75} />
          ) : (
            <Maximize2 size={13.5} strokeWidth={1.75} />
          )}
        </button>

        <button
          type="button"
          onClick={onRequestClose}
          aria-label="Close launcher"
          className="h-7 w-8 inline-flex items-center justify-center rounded-[8px] text-[var(--text-secondary)] hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
};
