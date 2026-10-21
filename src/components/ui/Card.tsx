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
        'group/card relative rounded-[16px] bg-[var(--surface-primary)] border border-[var(--border-primary)] overflow-hidden',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.045)]',
        interactive &&
          'interactive-surface hover:-translate-y-[2px] hover:bg-[var(--surface-secondary)] hover:border-[var(--border-hover)] hover:shadow-[0_14px_34px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.07)]',
        selected &&
          'border-[var(--accent-primary)]/60 bg-[var(--accent-subtle)] shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.22),0_12px_30px_-10px_var(--accent-glow)]',
        className
      )}
      {...props}
    >
      {interactive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(280px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(var(--accent-rgb), 0.085), transparent 72%)',
          }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};
