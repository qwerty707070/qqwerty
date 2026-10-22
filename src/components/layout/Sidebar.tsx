import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Home,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  Settings,
  UserRound,
} from 'lucide-react';
import type { PageRoute } from '../../types/launcher';
import { useLauncherStore } from '../../stores/launcherStore';
import { useAccountStore } from '../../stores/accountStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { MinecraftAvatar } from '../ui/MinecraftAvatar';
import { t } from '../../utils/i18n';
import { cn } from '../../utils/cn';

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const currentPage = useLauncherStore((s) => s.currentPage);
  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const telemetry = useLauncherStore((s) => s.telemetry);
  const { accounts, activeAccountId } = useAccountStore();
  const language = useSettingsStore((s) => s.language);

  const copy = t(language);
  const isRu = language === 'ru';
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];

  const navItems: {
    id: PageRoute;
    label: string;
    Icon: typeof Home;
    trailing?: 'chevron-down' | 'chevron-right';
  }[] = [
    { id: 'home', label: copy.nav.home, Icon: Home },
    { id: 'modules', label: isRu ? 'Модули' : 'Modules', Icon: Puzzle, trailing: 'chevron-down' },
    { id: 'news', label: copy.nav.news, Icon: Newspaper },
    { id: 'versions', label: copy.nav.versions, Icon: Box },
    { id: 'settings', label: copy.nav.settings, Icon: Settings },
    { id: 'account', label: copy.nav.account, Icon: UserRound, trailing: 'chevron-right' },
  ];

  return (
    <motion.aside
      animate={{ width: collapsed ? 78 : 238 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="shrink-0 flex flex-col justify-between bg-[#090A10]/95 border-r border-white/[0.075] p-3.5 select-none overflow-hidden"
    >
      <div className="space-y-4">
        {/* Profile Card with Crown-W Avatar + userXXXXX + Glowing WINVISUAL PRO Pill */}
        <button
          type="button"
          onClick={() => setCurrentPage('account')}
          className={cn(
            'w-full flex items-center gap-3 rounded-[16px] text-left cursor-pointer interactive-surface',
            'bg-[#0E1019] border border-white/[0.085] hover:border-[rgba(var(--accent-rgb),0.45)]',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_28px_-14px_rgba(0,0,0,0.85)]',
            collapsed ? 'p-2 justify-center' : 'px-3 py-3'
          )}
        >
          <MinecraftAvatar
            preset={activeAccount.skinPreset}
            size={collapsed ? 38 : 44}
            online={activeAccount.online}
            showStatusDot={collapsed}
          />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-[#F5F5F7] truncate leading-tight">
                  {activeAccount.username}
                </p>
                <span
                  className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-[9.5px] font-bold tracking-[0.06em] uppercase text-white bg-gradient-to-r from-[#7B61FF] to-[#9B8AFB] shadow-[0_0_16px_rgba(139,124,255,0.65)]"
                >
                  WINVISUAL PRO
                </span>
              </div>
              <ChevronDown size={15} strokeWidth={1.75} className="text-[#8E909C] shrink-0" />
            </>
          )}
        </button>

        {/* Primary Navigation */}
        <nav aria-label="Main navigation" className="space-y-1 pt-1">
          {navItems.map(({ id, label, Icon, trailing }) => {
            const isActive = currentPage === id;
            return (
              <button
                key={id}
                type="button"
                title={collapsed ? label : undefined}
                onClick={() => setCurrentPage(id)}
                className={cn(
                  'relative w-full h-[43px] rounded-[12px] flex items-center text-[13.5px] font-medium transition-colors cursor-pointer',
                  collapsed ? 'justify-center px-0' : 'px-3.5 gap-3',
                  isActive
                    ? 'text-[#FFFFFF]'
                    : 'text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-white/[0.03]'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bg"
                    transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                    className="absolute inset-0 rounded-[12px] bg-gradient-to-r from-[rgba(var(--accent-rgb),0.2)] via-[rgba(var(--accent-rgb),0.09)] to-[rgba(var(--accent-rgb),0.03)] border border-[rgba(var(--accent-rgb),0.25)]"
                  >
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] rounded-full bg-[#C4B5FD] shadow-[0_0_14px_#8B7CFF,0_0_4px_#FFFFFF]"
                    />
                  </motion.div>
                )}

                <Icon
                  size={18}
                  strokeWidth={1.75}
                  className={cn(
                    'relative z-10 shrink-0 transition-colors duration-200',
                    isActive ? 'text-[#C4B5FD]' : 'text-[#8E909C]'
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="relative z-10 flex-1 text-left truncate">{label}</span>
                    {trailing === 'chevron-down' && (
                      <ChevronDown
                        size={14}
                        strokeWidth={1.75}
                        className="relative z-10 text-[#686A76] shrink-0"
                      />
                    )}
                    {trailing === 'chevron-right' && (
                      <ChevronRight
                        size={14}
                        strokeWidth={1.75}
                        className="relative z-10 text-[#686A76] shrink-0"
                      />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Server Operational Status + Collapse Rail Control */}
      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <div className={cn('flex items-center gap-2.5 min-w-0', collapsed && 'mx-auto')}>
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {telemetry?.operational !== false && (
              <span className="status-radar-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
            )}
            <span
              className={cn(
                'relative inline-flex rounded-full h-2.5 w-2.5 shadow-[0_0_10px_#34D399]',
                telemetry?.operational !== false ? 'bg-emerald-400' : 'bg-amber-400'
              )}
            />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-emerald-400 truncate leading-tight">
                {telemetry?.operational !== false
                  ? isRu
                    ? 'Серверы работают'
                    : 'Servers Online'
                  : copy.sidebar.degraded}
              </p>
              <p className="text-[10.5px] text-[#6E707D] truncate mt-0.5">
                {isRu ? 'Все системы в норме' : 'All systems operational'}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={
            collapsed
              ? isRu
                ? 'Развернуть меню'
                : 'Expand sidebar'
              : isRu
                ? 'Свернуть меню'
                : 'Collapse sidebar'
          }
          className="h-7 w-7 rounded-[8px] inline-flex items-center justify-center text-[#6E707D] hover:text-[#F5F5F7] hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
    </motion.aside>
  );
};
