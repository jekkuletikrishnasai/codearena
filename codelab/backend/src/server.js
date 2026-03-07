const express = require('express');
require('./db/setup');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/problems',    require('./routes/problems'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/analytics',   require('./routes/analytics'));
app.use('/api/users',       require('./routes/users'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 CodeLab server running on http://localhost:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}\n`);

  // ── Keep Render free tier alive (ping every 14 min) ──────────────────────
  // Prevents the 50-second cold start for students
  const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    fetch(`${BACKEND_URL}/api/health`)
      .then(() => console.log('[keep-alive] ping ok'))
      .catch(err => console.log('[keep-alive] ping failed:', err.message));
  }, 14 * 60 * 1000); // every 14 minutes
});

module.exports = app;
