import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loadHudConfigEverywhere, saveHudConfigEverywhere } from '../services/tauriBridge';
import { useSettingsStore } from './settingsStore';

export type VisualModuleCategory = 'esp' | 'hud' | 'render' | 'cosmetics';
export type ShaderCapeId = 'nebula' | 'pulse' | 'aurora' | 'obsidian';
export type EvoThemeId = 'violet' | 'cyber' | 'crimson' | 'emerald' | 'amber' | 'arctic';

export interface EvoThemeOption {
  id: EvoThemeId;
  name: string;
  primaryHex: string;
  secondaryHex: string;
}

export const EVO_THEMES: EvoThemeOption[] = [
  { id: 'violet', name: 'Royal Violet', primaryHex: '#8B7CFF', secondaryHex: '#C084FC' },
  { id: 'cyber', name: 'Cyber Ice', primaryHex: '#38BDF8', secondaryHex: '#818CF8' },
  { id: 'crimson', name: 'Pulse Crimson', primaryHex: '#F43F5E', secondaryHex: '#FB923C' },
  { id: 'emerald', name: 'Neon Emerald', primaryHex: '#10B981', secondaryHex: '#2DD4BF' },
  { id: 'amber', name: 'Solar Amber', primaryHex: '#F59E0B', secondaryHex: '#FCD34D' },
  { id: 'arctic', name: 'Pure Arctic', primaryHex: '#E2E8F0', secondaryHex: '#94A3B8' },
];

export interface VisualModule {
  id: string;
  name: string;
  category: VisualModuleCategory;
  keybind: string;
  keybindCode: number;
  enabled: boolean;
  modes: string[];
  modeIndex: number;
  amount: number;
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

interface PersistedHudDiskSchema {
  version: string;
  themeId: EvoThemeId;
  equippedCape: ShaderCapeId;
  crosshair: CrosshairSettings;
  hudPositions: Record<string, HudWidgetPosition>;
  modules: {
    id: string;
    enabled: boolean;
    modeIndex: number;
    amount: number;
    keybind: string;
    keybindCode: number;
  }[];
  savedAt: string;
}

export type PresetProfileId = 'evovis-esp' | 'cinematic' | 'competitive' | 'pure-fps';

interface VisualClientState {
  modules: VisualModule[];
  themeId: EvoThemeId;
  equippedCape: ShaderCapeId;
  crosshair: CrosshairSettings;
  hudPositions: Record<string, HudWidgetPosition>;
  liveSessionModalOpen: boolean;
  lastDiskSyncPath: string;
  lastDiskSyncAt: string | null;

