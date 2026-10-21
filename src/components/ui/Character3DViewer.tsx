import React, { useEffect, useRef, useState } from 'react';
import type { PlayerAccount } from '../../types/launcher';
import type { ShaderCapeId } from '../../stores/visualClientStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface Character3DViewerProps {
  skinPreset: PlayerAccount['skinPreset'];
  cape: ShaderCapeId;
  showHalo?: boolean;
}

const CAPE_PALETTES: Record<ShaderCapeId, [string, string, string]> = {
  nebula: ['#8B7CFF', '#5B21B6', '#C4B5FD'],
  pulse: ['#F43F5E', '#881337', '#FDA4AF'],
  aurora: ['#38BDF8', '#1E3A8A', '#A7F3D0'],
  obsidian: ['#F59E0B', '#27272A', '#FDE68A'],
};

const SKIN_BODY_COLORS: Record<
  PlayerAccount['skinPreset'],
  { torso: string; limb: string; head: string; accent: string }
> = {
  aether: { torso: '#1E2235', limb: '#151826', head: '#252A40', accent: '#8B7CFF' },
  obsidian: { torso: '#29221E', limb: '#1D1815', head: '#D8B094', accent: '#A855F7' },
  classic: { torso: '#29789B', limb: '#3B357A', head: '#C68F6E', accent: '#60A5FA' },
  slim: { torso: '#2A2540', limb: '#1C192B', head: '#F0D0BA', accent: '#C4B5FD' },
};

export const Character3DViewer: React.FC<Character3DViewerProps> = ({
  skinPreset,
  cape,
  showHalo = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const yawRef = useRef(2.45); // Default angled rear-three-quarter view showcasing cape + character!
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
      color: string
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
        const pitch = 0.22;
        const py = y * Math.cos(pitch) - rz * Math.sin(pitch);
        const pz = y * Math.sin(pitch) + rz * Math.cos(pitch);
        const scale = 230 / (230 + pz + 40);
        return { sx: rx * scale, sy: py * scale, z: pz };
      });

      const faces: [number[], number][] = [
        [[4, 5, 6, 7], 1.0], // front
        [[1, 0, 3, 2], 0.68], // back
        [[5, 1, 2, 6], 0.84], // right
        [[0, 4, 7, 3], 0.78], // left
        [[0, 1, 5, 4], 1.14], // top
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
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.75;
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
      ctx.translate(width / 2, height / 2 + 12);

      // Floor glow ring
      const [cPrimary, cDark, cBright] = CAPE_PALETTES[cape];
      const grad = ctx.createRadialGradient(0, 82, 4, 0, 82, 76);
      grad.addColorStop(0, `${cPrimary}44`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 82, 74, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      const yaw = yawRef.current + (reducedMotion ? 0 : Math.sin(tSec * 0.7) * 0.08);
      const colors = SKIN_BODY_COLORS[skinPreset];
      const backVisible = Math.cos(yaw) < 0.25;

      const drawCape = () => {
        const segs = 10;
        for (let i = 0; i < segs; i++) {
          const frac = i / segs;
          const nextFrac = (i + 1) / segs;
          const wave1 = Math.sin(tSec * 4.2 - frac * 3.1) * (4 + frac * 11);
          const wave2 = Math.sin(tSec * 4.2 - nextFrac * 3.1) * (4 + nextFrac * 11);
          const y1 = -24 + frac * 78;
          const y2 = -24 + nextFrac * 78;
          const z1 = -9 - frac * 10 - wave1 * 0.55;
          const z2 = -9 - nextFrac * 10 - wave2 * 0.55;

          const pts = [
            [-19, y1, z1],
            [19, y1, z1],
            [20.5, y2, z2],
            [-20.5, y2, z2],
          ].map(([x, y, z]) => {
            const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
            const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
            const py = y * Math.cos(0.22) - rz * Math.sin(0.22);
            const pz = y * Math.sin(0.22) + rz * Math.cos(0.22);
            const s = 230 / (230 + pz + 40);
            return { sx: rx * s, sy: py * s };
          });

          ctx.beginPath();
          pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
          ctx.closePath();
          const pulse = 0.5 + 0.5 * Math.sin(tSec * 3 - frac * 4);
          ctx.fillStyle = i % 2 === 0 ? cDark : cPrimary;
          ctx.globalAlpha = 0.92;
          ctx.fill();
          if (pulse > 0.65) {
            ctx.fillStyle = cBright;
            ctx.globalAlpha = (pulse - 0.65) * 0.65;
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      };

      if (!backVisible) drawCape();

      // Legs
      projectBox(-9, 52, 0, 15, 44, 15, yaw, colors.limb);
      projectBox(9, 52, 0, 15, 44, 15, yaw, colors.limb);
      // Arms
      const armSwing = Math.sin(tSec * 1.6) * 2;
      projectBox(-25, 8 + armSwing, 0, 13, 44, 15, yaw, colors.limb);
      projectBox(25, 8 - armSwing, 0, 13, 44, 15, yaw, colors.limb);
      // Torso
      projectBox(0, 8, 0, 34, 44, 17, yaw, colors.torso);
      // Head
      projectBox(0, -34, 0, 32, 32, 32, yaw, colors.head);

      if (backVisible) drawCape();

      // Optional Halo Aura above head
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
  }, [skinPreset, cape, showHalo, reducedMotion]);

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
      className="relative w-full h-[260px] rounded-[16px] bg-gradient-to-b from-white/[0.03] to-black/35 border border-[var(--border-primary)] overflow-hidden cursor-grab active:cursor-grabbing select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <span className="pointer-events-none absolute bottom-2.5 inset-x-0 text-center text-[11px] text-[var(--text-muted)]">
        Drag horizontally to inspect 3D skin & 144Hz shader cape
      </span>
    </div>
  );
};
