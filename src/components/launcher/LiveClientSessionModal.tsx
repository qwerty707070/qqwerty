import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Compass,
  LogOut,
  Music2,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  EVO_THEMES,
  useVisualClientStore,
  type EvoThemeId,
  type VisualModuleCategory,
} from '../../stores/visualClientStore';
import { useLauncherStore } from '../../stores/launcherStore';
import { useAccountStore } from '../../stores/accountStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Toggle } from '../ui/Toggle';
import { Button } from '../ui/Button';

interface SparkParticle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export const LiveClientSessionModal: React.FC = () => {
  const open = useVisualClientStore((s) => s.liveSessionModalOpen);
  const setOpen = useVisualClientStore((s) => s.setLiveSessionModalOpen);
  const { modules, themeId, crosshair, toggleModule, setModuleMode, setThemeId } =
    useVisualClientStore();
  const stopRunningSession = useLauncherStore((s) => s.stopRunningSession);
  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const { accounts, activeAccountId } = useAccountStore();
  const language = useSettingsStore((s) => s.language);

  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});
  const [clickGuiOpen, setClickGuiOpen] = useState(false);
  const [guiTab, setGuiTab] = useState<VisualModuleCategory>('esp');
  const [targetHp, setTargetHp] = useState(20);
  const [hitCombo, setHitCombo] = useState(0);
  const [jumpRipples, setJumpRipples] = useState<number[]>([]);
  const [cpsClicks, setCpsClicks] = useState<number[]>([]);
  const [sparks, setSparks] = useState<SparkParticle[]>([]);

  const isRu = language === 'ru';
  const activeVer = versions.find((v) => v.id === selectedVersionId) ?? versions[0];
  const activeAcc = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  const activeTheme = EVO_THEMES.find((t) => t.id === themeId) ?? EVO_THEMES[0];
  const isModOn = (id: string) => modules.some((m) => m.id === id && m.enabled);
  const espMod = modules.find((m) => m.id === 'player-esp');

  useEffect(() => {
    if (!open) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'ShiftRight') {
        e.preventDefault();
        setClickGuiOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (clickGuiOpen) setClickGuiOpen(false);
        else setOpen(false);
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        const rid = Date.now();
        setJumpRipples((prev) => [...prev.slice(-4), rid]);
        window.setTimeout(() => {
          setJumpRipples((prev) => prev.filter((id) => id !== rid));
        }, 900);
      }
      setPressedKeys((prev) => ({ ...prev, [e.code]: true }));
    };
    const onUp = (e: KeyboardEvent) => {
      setPressedKeys((prev) => ({ ...prev, [e.code]: false }));
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [open, clickGuiOpen, setOpen]);

  const handleViewportAttack = (e: React.MouseEvent<HTMLDivElement>) => {
    if (clickGuiOpen) return;
    const now = Date.now();
    setCpsClicks((prev) => [...prev.filter((t) => now - t < 1000), now]);
    setTargetHp((hp) => (hp <= 2.4 ? 20 : Number((hp - 2.2).toFixed(1))));
    setHitCombo((c) => c + 1);

    if (isModOn('hit-particles')) {
      const rect = e.currentTarget.getBoundingClientRect();
      const originX = e.clientX - rect.left;
      const originY = e.clientY - rect.top;
      const created: SparkParticle[] = Array.from({ length: 10 }).map((_, idx) => {
        const angle = (Math.PI * 2 * idx) / 10 + Math.random() * 0.35;
        return {
          id: now + idx + Math.random(),
          x: originX,
          y: originY,
          dx: Math.cos(angle) * (40 + Math.random() * 34),
          dy: Math.sin(angle) * (40 + Math.random() * 34),
        };
      });
      setSparks((prev) => [...prev.slice(-18), ...created]);
      window.setTimeout(() => {
        setSparks((prev) => prev.filter((p) => !created.some((c) => c.id === p.id)));
      }, 540);
    }
  };

  const liveCps = cpsClicks.filter((t) => Date.now() - t < 1000).length;
  const crossColor = crosshair.accentColor ? activeTheme.primaryHex : '#FFFFFF';
  const activeArrayList = modules
    .filter((m) => m.enabled && m.category !== 'hud')
    .sort((a, b) => b.name.length - a.name.length)
    .slice(0, 9);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleViewportAttack}
            className="relative w-full max-w-[1160px] h-[700px] max-h-[calc(100vh-32px)] rounded-[24px] overflow-hidden border border-white/15 shadow-[0_40px_120px_rgba(0,0,0,0.95)] select-none cursor-crosshair"
          >
            {/* Atmospheric Minecraft Shader World View */}
            <div
              className="ambient-hero-media absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: "url('/images/hero-castle-violet.jpg')",
                filter: isModOn('fullbright') ? 'brightness(1.12)' : 'brightness(0.92)',
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/65" />

            {/* Top Session Bar: Watermark + Media Player + Right-Shift ClickGUI Trigger */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-20 p-4 flex items-center justify-between gap-3 pointer-events-auto"
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                {isModOn('watermark') && (
                  <div className="glass-panel rounded-[12px] px-3.5 py-2 flex items-center gap-2.5 text-[12px] font-mono border border-white/15">
                    <Sparkles size={14} style={{ color: activeTheme.primaryHex }} />
                    <span className="font-bold text-white">WINVISUAL 2.7</span>
                    <span className="text-white/25">|</span>
                    <span className="text-white/90">{activeVer?.name ?? 'Fabric 1.21.11'}</span>
                    <span className="text-white/25">|</span>
                    <span className="text-emerald-300">438 FPS</span>
                    <span className="text-white/25">|</span>
                    <span className="text-[var(--text-secondary)]">{activeAcc.username}</span>
                  </div>
                )}

                {isModOn('media-player') && (
                  <div className="hidden md:flex glass-panel rounded-[12px] px-3.5 py-2 items-center gap-2 text-[11px] font-mono border border-white/15">
                    <Music2 size={13} style={{ color: activeTheme.primaryHex }} />
                    <span className="text-white/85">WinVisual — Nightfall Synth</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setClickGuiOpen((o) => !o)}>
                  <SlidersHorizontal size={14} strokeWidth={1.75} />
                  EvoGUI [Right Shift]
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    stopRunningSession();
                  }}
                >
                  <LogOut size={14} strokeWidth={1.75} />
                  {isRu ? 'Выйти из игры' : 'Quit Client'}
                </Button>
              </div>
            </div>

            {/* Left HUD Stack: Rotating Minimap + Potions HUD */}
            <div className="pointer-events-none absolute top-[68px] left-4 z-20 space-y-2.5">
              {isModOn('minimap') && (
                <div className="glass-panel rounded-[14px] p-2.5 w-[118px] h-[118px] border border-white/15 flex flex-col items-center justify-between font-mono text-[9.5px]">
                  <div className="w-full flex items-center justify-between">
                    <span style={{ color: activeTheme.primaryHex }}>N</span>
                    <Compass size={12} style={{ color: activeTheme.primaryHex }} />
                  </div>
                  <div className="relative w-16 h-16 rounded-full border border-white/15 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span
                      className="absolute top-3 right-3.5 w-2 h-2 rounded-full"
                      style={{ backgroundColor: activeTheme.primaryHex }}
                    />
                    <span className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-amber-300" />
                  </div>
                  <span className="text-[9px] text-white/70">128, 72, -256</span>
                </div>
              )}

              {isModOn('potions-hud') && (
                <div className="glass-panel rounded-[12px] p-2.5 w-[148px] border border-white/15 font-mono text-[10.5px] space-y-1">
                  <p className="text-[9.5px] uppercase text-white/50">Potions</p>
                  <div className="flex justify-between text-white">
                    <span>Speed II</span>
                    <span style={{ color: activeTheme.primaryHex }}>1:24</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>Strength II</span>
                    <span style={{ color: activeTheme.secondaryHex }}>0:48</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right HUD Stack: Active ArrayList */}
            {isModOn('arraylist') && (
              <div className="pointer-events-none absolute top-[68px] right-4 z-20 flex flex-col items-end gap-1 font-mono text-[11px]">
                {activeArrayList.map((m) => (
                  <div
                    key={m.id}
                    className="px-2.5 py-0.5 rounded-[8px] bg-[#0B0D16]/85 border-r-2 text-white"
                    style={{ borderRightColor: activeTheme.primaryHex }}
                  >
                    {m.name}
                  </div>
                ))}
              </div>
            )}

            {/* Simulated Opponent Entity with Live Player ESP + ChinaHat + Wings + Tracer */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
              <div className="relative translate-x-[150px] -translate-y-[8px] w-[112px] h-[196px] flex flex-col items-center">
                {isModOn('nametags') && (
                  <div className="-mt-7 px-2.5 py-0.5 rounded-[8px] bg-[#0B0D16]/90 border border-white/15 text-[10.5px] font-mono flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-white font-semibold">user84910</span>
                    <span className="text-emerald-400">{targetHp} HP</span>
                    <span style={{ color: activeTheme.primaryHex }}>3.4m</span>
                  </div>
                )}

                <div className="relative w-full flex-1 flex items-center justify-center">
                  {isModOn('wings') && (
                    <>
                      <div
                        className="absolute -left-6 top-8 w-8 h-16 rounded-l-[14px] border -rotate-12"
                        style={{
                          borderColor: activeTheme.primaryHex,
                          background: `linear-gradient(135deg, ${activeTheme.primaryHex}55, transparent)`,
                        }}
                      />
                      <div
                        className="absolute -right-6 top-8 w-8 h-16 rounded-r-[14px] border rotate-12"
                        style={{
                          borderColor: activeTheme.secondaryHex,
                          background: `linear-gradient(225deg, ${activeTheme.secondaryHex}55, transparent)`,
                        }}
                      />
                    </>
                  )}

                  {isModOn('china-hat') && (
                    <div
                      className="absolute -top-2 w-16 h-5 rounded-full border"
                      style={{
                        borderColor: activeTheme.primaryHex,
                        background: `radial-gradient(circle, ${activeTheme.secondaryHex}99 0%, ${activeTheme.primaryHex}33 75%)`,
                        boxShadow: `0 0 18px ${activeTheme.primaryHex}`,
                      }}
                    />
                  )}

                  <div className="w-11 h-32 rounded-[10px] bg-white/[0.12] border border-white/20" />

                  {isModOn('player-esp') && (
                    <div
                      className="absolute inset-0"
                      style={{
                        border:
                          (espMod?.modeIndex ?? 0) === 0
                            ? 'none'
                            : `1.5px solid ${activeTheme.primaryHex}`,
                        boxShadow:
                          (espMod?.modeIndex ?? 0) === 2
                            ? `0 0 24px ${activeTheme.primaryHex}77, inset 0 0 16px ${activeTheme.primaryHex}33`
                            : 'none',
                      }}
                    >
                      {(espMod?.modeIndex ?? 0) === 0 && (
                        <>
                          <span
                            className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2"
                            style={{ borderColor: activeTheme.primaryHex }}
                          />
                          <span
                            className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2"
                            style={{ borderColor: activeTheme.primaryHex }}
                          />
                          <span
                            className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2"
                            style={{ borderColor: activeTheme.secondaryHex }}
                          />
                          <span
                            className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2"
                            style={{ borderColor: activeTheme.secondaryHex }}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {isModOn('health-bar') && (
                    <div className="absolute -left-3 inset-y-0 w-1.5 rounded-full bg-black/75 overflow-hidden flex items-end">
                      <div
                        className="w-full bg-emerald-400 transition-all duration-150"
                        style={{ height: `${(targetHp / 20) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Expanding 3D Jump Circles when pressing Space */}
            {isModOn('jump-circles') &&
              jumpRipples.map((rid) => (
                <motion.div
                  key={rid}
                  initial={{ scale: 0.35, opacity: 0.95 }}
                  animate={{ scale: 2.3, opacity: 0 }}
                  transition={{ duration: 0.85, ease: 'easeOut' }}
                  style={{
                    borderColor: activeTheme.primaryHex,
                    boxShadow: `0 0 24px ${activeTheme.primaryHex}`,
                  }}
                  className="pointer-events-none absolute left-1/2 bottom-20 -translate-x-1/2 w-40 h-10 rounded-full border-2 z-10"
                />
              ))}

            {/* Hit Particles Burst Layer */}
            {sparks.map((sp) => (
              <motion.span
                key={sp.id}
                initial={{ x: sp.x, y: sp.y, scale: 1, opacity: 1 }}
                animate={{ x: sp.x + sp.dx, y: sp.y + sp.dy, scale: 0.2, opacity: 0 }}
                transition={{ duration: 0.48, ease: 'easeOut' }}
                style={{
                  backgroundColor: activeTheme.primaryHex,
                  boxShadow: `0 0 14px ${activeTheme.primaryHex}`,
                }}
                className="pointer-events-none absolute left-0 top-0 w-2.5 h-2.5 rounded-full z-20"
              />
            ))}

            {/* Center Vector Crosshair + Combo Readout */}
            {isModOn('crosshair') && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
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
                  {hitCombo > 1 && (
                    <span
                      style={{ color: activeTheme.primaryHex }}
                      className="absolute top-6 whitespace-nowrap text-[11px] font-mono font-bold"
                    >
                      {hitCombo}x COMBO
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Live WASD Keystrokes Bottom-Left */}
            {isModOn('keystrokes') && (
              <div className="pointer-events-none absolute bottom-6 left-6 z-20 space-y-1.5 font-mono text-[12px]">
                <div className="flex justify-center">
                  <div
                    className={`w-10 h-9 rounded-[8px] flex items-center justify-center font-semibold border transition-colors ${
                      pressedKeys.KeyW
                        ? 'text-[#090A10] border-white/50'
                        : 'glass-panel text-white border-white/10'
                    }`}
                    style={pressedKeys.KeyW ? { backgroundColor: activeTheme.primaryHex } : undefined}
                  >
                    W
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {(['KeyA', 'KeyS', 'KeyD'] as const).map((code) => (
                    <div
                      key={code}
                      className={`w-10 h-9 rounded-[8px] flex items-center justify-center font-semibold border transition-colors ${
                        pressedKeys[code]
                          ? 'text-[#090A10] border-white/50'
                          : 'glass-panel text-white border-white/10'
                      }`}
                      style={
                        pressedKeys[code] ? { backgroundColor: activeTheme.primaryHex } : undefined
                      }
                    >
                      {code.replace('Key', '')}
                    </div>
                  ))}
                </div>
                <div
                  className="glass-panel rounded-[8px] py-1.5 text-center text-[11px]"
                  style={{ color: activeTheme.primaryHex }}
                >
                  LMB: {liveCps} CPS
                </div>
              </div>
            )}

            {/* Center-Bottom Target HUD + Armor Bar */}
            <div className="pointer-events-none absolute bottom-6 inset-x-0 flex flex-col items-center gap-2.5 z-20">
              {isModOn('target-hud') && (
                <div className="glass-panel rounded-[14px] px-4 py-2.5 w-[248px] space-y-1.5 border border-white/15">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-white">user84910</span>
                    <span className="font-mono text-emerald-400">WIN • {targetHp} HP</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-150"
                      style={{
                        width: `${(targetHp / 20) * 100}%`,
                        background: `linear-gradient(90deg, ${activeTheme.primaryHex}, ${activeTheme.secondaryHex})`,
                      }}
                    />
                  </div>
                </div>
              )}

              {isModOn('armor-hud') && (
                <div className="glass-panel rounded-[10px] px-4 py-1.5 flex items-center gap-3 text-[11.5px] font-mono">
                  <Shield size={14} style={{ color: activeTheme.primaryHex }} />
                  <span>Helmet 100%</span>
                  <span className="text-white/25">•</span>
                  <span>Chestplate 100%</span>
                  <span className="text-white/25">•</span>
                  <span className="text-white/60">
                    {isRu ? 'Клик ЛКМ / Space / WASD / Right Shift' : 'Click LMB / Space / WASD / Right Shift'}
                  </span>
                </div>
              )}
            </div>

            {/* Right-Shift In-Game EvoVisual ClickGUI Overlay */}
            <AnimatePresence>
              {clickGuiOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto"
                >
                  <div className="w-full max-w-[680px] glass-panel rounded-[20px] p-5 space-y-4 border border-white/15">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-primary)] pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[15px] font-bold tracking-tight"
                          style={{ color: activeTheme.primaryHex }}
                        >
                          WINVISUAL × EVOVISUAL
                        </span>
                        {(
                          [
                            { id: 'esp', label: 'ESP' },
                            { id: 'hud', label: 'HUD 2.0' },
                            { id: 'render', label: isRu ? 'Мир' : 'Render' },
                            { id: 'cosmetics', label: isRu ? '3D Косметика' : 'Cosmetics' },
                          ] as { id: VisualModuleCategory; label: string }[]
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setGuiTab(t.id)}
                            className={`px-3 py-1 rounded-[8px] text-[11.5px] font-semibold cursor-pointer transition-colors ${
                              guiTab === t.id
                                ? 'bg-white/15 text-white'
                                : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {EVO_THEMES.map((th) => (
                          <button
                            key={th.id}
                            type="button"
                            onClick={() => setThemeId(th.id as EvoThemeId)}
                            className={`w-5 h-5 rounded-full cursor-pointer border ${
                              th.id === themeId ? 'border-white scale-110' : 'border-white/20'
                            }`}
                            style={{ backgroundColor: th.primaryHex }}
                            title={th.name}
                          />
                        ))}
                        <Button variant="secondary" size="sm" onClick={() => setClickGuiOpen(false)}>
                          ESC
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {modules
                        .filter((m) => m.category === guiTab)
                        .map((m) => (
                          <div
                            key={m.id}
                            className="rounded-[12px] bg-white/[0.04] border border-white/[0.09] px-3.5 py-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-white truncate">{m.name}</p>
                              <button
                                type="button"
                                onClick={() =>
                                  setModuleMode(m.id, (m.modeIndex + 1) % m.modes.length)
                                }
                                className="text-[10.5px] font-mono text-[var(--text-secondary)] hover:text-white cursor-pointer"
                              >
                                [{m.keybind}] • {m.modes[m.modeIndex]} ↻
                              </button>
                            </div>
                            <Toggle checked={m.enabled} onCheckedChange={() => toggleModule(m.id)} />
                          </div>
                        ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