  toggleModule: (id: string) => void;
  setModuleMode: (id: string, modeIndex: number) => void;
  setModuleAmount: (id: string, amount: number) => void;
  setModuleKeybind: (id: string, keyLabel: string, glfwCode: number) => void;
  setThemeId: (theme: EvoThemeId) => void;
  setEquippedCape: (cape: ShaderCapeId) => void;
  updateCrosshair: <K extends keyof CrosshairSettings>(key: K, val: CrosshairSettings[K]) => void;
  setHudPosition: (id: string, x: number, y: number) => void;
  resetHudPositions: () => void;
  applyPresetProfile: (preset: PresetProfileId) => void;
  exportPresetCode: () => string;
  importPresetCode: (code: string) => boolean;
  persistHudConfigToDisk: () => Promise<string | null>;
  hydrateHudConfigFromDisk: () => Promise<boolean>;
  setLiveSessionModalOpen: (open: boolean) => void;
}

const DEFAULT_HUD_POSITIONS: Record<string, HudWidgetPosition> = {
  watermark: { x: 14, y: 14 },
  minimap: { x: 14, y: 50 },
  'potions-hud': { x: 14, y: 176 },
  'keybinds-hud': { x: 14, y: 256 },
  keystrokes: { x: 18, y: 170 },
  'target-hud': { x: 320, y: 205 },
  'armor-hud': { x: 320, y: 18 },
  'perf-gauges': { x: 520, y: 14 },
  'coords-hud': { x: 520, y: 92 },
  'media-player': { x: 520, y: 126 },
  arraylist: { x: 640, y: 170 },
};

const INITIAL_MODULES: VisualModule[] = [
  // === 1. ESP & ENTITY VISUALS (EvoVis ESP Suite) ===
  {
    id: 'player-esp',
    name: 'Player ESP',
    category: 'esp',
    keybind: 'X',
    keybindCode: 88,
    enabled: true,
    modes: ['Corner', 'Full Box', 'Glow Box'],
    modeIndex: 0,
    amount: 85,
    descriptionRu: 'Проекционные 2D/3D боксы игроков (Corner / Full / Glow) с неоновой градиентной обводкой.',
    descriptionEn: 'Projected 2D/3D player bounding boxes in Corner, Full Box, or Glow Box style.',
  },
  {
    id: 'health-bar',
    name: 'Health & Armor ESP',
    category: 'esp',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Gradient', 'Dynamic HP', 'Minimal'],
    modeIndex: 0,
    amount: 100,
    descriptionRu: 'Плавные полосы HP, щитов поглощения и прочности брони прямо рядом с моделями игроков.',
    descriptionEn: 'Smooth interpolated health, absorption, and armor bars anchored to entities.',
  },
  {
    id: 'nametags',
    name: 'Evo Nametags',
    category: 'esp',
    keybind: 'N',
    keybindCode: 78,
    enabled: true,
    modes: ['Glass Pill', 'Compact', 'Full Info'],
    modeIndex: 0,
    amount: 90,
    descriptionRu: 'Стеклянные плашки над игроками: никнейм, точное здоровье, дистанция в метрах и предмет в руке.',
    descriptionEn: 'Frosted tags above players displaying name, exact HP, distance, and held item.',
  },
  {
    id: 'tracers',
    name: 'Tracers',
    category: 'esp',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: false,
    modes: ['Crosshair', 'Bottom', 'Top'],
    modeIndex: 0,
    amount: 60,
    descriptionRu: 'Тонкие векторные лучи до ближайших игроков с цветовой индикацией дистанции.',
    descriptionEn: 'Clean vector snaplines pointing toward nearby players in the world.',
  },
  {
    id: 'mob-esp',
    name: 'Mob & Creature ESP',
    category: 'esp',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: false,
    modes: ['Hostile + Passive', 'Hostile Only', 'Glow'],
    modeIndex: 0,
    amount: 65,
    descriptionRu: 'Подсветка враждебных и мирных существ раздельными цветовыми контурами.',
    descriptionEn: 'Highlights hostile monsters and passive creatures with color-coded contours.',
  },
  {
    id: 'item-esp',
    name: 'Item Drops ESP',
    category: 'esp',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Tag + Box', 'Tag Only', 'Beacon'],
    modeIndex: 0,
    amount: 80,
    descriptionRu: 'Подсветка ценного лута на земле с названием предмета и количеством в стаке.',
    descriptionEn: 'Highlights dropped items on the ground with stack count and distance pill.',
  },
  {
    id: 'pearl-trail',
    name: 'Pearl & Arrow Tracer',
    category: 'esp',
    keybind: 'G',
    keybindCode: 71,
    enabled: true,
    modes: ['Neon Ribbon', 'Dashed', 'Impact Ring'],
    modeIndex: 0,
    amount: 90,
    descriptionRu: '3D-траектория полёта эндер-жемчуга, стрел и трезубцев в реальном времени.',
    descriptionEn: '3D trajectory trail and marker for thrown ender pearls, arrows, and tridents.',
  },

  // === 2. HUD 2.0 ELEMENTS (11 Draggable EvoVisual Widgets) ===
  {
    id: 'watermark',
    name: 'Evo Watermark',
    category: 'hud',
    keybind: 'H',
    keybindCode: 72,
    enabled: true,
    modes: ['Glass Pill', 'Neon Bar', 'Minimal'],
    modeIndex: 0,
    amount: 100,
    descriptionRu: 'Фирменный стеклянный штамп WINVISUAL • версия • никнейм • живой FPS.',
    descriptionEn: 'Signature frosted WinVisual client badge with build, username, and live FPS.',
  },
  {
    id: 'target-hud',
    name: 'Target HUD 2.0',
    category: 'hud',
    keybind: 'T',
    keybindCode: 84,
    enabled: true,
    modes: ['Evo Card', 'Pulse Compact', 'Neon Duel'],
    modeIndex: 0,
    amount: 100,
    descriptionRu: 'Карточка цели в дуэлях: аватар, плавная полоса HP, дистанция и расчёт преимущества WIN/LOSE.',
    descriptionEn: 'Duel overlay showing opponent avatar, smooth HP bar, distance, and W/L delta.',
  },
  {
    id: 'minimap',
    name: 'Rotating Minimap',
    category: 'hud',
    keybind: 'M',
    keybindCode: 77,
    enabled: true,
    modes: ['Radar Circle', 'Square Map', 'Compact'],
    modeIndex: 0,
    amount: 75,
    descriptionRu: 'Вращающийся радар EvoVisual со сторонами света N/E/S/W, игроками, мобами и лутом.',
    descriptionEn: 'Rotating radar map with cardinal compass, players, mobs, and item markers.',
  },
  {
    id: 'potions-hud',
    name: 'Potions & Timers',
    category: 'hud',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Evo List', 'Compact', 'Badges'],
    modeIndex: 0,
    amount: 90,
    descriptionRu: 'Список активных эффектов зелий с уровнем усиления и точным обратным отсчётом.',
    descriptionEn: 'Active potion effects panel with amplifier level and live countdown timers.',
  },
  {
    id: 'keybinds-hud',
    name: 'Keybinds List',
    category: 'hud',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Active Only', 'All Bound'],
    modeIndex: 0,
    amount: 85,
    descriptionRu: 'Панель активных биндов с мгновенной индикацией включённых визуальных модулей.',
    descriptionEn: 'Live HUD list of active keybound modules and current toggle state.',
  },
  {
    id: 'keystrokes',
    name: 'Keystrokes + CPS',
    category: 'hud',
    keybind: 'K',
    keybindCode: 75,
    enabled: true,
    modes: ['WASD + CPS', 'WASD Compact', 'Mouse Only'],
    modeIndex: 0,
    amount: 95,
    descriptionRu: 'Отклик клавиш WASD / Space с подсветкой нажатий и реальным счётчиком LMB/RMB CPS.',
    descriptionEn: 'Sub-frame WASD & Space indicator paired with live LMB/RMB CPS counter.',
  },
  {
    id: 'armor-hud',
    name: 'Armor & Durability',
    category: 'hud',
    keybind: 'Y',
    keybindCode: 89,
    enabled: true,
    modes: ['Horizontal', 'Vertical', 'Percent'],
    modeIndex: 0,
    amount: 100,
    descriptionRu: 'Индикация надетой брони и основного оружия с цветовым остатком прочности в %.',
    descriptionEn: 'Displays equipped armor slots and main-hand weapon durability percentages.',
  },
  {
    id: 'perf-gauges',
    name: 'Performance Gauges',
    category: 'hud',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Sparkline + RAM', 'Gauges', 'Minimal'],
    modeIndex: 0,
    amount: 80,
    descriptionRu: 'График стабильности кадров в реальном времени, FPS и потребление памяти JVM.',
    descriptionEn: 'Real-time frame-time sparkline, live FPS readout, and JVM heap telemetry.',
  },
  {
    id: 'coords-hud',
    name: 'Coords & BPS',
    category: 'hud',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['XYZ + BPS', 'XYZ Compact'],
    modeIndex: 0,
    amount: 85,
    descriptionRu: 'Точные мировые координаты X / Y / Z и мгновенная скорость движения в блоках/сек.',
    descriptionEn: 'Precise world coordinates X / Y / Z alongside real-time blocks/sec speed.',
  },
  {
    id: 'media-player',
    name: 'Media Player HUD',
    category: 'hud',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Evo Synth', 'Compact Bar'],
    modeIndex: 0,
    amount: 70,
    descriptionRu: 'Анимированный виджет плеера EvoVisual с эквалайзером и полосой воспроизведения.',
    descriptionEn: 'Animated EvoVisual media bar with live spectrum bars and progress track.',
  },
  {
    id: 'arraylist',
    name: 'Active ArrayList',
    category: 'hud',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Glow Bar', 'Pill Right', 'Minimal'],
    modeIndex: 0,
    amount: 90,
    descriptionRu: 'Отсортированный по ширине каскад активных модулей с переливающейся неоновой кромкой.',
    descriptionEn: 'Width-sorted cascade of active modules with animated gradient edge.',
  },

  // === 3. WORLD, PARTICLES & SHADERS ===
  {
    id: 'hit-particles',
    name: 'Hit Particles + Combo',
    category: 'render',
    keybind: 'P',
    keybindCode: 80,
    enabled: true,
    modes: ['End Spark', 'Totem Star', 'Heart', 'Flame', 'Crit'],
    modeIndex: 0,
    amount: 75,
    descriptionRu: 'Всплеск 3D-частиц при ударе (End Spark / Totem / Heart / Flame) и счётчик комбо.',
    descriptionEn: '3D impact burst particles on hit paired with a live melee combo counter.',
  },
  {
    id: 'fireflies',
    name: 'Ambient Fireflies',
    category: 'render',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Neon Glow', 'Soft Gold', 'Aurora'],
    modeIndex: 0,
    amount: 55,
    descriptionRu: 'Парящие в 3D-пространстве светящиеся частицы вокруг игрока в духе EvoVisual.',
    descriptionEn: 'Atmospheric 3D floating firefly orbs drifting gently around the player.',
  },
  {
    id: 'hit-color',
    name: 'Hit Color & Flash',
    category: 'render',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Theme Tint', 'Crimson', 'Ice'],
    modeIndex: 0,
    amount: 70,
    descriptionRu: 'Окрашивает вспышку получения урона на врагах в выбранный акцентный цвет темы.',
    descriptionEn: 'Tints entity damage flash in your active WinVisual theme color.',
  },
  {
    id: 'fullbright',
    name: 'FullBright',
    category: 'render',
    keybind: 'B',
    keybindCode: 66,
    enabled: true,
    modes: ['Gamma Max', 'Soft Cave'],
    modeIndex: 0,
    amount: 100,
    descriptionRu: 'Идеальная видимость в тёмных пещерах, Незере и ночных аренах без факелов.',
    descriptionEn: 'Crystal-clear visibility in caves, Nether fortresses, and night arenas.',
  },
  {
    id: 'ambience',
    name: 'Ambience Time',
    category: 'render',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: false,
    modes: ['Sunset', 'Midnight', 'Noon', 'Crimson Dusk'],
    modeIndex: 0,
    amount: 65,
    descriptionRu: 'Клиентская смена времени суток и атмосферы неба (Закат / Полночь / Полдень / Сумерки).',
    descriptionEn: 'Client-side world time controller for Sunset, Midnight, Noon, or Crimson Dusk.',
  },
  {
    id: 'zoom',
    name: 'Smooth Zoom',
    category: 'render',
    keybind: 'C',
    keybindCode: 67,
    enabled: true,
    modes: ['Cinematic', 'Snap'],
    modeIndex: 0,
    amount: 75,
    descriptionRu: 'Плавное кинематографичное приближение камеры по зажатию клавиши C.',
    descriptionEn: 'Butter-smooth FOV zoom interpolation while holding the C key.',
  },
  {
    id: 'crosshair',
    name: 'Custom Crosshair',
    category: 'render',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Dynamic +', 'Dot Ring', 'T-Cross'],
    modeIndex: 0,
    amount: 60,
    descriptionRu: 'Динамический векторный прицел с отдачей при ударе и настройкой зазора/толщины.',
    descriptionEn: 'Dynamic vector crosshair with hit expansion, outline, and sub-pixel tuning.',
  },

  // === 4. 3D COSMETICS & PHYSICS (EvoVisual Signature) ===
  {
    id: 'china-hat',
    name: 'ChinaHat 3D Halo',
    category: 'cosmetics',
    keybind: 'J',
    keybindCode: 74,
    enabled: true,
    modes: ['Neon Cone', 'Crown Halo', 'Dual Ring'],
    modeIndex: 0,
    amount: 85,
    descriptionRu: 'Вращающаяся 3D-коническая шляпа EvoVisual над головой игрока с градиентным свечением.',
    descriptionEn: 'Rotating 3D translucent gradient cone halo rendered above the player head.',
  },
  {
    id: 'wings',
    name: 'Crystal 3D Wings',
    category: 'cosmetics',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Crystal', 'Dragon', 'Cyber'],
    modeIndex: 0,
    amount: 80,
    descriptionRu: 'Анимированные 3D-крылья за спиной персонажа с плавным взмахом на частоте монитора.',
    descriptionEn: 'Animated 3D articulated wings behind your character synced to frame rate.',
  },
  {
    id: 'jump-circles',
    name: 'Jump Circles 3D',
    category: 'cosmetics',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Shockwave', 'Double Ring', 'Pulse'],
    modeIndex: 0,
    amount: 85,
    descriptionRu: 'Расходящиеся неоновые 3D-кольца на земле при каждом прыжке игрока.',
    descriptionEn: 'Expanding 3D neon ground shockwave rings spawned on every player jump.',
  },
  {
    id: 'trails',
    name: '3D Ribbon Trails',
    category: 'cosmetics',
    keybind: 'V',
    keybindCode: 86,
    enabled: true,
    modes: ['Silk Ribbon', 'Neon Line', 'Spark Trail'],
    modeIndex: 0,
    amount: 80,
    descriptionRu: 'Шёлковый градиентный 3D-шлейф движения за игроком с плавным затуханием.',
    descriptionEn: 'Smooth 3D gradient silk trail following player movement in third person.',
  },
  {
    id: 'shader-cape',
    name: '144Hz Cloth Cape',
    category: 'cosmetics',
    keybind: 'NONE',
    keybindCode: 0,
    enabled: true,
    modes: ['Nebula', 'Pulse', 'Aurora', 'Obsidian'],
    modeIndex: 0,
    amount: 90,
    descriptionRu: 'Пружинная физика плаща 144 Гц с GLSL-шейдером звёздного свечения.',
    descriptionEn: '144Hz spring-mass cape simulation paired with GLSL starlight shading.',
  },
];

let diskSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleHudDiskWrite(trigger: () => Promise<string | null>) {
  if (typeof window === 'undefined' || !window.location?.origin) return;
  if (diskSyncTimer) clearTimeout(diskSyncTimer);
  diskSyncTimer = setTimeout(() => {
    trigger().catch(() => {});
  }, 200);
}

export const useVisualClientStore = create<VisualClientState>()(
  persist(
    (set, get) => ({
      modules: INITIAL_MODULES,
      themeId: 'violet',
      equippedCape: 'nebula',
      crosshair: {
        gap: 4,
        size: 7,
        thickness: 2,
        centerDot: true,
        outline: true,
        accentColor: true,
      },
      hudPositions: DEFAULT_HUD_POSITIONS,
      liveSessionModalOpen: false,
      lastDiskSyncPath: '~/.minecraft/winvisual/config/winvisual-hud.json',
      lastDiskSyncAt: null,

      toggleModule: (id) => {
        set((state) => ({
          modules: state.modules.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
        }));
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      setModuleMode: (id, modeIndex) => {
        set((state) => ({
          modules: state.modules.map((m) =>
            m.id === id
              ? { ...m, modeIndex: Math.max(0, Math.min(m.modes.length - 1, modeIndex)) }
              : m
          ),
        }));
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      setModuleAmount: (id, amount) => {
        set((state) => ({
          modules: state.modules.map((m) =>
            m.id === id ? { ...m, amount: Math.max(0, Math.min(100, Math.round(amount))) } : m
          ),
        }));
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      setModuleKeybind: (id, keyLabel, glfwCode) => {
        set((state) => ({
          modules: state.modules.map((m) =>
            m.id === id ? { ...m, keybind: keyLabel, keybindCode: glfwCode } : m
          ),
        }));
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      setThemeId: (themeId) => {
        set({ themeId });
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      setEquippedCape: (cape) => {
        set({ equippedCape: cape });
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      updateCrosshair: (key, val) => {
        set((state) => ({
          crosshair: { ...state.crosshair, [key]: val },
        }));
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      setHudPosition: (id, x, y) => {
        set((state) => ({
          hudPositions: {
            ...state.hudPositions,
            [id]: { x: Math.round(x), y: Math.round(y) },
          },
        }));
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      resetHudPositions: () => {
        set({ hudPositions: DEFAULT_HUD_POSITIONS });
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      applyPresetProfile: (preset) => {
        set((state) => ({
          themeId:
            preset === 'evovis-esp'
              ? 'violet'
              : preset === 'competitive'
                ? 'crimson'
                : preset === 'pure-fps'
                  ? 'cyber'
                  : 'emerald',
          modules: state.modules.map((m) => {
            if (preset === 'pure-fps') {
              return {
                ...m,
                enabled: [
                  'watermark',
                  'keystrokes',
                  'armor-hud',
                  'coords-hud',
                  'fullbright',
                  'zoom',
                ].includes(m.id),
              };
            }
            if (preset === 'competitive') {
              return {
                ...m,
                enabled: [
                  'player-esp',
                  'health-bar',
                  'nametags',
                  'pearl-trail',
                  'watermark',
                  'keystrokes',
                  'target-hud',
                  'armor-hud',
                  'potions-hud',
                  'hit-particles',
                  'fullbright',
                  'zoom',
                  'crosshair',
                ].includes(m.id),
              };
            }
            if (preset === 'evovis-esp') {
              return { ...m, enabled: true };
            }
            return { ...m, enabled: m.id !== 'tracers' && m.id !== 'mob-esp' };
          }),
        }));
        scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
      },

      exportPresetCode: () => {
        const s = get();
        const payload = {
          v: 3,
          theme: s.themeId,
          cape: s.equippedCape,
          ch: s.crosshair,
          pos: s.hudPositions,
          on: s.modules.filter((m) => m.enabled).map((m) => m.id),
          modes: Object.fromEntries(s.modules.map((m) => [m.id, [m.modeIndex, m.amount]])),
        };
        return `WINVISUAL-${btoa(JSON.stringify(payload))}`;
      },

      importPresetCode: (raw) => {
        try {
          const trimmed = raw.trim();
          const body = trimmed.startsWith('WINVISUAL-') ? trimmed.slice(10) : trimmed;
          const parsed = JSON.parse(atob(body)) as {
            theme?: EvoThemeId;
            cape?: ShaderCapeId;
            ch?: CrosshairSettings;
            pos?: Record<string, HudWidgetPosition>;
            on?: string[];
            modes?: Record<string, [number, number]>;
          };
          if (!Array.isArray(parsed.on)) return false;
          set((state) => ({
            themeId: parsed.theme ?? state.themeId,
            equippedCape: parsed.cape ?? state.equippedCape,
            crosshair: parsed.ch ? { ...state.crosshair, ...parsed.ch } : state.crosshair,
            hudPositions: parsed.pos
              ? { ...DEFAULT_HUD_POSITIONS, ...parsed.pos }
              : state.hudPositions,
            modules: state.modules.map((m) => {
              const tuple = parsed.modes?.[m.id];
              return {
                ...m,
                enabled: parsed.on!.includes(m.id),
                modeIndex: tuple ? tuple[0] : m.modeIndex,
                amount: tuple ? tuple[1] : m.amount,
              };
            }),
          }));
          scheduleHudDiskWrite(() => get().persistHudConfigToDisk());
          return true;
        } catch {
          return false;
        }
      },

      persistHudConfigToDisk: async () => {
        const s = get();
        const gameDir = useSettingsStore.getState().gameDirectory;
        const payload: PersistedHudDiskSchema = {
          version: '2.7.0',
          themeId: s.themeId,
          equippedCape: s.equippedCape,
          crosshair: s.crosshair,
          hudPositions: s.hudPositions,
          modules: s.modules.map((m) => ({
            id: m.id,
            enabled: m.enabled,
            modeIndex: m.modeIndex,
            amount: m.amount,
            keybind: m.keybind,
            keybindCode: m.keybindCode,
          })),
          savedAt: new Date().toISOString(),
        };
        const savedPath = await saveHudConfigEverywhere(
          gameDir,
          JSON.stringify(payload, null, 2)
        );
        if (savedPath) {
          set({
            lastDiskSyncPath: savedPath,
            lastDiskSyncAt: new Date().toLocaleTimeString('en-GB'),
          });
        }
        return savedPath;
      },

      hydrateHudConfigFromDisk: async () => {
        const gameDir = useSettingsStore.getState().gameDirectory;
        const raw = await loadHudConfigEverywhere(gameDir);
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw) as Partial<PersistedHudDiskSchema>;
          const modMap = new Map((parsed.modules ?? []).map((item) => [item.id, item]));
          set((state) => ({
            themeId: parsed.themeId ?? state.themeId,
            equippedCape: parsed.equippedCape ?? state.equippedCape,
            crosshair: parsed.crosshair ? { ...state.crosshair, ...parsed.crosshair } : state.crosshair,
            hudPositions: parsed.hudPositions
              ? { ...DEFAULT_HUD_POSITIONS, ...parsed.hudPositions }
              : state.hudPositions,
            modules:
              modMap.size > 0
                ? state.modules.map((m) => {
                    const hit = modMap.get(m.id);
                    if (!hit) return m;
                    return {
                      ...m,
                      enabled: Boolean(hit.enabled),
                      modeIndex: typeof hit.modeIndex === 'number' ? hit.modeIndex : m.modeIndex,
                      amount: typeof hit.amount === 'number' ? hit.amount : m.amount,
                      keybindCode:
                        typeof hit.keybindCode === 'number' ? hit.keybindCode : m.keybindCode,
                    };
                  })
                : state.modules,
            lastDiskSyncPath: `${gameDir}/config/winvisual-hud.json`,
          }));
          return true;
        } catch {
          return false;
        }
      },

      setLiveSessionModalOpen: (open) => set({ liveSessionModalOpen: open }),
    }),
    {
      name: 'winvisual-modules-v4',
      partialize: (s) => ({
        modules: s.modules,
        themeId: s.themeId,
        equippedCape: s.equippedCape,
        crosshair: s.crosshair,
        hudPositions: s.hudPositions,
      }),
    }
  )
);
