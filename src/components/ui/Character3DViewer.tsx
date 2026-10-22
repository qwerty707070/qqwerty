import React, { useEffect, useRef, useState } from 'react';
import type { PlayerAccount } from '../../types/launcher';
import type { ShaderCapeId } from '../../stores/visualClientStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface Character3DViewerProps {
  skinPreset: PlayerAccount['skinPreset'];
  cape: ShaderCapeId;
  showHalo?: boolean;
  /** Frameless transparent mode with glowing double floor aura ring for the Home Hero banner */
  heroStage?: boolean;
  className?: string;
}

const CAPE_PALETTES: Record<ShaderCapeId, [string, string, string]> = {
  nebula: ['#9D5CFF', '#3B147A', '#F3E8FF'],
  pulse: ['#F43F5E', '#881337', '#FDA4AF'],
  aurora: ['#38BDF8', '#1E3A8A', '#A7F3D0'],
  obsidian: ['#F59E0B', '#27272A', '#FDE68A'],
};

const SKIN_BODY_COLORS: Record<
  PlayerAccount['skinPreset'],
  { torso: string; limb: string; head: string; accent: string }
> = {
  winvisual: { torso: '#1D1635', limb: '#130E24', head: '#271E45', accent: '#A855F7' },
  obsidian: { torso: '#29221E', limb: '#1D1815', head: '#D8B094', accent: '#A855F7' },
  classic: { torso: '#29789B', limb: '#3B357A', head: '#C68F6E', accent: '#60A5FA' },
  slim: { torso: '#2A2540', limb: '#1C192B', head: '#F0D0BA', accent: '#C4B5FD' },
};

