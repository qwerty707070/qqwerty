import { computeSha256Hex } from '../utils/sha256';

export interface ArtifactSpec {
  id: string;
  label: string;
  sizeBytes: number;
  sha256: string;
}

export interface DownloadManifest {
  versionId: string;
  versionName: string;
  minecraftVersion: string;
  totalBytes: number;
  artifacts: ArtifactSpec[];
}

export interface StreamProgressCallbackPayload {
  currentFile: string;
  stageLabel: string;
  downloadedBytes: number;
  totalBytes: number;
  speedMbps: number;
  etaSeconds: number | null;
  verifiedFiles: number;
  totalFiles: number;
  lastSha256: string;
}

export async function installAndVerifyClientBuild(options: {
  versionId: string;
  speedLimitMbps: number;
  simulateNetworkDrop: boolean;
  signal: AbortSignal;
  onLog: (line: string) => void;
  onPhaseChange: (phase: 'preparing' | 'downloading' | 'verifying' | 'launching') => void;
  onProgress: (payload: StreamProgressCallbackPayload) => void;
}): Promise<{ verifiedArtifacts: number; totalBytes: number }> {
  const { versionId, speedLimitMbps, simulateNetworkDrop, signal, onLog, onPhaseChange, onProgress } =
    options;

  onPhaseChange('preparing');
  onLog(`[INIT] Resolving signed build manifest for ${versionId}...`);

  const manifestRes = await fetch(`/api/download/manifest/${encodeURIComponent(versionId)}`, {
    signal,
    cache: 'no-store',
  });
  if (!manifestRes.ok) {
    throw new Error(`Manifest request failed (HTTP ${manifestRes.status})`);
  }
  const manifest = (await manifestRes.json()) as DownloadManifest;
  onLog(
    `[MANIFEST] Resolved ${manifest.artifacts.length} signed packages (${(
      manifest.totalBytes /
      (1024 * 1024)
    ).toFixed(1)} MB total)`
  );

  let cumulativeDownloaded = 0;
  let verifiedCount = 0;
  let lastDigest = '';
  const overallStart = performance.now();

  for (const artifact of manifest.artifacts) {
    if (signal.aborted) {
      throw new DOMException('Installation cancelled by user', 'AbortError');
    }

    onPhaseChange('downloading');
    onLog(`[STREAM] Downloading ${artifact.id} (${(artifact.sizeBytes / (1024 * 1024)).toFixed(2)} MB)...`);

    const params = new URLSearchParams({
      speed_limit_mbps: String(speedLimitMbps),
      simulate_error: simulateNetworkDrop ? 'true' : 'false',
    });

    const response = await fetch(
      `/api/download/artifact/${encodeURIComponent(versionId)}/${encodeURIComponent(artifact.id)}?${params.toString()}`,
      { signal, cache: 'no-store' }
    );

    if (!response.ok || !response.body) {
      let detail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.detail) detail = errJson.detail;
      } catch {
        // ignore JSON parse fallback
      }
      throw new Error(detail);
    }

    const reader = response.body.getReader();
    const received = new Uint8Array(artifact.sizeBytes);
    let fileOffset = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (fileOffset + value.byteLength <= received.byteLength) {
          received.set(value, fileOffset);
        }
        fileOffset += value.byteLength;
        cumulativeDownloaded += value.byteLength;

        const elapsedSec = Math.max(0.05, (performance.now() - overallStart) / 1000);
        const speedMbps = cumulativeDownloaded / (1024 * 1024) / elapsedSec;
        const remainingMb = Math.max(0, (manifest.totalBytes - cumulativeDownloaded) / (1024 * 1024));
        const etaSeconds = speedMbps > 0.05 ? Math.max(0, remainingMb / speedMbps) : null;

        onProgress({
          currentFile: artifact.id,
          stageLabel: artifact.label,
          downloadedBytes: cumulativeDownloaded,
          totalBytes: manifest.totalBytes,
          speedMbps,
          etaSeconds,
          verifiedFiles: verifiedCount,
          totalFiles: manifest.artifacts.length,
          lastSha256: lastDigest,
        });
      }
    }

    onPhaseChange('verifying');
    const actualSha256 = await computeSha256Hex(received.subarray(0, fileOffset));
    if (actualSha256 !== artifact.sha256) {
      throw new Error(
        `SHA-256 integrity mismatch on ${artifact.id}: expected ${artifact.sha256.slice(0, 12)}…, got ${actualSha256.slice(0, 12)}…`
      );
    }
    verifiedCount += 1;
    lastDigest = actualSha256;
    onLog(`[SHA-256] Verified ${artifact.id} (${actualSha256.slice(0, 16)}…)`);

    onProgress({
      currentFile: artifact.id,
      stageLabel: artifact.label,
      downloadedBytes: cumulativeDownloaded,
      totalBytes: manifest.totalBytes,
      speedMbps:
        cumulativeDownloaded /
        (1024 * 1024) /
        Math.max(0.05, (performance.now() - overallStart) / 1000),
      etaSeconds: 0,
      verifiedFiles: verifiedCount,
      totalFiles: manifest.artifacts.length,
      lastSha256: actualSha256,
    });
  }

  onPhaseChange('launching');
  onLog(`[LAUNCH] All ${verifiedCount} packages verified. Preparing JVM classloader handoff...`);
  return {
    verifiedArtifacts: verifiedCount,
    totalBytes: cumulativeDownloaded,
  };
}
