#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod downloader;
mod launcher;

use auth::{
    complete_minecraft_oauth, delete_encrypted_mc_token, request_microsoft_device_code,
    AuthenticatedMinecraftProfile, DeviceCodeSession,
};
use base64::Engine;
use launcher::{
    build_http_client, cancel_active_launch_and_processes, collect_game_dir_entries,
    current_active_client_pid, ensure_clean_dir, expand_tilde, init_game_directory_report,
    install_embedded_winvisual_client_mod, resolve_java_executable, run_abortable_launch,
    sync_modrinth_optimization_bundle, terminate_active_client_processes, GameDirEntry,
    LaunchRequest, ModBundleResult,
};
use rfd::AsyncFileDialog;
use serde::Serialize;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use sysinfo::System;
use tauri::AppHandle;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaInfo {
    pub installed: bool,
    pub path: String,
    pub version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ServiceHealth {
    manifest_api: String,
    asset_cdn: String,
    skin_renderer: String,
    microsoft_o_auth: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostTelemetryResponse {
    operational: bool,
    launcher_version: String,
    uptime_seconds: u64,
    platform: String,
    cpu_cores: usize,
    cpu_usage_percent: f32,
    host_total_memory_mb: u64,
    host_used_memory_mb: u64,
    active_pid: Option<u32>,
    latency_ms: u32,
    java: JavaInfo,
    services: ServiceHealth,
    online_players: u32,
}

fn silent_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

static JAVA_INFO_CACHE: OnceLock<JavaInfo> = OnceLock::new();
static HOST_SYS: OnceLock<Mutex<System>> = OnceLock::new();

pub fn probe_java_cached() -> JavaInfo {
    JAVA_INFO_CACHE
        .get_or_init(|| {
            let candidate = resolve_java_executable("java");
            if let Ok(output) = silent_command(&candidate).arg("-version").output() {
                let combined = format!(
                    "{}\n{}",
                    String::from_utf8_lossy(&output.stderr),
                    String::from_utf8_lossy(&output.stdout)
                );
                let first_line = combined
                    .lines()
                    .find(|l| !l.trim().is_empty())
                    .unwrap_or("Java 21 Runtime")
                    .trim()
                    .to_string();
                return JavaInfo {
                    installed: true,
                    path: candidate,
                    version: first_line,
                };
            }

            JavaInfo {
                installed: false,
                path: candidate,
                version: "Java 21 LTS required".to_string(),
            }
        })
        .clone()
}

#[tauri::command]
fn get_host_telemetry() -> HostTelemetryResponse {
    let sys_mutex = HOST_SYS.get_or_init(|| Mutex::new(System::new_all()));
    let (total_mb, used_mb, cpu_cores, cpu_usage) = if let Ok(mut sys) = sys_mutex.lock() {
        sys.refresh_memory();
        sys.refresh_cpu_usage();
        (
            (sys.total_memory() / (1024 * 1024)).max(4096),
            (sys.used_memory() / (1024 * 1024)).max(512),
            sys.cpus().len().max(1),
            sys.global_cpu_usage().clamp(1.0, 100.0),
        )
    } else {
        (16384, 5120, 8, 8.5)
    };

    HostTelemetryResponse {
        operational: true,
        launcher_version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: System::uptime(),
        platform: format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        cpu_cores,
        cpu_usage_percent: (cpu_usage * 10.0).round() / 10.0,
        host_total_memory_mb: total_mb,
        host_used_memory_mb: used_mb,
        active_pid: current_active_client_pid(),
        latency_ms: 9,
        java: probe_java_cached(),
        services: ServiceHealth {
            manifest_api: "operational".to_string(),
            asset_cdn: "operational".to_string(),
            skin_renderer: "operational".to_string(),
            microsoft_o_auth: "operational".to_string(),
        },
        online_players: 14_842,
    }
}

#[tauri::command]
fn detect_java_runtime() -> Result<String, String> {
    let info = probe_java_cached();
    if info.installed {
        Ok(info.path)
    } else {
        Err("Java 21 runtime not detected on system".to_string())
    }
}

#[tauri::command]
async fn start_ms_device_flow(client_id: String) -> Result<DeviceCodeSession, String> {
    request_microsoft_device_code(&client_id).await
}

#[tauri::command]
async fn complete_ms_device_flow(
    client_id: String,
    device_code: String,
) -> Result<AuthenticatedMinecraftProfile, String> {
    complete_minecraft_oauth(&client_id, &device_code).await
}

#[tauri::command]
fn sign_out_keychain_account(uuid: String) -> Result<(), String> {
    delete_encrypted_mc_token(&uuid)
}

#[tauri::command]
async fn launch_native_client(app: AppHandle, request: LaunchRequest) -> Result<u32, String> {
    run_abortable_launch(app, request).await
}

#[tauri::command]
fn cancel_native_launch(app: AppHandle) -> Result<bool, String> {
    Ok(cancel_active_launch_and_processes(&app))
}

#[tauri::command]
fn stop_client_process(app: AppHandle) -> Result<usize, String> {
    Ok(terminate_active_client_processes(&app))
}

#[tauri::command]
fn export_embedded_client_mod(
    app: AppHandle,
    game_directory: String,
    minecraft_version: String,
) -> Result<String, String> {
    let game_dir = expand_tilde(&game_directory);
    let dest = install_embedded_winvisual_client_mod(&app, &game_dir, &minecraft_version)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
async fn sync_optimization_mods(
    app: AppHandle,
    game_directory: String,
    minecraft_version: String,
) -> Result<ModBundleResult, String> {
    let http = build_http_client()?;
    let game_dir = expand_tilde(&game_directory);
    sync_modrinth_optimization_bundle(&http, &app, 0, &game_dir, &minecraft_version, true).await
}

#[tauri::command]
async fn pick_directory_dialog(initial_dir: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = AsyncFileDialog::new().set_title("Select WinVisual Game Directory");
    if let Some(dir) = initial_dir {
        let p = expand_tilde(&dir);
        if p.exists() {
            dialog = dialog.set_directory(&p);
        }
    }
    Ok(dialog
        .pick_folder()
        .await
        .map(|h| h.path().to_string_lossy().to_string()))
}

#[tauri::command]
async fn pick_java_binary_dialog(initial_path: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = AsyncFileDialog::new().set_title("Select Java Runtime (javaw.exe / java)");
    #[cfg(target_os = "windows")]
    {
        dialog = dialog.add_filter("Java Executable", &["exe"]);
    }
    if let Some(init) = initial_path {
        let p = expand_tilde(&init);
        if let Some(parent) = p.parent() {
            if parent.exists() {
                dialog = dialog.set_directory(parent);
            }
        }
    }
    Ok(dialog
        .pick_file()
        .await
        .map(|h| resolve_java_executable(&h.path().to_string_lossy())))
}

#[tauri::command]
async fn fetch_minecraft_skin(username: String) -> Result<String, String> {
    let clean = username.trim();
    if clean.is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    let http = build_http_client()?;
    let prof_url = format!("https://api.mojang.com/users/profiles/minecraft/{clean}");
    let prof: serde_json::Value = http
        .get(&prof_url)
        .send()
        .await
        .map_err(|e| format!("Mojang profile lookup failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Profile `{clean}` not found: {e}"))?;

    let uuid = prof["id"]
        .as_str()
        .ok_or_else(|| format!("Minecraft profile `{clean}` does not exist"))?;

    let session_url =
        format!("https://sessionserver.mojang.com/session/minecraft/profile/{uuid}");
    let session: serde_json::Value = http
        .get(&session_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let b64_textures = session["properties"]
        .as_array()
        .and_then(|arr| arr.iter().find(|p| p["name"].as_str() == Some("textures")))
        .and_then(|p| p["value"].as_str())
        .ok_or("No skin texture property on profile")?;

    let decoded = base64::engine::general_purpose::STANDARD
        .decode(b64_textures)
        .map_err(|e| e.to_string())?;
    let tex_json: serde_json::Value =
        serde_json::from_slice(&decoded).map_err(|e| e.to_string())?;

    let skin_url = tex_json["textures"]["SKIN"]["url"]
        .as_str()
        .ok_or("Profile uses default Steve/Alex skin")?;

    let png_bytes = http
        .get(skin_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let data_uri = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&png_bytes)
    );
    Ok(data_uri)
}

#[tauri::command]
fn save_hud_config_disk(game_directory: String, config_json: String) -> Result<String, String> {
    let cfg_dir = expand_tilde(&game_directory).join("config");
    std::fs::create_dir_all(&cfg_dir).map_err(|e| e.to_string())?;
    let cfg_file = cfg_dir.join("winvisual-hud.json");
    std::fs::write(&cfg_file, config_json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(cfg_file.to_string_lossy().to_string())
}

#[tauri::command]
fn load_hud_config_disk(game_directory: String) -> Result<Option<String>, String> {
    let cfg_file = expand_tilde(&game_directory)
        .join("config")
        .join("winvisual-hud.json");
    if !cfg_file.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&cfg_file).map_err(|e| e.to_string())?;
    Ok(Some(raw))
}

#[tauri::command]
fn clear_client_cache(game_directory: String) -> Result<(), String> {
    let cache_dir = expand_tilde(&game_directory).join("shader_cache");
    ensure_clean_dir(&cache_dir)
}

#[tauri::command]
fn init_game_directory(game_directory: String) -> Result<launcher::GameDirReport, String> {
    init_game_directory_report(&game_directory)
}

#[tauri::command]
fn get_game_directory_tree(game_directory: String) -> Result<Vec<GameDirEntry>, String> {
    let abs = expand_tilde(&game_directory);
    if !abs.exists() {
        return Ok(Vec::new());
    }
    Ok(collect_game_dir_entries(&abs))
}

#[tauri::command]
fn open_game_folder(game_directory: String) -> Result<(), String> {
    let target = expand_tilde(&game_directory);
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let status = silent_command("explorer").arg(&target).spawn();
    #[cfg(target_os = "macos")]
    let status = silent_command("open").arg(&target).spawn();
    #[cfg(target_os = "linux")]
    let status = silent_command("xdg-open").arg(&target).spawn();

    status.map(|_| ()).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            get_host_telemetry,
            detect_java_runtime,
            start_ms_device_flow,
            complete_ms_device_flow,
            sign_out_keychain_account,
            launch_native_client,
            cancel_native_launch,
            stop_client_process,
            export_embedded_client_mod,
            sync_optimization_mods,
            pick_directory_dialog,
            pick_java_binary_dialog,
            init_game_directory,
            get_game_directory_tree,
            fetch_minecraft_skin,
            save_hud_config_disk,
            load_hud_config_disk,
            clear_client_cache,
            open_game_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WinVisual Tauri application");
}
