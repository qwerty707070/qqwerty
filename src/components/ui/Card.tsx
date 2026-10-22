import React, { useRef } from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  interactive = false,
  selected = false,
  onMouseMove,
  children,
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactive && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      ref.current.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
      ref.current.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
    }
    onMouseMove?.(e);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(
        'group/card relative rounded-[16px] bg-[#0D0F16]/90 border border-white/[0.085] overflow-hidden',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.055)]',
        interactive &&
          'interactive-surface hover:-translate-y-[2px] hover:border-[rgba(var(--accent-rgb),0.45)] hover:shadow-[0_16px_38px_-12px_rgba(0,0,0,0.82),0_0_24px_-8px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.1)]',
        selected &&
          'border-[var(--accent-primary)] bg-[#131126]/95 shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.48),0_0_32px_-6px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.14)]',
        className
      )}
      {...props}
    >
      {/* Cursor-Tracking Living Obsidian Spotlight Glow + 1px Rim Highlight */}
      {interactive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(300px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(var(--accent-rgb), 0.14), transparent 70%)',
          }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};
