const express = require('express');
require('./db/setup');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/problems', require('./routes/problems'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/users', require('./routes/users'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// DIAGNOSTIC — visit /api/diag to see exact binary paths on this server
app.get('/api/diag', (req, res) => {
  const { execSync } = require('child_process');
  const os = require('os');
  
  const run = (cmd) => {
    try { return execSync(cmd, { encoding: 'utf8', timeout: 3000 }).trim(); }
    catch(e) { return `ERROR: ${e.message.split('\n')[0]}`; }
  };

  res.json({
    PATH: process.env.PATH,
    execPath: process.execPath,
    platform: process.platform,
    which: {
      python3:  run('which python3'),
      python:   run('which python'),
      node:     run('which node'),
      nodejs:   run('which nodejs'),
      java:     run('which java'),
      gcc:      run('which gcc'),
      gpp:      run('which g++'),
    },
    versions: {
      python3:  run('python3 --version'),
      node:     run('node --version'),
      java:     run('java --version'),
      gcc:      run('gcc --version'),
    },
    ls_usr_bin:   run('ls /usr/bin/python* /usr/bin/node* /usr/bin/java* /usr/bin/gcc* /usr/bin/g++* 2>/dev/null'),
    ls_usr_local: run('ls /usr/local/bin/python* /usr/local/bin/node* 2>/dev/null'),
    ls_opt:       run('ls /opt/ 2>/dev/null'),
    homedir: os.homedir(),
    tmpdir:  os.tmpdir(),
  });
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
});

module.exports = app;
