use keyring::Entry;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

const KEYRING_SERVICE: &str = "com.aethervisual.launcher.oauth";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodeSession {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticatedMinecraftProfile {
    pub uuid: String,
    pub username: String,
    pub skin_url: Option<String>,
    pub token_stored_in_keychain: bool,
}

#[derive(Debug, Deserialize)]
struct MsTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
}

/// Step 1: Request OAuth 2.0 Device Code from Microsoft Identity Platform.
/// Credentials are entered strictly in the user's system browser at microsoft.com/link.
pub async fn request_microsoft_device_code(client_id: &str) -> Result<DeviceCodeSession, String> {
    let http = Client::new();
    let res = http
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&[
            ("client_id", client_id),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await
        .map_err(|e| format!("Microsoft OAuth request error: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("OAuth HTTP {}", res.status()));
    }
    res.json::<DeviceCodeSession>()
        .await
        .map_err(|e| format!("Invalid device code payload: {e}"))
}

/// Step 2: Exchange OAuth Device Code -> Xbox Live -> XSTS -> Minecraft Java Profile
/// and persist refresh/access secrets exclusively in the OS Native Keychain.
pub async fn complete_minecraft_oauth(
    client_id: &str,
    device_code: &str,
) -> Result<AuthenticatedMinecraftProfile, String> {
    let http = Client::new();

    // 1. Poll MS OAuth token
    let ms_res = http
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", client_id),
            ("device_code", device_code),
        ])
        .send()
        .await
        .map_err(|e| format!("Token exchange network error: {e}"))?;

    if !ms_res.status().is_success() {
        return Err("authorization_pending".to_string());
    }
    let ms_token: MsTokenResponse = ms_res.json().await.map_err(|e| e.to_string())?;

    // 2. Authenticate with Xbox Live
    let xbl_res: serde_json::Value = http
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={}", ms_token.access_token)
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let xbl_token = xbl_res["Token"].as_str().ok_or("Missing XBL token")?;
    let user_hash = xbl_res["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .ok_or("Missing Xbox user hash")?;

    // 3. Exchange for XSTS Token
    let xsts_res: serde_json::Value = http
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let xsts_token = xsts_res["Token"].as_str().ok_or("Missing XSTS token")?;

    // 4. Authenticate with Minecraft Services
    let mc_auth: serde_json::Value = http
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&json!({
            "identityToken": format!("XBL3.0 x={user_hash};{xsts_token}")
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mc_jwt = mc_auth["access_token"]
        .as_str()
        .ok_or("Missing Minecraft Services JWT")?;

    // 5. Fetch Official Minecraft Profile & Skin
    let profile: serde_json::Value = http
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_jwt)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let uuid = profile["id"]
        .as_str()
        .ok_or("This Microsoft account does not own Minecraft: Java Edition")?
        .to_string();
    let username = profile["name"].as_str().unwrap_or("Player").to_string();
    let skin_url = profile["skins"][0]["url"].as_str().map(String::from);

    // 6. Store token encrypted inside OS Keyring (never written to plaintext JSON)
    let entry = Entry::new(KEYRING_SERVICE, &uuid).map_err(|e| e.to_string())?;
    let secret_payload = json!({
        "mc_access_token": mc_jwt,
        "ms_refresh_token": ms_token.refresh_token,
    })
    .to_string();
    entry
        .set_password(&secret_payload)
        .map_err(|e| format!("OS Keychain storage failed: {e}"))?;

    Ok(AuthenticatedMinecraftProfile {
        uuid,
        username,
        skin_url,
        token_stored_in_keychain: true,
    })
}

pub fn load_encrypted_mc_token(uuid: &str) -> Option<String> {
    let entry = Entry::new(KEYRING_SERVICE, uuid).ok()?;
    let raw = entry.get_password().ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    parsed["mc_access_token"].as_str().map(String::from)
}

pub fn delete_encrypted_mc_token(uuid: &str) -> Result<(), String> {
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, uuid) {
        let _ = entry.delete_credential();
    }
    Ok(())
}
