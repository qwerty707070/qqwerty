import type { ClientVersion, NewsArticle } from '../types/launcher';

export const GITHUB_RELEASE_URL =
  'https://github.com/qwerty707070/qqwerty/releases/tag/v2.7.5';

export const CANONICAL_VERSIONS: ClientVersion[] = [
  {
    id: 'winvisual-1.21.11',
    name: 'WinVisual 1.21.11',
    minecraftVersion: '1.21.11',
    channel: 'stable',
    recommended: true,
    updatedAt: '2026-10-23',
    sizeMb: 31.4,
    loader: 'WinVisual 1.21.11 • Fabric',
    fpsBoost: '',
    modulesCount: 28,
    summaryEn:
      'Flagship WinVisual 1.21.11 build with embedded client mod: 2D/3D ESP, Rotating Minimap, ChinaHat, Crystal Wings, JumpCircles, 11 HUD 2.0 widgets, and Right-Shift Studio.',
    summaryRu:
      'Флагманская сборка WinVisual 1.21.11 со вшитым клиент-модом: ESP, вращающийся радар, ChinaHat, 3D-крылья, JumpCircles, 11 виджетов HUD 2.0 и меню Right Shift.',
    highlightsRu: ['WinVisual 1.21.11', 'HUD 2.0 + ChinaHat + Крылья'],
    highlightsEn: ['WinVisual 1.21.11', 'HUD 2.0 + ChinaHat + Wings'],
  },
  {
    id: 'winvisual-1.21.4',
    name: 'WinVisual 1.21.4',
    minecraftVersion: '1.21.4',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-23',
    sizeMb: 29.9,
    loader: 'WinVisual 1.21.4 • Fabric',
    fpsBoost: '',
    modulesCount: 28,
    summaryEn:
      'Tournament WinVisual 1.21.4 build with embedded client mod: Player/Item/Pearl ESP, Target HUD 2.0, Keystrokes + CPS, 3D Trails, HitParticles, and live config sync.',
    summaryRu:
      'Турнирная сборка WinVisual 1.21.4 со вшитым клиент-модом: Player/Item/Pearl ESP, Target HUD 2.0, Keystrokes + CPS, 3D-шлейфы, HitParticles и живая синхронизация конфигов.',
    highlightsRu: ['WinVisual 1.21.4', 'Target HUD 2.0 + Pearl ESP'],
    highlightsEn: ['WinVisual 1.21.4', 'Target HUD 2.0 + Pearl ESP'],
  },
  {
    id: 'winvisual-1.16.5',
    name: 'WinVisual 1.16.5',
    minecraftVersion: '1.16.5',
    channel: 'stable',
    recommended: false,
    updatedAt: '2026-10-23',
    sizeMb: 23.8,
    loader: 'WinVisual 1.16.5 • Fabric',
    fpsBoost: '',
    modulesCount: 28,
    summaryEn:
      'Classic PvP WinVisual 1.16.5 build with embedded client mod: all 28 WinVisual + ESP modules, 6 neon themes, 3D cosmetics, and Right-Shift ClickGUI.',
    summaryRu:
      'Классическая PvP-сборка WinVisual 1.16.5 со вшитым клиент-модом: все 28 модулей WinVisual + ESP, 6 тем оформления, 3D-косметика и внутриигровой ClickGUI.',
    highlightsRu: ['WinVisual 1.16.5', 'Полный паритет 28 модулей'],
    highlightsEn: ['WinVisual 1.16.5', 'Full 28-Module Parity'],
  },
];

export const CANONICAL_NEWS: NewsArticle[] = [];
