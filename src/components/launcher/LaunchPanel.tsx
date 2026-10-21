import React from 'react';
import { Cpu } from 'lucide-react';
import { VersionSelector } from './VersionSelector';
import { LaunchButton } from './LaunchButton';
import { MinecraftAvatar } from '../ui/MinecraftAvatar';
import { useLauncherStore } from '../../stores/launcherStore';
import { useAccountStore } from '../../stores/accountStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { t } from '../../utils/i18n';
import { cn } from '../../utils/cn';

export const LaunchPanel: React.FC = () => {
  const launchPhase = useLauncherStore((s) => s.launchPhase);
  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const setDownloadDrawerOpen = useLauncherStore((s) => s.setDownloadDrawerOpen);
  const { accounts, activeAccountId } = useAccountStore();
  const { language, ramAllocationMb } = useSettingsStore();

  const copy = t(language);
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];

  const statusColor =
    launchPhase === 'error'
      ? 'bg-rose-400'
      : launchPhase === 'running'
        ? 'bg-emerald-400'
        : launchPhase === 'idle'
          ? 'bg-emerald-400'
          : 'bg-[var(--accent-secondary)]';

  return (
    <section
      aria-label="Launch control panel"
      className={cn(
        'w-full rounded-[20px] p-3 glass-panel',
        'flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3'
      )}
    >
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
        {/* Column 1: Version Selector */}
        <VersionSelector />

        {/* Column 2: Active Account */}
        <button
          type="button"
          onClick={() => setCurrentPage('account')}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] hover:bg-white/[0.04] transition-colors text-left cursor-pointer md:border-l md:border-[var(--border-primary)] md:rounded-l-none"
        >
          <MinecraftAvatar
            preset={activeAccount.skinPreset}
            size={36}
            online={activeAccount.online}
            showStatusDot
          />
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {copy.launchPanel.accountLabel}
            </p>
            <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate mt-0.5">
              {activeAccount.username}
            </p>
          </div>
        </button>

        {/* Column 3: Engine Readiness Status */}
        <button
          type="button"
          onClick={() => setDownloadDrawerOpen(true)}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] hover:bg-white/[0.04] transition-colors text-left cursor-pointer md:border-l md:border-[var(--border-primary)] md:rounded-l-none"
        >
          <div className="h-9 w-9 rounded-[10px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 text-[var(--text-secondary)]">
            <Cpu size={17} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {copy.launchPanel.statusLabel}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('w-2 h-2 rounded-full shrink-0', statusColor)} />
              <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                {copy.phases[launchPhase]}
              </span>
              <span className="hidden sm:inline text-[11px] font-mono text-[var(--text-muted)]">
                • {(ramAllocationMb / 1024).toFixed(1)}G
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Primary Launch Button */}
      <div className="flex justify-end xl:pl-2">
        <LaunchButton />
      </div>
    </section>
  );
};
