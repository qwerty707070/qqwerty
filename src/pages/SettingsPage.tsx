import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Download,
  ExternalLink,
  FileSearch,
  FileTerminal,
  FolderArchive,
  FolderOpen,
  HardDrive,
  HelpCircle,
  Laptop,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import { ACCENT_PRESETS, useSettingsStore } from '../stores/settingsStore';
import { useLauncherStore } from '../stores/launcherStore';
import { useVisualClientStore } from '../stores/visualClientStore';
import { useNotificationStore } from '../stores/notificationStore';
import { GITHUB_RELEASE_URL } from '../data/catalogData';
import {
  isTauriDesktop,
  syncOptimizationModsEverywhere,
  tauriClearClientCache,
  tauriDetectJava,
  tauriOpenGameFolder,
  tauriPickDirectory,
  tauriPickJavaBinary,
} from '../services/tauriBridge';
import type { AnimationIntensity, LanguageCode, SurfaceTheme } from '../types/launcher';
import { Card } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { Slider } from '../components/ui/Slider';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { Tooltip } from '../components/ui/Tooltip';
import { Modal } from '../components/ui/Modal';
import { cn } from '../utils/cn';

type SettingsTabId = 'general' | 'jvm' | 'appearance' | 'network' | 'diagnostics';

const GC_PRESETS = {
  g1gc: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50',
  zgc: '-XX:+UseZGC -XX:+ZGenerational -XX:+AlwaysPreTouch -XX:+DisableExplicitGC',
};

