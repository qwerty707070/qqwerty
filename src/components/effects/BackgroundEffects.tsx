import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';

const AMBIENT_SPARKS = [
  { left: '8%', top: '16%', size: 2.5, opacity: 0.42 },
  { left: '19%', top: '74%', size: 2, opacity: 0.3 },
  { left: '34%', top: '12%', size: 3, opacity: 0.36 },
  { left: '52%', top: '86%', size: 2.5, opacity: 0.34 },
  { left: '68%', top: '14%', size: 2, opacity: 0.45 },
  { left: '83%', top: '28%', size: 3, opacity: 0.38 },
  { left: '91%', top: '79%', size: 2.5, opacity: 0.4 },
  { left: '44%', top: '8%', size: 2, opacity: 0.28 },
];

export const BackgroundEffects: React.FC = () => {
  const backgroundEffects = useSettingsStore((s) => s.backgroundEffects);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#040509]">
      {backgroundEffects && (
        <>
          <div
            className="absolute -top-36 left-1/4 w-[720px] h-[440px] rounded-full blur-[155px] opacity-30"
            style={{
              background:
                'radial-gradient(circle, rgba(var(--accent-rgb), 0.55) 0%, rgba(16, 17, 22, 0) 72%)',
            }}
          />
          <div
            className="absolute -bottom-44 right-1/5 w-[660px] h-[400px] rounded-full blur-[155px] opacity-22"
            style={{
              background:
                'radial-gradient(circle, rgba(var(--accent-rgb), 0.48) 0%, rgba(8, 9, 13, 0) 72%)',
            }}
          />
          {/* Subtle ambient depth starlight particles tinted by active accent */}
          {AMBIENT_SPARKS.map((sp, idx) => (
            <span
              key={idx}
              style={{
                left: sp.left,
                top: sp.top,
                width: sp.size,
                height: sp.size,
                opacity: sp.opacity,
                boxShadow: '0 0 10px var(--accent-primary)',
              }}
              className="absolute rounded-full bg-[var(--accent-secondary)]"
            />
          ))}
        </>
      )}
      <div className="absolute inset-0 noise-overlay opacity-70" />
    </div>
  );
};
