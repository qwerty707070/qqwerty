import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Calendar, Check, Cpu, Layers, Play, RefreshCw } from 'lucide-react';
import type { VersionChannel } from '../types/launcher';
import { useLauncherStore } from '../stores/launcherStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Skeleton } from '../components/ui/Skeleton';

export const VersionsPage: React.FC = () => {
  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const versionChannelFilter = useLauncherStore((s) => s.versionChannelFilter);
  const versionsLoading = useLauncherStore((s) => s.versionsLoading);
  const versionsError = useLauncherStore((s) => s.versionsError);
  const setVersionFilter = useLauncherStore((s) => s.setVersionFilter);
  const selectVersion = useLauncherStore((s) => s.selectVersion);
  const startLaunchSequence = useLauncherStore((s) => s.startLaunchSequence);
  const language = useSettingsStore((s) => s.language);

  const isRu = language === 'ru';

  const filterOptions: { value: VersionChannel; label: string }[] = [
    { value: 'all', label: isRu ? 'Все версии' : 'All Versions' },
    { value: 'stable', label: 'Stable' },
    { value: 'beta', label: 'Beta' },
  ];

  return (
    <motion.div
      key="page-versions"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="p-7 space-y-6 max-w-[1040px]"
    >
      {/* Header & Channel Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
            {isRu ? 'Версии клиента' : 'Client Versions'}
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
            {isRu
              ? 'Выберите оптимизированную сборку WinVisual с подписанными библиотеками Fabric.'
              : 'Select an optimized WinVisual build with signed Fabric runtime dependencies.'}
          </p>
        </div>

        <SegmentedControl
          options={filterOptions}
          value={versionChannelFilter}
          onChange={(ch) => setVersionFilter(ch)}
          layoutGroupId="versions-channel-pill"
        />
      </div>

      {/* Loading State */}
      {versionsLoading ? (
        <div className="grid grid-cols-1 gap-4">
          <Skeleton className="h-[146px] w-full rounded-[16px]" />
          <Skeleton className="h-[146px] w-full rounded-[16px]" />
          <Skeleton className="h-[146px] w-full rounded-[16px]" />
        </div>
      ) : versionsError ? (
        /* Error State */
        <Card className="p-8 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400">
            <AlertCircle size={20} strokeWidth={1.75} />
          </div>
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {isRu ? 'Не удалось загрузить каталог версий' : 'Failed to load version catalog'}
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)]">{versionsError}</p>
          <div className="pt-1">
            <Button variant="secondary" onClick={() => setVersionFilter(versionChannelFilter)}>
              <RefreshCw size={15} strokeWidth={1.75} />
              {isRu ? 'Повторить запрос' : 'Retry'}
            </Button>
          </div>
        </Card>
      ) : versions.length === 0 ? (
        /* Empty State */
        <Card className="p-8 text-center space-y-2">
          <p className="text-[15px] font-medium text-[var(--text-primary)]">
            {isRu ? 'В выбранном канале пока нет сборок' : 'No builds available in this channel'}
          </p>
        </Card>
      ) : (
        /* Version Cards */
        <div className="grid grid-cols-1 gap-4">
          {versions.map((ver) => {
            const isSelected = ver.id === selectedVersionId;
            const highlights = isRu ? ver.highlightsRu : ver.highlightsEn;
            return (
              <Card
                key={ver.id}
                interactive
                selected={isSelected}
                onClick={() => selectVersion(ver.id)}
                className="p-5 cursor-pointer"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
                        {ver.name}
                      </h2>

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-white/[0.06] border border-white/[0.08] text-[var(--text-primary)]">
                        Minecraft {ver.minecraftVersion}
                      </span>

                      <span
                        className={
                          ver.channel === 'stable'
                            ? 'px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                            : 'px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25'
                        }
                      >
                        {ver.recommended
                          ? isRu
                            ? 'Рекомендуемый релиз'
                            : 'Latest Release'
                          : ver.channel === 'stable'
                            ? 'Stable'
                            : 'Beta Preview'}
                      </span>

                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
                        <Calendar size={13} strokeWidth={1.75} />
                        {ver.updatedAt}
                      </span>
                    </div>

                    <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed max-w-[720px]">
                      {isRu ? ver.summaryRu : ver.summaryEn}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-white/[0.03] border border-white/[0.05] text-[11.5px] text-[var(--text-secondary)]">
                        <Layers size={13} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
                        {ver.loader}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-white/[0.03] border border-white/[0.05] text-[11.5px] text-[var(--text-secondary)]">
                        <Cpu size={13} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
                        {ver.fpsBoost}
                      </span>
                      {highlights.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-[8px] bg-white/[0.025] text-[11.5px] text-[var(--text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Selection & Launch Controls */}
                  <div
                    className="flex items-center gap-2.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isSelected ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12.5px] font-medium text-[var(--accent-secondary)] bg-[var(--accent-subtle)] border border-[var(--accent-primary)]/30">
                          <Check size={15} strokeWidth={2} />
                          {isRu ? 'Выбрана' : 'Selected'}
                        </span>
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => startLaunchSequence()}
                        >
                          <Play size={14} strokeWidth={2.2} fill="currentColor" />
                          {isRu ? 'Играть' : 'Launch'}
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" size="md" onClick={() => selectVersion(ver.id)}>
                        {isRu ? 'Выбрать сборку' : 'Select Build'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