const SettingRow: React.FC<{
  title: string;
  description: string;
  tooltip?: string;
  control: React.ReactNode;
}> = ({ title, description, tooltip, control }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0 border-b border-[var(--border-primary)] last:border-b-0">
    <div className="space-y-0.5 max-w-[520px]">
      <div className="flex items-center gap-1.5">
        <span className="text-[14px] font-medium text-[var(--text-primary)]">{title}</span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <button
              type="button"
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-help"
            >
              <HelpCircle size={13.5} strokeWidth={1.75} />
            </button>
          </Tooltip>
        )}
      </div>
      <p className="text-[12.5px] text-[var(--text-secondary)] leading-snug">{description}</p>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const [syncingMods, setSyncingMods] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'cache' | 'reset' | null>(null);

  const settings = useSettingsStore();
  const telemetry = useLauncherStore((s) => s.telemetry);
  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const setLogsModalOpen = useLauncherStore((s) => s.setLogsModalOpen);
  const startLaunchSequence = useLauncherStore((s) => s.startLaunchSequence);
  const appendLog = useLauncherStore((s) => s.appendLog);
  const { lastDiskSyncPath, lastDiskSyncAt, persistHudConfigToDisk } = useVisualClientStore();
  const pushToast = useNotificationStore((s) => s.pushToast);

  const isRu = settings.language === 'ru';
  const activeMcVersion =
    versions.find((v) => v.id === selectedVersionId)?.minecraftVersion ?? '1.21.11';

  const notifySaved = (labelRu: string, labelEn: string, description?: string) => {
    if (!settings.notificationsEnabled) return;
    pushToast({
      type: 'success',
      title: isRu ? labelRu : labelEn,
      description,
    });
  };

  const handleSyncModsNow = async () => {
    setSyncingMods(true);
    try {
      const res = await syncOptimizationModsEverywhere(
        settings.gameDirectory,
        activeMcVersion
      );
      appendLog(
        `[MODRINTH] Synced ${res.syncedMods.length} Fabric mods for ${res.minecraftVersion}`
      );
      notifySaved(
        `Моды для Fabric ${res.minecraftVersion} синхронизированы`,
        `Synced mods for Fabric ${res.minecraftVersion}`,
        res.syncedMods.slice(0, 3).join(' • ')
      );
    } catch (err) {
      pushToast({
        type: 'error',
        title: isRu ? 'Ошибка синхронизации Modrinth' : 'Modrinth sync failed',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSyncingMods(false);
    }
  };

  return (
    <motion.div
      key="page-settings"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="p-6 space-y-5 max-w-[1020px] pb-10"
    >
      {/* Header + Compact Category Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
            {isRu ? 'Настройки лаунчера и клиента' : 'Launcher & Client Settings'}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {isRu
              ? 'Все параметры применяются мгновенно и сохраняются между сессиями.'
              : 'All configuration updates apply instantaneously and persist across restarts.'}
          </p>
        </div>

        <SegmentedControl<SettingsTabId>
          layoutGroupId="settings-category-tabs"
          value={activeTab}
          options={[
            { value: 'general', label: isRu ? 'Основные' : 'General' },
            { value: 'jvm', label: isRu ? 'Java и память' : 'Java & RAM' },
            { value: 'appearance', label: isRu ? 'Графика и тема' : 'Theme' },
            { value: 'network', label: isRu ? 'Сеть' : 'Network' },
            { value: 'diagnostics', label: isRu ? 'Диагностика' : 'Diagnostics' },
          ]}
          onChange={setActiveTab}
        />
      </div>

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          {!isTauriDesktop() && (
            <Card className="p-5 space-y-3 border-[var(--accent-primary)]/25">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-[15.5px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Laptop size={17} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
                    {isRu
                      ? 'Нативный лаунчер и вшитые моды (WinVisual v2.7.0)'
                      : 'Native Installers & Embedded Client Mods (WinVisual v2.7.0)'}
                  </h2>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    {isRu
                      ? 'Установщики Windows (.exe / .msi), macOS (.dmg) и Linux (.deb / .AppImage) уже содержат вшитые моды EvoVis + ESP (1.16.5, 1.21.4, 1.21.11).'
                      : 'Native binaries for Windows, macOS, and Linux bundle compiled EvoVis + ESP Fabric mods for 1.16.5, 1.21.4, and 1.21.11.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <a href={GITHUB_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary" size="sm" type="button">
                      <Download size={14} strokeWidth={2} />
                      {isRu ? 'Лаунчер (.exe / .dmg / .deb)' : 'Installers (.exe / .dmg / .deb)'}
                      <ExternalLink size={13} strokeWidth={1.75} />
                    </Button>
                  </a>
                  {(['1.16.5', '1.21.4', '1.21.11'] as const).map((ver) => (
                    <a key={ver} href={`/api/downloads/mod/${ver}`}>
                      <Button variant="secondary" size="sm" type="button">
                        <Download size={13} strokeWidth={1.9} />
                        {ver}.jar
                      </Button>
                    </a>
                  ))}
                  <a href="/api/export-project">
                    <Button variant="secondary" size="sm" type="button">
                      <FolderArchive size={14} strokeWidth={1.75} />
                      {isRu ? 'Исходники (.tar.gz)' : 'Source (.tar.gz)'}
                    </Button>
                  </a>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
              {isRu ? 'Основные параметры' : 'General Preferences'}
            </h2>
            <div>
              <SettingRow
                title={isRu ? 'Язык интерфейса' : 'Interface Language'}
                description={
                  isRu
                    ? 'Язык навигации, системных уведомлений и описания сборок.'
                    : 'Display language across navigation, notifications, and build notes.'
                }
                control={
                  <SegmentedControl<LanguageCode>
                    layoutGroupId="settings-lang"
                    value={settings.language}
                    options={[
                      { value: 'ru', label: 'Русский' },
                      { value: 'en', label: 'English' },
                    ]}
                    onChange={(v) => {
                      settings.updateSetting('language', v);
                      notifySaved('Язык интерфейса обновлён', 'Interface language updated');
                    }}
                  />
                }
              />

              <SettingRow
                title={isRu ? 'Тёмная палитра поверхностей' : 'Dark Surface Palette'}
                description={
                  isRu
                    ? 'Оттенок глубины фоновых панелей лаунчера.'
                    : 'Base neutral surface depth across launcher panels.'
                }
                control={
                  <SegmentedControl<SurfaceTheme>
                    layoutGroupId="settings-theme"
                    value={settings.surfaceTheme}
                    options={[
                      { value: 'default', label: 'Carbon' },
                      { value: 'obsidian', label: 'Obsidian' },
                      { value: 'midnight', label: 'Midnight' },
                    ]}
                    onChange={(v) => {
                      settings.updateSetting('surfaceTheme', v);
                      notifySaved('Тема оформления применена', 'Surface theme saved');
                    }}
                  />
                }
              />

              <SettingRow
                title={isRu ? 'Запускать вместе с системой' : 'Start with System'}
                description={
                  isRu
                    ? 'Автоматически открывать WinVisual в фоновом режиме при входе в ОС.'
                    : 'Launch WinVisual minimized in background upon OS login.'
                }
                control={
                  <Toggle
                    checked={settings.startWithSystem}
                    onCheckedChange={(v) => {
                      settings.updateSetting('startWithSystem', v);
                      notifySaved('Настройки сохранены', 'Settings saved successfully');
                    }}
                  />
                }
              />

              <SettingRow
                title={isRu ? 'Сворачивать при запуске игры' : 'Minimize on Launch'}
                description={
                  isRu
                    ? 'Скрывать окно лаунчера после старта клиента Minecraft.'
                    : 'Minimize launcher window automatically once Minecraft starts.'
                }
                control={
                  <Toggle
                    checked={settings.minimizeOnLaunch}
                    onCheckedChange={(v) => settings.updateSetting('minimizeOnLaunch', v)}
                  />
                }
              />

              <SettingRow
                title={isRu ? 'Закрывать лаунчер после запуска' : 'Close Launcher After Launch'}
                description={
                  isRu
                    ? 'Полностью освобождать ресурсы процесса лаунчера после передачи управления JVM.'
                    : 'Exit launcher completely after handing execution to the Java process.'
                }
                control={
                  <Toggle
                    checked={settings.closeAfterLaunch}
                    onCheckedChange={(v) => settings.updateSetting('closeAfterLaunch', v)}
                  />
                }
              />
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: JAVA, RAM & MODRINTH OPTIMIZATION BUNDLE */}
      {activeTab === 'jvm' && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
              Minecraft, JVM & Modrinth Optimization Bundle
            </h2>
            {telemetry && (
              <span className="text-[11.5px] font-mono text-[var(--text-muted)]">
                {isRu ? 'ОЗУ системы:' : 'Host Total:'}{' '}
                {((telemetry.hostTotalMemoryMb ?? 16384) / 1024).toFixed(0)} GB
              </span>
            )}
          </div>

          {/* Automatic Modrinth Optimization Mods */}
          <div className="rounded-[14px] bg-white/[0.025] border border-[var(--accent-primary)]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[var(--accent-secondary)]" />
                <span className="text-[14px] font-semibold text-white">
                  {isRu
                    ? 'Авто-пакет Fabric API + Sodium + Iris + Lithium'
                    : 'Auto-Sync Fabric API + Sodium + Iris + Lithium'}
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)]">
                {isRu
                  ? `Изолированно скачивает и проверяет совместимые моды с Modrinth под сборку ${activeMcVersion} без конфликтов версий.`
                  : `Automatically fetches SHA-1 verified Fabric mods from Modrinth isolated per Minecraft ${activeMcVersion}.`}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                disabled={syncingMods}
                onClick={handleSyncModsNow}
              >
                <RefreshCw size={13.5} className={syncingMods ? 'animate-spin' : ''} />
                {isRu ? 'Синхронизировать' : 'Sync Mods'}
              </Button>
              <Toggle
                checked={settings.optimizeModsBundle}
                onCheckedChange={(v) => {
                  settings.updateSetting('optimizeModsBundle', v);
                  notifySaved(
                    v ? 'Авто-пакет Sodium + Iris включён' : 'Авто-пакет модов отключён',
                    v ? 'Modrinth bundle enabled' : 'Modrinth bundle disabled'
                  );
                }}
              />
            </div>
          </div>

          <div className="py-2 border-b border-[var(--border-primary)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-[var(--text-primary)]">
                  {isRu ? 'Выделение оперативной памяти (RAM)' : 'RAM Allocation'}
                </p>
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  {isRu
                    ? 'Рекомендуется 4096–8192 МБ для шейдеров высокого разрешения.'
                    : '4096–8192 MB recommended for high-resolution shaderpacks.'}
                </p>
              </div>
              <span className="px-3 py-1 rounded-[8px] bg-[var(--accent-subtle)] border border-[var(--accent-primary)]/30 font-mono text-[13px] font-semibold text-[var(--accent-secondary)]">
                {settings.ramAllocationMb} MB ({(settings.ramAllocationMb / 1024).toFixed(1)} GB)
              </span>
            </div>

            <Slider
              value={settings.ramAllocationMb}
              min={2048}
              max={16384}
              step={512}
              aria-label="RAM Allocation"
              onValueChange={(val) => settings.updateSetting('ramAllocationMb', val)}
            />
            <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)]">
              <span>2 GB</span>
              <span>6 GB (Optimal)</span>
              <span>12 GB</span>
              <span>16 GB</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                {isRu ? 'Исполняемый файл Java (javaw.exe / JDK)' : 'Java Executable (javaw.exe / JDK)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.javaPath}
                  onChange={(e) => settings.updateSetting('javaPath', e.target.value)}
                  className="flex-1 min-w-0 h-9 px-3 rounded-[10px] bg-[var(--background-secondary)] border border-[var(--border-primary)] focus:border-[var(--accent-primary)] text-[12.5px] font-mono text-[var(--text-primary)] outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                  title={isRu ? 'Выбрать javaw.exe в проводнике' : 'Browse Java executable'}
                  onClick={async () => {
                    const picked = await tauriPickJavaBinary(settings.javaPath);
                    if (picked) {
                      settings.updateSetting('javaPath', picked);
                      notifySaved('Путь к javaw обновлён', 'Java binary selected', picked);
                      return;
                    }
                    const nativeJava = await tauriDetectJava();
                    const detected =
                      nativeJava ??
                      telemetry?.java?.path ??
                      '/usr/lib/jvm/temurin-21-jdk/bin/java';
                    settings.updateSetting('javaPath', detected);
                    notifySaved('Путь к Java авто-определён', 'Java path synced', detected);
                  }}
                >
                  <FileSearch size={14} strokeWidth={1.75} />
                  {isRu ? 'Обзор' : 'Browse'}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                {isRu ? 'Директория клиента' : 'Game Directory'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.gameDirectory}
                  onChange={(e) => settings.updateSetting('gameDirectory', e.target.value)}
                  className="flex-1 min-w-0 h-9 px-3 rounded-[10px] bg-[var(--background-secondary)] border border-[var(--border-primary)] focus:border-[var(--accent-primary)] text-[12.5px] font-mono text-[var(--text-primary)] outline-none"
                />
                {isTauriDesktop() && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9"
                    onClick={async () => {
                      const folder = await tauriPickDirectory(settings.gameDirectory);
                      if (folder) {
                        settings.updateSetting('gameDirectory', folder);
                        notifySaved('Директория изменена', 'Directory updated', folder);
                      }
                    }}
                  >
                    {isRu ? 'Выбрать' : 'Pick'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                  aria-label="Open game directory"
                  onClick={async () => {
                    const openedNative = await tauriOpenGameFolder(settings.gameDirectory);
                    if (!openedNative) {
                      navigator.clipboard?.writeText(settings.gameDirectory).catch(() => {});
                      notifySaved(
                        `Путь скопирован: ${settings.gameDirectory}`,
                        `Copied directory: ${settings.gameDirectory}`
                      );
                    }
                  }}
                >
                  <FolderOpen size={14} strokeWidth={1.75} />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                {isRu ? 'Аргументы запуска JVM' : 'JVM Launch Arguments'}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    settings.updateSetting('jvmArguments', GC_PRESETS.g1gc);
                    notifySaved('Профиль G1GC применён', 'Applied G1GC flags');
                  }}
                  className="px-2.5 py-0.5 rounded-[7px] text-[11px] font-mono bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[#C4B5FD] cursor-pointer"
                >
                  G1GC Low-Jitter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    settings.updateSetting('jvmArguments', GC_PRESETS.zgc);
                    notifySaved('Профиль Generational ZGC применён', 'Applied ZGC flags');
                  }}
                  className="px-2.5 py-0.5 rounded-[7px] text-[11px] font-mono bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[#C4B5FD] cursor-pointer"
                >
                  ZGC Ultra (Java 21)
                </button>
              </div>
            </div>
            <input
              type="text"
              value={settings.jvmArguments}
              onChange={(e) => settings.updateSetting('jvmArguments', e.target.value)}
              className="w-full h-9 px-3 rounded-[10px] bg-[var(--background-secondary)] border border-[var(--border-primary)] focus:border-[var(--accent-primary)] text-[12px] font-mono text-[var(--text-primary)] outline-none"
            />
          </div>
        </Card>
      )}

      {/* TAB 3: APPEARANCE */}
      {activeTab === 'appearance' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {isRu ? 'Оформление и анимации' : 'Appearance & Motion'}
          </h2>
          <div>
            <SettingRow
              title={isRu ? 'Акцентный цвет интерфейса' : 'Interface Accent Color'}
              description={
                isRu
                  ? 'Деликатный цветовой акцент кнопок, активных индикаторов и свечения.'
                  : 'Controls the signature accent tone across highlights and glow states.'
              }
              control={
                <div className="flex items-center gap-2.5">
                  {ACCENT_PRESETS.map((preset) => {
                    const selected = settings.accentId === preset.id;
                    return (
                      <Tooltip key={preset.id} content={isRu ? preset.labelRu : preset.labelEn}>
                        <button
                          type="button"
                          onClick={() => {
                            settings.updateSetting('accentId', preset.id);
                            notifySaved('Акцентный цвет изменён', 'Accent color updated');
                          }}
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer border',
                            selected
                              ? 'scale-110 border-white shadow-[0_0_14px_rgba(255,255,255,0.35)]'
                              : 'border-white/15 hover:scale-105'
                          )}
                          style={{ backgroundColor: preset.primary }}
                          aria-label={preset.labelEn}
                        >
                          {selected && (
                            <Check size={13} strokeWidth={2.5} className="text-[#090A10]" />
                          )}
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              }
            />

            <SettingRow
              title={isRu ? 'Фоновое свечение (Ambient Glow)' : 'Ambient Background Effects'}
              description={
                isRu
                  ? 'Мягкая атмосферная подсветка вокруг ключевых поверхностей.'
                  : 'Subtle radial atmospheric glow behind primary hero stages.'
              }
              control={
                <Toggle
                  checked={settings.backgroundEffects}
                  onCheckedChange={(v) => settings.updateSetting('backgroundEffects', v)}
                />
              }
            />

            <SettingRow
              title={isRu ? 'Интенсивность анимаций' : 'Animation Intensity'}
              description={
                isRu
                  ? 'Плавность переходов между экранами и фонового движения сцены.'
                  : 'Controls motion richness across transitions and hero drift.'
              }
              control={
                <SegmentedControl<AnimationIntensity>
                  layoutGroupId="anim-intensity-seg"
                  value={settings.animationIntensity}
                  options={[
                    { value: 'high', label: isRu ? 'Высокая' : 'High' },
                    { value: 'balanced', label: isRu ? 'Средняя' : 'Balanced' },
                    { value: 'minimal', label: isRu ? 'Минимум' : 'Minimal' },
                  ]}
                  onChange={(v) => settings.updateSetting('animationIntensity', v)}
                />
              }
            />

            <SettingRow
              title={isRu ? 'Уменьшение движения (Reduced Motion)' : 'Reduced Motion'}
              description={
                isRu
                  ? 'Отключает фоновое масштабирование баннеров и пульсирующие индикаторы.'
                  : 'Disables ambient background drift and radar animations.'
              }
              control={
                <Toggle
                  checked={settings.reducedMotion}
                  onCheckedChange={(v) => settings.updateSetting('reducedMotion', v)}
                />
              }
            />
          </div>
        </Card>
      )}

      {/* TAB 4: NETWORK */}
      {activeTab === 'network' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {isRu ? 'Сеть, уведомления и ускорение' : 'Network & Acceleration'}
          </h2>
          <div>
            <SettingRow
              title={isRu ? 'Аппаратное ускорение GPU' : 'Hardware Acceleration'}
              description={
                isRu
                  ? 'Использовать композитинг GPU для плавных переходов и размытия панелей.'
                  : 'Enable GPU layer compositing for smooth 60fps transitions and surfaces.'
              }
              control={
                <Toggle
                  checked={settings.hardwareAcceleration}
                  onCheckedChange={(v) => settings.updateSetting('hardwareAcceleration', v)}
                />
              }
            />

            <SettingRow
              title={isRu ? 'Всплывающие уведомления' : 'Launcher Notifications'}
              description={
                isRu
                  ? 'Показывать ненавязчивые статусы сохранения настроек и проверки файлов.'
                  : 'Display subtle status notifications when builds finish verifying.'
              }
              control={
                <Toggle
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(v) => settings.updateSetting('notificationsEnabled', v)}
                />
              }
            />

            <SettingRow
              title={isRu ? 'Автоматические обновления' : 'Automatic Updates'}
              description={
                isRu
                  ? 'Проверять свежие патчи визуальных модулей при открытии лаунчера.'
                  : 'Check signed edge manifests for visual module patches automatically.'
              }
              control={
                <Toggle
                  checked={settings.autoUpdates}
                  onCheckedChange={(v) => settings.updateSetting('autoUpdates', v)}
                />
              }
            />

            <SettingRow
              title={isRu ? 'Ограничение скорости загрузки' : 'Download Speed Limit'}
              description={
                isRu
                  ? 'Реально управляет скоростью потоковой скачки пакетов с сервера.'
                  : 'Actively throttles real HTTP artifact download bandwidth.'
              }
              tooltip={
                isRu
                  ? 'Применяется напрямую к потоковой загрузке пакетов в Download Manager'
                  : 'Applied directly to live artifact streaming'
              }
              control={
                <SegmentedControl<string>
                  layoutGroupId="speed-limit-seg"
                  value={String(settings.downloadSpeedLimitMbps)}
                  options={[
                    { value: '0', label: isRu ? 'Без лимита' : 'Unlimited' },
                    { value: '25', label: '25 MB/s' },
                    { value: '10', label: '10 MB/s' },
                    { value: '5', label: '5 MB/s' },
                  ]}
                  onChange={(val) => {
                    settings.updateSetting('downloadSpeedLimitMbps', Number(val));
                    notifySaved('Лимит скорости применён', 'Bandwidth limit updated');
                  }}
                />
              }
            />
          </div>
        </Card>
      )}

      {/* TAB 5: DIAGNOSTICS & DISK PERSISTENCE */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-primary)]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
                  <HardDrive size={16} className="text-[var(--accent-secondary)]" />
                  <span>
                    {isRu
                      ? 'Файловая синхронизация HUD и прицела'
                      : 'HUD & Crosshair Disk Sync'}
                  </span>
                </div>
                <p className="text-[12px] font-mono text-[var(--text-secondary)] break-all">
                  {lastDiskSyncPath}
                  {lastDiskSyncAt ? ` • ${lastDiskSyncAt}` : ''}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const saved = await persistHudConfigToDisk();
                  notifySaved(
                    'Конфиг HUD записан на диск',
                    'HUD config written to disk',
                    saved ?? lastDiskSyncPath
                  );
                }}
              >
                <Save size={14} strokeWidth={1.75} />
                {isRu ? 'Сохранить winvisual-hud.json' : 'Flush HUD Config'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <Button variant="secondary" onClick={() => setLogsModalOpen(true)}>
                <FileTerminal size={15} strokeWidth={1.75} />
                {isRu ? 'Открыть логи' : 'Open Logs'}
              </Button>

              <Button variant="secondary" onClick={() => startLaunchSequence()}>
                <ShieldCheck size={15} strokeWidth={1.75} />
                {isRu ? 'Проверить целостность' : 'Repair Installation'}
              </Button>

              <Button variant="secondary" onClick={() => setConfirmAction('cache')}>
                <Wrench size={15} strokeWidth={1.75} />
                {isRu ? 'Очистить кэш' : 'Clear Cache'}
              </Button>

              <Button variant="danger" onClick={() => setConfirmAction('reset')}>
                <RotateCcw size={15} strokeWidth={1.75} />
                {isRu ? 'Сбросить настройки' : 'Reset Settings'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        open={confirmAction !== null}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={
          confirmAction === 'cache'
            ? isRu
              ? 'Очистить локальный кэш пакетов?'
              : 'Clear cached client artifacts?'
            : isRu
              ? 'Сбросить все настройки по умолчанию?'
              : 'Reset all launcher settings?'
        }
        description={
          confirmAction === 'cache'
            ? isRu
              ? 'Временные шейдерные индексы и кэш манифестов будут пересозданы при следующем запуске.'
              : 'Temporary shader caches and manifest indexes will be freshly verified on next launch.'
            : isRu
              ? 'Параметры памяти JVM, тема оформления и сетевые лимиты вернутся к заводским значениям.'
              : 'JVM memory allocation, theme preferences, and bandwidth settings will revert to factory defaults.'
        }
      >
        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={() => setConfirmAction(null)}>
            {isRu ? 'Отмена' : 'Cancel'}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (confirmAction === 'cache') {
                await tauriClearClientCache(settings.gameDirectory);
                appendLog('[CACHE] Cleared temporary shader & manifest cache.');
                pushToast({
                  type: 'success',
                  title: isRu ? 'Кэш клиента очищен' : 'Client cache cleared',
                });
              } else {
                settings.resetDefaults();
                appendLog('[SETTINGS] Reverted all preferences to factory defaults.');
                pushToast({
                  type: 'info',
                  title: isRu
                    ? 'Настройки сброшены по умолчанию'
                    : 'Settings restored to defaults',
                });
              }
              setConfirmAction(null);
            }}
          >
            <Trash2 size={15} strokeWidth={1.75} />
            {isRu ? 'Подтвердить' : 'Confirm'}
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
};
