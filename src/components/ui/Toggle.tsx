import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../utils/cn';

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
}) => {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'group relative inline-flex h-[24px] w-[42px] shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60',
        checked
          ? 'bg-[var(--accent-primary)] border-[var(--accent-secondary)]/50 shadow-[0_0_16px_var(--accent-glow)]'
          : 'bg-white/[0.07] border-white/[0.09] hover:bg-white/[0.11]'
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-[18px] w-[18px] rounded-full transition-transform duration-200 ease-out',
          checked
            ? 'translate-x-[20px] bg-[#0B0C11] shadow-sm'
            : 'translate-x-[2px] bg-[#D4D4DC]'
        )}
      />
    </SwitchPrimitive.Root>
  );
};
