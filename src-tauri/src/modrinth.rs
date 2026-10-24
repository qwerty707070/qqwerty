use crate::launcher::{build_http_client, expand_tilde, scaffold_winvisual_game_dir};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

const MODRINTH_API: &str = "https://api.modrinth.com";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthHit {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub icon_url: String,
    pub downloads: u64,
    pub game_versions: Vec<String>,
    pub project_type: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthProgress {
    pub slug: String,
    pub filename: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub stage: String,
}

#[derive(Debug, Deserialize)]
struct ApiSearchResult {
    #[serde(default)]
    slug: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    icon_url: Option<String>,
    #[serde(default)]
    downloads: Option<u64>,
    #[serde(default)]
    game_versions: Option<Vec<String>>,
    #[serde(default)]
    project_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiVersionFile {
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    filename: Option<String>,
    #[serde(default)]
    primary: Option<bool>,
    #[serde(default)]
    hashes: Option<std::collections::BTreeMap<String, String>>,
}

#[derive(Debug, Deserialize)]
struct ApiVersion {
    #[serde(default)]
    version_number: Option<String>,
    #[serde(default)]
    files: Option<Vec<ApiVersionFile>>,
}

/// Decodes a Modrinth API response with clear errors: non-2xx statuses and
/// unexpected bodies (HTML block pages, error JSON objects) are reported with
/// the HTTP status and a body snippet instead of an opaque decode failure.
async fn parse_api_response<T: serde::de::DeserializeOwned>(
    resp: reqwest::Response,
) -> Result<T, String> {
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(240).collect();
        return Err(format!("Modrinth API returned HTTP {status}: {snippet}"));
    }
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Cannot read Modrinth API response: {e}"))?;
    match serde_json::from_str::<T>(&text) {
        Ok(value) => Ok(value),
        Err(_) => {
            let snippet: String = text.chars().take(240).collect();
            Err(format!(
                "Modrinth API returned an unexpected response (HTTP {status}): {snippet}"
            ))
        }
    }
}

fn sanitize_slug(slug: &str) -> Result<String, String> {
    let clean: String = slug
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(64)
        .collect();
    if clean.is_empty() {
        return Err("Invalid Modrinth project slug".to_string());
    }
    Ok(clean)
}

fn resource_type_dir(resource_type: &str) -> &'static str {
    if resource_type == "resourcepack" {
        "resourcepacks"
    } else {
        "mods"
    }
}

