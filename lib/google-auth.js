import { google } from 'googleapis';
import { getSetting, setSetting } from './db.js';
import crypto from 'crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];

const REDIRECT_URI = 'http://localhost:3000/api/google/callback';

/**
 * Check if a Google API / OAuth error is an invalid_grant (revoked or expired refresh token)
 */
export function isGoogleInvalidGrant(error) {
  if (!error) return false;
  const msg = String(
    error.message ||
    error.response?.data?.error_description ||
    error.response?.data?.error ||
    ''
  ).toLowerCase();
  const code = error.code || error.response?.status;
  return (
    msg.includes('invalid_grant') ||
    msg.includes('token has been expired or revoked') ||
    msg.includes('revoked') ||
    (code === 400 && msg.includes('grant'))
  );
}

/**
 * Classify Google API / Connection failures deterministically
 */
export function classifyGoogleConnectionFailure(error) {
  if (isGoogleInvalidGrant(error)) {
    return {
      state: 'reauth_required',
      connected: false,
      code: 'GOOGLE_REAUTH_REQUIRED',
      message: 'Koneksi Google perlu dihubungkan ulang (OAuth token revoked/expired).'
    };
  }
  const status = error?.status || error?.response?.status || 0;
  if (status === 403 || error?.message?.includes('insufficientPermissions')) {
    return {
      state: 'permission_error',
      connected: false,
      code: 'GOOGLE_PERMISSION_ERROR',
      message: error.message || 'Izin Google OAuth tidak mencukupi.'
    };
  }
  if (status === 429 || status >= 500 || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND' || error?.code === 'ECONNRESET') {
    return {
      state: 'temporarily_unavailable',
      connected: false,
      code: 'GOOGLE_TEMPORARILY_UNAVAILABLE',
      message: error.message || 'Layanan Google sementara tidak dapat dihubungi.'
    };
  }
  return {
    state: 'unknown_error',
    connected: false,
    code: 'GOOGLE_UNKNOWN_ERROR',
    message: error.message || 'Terjadi kesalahan pada koneksi Google.'
  };
}

/**
 * Sign OAuth state payload using HMAC SHA256 to prevent open redirect
 */
export function signOAuthState(payload) {
  const secret = getSetting('google_client_secret') || 'makna_oauth_secret_fallback';
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(dataStr).digest('base64url');
  return `${dataStr}.${hmac}`;
}

/**
 * Verify and parse signed OAuth state
 */
export function verifyOAuthState(stateStr) {
  if (!stateStr || typeof stateStr !== 'string' || !stateStr.includes('.')) return null;
  const [dataStr, hmac] = stateStr.split('.');
  if (!dataStr || !hmac) return null;
  const secret = getSetting('google_client_secret') || 'makna_oauth_secret_fallback';
  const expectedHmac = crypto.createHmac('sha256', secret).update(dataStr).digest('base64url');
  if (hmac !== expectedHmac) return null;
  try {
    const parsed = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
    if (parsed.exp && typeof parsed.exp === 'number' && parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Normalize and validate allowed return paths
 */
export function normalizeAllowedReturnPath(path) {
  if (!path || typeof path !== 'string') return '/settings';
  const allowedPrefixes = ['/settings', '/content-flow'];
  if (path.startsWith('/') && !path.startsWith('//') && allowedPrefixes.some(p => path.startsWith(p))) {
    return path;
  }
  return '/settings';
}

/**
 * Create OAuth2 client from stored credentials
 */
export function getOAuthClient(redirectUri) {
  const clientId = getSetting('google_client_id');
  const clientSecret = getSetting('google_client_secret');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth2 credentials belum dikonfigurasi. Set di Settings.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri || REDIRECT_URI);
}

/**
 * Generate Google consent URL
 */
export function getAuthUrl(redirectUri, state = null) {
  const client = getOAuthClient(redirectUri);
  const options = {
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  };
  if (state) {
    options.state = state;
  }
  return client.generateAuthUrl(options);
}

/**
 * Exchange auth code for tokens and save to DB
 */
export async function handleCallback(code, redirectUri) {
  const client = getOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);

  const currentTokensStr = getSetting('google_tokens');
  let currentTokens = {};
  if (currentTokensStr) {
    try {
      currentTokens = JSON.parse(currentTokensStr);
    } catch (_) {}
  }
  const mergedTokens = { ...currentTokens, ...tokens };
  setSetting('google_tokens', JSON.stringify(mergedTokens));

  // Get user email
  client.setCredentials(mergedTokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();

  if (data.email) {
    setSetting('google_email', data.email);
  }

  return { email: data.email, tokens: mergedTokens };
}

/**
 * Get authorized client with valid tokens (auto-refresh)
 */
export function getAuthorizedClient() {
  const client = getOAuthClient();
  const tokensStr = getSetting('google_tokens');

  if (!tokensStr) {
    throw new Error('Google account belum terhubung. Connect di Settings.');
  }

  const tokens = JSON.parse(tokensStr);
  client.setCredentials(tokens);

  // Set up token refresh callback — preserve refresh_token
  client.on('tokens', (newTokens) => {
    let current = {};
    try {
      current = JSON.parse(getSetting('google_tokens') || '{}');
    } catch (_) {}
    const merged = { ...current, ...newTokens };
    setSetting('google_tokens', JSON.stringify(merged));
  });

  return client;
}

/**
 * Normalize scopes returned from tokenInfo or credentials
 * @param {string|string[]} scopes
 * @returns {string[]}
 */
export function normalizeGoogleScopes(scopes) {
  if (!scopes) return [];
  if (Array.isArray(scopes)) {
    return scopes.map(s => String(s).trim()).filter(Boolean);
  }
  if (typeof scopes === 'string') {
    return scopes.split(/\s+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Check if granted scopes include drive.file or broader Drive scope
 * @param {string[]} grantedScopes
 * @returns {boolean}
 */
export function hasCompatibleDriveScope(grantedScopes) {
  const normalized = normalizeGoogleScopes(grantedScopes);
  const compatible = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive',
    'drive.file',
    'drive'
  ];
  return normalized.some(s => compatible.includes(s));
}

/**
 * Check Google connection status (basic)
 */
export function getGoogleStatus() {
  const clientId = getSetting('google_client_id');
  const clientSecret = getSetting('google_client_secret');
  const tokensStr = getSetting('google_tokens');
  const email = getSetting('google_email');

  let grantedScopes = [];
  if (tokensStr) {
    try {
      const parsed = JSON.parse(tokensStr);
      grantedScopes = normalizeGoogleScopes(parsed.scope);
    } catch (_) {}
  }

  return {
    credentialsSet: !!(clientId && clientSecret),
    connected: !!tokensStr,
    email: email || null,
    grantedScopes,
    driveFileScopeGranted: hasCompatibleDriveScope(grantedScopes)
  };
}

/**
 * Verify Google connection actively by requesting an access token
 */
export async function verifyGoogleConnection() {
  const clientId = getSetting('google_client_id');
  const clientSecret = getSetting('google_client_secret');
  const tokensStr = getSetting('google_tokens');
  const email = getSetting('google_email');

  if (!clientId || !clientSecret) {
    return {
      state: 'not_configured',
      connected: false,
      credentialsSet: false,
      email: null,
      grantedScopes: [],
      driveFileScopeGranted: false,
      message: 'Google Client ID / Secret belum dikonfigurasi.'
    };
  }

  if (!tokensStr) {
    return {
      state: 'not_connected',
      connected: false,
      credentialsSet: true,
      email: null,
      grantedScopes: [],
      driveFileScopeGranted: false,
      message: 'Akun Google belum terhubung.'
    };
  }

  try {
    const client = getAuthorizedClient();
    const tokenRes = await client.getAccessToken();
    const tokenStr = typeof tokenRes === 'string' ? tokenRes : tokenRes?.token || client.credentials?.access_token;

    let grantedScopes = [];
    if (tokenStr) {
      try {
        const tokenInfo = await client.getTokenInfo(tokenStr);
        grantedScopes = normalizeGoogleScopes(tokenInfo.scopes);
      } catch {
        // Fallback to credentials scope if tokenInfo call fails
        grantedScopes = normalizeGoogleScopes(client.credentials?.scope);
      }
    } else {
      grantedScopes = normalizeGoogleScopes(client.credentials?.scope);
    }

    const driveFileScopeGranted = hasCompatibleDriveScope(grantedScopes);

    return {
      state: 'connected',
      connected: true,
      credentialsSet: true,
      email: email || null,
      grantedScopes,
      driveFileScopeGranted,
      message: 'Koneksi Google aktif dan terverifikasi.'
    };
  } catch (error) {
    const classified = classifyGoogleConnectionFailure(error);
    return {
      credentialsSet: true,
      email: email || null,
      grantedScopes: [],
      driveFileScopeGranted: false,
      ...classified
    };
  }
}


/**
 * Disconnect Google account
 */
export function disconnectGoogle() {
  setSetting('google_tokens', '');
  setSetting('google_email', '');
}

/**
 * Helper to check if Google Sheets sync should be executed:
 * Returns true ONLY if storage_provider === 'gdrive' AND Google account is connected.
 */
export function shouldSyncGoogleSheets() {
  const storageProvider = getSetting('storage_provider') || 'gdrive';
  if (storageProvider !== 'gdrive') return false;

  const status = getGoogleStatus();
  return status.credentialsSet && status.connected;
}

