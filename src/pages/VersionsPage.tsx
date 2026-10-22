import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, MoveHorizontal, RefreshCw } from 'lucide-react';
import { useLauncherStore } from '../stores/launcherStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MinecraftBlockIcon } from '../components/ui/MinecraftBlockIcon';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../utils/cn';

type AtmosphereMode = 'night' | 'sunset' | 'fog';

const ATMOSPHERE_OVERLAYS: Record<
  AtmosphereMode,
  {
    labelRu: string;
    labelEn: string;
    tintGradient: string;
    coords: string;
    biome: string;
  }
> = {
  night: {
    labelRu: 'Ночь',
    labelEn: 'Night',
    tintGradient:
      'radial-gradient(circle at 66% 52%, rgba(139, 124, 255, 0.30) 0%, rgba(12, 10, 28, 0.08) 65%)',
    coords: 'X: 128  Y: 72  Z: -256',
    biome: 'Biome: Plains',
  },
  sunset: {
    labelRu: 'Закат',
    labelEn: 'Sunset',
    tintGradient:
      'linear-gradient(135deg, rgba(244, 63, 94, 0.28) 0%, rgba(217, 119, 6, 0.22) 48%, rgba(139, 92, 246, 0.30) 100%)',
    coords: 'X: -412  Y: 94  Z: 804',
    biome: 'Biome: Cherry Grove',
  },
  fog: {
    labelRu: 'Туман',
    labelEn: 'Fog',
    tintGradient:
      'linear-gradient(180deg, rgba(56, 189, 248, 0.22) 0%, rgba(129, 140, 248, 0.26) 55%, rgba(15, 23, 42, 0.42) 100%)',
    coords: 'X: 64  Y: 68  Z: 1092',
    biome: 'Biome: Taiga Mist',
  },
};

const VERSION_ARTWORK: Record<string, string> = {
  '1.21.11': '/images/hero-castle-violet.jpg',
  '1.21.4': '/images/card-starlight.jpg',
  '1.16.5': '/images/ver-1-16-5.jpg',
};

