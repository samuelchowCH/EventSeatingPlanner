import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { config } from '../config.js';

const router = Router();

// Login rate limiter: 5 attempts per IP per 15 minutes
const loginRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60,
});

router.post('/login', async (req: Request, res: Response) => {
  if (!config.isFeatureEnabled) {
    return res.status(503).json({
      error: `Gmail feature unavailable: ${config.featureDisabledReason || 'Configuration error'}`,
    });
  }

  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  try {
    await loginRateLimiter.consume(clientIp);
  } catch (rateLimiterRes: any) {
    const retryAfter = Math.ceil((rateLimiterRes.msBeforeNext || 900000) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Too many failed login attempts. Please try again later.',
      retryAfter,
    });
  }

  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    // Uniform delay before responding to prevent timing side channels
    await new Promise((resolve) => setTimeout(resolve, 500));
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, config.adminPasswordHash);

  if (!isValid) {
    // Uniform 500ms delay on failure
    await new Promise((resolve) => setTimeout(resolve, 500));
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  // Reset rate limiter on successful login
  await loginRateLimiter.delete(clientIp);

  // Regenerate session ID to prevent session fixation
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to initialize session' });
    }

    req.session.adminAuthenticated = true;
    req.session.adminId = 'admin_single_tenant';
    req.session.createdAt = Date.now();

    req.session.save((saveErr) => {
      if (saveErr) {
        return res.status(500).json({ error: 'Failed to save session' });
      }
      return res.json({ ok: true, adminId: 'admin_single_tenant' });
    });
  });
});

router.post('/logout', (req: Request, res: Response) => {
  if (!req.session) {
    return res.json({ ok: true });
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to destroy session' });
    }
    res.clearCookie('__Host-seating-sid');
    res.clearCookie('seating-sid');
    return res.json({ ok: true });
  });
});

router.get('/session', (req: Request, res: Response) => {
  if (!config.isFeatureEnabled) {
    return res.json({
      authenticated: false,
      featureEnabled: false,
      disabledReason: config.featureDisabledReason,
    });
  }

  const isAuthenticated = Boolean(req.session && req.session.adminAuthenticated);
  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
  const createdAt = req.session?.createdAt || 0;
  const isExpired = createdAt > 0 && Date.now() - createdAt > EIGHT_HOURS_MS;

  if (isExpired && req.session) {
    req.session.destroy(() => {});
    return res.json({ authenticated: false, featureEnabled: true });
  }

  return res.json({
    authenticated: isAuthenticated,
    featureEnabled: true,
    absoluteExpiresAt: createdAt ? createdAt + EIGHT_HOURS_MS : undefined,
  });
});

export default router;
