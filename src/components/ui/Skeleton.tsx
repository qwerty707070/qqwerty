import React from 'react';
import { cn } from '../../utils/cn';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[12px] bg-white/[0.045] border border-white/[0.04]',
        className
      )}
    />
  );
};
