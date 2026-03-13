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

// ── DIAGNOSTIC: /api/diag — see all binary paths ──────────────────────────────
app.get('/api/diag', (req, res) => {
  const { execSync } = require('child_process');
  const run = (cmd) => {
    try { return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim(); }
    catch(e) { return `ERR: ${e.message.split('\n')[0]}`; }
  };
  res.json({
    javacPath: require('./services/codeExecution')._javacPath(),
    which_javac: run('which javac'),
    which_java:  run('which java'),
    javac_find:  run('find /usr -name "javac" -type f 2>/dev/null | head -3'),
    java_version: run('java -version 2>&1 | head -1'),
    node: process.execPath,
    platform: process.platform,
  });
});

// ── DIAGNOSTIC: /api/diag/javatest — run a tiny Java program end-to-end ───────
app.get('/api/diag/javatest', async (req, res) => {
  const { executeCode, _javacPath } = require('./services/codeExecution');
  const code = `public class Solution {\n  public static void main(String[] args) {\n    System.out.println("java_ok");\n  }\n}`;
  try {
    const result = await executeCode(code, 'java', '', 20000);
    res.json({
      javacPath: _javacPath(),
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTimeMs: result.executionTimeMs,
    });
  } catch(e) {
    res.json({ error: e.message, javacPath: _javacPath() });
  }
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
