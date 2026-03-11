const jwt = require('jsonwebtoken');
const { query } = require('../db');

// ── User cache: prevents a DB hit on every authenticated request ───────────
// With 20 students polling every 2s, uncached = 20 DB queries/sec just for auth.
// Cache TTL is 60s — short enough to pick up role changes, long enough to matter.
const userCache = new Map();
const CACHE_TTL_MS = 60000; // 60 seconds

async function getCachedUser(userId) {
  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const result = await query(
    'SELECT id, username, email, role, full_name FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0] || null;

  if (user) {
    userCache.set(userId, { user, expiresAt: Date.now() + CACHE_TTL_MS });
    // Evict expired entries if cache grows too large (>500 users)
    if (userCache.size > 500) {
      const now = Date.now();
      for (const [k, v] of userCache) {
        if (v.expiresAt < now) userCache.delete(k);
      }
    }
  }
  return user;
}

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await getCachedUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(err);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireStudent };
