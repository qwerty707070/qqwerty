import React, { useEffect, useRef, useState } from 'react';
import type { PlayerAccount } from '../../types/launcher';
import type { ShaderCapeId } from '../../stores/visualClientStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface Character3DViewerProps {
  skinPreset: PlayerAccount['skinPreset'];
  skinModel?: 'classic' | 'slim';
  customSkinDataUrl?: string | null;
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

interface BuiltinPalette {
  skin: [number, number, number];
  hair: [number, number, number];
  torso: [number, number, number];
  torsoTrim: [number, number, number];
  pants: [number, number, number];
  boots: [number, number, number];
  eyes: [number, number, number];
}

const PRESET_PALETTES: Record<PlayerAccount['skinPreset'], BuiltinPalette> = {
  winvisual: {
    skin: [236, 198, 178],
    hair: [22, 16, 40],
    torso: [24, 18, 46],
    torsoTrim: [152, 118, 255],
    pants: [15, 12, 28],
    boots: [139, 124, 255],
    eyes: [168, 85, 247],
  },
  obsidian: {
    skin: [222, 176, 148],
    hair: [34, 24, 20],
    torso: [38, 30, 28],
    torsoTrim: [168, 85, 247],
    pants: [24, 20, 18],
    boots: [126, 34, 206],
    eyes: [192, 132, 252],
  },
  classic: {
    skin: [198, 143, 110],
    hair: [52, 34, 24],
    torso: [41, 120, 155],
    torsoTrim: [96, 165, 250],
    pants: [59, 53, 122],
    boots: [82, 82, 91],
    eyes: [75, 91, 171],
  },
  slim: {
    skin: [242, 210, 189],
    hair: [38, 34, 58],
    torso: [44, 38, 68],
    torsoTrim: [196, 181, 253],
    pants: [28, 25, 44],
    boots: [167, 139, 250],
    eyes: [139, 124, 255],
  },
};

function buildProceduralSkinRgba(preset: PlayerAccount['skinPreset']): Uint8ClampedArray {
  const pal = PRESET_PALETTES[preset] ?? PRESET_PALETTES.winvisual;
  const buf = new Uint8ClampedArray(64 * 64 * 4);

  const setPx = (x: number, y: number, rgb: [number, number, number], a = 255) => {
    if (x < 0 || x >= 64 || y < 0 || y >= 64) return;
    const o = (y * 64 + x) * 4;
    buf[o] = rgb[0];
    buf[o + 1] = rgb[1];
    buf[o + 2] = rgb[2];
    buf[o + 3] = a;
  };

  const fill = (rx: number, ry: number, rw: number, rh: number, rgb: [number, number, number], a = 255) => {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        setPx(x, y, rgb, a);
      }
    }
  };

  // Head base (0..32, 0..16)
  fill(8, 0, 8, 8, pal.hair);
  fill(16, 0, 8, 8, pal.skin);
  fill(0, 8, 32, 8, pal.skin);
  fill(0, 8, 32, 2, pal.hair);
  // Sides & back hair hood
  fill(0, 10, 8, 4, pal.hair);
  fill(16, 10, 8, 4, pal.hair);
  fill(24, 8, 8, 8, pal.hair);
  // Eyes on front head (8..16, 8..16)
  setPx(9, 12, [255, 255, 255]);
  setPx(10, 12, pal.eyes);
  setPx(13, 12, pal.eyes);
  setPx(14, 12, [255, 255, 255]);
  fill(9, 11, 2, 1, pal.hair);
  fill(13, 11, 2, 1, pal.hair);

  // Outer 3D Hat / Crown layer (32..64, 0..16)
  fill(40, 0, 8, 8, pal.hair);
  fill(40, 8, 8, 2, pal.hair);
  setPx(41, 9, pal.torsoTrim);
  setPx(43, 8, [245, 243, 255]);
  setPx(44, 8, [245, 243, 255]);
  setPx(46, 9, pal.torsoTrim);
  fill(32, 8, 8, 5, pal.hair);
  fill(48, 8, 8, 5, pal.hair);
  fill(56, 8, 8, 6, pal.hair);
  setPx(59, 10, pal.torsoTrim);
  setPx(60, 10, pal.torsoTrim);

  // Torso (16..40, 16..32) with WinVisual chest emblem & trim
  fill(20, 16, 8, 4, pal.torso);
  fill(28, 16, 8, 4, pal.torso);
  fill(16, 20, 24, 12, pal.torso);
  // Subtle Crown-W emblem on chest front (20..28, 20..32)
  setPx(21, 22, pal.torsoTrim);
  setPx(22, 24, pal.torsoTrim);
  setPx(23, 23, [255, 255, 255]);
  setPx(24, 23, [255, 255, 255]);
  setPx(25, 24, pal.torsoTrim);
  setPx(26, 22, pal.torsoTrim);
  fill(20, 31, 8, 1, pal.torsoTrim);

  // Right & Left Legs (0..16, 20..32 and 16..32, 52..64)
  fill(4, 16, 8, 4, pal.pants);
  fill(0, 20, 16, 10, pal.pants);
  fill(0, 30, 16, 2, pal.boots);

  fill(20, 48, 8, 4, pal.pants);
  fill(16, 52, 16, 10, pal.pants);
  fill(16, 62, 16, 2, pal.boots);

  // Right & Left Arms (40..56, 20..32 and 32..48, 52..64)
  fill(44, 16, 8, 4, pal.torso);
  fill(40, 20, 16, 9, pal.torso);
  fill(40, 29, 16, 1, pal.torsoTrim);
  fill(40, 30, 16, 2, pal.skin);

  fill(36, 48, 8, 4, pal.torso);
  fill(32, 52, 16, 9, pal.torso);
  fill(32, 61, 16, 1, pal.torsoTrim);
  fill(32, 62, 16, 2, pal.skin);

  return buf;
}

