import React from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  ExternalLink,
  Home,
  Layers,
  MessageSquare,
  Newspaper,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { PageRoute } from '../../types/launcher';
import { useLauncherStore } from '../../stores/launcherStore';
import { useAccountStore } from '../../stores/accountStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { MinecraftAvatar } from '../ui/MinecraftAvatar';
import { t } from '../../utils/i18n';
import { cn } from '../../utils/cn';

export const Sidebar: React.FC = () => {
  const currentPage = useLauncherStore((s) => s.currentPage);
  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const telemetry = useLauncherStore((s) => s.telemetry);
  const { accounts, activeAccountId } = useAccountStore();
  const language = useSettingsStore((s) => s.language);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const copy = t(language);
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];

  const navItems: { id: PageRoute; label: string; Icon: typeof Home }[] = [
    { id: 'home', label: copy.nav.home, Icon: Home },
    { id: 'modules', label: copy.nav.modules, Icon: Sparkles },
    { id: 'news', label: copy.nav.news, Icon: Newspaper },
    { id: 'versions', label: copy.nav.versions, Icon: Layers },
    { id: 'settings', label: copy.nav.settings, Icon: SlidersHorizontal },
    { id: 'account', label: copy.nav.account, Icon: UserRound },
  ];

  const handleDiscordClick = () => {
    navigator.clipboard?.writeText('https://discord.gg/winvisual').catch(() => {});
    pushToast({
      type: 'info',
      title: language === 'ru' ? 'Приглашение Discord скопировано' : 'Discord invite copied',
      description: 'discord.gg/winvisual • 14,820 online',
    });
  };

  return (
    <aside className="w-[236px] shrink-0 flex flex-col justify-between bg-[var(--background-secondary)]/65 border-r border-[var(--border-primary)] p-4 select-none">
      <div className="space-y-5">
        {/* Compact Active Account Card */}
        <button
          type="button"
          onClick={() => setCurrentPage('account')}
          className={cn(
            'w-full flex items-center gap-3 p-2.5 rounded-[14px] text-left cursor-pointer interactive-surface',
            'bg-[var(--surface-primary)] border border-[var(--border-primary)]',
            'hover:bg-[var(--surface-secondary)] hover:border-[var(--border-hover)]'
          )}
        >
          <MinecraftAvatar
            preset={activeAccount.skinPreset}
            size={38}
            online={activeAccount.online}
            showStatusDot
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate leading-tight">
              {activeAccount.username}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
              {activeAccount.authType === 'microsoft-demo'
                ? 'Microsoft Preview'
                : language === 'ru'
                  ? 'Локальный профиль'
                  : 'Local Profile'}
            </p>
          </div>
          <ChevronRight size={15} strokeWidth={1.75} className="text-[var(--text-muted)] shrink-0" />
        </button>

        {/* Primary Navigation */}
        <nav aria-label="Main navigation" className="space-y-1">
          {navItems.map(({ id, label, Icon }) => {
            const isActive = currentPage === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCurrentPage(id)}
                className={cn(
                  'relative w-full h-[41px] px-3.5 rounded-[12px] flex items-center gap-3 text-[13.5px] font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bg"
                    transition={{ type: 'spring', stiffness: 440, damping: 35 }}
                    className="absolute inset-0 rounded-[12px] bg-gradient-to-r from-[var(--accent-subtle)] via-white/[0.035] to-transparent border border-[var(--accent-primary)]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-primary)]" />
                  </motion.div>
                )}

                <Icon
                  size={18}
                  strokeWidth={1.75}
                  className={cn(
                    'relative z-10 transition-colors duration-200',
                    isActive ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-muted)]'
                  )}
                />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Real System Telemetry & Community */}
      <div className="space-y-2.5 pt-4 border-t border-[var(--border-primary)]">
        <button
          type="button"
          onClick={handleDiscordClick}
          className="w-full h-9 px-3 rounded-[10px] flex items-center justify-between text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-white/[0.02] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-[var(--border-hover)] transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <MessageSquare size={15} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
            <span>{copy.sidebar.discord}</span>
          </span>
          <ExternalLink size={13} strokeWidth={1.75} className="text-[var(--text-muted)]" />
        </button>

        <div className="px-3 py-2.5 rounded-[12px] bg-white/[0.02] border border-white/[0.05] space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {telemetry?.operational !== false && (
                <span className="status-radar-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              )}
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  telemetry?.operational !== false ? 'bg-emerald-400' : 'bg-amber-400'
                )}
              />
            </span>
            <span className="text-[11.5px] font-medium text-[var(--text-secondary)] truncate">
              {telemetry?.operational !== false ? copy.sidebar.operational : copy.sidebar.degraded}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
            <span>Launcher v{telemetry?.launcherVersion ?? '2.4.1'}</span>
            <span>
              {telemetry ? `${telemetry.onlinePlayers.toLocaleString()} online` : 'Syncing...'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
