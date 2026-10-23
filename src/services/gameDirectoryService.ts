import {
  isTauriDesktop,
  tauriGetGameDirectoryTree,
  tauriInitGameDirectory,
  type GameDirEntry,
  type GameDirInitResult,
} from './tauriBridge';

export type { GameDirEntry, GameDirInitResult } from './tauriBridge';

/**
 * WinVisual game directory (EvoVisual-style structure):
 *   WinVisual/
 *   ├── mods/           — WinVisual client mod + Fabric API + optimization mods
 *   ├── resourcepacks/  — texture & GUI resource packs
 *   ├── shaderpacks/    — GLSL shader packs
 *   ├── config/         — WinVisual HUD / module configuration
 *   ├── logs/           — launcher & game logs (latest.log, dated archives)
 *   ├── screenshots/    — F2 screenshots
 *   ├── saves/          — singleplayer worlds
 *   ├── versions/       — downloaded Minecraft client versions
 *   ├── libraries/      — Java libraries resolved by the launcher
 *   ├── assets/         — textures, sounds & fonts
 *   └── runtime/        — auto-provisioned Mojang Java runtimes
 */
export async function initGameDirectoryEverywhere(
  gameDirectory: string
): Promise<GameDirInitResult | null> {
  if (isTauriDesktop()) {
    try {
      return await tauriInitGameDirectory(gameDirectory);
    } catch {
      return null;
    }
  }
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }
  try {
    const res = await fetch(
      `/api/game-dir/init?dir=${encodeURIComponent(gameDirectory)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    return (await res.json()) as GameDirInitResult;
  } catch {
    return null;
  }
}

export async function getGameDirectoryTreeEverywhere(
  gameDirectory: string
): Promise<GameDirEntry[] | null> {
  if (isTauriDesktop()) {
    try {
      return await tauriGetGameDirectoryTree(gameDirectory);
    } catch {
      return null;
    }
  }
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }
  try {
    const res = await fetch(`/api/game-dir/tree?dir=${encodeURIComponent(gameDirectory)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { folders: GameDirEntry[] };
    return data.folders ?? [];
  } catch {
    return null;
  }
}

export function formatGameDirBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