interface BoxUvMap {
  front: [number, number, number, number];
  back: [number, number, number, number];
  right: [number, number, number, number];
  left: [number, number, number, number];
  top: [number, number, number, number];
  bottom: [number, number, number, number];
}

export const Character3DViewer: React.FC<Character3DViewerProps> = ({
  skinPreset,
  skinModel,
  customSkinDataUrl,
  cape,
  showHalo = false,
  heroStage = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const [skinPixels, setSkinPixels] = useState<Uint8ClampedArray>(() =>
    buildProceduralSkinRgba(skinPreset)
  );
  // Default angle shows iconic 3/4 back-right cape silhouette on Home Hero, and 3/4 front-right on Account
  const yawRef = useRef(heroStage ? 2.62 : 0.62);
  const hoverOffsetRef = useRef(0);
  const lastXRef = useRef(0);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const isSlim = skinModel ? skinModel === 'slim' : skinPreset === 'slim';

  // Decode custom 64x64 / 64x32 PNG skin whenever customSkinDataUrl or preset changes
  useEffect(() => {
    if (!customSkinDataUrl || typeof document === 'undefined') {
      setSkinPixels(buildProceduralSkinRgba(skinPreset));
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const cvs = document.createElement('canvas');
        cvs.width = 64;
        cvs.height = 64;
        const off = cvs.getContext('2d');
        if (!off) return;
        off.imageSmoothingEnabled = false;
        off.clearRect(0, 0, 64, 64);
        off.drawImage(img, 0, 0);
        // Legacy 64x32 skin compatibility: mirror right leg/arm to left leg/arm slots
        if (img.height === 32) {
          off.drawImage(img, 0, 16, 16, 16, 16, 48, 16, 16);
          off.drawImage(img, 40, 16, 16, 16, 32, 48, 16, 16);
        }
        setSkinPixels(off.getImageData(0, 0, 64, 64).data);
      } catch {
        setSkinPixels(buildProceduralSkinRgba(skinPreset));
      }
    };
    img.onerror = () => {
      if (!cancelled) setSkinPixels(buildProceduralSkinRgba(skinPreset));
    };
    img.src = customSkinDataUrl;

    return () => {
      cancelled = true;
    };
  }, [customSkinDataUrl, skinPreset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const projectPt = (x: number, y: number, z: number, yaw: number) => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rx = x * cosY + z * sinY;
      const rz = -x * sinY + z * cosY;
      const pitch = 0.2;
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const py = y * cosP - rz * sinP;
      const pz = y * sinP + rz * cosP;
      const scale = 240 / (240 + pz + 36);
      return { sx: rx * scale, sy: py * scale, z: pz };
    };

    const projectTexturedBox = (
      cx: number,
      cy: number,
      cz: number,
      w: number,
      h: number,
      d: number,
      yaw: number,
      uv: BoxUvMap,
      allowTransparency = false
    ) => {
      const hw = w / 2;
      const hh = h / 2;
      const hd = d / 2;

      const corners: [number, number, number][] = [
        [-hw + cx, -hh + cy, -hd + cz], // 0: back-top-left
        [hw + cx, -hh + cy, -hd + cz],  // 1: back-top-right
        [hw + cx, hh + cy, -hd + cz],   // 2: back-bot-right
        [-hw + cx, hh + cy, -hd + cz],  // 3: back-bot-left
        [-hw + cx, -hh + cy, hd + cz],  // 4: front-top-left
        [hw + cx, -hh + cy, hd + cz],   // 5: front-top-right
        [hw + cx, hh + cy, hd + cz],    // 6: front-bot-right
        [-hw + cx, hh + cy, hd + cz],   // 7: front-bot-left
      ];

      const projected = corners.map(([vx, vy, vz]) => projectPt(vx, vy, vz, yaw));

      // Each face defines [topLeftIdx, topRightIdx, botRightIdx, botLeftIdx], shade, uvRect
      const faceDefs: {
        idx: [number, number, number, number];
        shade: number;
        rect: [number, number, number, number];
      }[] = [
        { idx: [4, 5, 6, 7], shade: 1.0, rect: uv.front },
        { idx: [1, 0, 3, 2], shade: 0.72, rect: uv.back },
        { idx: [5, 1, 2, 6], shade: 0.86, rect: uv.right },
        { idx: [0, 4, 7, 3], shade: 0.82, rect: uv.left },
        { idx: [0, 1, 5, 4], shade: 1.14, rect: uv.top },
        { idx: [7, 6, 2, 3], shade: 0.62, rect: uv.bottom },
      ];

      const sortedFaces = faceDefs
        .map((f) => ({
          ...f,
          depth: f.idx.reduce((acc, i) => acc + projected[i].z, 0) * 0.25,
        }))
        .sort((a, b) => b.depth - a.depth);

      for (const face of sortedFaces) {
        const [i0, i1, i2, i3] = face.idx;
        const p0 = projected[i0];
        const p1 = projected[i1];
        const p3 = projected[i3];

        // Screen-space Winding Culling (unless outer 3D layer where interior might peek through)
        const cross = (p1.sx - p0.sx) * (p3.sy - p0.sy) - (p1.sy - p0.sy) * (p3.sx - p0.sx);
        if (!allowTransparency && cross <= 0.05) continue;

        const c0 = corners[i0];
        const c1 = corners[i1];
        const c2 = corners[i2];
        const c3 = corners[i3];

        const [ux, uy, uw, uh] = face.rect;

        for (let ty = 0; ty < uh; ty++) {
          const v0 = ty / uh;
          const v1 = (ty + 1) / uh;
          for (let tx = 0; tx < uw; tx++) {
            const o = ((uy + ty) * 64 + (ux + tx)) * 4;
            const alpha = skinPixels[o + 3];
            if (allowTransparency && alpha < 32) continue;

            const u0 = tx / uw;
            const u1 = (tx + 1) / uw;

            const bilerp = (u: number, v: number) => {
              const wx =
                (1 - u) * (1 - v) * c0[0] +
                u * (1 - v) * c1[0] +
                u * v * c2[0] +
                (1 - u) * v * c3[0];
              const wy =
                (1 - u) * (1 - v) * c0[1] +
                u * (1 - v) * c1[1] +
                u * v * c2[1] +
                (1 - u) * v * c3[1];
              const wz =
                (1 - u) * (1 - v) * c0[2] +
                u * (1 - v) * c1[2] +
                u * v * c2[2] +
                (1 - u) * v * c3[2];
              return projectPt(wx, wy, wz, yaw);
            };

            const q0 = bilerp(u0, v0);
            const q1 = bilerp(u1, v0);
            const q2 = bilerp(u1, v1);
            const q3 = bilerp(u0, v1);

            const r = Math.min(255, Math.round(skinPixels[o] * face.shade));
            const g = Math.min(255, Math.round(skinPixels[o + 1] * face.shade));
            const b = Math.min(255, Math.round(skinPixels[o + 2] * face.shade));
            const colorCss = `rgb(${r},${g},${b})`;

            ctx.fillStyle = colorCss;
            ctx.strokeStyle = colorCss;
            ctx.lineWidth = 0.65;
            ctx.beginPath();
            ctx.moveTo(q0.sx, q0.sy);
            ctx.lineTo(q1.sx, q1.sy);
            ctx.lineTo(q2.sx, q2.sy);
            ctx.lineTo(q3.sx, q3.sy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      }
    };

    const headUv: BoxUvMap = {
      front: [8, 8, 8, 8],
      back: [24, 8, 8, 8],
      right: [16, 8, 8, 8],
      left: [0, 8, 8, 8],
      top: [8, 0, 8, 8],
      bottom: [16, 0, 8, 8],
    };

    const hatUv: BoxUvMap = {
      front: [40, 8, 8, 8],
      back: [56, 8, 8, 8],
      right: [48, 8, 8, 8],
      left: [32, 8, 8, 8],
      top: [40, 0, 8, 8],
      bottom: [48, 0, 8, 8],
    };

    const torsoUv: BoxUvMap = {
      front: [20, 20, 8, 12],
      back: [32, 20, 8, 12],
      right: [28, 20, 4, 12],
      left: [16, 20, 4, 12],
      top: [20, 16, 8, 4],
      bottom: [28, 16, 8, 4],
    };

    const armW = isSlim ? 3 : 4;
    const rightArmUv: BoxUvMap = {
      front: [44, 20, armW, 12],
      back: [44 + armW + 4, 20, armW, 12],
      right: [44 + armW, 20, 4, 12],
      left: [40, 20, 4, 12],
      top: [44, 16, armW, 4],
      bottom: [44 + armW, 16, armW, 4],
    };

    const leftArmUv: BoxUvMap = {
      front: [36, 52, armW, 12],
      back: [36 + armW + 4, 52, armW, 12],
      right: [36 + armW, 52, 4, 12],
      left: [32, 52, 4, 12],
      top: [36, 48, armW, 4],
      bottom: [36 + armW, 48, armW, 4],
    };

    const rightLegUv: BoxUvMap = {
      front: [4, 20, 4, 12],
      back: [12, 20, 4, 12],
      right: [8, 20, 4, 12],
      left: [0, 20, 4, 12],
      top: [4, 16, 4, 4],
      bottom: [8, 16, 4, 4],
    };

    const leftLegUv: BoxUvMap = {
      front: [20, 52, 4, 12],
      back: [28, 52, 4, 12],
      right: [24, 52, 4, 12],
      left: [16, 52, 4, 12],
      top: [20, 48, 4, 4],
      bottom: [24, 48, 4, 4],
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
          ].map(([x, y, z]) => projectPt(x, y, z, yaw));

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

          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#FFFFFF';
          const starX = (pts[0].sx + pts[2].sx) * 0.5 + Math.sin(i * 7.3) * 9;
          const starY = (pts[0].sy + pts[2].sy) * 0.5;
          ctx.beginPath();
          ctx.arc(starX, starY, (i % 3 === 0 ? 1.5 : 0.95) * (0.65 + pulse * 0.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

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

      const armBoxW = isSlim ? 11.5 : 14.5;
      const armOffsetX = isSlim ? 23.2 : 24.5;
      const armSwing = Math.sin(tSec * 1.6) * 2.2;

      // Depth-sort left vs right limbs based on camera rotation yaw so overlap is always geometrically exact
      const sinYaw = Math.sin(yaw);
      if (sinYaw >= 0) {
        projectTexturedBox(-8.8, 52, 0, 15.5, 44, 15.5, yaw, rightLegUv);
        projectTexturedBox(8.8, 52, 0, 15.5, 44, 15.5, yaw, leftLegUv);
        projectTexturedBox(-armOffsetX, 8 + armSwing, 0, armBoxW, 44, 15.5, yaw, rightArmUv);
        projectTexturedBox(0, 8, 0, 34, 44, 17, yaw, torsoUv);
        projectTexturedBox(armOffsetX, 8 - armSwing, 0, armBoxW, 44, 15.5, yaw, leftArmUv);
      } else {
        projectTexturedBox(8.8, 52, 0, 15.5, 44, 15.5, yaw, leftLegUv);
        projectTexturedBox(-8.8, 52, 0, 15.5, 44, 15.5, yaw, rightLegUv);
        projectTexturedBox(armOffsetX, 8 - armSwing, 0, armBoxW, 44, 15.5, yaw, leftArmUv);
        projectTexturedBox(0, 8, 0, 34, 44, 17, yaw, torsoUv);
        projectTexturedBox(-armOffsetX, 8 + armSwing, 0, armBoxW, 44, 15.5, yaw, rightArmUv);
      }

      // Base Head + Raised 3D Outer Hat/Hair Layer
      projectTexturedBox(0, -34, 0, 32, 32, 32, yaw, headUv, false);
      projectTexturedBox(0, -34, 0, 35.4, 35.4, 35.4, yaw, hatUv, true);

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
  }, [skinPixels, isSlim, cape, showHalo, heroStage, reducedMotion]);

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
        360° 3D Pixel Skin & 144Hz GLSL Cape — drag horizontally to rotate
      </span>
    </div>
  );
};