/// Live Modrinth API v2 search for Fabric mods or resource packs of the selected Minecraft version.
pub async fn search_modrinth_resources(
    query: &str,
    resource_type: &str,
    game_version: &str,
) -> Result<Vec<ModrinthHit>, String> {
    let http = build_http_client()?;
    let is_pack = resource_type == "resourcepack";

    let facets: Vec<Vec<String>> = if is_pack {
        vec![
            vec!["project_types:resourcepack".to_string()],
            vec![format!("game_versions:{game_version}")],
        ]
    } else {
        vec![
            vec!["project_types:mod".to_string()],
            vec!["loaders:fabric".to_string()],
            vec![format!("game_versions:{game_version}")],
        ]
    };
    let facets_json = serde_json::to_string(&facets).map_err(|e| e.to_string())?;

    let clean_query = query.trim();
    let mut req = http
        .get(format!("{MODRINTH_API}/v2/search"))
        .query(&[
            ("limit", "24"),
            ("index", "downloads"),
            ("facets", facets_json.as_str()),
        ]);
    if !clean_query.is_empty() {
        req = req.query(&[("query", clean_query)]);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Modrinth API unreachable: {e}"))?;
    let body: Vec<ApiSearchResult> = parse_api_response(resp).await?;

    Ok(body
        .into_iter()
        .filter_map(|r| {
            let slug = r.slug?;
            if slug.is_empty() {
                return None;
            }
            Some(ModrinthHit {
                title: r.title.filter(|t| !t.is_empty()).unwrap_or(slug.clone()),
                description: r.description.unwrap_or_default(),
                icon_url: r.icon_url.unwrap_or_default(),
                downloads: r.downloads.unwrap_or(0),
                game_versions: r.game_versions.unwrap_or_default(),
                project_type: r.project_type.unwrap_or_else(|| "mod".to_string()),
                slug,
            })
        })
        .collect())
}

/// Resolves the newest Modrinth version file for a project + Minecraft version and downloads it
/// straight into `WinVisual/mods` or `WinVisual/resourcepacks` with SHA-1 verification.
pub async fn download_modrinth_resource(
    app: &AppHandle,
    slug_raw: &str,
    resource_type: &str,
    game_version: &str,
    game_dir_raw: &str,
) -> Result<PathBuf, String> {
    let http = build_http_client()?;
    let slug = sanitize_slug(slug_raw)?;
    let is_pack = resource_type == "resourcepack";

    let _ = app.emit(
        "logs://line",
        format!("[MODRINTH] Resolving newest version of `{slug}` for Minecraft {game_version}..."),
    );

    let game_versions_json = format!("[\"{game_version}\"]");
    let mut req = http
        .get(format!("{MODRINTH_API}/v2/project/{slug}/version"))
        .query(&[("game_versions", game_versions_json.as_str())]);
    if !is_pack {
        req = req.query(&[("loaders", "[\"fabric\"]")]);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Modrinth API unreachable: {e}"))?;
    let versions: Vec<ApiVersion> = parse_api_response(resp).await?;

    let version = versions
        .first()
        .ok_or_else(|| format!("No {resource_type} version of `{slug}` found for Minecraft {game_version}"))?;

    let files = version.files.as_deref().unwrap_or_default();
    let file = files
        .iter()
        .find(|f| f.primary.unwrap_or(false))
        .or_else(|| files.first())
        .ok_or_else(|| format!("Project `{slug}` has no downloadable files"))?;

    let file_url = file
        .url
        .as_deref()
        .filter(|u| !u.is_empty())
        .ok_or_else(|| "Modrinth returned an empty download file entry".to_string())?;
    let expected_sha1 = file
        .hashes
        .as_ref()
        .and_then(|h| h.get("sha1").cloned());
    let filename_raw = file
        .filename
        .as_deref()
        .filter(|f| !f.is_empty())
        .ok_or_else(|| "Modrinth returned an empty file name".to_string())?;
    let filename = filename_raw
        .replace(['/', '\\', ':', '*'], "_")
        .chars()
        .take(180)
        .collect::<String>();

    let game_dir = expand_tilde(game_dir_raw);
    scaffold_winvisual_game_dir(&game_dir)?;
    let dest_dir = game_dir.join(resource_type_dir(resource_type));
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(&filename);

    let _ = app.emit(
        "modrinth://progress",
        ModrinthProgress {
            slug: slug.clone(),
            filename: filename.clone(),
            downloaded_bytes: 0,
            total_bytes: 0,
            stage: "resolving".to_string(),
        },
    );

    let _ = app.emit(
        "logs://line",
        format!(
            "[MODRINTH] Downloading `{slug}` v{} -> {}",
            version.version_number.as_deref().unwrap_or(""),
            dest_dir.display()
        ),
    );

    let mut resp = http
        .get(file_url)
        .send()
        .await
        .map_err(|e| format!("Download from Modrinth CDN failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Modrinth CDN returned HTTP {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(0);
    let mut out = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| format!("Cannot create `{}`: {e}", dest.display()))?;
    let mut hasher = Sha1::new();
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Modrinth CDN stream interrupted: {e}"))?
    {
        if chunk.is_empty() {
            continue;
        }
        hasher.update(&chunk);
        out.write_all(&chunk)
            .await
            .map_err(|e| format!("Cannot write `{filename}`: {e}"))?;
        downloaded += chunk.len() as u64;
        if downloaded - last_emit >= 128 * 1024 || downloaded == total {
            last_emit = downloaded;
            let _ = app.emit(
                "modrinth://progress",
                ModrinthProgress {
                    slug: slug.clone(),
                    filename: filename.clone(),
                    downloaded_bytes: downloaded,
                    total_bytes: total,
                    stage: "downloading".to_string(),
                },
            );
        }
    }
    out.flush().await.map_err(|e| e.to_string())?;

    let actual_sha1 = hex::encode(hasher.finalize());
    if let Some(ref exp) = expected_sha1 {
        if !exp.eq_ignore_ascii_case(&actual_sha1) {
            let _ = tokio::fs::remove_file(&dest).await;
            return Err(format!(
                "SHA-1 mismatch on {filename}: expected {exp}, got {actual_sha1}"
            ));
        }
        let _ = app.emit(
            "logs://line",
            format!("[SHA-1] Verified {filename} ({}) bytes", downloaded),
        );
    }

    let _ = app.emit(
        "logs://line",
        format!(
            "[MODRINTH] Installed {filename} ({} KB) -> {}",
            downloaded / 1024,
            dest.display()
        ),
    );

    Ok(dest)
}
