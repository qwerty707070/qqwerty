import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Cloud,
  Cpu,
  Play,
  Sparkles,
} from 'lucide-react';
import { AmbientGlow } from '../components/effects/AmbientGlow';
import { Card } from '../components/ui/Card';
import { Character3DViewer } from '../components/ui/Character3DViewer';
import { TelemetrySparkline } from '../components/ui/TelemetrySparkline';
import { useLauncherStore } from '../stores/launcherStore';
import { useAccountStore } from '../stores/accountStore';
import { useVisualClientStore, type ShaderCapeId } from '../stores/visualClientStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNotificationStore } from '../stores/notificationStore';

const VISUAL_PROFILES: {
  id: 'cinematic' | 'competitive' | 'pure-fps';
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
}[] = [
  {
    id: 'cinematic',
    nameRu: 'Obsidian Atmospheric',
    nameEn: 'Obsidian Atmospheric',
    descRu: 'Реалистичная атмосфера и динамическое освещение',
    descEn: 'Realistic atmosphere & dynamic GLSL lighting',
  },
  {
    id: 'competitive',
    nameRu: 'Pulse Competitive',
    nameEn: 'Pulse Competitive',
    descRu: 'Target HUD 2.0, чёткие контуры и 0% задержки кадра',
    descEn: 'Target HUD 2.0, crisp silhouettes & zero frame lag',
  },
  {
    id: 'pure-fps',
    nameRu: 'Feather Ultra FPS',
    nameEn: 'Feather Ultra FPS',
    descRu: 'Пакетный рендер чанков и максимальная герцовка',
    descEn: 'Async chunk batching & peak refresh stability',
  },
];

const HERO_CAPES: { id: ShaderCapeId; label: string }[] = [
  { id: 'nebula', label: 'Nebula Starlight' },
  { id: 'pulse', label: 'Pulse Crimson' },
  { id: 'aurora', label: 'Aurora Borealis' },
  { id: 'obsidian', label: 'Obsidian Monarch' },
];

