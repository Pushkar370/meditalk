import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'meditalk_dev_secret_2026';

// Lazy-import the blocklist to avoid circular dependency at module load time
let _isTokenRevoked = null;
async function getRevocationChecker() {
  if (!_isTokenRevoked) {
    const mod = await import('../routes/auth.js');
    _isTokenRevoked = mod.isTokenRevoked;
  }
  return _isTokenRevoked;
}

// Validates Bearer token — attaches decoded user payload to req.user
// Also rejects tokens that have been explicitly revoked via POST /api/auth/logout
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — missing token' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check token revocation (async but we handle it with the pattern below)
    getRevocationChecker().then((isRevoked) => {
      if (decoded.jti && isRevoked(decoded.jti)) {
        return res.status(401).json({ error: 'Unauthorized — token has been revoked. Please log in again.' });
      }
      req.user = decoded; // { jti, id, userId, name, email, role }
      next();
    }).catch(() => {
      // If revocation check fails, allow through (fail open to avoid auth outage)
      req.user = decoded;
      next();
    });
  } catch {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }
}

// Role guard — must be chained after requireAuth.
// Usage: router.get('/stats', requireAuth, requireRole('admin'), handler)
// Usage (multiple): requireAuth, requireRole('admin', 'doctor')
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

