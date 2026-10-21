import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium select-none cursor-pointer interactive-surface',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60',
          'active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none',
          size === 'sm' && 'h-8 px-3 text-[12px] rounded-[8px]',
          size === 'md' && 'h-9 px-4 text-[13px] rounded-[12px]',
          size === 'lg' && 'h-11 px-5 text-[14px] rounded-[12px]',
          variant === 'primary' && [
            'bg-[linear-gradient(135deg,var(--accent-primary)_0%,var(--accent-secondary)_100%)]',
            'text-[#09090E] font-semibold border border-white/20',
            'shadow-[0_8px_24px_-4px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.35)]',
            'hover:brightness-105 hover:shadow-[0_10px_28px_-2px_var(--accent-glow)]',
          ],
          variant === 'secondary' && [
            'bg-[var(--surface-secondary)] text-[var(--text-primary)]',
            'border border-[var(--border-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            'hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)]',
          ],
          variant === 'ghost' && [
            'bg-transparent text-[var(--text-secondary)] border border-transparent',
            'hover:bg-[var(--surface-primary)] hover:text-[var(--text-primary)]',
          ],
          variant === 'danger' && [
            'bg-rose-500/10 text-rose-300 border border-rose-500/25',
            'hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-200',
          ],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
