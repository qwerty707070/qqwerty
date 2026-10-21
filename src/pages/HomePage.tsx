import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Cloud,
  Layers,
  Sliders,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { LaunchPanel } from '../components/launcher/LaunchPanel';
import { AmbientGlow } from '../components/effects/AmbientGlow';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useLauncherStore } from '../stores/launcherStore';
import { useVisualClientStore } from '../stores/visualClientStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { t } from '../utils/i18n';

const VISUAL_PROFILES: {
  id: 'cinematic' | 'competitive' | 'pure-fps';
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
}[] = [
  {
    id: 'cinematic',
    nameRu: 'Evo Atmospheric',
    nameEn: 'Evo Atmospheric',
    descRu: 'GLSL Bloom • 144Hz Cape • Full HUD',
    descEn: 'GLSL Bloom • 144Hz Cape • Full HUD',
  },
  {
    id: 'competitive',
    nameRu: 'Pulse Competitive',
    nameEn: 'Pulse Competitive',
    descRu: 'Target HUD 2.0 • Hit Sparks • Low Fire',
    descEn: 'Target HUD 2.0 • Hit Sparks • Low Fire',
  },
  {
    id: 'pure-fps',
    nameRu: 'Feather Ultra FPS',
    nameEn: 'Feather Ultra FPS',
    descRu: 'Async Meshing • Essential HUD • Max Hz',
    descEn: 'Async Meshing • Essential HUD • Max Hz',
  },
];

