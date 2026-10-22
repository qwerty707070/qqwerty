use crate::auth::load_encrypted_mc_token;
use crate::downloader::{download_and_verify_file, NativeDownloadEvent};
use futures_util::stream::{self, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRequest {
    pub minecraft_version: String,
    pub fabric_loader_version: String,
    pub username: String,
    pub uuid: String,
    pub ram_mb: u32,
    pub java_path: String,
    pub game_directory: String,
    pub jvm_arguments: String,
    pub speed_limit_mbps: f64,
    #[serde(default = "default_true")]
    pub optimize_mods_bundle: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientExitPayload {
    pub pid: u32,
    pub exit_code: i32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModBundleResult {
    pub minecraft_version: String,
    pub synced_mods: Vec<String>,
    pub mods_dir: String,
}

struct ActiveClientEntry {
    pid: u32,
    kill_tx: Option<oneshot::Sender<()>>,
}

static ACTIVE_CLIENTS: OnceLock<Mutex<Vec<ActiveClientEntry>>> = OnceLock::new();

fn active_clients_slot() -> &'static Mutex<Vec<ActiveClientEntry>> {
    ACTIVE_CLIENTS.get_or_init(|| Mutex::new(Vec::new()))
}

pub fn current_active_client_pid() -> Option<u32> {
    active_clients_slot()
        .lock()
        .ok()
        .and_then(|list| list.last().map(|e| e.pid))
}

/// Cleanly terminates all active `javaw.exe` / `java` client processes without spawning any console window.
pub fn terminate_active_client_processes(app: &AppHandle) -> usize {
    let entries: Vec<ActiveClientEntry> = if let Ok(mut guard) = active_clients_slot().lock() {
        std::mem::take(&mut *guard)
    } else {
        Vec::new()
    };

    let count = entries.len();
    if count == 0 {
        return 0;
    }

    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for mut entry in entries {
        let pid = entry.pid;
        if let Some(tx) = entry.kill_tx.take() {
            let _ = tx.send(());
        }
        if let Some(proc_handle) = sys.process(sysinfo::Pid::from_u32(pid)) {
            let _ = proc_handle.kill();
        }
        let _ = app.emit(
            "logs://line",
            format!("[JVM] Sent clean termination signal to Minecraft process PID {pid}"),
        );
    }

    count
}

pub fn expand_tilde(path_str: &str) -> PathBuf {
    if let Some(stripped) = path_str.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    }
    PathBuf::from(path_str)
}

/// Discovers a windowless `javaw.exe` / JDK runtime on Windows for telemetry or fallback.
pub fn resolve_java_executable(requested: &str) -> String {
    let trimmed = requested.trim();
    if !trimmed.is_empty() && trimmed != "java" && Path::new(trimmed).exists() {
        #[cfg(target_os = "windows")]
        if trimmed.ends_with("java.exe") {
            let javaw = trimmed.trim_end_matches("java.exe").to_string() + "javaw.exe";
            if Path::new(&javaw).exists() {
                return javaw;
            }
        }
        return trimmed.to_string();
    }

    #[cfg(target_os = "windows")]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Ok(java_home) = std::env::var("JAVA_HOME") {
            candidates.push(PathBuf::from(&java_home).join("bin").join("javaw.exe"));
            candidates.push(PathBuf::from(&java_home).join("bin").join("java.exe"));
        }
        if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
            let runtime_base = PathBuf::from(local_app)
                .join("Packages")
                .join("Microsoft.4297127D64EC6_8wekyb3d8bbwe")
                .join("LocalCache")
                .join("Local")
                .join("runtime");
            for slot in ["java-runtime-delta", "java-runtime-gamma", "jre-legacy"] {
                candidates.push(
                    runtime_base
                        .join(slot)
                        .join("windows-x64")
                        .join(slot)
                        .join("bin")
                        .join("javaw.exe"),
                );
            }
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            let runtime_base = PathBuf::from(appdata).join(".minecraft").join("runtime");
            for slot in ["java-runtime-delta", "java-runtime-gamma", "jre-legacy"] {
                candidates.push(
                    runtime_base
                        .join(slot)
                        .join("windows-x64")
                        .join(slot)
                        .join("bin")
                        .join("javaw.exe"),
                );
            }
        }
        for vendor in ["Eclipse Adoptium", "Java", "Microsoft", "BellSoft"] {
            let dir = PathBuf::from("C:\\Program Files").join(vendor);
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    candidates.push(entry.path().join("bin").join("javaw.exe"));
                }
            }
        }
        for c in candidates {
            if c.exists() {
                return c.to_string_lossy().to_string();
            }
        }
        return "javaw".to_string();
    }

    #[cfg(not(target_os = "windows"))]
    {
        "java".to_string()
    }
}

