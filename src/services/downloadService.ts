import { computeSha256Hex } from '../utils/sha256';

export interface ArtifactSpec {
  id: string;
  filename?: string;
  label: string;
  sizeBytes: number;
  sha256: string;
  url?: string;
}

export interface DownloadManifest {
  versionId: string;
  versionName: string;
  minecraftVersion: string;
  totalBytes?: number;
  totalSizeBytes?: number;
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

function makeAbortError(): Error {
  const err = new Error('LAUNCH_CANCELLED');
  err.name = 'AbortError';
  return err;
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

  if (signal.aborted) {
    throw makeAbortError();
  }

  onPhaseChange('preparing');
  onLog(`[INIT] Resolving signed build manifest for ${versionId}...`);

  const manifestRes = await fetch(`/api/download/${encodeURIComponent(versionId)}/manifest`, {
    signal,
    cache: 'no-store',
  });
  if (!manifestRes.ok) {
    throw new Error(`Manifest request failed (HTTP ${manifestRes.status})`);
  }
  const manifest = (await manifestRes.json()) as DownloadManifest;
  const manifestTotalBytes =
    manifest.totalBytes ??
    manifest.totalSizeBytes ??
    manifest.artifacts.reduce((acc, item) => acc + item.sizeBytes, 0);

  onLog(
    `[MANIFEST] Resolved ${manifest.artifacts.length} signed packages (${(
      manifestTotalBytes /
      (1024 * 1024)
    ).toFixed(1)} MB total)`
  );

  let cumulativeDownloaded = 0;
  let verifiedCount = 0;
  let lastDigest = '';
  const overallStart = performance.now();

  for (const artifact of manifest.artifacts) {
    if (signal.aborted) {
      throw makeAbortError();
    }

    const fileId = artifact.filename ?? artifact.id;

    onPhaseChange('downloading');
    onLog(`[STREAM] Downloading ${fileId} (${(artifact.sizeBytes / (1024 * 1024)).toFixed(2)} MB)...`);

    const params = new URLSearchParams({
      speed_mbps: String(speedLimitMbps),
      simulate_error: simulateNetworkDrop ? '1' : '0',
    });

    const response = await fetch(
      `/api/download/${encodeURIComponent(versionId)}/${encodeURIComponent(fileId)}?${params.toString()}`,
      { signal, cache: 'no-store' }
    );

    if (!response.ok || !response.body) {
      let detail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error) detail = errJson.error;
        else if (errJson?.detail) detail = errJson.detail;
      } catch {
        // ignore JSON parse fallback
      }
      throw new Error(detail);
    }

    const reader = response.body.getReader();
    const cancelReader = () => {
      reader.cancel().catch(() => {});
    };
    signal.addEventListener('abort', cancelReader, { once: true });

    const received = new Uint8Array(artifact.sizeBytes);
    let fileOffset = 0;

    try {
      while (true) {
        if (signal.aborted) {
          throw makeAbortError();
        }
        const { done, value } = await reader.read();
        if (signal.aborted) {
          throw makeAbortError();
        }
        if (done) break;
        if (value) {
          if (fileOffset + value.byteLength <= received.byteLength) {
            received.set(value, fileOffset);
          }
          fileOffset += value.byteLength;
          cumulativeDownloaded += value.byteLength;

          const elapsedSec = Math.max(0.05, (performance.now() - overallStart) / 1000);
          const speedMbps = cumulativeDownloaded / (1024 * 1024) / elapsedSec;
          const remainingMb = Math.max(
            0,
            (manifestTotalBytes - cumulativeDownloaded) / (1024 * 1024)
          );
          const etaSeconds = speedMbps > 0.05 ? Math.max(0, remainingMb / speedMbps) : null;

          onProgress({
            currentFile: fileId,
            stageLabel: artifact.label,
            downloadedBytes: cumulativeDownloaded,
            totalBytes: manifestTotalBytes,
            speedMbps,
            etaSeconds,
            verifiedFiles: verifiedCount,
            totalFiles: manifest.artifacts.length,
            lastSha256: lastDigest,
          });
        }
      }
    } finally {
      signal.removeEventListener('abort', cancelReader);
    }

    if (signal.aborted) {
      throw makeAbortError();
    }

    onPhaseChange('verifying');
    const actualSha256 = await computeSha256Hex(received.subarray(0, fileOffset));
    if (actualSha256 !== artifact.sha256) {
      throw new Error(
        `SHA-256 integrity mismatch on ${fileId}: expected ${artifact.sha256.slice(0, 12)}…, got ${actualSha256.slice(0, 12)}…`
      );
    }
    verifiedCount += 1;
    lastDigest = actualSha256;
    onLog(`[SHA-256] Verified ${fileId} (${actualSha256.slice(0, 16)}…)`);

    onProgress({
      currentFile: fileId,
      stageLabel: artifact.label,
      downloadedBytes: cumulativeDownloaded,
      totalBytes: manifestTotalBytes,
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

  if (signal.aborted) {
    throw makeAbortError();
  }

  onPhaseChange('launching');
  onLog(`[LAUNCH] All ${verifiedCount} packages verified. Preparing JVM classloader handoff...`);
  return {
    verifiedArtifacts: verifiedCount,
    totalBytes: cumulativeDownloaded,
  };
}
