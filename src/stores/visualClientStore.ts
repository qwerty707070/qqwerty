import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VisualModuleCategory = 'hud' | 'render' | 'cosmetics';
export type ShaderCapeId = 'nebula' | 'pulse' | 'aurora' | 'obsidian';

export interface VisualModule {
  id: string;
  name: string;
  category: VisualModuleCategory;
  keybind: string;
  enabled: boolean;
  descriptionRu: string;
  descriptionEn: string;
}

export interface CrosshairSettings {
  gap: number;
  size: number;
  thickness: number;
  centerDot: boolean;
  outline: boolean;
  accentColor: boolean;
}

export interface HudWidgetPosition {
  x: number;
  y: number;
}

interface VisualClientState {
  modules: VisualModule[];
  equippedCape: ShaderCapeId;
  crosshair: CrosshairSettings;
  hudPositions: Record<string, HudWidgetPosition>;
  liveSessionModalOpen: boolean;

  toggleModule: (id: string) => void;
  setEquippedCape: (cape: ShaderCapeId) => void;
  updateCrosshair: <K extends keyof CrosshairSettings>(key: K, val: CrosshairSettings[K]) => void;
  setHudPosition: (id: string, x: number, y: number) => void;
  resetHudPositions: () => void;
  applyPresetProfile: (preset: 'cinematic' | 'competitive' | 'pure-fps') => void;
  exportPresetCode: () => string;
  importPresetCode: (code: string) => boolean;
  setLiveSessionModalOpen: (open: boolean) => void;
}

const DEFAULT_HUD_POSITIONS: Record<string, HudWidgetPosition> = {
  watermark: { x: 18, y: 18 },
  keystrokes: { x: 18, y: 170 },
  'target-hud': { x: 320, y: 205 },
  'armor-hud': { x: 320, y: 18 },
};

const INITIAL_MODULES: VisualModule[] = [
  {
    id: 'watermark',
    name: 'ArrayList & Watermark',
    category: 'hud',
    keybind: 'H',
    enabled: true,
    descriptionRu: 'Минималистичный стеклянный штамп клиента, FPS и сетевого пинга.',
    descriptionEn: 'Minimal frosted client badge showing real-time FPS, server RTT, and edition.',
  },
  {
    id: 'keystrokes',
    name: 'Keystrokes + CPS',
    category: 'hud',
    keybind: 'K',
    enabled: true,
    descriptionRu: 'Отклик клавиш WASD / Space с плавным свечением и живым счётчиком CPS.',
    descriptionEn: 'Sub-millisecond WASD & mouse ripple indicator with live LMB/RMB CPS counter.',
  },
  {
    id: 'target-hud',
    name: 'Pulse Target HUD 2.0',
    category: 'hud',
    keybind: 'T',
    enabled: true,
    descriptionRu: 'Информационная карточка цели в дуэлях: 3D-голова, полоса HP и дистанция.',
    descriptionEn: 'Clean duel overlay showing opponent avatar, interpolated HP bar, and distance.',
  },
  {
    id: 'armor-hud',
    name: 'Armor & Durability',
    category: 'hud',
    keybind: 'Y',
    enabled: true,
    descriptionRu: 'Компактная индикация прочности экипировки и активных эффектов зелий.',
    descriptionEn: 'Displays equipped armor durability percentages and active potion timers.',
  },
  {
    id: 'hit-particles',
    name: 'Volumetric Hit Particles',
    category: 'render',
    keybind: 'P',
    enabled: true,
    descriptionRu: 'Физические искры попаданий с мягким затуханием в акцентном цвете.',
    descriptionEn: 'GPU-instanced spark bursts upon melee or projectile impact.',
  },
  {
    id: 'motion-blur',
    name: ' Kawase Motion Blur',
    category: 'render',
    keybind: 'M',
    enabled: true,
    descriptionRu: 'Кинематографичное сглаживание поворота камеры без размытия прицела.',
    descriptionEn: ' High-refresh camera shutter accumulation with zero crosshair smearing.',
  },
  {
    id: 'viewmodel',
    name: 'Custom ViewModel',
    category: 'render',
    keybind: 'V',
    enabled: true,
    descriptionRu: 'Тонкая настройка смещения X/Y/Z, масштаба и покачивания предметов в руке.',
    descriptionEn: 'Precision X/Y/Z hand offset, scale, and smooth swing interpolation.',
  },
  {
    id: 'pearl-trail',
    name: 'Trajectory & Pearl Ribbon',
    category: 'render',
    keybind: 'G',
    enabled: false,
    descriptionRu: 'Неоновый шлейф полёта эндер-жемчуга и стрел с плавным растворением.',
    descriptionEn: 'Smooth ribbon trail behind thrown ender pearls and arrows.',
  },
  {
    id: 'shader-cape',
    name: '144Hz Cloth Cape Shader',
    category: 'cosmetics',
    keybind: 'C',
    enabled: true,
    descriptionRu: 'Пружинная физика ткани плаща с GLSL-шейдером звёздного свечения.',
    descriptionEn: 'Spring-mass cloth physics interpolated at monitor refresh rate.',
  },
  {
    id: 'china-hat',
    name: 'Ambient Halo Crown',
    category: 'cosmetics',
    keybind: 'J',
    enabled: false,
    descriptionRu: 'Полупрозрачный световой нимб над головой игрока с реакцией на спринт.',
    descriptionEn: 'Translucent radial aura ring above player head synced to accent color.',
  },
];