export const HomePage: React.FC = () => {
  const [presetIdx, setPresetIdx] = useState(0);

  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const news = useLauncherStore((s) => s.news);
  const telemetry = useLauncherStore((s) => s.telemetry);
  const { equippedCape, applyPresetProfile } = useVisualClientStore();
  const { language, ramAllocationMb, notificationsEnabled } = useSettingsStore();
  const pushToast = useNotificationStore((s) => s.pushToast);

  const copy = t(language);
  const isRu = language === 'ru';
  const activeBuild = versions.find((v) => v.id === selectedVersionId) ?? versions[0];
  const latestNews = news[0];
  const activePreset = VISUAL_PROFILES[presetIdx];

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
      className="h-full min-h-[630px] p-6 flex flex-col gap-4"
    >
      {/* Atmospheric Hero Stage */}
      <section className="relative isolate z-0 flex-1 min-h-[356px] rounded-[24px] overflow-hidden border border-white/[0.085] shadow-[0_26px_70px_-18px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col justify-between p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-12 top-0 h-[1px] z-20 bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />

        <div
          aria-hidden="true"
          className="ambient-hero-media absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(96deg, rgba(8, 9, 13, 0.95) 0%, rgba(8, 9, 13, 0.78) 43%, rgba(8, 9, 13, 0.24) 76%, rgba(8, 9, 13, 0.42) 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(8, 9, 13, 0.24) 0%, rgba(8, 9, 13, 0) 44%, rgba(8, 9, 13, 0.88) 100%)',
          }}
        />
        <AmbientGlow className="absolute -bottom-24 -left-16" />
        <div aria-hidden="true" className="absolute inset-0 noise-overlay opacity-60" />

        {/* Top Row Badge & Active Build Pill */}
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/[0.09]">
            <Sparkles size={13} strokeWidth={2} className="text-[var(--accent-secondary)]" />
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--text-primary)]">
              {copy.hero.badge}
            </span>
          </div>

          {activeBuild && (
            <button
              type="button"
              onClick={() => setCurrentPage('versions')}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/[0.09] hover:border-white/[0.16] transition-colors text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
              <span className="font-mono">
                {activeBuild.name} • {activeBuild.fpsBoost}
              </span>
              <ArrowUpRight size={13} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Main Hero Editorial Block */}
        <div className="relative z-10 max-w-[540px] space-y-5 my-auto pt-3">
          <h1 className="text-[40px] sm:text-[46px] font-bold tracking-[-0.035em] leading-[1.04]">
            <span className="block text-[#F5F5F7]">{copy.hero.line1}</span>
            <span className="block bg-gradient-to-r from-[#FFFFFF] via-[#DFDAFF] to-[var(--accent-secondary)] bg-clip-text text-transparent">
              {copy.hero.line2}
            </span>
          </h1>

          <p className="text-[14px] text-[#B4B4BE] leading-[1.6] max-w-[470px]">
            {copy.hero.subtitle}
          </p>

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <Button variant="secondary" size="md" onClick={() => setCurrentPage('modules')}>
              {copy.hero.changelogBtn}
              <ArrowUpRight size={15} strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" size="md" onClick={() => setCurrentPage('settings')}>
              <Sliders size={15} strokeWidth={1.75} />
              {isRu ? 'Настройки графики и ОЗУ' : 'Engine & RAM Settings'}
            </Button>
          </div>
        </div>

        {/* Bottom Feature Micro-Telemetry Row */}
        <div className="relative z-10 flex items-center justify-between gap-4 pt-3 border-t border-white/[0.08] flex-wrap">
          <div className="flex items-center gap-5 flex-wrap text-[12px] text-[#C4C4CE]">
            <span className="inline-flex items-center gap-2">
              <Layers size={14} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
              {copy.hero.statModules}
            </span>
            <span className="inline-flex items-center gap-2">
              <Zap size={14} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
              {copy.hero.statEngine}
            </span>
            <span className="inline-flex items-center gap-2">
              <Cloud size={14} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
              {copy.hero.statSync}
            </span>
          </div>

          {latestNews && (
            <button
              type="button"
              onClick={() => setCurrentPage('news')}
              className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-secondary)] text-[10px] font-semibold uppercase">
                {isRu ? 'Новость' : 'Update'}
              </span>
              <span className="truncate max-w-[260px]">
                {isRu ? latestNews.titleRu : latestNews.titleEn}
              </span>
            </button>
          )}
        </div>
      </section>

      {/* Interactive Visual Client Telemetry & Loadout Strip */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card interactive onClick={cycleVisualProfile} className="px-4 py-3 cursor-pointer">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-secondary)] flex items-center gap-1.5">
                <Wand2 size={12.5} strokeWidth={1.75} />
                {isRu ? 'Визуальный профиль HUD' : 'Active Visual Preset'}
              </p>
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate mt-0.5">
                {isRu ? activePreset.nameRu : activePreset.nameEn}
              </p>
              <p className="text-[11.5px] text-[var(--text-muted)] truncate">
                {isRu ? activePreset.descRu : activePreset.descEn}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-[6px] bg-white/[0.04] border border-white/[0.06] text-[10.5px] font-mono text-[var(--text-secondary)] shrink-0">
              {presetIdx + 1}/3
            </span>
          </div>
        </Card>

        <Card
          interactive
          onClick={() => setCurrentPage('account')}
          className="px-4 py-3 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] flex items-center gap-1.5">
                <Sparkles size={12.5} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
                {isRu ? 'Экипированный 3D-плащ' : 'Equipped 3D Cape'}
              </p>
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)] capitalize truncate mt-0.5">
                {equippedCape} Starlight 144Hz
              </p>
              <p className="text-[11.5px] text-[var(--text-muted)] truncate">
                {isRu ? 'Открыть 3D-просмотр скина и плащей' : 'Inspect 3D skin & cloth physics'}
              </p>
            </div>
            <ArrowUpRight size={16} strokeWidth={1.75} className="text-[var(--text-muted)] shrink-0" />
          </div>
        </Card>

        <Card
          interactive
          onClick={() => setCurrentPage('settings')}
          className="px-4 py-3 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] flex items-center gap-1.5">
                <Activity size={12.5} strokeWidth={1.75} className="text-emerald-400" />
                {isRu ? 'Ресурсы и сеть' : 'Runtime & Edge Telemetry'}
              </p>
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate mt-0.5 font-mono">
                {(ramAllocationMb / 1024).toFixed(1)} GB G1GC • {telemetry ? `${telemetry.latencyMs}ms` : '—'}
              </p>
              <p className="text-[11.5px] text-[var(--text-muted)] truncate">
                {isRu ? '100% Fair-Play клиентский рендер' : '100% Fair-Play client pipeline'}
              </p>
            </div>
            <ArrowUpRight size={16} strokeWidth={1.75} className="text-[var(--text-muted)] shrink-0" />
          </div>
        </Card>
      </div>

      {/* Primary Launch Dock */}
      <LaunchPanel />
    </motion.div>
  );
};
