import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Download,
  GripHorizontal,
  HardDrive,
  MonitorPlay,
  PackageCheck,
  Palette,
  RotateCcw,
  Share2,
  Shield,
  Sparkles,
} from 'lucide-react';
import {
  EVO_THEMES,
  useVisualClientStore,
  type EvoThemeId,
  type PresetProfileId,
} from '../stores/visualClientStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { installOrDownloadClientModEverywhere } from '../services/tauriBridge';
import { Card } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { Slider } from '../components/ui/Slider';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

type FilterTab = 'all' | 'esp' | 'hud' | 'render' | 'cosmetics';

function browserKeyToGlfw(e: KeyboardEvent): { label: string; glfw: number } | null {
  if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') {
    return { label: 'NONE', glfw: 0 };
  }
  const upper = e.key.toUpperCase();
  if (/^[A-Z0-9]$/.test(upper)) {
    return { label: upper, glfw: upper.charCodeAt(0) };
  }
  if (e.code === 'ShiftRight') return { label: 'RSHIFT', glfw: 344 };
  if (e.code === 'ShiftLeft') return { label: 'LSHIFT', glfw: 340 };
  if (e.code === 'ControlLeft') return { label: 'LCTRL', glfw: 341 };
  if (e.code === 'AltLeft') return { label: 'LALT', glfw: 342 };
  if (e.code === 'Tab') return { label: 'TAB', glfw: 258 };
  return null;
}

