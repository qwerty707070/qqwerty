import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Dices,
  ExternalLink,
  Home,
  Newspaper,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Puzzle,
  Settings,
  UserRound,
} from 'lucide-react';
import type { PageRoute } from '../../types/launcher';
import { useLauncherStore } from '../../stores/launcherStore';
import { generateRandomUserNick, useAccountStore } from '../../stores/accountStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { MinecraftAvatar } from '../ui/MinecraftAvatar';
import { t } from '../../utils/i18n';
import { cn } from '../../utils/cn';

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickNick, setQuickNick] = useState('');
  const [menuPos, setMenuPos] = useState({ left: 16, top: 76, width: 292 });

  const cardBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentPage = useLauncherStore((s) => s.currentPage);
  const setCurrentPage = useLauncherStore((s) => s.setCurrentPage);
  const telemetry = useLauncherStore((s) => s.telemetry);
  const {
    accounts,
    activeAccountId,
    setActiveAccount,
    renameActiveAccount,
    randomizeActiveAccount,
    addOfflineProfile,
  } = useAccountStore();
  const language = useSettingsStore((s) => s.language);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const copy = t(language);
  const isRu = language === 'ru';
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];

  const syncPopoverPos = useCallback(() => {
    const el = cardBtnRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const width = 296;
    const left = Math.min(Math.max(12, Math.round(rect.left)), window.innerWidth - width - 12);
    const top = Math.round(rect.bottom + 8);
    setMenuPos({ left, top, width });
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    setQuickNick(activeAccount.username);
    syncPopoverPos();

    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        cardBtnRef.current &&
        !cardBtnRef.current.contains(target) &&
        (!popoverRef.current || !popoverRef.current.contains(target))
      ) {
        setProfileMenuOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };

    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', syncPopoverPos);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', syncPopoverPos);
    };
  }, [profileMenuOpen, activeAccount.username, syncPopoverPos]);

  const handleQuickNickSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = renameActiveAccount(quickNick);
    setQuickNick(updated.username);
    pushToast({
      type: 'success',
      title: isRu ? `Ник изменён: ${updated.username}` : `Nickname: ${updated.username}`,
    });
  };

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
    { id: 'resources', label: isRu ? 'Моды и ресурспаки' : 'Mods & Packs', Icon: PackageOpen },
    { id: 'settings', label: copy.nav.settings, Icon: Settings },
    { id: 'account', label: copy.nav.account, Icon: UserRound, trailing: 'chevron-right' },
  ];

  const popoverNode = (
    <AnimatePresence>
      {profileMenuOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            left: `${menuPos.left}px`,
            top: `${menuPos.top}px`,
            width: `${menuPos.width}px`,
            zIndex: 9999,
          }}
          className="popover-panel rounded-[16px] p-3 space-y-3 select-none"
        >
          {/* Quick Nickname Edit + Random userXXXXX Dice */}
          <form onSubmit={handleQuickNickSave} className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)]">
              <span>{isRu ? 'Быстрая смена ника' : 'Quick Nickname'}</span>
              <span className="font-mono text-[10px] text-[var(--accent-secondary)]">
                {activeAccount.authType === 'microsoft' ? 'MSA' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                minLength={3}
                maxLength={16}
                value={quickNick}
                onChange={(e) => setQuickNick(e.target.value)}
                className="flex-1 min-w-0 h-8 px-2.5 rounded-[8px] bg-[#090B12] border border-white/[0.1] focus:border-[var(--accent-primary)] text-[12.5px] font-medium text-white outline-none"
              />
              <button
                type="button"
                title={isRu ? 'Случайный userXXXXX' : 'Random userXXXXX'}
                onClick={() => {
                  const updated = randomizeActiveAccount();
                  setQuickNick(updated.username);
                  pushToast({
                    type: 'info',
                    title: isRu ? `Новый ник: ${updated.username}` : `Nickname: ${updated.username}`,
                  });
                }}
                className="h-8 w-8 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] flex items-center justify-center text-[#C4B5FD] cursor-pointer shrink-0"
              >
                <Dices size={14} strokeWidth={1.85} />
              </button>
              <button
                type="submit"
                className="h-8 px-2.5 rounded-[8px] bg-[var(--accent-primary)] hover:brightness-110 text-[11.5px] font-semibold text-white cursor-pointer shrink-0"
              >
                OK
              </button>
            </div>
          </form>

          {/* Saved Accounts Instant Switcher */}
          <div className="space-y-1 pt-2 border-t border-white/[0.07] max-h-[168px] overflow-y-auto">
            {accounts.map((acc) => {
              const selected = acc.id === activeAccountId;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    setActiveAccount(acc.id);
                    setQuickNick(acc.username);
                    setProfileMenuOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[10px] text-left transition-colors cursor-pointer border',
                    selected
                      ? 'bg-[#1D1B35] border-[var(--accent-primary)]/55 text-white'
                      : 'bg-transparent border-transparent hover:bg-white/[0.05] text-[#B4B6C4]'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MinecraftAvatar
                      preset={acc.skinPreset}
                      customSkinDataUrl={acc.customSkinDataUrl}
                      size={28}
                    />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-[#F5F5F7] truncate">
                        {acc.username}
                      </p>
                      <p className="text-[10px] text-[#7E8090] truncate">
                        {acc.authType === 'microsoft'
                          ? 'Microsoft OAuth'
                          : isRu
                            ? 'Локальный профиль'
                            : 'Local Profile'}
                      </p>
                    </div>
                  </div>
                  {selected && (
                    <Check size={14} strokeWidth={2.2} className="text-[var(--accent-secondary)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const created = addOfflineProfile(generateRandomUserNick(), 'winvisual');
                setQuickNick(created.username);
                pushToast({
                  type: 'success',
                  title: isRu ? `Создан ${created.username}` : `Created ${created.username}`,
                });
              }}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#B8BAC8] hover:text-white cursor-pointer"
            >
              <Plus size={13.5} strokeWidth={2} />
              <span>{isRu ? 'Новый профиль' : 'Add Profile'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                setCurrentPage('account');
              }}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-secondary)] hover:underline cursor-pointer"
            >
              <span>{isRu ? '3D Скин и OAuth' : '3D Skin & OAuth'}</span>
              <ExternalLink size={12} strokeWidth={2} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <motion.aside
      animate={{ width: collapsed ? 78 : 238 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="shrink-0 flex flex-col justify-between bg-[#090A10]/95 border-r border-white/[0.075] p-3.5 select-none overflow-hidden"
    >
      <div className="space-y-4">
        {/* Profile Card with Crown-W / Custom Skin Avatar + userXXXXX + Quick Switcher Popover */}
        <button
          ref={cardBtnRef}
          type="button"
          onClick={() => {
            syncPopoverPos();
            setProfileMenuOpen((prev) => !prev);
          }}
          className={cn(
            'w-full flex items-center gap-3 rounded-[16px] text-left cursor-pointer interactive-surface',
            'bg-[#0E1019] border hover:border-[rgba(var(--accent-rgb),0.45)]',
            profileMenuOpen ? 'border-[var(--accent-primary)]/70' : 'border-white/[0.085]',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_28px_-14px_rgba(0,0,0,0.85)]',
            collapsed ? 'p-2 justify-center' : 'px-3 py-3'
          )}
        >
          <MinecraftAvatar
            preset={activeAccount.skinPreset}
            customSkinDataUrl={activeAccount.customSkinDataUrl}
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
                <span className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-[9.5px] font-bold tracking-[0.06em] uppercase text-white bg-gradient-to-r from-[#7B61FF] to-[#9B8AFB] shadow-[0_0_16px_rgba(139,124,255,0.65)]">
                  WINVISUAL PRO
                </span>
              </div>
              <ChevronDown
                size={15}
                strokeWidth={1.75}
                className={cn(
                  'text-[#8E909C] shrink-0 transition-transform duration-200',
                  profileMenuOpen && 'rotate-180 text-white'
                )}
              />
            </>
          )}
        </button>

        {typeof document !== 'undefined' && document.body
          ? createPortal(popoverNode, document.body)
          : popoverNode}

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
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3.5px] rounded-full bg-[#C4B5FD] shadow-[0_0_14px_#8B7CFF,0_0_4px_#FFFFFF]" />
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
