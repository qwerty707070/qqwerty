use crate::auth::load_encrypted_mc_token;
use crate::downloader::download_and_verify_file;
use reqwest::Client;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
}

pub fn expand_tilde(path_str: &str) -> PathBuf {
    if let Some(stripped) = path_str.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    }
    PathBuf::from(path_str)
}

/// Automatically discovers a windowless `javaw.exe` / JDK 21 runtime on Windows
/// (including official Minecraft Launcher bundled runtimes, JAVA_HOME, Adoptium, Microsoft, and Oracle)
/// so no black console window is ever spawned.
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
            for slot in ["java-runtime-delta", "java-runtime-gamma"] {
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

pub async fn prepare_and_launch_minecraft(
    app: AppHandle,
    req: LaunchRequest,
) -> Result<u32, String> {
    let http = Client::new();
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

    let fabric_url = format!(
        "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
        req.minecraft_version, req.fabric_loader_version
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

    if let Some(asset_idx) = mc_meta.get("assetIndex") {
        if let (Some(idx_id), Some(idx_url)) = (
            asset_idx.get("id").and_then(|v| v.as_str()),
            asset_idx.get("url").and_then(|v| v.as_str()),
        ) {
            let idx_dest = assets_dir.join("indexes").join(format!("{idx_id}.json"));
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

    if let Some(libs) = mc_meta["libraries"].as_array() {
        for lib in libs {
            if !library_allowed_for_host(lib) {
                continue;
            }
            if let Some(art) = lib["downloads"]["artifact"].as_object() {
                if let (Some(p), Some(u)) = (
                    art.get("path").and_then(|v| v.as_str()),
                    art.get("url").and_then(|v| v.as_str()),
                ) {
                    let target = libraries_dir.join(p);
                    classpath_entries.push(target.clone());
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
    }

    if let Some(flibs) = fabric_meta["libraries"].as_array() {
        for flib in flibs {
            if let (Some(name), Some(base_url)) = (flib["name"].as_str(), flib["url"].as_str()) {
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() == 3 {
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

    let java_bin = resolve_java_executable(&req.java_path);
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
        format!("[JVM] Started Minecraft PID {pid} ({main_class})"),
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

    Ok(pid)
}

pub fn ensure_clean_dir(dir: &Path) -> Result<(), String> {
    if dir.exists() {
        std::fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())
}
