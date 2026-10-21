import type { SystemTelemetry } from '../types/launcher';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      transformCallback?: (cb: (payload: unknown) => void, once?: boolean) => number;
    };
  }
}

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
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
}

export async function tauriLaunchMinecraft(request: NativeLaunchPayload): Promise<number> {
  return window.__TAURI_INTERNALS__!.invoke<number>('launch_native_client', { request });
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
