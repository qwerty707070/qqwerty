import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../utils/cn';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (val: number) => void;
  className?: string;
  'aria-label'?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  className,
  'aria-label': ariaLabel,
}) => {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex items-center select-none touch-none w-full h-5', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      onValueChange={(vals) => {
        if (vals[0] !== undefined) onValueChange(vals[0]);
      }}
    >
      <SliderPrimitive.Track className="relative grow rounded-full h-[6px] bg-white/[0.08] overflow-hidden border border-white/[0.05]">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          'block w-4 h-4 rounded-full bg-[#F5F5F7] border-2 border-[var(--accent-primary)]',
          'shadow-[0_0_12px_var(--accent-glow)] cursor-grab active:cursor-grabbing',
          'transition-transform duration-150 hover:scale-110 focus:outline-none'
        )}
      />
    </SliderPrimitive.Root>
  );
};
