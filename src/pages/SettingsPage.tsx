import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Download,
  ExternalLink,
  FileTerminal,
  FolderArchive,
  FolderOpen,
  HelpCircle,
  Laptop,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import { ACCENT_PRESETS, useSettingsStore } from '../stores/settingsStore';
import { useLauncherStore } from '../stores/launcherStore';
import { useNotificationStore } from '../stores/notificationStore';
import { GITHUB_RELEASE_URL } from '../data/catalogData';
import {
  isTauriDesktop,
  tauriClearClientCache,
  tauriDetectJava,
  tauriOpenGameFolder,
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

const SettingRow: React.FC<{
  title: string;
  description: string;
  tooltip?: string;
  control: React.ReactNode;
}> = ({ title, description, tooltip, control }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0 border-b border-[var(--border-primary)] last:border-b-0">
    <div className="space-y-0.5 max-w-[500px]">
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
  const settings = useSettingsStore();
  const telemetry = useLauncherStore((s) => s.telemetry);
  const setLogsModalOpen = useLauncherStore((s) => s.setLogsModalOpen);
  const startLaunchSequence = useLauncherStore((s) => s.startLaunchSequence);
  const appendLog = useLauncherStore((s) => s.appendLog);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const [confirmAction, setConfirmAction] = useState<'cache' | 'reset' | null>(null);
  const isRu = settings.language === 'ru';

  const notifySaved = (labelRu: string, labelEn: string) => {
    if (!settings.notificationsEnabled) return;
    pushToast({
      type: 'success',
      title: isRu ? labelRu : labelEn,
    });
  };

  return (
    <motion.div
      key="page-settings"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="p-7 space-y-6 max-w-[980px] pb-12"
    >
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
          {isRu ? 'Настройки лаунчера и клиента' : 'Launcher & Client Settings'}
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
          {isRu
            ? 'Все изменения применяются мгновенно и автоматически сохраняются между запусками.'
            : 'All configuration updates apply instantaneously and persist automatically across restarts.'}
        </p>
      </div>

      {/* Native Desktop Installers & Source Package Card (shown in web preview) */}
      {!isTauriDesktop() && (
        <Card className="p-6 space-y-4 border-[var(--accent-primary)]/25">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Laptop size={17} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
                {isRu
                  ? 'Нативный десктопный лаунчер (WinVisual Desktop)'
                  : 'Native Desktop Installers (WinVisual)'}
              </h2>
              <p className="text-[12.5px] text-[var(--text-secondary)]">
                {isRu
                  ? 'Установщики для Windows (.exe / .msi), macOS (.dmg) и Linux (.deb / .AppImage), а также исходный архив.'
                  : 'Compiled native binaries for Windows (.exe / .msi), macOS (.dmg), and Linux (.deb / .AppImage).'}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <a href={GITHUB_RELEASE_URL} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="sm" type="button">
                  <Download size={14} strokeWidth={2} />
                  {isRu ? 'Установщики (.exe / .dmg / .deb)' : 'Installers (.exe / .dmg / .deb)'}
                  <ExternalLink size={13} strokeWidth={1.75} />
                </Button>
              </a>
              <a href="/api/export-project">
                <Button variant="secondary" size="sm" type="button">
                  <FolderArchive size={14} strokeWidth={1.75} />
                  {isRu ? 'Исходный код (.tar.gz)' : 'Source Archive (.tar.gz)'}
                </Button>
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* 1. GENERAL */}
      <Card className="p-6 space-y-4">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          {isRu ? 'Основные' : 'General'}
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
                ? 'Скрывать окно лаунчера в трей после старта клиента Minecraft.'
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

      {/* 2. MINECRAFT */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Minecraft & JVM</h2>
          {telemetry && (
            <span className="text-[11.5px] font-mono text-[var(--text-muted)]">
              {isRu ? 'Доступно в системе:' : 'Host Total:'}{' '}
              {((telemetry.hostTotalMemoryMb ?? 16384) / 1024).toFixed(0)} GB
            </span>
          )}
        </div>

        <div className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-medium text-[var(--text-secondary)]">
                {isRu ? 'Путь к исполняемому файлу Java (JDK 21+)' : 'Java Executable Path (JDK 21+)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.javaPath}
                  onChange={(e) => settings.updateSetting('javaPath', e.target.value)}
                  className="flex-1 h-9 px-3 rounded-[10px] bg-[var(--background-secondary)] border border-[var(--border-primary)] focus:border-[var(--accent-primary)] text-[12.5px] font-mono text-[var(--text-primary)] outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                  onClick={async () => {
                    const nativeJava = await tauriDetectJava();
                    const detected =
                      nativeJava ??
                      telemetry?.java?.path ??
                      '/usr/lib/jvm/temurin-21-jdk/bin/java';
                    settings.updateSetting('javaPath', detected);
                    notifySaved('Путь к Java обновлён', 'Java path synced');
                  }}
                >
                  Auto
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
                  className="flex-1 h-9 px-3 rounded-[10px] bg-[var(--background-secondary)] border border-[var(--border-primary)] focus:border-[var(--accent-primary)] text-[12.5px] font-mono text-[var(--text-primary)] outline-none"
                />
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

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium text-[var(--text-secondary)]">
              {isRu ? 'Аргументы запуска JVM' : 'JVM Launch Arguments'}
            </label>
            <input
              type="text"
              value={settings.jvmArguments}
              onChange={(e) => settings.updateSetting('jvmArguments', e.target.value)}
              className="w-full h-9 px-3 rounded-[10px] bg-[var(--background-secondary)] border border-[var(--border-primary)] focus:border-[var(--accent-primary)] text-[12px] font-mono text-[var(--text-primary)] outline-none"
            />
          </div>
        </div>
      </Card>

      {/* 3. LAUNCHER & NETWORK */}
      <Card className="p-6 space-y-4">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          {isRu ? 'Лаунчер и загрузка' : 'Launcher & Network'}
        </h2>
        <div>
          <SettingRow
            title={isRu ? 'Аппаратное ускорение GPU' : 'Hardware Acceleration'}
            description={
              isRu
                ? 'Использовать композитинг GPU для плавных переходов и размытия панелей.'
                : 'Enable GPU layer compositing for smooth 60fps transitions and glass surfaces.'
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

      {/* 4. APPEARANCE */}
      <Card className="p-6 space-y-4">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          {isRu ? 'Оформление и анимации' : 'Appearance & Motion'}
        </h2>
        <div>
          <SettingRow
            title={isRu ? 'Акцентный цвет интерфейса' : 'Interface Accent Color'}
            description={
              isRu
                ? 'Деликатный 10% цветовой акцент кнопок, активных индикаторов и свечения.'
                : 'Controls the 10% signature accent tone across highlights and glow states.'
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

      {/* 5. ADVANCED */}
      <Card className="p-6 space-y-4">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          {isRu ? 'Расширенные инструменты' : 'Advanced & Diagnostics'}
        </h2>
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
