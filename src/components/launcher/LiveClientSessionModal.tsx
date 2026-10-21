import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Shield, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useVisualClientStore } from '../../stores/visualClientStore';
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
  const { modules, crosshair, toggleModule } = useVisualClientStore();
  const stopRunningSession = useLauncherStore((s) => s.stopRunningSession);
  const versions = useLauncherStore((s) => s.versions);
  const selectedVersionId = useLauncherStore((s) => s.selectedVersionId);
  const { accounts, activeAccountId } = useAccountStore();
  const language = useSettingsStore((s) => s.language);

  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});
  const [clickGuiOpen, setClickGuiOpen] = useState(false);
  const [targetHp, setTargetHp] = useState(20);
  const [cpsClicks, setCpsClicks] = useState<number[]>([]);
  const [sparks, setSparks] = useState<SparkParticle[]>([]);

  const isRu = language === 'ru';
  const activeVer = versions.find((v) => v.id === selectedVersionId) ?? versions[0];
  const activeAcc = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  const isModOn = (id: string) => modules.some((m) => m.id === id && m.enabled);

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
    setTargetHp((hp) => (hp <= 2 ? 20 : Number((hp - 2.4).toFixed(1))));

    if (isModOn('hit-particles')) {
      const rect = e.currentTarget.getBoundingClientRect();
      const originX = e.clientX - rect.left;
      const originY = e.clientY - rect.top;
      const created: SparkParticle[] = Array.from({ length: 8 }).map((_, idx) => {
        const angle = (Math.PI * 2 * idx) / 8 + Math.random() * 0.4;
        return {
          id: now + idx + Math.random(),
          x: originX,
          y: originY,
          dx: Math.cos(angle) * (34 + Math.random() * 28),
          dy: Math.sin(angle) * (34 + Math.random() * 28),
        };
      });
      setSparks((prev) => [...prev.slice(-16), ...created]);
      window.setTimeout(() => {
        setSparks((prev) => prev.filter((p) => !created.some((c) => c.id === p.id)));
      }, 520);
    }
  };

  const liveCps = cpsClicks.filter((t) => Date.now() - t < 1000).length;
  const crossColor = crosshair.accentColor ? 'var(--accent-secondary)' : '#FFFFFF';

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
            className="relative w-full max-w-[1160px] h-[700px] max-h-[calc(100vh-32px)] rounded-[22px] overflow-hidden border border-white/15 shadow-[0_40px_120px_rgba(0,0,0,0.95)] select-none cursor-crosshair"
          >
            {/* Atmospheric Minecraft Shader World View */}
            <div
              className="ambient-hero-media absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/65" />

            {/* Top Session Bar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-20 p-4 flex items-center justify-between gap-3 pointer-events-auto"
            >
              {isModOn('watermark') ? (
                <div className="glass-panel rounded-[12px] px-3.5 py-2 flex items-center gap-2.5 text-[12px] font-mono">
                  <Sparkles size={14} className="text-[var(--accent-secondary)]" />
                  <span className="font-semibold text-[var(--text-primary)]">
                    {activeVer?.name ?? 'Aether Visual 2.4.0'}
                  </span>
                  <span className="text-white/25">|</span>
                  <span className="text-emerald-300">438 FPS</span>
                  <span className="text-white/25">|</span>
                  <span className="text-[var(--text-secondary)]">{activeAcc.username}</span>
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setClickGuiOpen((o) => !o)}
                >
                  <SlidersHorizontal size={14} strokeWidth={1.75} />
                  ClickGUI [Right Shift]
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

            {/* Hit Particles Burst Layer */}
            {sparks.map((sp) => (
              <motion.span
                key={sp.id}
                initial={{ x: sp.x, y: sp.y, scale: 1, opacity: 1 }}
                animate={{ x: sp.x + sp.dx, y: sp.y + sp.dy, scale: 0.2, opacity: 0 }}
                transition={{ duration: 0.48, ease: 'easeOut' }}
                className="pointer-events-none absolute left-0 top-0 w-2.5 h-2.5 rounded-full bg-[var(--accent-secondary)] shadow-[0_0_12px_var(--accent-primary)] z-20"
              />
            ))}

            {/* Center Vector Crosshair */}
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
              </div>
            </div>

            {/* Interactive Live WASD Keystrokes Bottom-Left */}
            {isModOn('keystrokes') && (
              <div className="pointer-events-none absolute bottom-6 left-6 z-20 space-y-1.5 font-mono text-[12px]">
                <div className="flex justify-center">
                  <div
                    className={`w-10 h-9 rounded-[8px] flex items-center justify-center font-semibold border transition-colors ${
                      pressedKeys.KeyW
                        ? 'bg-[var(--accent-primary)] text-[#090A10] border-white/40'
                        : 'glass-panel text-white border-white/10'
                    }`}
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
                          ? 'bg-[var(--accent-primary)] text-[#090A10] border-white/40'
                          : 'glass-panel text-white border-white/10'
                      }`}
                    >
                      {code.replace('Key', '')}
                    </div>
                  ))}
                </div>
                <div className="glass-panel rounded-[8px] py-1.5 text-center text-[11px] text-[var(--accent-secondary)]">
                  LMB: {liveCps} CPS
                </div>
              </div>
            )}

            {/* Center-Bottom Target HUD + Armor Bar */}
            <div className="pointer-events-none absolute bottom-6 inset-x-0 flex flex-col items-center gap-2.5 z-20">
              {isModOn('target-hud') && (
                <div className="glass-panel rounded-[14px] px-4 py-2.5 w-[240px] space-y-1.5 border border-white/15">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-white">Target Dummy</span>
                    <span className="font-mono text-[var(--accent-secondary)]">{targetHp} HP</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] transition-all duration-150"
                      style={{ width: `${(targetHp / 20) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {isModOn('armor-hud') && (
                <div className="glass-panel rounded-[10px] px-4 py-1.5 flex items-center gap-3 text-[11.5px] font-mono">
                  <Shield size={14} className="text-[var(--accent-secondary)]" />
                  <span>Helmet 100%</span>
                  <span className="text-white/25">•</span>
                  <span>Chestplate 100%</span>
                  <span className="text-white/25">•</span>
                  <span className="text-white/60">
                    {isRu ? 'Кликайте ЛКМ и нажимайте WASD' : 'Click LMB & press WASD'}
                  </span>
                </div>
              )}
            </div>

            {/* Right-Shift In-Game ClickGUI Overlay */}
            <AnimatePresence>
              {clickGuiOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 z-30 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto"
                >
                  <div className="w-full max-w-[560px] glass-panel rounded-[20px] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
                      <div>
                        <h3 className="text-[16px] font-semibold text-white">
                          Aether Visual — In-Game ClickGUI
                        </h3>
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          {isRu
                            ? 'Включайте и отключайте модули прямо во время сессии'
                            : 'Toggle client visual modules live inside session'}
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setClickGuiOpen(false)}>
                        ESC
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {modules.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-[12px] bg-white/[0.03] border border-white/[0.07] px-3.5 py-2.5 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="text-[13px] font-medium text-white">{m.name}</p>
                            <p className="text-[10.5px] font-mono text-[var(--text-muted)]">
                              Keybind: {m.keybind}
                            </p>
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