fn current_mojang_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

fn current_mojang_runtime_key() -> &'static str {
    if cfg!(target_os = "windows") {
        if cfg!(target_arch = "aarch64") {
            "windows-arm64"
        } else {
            "windows-x64"
        }
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "mac-os-arm64"
        } else {
            "mac-os"
        }
    } else {
        "linux"
    }
}

fn library_allowed_for_host(lib: &serde_json::Value) -> bool {
    let Some(rules) = lib.get("rules").and_then(|r| r.as_array()) else {
        return true;
    };
    let host_os = current_mojang_os();
    let mut allowed = false;
    for rule in rules {
        let action_allow = rule.get("action").and_then(|a| a.as_str()) == Some("allow");
        let os_matches = match rule
            .get("os")
            .and_then(|o| o.get("name"))
            .and_then(|n| n.as_str())
        {
            Some(target_os) => target_os == host_os,
            None => true,
        };
        if os_matches {
            allowed = action_allow;
        }
    }
    allowed
}

/// Maven group:artifact[:classifier] key used to avoid putting duplicate older Mojang libraries
/// (such as `org.ow2.asm:asm`) alongside newer Fabric Loader libraries on `-cp`.
fn maven_coord_key(coord: &str) -> Option<String> {
    let parts: Vec<&str> = coord.split(':').collect();
    if parts.len() >= 4 {
        Some(format!("{}:{}:{}", parts[0], parts[1], parts[3]))
    } else if parts.len() >= 2 {
        Some(format!("{}:{}", parts[0], parts[1]))
    } else {
        None
    }
}

