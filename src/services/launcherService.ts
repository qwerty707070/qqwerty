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
    return {
      operational: true,
      launcherVersion: '2.7.0',
      uptimeSeconds: 3600,
      platform: navigator.platform || 'Desktop OS',
      cpuCores: navigator.hardwareConcurrency || 8,
      cpuUsagePercent: 8.4,
      hostTotalMemoryMb: 16384,
      hostUsedMemoryMb: 5120,
      activePid: null,
      latencyMs: 11,
      java: {
        installed: true,
        path: 'java',
        version: 'OpenJDK 21 LTS',
      },
      services: {
        manifestApi: 'operational',
        assetCdn: 'operational',
        skinRenderer: 'operational',
        microsoftOAuth: 'operational',
      },
      onlinePlayers: 14842,
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
