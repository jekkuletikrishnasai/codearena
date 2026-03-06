/**
 * Code Execution Service — Local child_process
 *
 * Key techniques used to work on ANY server (Render, Railway, etc.):
 * 1. process.execPath  → exact path to Node.js itself (always correct)
 * 2. process.env.PATH  → inherited PATH from the running Node process
 * 3. Runtime `which`   → finds python3, java, gcc, g++ dynamically
 * 4. Explicit PATH env → passed to every exec() call as safety net
 */

const { exec, execSync } = require('child_process');
const fs   = require('fs').promises;
const path = require('path');
const os   = require('os');
const { v4: uuidv4 } = require('uuid');

// ── Runtime PATH that covers all common install locations ─────────────────
const FULL_PATH = [
  process.env.PATH,
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/local/sbin',
  '/usr/sbin',
  '/sbin',
  // nvm paths
  `${os.homedir()}/.nvm/versions/node/current/bin`,
  '/opt/render/.nvm/versions/node/current/bin',
  // pyenv
  `${os.homedir()}/.pyenv/shims`,
  `${os.homedir()}/.pyenv/bin`,
].filter(Boolean).join(':');

// ── Find a binary, searching common locations ─────────────────────────────
function findBin(candidates) {
  // 1. Try `which` with the full PATH
  for (const name of candidates) {
    try {
      const found = execSync(`which ${name}`, {
        encoding: 'utf8',
        env: { ...process.env, PATH: FULL_PATH },
        timeout: 3000,
      }).trim();
      if (found) { console.log(`[exec] ${name} → ${found}`); return found; }
    } catch (_) {}
  }
  // 2. Check known fixed locations directly
  const fixed = [
    '/usr/bin', '/usr/local/bin', '/bin', '/usr/local/sbin',
  ];
  for (const name of candidates) {
    for (const dir of fixed) {
      const full = `${dir}/${name}`;
      try { require('fs').accessSync(full, require('fs').constants.X_OK); return full; } catch (_) {}
    }
  }
  return candidates[0]; // last resort
}

// Resolved once at server startup — printed to Render logs
const BINS = {
  // Use process.execPath for node — guaranteed correct (it's our own runtime)
  node:    process.execPath,
  python3: findBin(['python3', 'python3.12', 'python3.11', 'python']),
  java:    findBin(['java']),
  gpp:     findBin(['g++', 'g++-13', 'g++-12']),
  gcc:     findBin(['gcc', 'gcc-13', 'gcc-12']),
};

console.log('[exec] binaries resolved:', JSON.stringify(BINS, null, 2));

// ── Exec options — always pass the full PATH ──────────────────────────────
const EXEC_OPTS = {
  maxBuffer: 2 * 1024 * 1024,
  shell:     '/bin/sh',
  env:       { ...process.env, PATH: FULL_PATH },
};

// ── Language definitions ──────────────────────────────────────────────────
function config(language) {
  const c = {
    python: {
      filename: 'solution.py',
      run: (d) => `"${BINS.python3}" "${d}/solution.py" < "${d}/input.txt"`,
    },
    javascript: {
      filename: 'solution.js',
      run: (d) => `"${BINS.node}" "${d}/solution.js" < "${d}/input.txt"`,
    },
    java: {
      // java <File>.java runs without javac (Java 11+ single-file feature)
      filename: 'Solution.java',
      run: (d) => `cd "${d}" && "${BINS.java}" Solution.java < input.txt`,
    },
    cpp: {
      filename: 'solution.cpp',
      run: (d) =>
        `"${BINS.gpp}" -o "${d}/sol" "${d}/solution.cpp" && "${d}/sol" < "${d}/input.txt"`,
    },
    c: {
      filename: 'solution.c',
      run: (d) =>
        `"${BINS.gcc}" -o "${d}/sol" "${d}/solution.c" && "${d}/sol" < "${d}/input.txt"`,
    },
  };
  return c[language] || null;
}

// ── Run a shell command with timeout ─────────────────────────────────────
function runCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    exec(cmd, { ...EXEC_OPTS, timeout: timeoutMs }, (error, stdout, stderr) => {
      resolve({
        stdout:   stdout || '',
        stderr:   stderr || '',
        exitCode: error ? (error.code || 1) : 0,
        timedOut: !!(error?.killed || error?.signal === 'SIGTERM'),
      });
    });
  });
}

// ── Execute one code + stdin ──────────────────────────────────────────────
async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const cfg = config(language);
  if (!cfg) throw new Error(`Unsupported language: ${language}`);

  const tmpDir = path.join(os.tmpdir(), `cl-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fs.writeFile(path.join(tmpDir, cfg.filename), code, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '', 'utf8');

    const start  = Date.now();
    const result = await runCommand(cfg.run(tmpDir), timeLimitMs + 8000);

    return {
      stdout:          result.stdout,
      stderr:          result.stderr,
      exitCode:        result.exitCode,
      executionTimeMs: Date.now() - start,
      timedOut:        result.timedOut,
    };
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Run all test cases ────────────────────────────────────────────────────
async function runTestCases(code, language, testCases, timeLimitMs = 5000) {
  const results = [];
  for (const tc of testCases) {
    try {
      const result   = await executeCode(code, language, tc.input, timeLimitMs);
      const actual   = result.stdout.trim();
      const expected = tc.expected_output.trim();

      let status;
      if (result.timedOut)          status = 'time_limit_exceeded';
      else if (result.exitCode !== 0) status = 'runtime_error';
      else if (actual === expected)   status = 'passed';
      else                            status = 'failed';

      results.push({
        testCaseId:      tc.id,
        status,
        actualOutput:    result.stdout,
        executionTimeMs: result.executionTimeMs,
        expected,
        isHidden:        tc.is_hidden,
      });
    } catch (err) {
      results.push({
        testCaseId:      tc.id,
        status:          'runtime_error',
        actualOutput:    `Error: ${err.message}`,
        executionTimeMs: 0,
        expected:        tc.expected_output,
        isHidden:        tc.is_hidden,
      });
    }
  }
  return results;
}

const executeCodeSimulated  = executeCode;
const runTestCasesSimulated = runTestCases;
const isDockerAvailable     = () => Promise.resolve(true);

module.exports = {
  executeCode,
  runTestCases,
  executeCodeSimulated,
  runTestCasesSimulated,
  isDockerAvailable,
};
