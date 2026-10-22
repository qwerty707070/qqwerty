import React, { useId } from 'react';

interface TelemetrySparklineProps {
  variant?: 'card' | 'dock';
  active?: boolean;
  className?: string;
}

/**
 * Smooth glowing neon-accent SVG telemetry waveform matching the Home runtime card & bottom Launch Dock.
 */
export const TelemetrySparkline: React.FC<TelemetrySparklineProps> = ({
  variant = 'dock',
  active = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const lineGradId = `spark-line-${uid}`;
  const fillGradId = `spark-fill-${uid}`;
  const glowId = `spark-glow-${uid}`;

  if (variant === 'card') {
    const pathD =
      'M 0 42 Q 18 30, 34 35 T 68 38 T 104 28 T 140 36 T 178 26 T 214 34 T 252 20 T 288 26 T 320 14';
    const areaD = `${pathD} L 320 60 L 0 60 Z`;

    return (
      <svg
        viewBox="0 0 320 60"
        preserveAspectRatio="none"
        className={`w-full h-[54px] block pointer-events-none ${className}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={lineGradId} x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.45" />
            <stop offset="55%" stopColor="var(--accent-secondary)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#E4DFFF" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={fillGradId} x1="0" y1="10" x2="0" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
          </linearGradient>
          <filter id={glowId} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={areaD} fill={`url(#${fillGradId})`} />
        <path
          d={pathD}
          fill="none"
          stroke={`url(#${lineGradId})`}
          strokeWidth="2.3"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
        />
      </svg>
    );
  }

  const dockPath = active
    ? 'M 2 25 Q 20 20, 38 22 T 76 15 T 114 19 T 152 9 T 190 14 T 226 6'
    : 'M 2 26 Q 22 22, 42 24 T 84 18 T 126 21 T 164 11 T 202 16 T 226 10';
  const dockArea = `${dockPath} L 226 32 L 2 32 Z`;

  return (
    <svg
      viewBox="0 0 230 32"
      preserveAspectRatio="none"
      className={`w-[180px] sm:w-[215px] h-[30px] block pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={lineGradId} x1="0" y1="0" x2="230" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
          <stop offset="50%" stopColor="var(--accent-secondary)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={fillGradId} x1="0" y1="4" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-12%" y="-40%" width="124%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={dockArea} fill={`url(#${fillGradId})`} />
      <path
        d={dockPath}
        fill="none"
        stroke={`url(#${lineGradId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        filter={`url(#${glowId})`}
      />
      <circle cx="164" cy="11" r="2.6" fill="#FFFFFF" filter={`url(#${glowId})`} />
    </svg>
  );
};
