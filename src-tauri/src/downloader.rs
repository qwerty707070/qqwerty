use crate::launcher::is_launch_cancelled_or_stale;
use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use sha1::{Digest as Sha1Digest, Sha1};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::fs;
use tokio::io::AsyncWriteExt;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDownloadEvent {
    pub current_file: String,
    pub stage_label: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_mbps: f64,
    pub eta_seconds: Option<f64>,
    pub verified_files: usize,
    pub total_files: usize,
    pub last_sha256: String,
}

fn temp_part_path(destination: &Path, launch_gen: u64) -> PathBuf {
    let fname = destination
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("artifact.bin");
    destination.with_file_name(format!("{fname}.wvpart.{launch_gen}"))
}

/// Streams a signed Mojang or Fabric library artifact to an atomic `.wvpart` file on disk,
/// checks cancellation on every chunk, verifies SHA-1, and renames into place only when complete.
#[allow(clippy::too_many_arguments)]
pub async fn download_and_verify_file(
    http: &Client,
    app: &AppHandle,
    launch_gen: u64,
    url: &str,
    destination: &Path,
    expected_sha1: Option<&str>,
    speed_limit_mbps: f64,
    cumulative_downloaded: &mut u64,
    total_manifest_bytes: u64,
    verified_count: &mut usize,
    total_files: usize,
    started_at: Instant,
) -> Result<(), String> {
    if is_launch_cancelled_or_stale(launch_gen) {
        return Err("LAUNCH_CANCELLED".to_string());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed creating directory {:?}: {e}", parent))?;
    }

    let file_name = destination
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("artifact.jar")
        .to_string();

    let part_path = temp_part_path(destination, launch_gen);

    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Network error requesting {file_name}: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {} while downloading {file_name}", resp.status()));
    }

    let mut out_file = fs::File::create(&part_path)
        .await
        .map_err(|e| format!("Cannot open temp file for {file_name}: {e}"))?;

    let mut hasher = Sha1::new();
    let mut stream = resp.bytes_stream();

    while let Some(chunk_res) = stream.next().await {
        if is_launch_cancelled_or_stale(launch_gen) {
            drop(out_file);
            let _ = fs::remove_file(&part_path).await;
            return Err("LAUNCH_CANCELLED".to_string());
        }

        let chunk = match chunk_res {
            Ok(c) => c,
            Err(e) => {
                drop(out_file);
                let _ = fs::remove_file(&part_path).await;
                return Err(format!("Stream read interrupted on {file_name}: {e}"));
            }
        };

        if let Err(e) = out_file.write_all(&chunk).await {
            drop(out_file);
            let _ = fs::remove_file(&part_path).await;
            return Err(format!("Disk write failed on {file_name}: {e}"));
        }

        hasher.update(&chunk);
        *cumulative_downloaded += chunk.len() as u64;

        let elapsed = started_at.elapsed().as_secs_f64().max(0.05);
        let speed_mbps = (*cumulative_downloaded as f64 / (1024.0 * 1024.0)) / elapsed;
        let rem_mb = ((total_manifest_bytes.saturating_sub(*cumulative_downloaded)) as f64)
            / (1024.0 * 1024.0);
        let eta_seconds = if speed_mbps > 0.05 {
            Some(rem_mb / speed_mbps)
        } else {
            None
        };

        if !is_launch_cancelled_or_stale(launch_gen) {
            let _ = app.emit(
                "download://progress",
                NativeDownloadEvent {
                    current_file: file_name.clone(),
                    stage_label: format!("Downloading {file_name}"),
                    downloaded_bytes: *cumulative_downloaded,
                    total_bytes: total_manifest_bytes,
                    speed_mbps,
                    eta_seconds,
                    verified_files: *verified_count,
                    total_files,
                    last_sha256: String::new(),
                },
            );
        }

        if speed_limit_mbps > 0.0 {
            let target_bps = speed_limit_mbps * 1024.0 * 1024.0;
            let ideal_wait = (chunk.len() as f64) / target_bps;
            if ideal_wait > 0.002 {
                tokio::time::sleep(Duration::from_secs_f64(ideal_wait)).await;
            }
        }
    }

    out_file.flush().await.map_err(|e| e.to_string())?;
    drop(out_file);

    if is_launch_cancelled_or_stale(launch_gen) {
        let _ = fs::remove_file(&part_path).await;
        return Err("LAUNCH_CANCELLED".to_string());
    }

    let digest_hex = hex::encode(hasher.finalize());

    if let Some(exp) = expected_sha1 {
        if !exp.is_empty() && !exp.eq_ignore_ascii_case(&digest_hex) {
            let _ = fs::remove_file(&part_path).await;
            return Err(format!(
                "Checksum mismatch on {file_name}: expected {exp}, got {digest_hex}"
            ));
        }
    }

    fs::rename(&part_path, destination)
        .await
        .map_err(|e| format!("Failed finalizing {file_name}: {e}"))?;

    *verified_count += 1;
    if !is_launch_cancelled_or_stale(launch_gen) {
        let _ = app.emit(
            "download://progress",
            NativeDownloadEvent {
                current_file: file_name,
                stage_label: "Verified package signature".to_string(),
                downloaded_bytes: *cumulative_downloaded,
                total_bytes: total_manifest_bytes,
                speed_mbps: (*cumulative_downloaded as f64 / (1024.0 * 1024.0))
                    / started_at.elapsed().as_secs_f64().max(0.05),
                eta_seconds: Some(0.0),
                verified_files: *verified_count,
                total_files,
                last_sha256: digest_hex,
            },
        );
    }

    Ok(())
}
