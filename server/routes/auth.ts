import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  generatePkceAndState,
  buildGoogleAuthUrl,
  handleOAuthCallback,
  revokeGmailConnection,
  saveOAuthPending,
  consumeOAuthPending,
} from '../services/googleAuth.js';
import { config } from '../config.js';
import { getDb } from '../db.js';

const router = Router();

// GET /api/auth/google/start
router.get('/google/start', requireAdmin, async (req: Request, res: Response) => {
  const { state, verifier, challenge } = generatePkceAndState();
  const adminId = req.session.adminId || 'admin_single_tenant';

  // Store PKCE state in DB (not session) — avoids cookie domain mismatch
  // between localhost:3000 and 127.0.0.1:3000 during OAuth redirect
  await saveOAuthPending(state, adminId, verifier);

  const googleAuthUrl = buildGoogleAuthUrl(state, challenge);
  return res.redirect(googleAuthUrl);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  if (!config.isFeatureEnabled) {
    return res.status(503).json({ error: 'Gmail feature is disabled' });
  }

  const { code, state, error } = req.query;

  if (error) {
    console.warn('Google OAuth returned error:', error);
    return res.redirect(`${config.appUrl}/#gmail-error?reason=${encodeURIComponent(String(error))}`);
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'Invalid OAuth callback parameters' });
  }

  // Retrieve PKCE state from DB (single-use, deleted on retrieval)
  const pending = await consumeOAuthPending(state);
  if (!pending) {
    return res.status(400).json({ error: 'OAuth state mismatch or invalid transaction' });
  }

  const { adminId, pkceVerifier } = pending;

  try {
    const connectedEmail = await handleOAuthCallback(code, pkceVerifier, adminId);

    // Rotate session ID after successful OAuth flow
    req.session.regenerate((err) => {
      if (!err) {
        req.session.adminAuthenticated = true;
        req.session.adminId = adminId;
        req.session.createdAt = Date.now();
      }
      return res.redirect(`${config.appUrl}/#gmail-connected?email=${encodeURIComponent(connectedEmail)}`);
    });
  } catch (err: any) {
    console.error('Failed to complete OAuth token exchange:', err);
    return res.redirect(`${config.appUrl}/#gmail-error?reason=${encodeURIComponent(err.message || 'token_exchange_failed')}`);
  }
});

// POST /api/auth/google/disconnect
router.post('/google/disconnect', requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.session.adminId || 'admin_single_tenant';

  try {
    await revokeGmailConnection(adminId);
    return res.json({ connected: false });
  } catch (err: any) {
    console.error('Failed to disconnect Gmail account:', err);
    return res.status(500).json({ error: 'Failed to disconnect Gmail account' });
  }
});

// GET /api/auth/google/status (Public status check for UI header badge)
router.get('/google/status', async (_req: Request, res: Response) => {
  if (!config.isFeatureEnabled) {
    return res.json({ connected: false, featureEnabled: false });
  }

  try {
    const db = await getDb();
    const row = await db.get(
      `SELECT email, updated_at FROM oauth_connections WHERE admin_id = 'admin_single_tenant';`
    );

    if (!row) {
      return res.json({ connected: false, featureEnabled: true });
    }

    return res.json({
      connected: true,
      email: row.email,
      connectedAt: row.updated_at,
      featureEnabled: true,
    });
  } catch (err: any) {
    return res.json({ connected: false, featureEnabled: true });
  }
});

// GET /api/admin/gmail/status
router.get('/admin/gmail/status', requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.session.adminId || 'admin_single_tenant';

  try {
    const db = await getDb();
    const row = await db.get(
      `SELECT email, updated_at FROM oauth_connections WHERE admin_id = ?;`,
      [adminId]
    );

    if (!row) {
      return res.json({ connected: false });
    }

    return res.json({
      connected: true,
      email: row.email,
      connectedAt: row.updated_at,
    });
  } catch (err: any) {
    console.error('Failed to check Gmail status:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

export default router;
