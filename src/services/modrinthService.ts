import {
  isTauriDesktop,
  tauriDownloadModrinthResource,
  tauriSearchModrinth,
  type ModrinthHit,
  type ModrinthProgress,
} from './tauriBridge';

export type ModrinthResourceType = 'mod' | 'resourcepack';

const MODRINTH_API = 'https://api.modrinth.com';

interface ResolvedModrinthVersion {
  slug: string;
  versionNumber: string;
  filename: string;
  url: string;
  sha1: string | null;
}

/**
 * The Modrinth API returns list endpoints either as a bare JSON array or as an
 * enveloped object ({"hits": [...]} for search, {"versions": [...]} for project
 * versions). This extracts the item list from both shapes.
 */
function extractJsonList(
  data: unknown,
  preferredKey: string
): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[preferredKey])) {
      return obj[preferredKey] as Array<Record<string, unknown>>;
    }
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
    }
  }
  return [];
}

async function browserSearch(
  query: string,
  resourceType: ModrinthResourceType,
  gameVersion: string
): Promise<ModrinthHit[]> {
  const facets =
    resourceType === 'resourcepack'
      ? JSON.stringify([
          ['project_types:resourcepack'],
          [`game_versions:${gameVersion}`],
        ])
      : JSON.stringify([
          ['project_types:mod'],
          ['loaders:fabric'],
          [`game_versions:${gameVersion}`],
        ]);
  const params = new URLSearchParams({ limit: '24', index: 'downloads', facets });
  if (query.trim()) params.set('query', query.trim());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${MODRINTH_API}/v2/search?${params.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Modrinth API HTTP ${res.status}`);
    const hits = extractJsonList(await res.json(), 'hits');
    return hits
      .filter((h) => typeof h.slug === 'string' && (h.slug as string).length > 0)
      .map((h) => ({
        slug: h.slug as string,
        title: (h.title as string) || (h.slug as string),
        description: (h.description as string) ?? '',
        iconUrl: (h.icon_url as string) ?? '',
        downloads: (h.downloads as number) ?? 0,
        gameVersions: Array.isArray(h.game_versions) ? (h.game_versions as string[]) : [],
        projectType: (h.project_type as string) || resourceType,
      }));
  } finally {
    clearTimeout(timer);
  }
}

async function proxySearch(
  query: string,
  resourceType: ModrinthResourceType,
  gameVersion: string
): Promise<ModrinthHit[]> {
  const params = new URLSearchParams({
    query,
    type: resourceType,
    ver: gameVersion,
  });
  const res = await fetch(`/api/modrinth/search?${params.toString()}`, { cache: 'no-store' });
  const data = (await res.json()) as { error?: string; [key: string]: unknown };
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Modrinth proxy HTTP ${res.status}`);
  }
  return data as unknown as ModrinthHit[];
}

async function browserResolveVersion(
  slug: string,
  resourceType: ModrinthResourceType,
  gameVersion: string
): Promise<ResolvedModrinthVersion> {
  const params = new URLSearchParams({ game_versions: JSON.stringify([gameVersion]) });
  if (resourceType === 'mod') params.set('loaders', JSON.stringify(['fabric']));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${MODRINTH_API}/v2/project/${slug}/version?${params.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Modrinth API HTTP ${res.status}`);
    const versions = extractJsonList(await res.json(), 'versions') as Array<{
      version_number?: string;
      files?: Array<{ url?: string; filename?: string; primary?: boolean; hashes?: Record<string, string> }>;
    }>;
    const version = versions[0];
    const files = version && Array.isArray(version.files) ? version.files : [];
    const file = files.find((f) => f.primary) ?? files[0];
    if (!file?.url || !file.filename) {
      throw new Error(`No ${resourceType} version of ${slug} for Minecraft ${gameVersion}`);
    }
    return {
      slug,
      versionNumber: version?.version_number ?? '',
      filename: file.filename,
      url: file.url,
      sha1: file.hashes?.sha1 ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function proxyResolveVersion(
  slug: string,
  resourceType: ModrinthResourceType,
  gameVersion: string
): Promise<ResolvedModrinthVersion> {
  const params = new URLSearchParams({ slug, type: resourceType, ver: gameVersion });
  const res = await fetch(`/api/modrinth/version?${params.toString()}`, { cache: 'no-store' });
  const data = (await res.json()) as ResolvedModrinthVersion & { error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Modrinth proxy HTTP ${res.status}`);
  }
  return data;
}

/**
 * Search Modrinth live. Desktop: native Rust client. Web: the user's browser talks to
 * api.modrinth.com directly, falling back to the launcher backend proxy.
 */
export async function searchModrinthEverywhere(
  query: string,
  resourceType: ModrinthResourceType,
  gameVersion: string
): Promise<ModrinthHit[]> {
  if (isTauriDesktop()) {
    return tauriSearchModrinth(query, resourceType, gameVersion);
  }
  if (typeof window === 'undefined' || !window.location?.origin) {
    return [];
  }
  try {
    return await browserSearch(query, resourceType, gameVersion);
  } catch {
    return await proxySearch(query, resourceType, gameVersion);
  }
}

export interface ModrinthDownloadResult {
  savedTo: string;
  mode: 'game-folder' | 'browser-download';
  filename: string;
  bytes: number;
}

/**
 * Download a Modrinth project straight into the WinVisual game folder.
 * Desktop: Rust streams + SHA-1 verifies into WinVisual/mods|resourcepacks.
 * Web: the browser streams the real file (with progress) and saves it via the
 * download manager — the game folder sync happens in the desktop launcher.
 */
export async function downloadModrinthResourceEverywhere(
  slug: string,
  resourceType: ModrinthResourceType,
  gameVersion: string,
  gameDirectory: string,
  onProgress?: (p: ModrinthProgress) => void,
  signal?: AbortSignal
): Promise<ModrinthDownloadResult> {
  if (isTauriDesktop()) {
    const dest = await tauriDownloadModrinthResource(slug, resourceType, gameVersion, gameDirectory);
    const filename = dest.split(/[\\/]/).pop() ?? slug;
    return { savedTo: dest, mode: 'game-folder', filename, bytes: 0 };
  }

  if (typeof window === 'undefined' || !window.location?.origin) {
    throw new Error('Modrinth downloads are available in the desktop launcher');
  }

  let resolved: ResolvedModrinthVersion;
  try {
    resolved = await browserResolveVersion(slug, resourceType, gameVersion);
  } catch {
    resolved = await proxyResolveVersion(slug, resourceType, gameVersion);
  }

  onProgress?.({
    slug,
    filename: resolved.filename,
    downloadedBytes: 0,
    totalBytes: 0,
    stage: 'resolving',
  });

  try {
    const res = await fetch(resolved.url, { cache: 'no-store', signal });
    if (!res.ok || !res.body) {
      throw new Error(`Modrinth CDN HTTP ${res.status}`);
    }
    const total = Number(res.headers.get('content-length') ?? 0);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let downloaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        downloaded += value.length;
        onProgress?.({
          slug,
          filename: resolved.filename,
          downloadedBytes: downloaded,
          totalBytes: total,
          stage: 'downloading',
        });
      }
    }
    const blob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = resolved.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    return {
      savedTo: resolved.filename,
      mode: 'browser-download',
      filename: resolved.filename,
      bytes: downloaded,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    // CORS/network fallback: let the browser download the file directly
    window.open(resolved.url, '_blank', 'noopener,noreferrer');
    return {
      savedTo: resolved.filename,
      mode: 'browser-download',
      filename: resolved.filename,
      bytes: 0,
    };
  }
}
