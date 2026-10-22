import React, { useEffect, useState } from 'react';
import type { PlayerAccount } from '../../types/launcher';
import { cn } from '../../utils/cn';

interface MinecraftAvatarProps {
  preset: PlayerAccount['skinPreset'];
  customSkinDataUrl?: string | null;
  size?: number;
  online?: boolean;
  showStatusDot?: boolean;
  className?: string;
}

const SKIN_GRIDS: Record<
  Exclude<PlayerAccount['skinPreset'], 'winvisual'>,
  { palette: Record<string, string>; rows: string[] }
> = {
  obsidian: {
    palette: {
      d: '#2A1B12',
      s: '#E6B89C',
      u: '#CA9678',
      b: '#231710',
      w: '#F5F5F7',
    },
    rows: [
      'dddddddd',
      'dssssssd',
      'ssssssss',
      'ssssssss',
      'swduudws',
      'ssbbbbss',
      'sbbbbbbb',
      'bbbbbbbb',
    ],
  },
  classic: {
    palette: {
      h: '#2F1F15',
      k: '#3D291D',
      s: '#C68F6E',
      u: '#AA7455',
      w: '#FFFFFF',
      e: '#4B5BAB',
      m: '#714633',
    },
    rows: [
      'hhhhhhhh',
      'hkkkkkkh',
      'hssssssh',
      'ssssssss',
      'sweuusws',
      'sssuusss',
      'ssmmmmss',
      'ssuuuuus',
    ],
  },
  slim: {
    palette: {
      c: '#8B7CFF',
      g: '#C4B5FD',
      h: '#242232',
      l: '#35324A',
      s: '#F2D2BD',
      u: '#DDB69E',
      e: '#7C6BFF',
      w: '#FFFFFF',
    },
    rows: [
      'hllhhllh',
      'cgcghcgc',
      'hllllllh',
      'hssssssh',
      'sweuusws',
      'ssssssss',
      'sssuusss',
      'hssssssh',
    ],
  },
};

export const MinecraftAvatar: React.FC<MinecraftAvatarProps> = ({
  preset,
  customSkinDataUrl,
  size = 40,
  online,
  showStatusDot = false,
  className,
}) => {
  const [croppedHeadUrl, setCroppedHeadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!customSkinDataUrl || typeof document === 'undefined') {
      setCroppedHeadUrl(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const cvs = document.createElement('canvas');
        cvs.width = 64;
        cvs.height = 64;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        // Draw base head front (8, 8, 8, 8) scaled crisp to 64x64
        ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 64, 64);
        // Overlay 3D outer hat/hair front (40, 8, 8, 8) if skin width >= 64
        if (img.width >= 64) {
          ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 64, 64);
        }
        setCroppedHeadUrl(cvs.toDataURL('image/png'));
      } catch {
        setCroppedHeadUrl(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setCroppedHeadUrl(null);
    };
    img.src = customSkinDataUrl;

    return () => {
      cancelled = true;
    };
  }, [customSkinDataUrl]);

  const isEmblemAvatar = !customSkinDataUrl && (preset === 'winvisual' || !(preset in SKIN_GRIDS));
  const skin =
    !customSkinDataUrl && !isEmblemAvatar
      ? SKIN_GRIDS[preset as Exclude<PlayerAccount['skinPreset'], 'winvisual'>]
      : null;

  return (
    <div
      className={cn('relative inline-flex shrink-0 select-none', className)}
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full overflow-hidden rounded-[10px] border border-purple-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_rgba(0,0,0,0.55)] bg-[#0B0914]">
        {customSkinDataUrl ? (
          <img
            src={croppedHeadUrl ?? customSkinDataUrl}
            alt="Custom Player Skin"
            style={{ imageRendering: 'pixelated' }}
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : isEmblemAvatar ? (
          <img
            src="/images/winvisual-logo.png"
            alt="WinVisual Avatar"
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <svg
            viewBox="0 0 8 8"
            width={size}
            height={size}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            {skin!.rows.map((row, y) =>
              row.split('').map((ch, x) => (
                <rect
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  width={1}
                  height={1}
                  fill={(skin!.palette[ch] ?? '#1E202B').slice(0, 7)}
                />
              ))
            )}
          </svg>
        )}
      </div>
      {showStatusDot && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[#101116]',
            size >= 64 ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5',
            online ? 'bg-emerald-400' : 'bg-zinc-500'
          )}
        />
      )}
    </div>
  );
};
