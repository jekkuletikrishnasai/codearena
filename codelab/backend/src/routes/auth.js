const jwt = require('jsonwebtoken');
const { query } = require('../db');

// ── Simple in-memory cache to avoid DB hit on every request ──────────────────
// JWT already contains user info — we only need DB to check if user still exists.
// Cache for 60 seconds to massively reduce DB load under concurrent polling.
const userCache = new Map(); // userId -> { user, expiresAt }
const CACHE_TTL_MS = 60000; // 60 seconds

async function getCachedUser(userId) {
  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  // Cache miss — hit DB
  const result = await query('SELECT id, username, email, full_name, role FROM users WHERE id = $1', [userId]);
  const user = result.rows[0] || null;
  if (user) {
    userCache.set(userId, { user, expiresAt: Date.now() + CACHE_TTL_MS });
    // Prevent unbounded growth
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

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Use cache instead of hitting DB every request
    const user = await getCachedUser(decoded.userId || decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
