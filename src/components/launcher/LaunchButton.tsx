import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ChevronRight,
  Eye,
  Play,
  RotateCcw,
  Square,
  XCircle,
} from 'lucide-react';
import { useLauncherStore } from '../../stores/launcherStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { t } from '../../utils/i18n';
import { cn } from '../../utils/cn';

export const LaunchButton: React.FC = () => {
  const launchPhase = useLauncherStore((s) => s.launchPhase);
  const downloadProgress = useLauncherStore((s) => s.downloadProgress);
  const startLaunchSequence = useLauncherStore((s) => s.startLaunchSequence);
  const cancelDownload = useLauncherStore((s) => s.cancelDownload);
  const setDownloadDrawerOpen = useLauncherStore((s) => s.setDownloadDrawerOpen);
  const versions = useLauncherStore((s) => s.versions);
  const language = useSettingsStore((s) => s.language);

  const copy = t(language);
  const isRu = language === 'ru';
  const isBusy =
    launchPhase === 'preparing' ||
    launchPhase === 'downloading' ||
    launchPhase === 'verifying' ||
    launchPhase === 'launching';

  const pct =
    downloadProgress.totalBytes > 0
      ? Math.min(100, Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100))
      : 0;

  return (
    <div className="relative flex items-center gap-2 shrink-0">
      {/* Optional quick progress modal viewer pill while busy */}
      {isBusy && (
        <button
          type="button"
          onClick={() => setDownloadDrawerOpen(true)}
          title={isRu ? 'Показать детали загрузки' : 'Show transfer details'}
          className="h-[52px] px-3.5 rounded-[14px] bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.12] flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#E4E4EC] transition-colors cursor-pointer"
        >
          <Eye size={14} strokeWidth={2} className="text-[var(--accent-secondary)]" />
          <span>{pct}%</span>
        </button>
      )}

      <div className="relative group">
        {/* Vibrant Outer Neon Halo Bloom */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-2 rounded-[20px] blur-xl transition-opacity duration-300',
            isBusy || launchPhase === 'error'
              ? 'bg-rose-500/45 opacity-80 group-hover:opacity-100'
              : launchPhase === 'running'
                ? 'bg-emerald-500/35 opacity-70 group-hover:opacity-95'
                : 'bg-[#7A5CFF] opacity-65 group-hover:opacity-95'
          )}
        />

        <motion.button
          type="button"
          whileHover={{ scale: 1.018 }}
          whileTap={{ scale: 0.978 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          disabled={versions.length === 0}
          onClick={() => {
            if (isBusy) {
              cancelDownload();
            } else {
              startLaunchSequence();
            }
          }}
          className={cn(
            'relative h-[52px] min-w-[218px] px-7 rounded-[14px] flex items-center justify-between gap-4 overflow-hidden select-none cursor-pointer',
            'font-bold tracking-[0.06em] uppercase text-[14px] transition-all duration-200 disabled:opacity-45 disabled:pointer-events-none',
            isBusy && [
              'bg-gradient-to-r from-rose-600/90 to-rose-500/85 text-white border border-rose-300/65',
              'shadow-[0_0_26px_rgba(244,63,94,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]',
              'hover:brightness-110',
            ],
            launchPhase === 'error' && [
              'bg-gradient-to-r from-rose-600 to-rose-500 text-white border border-rose-300/60',
              'shadow-[0_0_26px_rgba(244,63,94,0.6),inset_0_0_0_1px_rgba(255,255,255,0.3)]',
            ],
            launchPhase === 'running' && [
              'bg-gradient-to-r from-emerald-600/30 to-emerald-500/20 text-emerald-100 border border-emerald-300/60',
              'shadow-[0_0_24px_rgba(16,185,129,0.35),inset_0_0_0_1px_rgba(255,255,255,0.2)]',
            ],
            !isBusy &&
              launchPhase !== 'error' &&
              launchPhase !== 'running' && [
                'bg-[linear-gradient(135deg,#664AFF_0%,#7C63FF_52%,#927BFF_100%)]',
                'text-[#FFFFFF] border-[1.5px] border-[#D8D0FF]/80',
                'shadow-[0_0_30px_rgba(124,99,255,0.65),inset_0_1px_1px_rgba(255,255,255,0.65)]',
                'hover:brightness-[1.08]',
              ]
          )}
        >
          {/* Optical Light Beam Sweep */}
          {!isBusy && launchPhase === 'idle' && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          )}

          {/* Inline Progress Fill Bar when Downloading */}
          {isBusy && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-white/15 transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          )}

          <span className="w-3" aria-hidden="true" />

          <span className="relative z-10 flex items-center gap-2.5">
            {isBusy ? (
              <>
                <XCircle size={17} strokeWidth={2.3} />
                <span>{isRu ? 'ОТМЕНИТЬ ЗАПУСК' : 'CANCEL LAUNCH'}</span>
              </>
            ) : launchPhase === 'running' ? (
              <>
                <Square size={14} strokeWidth={2.3} fill="currentColor" />
                <span>{copy.launchPanel.stopButton}</span>
              </>
            ) : launchPhase === 'error' ? (
              <>
                <RotateCcw size={16} strokeWidth={2.3} />
                <span>{copy.launchPanel.retryButton}</span>
              </>
            ) : (
              <>
                <Play size={16} strokeWidth={2.4} fill="currentColor" />
                <span>{isRu ? 'ИГРАТЬ' : 'PLAY'}</span>
              </>
            )}
          </span>

          <ChevronRight
            size={16}
            strokeWidth={2.2}
            className="relative z-10 text-white/80 group-hover:translate-x-0.5 transition-transform"
          />
        </motion.button>

        {launchPhase === 'error' && (
          <span className="sr-only" role="alert">
            <AlertCircle size={12} /> {downloadProgress.errorMessage}
          </span>
        )}
      </div>
    </div>
  );
};
