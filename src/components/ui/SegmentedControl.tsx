import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutGroupId: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutGroupId,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center p-1 rounded-[12px] bg-[var(--background-secondary)] border border-[var(--border-primary)] gap-1',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative px-3.5 py-1.5 text-[12.5px] font-medium rounded-[8px] transition-colors cursor-pointer select-none',
              active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutGroupId}
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                className="absolute inset-0 rounded-[8px] bg-[var(--surface-hover)] border border-[var(--border-hover)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
