import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';

export const BackgroundEffects: React.FC = () => {
  const backgroundEffects = useSettingsStore((s) => s.backgroundEffects);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Subtle atmospheric glow anchoring desktop stage behind window */}
      {backgroundEffects && (
        <>
          <div
            className="absolute -top-36 left-1/4 w-[680px] h-[420px] rounded-full blur-[150px] opacity-25"
            style={{
              background:
                'radial-gradient(circle, rgba(var(--accent-rgb), 0.5) 0%, rgba(16, 17, 22, 0) 72%)',
            }}
          />
          <div
            className="absolute -bottom-44 right-1/4 w-[620px] h-[380px] rounded-full blur-[150px] opacity-15"
            style={{
              background:
                'radial-gradient(circle, rgba(var(--accent-rgb), 0.42) 0%, rgba(8, 9, 13, 0) 72%)',
            }}
          />
        </>
      )}
      <div className="absolute inset-0 noise-overlay opacity-70" />
    </div>
  );
};
