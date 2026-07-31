import { google } from 'googleapis';
import { getSetting, setSetting } from './db.js';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];

const REDIRECT_URI = 'http://localhost:3000/api/google/callback';

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
export function getAuthUrl(redirectUri) {
  const client = getOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Exchange auth code for tokens and save to DB
 */
export async function handleCallback(code, redirectUri) {
  const client = getOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  setSetting('google_tokens', JSON.stringify(tokens));

  // Get user email
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();

  if (data.email) {
    setSetting('google_email', data.email);
  }

  return { email: data.email, tokens };
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

  // Set up token refresh callback
  client.on('tokens', (newTokens) => {
    const current = JSON.parse(getSetting('google_tokens') || '{}');
    const merged = { ...current, ...newTokens };
    setSetting('google_tokens', JSON.stringify(merged));
  });

  return client;
}

/**
 * Check Google connection status
 */
export function getGoogleStatus() {
  const clientId = getSetting('google_client_id');
  const clientSecret = getSetting('google_client_secret');
  const tokensStr = getSetting('google_tokens');
  const email = getSetting('google_email');

  return {
    credentialsSet: !!(clientId && clientSecret),
    connected: !!tokensStr,
    email: email || null,
  };
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
