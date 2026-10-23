import type { SystemTelemetry } from '../types/launcher';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      transformCallback?: (cb: (payload: unknown) => void, once?: boolean) => number;
    };
  }
}

export const GITHUB_RELEASE_URL =
  'https://github.com/qwerty707070/qqwerty/releases/tag/v2.6.1';

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

function hasBrowserOrigin(): boolean {
  return typeof window !== 'undefined' && Boolean(window.location?.origin);
}

export async function tauriMinimizeWindow(): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    await window.__TAURI_INTERNALS__!.invoke('plugin:window|minimize', { label: 'main' });
    return true;
  } catch {
    return false;
  }
}

export async function tauriToggleMaximizeWindow(): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    await window.__TAURI_INTERNALS__!.invoke('plugin:window|toggle_maximize', { label: 'main' });
    return true;
  } catch {
    return false;
  }
}

export async function tauriCloseWindow(): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    await window.__TAURI_INTERNALS__!.invoke('plugin:window|close', { label: 'main' });
    return true;
  } catch {
    return false;
  }
}

export async function tauriStartDragging(): Promise<void> {
  if (!isTauriDesktop()) return;
  try {
    await window.__TAURI_INTERNALS__!.invoke('plugin:window|start_dragging', { label: 'main' });
  } catch {
    // Ignore outside frameless window
  }
}

export async function tauriGetHostTelemetry(): Promise<SystemTelemetry | null> {
  if (!isTauriDesktop()) return null;
  try {
    return await window.__TAURI_INTERNALS__!.invoke<SystemTelemetry>('get_host_telemetry');
  } catch {
    return null;
  }
}

export async function tauriDetectJava(): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  try {
    return await window.__TAURI_INTERNALS__!.invoke<string>('detect_java_runtime');
  } catch {
    return null;
  }
}

export async function tauriPickDirectory(initialDir?: string): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  try {
    return await window.__TAURI_INTERNALS__!.invoke<string | null>('pick_directory_dialog', {
      initialDir: initialDir ?? null,
    });
  } catch {
    return null;
  }
}

export async function tauriPickJavaBinary(initialPath?: string): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  try {
    return await window.__TAURI_INTERNALS__!.invoke<string | null>('pick_java_binary_dialog', {
      initialPath: initialPath ?? null,
    });
  } catch {
    return null;
  }
}

export async function tauriClearClientCache(gameDirectory: string): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    await window.__TAURI_INTERNALS__!.invoke('clear_client_cache', { gameDirectory });
    return true;
  } catch {
    return false;
  }
}

export async function tauriOpenGameFolder(gameDirectory: string): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    await window.__TAURI_INTERNALS__!.invoke('open_game_folder', { gameDirectory });
    return true;
  } catch {
    return false;
  }
}

export interface NativeDeviceCodeSession {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface NativeMinecraftProfile {
  uuid: string;
  username: string;
  skinUrl?: string;
  tokenStoredInKeychain: boolean;
}

export async function tauriStartMsDeviceFlow(clientId: string): Promise<NativeDeviceCodeSession> {
  return window.__TAURI_INTERNALS__!.invoke<NativeDeviceCodeSession>('start_ms_device_flow', {
    clientId,
  });
}

export async function tauriCompleteMsDeviceFlow(
  clientId: string,
  deviceCode: string
): Promise<NativeMinecraftProfile> {
  return window.__TAURI_INTERNALS__!.invoke<NativeMinecraftProfile>('complete_ms_device_flow', {
    clientId,
    deviceCode,
  });
}

export interface NativeLaunchPayload {
  minecraftVersion: string;
  fabricLoaderVersion: string;
  username: string;
  uuid: string;
  ramMb: number;
  javaPath: string;
  gameDirectory: string;
  jvmArguments: string;
  speedLimitMbps: number;
  optimizeModsBundle: boolean;
}

export interface ModBundleSyncResult {
  minecraftVersion: string;
  syncedMods: string[];
  modsDir: string;
}

export async function tauriLaunchMinecraft(request: NativeLaunchPayload): Promise<number> {
  return window.__TAURI_INTERNALS__!.invoke<number>('launch_native_client', { request });
}

export async function tauriCancelNativeLaunch(): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    return await window.__TAURI_INTERNALS__!.invoke<boolean>('cancel_native_launch');
  } catch {
    return false;
  }
}

