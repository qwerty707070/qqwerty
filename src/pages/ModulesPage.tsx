import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Crosshair,
  Download,
  GripHorizontal,
  HardDrive,
  MonitorPlay,
  RotateCcw,
  Share2,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useVisualClientStore } from '../stores/visualClientStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { Card } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { Slider } from '../components/ui/Slider';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

type FilterTab = 'all' | 'hud' | 'render' | 'cosmetics';

export const ModulesPage: React.FC = () => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const {
    modules,
    crosshair,
    hudPositions,
    lastDiskSyncAt,
    toggleModule,
    updateCrosshair,
    setHudPosition,
    resetHudPositions,
    exportPresetCode,
    importPresetCode,
    persistHudConfigToDisk,
    setLiveSessionModalOpen,
  } = useVisualClientStore();
  const language = useSettingsStore((s) => s.language);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const isRu = language === 'ru';

  const visibleModules =
    filter === 'all' ? modules : modules.filter((m) => m.category === filter);

  const isEnabled = (id: string) => modules.some((m) => m.id === id && m.enabled);

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
      title: isRu ? 'Код пресета скопирован' : 'HUD Preset Code Copied',
      description: `${code.slice(0, 34)}…`,
    });
  };

  const handleSaveDisk = async () => {
    const path = await persistHudConfigToDisk();
    pushToast({
      type: 'success',
      title: isRu ? 'Сохранено в winvisual-hud.json' : 'Saved to winvisual-hud.json',
      description: path ?? '~/.minecraft/winvisual/config/winvisual-hud.json',
    });
  };

  const handleApplyImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (importPresetCode(importInput)) {
      setImportInput('');
      setImportModalOpen(false);
      pushToast({
        type: 'success',
        title: isRu ? 'Пресет HUD успешно применён' : 'Preset imported successfully',
      });
    } else {
      pushToast({
        type: 'error',
        title: isRu ? 'Неверный формат кода WINVISUAL-...' : 'Invalid WINVISUAL-... preset code',
      });
    }
  };

  const crossColor = crosshair.accentColor ? 'var(--accent-secondary)' : '#FFFFFF';

  return (
    <motion.div
      key="page-modules"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="p-7 space-y-6 max-w-[1040px] pb-12"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
            {isRu ? 'Визуальные модули и редактор HUD 2.0' : 'Visual Modules & HUD 2.0 Studio'}
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
            {isRu
              ? 'Перетаскивайте виджеты на сцене — координаты автоматически пишутся в config/winvisual-hud.json.'
              : 'Drag HUD widgets across the live viewport — coordinates sync directly to config/winvisual-hud.json.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleSaveDisk}>
            <HardDrive size={14} strokeWidth={1.75} />
            {lastDiskSyncAt
              ? `HUD • ${lastDiskSyncAt}`
              : isRu
                ? 'Сохранить HUD'
                : 'Flush Disk'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPreset}>
            <Share2 size={14} strokeWidth={1.75} />
            {isRu ? 'Экспорт кода' : 'Export Code'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(true)}>
            <Download size={14} strokeWidth={1.75} />
            {isRu ? 'Импорт' : 'Import'}
          </Button>
          <Button variant="secondary" size="sm" onClick={resetHudPositions}>
            <RotateCcw size={14} strokeWidth={1.75} />
            {isRu ? 'Сброс сетки' : 'Reset'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setLiveSessionModalOpen(true)}>
            <MonitorPlay size={14} strokeWidth={1.75} />
            {isRu ? 'Тест в игре' : 'Live Test'}
          </Button>
        </div>
      </div>

      {/* Live Interactive Draggable HUD + Custom Crosshair Preview Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          ref={stageRef}
          className="lg:col-span-8 relative h-[290px] rounded-[20px] overflow-hidden border border-white/[0.09] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)] select-none"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/images/hero-castle-violet.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/25" />

          {isEnabled('watermark') && (
            <div
              onPointerDown={(e) => startDragWidget('watermark', e)}
              style={{
                left: hudPositions.watermark?.x ?? 18,
                top: hudPositions.watermark?.y ?? 18,
              }}
              className="absolute glass-panel rounded-[10px] px-3 py-1.5 flex items-center gap-2 text-[11.5px] font-mono cursor-move border border-white/15"
            >
              <GripHorizontal size={12} className="text-[var(--text-muted)]" />
              <span className="font-semibold text-[var(--accent-secondary)]">WINVISUAL 2.6</span>
              <span className="text-white/30">|</span>
              <span className="text-[#F5F5F7]">412 FPS</span>
              <span className="text-white/30">|</span>
              <span className="text-emerald-300">9ms</span>
            </div>
          )}

          {isEnabled('armor-hud') && (
            <div
              onPointerDown={(e) => startDragWidget('armor-hud', e)}
              style={{
                left: hudPositions['armor-hud']?.x ?? 320,
                top: hudPositions['armor-hud']?.y ?? 18,
              }}
              className="absolute glass-panel rounded-[10px] px-3 py-1.5 flex items-center gap-2.5 text-[11px] font-mono cursor-move border border-white/15"
            >
              <Shield size={13} className="text-[var(--accent-secondary)]" />
              <span>100%</span>
              <span className="text-emerald-400">Netherite IV</span>
            </div>
          )}

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
                <div className="w-8 h-7 rounded-[7px] glass-panel flex items-center justify-center font-semibold">
                  W
                </div>
              </div>
              <div className="flex gap-1">
                <div className="w-8 h-7 rounded-[7px] glass-panel flex items-center justify-center font-semibold">
                  A
                </div>
                <div className="w-8 h-7 rounded-[7px] bg-[var(--accent-subtle)] border border-[var(--accent-primary)]/50 text-[var(--accent-secondary)] flex items-center justify-center font-semibold">
                  S
                </div>
                <div className="w-8 h-7 rounded-[7px] glass-panel flex items-center justify-center font-semibold">
                  D
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[9.5px] text-[var(--text-secondary)]">
                <div className="h-5 rounded-[6px] glass-panel flex items-center justify-center">
                  11 CPS
                </div>
                <div className="h-5 rounded-[6px] glass-panel flex items-center justify-center">
                  4 CPS
                </div>
              </div>
            </div>
          )}

          {isEnabled('target-hud') && (
            <div
              onPointerDown={(e) => startDragWidget('target-hud', e)}
              style={{
                left: hudPositions['target-hud']?.x ?? 320,
                top: hudPositions['target-hud']?.y ?? 205,
              }}
              className="absolute glass-panel rounded-[12px] p-2.5 w-[188px] cursor-move border border-white/15 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-semibold text-[#F5F5F7]">user74920</span>
                <span className="font-mono text-[10.5px] text-[var(--accent-secondary)]">
                  18.4 HP • 2.7m
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]" />
              </div>
            </div>
          )}

          {/* Live Vector Crosshair */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              {crosshair.centerDot && (
                <span
                  style={{
                    width: crosshair.thickness + 1,
                    height: crosshair.thickness + 1,
                    backgroundColor: crossColor,
                    boxShadow: crosshair.outline ? '0 0 0 1px rgba(0,0,0,0.85)' : 'none',
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
                  boxShadow: crosshair.outline ? '0 0 0 1px rgba(0,0,0,0.85)' : 'none',
                }}
                className="absolute"
              />
              <span
                style={{
                  width: crosshair.thickness,
                  height: crosshair.size,
                  top: crosshair.gap,
                  backgroundColor: crossColor,
                  boxShadow: crosshair.outline ? '0 0 0 1px rgba(0,0,0,0.85)' : 'none',
                }}
                className="absolute"
              />
              <span
                style={{
                  height: crosshair.thickness,
                  width: crosshair.size,
                  right: crosshair.gap,
                  backgroundColor: crossColor,
                  boxShadow: crosshair.outline ? '0 0 0 1px rgba(0,0,0,0.85)' : 'none',
                }}
                className="absolute"
              />
              <span
                style={{
                  height: crosshair.thickness,
                  width: crosshair.size,
                  left: crosshair.gap,
                  backgroundColor: crossColor,
                  boxShadow: crosshair.outline ? '0 0 0 1px rgba(0,0,0,0.85)' : 'none',
                }}
                className="absolute"
              />
            </div>
          </div>

          {draggingId && (
            <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-[var(--accent-primary)]/45 rounded-[20px]" />
          )}
        </div>

        {/* Right Column: Live Crosshair Designer */}
        <Card className="lg:col-span-4 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Crosshair size={16} strokeWidth={1.75} className="text-[var(--accent-secondary)]" />
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                {isRu ? 'Конструктор прицела' : 'Vector Crosshair'}
              </h2>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">{isRu ? 'Длина линий' : 'Length'}</span>
                  <span className="font-mono">{crosshair.size}px</span>
                </div>
                <Slider
                  value={crosshair.size}
                  min={3}
                  max={16}
                  onValueChange={(v) => updateCrosshair('size', v)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">{isRu ? 'Отступ от центра' : 'Gap'}</span>
                  <span className="font-mono">{crosshair.gap}px</span>
                </div>
                <Slider
                  value={crosshair.gap}
                  min={1}
                  max={12}
                  onValueChange={(v) => updateCrosshair('gap', v)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">{isRu ? 'Толщина' : 'Thickness'}</span>
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
          </div>

          <div className="space-y-2.5 pt-3 border-t border-[var(--border-primary)] text-[12.5px]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">{isRu ? 'Точка в центре' : 'Center Dot'}</span>
              <Toggle
                checked={crosshair.centerDot}
                onCheckedChange={(v) => updateCrosshair('centerDot', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">{isRu ? 'Акцентный цвет' : 'Accent Tint'}</span>
              <Toggle
                checked={crosshair.accentColor}
                onCheckedChange={(v) => updateCrosshair('accentColor', v)}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Category Filter + Modules Grid */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <SegmentedControl<FilterTab>
          layoutGroupId="modules-filter-seg"
          value={filter}
          options={[
            { value: 'all', label: isRu ? 'Все модули (10)' : 'All Modules (10)' },
            { value: 'hud', label: 'HUD 2.0' },
            { value: 'render', label: 'GLSL Render' },
            { value: 'cosmetics', label: isRu ? 'Косметика' : 'Cosmetics' },
          ]}
          onChange={setFilter}
        />
        <span className="text-[12px] text-[var(--text-muted)] inline-flex items-center gap-1.5">
          <Sparkles size={13.5} className="text-[var(--accent-secondary)]" />
          {isRu ? 'В игре меню открывается на Right Shift' : 'Open in-game overlay anytime with Right Shift'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {visibleModules.map((mod) => (
          <Card
            key={mod.id}
            interactive
            selected={mod.enabled}
            onClick={() => toggleModule(mod.id)}
            className="p-4 flex items-center justify-between gap-4 cursor-pointer"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[14.5px] font-semibold text-[var(--text-primary)] truncate">
                  {mod.name}
                </h3>
                <span className="px-2 py-0.5 rounded-[6px] bg-white/[0.05] border border-white/[0.07] font-mono text-[10px] text-[var(--text-muted)]">
                  {mod.keybind}
                </span>
              </div>
              <p className="text-[12.5px] text-[var(--text-secondary)] leading-snug">
                {isRu ? mod.descriptionRu : mod.descriptionEn}
              </p>
            </div>

            <div onClick={(e) => e.stopPropagation()}>
              <Toggle checked={mod.enabled} onCheckedChange={() => toggleModule(mod.id)} />
            </div>
          </Card>
        ))}
      </div>

      {/* Import Preset Code Modal */}
      <Modal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title={isRu ? 'Импорт пресета HUD и прицела' : 'Import HUD & Crosshair Preset'}
        description={
          isRu
            ? 'Вставьте код конфигурации формата WINVISUAL-... для мгновенного восстановления раскладки.'
            : 'Paste an WINVISUAL-... configuration code to restore widget coordinates, crosshair, and modules.'
        }
      >
        <form onSubmit={handleApplyImport} className="space-y-4">
          <textarea
            rows={3}
            required
            placeholder="WINVISUAL-eyJ2IjoyLC..."
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            className="w-full p-3 rounded-[10px] bg-[var(--background-secondary)] border border-[var(--border-primary)] focus:border-[var(--accent-primary)] font-mono text-[12px] text-[var(--text-primary)] outline-none resize-none"
          />
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setImportModalOpen(false)}>
              {isRu ? 'Отмена' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary">
              {isRu ? 'Применить пресет' : 'Apply Preset'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};