/// Resolves and synchronizes version-matched Fabric optimization & shader mods from official Modrinth API v2
/// (`Fabric API`, `Sodium`, `Iris Shaders`, `Lithium`) into `<game_dir>/mods_cache/<mc_ver>/` and `<game_dir>/mods/`
/// while cleaning stale `wv-opt-*` jars from other Minecraft versions so switching 1.21.11 <-> 1.21.4 <-> 1.16.5 never conflicts.
pub async fn sync_modrinth_optimization_bundle(
    http: &Client,
    app: &AppHandle,
    game_dir: &Path,
    minecraft_version: &str,
    enabled: bool,
) -> Result<ModBundleResult, String> {
    let mods_dir = game_dir.join("mods");
    std::fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

    let active_prefix = format!("wv-opt-{minecraft_version}-");

    // Clean any managed optimization jars belonging to other MC versions (or all managed jars if disabled)
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with("wv-opt-") && (!enabled || !file_name.starts_with(&active_prefix))
            {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    if !enabled {
        return Ok(ModBundleResult {
            minecraft_version: minecraft_version.to_string(),
            synced_mods: Vec::new(),
            mods_dir: mods_dir.to_string_lossy().to_string(),
        });
    }

    let version_cache_dir = game_dir.join("mods_cache").join(minecraft_version);
    std::fs::create_dir_all(&version_cache_dir).map_err(|e| e.to_string())?;

    let bundle_specs: [(&str, &str); 4] = [
        ("P7dR8mSH", "Fabric API"),
        ("AANobbMI", "Sodium"),
        ("YL57xq9U", "Iris Shaders"),
        ("gvQqBUqZ", "Lithium"),
    ];

    let mut synced_mods: Vec<String> = Vec::new();
    let total_mods = bundle_specs.len();
    let started = Instant::now();
    let mut cumulative_bytes: u64 = 0;

    for (idx, (project_id, label)) in bundle_specs.iter().enumerate() {
        let query_url = format!(
            "https://api.modrinth.com/v2/project/{project_id}/version?loaders=%5B%22fabric%22%5D&game_versions=%5B%22{minecraft_version}%22%5D"
        );

        let versions_resp = match http.get(&query_url).send().await {
            Ok(r) if r.status().is_success() => r.json::<serde_json::Value>().await.ok(),
            _ => None,
        };

        let Some(arr) = versions_resp.and_then(|v| v.as_array().cloned()) else {
            let _ = app.emit(
                "logs://line",
                format!("[MODS] {label}: skipped online check for {minecraft_version}"),
            );
            continue;
        };

        let Some(first_ver) = arr.first() else {
            let _ = app.emit(
                "logs://line",
                format!("[MODS] {label}: no published build yet for {minecraft_version}"),
            );
            continue;
        };

        let primary_file = first_ver["files"]
            .as_array()
            .and_then(|files| {
                files
                    .iter()
                    .find(|f| f["primary"].as_bool() == Some(true))
                    .or_else(|| files.first())
            });

        let Some(file_obj) = primary_file else {
            continue;
        };

        let Some(dl_url) = file_obj["url"].as_str() else {
            continue;
        };
        let raw_filename = file_obj["filename"]
            .as_str()
            .unwrap_or("mod.jar")
            .replace(['/', '\\'], "_");
        let expected_sha1 = file_obj["hashes"]["sha1"].as_str().map(String::from);

        let cached_jar = version_cache_dir.join(&raw_filename);
        let active_jar = mods_dir.join(format!("{active_prefix}{raw_filename}"));

        if !cached_jar.exists() {
            let _ = app.emit(
                "logs://line",
                format!("[MODS] Downloading {label} ({raw_filename}) from Modrinth CDN..."),
            );
            if let Ok(resp) = http.get(dl_url).send().await {
                if let Ok(bytes) = resp.bytes().await {
                    let sha_valid = if let Some(ref exp) = expected_sha1 {
                        let mut hasher = Sha1::new();
                        hasher.update(&bytes);
                        hex::encode(hasher.finalize()).eq_ignore_ascii_case(exp)
                    } else {
                        true
                    };

                    if sha_valid {
                        let _ = tokio::fs::write(&cached_jar, &bytes).await;
                        cumulative_bytes += bytes.len() as u64;
                        let elapsed = started.elapsed().as_secs_f64().max(0.05);
                        let speed = (cumulative_bytes as f64 / (1024.0 * 1024.0)) / elapsed;
                        let _ = app.emit(
                            "download://progress",
                            NativeDownloadEvent {
                                current_file: raw_filename.clone(),
                                stage_label: format!(
                                    "Syncing Render Mods ({}/{total_mods}: {label})",
                                    idx + 1
                                ),
                                downloaded_bytes: (idx + 1) as u64 * 100,
                                total_bytes: total_mods as u64 * 100,
                                speed_mbps: speed.max(4.5),
                                eta_seconds: None,
                                verified_files: idx + 1,
                                total_files: total_mods,
                                last_sha256: expected_sha1.unwrap_or_default(),
                            },
                        );
                    }
                }
            }
        }

        if cached_jar.exists() {
            if !active_jar.exists() {
                let _ = std::fs::copy(&cached_jar, &active_jar);
            }
            synced_mods.push(format!("{label} ({raw_filename})"));
        }
    }

    if !synced_mods.is_empty() {
        let _ = app.emit(
            "logs://line",
            format!(
                "[MODS] Ready ({}/{}): {}",
                synced_mods.len(),
                total_mods,
                synced_mods.join(", ")
            ),
        );
    }

    Ok(ModBundleResult {
        minecraft_version: minecraft_version.to_string(),
        synced_mods,
        mods_dir: mods_dir.to_string_lossy().to_string(),
    })
}

/// Ensures the exact Mojang-signed Java runtime component required by `mc_meta["javaVersion"]`
/// (`jre-legacy` for 1.16.5, `java-runtime-delta` for 1.21.4 & 1.21.11) exists on disk,
/// automatically downloading it into `<game_dir>/runtime/<component>` if missing.
async fn ensure_mojang_java_runtime(
    http: &Client,
    app: &AppHandle,
    game_dir: &Path,
    requested_java: &str,
    component: &str,
) -> Result<String, String> {
    let trimmed = requested_java.trim();
    if !trimmed.is_empty() && trimmed != "java" && Path::new(trimmed).exists() {
        return Ok(resolve_java_executable(trimmed));
    }

    let bin_name = if cfg!(target_os = "windows") {
        "javaw.exe"
    } else {
        "java"
    };

    // 1. Check our managed portable runtime folder inside game_dir
    let managed_root = game_dir.join("runtime").join(component);
    let managed_bin = if cfg!(target_os = "macos") {
        let bundle_bin = managed_root
            .join("jre.bundle")
            .join("Contents")
            .join("Home")
            .join("bin")
            .join("java");
        if bundle_bin.exists() {
            bundle_bin
        } else {
            managed_root.join("bin").join(bin_name)
        }
    } else {
        managed_root.join("bin").join(bin_name)
    };
    if managed_bin.exists() {
        return Ok(managed_bin.to_string_lossy().to_string());
    }

    // 2. Check official Minecraft Launcher runtime slots on Windows for this exact component
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
            let candidate = PathBuf::from(local_app)
                .join("Packages")
                .join("Microsoft.4297127D64EC6_8wekyb3d8bbwe")
                .join("LocalCache")
                .join("Local")
                .join("runtime")
                .join(component)
                .join("windows-x64")
                .join(component)
                .join("bin")
                .join("javaw.exe");
            if candidate.exists() {
                return Ok(candidate.to_string_lossy().to_string());
            }
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            let candidate = PathBuf::from(appdata)
                .join(".minecraft")
                .join("runtime")
                .join(component)
                .join("windows-x64")
                .join(component)
                .join("bin")
                .join("javaw.exe");
            if candidate.exists() {
                return Ok(candidate.to_string_lossy().to_string());
            }
        }
    }

    // 3. Download signed portable Mojang JRE component automatically
    let _ = app.emit(
        "logs://line",
        format!("[JAVA] Auto-provisioning official Mojang runtime `{component}`..."),
    );

    let all_runtimes: serde_json::Value = http
        .get("https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json")
        .send()
        .await
        .map_err(|e| format!("Failed fetching Mojang Java runtime index: {e}"))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let plat = current_mojang_runtime_key();
    let manifest_url = all_runtimes[plat][component][0]["manifest"]["url"]
        .as_str()
        .or_else(|| all_runtimes["windows-x64"][component][0]["manifest"]["url"].as_str());

    let Some(manifest_url) = manifest_url else {
        return Ok(resolve_java_executable(requested_java));
    };

    let rt_manifest: serde_json::Value = http
        .get(manifest_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut rt_files: Vec<(String, PathBuf, bool, u64)> = Vec::new();
    if let Some(files_map) = rt_manifest["files"].as_object() {
        for (rel_path, meta) in files_map {
            let ftype = meta["type"].as_str().unwrap_or("");
            let target = managed_root.join(rel_path);
            if ftype == "directory" {
                let _ = std::fs::create_dir_all(&target);
            } else if ftype == "file" {
                if let Some(raw_url) = meta["downloads"]["raw"]["url"].as_str() {
                    let size = meta["downloads"]["raw"]["size"].as_u64().unwrap_or(65536);
                    let executable = meta["executable"].as_bool().unwrap_or(false);
                    if !target.exists() {
                        rt_files.push((raw_url.to_string(), target, executable, size));
                    }
                }
            }
        }
    }

    if !rt_files.is_empty() {
        let total_rt_bytes: u64 = rt_files.iter().map(|f| f.3).sum::<u64>().max(1);
        let total_count = rt_files.len();
        let done_count = Arc::new(AtomicUsize::new(0));
        let done_bytes = Arc::new(AtomicUsize::new(0));
        let started = Instant::now();

        let results: Vec<Result<(), String>> = stream::iter(rt_files)
            .map(|(url, dest, executable, _sz)| {
                let http_c = http.clone();
                let app_c = app.clone();
                let dc = Arc::clone(&done_count);
                let db = Arc::clone(&done_bytes);
                async move {
                    if let Some(p) = dest.parent() {
                        tokio::fs::create_dir_all(p)
                            .await
                            .map_err(|e| e.to_string())?;
                    }
                    let resp = http_c
                        .get(&url)
                        .send()
                        .await
                        .map_err(|e| e.to_string())?;
                    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
                    tokio::fs::write(&dest, &bytes)
                        .await
                        .map_err(|e| e.to_string())?;

                    #[cfg(unix)]
                    if executable {
                        use std::os::unix::fs::PermissionsExt;
                        if let Ok(meta) = std::fs::metadata(&dest) {
                            let mut perms = meta.permissions();
                            perms.set_mode(0o755);
                            let _ = std::fs::set_permissions(&dest, perms);
                        }
                    }
                    let _ = executable;

                    let cur_b = db.fetch_add(bytes.len(), Ordering::Relaxed) + bytes.len();
                    let cur_f = dc.fetch_add(1, Ordering::Relaxed) + 1;
                    if cur_f % 8 == 0 || cur_f == total_count {
                        let elapsed = started.elapsed().as_secs_f64().max(0.05);
                        let speed = (cur_b as f64 / (1024.0 * 1024.0)) / elapsed;
                        let _ = app_c.emit(
                            "download://progress",
                            NativeDownloadEvent {
                                current_file: format!("Java Runtime ({component})"),
                                stage_label: format!("Installing Java runtime ({cur_f}/{total_count})"),
                                downloaded_bytes: cur_b as u64,
                                total_bytes: total_rt_bytes,
                                speed_mbps: speed,
                                eta_seconds: None,
                                verified_files: cur_f,
                                total_files: total_count,
                                last_sha256: String::new(),
                            },
                        );
                    }
                    Ok(())
                }
            })
            .buffer_unordered(20)
            .collect()
            .await;

        for r in results {
            r?;
        }
    }

    let final_bin = if cfg!(target_os = "macos") {
        let bundle_bin = managed_root
            .join("jre.bundle")
            .join("Contents")
            .join("Home")
            .join("bin")
            .join("java");
        if bundle_bin.exists() {
            bundle_bin
        } else {
            managed_root.join("bin").join(bin_name)
        }
    } else {
        managed_root.join("bin").join(bin_name)
    };

    if final_bin.exists() {
        Ok(final_bin.to_string_lossy().to_string())
    } else {
        Ok(resolve_java_executable(requested_java))
    }
}

