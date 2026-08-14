import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  isFeatureEnabled: boolean;
  featureDisabledReason: string | null;
  adminPasswordHash: string;
  sessionSecret: string;
  oauthEncryptionKey: Buffer | null;
  oauthEncryptionKeyVersion: number;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  appUrl: string;
  sendIntervalMs: number;
  batchCap: number;
  dailySendCap: number;
  maxRetryAttempts: number;
  reminderCooldownHours: number;
  leaseTimeoutSeconds: number;
}

function validateConfig(): AppConfig {
  let isFeatureEnabled = true;
  const reasons: string[] = [];

  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim() || '';
  if (!adminPasswordHash) {
    isFeatureEnabled = false;
    reasons.push('ADMIN_PASSWORD_HASH is absent or empty');
  }

  const sessionSecret = process.env.SESSION_SECRET?.trim() || '';
  if (!sessionSecret || sessionSecret.length < 16) {
    isFeatureEnabled = false;
    reasons.push('SESSION_SECRET is absent or under 16 characters');
  }

  const rawEncryptionKey = process.env.OAUTH_ENCRYPTION_KEY?.trim() || '';
  let oauthEncryptionKey: Buffer | null = null;

  if (!rawEncryptionKey) {
    isFeatureEnabled = false;
    reasons.push('OAUTH_ENCRYPTION_KEY is absent');
  } else {
    try {
      const decoded = Buffer.from(rawEncryptionKey, 'base64url');
      if (decoded.length !== 32) {
        isFeatureEnabled = false;
        reasons.push(`OAUTH_ENCRYPTION_KEY decoded length is ${decoded.length} bytes (must be exactly 32 bytes)`);
      } else {
        oauthEncryptionKey = decoded;
      }
    } catch (err) {
      isFeatureEnabled = false;
      reasons.push('OAUTH_ENCRYPTION_KEY is not a valid base64url string');
    }
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || 'http://localhost:3000/api/auth/google/callback';

  if (!googleClientId || !googleClientSecret) {
    // Note: Gmail integration requires credentials, but if absent, we disable Gmail feature safely.
    isFeatureEnabled = false;
    reasons.push('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
  }

  const appUrl = process.env.APP_URL?.trim() || 'http://localhost:3000';
  const sendIntervalMs = parseInt(process.env.SEND_INTERVAL_MS || '8000', 10);
  const batchCap = parseInt(process.env.BATCH_CAP || '200', 10);
  const dailySendCap = parseInt(process.env.DAILY_SEND_CAP || '400', 10);
  const maxRetryAttempts = parseInt(process.env.MAX_RETRY_ATTEMPTS || '5', 10);
  const reminderCooldownHours = parseInt(process.env.REMINDER_COOLDOWN_HOURS || '24', 10);
  const leaseTimeoutSeconds = parseInt(process.env.LEASE_TIMEOUT_SECONDS || '120', 10);
  const oauthEncryptionKeyVersion = parseInt(process.env.OAUTH_ENCRYPTION_KEY_VERSION || '1', 10);

  const featureDisabledReason = reasons.length > 0 ? reasons.join('; ') : null;

  if (!isFeatureEnabled) {
    console.warn(`[Gmail Service Disabled] ${featureDisabledReason}. Seating Planner core features remain active.`);
  }

  return {
    isFeatureEnabled,
    featureDisabledReason,
    adminPasswordHash,
    sessionSecret,
    oauthEncryptionKey,
    oauthEncryptionKeyVersion,
    googleClientId,
    googleClientSecret,
    googleRedirectUri,
    appUrl,
    sendIntervalMs,
    batchCap,
    dailySendCap,
    maxRetryAttempts,
    reminderCooldownHours,
    leaseTimeoutSeconds,
  };
}

export const config = validateConfig();
