import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Play, RotateCcw, Square } from 'lucide-react';
import { useLauncherStore } from '../../stores/launcherStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { t } from '../../utils/i18n';
import { cn } from '../../utils/cn';

export const LaunchButton: React.FC = () => {
  const launchPhase = useLauncherStore((s) => s.launchPhase);
  const downloadProgress = useLauncherStore((s) => s.downloadProgress);
  const startLaunchSequence = useLauncherStore((s) => s.startLaunchSequence);
  const versions = useLauncherStore((s) => s.versions);
  const language = useSettingsStore((s) => s.language);

  const copy = t(language);
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
    <div className="relative group shrink-0">
      {/* Dynamic Ambient Accent Glow underneath Play Button */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -inset-1.5 rounded-[18px] blur-xl transition-opacity duration-300',
          launchPhase === 'error'
            ? 'bg-rose-500/35 opacity-75 group-hover:opacity-100'
            : launchPhase === 'running'
              ? 'bg-emerald-500/30 opacity-65 group-hover:opacity-90'
              : 'bg-[var(--accent-glow)] opacity-55 group-hover:opacity-100'
        )}
      />

      <motion.button
        type="button"
        whileHover={{ scale: 1.014 }}
        whileTap={{ scale: 0.976 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        disabled={versions.length === 0}
        onClick={() => startLaunchSequence()}
        className={cn(
          'relative h-[56px] min-w-[232px] px-7 rounded-[14px] flex items-center justify-center gap-3 overflow-hidden select-none cursor-pointer',
          'font-semibold tracking-[0.045em] text-[14px] border transition-all duration-200 disabled:opacity-45 disabled:pointer-events-none',
          launchPhase === 'error' && [
            'bg-gradient-to-r from-rose-500 to-rose-400 text-white border-rose-300/30',
            'shadow-[0_10px_28px_-6px_rgba(244,63,94,0.55),inset_0_1px_0_rgba(255,255,255,0.28)]',
          ],
          launchPhase === 'running' && [
            'bg-gradient-to-r from-emerald-500/20 to-emerald-400/15 text-emerald-200 border-emerald-400/35',
            'hover:border-emerald-300/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
          ],
          launchPhase !== 'error' &&
            launchPhase !== 'running' && [
              'bg-[linear-gradient(135deg,var(--accent-primary)_0%,var(--accent-secondary)_100%)]',
              'text-[#090A10] border-white/25',
              'shadow-[0_12px_32px_-6px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.45)]',
              'hover:brightness-[1.06]',
            ]
        )}
      >
        {/* Subtle Optical Sheen Sweep on Hover */}
        {!isBusy && launchPhase === 'idle' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
        )}

        {/* Real Byte Progress Fill Bar when Downloading */}
        {isBusy && (
          <div
            className="absolute inset-y-0 left-0 bg-white/25 transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        )}

        <span className="relative z-10 flex items-center gap-2.5">
          {isBusy ? (
            <>
              <Loader2 size={18} strokeWidth={2.2} className="animate-spin" />
              <span>
                {launchPhase === 'downloading'
                  ? `${pct}% • ${copy.phases.downloading}`
                  : copy.phases[launchPhase]}
              </span>
            </>
          ) : launchPhase === 'running' ? (
            <>
              <Square size={15} strokeWidth={2.2} fill="currentColor" />
              <span>{copy.launchPanel.stopButton}</span>
            </>
          ) : launchPhase === 'error' ? (
            <>
              <RotateCcw size={17} strokeWidth={2.2} />
              <span>{copy.launchPanel.retryButton}</span>
            </>
          ) : (
            <>
              <Play size={17} strokeWidth={2.2} fill="currentColor" />
              <span>{copy.launchPanel.playButton}</span>
            </>
          )}
        </span>
      </motion.button>

      {launchPhase === 'error' && (
        <span className="sr-only" role="alert">
          <AlertCircle size={12} /> {downloadProgress.errorMessage}
        </span>
      )}
    </div>
  );
};
