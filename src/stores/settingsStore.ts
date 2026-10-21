import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AccentPreset,
  AnimationIntensity,
  LanguageCode,
  SurfaceTheme,
} from '../types/launcher';

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'violet',
    labelRu: 'Aether Violet',
    labelEn: 'Aether Violet',
    primary: '#8B7CFF',
    secondary: '#A69BFF',
    rgb: '139, 124, 255',
  },
  {
    id: 'orchid',
    labelRu: 'Pulse Orchid',
    labelEn: 'Pulse Orchid',
    primary: '#9D6BFF',
    secondary: '#BA94FF',
    rgb: '157, 107, 255',
  },
  {
    id: 'indigo',
    labelRu: 'Cobalt Iris',
    labelEn: 'Cobalt Iris',
    primary: '#6E7BFF',
    secondary: '#939DFF',
    rgb: '110, 123, 255',
  },
  {
    id: 'ice',
    labelRu: 'Glacier Mist',
    labelEn: 'Glacier Mist',
    primary: '#5EA8FF',
    secondary: '#8CC2FF',
    rgb: '94, 168, 255',
  },
];

export interface SettingsState {
  // General
  language: LanguageCode;
  surfaceTheme: SurfaceTheme;
  startWithSystem: boolean;
  minimizeOnLaunch: boolean;
  closeAfterLaunch: boolean;

  // Minecraft
  ramAllocationMb: number;
  javaPath: string;
  gameDirectory: string;
  jvmArguments: string;

  // Launcher
  hardwareAcceleration: boolean;
  notificationsEnabled: boolean;
  autoUpdates: boolean;
  downloadSpeedLimitMbps: number; // 0 = unlimited

  // Appearance
  accentId: string;
  backgroundEffects: boolean;
  animationIntensity: AnimationIntensity;
  reducedMotion: boolean;

  updateSetting: <K extends keyof Omit<SettingsState, 'updateSetting' | 'resetDefaults'>>(
    key: K,
    value: SettingsState[K]
  ) => void;
  resetDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  language: 'ru' as LanguageCode,
  surfaceTheme: 'default' as SurfaceTheme,
  startWithSystem: false,
  minimizeOnLaunch: true,
  closeAfterLaunch: false,

  ramAllocationMb: 6144,
  javaPath: '/usr/lib/jvm/temurin-21-jdk/bin/java',
  gameDirectory: '~/.minecraft/aether-visual',
  jvmArguments:
    '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50',

  hardwareAcceleration: true,
  notificationsEnabled: true,
  autoUpdates: true,
  downloadSpeedLimitMbps: 0,

  accentId: 'violet',
  backgroundEffects: true,
  animationIntensity: 'high' as AnimationIntensity,
  reducedMotion: false,
};

export function syncAppearanceTokensToDom(state: Pick<
  SettingsState,
  'accentId' | 'surfaceTheme' | 'reducedMotion' | 'animationIntensity'
>): void {
  if (typeof document === 'undefined') return;
  const preset = ACCENT_PRESETS.find((p) => p.id === state.accentId) ?? ACCENT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', preset.primary);
  root.style.setProperty('--accent-secondary', preset.secondary);
  root.style.setProperty('--accent-rgb', preset.rgb);
  root.style.setProperty('--accent-glow', `rgba(${preset.rgb}, 0.35)`);
  root.style.setProperty('--accent-subtle', `rgba(${preset.rgb}, 0.12)`);
  root.setAttribute('data-surface-theme', state.surfaceTheme);
  root.setAttribute(
    'data-reduced-motion',
    state.reducedMotion || state.animationIntensity === 'minimal' ? 'true' : 'false'
  );
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      updateSetting: (key, value) => {
        set({ [key]: value } as Partial<SettingsState>);
        syncAppearanceTokensToDom(get());
      },
      resetDefaults: () => {
        set({ ...DEFAULT_SETTINGS });
        syncAppearanceTokensToDom(DEFAULT_SETTINGS);
      },
    }),
    {
      name: 'aether-visual-settings-v2',
      onRehydrateStorage: () => (state) => {
        if (state) {
          syncAppearanceTokensToDom(state);
        }
      },
    }
  )
);
