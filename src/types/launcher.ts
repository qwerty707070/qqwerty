export type PageRoute =
  | 'home'
  | 'modules'
  | 'news'
  | 'versions'
  | 'resources'
  | 'settings'
  | 'account';

export type VersionChannel = 'all' | 'stable' | 'beta';

export interface ClientVersion {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: string;
  channel: 'stable' | 'beta';
  recommended: boolean;
  updatedAt: string;
  sizeMb: number;
  modulesCount: number;
  fpsBoost: string;
  summaryRu: string;
  summaryEn: string;
  highlightsRu: string[];
  highlightsEn: string[];
}

export interface NewsArticle {
  id: string;
  categoryRu: string;
  categoryEn: string;
  dateRu: string;
  dateEn: string;
  readTimeRu: string;
  readTimeEn: string;
  image: string;
  featured: boolean;
  titleRu: string;
  titleEn: string;
  excerptRu: string;
  excerptEn: string;
  bodyRu: string[];
  bodyEn: string[];
}

export interface SystemTelemetry {
  operational: boolean;
  launcherVersion: string;
  uptimeSeconds: number;
  platform: string;
  cpuCores: number;
  cpuUsagePercent?: number;
  hostTotalMemoryMb: number;
  hostUsedMemoryMb?: number;
  activePid?: number | null;
  latencyMs: number;
  java: {
    installed: boolean;
    path: string;
    version: string;
  };
  services: {
    manifestApi: string;
    assetCdn: string;
    skinRenderer: string;
    microsoftOAuth: string;
  };
  onlinePlayers: number;
}

export type LaunchPhase =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'verifying'
  | 'launching'
  | 'running'
  | 'error';

export interface DownloadProgressState {
  active: boolean;
  versionId: string;
  versionName: string;
  currentFile: string;
  stageLabel: string;
  downloadedBytes: number;
  totalBytes: number;
  speedMbps: number;
  etaSeconds: number | null;
  verifiedFiles: number;
  totalFiles: number;
  lastSha256: string;
  errorMessage: string | null;
}

export type AccountAuthType = 'local' | 'microsoft' | 'microsoft-demo';

export interface PlayerAccount {
  id: string;
  username: string;
  uuid: string;
  authType: AccountAuthType;
  skinPreset: 'winvisual' | 'obsidian' | 'classic' | 'slim';
  skinModel?: 'classic' | 'slim';
  customSkinDataUrl?: string | null;
  capeName: string;
  online: boolean;
  lastUsed: string;
}

export type LanguageCode = 'ru' | 'en';
export type SurfaceTheme = 'default' | 'obsidian' | 'midnight';
export type AnimationIntensity = 'high' | 'balanced' | 'minimal';

export interface AccentPreset {
  id: string;
  labelRu: string;
  labelEn: string;
  primary: string;
  secondary: string;
  rgb: string;
}