export const VersionsPage: React.FC = () => {
  const [atmosphere, setAtmosphere] = useState<AtmosphereMode>('night');
  const [splitPct, setSplitPct] = useState(48);
  const compareRef = useRef<HTMLDivElement>(null);

  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const versionsLoading = useLauncherStore((s) => s.versionsLoading);
  const versionsError = useLauncherStore((s) => s.versionsError);
  const loadInitialData = useLauncherStore((s) => s.loadInitialData);
  const selectVersion = useLauncherStore((s) => s.selectVersion);
  const language = useSettingsStore((s) => s.language);

  const isRu = language === 'ru';
  const atm = ATMOSPHERE_OVERLAYS[atmosphere];

  const updateSplitFromClientX = (clientX: number) => {
    const el = compareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
    setSplitPct(Math.min(90, Math.max(10, Math.round(pct * 10) / 10)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    updateSplitFromClientX(e.clientX);
    const onMove = (ev: PointerEvent) => updateSplitFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <motion.div
      key="page-versions"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="px-6 pt-3.5 pb-2 space-y-3.5"
    >
      {/* Header Row: Vanilla <-> WinVisual Shader Comparison Title + Night | Sunset | Fog Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-[20px] sm:text-[21px] font-extrabold tracking-tight uppercase text-[#FFFFFF]">
            {isRu ? 'СРАВНЕНИЕ ГРАФИКИ: VANILLA' : 'SHADER COMPARISON: VANILLA'}
          </h1>
          <span className="inline-flex items-center text-[var(--accent-secondary)]">
            <MoveHorizontal size={18} strokeWidth={2.3} />
          </span>
          <span className="text-[20px] sm:text-[21px] font-extrabold tracking-tight uppercase text-[var(--accent-primary)] drop-shadow-[0_0_16px_var(--accent-glow)]">
            WINVISUAL
          </span>
        </div>

        {/* Atmosphere Switcher: Ночь | Закат | Туман */}
        <div className="inline-flex items-center rounded-full bg-[#0C0E17] border border-white/[0.1] p-1 self-start sm:self-auto">
          {(['night', 'sunset', 'fog'] as const).map((key) => {
            const active = atmosphere === key;
            const meta = ATMOSPHERE_OVERLAYS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAtmosphere(key)}
                className={cn(
                  'px-4 py-1 rounded-full text-[12px] font-semibold transition-all cursor-pointer',
                  active
                    ? 'bg-[#191636] text-white border border-[var(--accent-primary)]/75 shadow-[0_0_16px_rgba(139,124,255,0.45)]'
                    : 'text-[#9D9FB0] hover:text-white border border-transparent'
                )}
              >
                {isRu ? meta.labelRu : meta.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upper Interactive Split-Screen Viewport: VANILLA vs WINVISUAL */}
      <div
        ref={compareRef}
        onPointerDown={handlePointerDown}
        className="relative h-[242px] w-full rounded-[20px] overflow-hidden border border-white/[0.1] shadow-[0_24px_60px_-18px_rgba(0,0,0,0.9)] cursor-ew-resize select-none"
      >
        {/* Full Layer (Right Side): Rich WinVisual GLSL Bloom + Atmosphere Grading */}
        <div
          className="absolute inset-0 bg-cover bg-center saturate-[1.32] contrast-[1.08]"
          style={{ backgroundImage: "url('/images/hero-castle-violet.jpg')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-all duration-300"
          style={{ background: atm.tintGradient }}
        />

        {/* WinVisual Neon Ground Aura Ring + Radar HUD Overlay on Right Side */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-14 bottom-5 w-[150px] h-[34px] rounded-full border-2 border-[#C4B5FD] shadow-[0_0_24px_#8B7CFF,inset_0_0_16px_#8B7CFF]"
        />

        <div className="pointer-events-none absolute top-3.5 right-4 z-10 px-3.5 py-1 rounded-full bg-[#191538]/90 border border-[var(--accent-primary)]/70 text-[11px] font-bold tracking-[0.06em] uppercase text-white shadow-[0_0_18px_rgba(139,124,255,0.5)]">
          WINVISUAL
        </div>

        <div className="pointer-events-none hidden sm:flex items-center gap-3 absolute top-14 right-4 z-10 px-3.5 py-2.5 rounded-[14px] bg-[#0B0D18]/80 backdrop-blur-md border border-white/[0.1]">
          <div className="relative w-12 h-12 rounded-full border border-[var(--accent-secondary)]/70 flex items-center justify-center shadow-[0_0_14px_rgba(139,124,255,0.35)]">
            <div className="w-7 h-7 rounded-full border border-[var(--accent-secondary)]/45" />
            <div className="absolute inset-x-0 h-[1px] bg-[var(--accent-secondary)]/55" />
            <div className="absolute inset-y-0 w-[1px] bg-[var(--accent-secondary)]/55" />
          </div>
          <div className="font-mono text-[10.5px] leading-relaxed text-[#D4D6E4]">
            <p>{atm.coords}</p>
            <p className="text-[#9D9FB0]">{atm.biome}</p>
          </div>
        </div>

        {/* Clipped Left Layer: Flat Dark Unshaded Vanilla Scene */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center grayscale-[0.88] brightness-[0.44] contrast-[0.88]"
            style={{ backgroundImage: "url('/images/hero-castle-violet.jpg')" }}
          />
          <div className="absolute inset-0 bg-[#0A0C12]/35" />
          <div className="absolute top-3.5 left-4 px-3.5 py-1 rounded-full bg-[#090B11]/90 border border-white/[0.12] text-[11px] font-bold tracking-[0.06em] uppercase text-[#D4D4DC]">
            VANILLA
          </div>
        </div>

        {/* Glowing Vertical Neon-Violet Divider Line + Interactive Handle */}
        <div
          style={{ left: `${splitPct}%` }}
          className="pointer-events-none absolute inset-y-0 z-20 -translate-x-1/2 flex items-center justify-center"
        >
          <div className="h-full w-[2.5px] bg-[#C4B5FD] shadow-[0_0_18px_#8B7CFF,0_0_6px_#FFFFFF]" />
          <div className="absolute w-9 h-14 rounded-full bg-[#171336]/95 border-2 border-[#D8D0FF] shadow-[0_0_26px_#8B7CFF] flex items-center justify-center text-white">
            <MoveHorizontal size={15} strokeWidth={2.4} />
          </div>
        </div>
      </div>

      {/* Lower Row: 3 Collector Fabric Build Cards (`Fabric 1.21.11`, `Fabric 1.21.4`, `Fabric 1.16.5`) */}
      {versionsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[212px] w-full rounded-[18px]" />
          <Skeleton className="h-[212px] w-full rounded-[18px]" />
          <Skeleton className="h-[212px] w-full rounded-[18px]" />
        </div>
      ) : versionsError ? (
        <Card className="p-8 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400">
            <AlertCircle size={20} strokeWidth={1.75} />
          </div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {isRu ? 'Не удалось загрузить каталог версий' : 'Failed to load version catalog'}
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)]">{versionsError}</p>
          <div className="pt-1">
            <Button variant="secondary" onClick={() => loadInitialData()}>
              <RefreshCw size={15} strokeWidth={1.75} />
              {isRu ? 'Повторить запрос' : 'Retry'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {versions.map((ver) => {
            const isSelected = ver.id === selectedVersionId;
            const javaTag = ver.minecraftVersion === '1.16.5' ? 'Java 8' : 'Java 21';
            const artUrl = VERSION_ARTWORK[ver.minecraftVersion] ?? '/images/hero-castle-violet.jpg';

            return (
              <Card
                key={ver.id}
                interactive
                selected={isSelected}
                onClick={() => selectVersion(ver.id)}
                className={cn(
                  'h-[212px] p-0 flex flex-col justify-between cursor-pointer rounded-[18px]',
                  isSelected &&
                    'border-[1.5px] border-[#B4A5FF] shadow-[0_0_32px_rgba(139,124,255,0.5),inset_0_0_20px_rgba(139,124,255,0.16)]'
                )}
              >
                {/* Unique Collector Shader Artwork */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover/card:scale-105"
                  style={{ backgroundImage: `url('${artUrl}')` }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(10, 11, 20, 0.92) 0%, rgba(10, 11, 20, 0.30) 48%, rgba(8, 9, 16, 0.88) 100%)',
                  }}
                />

                {/* Top Card Header: 3D Block Icon + Build Name + Java/FPS Telemetry */}
                <div className="relative z-10 px-4 pt-4 flex items-center gap-3">
                  <MinecraftBlockIcon size={36} className="shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-[16.5px] font-bold tracking-tight text-[#FFFFFF] truncate">
                      {ver.name}
                    </h2>
                    <p className="text-[11.5px] font-mono text-[#B0B2C2] truncate">
                      {javaTag} • {ver.fpsBoost}
                    </p>
                  </div>
                </div>

                {/* Bottom Action Pill: ВЫБРАНА ✓ vs ВЫБРАТЬ */}
                <div className="relative z-10 p-3.5 flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectVersion(ver.id);
                    }}
                    className={cn(
                      'h-[38px] w-full max-w-[205px] rounded-[11px] inline-flex items-center justify-center gap-2 text-[12px] font-bold tracking-[0.06em] uppercase transition-all cursor-pointer',
                      isSelected
                        ? 'bg-[#251E4D]/95 text-white border border-[#C4B5FD]/85 shadow-[0_0_22px_rgba(139,124,255,0.55)]'
                        : 'bg-[#090B13]/85 hover:bg-[#151829]/95 text-[#E4E4EC] border border-white/[0.14] hover:border-[rgba(var(--accent-rgb),0.55)]'
                    )}
                  >
                    {isSelected ? (
                      <>
                        <span>{isRu ? 'ВЫБРАНА' : 'SELECTED'}</span>
                        <Check size={14} strokeWidth={2.4} className="text-[#C4B5FD]" />
                      </>
                    ) : (
                      <span>{isRu ? 'ВЫБРАТЬ' : 'SELECT'}</span>
                    )}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
