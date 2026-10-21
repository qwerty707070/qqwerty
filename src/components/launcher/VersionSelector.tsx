import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { useLauncherStore } from '../../stores/launcherStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { t } from '../../utils/i18n';
import { cn } from '../../utils/cn';

export const VersionSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const selectVersion = useLauncherStore((s) => s.selectVersion);
  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const language = useSettingsStore((s) => s.language);

  const copy = t(language);
  const activeVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0];

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] hover:bg-white/[0.04] transition-colors text-left cursor-pointer group"
      >
        <div className="h-9 w-9 rounded-[10px] bg-[var(--accent-subtle)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0 text-[var(--accent-secondary)]">
          <Layers size={18} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {copy.launchPanel.versionLabel}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">
              {activeVersion ? activeVersion.name : 'WinVisual 2.4.0'}
            </span>
            {activeVersion && (
              <span className="px-1.5 py-0.5 text-[10.5px] font-mono rounded-[6px] bg-white/[0.06] text-[var(--text-secondary)] shrink-0">
                {activeVersion.minecraftVersion}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={cn(
            'text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-transform duration-200 shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-[calc(100%+10px)] left-0 w-[300px] z-40 rounded-[16px] glass-panel p-2 space-y-1"
          >
            <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium">
              <span>{language === 'ru' ? 'Доступные сборки' : 'Available Builds'}</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCurrentPage('versions');
                }}
                className="text-[var(--accent-secondary)] hover:underline cursor-pointer"
              >
                {language === 'ru' ? 'Все версии →' : 'All builds →'}
              </button>
            </div>

            {versions.map((ver) => {
              const selected = ver.id === selectedVersionId;
              return (
                <button
                  key={ver.id}
                  type="button"
                  onClick={() => {
                    selectVersion(ver.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-left transition-colors cursor-pointer',
                    selected
                      ? 'bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                      : 'hover:bg-white/[0.05] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{ver.name}</span>
                      {ver.channel === 'beta' && (
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                          Beta
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono">
                      Minecraft {ver.minecraftVersion} • {ver.loader}
                    </p>
                  </div>
                  {selected && (
                    <Check size={15} strokeWidth={2} className="text-[var(--accent-secondary)] shrink-0" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
