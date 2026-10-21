import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../utils/cn';

export const AmbientGlow: React.FC<{ className?: string }> = ({ className }) => {
  const backgroundEffects = useSettingsStore((s) => s.backgroundEffects);
  if (!backgroundEffects) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none select-none overflow-hidden',
        className
      )}
    >
      <div
        className="w-[540px] h-[340px] rounded-full blur-[115px] opacity-30"
        style={{
          background:
            'radial-gradient(circle, rgba(var(--accent-rgb), 0.55) 0%, rgba(var(--accent-rgb), 0) 70%)',
        }}
      />
    </div>
  );
};