export const HomePage: React.FC = () => {
  const [presetIdx, setPresetIdx] = useState(0);

  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const telemetry = useLauncherStore((s) => s.telemetry);
  const { accounts, activeAccountId } = useAccountStore();
  const { equippedCape, setEquippedCape, applyPresetProfile, modules } = useVisualClientStore();
  const { language, ramAllocationMb, notificationsEnabled } = useSettingsStore();
  const pushToast = useNotificationStore((s) => s.pushToast);

  const isRu = language === 'ru';
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  const haloEnabled = modules.some((m) => m.id === 'china-hat' && m.enabled);
  const activePreset = VISUAL_PROFILES[presetIdx];

  const currentCapeIndex = Math.max(
    0,
    HERO_CAPES.findIndex((c) => c.id === equippedCape)
  );
  const activeCapeMeta = HERO_CAPES[currentCapeIndex] ?? HERO_CAPES[0];

  const stepCape = (delta: number) => {
    const nextIdx = (currentCapeIndex + delta + HERO_CAPES.length) % HERO_CAPES.length;
    const chosen = HERO_CAPES[nextIdx];
    setEquippedCape(chosen.id);
    if (notificationsEnabled) {
      pushToast({
        type: 'info',
        title: isRu ? `Плащ: ${chosen.label}` : `Cape: ${chosen.label}`,
      });
    }
  };

  const cycleVisualProfile = () => {
    const next = (presetIdx + 1) % VISUAL_PROFILES.length;
    setPresetIdx(next);
    const chosen = VISUAL_PROFILES[next];
    applyPresetProfile(chosen.id);
    if (notificationsEnabled) {
      pushToast({
        type: 'info',
        title: isRu
          ? `Визуальный пресет: ${chosen.nameRu}`
          : `Visual Preset: ${chosen.nameEn}`,
        description: isRu ? chosen.descRu : chosen.descEn,
      });
    }
  };

  return (
    <motion.div
      key="page-home"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="h-full px-5 pt-3.5 pb-1.5 flex flex-col gap-3"
    >
      {/* Atmospheric Hero Stage with Live 3D Pixel Skin + Starry 144Hz Shader Cape */}
      <section className="relative isolate z-0 flex-1 min-h-[304px] rounded-[22px] overflow-hidden border border-white/[0.085] shadow-[0_26px_70px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.1)] flex items-stretch justify-between px-9 py-6">
        {/* Violet Castle & Floating Islands Shader Scene */}
        <div
          aria-hidden="true"
          className="ambient-hero-media absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero-castle-violet.jpg')" }}
        />

        {/* Smooth Left Editorial Vignette Preserving Right Castle + Moon + Ledge */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(92deg, rgba(6, 7, 12, 0.94) 0%, rgba(6, 7, 12, 0.78) 38%, rgba(8, 9, 16, 0.16) 68%, rgba(8, 9, 16, 0.28) 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(6, 7, 12, 0.2) 0%, rgba(6, 7, 12, 0) 55%, rgba(6, 7, 12, 0.72) 100%)',
          }}
        />
        <AmbientGlow className="absolute -bottom-24 -left-16" />

        {/* Left Column: Display Headline + Subtitle + Dual CTA Buttons */}
        <div className="relative z-10 max-w-[490px] flex flex-col justify-center space-y-4 py-1">
          <h1 className="text-[38px] xl:text-[44px] font-extrabold tracking-[-0.03em] leading-[1.05] uppercase">
            <span className="block text-[#FFFFFF]">
              {isRu ? 'НОВЫЙ ВЗГЛЯД' : 'REIMAGINE YOUR'}
            </span>
            <span className="block bg-gradient-to-r from-[#8B7CFF] via-[#A99CFF] to-[#C8BEFF] bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(139,124,255,0.35)]">
              {isRu ? 'НА MINECRAFT' : 'MINECRAFT'}
            </span>
          </h1>

          <p className="text-[14px] text-[#C2C4D0] leading-[1.58] max-w-[400px]">
            {isRu
              ? 'Погрузись в совершенно новую атмосферу игры с лучшей графикой, плавностью и максимальным комфортом.'
              : 'Immerse yourself in a next-generation visual client with atmospheric GLSL shaders, silky frame pacing, and effortless HUD control.'}
          </p>

          <div className="flex items-center gap-3.5 pt-1 flex-wrap">
            <button
              type="button"
              onClick={() => setCurrentPage('news')}
              className="h-[44px] px-6 rounded-[12px] inline-flex items-center gap-2.5 text-[12.5px] font-bold tracking-[0.05em] uppercase text-white bg-[linear-gradient(135deg,#6E54FF_0%,#8B7CFF_100%)] border border-[#CFC7FF]/60 shadow-[0_0_26px_rgba(124,99,255,0.6),inset_0_1px_0_rgba(255,255,255,0.45)] hover:brightness-110 transition-all cursor-pointer"
            >
              <Play size={13} fill="currentColor" strokeWidth={2.2} />
              <span>{isRu ? 'УЗНАТЬ БОЛЬШЕ' : 'LEARN MORE'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage('modules')}
              className="h-[44px] px-6 rounded-[12px] inline-flex items-center gap-2 text-[12.5px] font-bold tracking-[0.05em] uppercase text-[#E4E4EC] bg-[#0B0D16]/75 hover:bg-[#141728]/90 backdrop-blur-md border border-white/[0.15] hover:border-[rgba(var(--accent-rgb),0.5)] transition-all cursor-pointer"
            >
              <span>{isRu ? 'НАШИ МОДУЛИ' : 'OUR MODULES'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Interactive 3D Full-Body Character + 144Hz Starry Cape + Switcher */}
        <div className="hidden md:flex relative z-10 w-[330px] lg:w-[366px] flex-col items-center justify-end -my-4">
          <div className="w-full h-[272px]">
            <Character3DViewer
              heroStage
              skinPreset={activeAccount.skinPreset}
              skinModel={activeAccount.skinModel}
              customSkinDataUrl={activeAccount.customSkinDataUrl}
              cape={equippedCape}
              showHalo={haloEnabled}
            />
          </div>

          <div className="relative z-20 mb-2 inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#090B13]/80 backdrop-blur-md border border-white/[0.12] text-[12.5px] font-medium text-[#F5F5F7] shadow-[0_8px_24px_rgba(0,0,0,0.75)]">
            <button
              type="button"
              onClick={() => stepCape(-1)}
              aria-label="Previous shader cape"
              className="p-0.5 text-[#9D9FB0] hover:text-white transition-colors cursor-pointer inline-flex items-center"
            >
              <ChevronsLeft size={14} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              onClick={() => stepCape(-1)}
              aria-label="Step cape left"
              className="p-0.5 text-[#C4B5FD] hover:text-white transition-colors cursor-pointer inline-flex items-center"
            >
              <ChevronLeft size={14} strokeWidth={2} />
            </button>

            <span className="px-1.5 font-semibold tracking-tight min-w-[116px] text-center">
              {activeCapeMeta.label}
            </span>

            <button
              type="button"
              onClick={() => stepCape(1)}
              aria-label="Step cape right"
              className="p-0.5 text-[#C4B5FD] hover:text-white transition-colors cursor-pointer inline-flex items-center"
            >
              <ChevronRight size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => stepCape(1)}
              aria-label="Next shader cape"
              className="p-0.5 text-[#9D9FB0] hover:text-white transition-colors cursor-pointer inline-flex items-center"
            >
              <ChevronsRight size={14} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </section>

      {/* Bottom 3 Illustrated Shader & Telemetry Cards matching the WinVisual Concept */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3.5 shrink-0">
        {/* Card 1: Evo Atmospheric with Purple Clouds Shader Backdrop */}
        <Card
          interactive
          onClick={cycleVisualProfile}
          className="h-[138px] p-0 cursor-pointer"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-cover bg-bottom opacity-90"
            style={{ backgroundImage: "url('/images/card-atmospheric.jpg')" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(10, 12, 20, 0.92) 0%, rgba(10, 12, 20, 0.62) 56%, rgba(10, 12, 20, 0.14) 100%)',
            }}
          />

          <div className="relative z-10 p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 h-9 w-9 rounded-[11px] bg-[rgba(var(--accent-rgb),0.14)] border border-[rgba(var(--accent-rgb),0.32)] flex items-center justify-center text-[#C4B5FD] shadow-[0_0_18px_rgba(139,124,255,0.35)] shrink-0">
                <Cloud size={19} strokeWidth={1.85} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#FFFFFF] truncate">
                  {isRu ? activePreset.nameRu : activePreset.nameEn}
                </p>
                <p className="text-[11.5px] text-[#B4B6C6] leading-snug line-clamp-2 mt-0.5">
                  {isRu ? activePreset.descRu : activePreset.descEn}
                </p>
              </div>
            </div>
            <ChevronRight size={16} strokeWidth={1.85} className="text-[#9D9FB0] shrink-0 mt-1" />
          </div>
        </Card>

        {/* Card 2: Starlight 144Hz with Moonlit Lake Reflection Backdrop */}
        <Card
          interactive
          onClick={() => setCurrentPage('account')}
          className="h-[138px] p-0 cursor-pointer"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-90"
            style={{ backgroundImage: "url('/images/card-starlight.jpg')" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(10, 12, 20, 0.92) 0%, rgba(10, 12, 20, 0.6) 56%, rgba(10, 12, 20, 0.16) 100%)',
            }}
          />

          <div className="relative z-10 p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 h-9 w-9 rounded-[11px] bg-[rgba(var(--accent-rgb),0.14)] border border-[rgba(var(--accent-rgb),0.32)] flex items-center justify-center text-[#C4B5FD] shadow-[0_0_18px_rgba(139,124,255,0.35)] shrink-0">
                <Sparkles size={19} strokeWidth={1.85} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#FFFFFF] truncate">
                  Starlight 144Hz
                </p>
                <p className="text-[11.5px] text-[#B4B6C6] leading-snug line-clamp-2 mt-0.5">
                  {isRu
                    ? 'Плавная графика, максимум FPS и реалистичные шейдеры'
                    : 'Silky 144Hz frame pacing, peak FPS & realistic shaders'}
                </p>
              </div>
            </div>
            <ChevronRight size={16} strokeWidth={1.85} className="text-[#9D9FB0] shrink-0 mt-1" />
          </div>
        </Card>

        {/* Card 3: Runtime & G1GC Telemetry with Live Glowing Neon Waveform */}
        <Card
          interactive
          onClick={() => setCurrentPage('settings')}
          className="h-[138px] p-0 flex flex-col justify-between cursor-pointer bg-[#0B0D16]/95"
        >
          <div className="relative z-10 p-4 pb-0 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 h-9 w-9 rounded-[11px] bg-[rgba(var(--accent-rgb),0.14)] border border-[rgba(var(--accent-rgb),0.32)] flex items-center justify-center text-[#C4B5FD] shadow-[0_0_18px_rgba(139,124,255,0.35)] shrink-0">
                <Cpu size={19} strokeWidth={1.85} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#FFFFFF] truncate font-mono tracking-tight">
                  {(ramAllocationMb / 1024).toFixed(1)} GB G1GC •{' '}
                  {telemetry ? `${telemetry.latencyMs}ms` : '9ms'}
                </p>
                <p className="text-[11.5px] text-[#B4B6C6] leading-snug line-clamp-2 mt-0.5">
                  {isRu
                    ? 'Оптимизация под большие миры и высокую стабильность'
                    : 'Tuned for large worlds & zero-jitter stability'}
                </p>
              </div>
            </div>
            <ChevronRight size={16} strokeWidth={1.85} className="text-[#9D9FB0] shrink-0 mt-1" />
          </div>

          <TelemetrySparkline variant="card" />
        </Card>
      </div>
    </motion.div>
  );
};
