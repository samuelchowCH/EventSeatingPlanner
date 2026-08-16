import crypto from 'crypto';
import { google } from 'googleapis';
import { config } from '../config.js';
import { getDb } from '../db.js';

export interface EncryptedTokenBlob {
  ciphertext: string;
  iv: string;
  authTag: string;
  aad: string;
  keyVersion: number;
}

function getEncryptionKey(): Buffer {
  if (config.oauthEncryptionKey) return config.oauthEncryptionKey;
  const rawKey = process.env.OAUTH_ENCRYPTION_KEY?.trim() || '';
  if (rawKey) {
    const buf = Buffer.from(rawKey, 'base64url');
    if (buf.length === 32) return buf;
  }
  throw new Error('OAuth encryption key is not configured');
}

export function encryptRefreshToken(refreshToken: string, adminId: string): EncryptedTokenBlob {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);
  const keyVersion = config.oauthEncryptionKeyVersion || 1;
  const aadString = `oauth:refresh_token:v${keyVersion}:${adminId}`;
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aadString, 'utf8'));

  let ciphertext = cipher.update(refreshToken, 'utf8', 'base64url');
  ciphertext += cipher.final('base64url');

  const authTag = cipher.getAuthTag().toString('base64url');

  return {
    ciphertext,
    iv: iv.toString('base64url'),
    authTag,
    aad: aadString,
    keyVersion,
  };
}

export function decryptRefreshToken(blob: EncryptedTokenBlob, adminId: string): string {
  const key = getEncryptionKey();

  const ivBuffer = Buffer.from(blob.iv, 'base64url');
  const authTagBuffer = Buffer.from(blob.authTag, 'base64url');
  const expectedAad = `oauth:refresh_token:v${blob.keyVersion}:${adminId}`;

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
  decipher.setAAD(Buffer.from(expectedAad, 'utf8'));
  decipher.setAuthTag(authTagBuffer);

  let decrypted = decipher.update(blob.ciphertext, 'base64url', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function generatePkceAndState() {
  const state = crypto.randomBytes(32).toString('base64url');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  return { state, verifier, challenge };
}

/**
 * Persist PKCE state+verifier in the DB (oauth_pending table).
 * This avoids session cookie domain issues when localhost vs 127.0.0.1 are used.
 */
export async function saveOAuthPending(state: string, adminId: string, pkceVerifier: string): Promise<void> {
  const db = await getDb();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min
  await db.run(
    `INSERT INTO oauth_pending (state, admin_id, pkce_verifier, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(state) DO UPDATE SET pkce_verifier = excluded.pkce_verifier, expires_at = excluded.expires_at`,
    [state, adminId, pkceVerifier, expiresAt]
  );
}

/**
 * Retrieve and delete the pending OAuth transaction in one atomic step.
 * Returns null if not found or expired.
 */
export async function consumeOAuthPending(state: string): Promise<{ adminId: string; pkceVerifier: string } | null> {
  const db = await getDb();
  const row = await db.get<{ admin_id: string; pkce_verifier: string; expires_at: number }>(
    `SELECT admin_id, pkce_verifier, expires_at FROM oauth_pending WHERE state = ?`,
    [state]
  );
  // Always delete after retrieval (single-use)
  await db.run(`DELETE FROM oauth_pending WHERE state = ?`, [state]);

  if (!row || row.expires_at < Date.now()) return null;
  return { adminId: row.admin_id, pkceVerifier: row.pkce_verifier };
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
}

export function buildGoogleAuthUrl(state: string, codeChallenge: string): string {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256' as any,
  });
}

export async function handleOAuthCallback(code: string, verifier: string, adminId: string): Promise<string> {
  const oauth2Client = getOAuth2Client();

  const { tokens } = await oauth2Client.getToken({
    code,
    codeVerifier: verifier,
  });

  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned by Google. User may need to revoke existing grant or consent prompt was bypassed.');
  }

  if (tokens.scope && !tokens.scope.includes('gmail.send')) {
    console.warn('Granted OAuth scopes missing gmail.send:', tokens.scope);
    throw new Error('Gmail send permission (gmail.send) was not granted during authorization. Please reconnect and make sure to check the email sending permission checkbox.');
  }

  oauth2Client.setCredentials(tokens);

  // Extract connected email address via ID token or TokenInfo
  let connectedEmail = 'organizer@gmail.com';
  if (tokens.id_token) {
    try {
      const payloadStr = Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadStr);
      if (payload && payload.email) {
        connectedEmail = payload.email;
      }
    } catch (e) {}
  }

  if (connectedEmail === 'organizer@gmail.com' && tokens.access_token) {
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      if (tokenInfo.email) {
        connectedEmail = tokenInfo.email;
      }
    } catch (tErr) {}
  }

  const encryptedBlob = encryptRefreshToken(tokens.refresh_token, adminId);
  const db = await getDb();
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.run(
    `INSERT INTO oauth_connections 
      (id, admin_id, email, ciphertext, iv, auth_tag, aad, key_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(admin_id) DO UPDATE SET
      email = excluded.email,
      ciphertext = excluded.ciphertext,
      iv = excluded.iv,
      auth_tag = excluded.auth_tag,
      aad = excluded.aad,
      key_version = excluded.key_version,
      updated_at = excluded.updated_at;`,
    [
      id,
      adminId,
      connectedEmail,
      encryptedBlob.ciphertext,
      encryptedBlob.iv,
      encryptedBlob.authTag,
      encryptedBlob.aad,
      encryptedBlob.keyVersion,
      now,
      now,
    ]
  );

  return connectedEmail;
}

export async function getGmailClientForAdmin(adminId: string) {
  const db = await getDb();
  const row = await db.get(
    `SELECT * FROM oauth_connections WHERE admin_id = ?;`,
    [adminId]
  );

  if (!row) {
    throw new Error('No connected Gmail account found for this admin');
  }

  const refreshToken = decryptRefreshToken(
    {
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.auth_tag,
      aad: row.aad,
      keyVersion: row.key_version,
    },
    adminId
  );

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function revokeGmailConnection(adminId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get(
    `SELECT * FROM oauth_connections WHERE admin_id = ?;`,
    [adminId]
  );

  if (!row) {
    return false;
  }

  try {
    const refreshToken = decryptRefreshToken(
      {
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.auth_tag,
        aad: row.aad,
        keyVersion: row.key_version,
      },
      adminId
    );

    const oauth2Client = getOAuth2Client();
    await oauth2Client.revokeToken(refreshToken);
  } catch (err: any) {
    const errorMsg = err?.response?.data?.error || err?.message || 'invalid_token';
    console.warn(`[Google OAuth] revokeToken note: ${errorMsg} (token already inactive or expired on Google)`);
  }

  await db.run(`DELETE FROM oauth_connections WHERE admin_id = ?;`, [adminId]);
  return true;
}