export const useVisualClientStore = create<VisualClientState>()(
  persist(
    (set, get) => ({
      modules: INITIAL_MODULES,
      equippedCape: 'nebula',
      crosshair: {
        gap: 4,
        size: 8,
        thickness: 2,
        centerDot: true,
        outline: true,
        accentColor: true,
      },
      hudPositions: DEFAULT_HUD_POSITIONS,
      liveSessionModalOpen: false,

      toggleModule: (id) =>
        set((state) => ({
          modules: state.modules.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
        })),

      setEquippedCape: (cape) => set({ equippedCape: cape }),

      updateCrosshair: (key, val) =>
        set((state) => ({
          crosshair: { ...state.crosshair, [key]: val },
        })),

      setHudPosition: (id, x, y) =>
        set((state) => ({
          hudPositions: {
            ...state.hudPositions,
            [id]: { x: Math.round(x), y: Math.round(y) },
          },
        })),

      resetHudPositions: () => set({ hudPositions: DEFAULT_HUD_POSITIONS }),

      applyPresetProfile: (preset) =>
        set((state) => ({
          modules: state.modules.map((m) => {
            if (preset === 'pure-fps') {
              return { ...m, enabled: ['watermark', 'keystrokes', 'armor-hud'].includes(m.id) };
            }
            if (preset === 'competitive') {
              return {
                ...m,
                enabled: [
                  'watermark',
                  'keystrokes',
                  'target-hud',
                  'armor-hud',
                  'hit-particles',
                  'viewmodel',
                ].includes(m.id),
              };
            }
            return { ...m, enabled: m.id !== 'china-hat' };
          }),
        })),

      exportPresetCode: () => {
        const s = get();
        const payload = {
          v: 2,
          cape: s.equippedCape,
          ch: s.crosshair,
          pos: s.hudPositions,
          on: s.modules.filter((m) => m.enabled).map((m) => m.id),
        };
        return `WINVISUAL-${btoa(JSON.stringify(payload))}`;
      },

      importPresetCode: (raw) => {
        try {
          const trimmed = raw.trim();
          const body = trimmed.startsWith('WINVISUAL-') ? trimmed.slice(10) : trimmed;
          const parsed = JSON.parse(atob(body)) as {
            cape?: ShaderCapeId;
            ch?: CrosshairSettings;
            pos?: Record<string, HudWidgetPosition>;
            on?: string[];
          };
          if (!Array.isArray(parsed.on)) return false;
          set((state) => ({
            equippedCape: parsed.cape ?? state.equippedCape,
            crosshair: parsed.ch ? { ...state.crosshair, ...parsed.ch } : state.crosshair,
            hudPositions: parsed.pos ? { ...DEFAULT_HUD_POSITIONS, ...parsed.pos } : state.hudPositions,
            modules: state.modules.map((m) => ({
              ...m,
              enabled: parsed.on!.includes(m.id),
            })),
          }));
          return true;
        } catch {
          return false;
        }
      },

      setLiveSessionModalOpen: (open) => set({ liveSessionModalOpen: open }),
    }),
    {
      name: 'winvisual-modules-v3',
      partialize: (s) => ({
        modules: s.modules,
        equippedCape: s.equippedCape,
        crosshair: s.crosshair,
        hudPositions: s.hudPositions,
      }),
    }
  )
);
