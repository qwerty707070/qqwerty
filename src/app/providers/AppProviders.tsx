import React, { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { TooltipProvider } from '../../components/ui/Tooltip';
import { syncAppearanceTokensToDom, useSettingsStore } from '../../stores/settingsStore';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accentId, surfaceTheme, reducedMotion, animationIntensity } = useSettingsStore();

  useEffect(() => {
    syncAppearanceTokensToDom({ accentId, surfaceTheme, reducedMotion, animationIntensity });
  }, [accentId, surfaceTheme, reducedMotion, animationIntensity]);

  return (
    <MotionConfig
      reducedMotion={reducedMotion || animationIntensity === 'minimal' ? 'always' : 'user'}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </MotionConfig>
  );
};
