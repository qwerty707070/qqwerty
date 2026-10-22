import React from 'react';
import {
  Download,
  Laptop,
  Minimize2,
  Minus,
  MonitorPlay,
  Square,
  X,
} from 'lucide-react';
import { BrandMark } from '../ui/BrandMark';
import { Tooltip } from '../ui/Tooltip';
import { useLauncherStore } from '../../stores/launcherStore';
import { useVisualClientStore } from '../../stores/visualClientStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  GITHUB_RELEASE_URL,
  isTauriDesktop,
  tauriMinimizeWindow,
  tauriStartDragging,
} from '../../services/tauriBridge';
import { cn } from '../../utils/cn';

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
      className="titlebar-drag relative h-[52px] shrink-0 px-5 flex items-center justify-between border-b border-white/[0.075] bg-[#08090F]/95 select-none"
    >
      {/* Subtle luminous violet hairline along top edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, rgba(var(--accent-rgb), 0.14) 0%, rgba(var(--accent-rgb), 0.35) 28%, rgba(255,255,255,0.06) 100%)',
        }}
      />

      {/* Left Brand Cluster matching the WinVisual concept header */}
      <div className="flex items-center gap-3">
        <BrandMark size={32} />
        <span className="text-[17px] font-bold tracking-[-0.015em] text-[#FFFFFF]">
          WinVisual
        </span>
      </div>

      {/* Right Clean Minimal Controls */}
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

        {!isTauriDesktop() && (
          <Tooltip
            content={
              language === 'ru'
                ? 'Скачать установщик WinVisual (.exe / .msi / .dmg / .deb)'
                : 'Download WinVisual Desktop Installer (.exe / .msi / .dmg / .deb)'
            }
            side="bottom"
          >
            <a
              href={GITHUB_RELEASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download desktop installer"
              className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[8px] text-[11px] font-medium text-[var(--accent-secondary)] bg-[var(--accent-subtle)] hover:brightness-110 border border-[var(--accent-primary)]/35 transition-all cursor-pointer"
            >
              <Laptop size={13} strokeWidth={1.75} />
              <span className="hidden md:inline">.exe</span>
            </a>
          </Tooltip>
        )}

        <Tooltip
          content={
            language === 'ru' ? 'Переключить язык (RU / EN)' : 'Switch language (RU / EN)'
          }
          side="bottom"
        >
          <button
            type="button"
            onClick={() => updateSetting('language', language === 'ru' ? 'en' : 'ru')}
            className="h-7 px-2 rounded-[8px] text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {language.toUpperCase()}
          </button>
        </Tooltip>

        {downloadProgress.active && (
          <button
            type="button"
            onClick={() => setDownloadDrawerOpen(true)}
            className={cn(
              'h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[8px] text-[11.5px] font-medium transition-colors cursor-pointer border',
              'bg-[var(--accent-subtle)] border-[var(--accent-primary)]/40 text-[var(--accent-secondary)]'
            )}
          >
            <Download size={13.5} strokeWidth={1.75} />
            <span className="font-mono">{pct}%</span>
          </button>
        )}

        <div className="h-3.5 w-[1px] bg-white/[0.08] mx-1" />

        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimize window"
          className="h-7 w-8 inline-flex items-center justify-center rounded-[8px] text-[#A1A1AA] hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
        >
          <Minus size={15} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={onToggleMaximize}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          className="h-7 w-8 inline-flex items-center justify-center rounded-[8px] text-[#A1A1AA] hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
        >
          {isMaximized ? (
            <Minimize2 size={13} strokeWidth={1.75} />
          ) : (
            <Square size={12.5} strokeWidth={1.75} />
          )}
        </button>

        <button
          type="button"
          onClick={onRequestClose}
          aria-label="Close launcher"
          className="h-7 w-8 inline-flex items-center justify-center rounded-[8px] text-[#A1A1AA] hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
};
