import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/authConfig.js';

let _isTokenRevoked = null;
async function getRevocationChecker() {
  if (!_isTokenRevoked) {
    const mod = await import('../routes/auth.js');
    _isTokenRevoked = mod.isTokenRevoked;
  }
  return _isTokenRevoked;
}

// Validates Bearer token — attaches decoded user payload to req.user
// Rejects tokens passed in query params and verifies session is still valid (not revoked or logged out)
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — missing token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const isRevokedFn = await getRevocationChecker();
    const userId = decoded.userId || decoded.id;
    const isRevoked = await isRevokedFn(decoded.jti, userId, decoded.tokenVersion);

    if (isRevoked) {
      return res.status(401).json({
        error: 'Unauthorized — session has been terminated or logged out. Please log in again.',
      });
    }

    req.user = decoded; // { jti, id, userId, name, email, role, tokenVersion }
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }
}

// Role guard — must be chained after requireAuth.
// Usage: router.get('/stats', requireAuth, requireRole('admin'), handler)
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized — not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden — requires role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    } catch {
      // ignore invalid tokens — treat as unauthenticated
    }
  }
  next();
}
