export interface MicrosoftOAuthConfigInfo {
  authorizeEndpoint: string;
  protocol: string;
  tokenStorage: string;
  backendConfigured: false;
}

export function getMicrosoftOAuthDetails(): MicrosoftOAuthConfigInfo {
  return {
    authorizeEndpoint: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode',
    protocol: 'OAuth 2.0 Device Authorization + Xbox Live XSTS -> Minecraft Services',
    tokenStorage: 'OS Native Keyring (Stronghold / Secret Service) — never stored in plaintext',
    backendConfigured: false,
  };
}
