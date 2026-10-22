import React from 'react';

interface MinecraftBlockIconProps {
  size?: number;
  className?: string;
}

/**
 * Crisp 3D isometric Minecraft grass-dirt block vector icon matching the WinVisual launch dock & version cards.
 */
export const MinecraftBlockIcon: React.FC<MinecraftBlockIconProps> = ({
  size = 38,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mcTopGrass" x1="8" y1="6" x2="40" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6CD94C" />
          <stop offset="55%" stopColor="#4CAF33" />
          <stop offset="100%" stopColor="#3B8E26" />
        </linearGradient>
        <linearGradient id="mcLeftDirt" x1="6" y1="15" x2="24" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5E3C" />
          <stop offset="100%" stopColor="#5C3B23" />
        </linearGradient>
        <linearGradient id="mcRightDirt" x1="24" y1="24" x2="42" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6D472B" />
          <stop offset="100%" stopColor="#3F2716" />
        </linearGradient>
      </defs>

      {/* Top lush grass face */}
      <polygon points="24,5 42,15 24,25 6,15" fill="url(#mcTopGrass)" />
      {/* Subtle pixel grass texture highlights */}
      <polygon points="24,8 31,12 24,16 17,12" fill="#84EE63" fillOpacity="0.32" />
      <polygon points="15,14 20,17 15,20 10,17" fill="#2E741D" fillOpacity="0.28" />

      {/* Left dirt face + overhanging grass lip */}
      <polygon points="6,15 24,25 24,43 6,33" fill="url(#mcLeftDirt)" />
      <polygon points="6,15 24,25 24,30 19,27.5 19,29.5 13,26 13,24 6,20" fill="#4BA832" />
      <rect x="10" y="29" width="3" height="3" transform="skewY(29)" fill="#A3724C" fillOpacity="0.4" />

      {/* Right shaded dirt face + overhanging grass lip */}
      <polygon points="24,25 42,15 42,33 24,43" fill="url(#mcRightDirt)" />
      <polygon points="24,25 42,15 42,20 36,23.5 36,25.5 30,28.8 30,27 24,30" fill="#358221" />

      {/* Outer crisp isometric highlight rim */}
      <polygon
        points="24,5 42,15 42,33 24,43 6,33 6,15"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
};
