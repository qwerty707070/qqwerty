import React from 'react';
import { cn } from '../../utils/cn';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 26, className }) => {
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-[8px] border border-white/12',
        'bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_0_20px_var(--accent-glow)]',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 2.25L20.5 19.25L16.2 19.25L12 10.65L7.8 19.25L3.5 19.25L12 2.25Z"
          fill="url(#aether_grad)"
        />
        <path
          d="M12 13.75L15.1 20.25H8.9L12 13.75Z"
          fill="#FFFFFF"
          fillOpacity="0.92"
        />
        <defs>
          <linearGradient id="aether_grad" x1="4" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--accent-secondary)" />
            <stop offset="1" stopColor="var(--accent-primary)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
