import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

declare module 'express-session' {
  interface SessionData {
    adminAuthenticated?: boolean;
    adminId?: string;
    createdAt?: number;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Fail-closed check
  if (!config.isFeatureEnabled) {
    return res.status(503).json({
      error: `Gmail feature unavailable: ${config.featureDisabledReason || 'Configuration error'}`,
    });
  }

  // Authentication check
  if (!req.session || !req.session.adminAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Absolute expiry check (8 hours)
  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
  if (req.session.createdAt && Date.now() - req.session.createdAt > EIGHT_HOURS_MS) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Session expired (absolute 8h limit reached). Please log in again.' });
  }

  // Origin check for state-changing HTTP methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = (req.headers.origin || req.headers.referer || '').toString();
    if (origin) {
      try {
        const reqOrigin = new URL(origin).origin;
        const allowedOrigins = new Set([
          new URL(config.appUrl).origin,
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ]);
        if (!allowedOrigins.has(reqOrigin)) {
          return res.status(403).json({ error: 'Forbidden: origin header mismatch' });
        }
      } catch (err) {
        return res.status(403).json({ error: 'Forbidden: invalid origin header' });
      }
    }
  }

  next();
}