export async function tauriStopClientProcess(): Promise<number> {
  if (!isTauriDesktop()) return 0;
  try {
    return await window.__TAURI_INTERNALS__!.invoke<number>('stop_client_process');
  } catch {
    return 0;
  }
}

export async function syncOptimizationModsEverywhere(
  gameDirectory: string,
  minecraftVersion: string
): Promise<ModBundleSyncResult> {
  if (isTauriDesktop()) {
    return window.__TAURI_INTERNALS__!.invoke<ModBundleSyncResult>('sync_optimization_mods', {
      gameDirectory,
      minecraftVersion,
    });
  }
  if (!hasBrowserOrigin()) {
    return {
      minecraftVersion,
      syncedMods: [
        `Fabric API (${minecraftVersion})`,
        `Sodium (${minecraftVersion})`,
        `Iris Shaders (${minecraftVersion})`,
        `Lithium (${minecraftVersion})`,
      ],
      modsDir: `${gameDirectory}/mods`,
    };
  }
  const res = await fetch(
    `/api/mods/bundle?mc=${encodeURIComponent(minecraftVersion)}&dir=${encodeURIComponent(gameDirectory)}`
  );
  if (!res.ok) {
    throw new Error('Failed to synchronize optimization mod bundle');
  }
  return res.json();
}

export async function resolveMinecraftSkinEverywhere(
  username: string
): Promise<{ dataUrl: string; slim: boolean }> {
  const clean = username.trim();
  if (!clean) {
    throw new Error('Username is empty');
  }
  if (isTauriDesktop()) {
    try {
      const dataUrl = await window.__TAURI_INTERNALS__!.invoke<string>('fetch_minecraft_skin', {
        username: clean,
      });
      return { dataUrl, slim: false };
    } catch {
      // Fallback to deterministic generator if profile has no public Mojang texture or offline
    }
  }
  if (hasBrowserOrigin()) {
    const res = await fetch(`/api/skin/resolve?username=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const json = (await res.json()) as { skinDataUrl: string; slim?: boolean };
      return { dataUrl: json.skinDataUrl, slim: Boolean(json.slim) };
    }
  }
  throw new Error(`Could not resolve skin for ${clean}`);
}

export async function saveHudConfigEverywhere(
  gameDirectory: string,
  configJson: string
): Promise<string | null> {
  if (isTauriDesktop()) {
    try {
      return await window.__TAURI_INTERNALS__!.invoke<string>('save_hud_config_disk', {
        gameDirectory,
        configJson,
      });
    } catch {
      return null;
    }
  }
  if (!hasBrowserOrigin()) {
    return null;
  }
  try {
    const res = await fetch('/api/config/hud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: configJson,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { savedPath?: string };
    return data.savedPath ?? `${gameDirectory}/config/winvisual-hud.json`;
  } catch {
    return null;
  }
}

export async function loadHudConfigEverywhere(gameDirectory: string): Promise<string | null> {
  if (isTauriDesktop()) {
    try {
      return await window.__TAURI_INTERNALS__!.invoke<string | null>('load_hud_config_disk', {
        gameDirectory,
      });
    } catch {
      return null;
    }
  }
  if (!hasBrowserOrigin()) {
    return null;
  }
  try {
    const res = await fetch('/api/config/hud');
    if (!res.ok) return null;
    const data = (await res.json()) as { config?: unknown };
    return data.config ? JSON.stringify(data.config) : null;
  } catch {
    return null;
  }
}

export async function tauriListenEvent<T>(
  event: string,
  onPayload: (payload: T) => void
): Promise<() => void> {
  if (!isTauriDesktop() || !window.__TAURI_INTERNALS__?.transformCallback) {
    return () => {};
  }
  try {
    const handlerId = window.__TAURI_INTERNALS__.transformCallback((msg: unknown) => {
      const eventObj = msg as { payload?: T };
      if (eventObj && 'payload' in eventObj && eventObj.payload !== undefined) {
        onPayload(eventObj.payload);
      }
    });
    const eventId = await window.__TAURI_INTERNALS__.invoke<number>('plugin:event|listen', {
      event,
      target: { kind: 'Any' },
      handler: handlerId,
    });
    return () => {
      window.__TAURI_INTERNALS__
        ?.invoke('plugin:event|unlisten', { event, eventId })
        .catch(() => {});
    };
  } catch {
    return () => {};
  }
}