export const Character3DViewer: React.FC<Character3DViewerProps> = ({
  skinPreset,
  cape,
  showHalo = false,
  heroStage = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  // Default angle shows iconic 3/4 back-right cape silhouette just like the WinVisual hero concept
  const yawRef = useRef(heroStage ? 2.62 : 2.45);
  const hoverOffsetRef = useRef(0);
  const lastXRef = useRef(0);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const projectBox = (
      cx: number,
      cy: number,
      cz: number,
      w: number,
      h: number,
      d: number,
      yaw: number,
      color: string,
      rimColor?: string
    ) => {
      const hw = w / 2;
      const hh = h / 2;
      const hd = d / 2;
      const verts = [
        [-hw, -hh, -hd],
        [hw, -hh, -hd],
        [hw, hh, -hd],
        [-hw, hh, -hd],
        [-hw, -hh, hd],
        [hw, -hh, hd],
        [hw, hh, hd],
        [-hw, hh, hd],
      ].map(([vx, vy, vz]) => {
        const x = vx + cx;
        const y = vy + cy;
        const z = vz + cz;
        const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
        const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
        const pitch = 0.2;
        const py = y * Math.cos(pitch) - rz * Math.sin(pitch);
        const pz = y * Math.sin(pitch) + rz * Math.cos(pitch);
        const scale = 240 / (240 + pz + 36);
        return { sx: rx * scale, sy: py * scale, z: pz };
      });

      const faces: [number[], number][] = [
        [[4, 5, 6, 7], 1.0],
        [[1, 0, 3, 2], 0.68],
        [[5, 1, 2, 6], 0.85],
        [[0, 4, 7, 3], 0.8],
        [[0, 1, 5, 4], 1.18],
      ];

      const sorted = faces
        .map(([idx, shade]) => ({
          idx,
          shade,
          depth: idx.reduce((acc, i) => acc + verts[i].z, 0) / 4,
        }))
        .sort((a, b) => b.depth - a.depth);

      const hex = color.replace('#', '');
      const baseR = parseInt(hex.slice(0, 2), 16);
      const baseG = parseInt(hex.slice(2, 4), 16);
      const baseB = parseInt(hex.slice(4, 6), 16);

      for (const f of sorted) {
        ctx.beginPath();
        f.idx.forEach((vi, i) => {
          const p = verts[vi];
          if (i === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        });
        ctx.closePath();
        const r = Math.min(255, Math.round(baseR * f.shade));
        const g = Math.min(255, Math.round(baseG * f.shade));
        const b = Math.min(255, Math.round(baseB * f.shade));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
        ctx.strokeStyle = rimColor ?? 'rgba(196,181,253,0.16)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    };

    const render = (time: number) => {
      const tSec = reducedMotion ? 0 : time * 0.001;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width / 2, height / 2 + (heroStage ? 6 : 12));

      const [cPrimary, cDark, cBright] = CAPE_PALETTES[cape];

      // Luminous double neon floor aura ring beneath the character's feet
      const grad = ctx.createRadialGradient(0, 78, 4, 0, 78, 92);
      grad.addColorStop(0, `${cPrimary}66`);
      grad.addColorStop(0.55, `${cPrimary}22`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 78, 88, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.shadowColor = cPrimary;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = cBright;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 77, 68, 16, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `${cPrimary}AA`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 77, 54, 11.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const yaw =
        yawRef.current +
        hoverOffsetRef.current +
        (reducedMotion ? 0 : Math.sin(tSec * 0.85) * 0.09);
      const colors = SKIN_BODY_COLORS[skinPreset] ?? SKIN_BODY_COLORS.winvisual;
      const backVisible = Math.cos(yaw) < 0.28;

      const drawCape = () => {
        const segs = 12;
        const capePoints: { sx: number; sy: number }[] = [];

        for (let i = 0; i < segs; i++) {
          const frac = i / segs;
          const nextFrac = (i + 1) / segs;
          const wave1 = Math.sin(tSec * 4.0 - frac * 3.0) * (5 + frac * 14);
          const wave2 = Math.sin(tSec * 4.0 - nextFrac * 3.0) * (5 + nextFrac * 14);
          const y1 = -24 + frac * 84;
          const y2 = -24 + nextFrac * 84;
          const z1 = -9 - frac * 16 - wave1 * 0.6;
          const z2 = -9 - nextFrac * 16 - wave2 * 0.6;
          const w1 = 19 + frac * 6;
          const w2 = 19 + nextFrac * 6;

          const pts = [
            [-w1, y1, z1],
            [w1, y1, z1],
            [w2, y2, z2],
            [-w2, y2, z2],
          ].map(([x, y, z]) => {
            const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
            const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
            const py = y * Math.cos(0.2) - rz * Math.sin(0.2);
            const pz = y * Math.sin(0.2) + rz * Math.cos(0.2);
            const s = 240 / (240 + pz + 36);
            return { sx: rx * s, sy: py * s };
          });

          if (i === 4) {
            capePoints.push(pts[0], pts[1], pts[2], pts[3]);
          }

          ctx.beginPath();
          pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
          ctx.closePath();
          const pulse = 0.5 + 0.5 * Math.sin(tSec * 3.2 - frac * 4.2);
          ctx.fillStyle = i % 2 === 0 ? cDark : cPrimary;
          ctx.globalAlpha = 0.94;
          ctx.fill();

          if (pulse > 0.52) {
            ctx.fillStyle = cBright;
            ctx.globalAlpha = (pulse - 0.52) * 0.72;
            ctx.fill();
          }

          // Starry shader sparkles across the flowing cloth
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#FFFFFF';
          const starX = (pts[0].sx + pts[2].sx) * 0.5 + Math.sin(i * 7.3) * 9;
          const starY = (pts[0].sy + pts[2].sy) * 0.5;
          ctx.beginPath();
          ctx.arc(starX, starY, (i % 3 === 0 ? 1.5 : 0.95) * (0.65 + pulse * 0.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Subtle glowing Crown-W emblem on upper back of cape
        if (capePoints.length === 4) {
          const cx = (capePoints[0].sx + capePoints[2].sx) / 2;
          const cy = (capePoints[0].sy + capePoints[2].sy) / 2 - 4;
          ctx.save();
          ctx.strokeStyle = cBright;
          ctx.lineWidth = 1.6;
          ctx.shadowColor = cBright;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(cx - 7, cy - 5);
          ctx.lineTo(cx - 4, cy + 5);
          ctx.lineTo(cx, cy - 1);
          ctx.lineTo(cx + 4, cy + 5);
          ctx.lineTo(cx + 7, cy - 5);
          ctx.stroke();
          ctx.restore();
        }
      };

      if (!backVisible) drawCape();

      projectBox(-9, 52, 0, 15, 44, 15, yaw, colors.limb);
      projectBox(9, 52, 0, 15, 44, 15, yaw, colors.limb);
      const armSwing = Math.sin(tSec * 1.6) * 2.2;
      projectBox(-25, 8 + armSwing, 0, 13, 44, 15, yaw, colors.limb);
      projectBox(25, 8 - armSwing, 0, 13, 44, 15, yaw, colors.limb);
      projectBox(0, 8, 0, 34, 44, 17, yaw, colors.torso);
      projectBox(0, -34, 0, 32, 32, 32, yaw, colors.head, 'rgba(216,180,254,0.32)');

      if (backVisible) drawCape();

      if (showHalo) {
        ctx.strokeStyle = cBright;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = cPrimary;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(0, -58, 25, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [skinPreset, cape, showHalo, heroStage, reducedMotion]);

  if (heroStage) {
    return (
      <div
        onPointerDown={(e) => {
          setDragging(true);
          lastXRef.current = e.clientX;
        }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const norm = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 0.42;
          hoverOffsetRef.current = norm;
          if (dragging) {
            const dx = e.clientX - lastXRef.current;
            lastXRef.current = e.clientX;
            yawRef.current += dx * 0.016;
          }
        }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => {
          setDragging(false);
          hoverOffsetRef.current = 0;
        }}
        className={`relative w-full h-full cursor-grab active:cursor-grabbing select-none ${className}`}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    );
  }

  return (
    <div
      onPointerDown={(e) => {
        setDragging(true);
        lastXRef.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const dx = e.clientX - lastXRef.current;
        lastXRef.current = e.clientX;
        yawRef.current += dx * 0.016;
      }}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => setDragging(false)}
      className={`relative w-full h-[260px] rounded-[16px] bg-gradient-to-b from-white/[0.03] to-black/35 border border-[var(--border-primary)] overflow-hidden cursor-grab active:cursor-grabbing select-none ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <span className="pointer-events-none absolute bottom-2.5 inset-x-0 text-center text-[11px] text-[var(--text-muted)]">
        Drag horizontally to inspect 3D skin & 144Hz shader cape
      </span>
    </div>
  );
};
