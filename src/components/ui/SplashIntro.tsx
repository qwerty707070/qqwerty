import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrandMark } from './BrandMark';
import { useSettingsStore } from '../../stores/settingsStore';

let bootShownOnce = false;

/**
 * 0.72-second GPU-accelerated WinVisual Crown-W launch splash on first client mount.
 * Starts hidden on SSR so server snapshots render immediately with zero blocking overlay.
 */
export const SplashIntro: React.FC = () => {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (bootShownOnce || reducedMotion) return;
    bootShownOnce = true;
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 760);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[10000] bg-[#05060A] flex flex-col items-center justify-center gap-4 select-none pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col items-center gap-3"
          >
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-full blur-2xl opacity-65"
              style={{
                background:
                  'radial-gradient(circle, var(--accent-glow) 0%, rgba(0,0,0,0) 72%)',
              }}
            />
            <BrandMark size={64} />
            <div className="text-center space-y-1">
              <p className="text-[20px] font-bold tracking-tight text-[#F5F5F7]">WinVisual</p>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--accent-secondary)]">
                RenderCore 2.5 • GLSL 144Hz
              </p>
            </div>
            <div className="w-40 h-[3px] rounded-full bg-white/[0.08] overflow-hidden mt-1">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] via-[var(--accent-secondary)] to-white shadow-[0_0_12px_var(--accent-primary)]"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