export const ModulesPage: React.FC = () => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'player-esp': true,
    'china-hat': true,
  });
  const [bindingId, setBindingId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const [, setDraggingId] = useState<string | null>(null);

  const {
    modules,
    themeId,
    crosshair,
    hudPositions,
    lastDiskSyncAt,
    toggleModule,
    setModuleMode,
    setModuleAmount,
    setModuleKeybind,
    setThemeId,
    updateCrosshair,
    setHudPosition,
    resetHudPositions,
    applyPresetProfile,
    exportPresetCode,
    importPresetCode,
    persistHudConfigToDisk,
    setLiveSessionModalOpen,
  } = useVisualClientStore();
  const language = useSettingsStore((s) => s.language);
  const gameDirectory = useSettingsStore((s) => s.gameDirectory);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const isRu = language === 'ru';

  const activeTheme = EVO_THEMES.find((t) => t.id === themeId) ?? EVO_THEMES[0];

  useEffect(() => {
    if (!bindingId) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      const mapped = browserKeyToGlfw(e);
      if (mapped) {
        setModuleKeybind(bindingId, mapped.label, mapped.glfw);
        setBindingId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bindingId, setModuleKeybind]);

  const visibleModules =
    filter === 'all' ? modules : modules.filter((m) => m.category === filter);

  const isEnabled = (id: string) => modules.some((m) => m.id === id && m.enabled);
  const getMod = (id: string) => modules.find((m) => m.id === id);

  const startDragWidget = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingId(id);
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) return;

    const onMove = (ev: PointerEvent) => {
      const nextX = Math.min(stageRect.width - 150, Math.max(12, ev.clientX - stageRect.left - 60));
      const nextY = Math.min(stageRect.height - 54, Math.max(12, ev.clientY - stageRect.top - 16));
      setHudPosition(id, nextX, nextY);
    };
    const onUp = () => {
      setDraggingId(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleExportPreset = () => {
    const code = exportPresetCode();
    navigator.clipboard?.writeText(code).catch(() => {});
    pushToast({
      type: 'success',
      title: isRu ? 'Код пресета WinVisual скопирован' : 'WinVisual Preset Code Copied',
      description: `${code.slice(0, 34)}…`,
    });
  };

  const handleSaveDisk = async () => {
    const path = await persistHudConfigToDisk();
    pushToast({
      type: 'success',
      title: isRu ? 'Синхронизировано с winvisual-hud.json' : 'Synced to winvisual-hud.json',
      description: path ?? '~/.minecraft/winvisual/config/winvisual-hud.json',
    });
  };

  const handleExportModJar = async (ver: string) => {
    try {
      const res = await installOrDownloadClientModEverywhere(gameDirectory, ver);
      pushToast({
        type: 'success',
        title:
          res.mode === 'injected'
            ? isRu
              ? `Мод ${ver} вшит в папку mods`
              : `Embedded ${ver} mod installed`
            : isRu
              ? `Скачивание ${res.target}`
              : `Downloading ${res.target}`,
        description: res.target,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: isRu ? 'Ошибка выгрузки .jar' : 'Mod export failed',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleApplyImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (importPresetCode(importInput)) {
      setImportInput('');
      setImportModalOpen(false);
      pushToast({
        type: 'success',
        title: isRu ? 'Пресет успешно применён' : 'Preset imported successfully',
      });
    } else {
      pushToast({
        type: 'error',
        title: isRu ? 'Неверный формат кода WINVISUAL-...' : 'Invalid WINVISUAL-... preset code',
      });
    }
  };

  const crossColor = crosshair.accentColor ? activeTheme.primaryHex : '#FFFFFF';
  const espMod = getMod('player-esp');

  return (
    <motion.div
      key="page-modules"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="p-6 space-y-5 max-w-[1080px] pb-12"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] text-[11px] font-mono text-[var(--accent-secondary)] mb-2">
            <PackageCheck size={13} strokeWidth={2} />
            <span>
              {isRu
                ? 'ВШИТО В ЛАУНЧЕР • WINVISUAL 1.16.5 / 1.21.4 / 1.21.11 • 28 МОДУЛЕЙ'
                : 'EMBEDDED IN LAUNCHER • WINVISUAL 1.16.5 / 1.21.4 / 1.21.11 • 28 MODULES'}
            </span>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
            {isRu ? 'Студия модулей WinVisual' : 'WinVisual Module Studio'}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {isRu
              ? 'Все настройки мгновенно синхронизируются с игрой через config/winvisual-hud.json (меню в игре — Right Shift).'
              : 'All modules, ESP modes, themes, and HUD widgets sync two-way via config/winvisual-hud.json (in-game menu: Right Shift).'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleSaveDisk}>
            <HardDrive size={14} strokeWidth={1.75} />
            {lastDiskSyncAt
              ? `HUD • ${lastDiskSyncAt}`
              : isRu
                ? 'Сохранить в игру'
                : 'Sync Disk'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPreset}>
            <Share2 size={14} strokeWidth={1.75} />
            {isRu ? 'Код' : 'Share'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(true)}>
            <Download size={14} strokeWidth={1.75} />
            {isRu ? 'Импорт' : 'Import'}
          </Button>
          <Button variant="secondary" size="sm" onClick={resetHudPositions}>
            <RotateCcw size={14} strokeWidth={1.75} />
            {isRu ? 'Сброс HUD' : 'Reset'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setLiveSessionModalOpen(true)}>
            <MonitorPlay size={14} strokeWidth={1.75} />
            {isRu ? 'Интерактив в игре' : 'Live Preview'}
          </Button>
        </div>
      </div>

      {/* Embedded JAR Quick Bar + Live WinVisual Theme & Preset Bar */}
      <Card className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
            <Palette size={14} strokeWidth={1.8} />
            {isRu ? 'Тема клиента:' : 'Client Theme:'}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {EVO_THEMES.map((theme) => {
              const selected = theme.id === themeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeId(theme.id as EvoThemeId)}
                  className={`h-8 px-3 rounded-[10px] inline-flex items-center gap-2 text-[11.5px] font-semibold transition-all cursor-pointer border ${
                    selected
                      ? 'bg-white/[0.11] text-white border-white/35 shadow-[0_0_16px_rgba(139,124,255,0.3)]'
                      : 'bg-white/[0.03] text-[var(--text-secondary)] border-white/[0.07] hover:text-white'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${theme.primaryHex}, ${theme.secondaryHex})`,
                    }}
                  />
                  <span>{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11.5px] font-mono text-[var(--text-muted)] mr-1">
            {isRu ? 'Скачать / вшить .jar:' : 'Embedded .jar:'}
          </span>
          {(['1.16.5', '1.21.4', '1.21.11'] as const).map((ver) => (
            <button
              key={ver}
              type="button"
              onClick={() => handleExportModJar(ver)}
              className="h-8 px-3 rounded-[10px] bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.12] text-[11.5px] font-mono font-semibold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={12} strokeWidth={2} />
              <span>{ver}.jar</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Live Interactive Draggable HUD + 3D ESP + Cosmetics Preview Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          ref={stageRef}
          className="lg:col-span-8 relative h-[320px] rounded-[20px] overflow-hidden border border-white/[0.1] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)] select-none"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/images/hero-castle-violet.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/30" />

          {/* Simulated In-World Player Model with Live WinVisual ESP + ChinaHat + Crystal Wings + JumpCircle */}
          <div className="pointer-events-none absolute right-[108px] top-[62px] w-[96px] h-[156px] flex flex-col items-center justify-between">
            {/* Evo Nametag */}
            {isEnabled('nametags') && (
              <div className="-mt-7 px-2.5 py-0.5 rounded-[8px] bg-[#0B0D16]/90 border border-white/15 whitespace-nowrap text-[10px] font-mono flex items-center gap-1.5 shadow-lg">
                <span className="text-white font-semibold">user84910</span>
                <span className="text-emerald-400">19.2 HP</span>
                <span style={{ color: activeTheme.primaryHex }}>4.1m</span>
              </div>
            )}

            <div className="relative w-full h-full flex items-center justify-center">
              {/* Crystal 3D Wings */}
              {isEnabled('wings') && (
                <>
                  <div
                    className="absolute -left-5 top-7 w-7 h-12 rounded-l-[12px] border opacity-75 -rotate-12"
                    style={{
                      borderColor: activeTheme.primaryHex,
                      background: `linear-gradient(135deg, ${activeTheme.primaryHex}55, transparent)`,
                    }}
                  />
                  <div
                    className="absolute -right-5 top-7 w-7 h-12 rounded-r-[12px] border opacity-75 rotate-12"
                    style={{
                      borderColor: activeTheme.secondaryHex,
                      background: `linear-gradient(225deg, ${activeTheme.secondaryHex}55, transparent)`,
                    }}
                  />
                </>
              )}

              {/* ChinaHat 3D Cone */}
              {isEnabled('china-hat') && (
                <div
                  className="absolute -top-2.5 w-14 h-4 rounded-full border"
                  style={{
                    borderColor: activeTheme.primaryHex,
                    background: `radial-gradient(circle, ${activeTheme.secondaryHex}99 0%, ${activeTheme.primaryHex}33 75%)`,
                    boxShadow: `0 0 16px ${activeTheme.primaryHex}`,
                  }}
                />
              )}

              {/* Silhouette Avatar */}
              <div className="w-9 h-24 rounded-[8px] bg-white/[0.10] border border-white/15" />

              {/* Player ESP Box (Corner / Full / Glow) */}
              {isEnabled('player-esp') && (
                <div
                  className="absolute inset-0"
                  style={{
                    border:
                      (espMod?.modeIndex ?? 0) === 0
                        ? 'none'
                        : `1.5px solid ${activeTheme.primaryHex}`,
                    boxShadow:
                      (espMod?.modeIndex ?? 0) === 2
                        ? `0 0 20px ${activeTheme.primaryHex}66, inset 0 0 14px ${activeTheme.primaryHex}33`
                        : 'none',
                  }}
                >
                  {(espMod?.modeIndex ?? 0) === 0 && (
                    <>
                      <span
                        className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2"
                        style={{ borderColor: activeTheme.primaryHex }}
                      />
                      <span
                        className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2"
                        style={{ borderColor: activeTheme.primaryHex }}
                      />
                      <span
                        className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2"
                        style={{ borderColor: activeTheme.secondaryHex }}
                      />
                      <span
                        className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2"
                        style={{ borderColor: activeTheme.secondaryHex }}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Health & Armor ESP Bar */}
              {isEnabled('health-bar') && (
                <div className="absolute -left-2.5 inset-y-0 w-1 rounded-full bg-black/70 overflow-hidden flex items-end">
                  <div className="w-full h-[88%] bg-emerald-400 rounded-full" />
                </div>
              )}

              {/* Jump Circles 3D Shockwave */}
              {isEnabled('jump-circles') && (
                <div
                  className="absolute -bottom-2.5 w-24 h-5 rounded-full border-2"
                  style={{
                    borderColor: activeTheme.primaryHex,
                    boxShadow: `0 0 16px ${activeTheme.primaryHex}`,
                  }}
                />
              )}
            </div>
          </div>

          {/* Draggable Watermark */}
          {isEnabled('watermark') && (
            <div
              onPointerDown={(e) => startDragWidget('watermark', e)}
              style={{
                left: hudPositions.watermark?.x ?? 14,
                top: hudPositions.watermark?.y ?? 14,
              }}
              className="absolute glass-panel rounded-[10px] px-3 py-1.5 flex items-center gap-2 text-[11px] font-mono cursor-move border border-white/15"
            >
              <GripHorizontal size={12} className="text-[var(--text-muted)]" />
              <span className="font-bold" style={{ color: activeTheme.primaryHex }}>
                WINVISUAL 2.7
              </span>
              <span className="text-white/30">|</span>
              <span className="text-[#F5F5F7]">438 FPS</span>
              <span className="text-white/30">|</span>
              <span className="text-emerald-300">9ms</span>
            </div>
          )}

          {/* Draggable Rotating Minimap */}
          {isEnabled('minimap') && (
            <div
              onPointerDown={(e) => startDragWidget('minimap', e)}
              style={{
                left: hudPositions.minimap?.x ?? 14,
                top: hudPositions.minimap?.y ?? 50,
              }}
              className="absolute glass-panel rounded-[12px] p-2 w-[96px] h-[96px] cursor-move border border-white/15 flex flex-col items-center justify-between text-[9px] font-mono"
            >
              <div className="w-full flex items-center justify-between text-white/75">
                <span style={{ color: activeTheme.primaryHex }}>N</span>
                <Compass size={11} style={{ color: activeTheme.primaryHex }} />
              </div>
              <div className="relative w-12 h-12 rounded-full border border-white/15 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span
                  className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: activeTheme.primaryHex }}
                />
                <span className="absolute bottom-3 left-2.5 w-1.5 h-1.5 rounded-full bg-amber-300" />
              </div>
              <span className="text-[8.5px] text-white/60">128, 72, -256</span>
            </div>
          )}

          {/* Draggable Armor HUD */}
          {isEnabled('armor-hud') && (
            <div
              onPointerDown={(e) => startDragWidget('armor-hud', e)}
              style={{
                left: hudPositions['armor-hud']?.x ?? 320,
                top: hudPositions['armor-hud']?.y ?? 18,
              }}
              className="absolute glass-panel rounded-[10px] px-3 py-1.5 flex items-center gap-2.5 text-[11px] font-mono cursor-move border border-white/15"
            >
              <Shield size={13} style={{ color: activeTheme.primaryHex }} />
              <span>100%</span>
              <span className="text-emerald-400">Netherite IV</span>
            </div>
          )}

          {/* Draggable Keystrokes */}
          {isEnabled('keystrokes') && (
            <div
              onPointerDown={(e) => startDragWidget('keystrokes', e)}
              style={{
                left: hudPositions.keystrokes?.x ?? 18,
                top: hudPositions.keystrokes?.y ?? 170,
              }}
              className="absolute cursor-move space-y-1 font-mono text-[11px]"
            >
              <div className="flex justify-center">
                <div className="w-8 h-7 rounded-[8px] glass-panel flex items-center justify-center font-semibold">
                  W
                </div>
              </div>
              <div className="flex gap-1">
                <div className="w-8 h-7 rounded-[8px] glass-panel flex items-center justify-center font-semibold">
                  A
                </div>
                <div
                  className="w-8 h-7 rounded-[8px] flex items-center justify-center font-semibold border"
                  style={{
                    borderColor: activeTheme.primaryHex,
                    color: activeTheme.primaryHex,
                    backgroundColor: `${activeTheme.primaryHex}22`,
                  }}
                >
                  S
                </div>
                <div className="w-8 h-7 rounded-[8px] glass-panel flex items-center justify-center font-semibold">
                  D
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[9.5px] text-[var(--text-secondary)]">
                <div className="h-5 rounded-[8px] glass-panel flex items-center justify-center">
                  12 CPS
                </div>
                <div className="h-5 rounded-[8px] glass-panel flex items-center justify-center">
                  4 CPS
                </div>
              </div>
            </div>
          )}

          {/* Draggable Target HUD 2.0 */}
          {isEnabled('target-hud') && (
            <div
              onPointerDown={(e) => startDragWidget('target-hud', e)}
              style={{
                left: hudPositions['target-hud']?.x ?? 270,
                top: hudPositions['target-hud']?.y ?? 225,
              }}
              className="absolute glass-panel rounded-[12px] p-2.5 w-[196px] cursor-move border border-white/15 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#F5F5F7]">user84910</span>
                <span className="font-mono text-[10px] text-emerald-400">WIN • 19.2 HP</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '86%',
                    background: `linear-gradient(90deg, ${activeTheme.primaryHex}, ${activeTheme.secondaryHex})`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Custom Vector Crosshair */}
          {isEnabled('crosshair') && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                {crosshair.centerDot && (
                  <span
                    style={{
                      width: crosshair.thickness + 1,
                      height: crosshair.thickness + 1,
                      backgroundColor: crossColor,
                    }}
                    className="block rounded-full"
                  />
                )}
                <span
                  style={{
                    width: crosshair.thickness,
                    height: crosshair.size,
                    bottom: crosshair.gap,
                    backgroundColor: crossColor,
                  }}
                  className="absolute"
                />
                <span
                  style={{
                    width: crosshair.thickness,
                    height: crosshair.size,
                    top: crosshair.gap,
                    backgroundColor: crossColor,
                  }}
                  className="absolute"
                />
                <span
                  style={{
                    height: crosshair.thickness,
                    width: crosshair.size,
                    right: crosshair.gap,
                    backgroundColor: crossColor,
                  }}
                  className="absolute"
                />
                <span
                  style={{
                    height: crosshair.thickness,
                    width: crosshair.size,
                    left: crosshair.gap,
                    backgroundColor: crossColor,
                  }}
                  className="absolute"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Side Panel: Presets + Vector Crosshair Controls */}
        <Card className="lg:col-span-4 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Crosshair size={16} strokeWidth={1.75} style={{ color: activeTheme.primaryHex }} />
              <h2 className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                {isRu ? 'Векторный прицел и профили' : 'Crosshair & Profiles'}
              </h2>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[12px] text-[var(--text-secondary)]">
                <span>{isRu ? 'Зазор (Gap)' : 'Center Gap'}</span>
                <span className="font-mono">{crosshair.gap}px</span>
              </div>
              <Slider
                value={crosshair.gap}
                min={1}
                max={14}
                onValueChange={(v) => updateCrosshair('gap', v)}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[12px] text-[var(--text-secondary)]">
                <span>{isRu ? 'Длина линий' : 'Arm Size'}</span>
                <span className="font-mono">{crosshair.size}px</span>
              </div>
              <Slider
                value={crosshair.size}
                min={3}
                max={16}
                onValueChange={(v) => updateCrosshair('size', v)}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[12px] text-[var(--text-secondary)]">
                <span>{isRu ? 'Толщина' : 'Thickness'}</span>
                <span className="font-mono">{crosshair.thickness}px</span>
              </div>
              <Slider
                value={crosshair.thickness}
                min={1}
                max={4}
                onValueChange={(v) => updateCrosshair('thickness', v)}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/[0.08]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {isRu ? 'Готовые сборки модулей' : 'Instant Profiles'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'winvisual-esp', ru: 'WinVisual + ESP', en: 'WinVisual + ESP' },
                  { id: 'competitive', ru: 'PvP Турнир', en: 'Competitive' },
                  { id: 'cinematic', ru: 'Кинематик', en: 'Cinematic' },
                  { id: 'pure-fps', ru: 'Макс. FPS', en: 'Pure FPS' },
                ] as { id: PresetProfileId; ru: string; en: string }[]
              ).map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  size="sm"
                  className="justify-center text-[11.5px]"
                  onClick={() => applyPresetProfile(p.id)}
                >
                  <Sparkles size={12} strokeWidth={1.8} />
                  {isRu ? p.ru : p.en}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SegmentedControl<FilterTab>
          layoutGroupId="modules-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: isRu ? `Все (${modules.length})` : `All (${modules.length})` },
            { value: 'esp', label: 'ESP (7)' },
            { value: 'hud', label: 'HUD 2.0 (11)' },
            { value: 'render', label: isRu ? 'Мир & Частицы (7)' : 'World & FX (7)' },
            { value: 'cosmetics', label: isRu ? '3D Косметика (5)' : '3D Cosmetics (5)' },
          ]}
        />
      </div>

      {/* WinVisual Expandable Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {visibleModules.map((mod) => {
          const isExpanded = Boolean(expandedIds[mod.id]);
          const isListeningKey = bindingId === mod.id;

          return (
            <Card
              key={mod.id}
              className={`p-4 transition-all ${
                mod.enabled
                  ? 'border-white/[0.15] bg-white/[0.045]'
                  : 'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                      {mod.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setBindingId(isListeningKey ? null : mod.id)}
                      className={`px-2 py-0.5 rounded-[8px] font-mono text-[10.5px] border transition-colors cursor-pointer ${
                        isListeningKey
                          ? 'bg-[var(--accent-primary)] text-[#090A10] border-white font-bold'
                          : 'bg-white/[0.05] text-[var(--text-secondary)] border-white/[0.1] hover:text-white'
                      }`}
                      title={isRu ? 'Нажмите для смены клавиши' : 'Click to rebind key'}
                    >
                      {isListeningKey ? '...' : `[${mod.keybind}]`}
                    </button>
                    <span className="px-2 py-0.5 rounded-[8px] bg-white/[0.04] text-[10px] font-mono uppercase text-[var(--text-muted)]">
                      {mod.modes[mod.modeIndex] ?? mod.modes[0]}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    {isRu ? mod.descriptionRu : mod.descriptionEn}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIds((prev) => ({ ...prev, [mod.id]: !prev[mod.id] }))
                    }
                    className="w-7 h-7 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                    aria-label={isRu ? 'Настройки модуля' : 'Module settings'}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <Toggle checked={mod.enabled} onCheckedChange={() => toggleModule(mod.id)} />
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3.5 pt-3.5 border-t border-white/[0.08] space-y-3">
                  {/* Mode Selector */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {isRu ? 'Режим:' : 'Mode:'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {mod.modes.map((mLabel, idx) => (
                        <button
                          key={mLabel}
                          type="button"
                          onClick={() => setModuleMode(mod.id, idx)}
                          className={`px-2.5 py-1 rounded-[8px] text-[11px] font-medium transition-colors cursor-pointer border ${
                            mod.modeIndex === idx
                              ? 'text-white border-white/30 bg-white/[0.12]'
                              : 'text-[var(--text-secondary)] border-white/[0.07] bg-white/[0.03] hover:text-white'
                          }`}
                        >
                          {mLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Intensity Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)]">
                      <span>{isRu ? 'Интенсивность / Масштаб' : 'Intensity / Scale'}</span>
                      <span>{mod.amount}%</span>
                    </div>
                    <Slider
                      value={mod.amount}
                      min={5}
                      max={100}
                      onValueChange={(v) => setModuleAmount(mod.id, v)}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Import Preset Modal */}
      <Modal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title={isRu ? 'Импорт пресета WinVisual' : 'Import WinVisual Preset'}
      >
        <form onSubmit={handleApplyImport} className="space-y-4">
          <input
            type="text"
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            placeholder="WINVISUAL-eyJ2IjozLC..."
            className="w-full h-10 px-3.5 rounded-[12px] bg-white/[0.05] border border-white/[0.12] text-[13px] font-mono text-white focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setImportModalOpen(false)}
            >
              {isRu ? 'Отмена' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {isRu ? 'Применить пресет' : 'Apply Preset'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};
