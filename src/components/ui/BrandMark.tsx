import React from 'react';
import { cn } from '../../utils/cn';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 28, className }) => {
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden rounded-[8px] border border-purple-400/25',
        'bg-[#090712] shadow-[0_0_20px_var(--accent-glow)] shrink-0',
        className
      )}
      style={{ width: size, height: size }}
    >
      <img
        src="/images/winvisual-logo.png"
        alt="WinVisual"
        className="w-full h-full object-cover select-none pointer-events-none"
        draggable={false}
      />
    </div>
  );
};