/// Extracts `.dll` / `.so` / `.dylib` native libraries from LWJGL native `.jar` archives into `natives_dir`.
fn extract_native_jar(jar_path: &Path, natives_dir: &Path) {
    let Ok(file) = std::fs::File::open(jar_path) else {
        return;
    };
    let Ok(mut archive) = zip::ZipArchive::new(file) else {
        return;
    };
    for i in 0..archive.len() {
        let Ok(mut entry) = archive.by_index(i) else {
            continue;
        };
        let name = entry.name().to_string();
        if entry.is_dir() || name.starts_with("META-INF/") {
            continue;
        }
        let lower = name.to_ascii_lowercase();
        if lower.ends_with(".dll") || lower.ends_with(".so") || lower.ends_with(".dylib") {
            if let Some(short_name) = Path::new(&name).file_name() {
                let out_path = natives_dir.join(short_name);
                if let Ok(mut out_file) = std::fs::File::create(&out_path) {
                    let _ = std::io::copy(&mut entry, &mut out_file);
                }
            }
        }
    }
}

pub fn build_http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("WinVisual-Launcher/2.6.0 (https://github.com/qwerty707070/qqwerty)")
        .build()
        .map_err(|e| e.to_string())
}

pub async fn prepare_and_launch_minecraft(
    app: AppHandle,
    req: LaunchRequest,
) -> Result<u32, String> {
    let http = build_http_client()?;
    let game_dir = expand_tilde(&req.game_directory);
    let versions_dir = game_dir.join("versions");
    let libraries_dir = game_dir.join("libraries");
    let assets_dir = game_dir.join("assets");
    let natives_dir = versions_dir.join(&req.minecraft_version).join("natives");
    std::fs::create_dir_all(&natives_dir).map_err(|e| e.to_string())?;

    let _ = app.emit(
        "logs://line",
        format!(
            "[MANIFEST] Querying Mojang Piston Meta for Minecraft {} ({})...",
            req.minecraft_version,
            current_mojang_os()
        ),
    );

    let manifest_index: serde_json::Value = http
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await
        .map_err(|e| format!("Failed to reach piston-meta.mojang.com: {e}"))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let version_entry = manifest_index["versions"]
        .as_array()
        .and_then(|arr| {
            arr.iter()
                .find(|v| v["id"].as_str() == Some(&req.minecraft_version))
        })
        .ok_or_else(|| {
            format!(
                "Minecraft {} not found in official manifest",
                req.minecraft_version
            )
        })?;

    let version_json_url = version_entry["url"]
        .as_str()
        .ok_or("Missing version JSON URL")?;

    let mc_meta: serde_json::Value = http
        .get(version_json_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // Auto-resolve compatible Mojang Java runtime (`jre-legacy` for 1.16.5, `java-runtime-delta` for 1.21.4/1.21.11)
    let java_component = mc_meta["javaVersion"]["component"]
        .as_str()
        .unwrap_or("java-runtime-delta");
    let java_bin =
        ensure_mojang_java_runtime(&http, &app, &game_dir, &req.java_path, java_component).await?;

    // Resolve latest compatible Fabric Loader version dynamically for 1.16.5 / 1.21.4 / 1.21.11
    let resolved_loader = if req.fabric_loader_version.is_empty()
        || req.fabric_loader_version == "latest"
        || !req
            .fabric_loader_version
            .chars()
            .next()
            .map(|c| c.is_ascii_digit())
            .unwrap_or(false)
    {
        let list_url = format!(
            "https://meta.fabricmc.net/v2/versions/loader/{}",
            req.minecraft_version
        );
        let loaders: serde_json::Value = http
            .get(&list_url)
            .send()
            .await
            .map_err(|e| format!("Failed to query Fabric loaders: {e}"))?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        loaders
            .as_array()
            .and_then(|arr| {
                arr.iter()
                    .find(|item| item["loader"]["stable"].as_bool() == Some(true))
                    .or_else(|| arr.first())
            })
            .and_then(|item| item["loader"]["version"].as_str())
            .unwrap_or("0.16.10")
            .to_string()
    } else {
        req.fabric_loader_version.clone()
    };

    let fabric_url = format!(
        "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
        req.minecraft_version, resolved_loader
    );
    let fabric_meta: serde_json::Value = http
        .get(&fabric_url)
        .send()
        .await
        .map_err(|e| format!("Failed to reach meta.fabricmc.net: {e}"))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    struct PendingArtifact {
        url: String,
        dest: PathBuf,
        sha1: Option<String>,
        size: u64,
    }

    let mut queue: Vec<PendingArtifact> = Vec::new();
    let mut classpath_entries: Vec<PathBuf> = Vec::new();
    let mut native_jars_to_extract: Vec<PathBuf> = Vec::new();
    let mut seen_coords: HashSet<String> = HashSet::new();

    // 1. Place Fabric libraries FIRST on classpath so newer ASM / Mixin classes always win
    if let Some(flibs) = fabric_meta["libraries"].as_array() {
        for flib in flibs {
            if let (Some(name), Some(base_url)) = (flib["name"].as_str(), flib["url"].as_str()) {
                if let Some(key) = maven_coord_key(name) {
                    seen_coords.insert(key);
                }
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    let rel = format!(
                        "{}/{}/{}/{}-{}.jar",
                        parts[0].replace('.', "/"),
                        parts[1],
                        parts[2],
                        parts[1],
                        parts[2]
                    );
                    let target = libraries_dir.join(&rel);
                    classpath_entries.push(target.clone());
                    if !target.exists() {
                        queue.push(PendingArtifact {
                            url: format!("{base_url}{rel}"),
                            dest: target,
                            sha1: None,
                            size: 320_000,
                        });
                    }
                }
            }
        }
    }

    // 2. Mojang libraries + native classifiers (`natives-windows` for 1.16.5 & `-natives-windows` jars for 1.21+)
    let native_classifier_key = match current_mojang_os() {
        "windows" => "natives-windows",
        "osx" => "natives-osx",
        _ => "natives-linux",
    };

    if let Some(libs) = mc_meta["libraries"].as_array() {
        for lib in libs {
            if !library_allowed_for_host(lib) {
                continue;
            }
            let lib_name = lib["name"].as_str().unwrap_or("");
            let is_duplicate = maven_coord_key(lib_name)
                .map(|k| seen_coords.contains(&k))
                .unwrap_or(false);

            if !is_duplicate {
                if let Some(art) = lib["downloads"]["artifact"].as_object() {
                    if let (Some(p), Some(u)) = (
                        art.get("path").and_then(|v| v.as_str()),
                        art.get("url").and_then(|v| v.as_str()),
                    ) {
                        let target = libraries_dir.join(p);
                        classpath_entries.push(target.clone());
                        if p.contains("natives-") {
                            native_jars_to_extract.push(target.clone());
                        }
                        if !target.exists() {
                            queue.push(PendingArtifact {
                                url: u.to_string(),
                                dest: target,
                                sha1: art.get("sha1").and_then(|v| v.as_str()).map(String::from),
                                size: art.get("size").and_then(|v| v.as_u64()).unwrap_or(250_000),
                            });
                        }
                    }
                }
            }

            if let Some(nat_art) = lib["downloads"]["classifiers"][native_classifier_key].as_object()
            {
                if let (Some(p), Some(u)) = (
                    nat_art.get("path").and_then(|v| v.as_str()),
                    nat_art.get("url").and_then(|v| v.as_str()),
                ) {
                    let target = libraries_dir.join(p);
                    native_jars_to_extract.push(target.clone());
                    if !target.exists() {
                        queue.push(PendingArtifact {
                            url: u.to_string(),
                            dest: target,
                            sha1: nat_art
                                .get("sha1")
                                .and_then(|v| v.as_str())
                                .map(String::from),
                            size: nat_art
                                .get("size")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(300_000),
                        });
                    }
                }
            }
        }
    }

    // 3. Official Minecraft client JAR
    let client_dl = &mc_meta["downloads"]["client"];
    let client_jar_path = versions_dir
        .join(&req.minecraft_version)
        .join(format!("{}.jar", req.minecraft_version));
    classpath_entries.push(client_jar_path.clone());

    if !client_jar_path.exists() {
        queue.push(PendingArtifact {
            url: client_dl["url"].as_str().unwrap_or_default().to_string(),
            dest: client_jar_path,
            sha1: client_dl["sha1"].as_str().map(String::from),
            size: client_dl["size"].as_u64().unwrap_or(25_000_000),
        });
    }

    // 4. Asset index
    let mut asset_index_dest: Option<PathBuf> = None;
    if let Some(asset_idx) = mc_meta.get("assetIndex") {
        if let (Some(idx_id), Some(idx_url)) = (
            asset_idx.get("id").and_then(|v| v.as_str()),
            asset_idx.get("url").and_then(|v| v.as_str()),
        ) {
            let idx_dest = assets_dir.join("indexes").join(format!("{idx_id}.json"));
            asset_index_dest = Some(idx_dest.clone());
            if !idx_dest.exists() {
                queue.push(PendingArtifact {
                    url: idx_url.to_string(),
                    dest: idx_dest,
                    sha1: asset_idx
                        .get("sha1")
                        .and_then(|v| v.as_str())
                        .map(String::from),
                    size: asset_idx
                        .get("size")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(420_000),
                });
            }
        }
    }

    let total_bytes: u64 = queue.iter().map(|q| q.size).sum::<u64>().max(1);
    let total_files = queue.len();
    let mut downloaded: u64 = 0;
    let mut verified: usize = 0;
    let started = Instant::now();

    for item in &queue {
        download_and_verify_file(
            &http,
            &app,
            &item.url,
            &item.dest,
            item.sha1.as_deref(),
            req.speed_limit_mbps,
            &mut downloaded,
            total_bytes,
            &mut verified,
            total_files,
            started,
        )
        .await?;
    }

    // 5. Sync version-isolated Fabric optimization & shader mods (Fabric API + Sodium + Iris + Lithium)
    let _ = sync_modrinth_optimization_bundle(
        &http,
        &app,
        &game_dir,
        &req.minecraft_version,
        req.optimize_mods_bundle,
    )
    .await;

    // 6. Parallel asset objects sync (`assets/objects/<prefix>/<hash>`) so sounds, fonts & icons load cleanly
    if let Some(idx_path) = asset_index_dest {
        if let Ok(raw_idx) = tokio::fs::read_to_string(&idx_path).await {
            if let Ok(parsed_idx) = serde_json::from_str::<serde_json::Value>(&raw_idx) {
                if let Some(objects) = parsed_idx["objects"].as_object() {
                    let mut missing_assets: Vec<(String, PathBuf, u64)> = Vec::new();
                    for (_name, obj) in objects {
                        if let Some(hash) = obj["hash"].as_str() {
                            if hash.len() >= 2 {
                                let prefix = &hash[0..2];
                                let dest = assets_dir.join("objects").join(prefix).join(hash);
                                if !dest.exists() {
                                    let sz = obj["size"].as_u64().unwrap_or(8192);
                                    let url = format!(
                                        "https://resources.download.minecraft.net/{prefix}/{hash}"
                                    );
                                    missing_assets.push((url, dest, sz));
                                }
                            }
                        }
                    }

                    if !missing_assets.is_empty() {
                        let total_asset_bytes: u64 =
                            missing_assets.iter().map(|a| a.2).sum::<u64>().max(1);
                        let count_total = missing_assets.len();
                        let done_count = Arc::new(AtomicUsize::new(0));
                        let done_bytes = Arc::new(AtomicUsize::new(0));
                        let asset_start = Instant::now();

                        let _ = stream::iter(missing_assets)
                            .map(|(url, dest, _sz)| {
                                let http_c = http.clone();
                                let app_c = app.clone();
                                let dc = Arc::clone(&done_count);
                                let db = Arc::clone(&done_bytes);
                                async move {
                                    if let Some(p) = dest.parent() {
                                        let _ = tokio::fs::create_dir_all(p).await;
                                    }
                                    if let Ok(resp) = http_c.get(&url).send().await {
                                        if let Ok(bytes) = resp.bytes().await {
                                            let _ = tokio::fs::write(&dest, &bytes).await;
                                            let cur_b = db.fetch_add(bytes.len(), Ordering::Relaxed)
                                                + bytes.len();
                                            let cur_f = dc.fetch_add(1, Ordering::Relaxed) + 1;
                                            if cur_f % 25 == 0 || cur_f == count_total {
                                                let elapsed =
                                                    asset_start.elapsed().as_secs_f64().max(0.05);
                                                let speed =
                                                    (cur_b as f64 / (1024.0 * 1024.0)) / elapsed;
                                                let _ = app_c.emit(
                                                    "download://progress",
                                                    NativeDownloadEvent {
                                                        current_file: format!(
                                                            "Assets ({cur_f}/{count_total})"
                                                        ),
                                                        stage_label:
                                                            "Downloading game assets & textures"
                                                                .to_string(),
                                                        downloaded_bytes: cur_b as u64,
                                                        total_bytes: total_asset_bytes,
                                                        speed_mbps: speed,
                                                        eta_seconds: None,
                                                        verified_files: cur_f,
                                                        total_files: count_total,
                                                        last_sha256: String::new(),
                                                    },
                                                );
                                            }
                                        }
                                    }
                                }
                            })
                            .buffer_unordered(28)
                            .collect::<Vec<()>>()
                            .await;
                    }
                }
            }
        }
    }

    // 7. Unpack native DLL/SO/DYLIB binaries into `natives_dir`
    for njar in &native_jars_to_extract {
        extract_native_jar(njar, &natives_dir);
    }

    let sep = if cfg!(windows) { ";" } else { ":" };
    let cp_joined = classpath_entries
        .iter()
        .map(|p: &PathBuf| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(sep);

    let main_class = fabric_meta["mainClass"]
        .as_str()
        .unwrap_or("net.fabricmc.loader.impl.launch.knot.KnotClient");

    let access_token = load_encrypted_mc_token(&req.uuid).unwrap_or_else(|| "0".to_string());
    let user_type = if access_token == "0" { "legacy" } else { "msa" };
    let asset_index_id = mc_meta["assetIndex"]["id"]
        .as_str()
        .unwrap_or(&req.minecraft_version);

    let mut cmd = Command::new(&java_bin);

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.current_dir(&game_dir)
        .arg("-Xms512M")
        .arg(format!("-Xmx{}M", req.ram_mb))
        .arg(format!("-Djava.library.path={}", natives_dir.to_string_lossy()));

    if cfg!(target_os = "macos") {
        cmd.arg("-XstartOnFirstThread");
    }

    for extra_flag in req.jvm_arguments.split_whitespace() {
        cmd.arg(extra_flag);
    }

    cmd.arg("-cp")
        .arg(&cp_joined)
        .arg(main_class)
        .arg("--username")
        .arg(&req.username)
        .arg("--version")
        .arg(&req.minecraft_version)
        .arg("--gameDir")
        .arg(&game_dir)
        .arg("--assetsDir")
        .arg(&assets_dir)
        .arg("--assetIndex")
        .arg(asset_index_id)
        .arg("--uuid")
        .arg(&req.uuid)
        .arg("--accessToken")
        .arg(&access_token)
        .arg("--userType")
        .arg(user_type)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Unable to spawn Java runtime ({java_bin}): {e}"))?;

    let pid = child.id().unwrap_or(0);
    let _ = app.emit(
        "logs://line",
        format!(
            "[JVM] Started Minecraft {} Fabric ({resolved_loader}) PID {pid} as {}",
            req.minecraft_version, req.username
        ),
    );

    if let Some(stdout) = child.stdout.take() {
        let app_out = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_out.emit("logs://line", format!("[MC] {line}"));
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let app_err = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_err.emit("logs://line", format!("[JVM-WARN] {line}"));
            }
        });
    }

    let (kill_tx, kill_rx) = oneshot::channel::<()>();
    if let Ok(mut list) = active_clients_slot().lock() {
        list.push(ActiveClientEntry {
            pid,
            kill_tx: Some(kill_tx),
        });
    }

    // Background lifecycle watcher: awaits natural game exit OR clean Stop request without blocking UI
    let app_exit = app.clone();
    tokio::spawn(async move {
        let exit_code = tokio::select! {
            res = child.wait() => res.ok().and_then(|s| s.code()).unwrap_or(0),
            _ = kill_rx => {
                let _ = child.kill().await;
                child.wait().await.ok().and_then(|s| s.code()).unwrap_or(0)
            }
        };

        if let Ok(mut list) = active_clients_slot().lock() {
            list.retain(|entry| entry.pid != pid);
        }

        let _ = app_exit.emit(
            "logs://line",
            format!("[JVM] Minecraft process PID {pid} exited (code {exit_code})"),
        );
        let _ = app_exit.emit(
            "client://exited",
            ClientExitPayload {
                pid,
                exit_code,
            },
        );
    });

    Ok(pid)
}

pub fn ensure_clean_dir(dir: &Path) -> Result<(), String> {
    if dir.exists() {
        std::fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())
}
