import type { ClientVersion, NewsArticle, SystemTelemetry } from '../types/launcher';
import { CANONICAL_NEWS, CANONICAL_VERSIONS } from '../data/catalogData';
import { isTauriDesktop, tauriGetHostTelemetry } from './tauriBridge';

export async function fetchSystemTelemetry(): Promise<SystemTelemetry> {
  if (isTauriDesktop()) {
    const nativeTel = await tauriGetHostTelemetry();
    if (nativeTel) return nativeTel;
  }

  try {
    const t0 = performance.now();
    const res = await fetch('/api/status', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Telemetry HTTP ${res.status}`);
    }
    const rtt = Math.max(1, Math.round(performance.now() - t0));
    const data = await res.json();
    return {
      ...data,
      latencyMs: rtt,
    };
  } catch {
    // Backend unreachable: report an honest offline state instead of
    // fabricating a green "all systems operational" telemetry snapshot.
    return {
      operational: false,
      launcherVersion: '2.7.5',
      uptimeSeconds: 0,
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'Desktop OS' : 'Desktop OS',
      cpuCores:
        typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8,
      cpuUsagePercent: 0,
      hostTotalMemoryMb: 0,
      hostUsedMemoryMb: 0,
      activePid: null,
      latencyMs: 0,
      java: {
        installed: false,
        path: '',
        version: 'Unknown (offline)',
      },
      services: {
        manifestApi: 'offline',
        assetCdn: 'offline',
        skinRenderer: 'offline',
        microsoftOAuth: 'offline',
      },
      onlinePlayers: 0,
    };
  }
}

export async function fetchClientVersions(channel: string = 'all'): Promise<ClientVersion[]> {
  if (isTauriDesktop()) {
    return channel && channel !== 'all'
      ? CANONICAL_VERSIONS.filter((v) => v.channel === channel)
      : CANONICAL_VERSIONS;
  }

  try {
    const res = await fetch(`/api/versions?channel=${encodeURIComponent(channel)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch versions (HTTP ${res.status})`);
    }
    const data = await res.json();
    return (data.versions ?? CANONICAL_VERSIONS) as ClientVersion[];
  } catch {
    return channel && channel !== 'all'
      ? CANONICAL_VERSIONS.filter((v) => v.channel === channel)
      : CANONICAL_VERSIONS;
  }
}

export async function fetchNewsFeed(): Promise<NewsArticle[]> {
  if (isTauriDesktop()) {
    return CANONICAL_NEWS;
  }

  try {
    const res = await fetch('/api/news', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to fetch news feed (HTTP ${res.status})`);
    }
    const data = await res.json();
    return (data.items ?? data.articles ?? CANONICAL_NEWS) as NewsArticle[];
  } catch {
    return CANONICAL_NEWS;
  }
}
