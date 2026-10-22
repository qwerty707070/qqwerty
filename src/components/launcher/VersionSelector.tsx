import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { MinecraftBlockIcon } from '../ui/MinecraftBlockIcon';
import { useLauncherStore } from '../../stores/launcherStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../utils/cn';

interface MenuPosition {
  left: number;
  bottom: number;
  width: number;
}

export const VersionSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuPosition>({ left: 260, bottom: 96, width: 324 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const selectVersion = useLauncherStore((s) => s.selectVersion);
  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const language = useSettingsStore((s) => s.language);

  const isRu = language === 'ru';
  const activeVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0];

  const syncPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const menuWidth = Math.max(Math.round(rect.width), 320);
    const clampedLeft = Math.min(
      Math.max(12, Math.round(rect.left)),
      Math.max(12, window.innerWidth - menuWidth - 12)
    );
    setCoords({
      left: clampedLeft,
      bottom: Math.max(16, Math.round(window.innerHeight - rect.top + 10)),
      width: menuWidth,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    syncPosition();

    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [open, syncPosition]);

  const toggleMenu = () => {
    if (!open) syncPosition();
    setOpen((o) => !o);
  };

  const dropdownNode = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            bottom: `${coords.bottom}px`,
            width: `${coords.width}px`,
            zIndex: 9999,
          }}
          className="rounded-[16px] popover-panel p-2 space-y-1 select-none"
        >
          <div className="px-3 py-2 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium border-b border-white/[0.07] mb-1">
            <span>{isRu ? 'Доступные сборки Fabric' : 'Fabric Builds'}</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCurrentPage('versions');
              }}
              className="text-[var(--accent-secondary)] hover:underline cursor-pointer"
            >
              {isRu ? 'Все версии →' : 'All builds →'}
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
                  'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-[12px] text-left transition-colors cursor-pointer border',
                  selected
                    ? 'bg-[#1D1B35] border-[var(--accent-primary)]/55 text-[#FFFFFF]'
                    : 'bg-transparent border-transparent hover:bg-white/[0.06] text-[#B4B6C4] hover:text-white'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MinecraftBlockIcon size={30} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-[#F5F5F7]">
                        {ver.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-[6px] text-[10px] font-mono bg-white/[0.07] text-[var(--text-secondary)]">
                        {ver.minecraftVersion === '1.16.5' ? 'Java 8' : 'Java 21'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5">
                      {ver.loader} • {ver.fpsBoost}
                    </p>
                  </div>
                </div>
                {selected && (
                  <Check size={15} strokeWidth={2.2} className="text-[var(--accent-secondary)] shrink-0" />
                )}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleMenu}
        className="w-full flex items-center gap-3.5 px-3 py-1.5 rounded-[12px] hover:bg-white/[0.04] transition-colors text-left cursor-pointer group outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]/60"
      >
        <MinecraftBlockIcon
          size={40}
          className="shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)] group-hover:scale-105 transition-transform duration-200"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-[#7C7E8C]">
            {isRu ? 'Выбранный билд' : 'Selected Build'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[15px] font-bold tracking-tight text-[#FFFFFF] truncate">
              {activeVersion ? activeVersion.name : 'Fabric 1.21.11'}
            </span>
          </div>
        </div>
        <ChevronDown
          size={16}
          strokeWidth={1.85}
          className={cn(
            'text-[#8E909C] group-hover:text-white transition-transform duration-200 shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>

      {typeof document !== 'undefined' && document.body
        ? createPortal(dropdownNode, document.body)
        : dropdownNode}
    </div>
  );
};
