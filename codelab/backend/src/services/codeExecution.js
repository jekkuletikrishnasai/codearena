/**
 * Code Execution Service — Local child_process
 * Dynamically finds binary paths at startup so it works
 * regardless of where Render installs node/python/etc.
 */

const { exec, execSync } = require('child_process');
const fs   = require('fs').promises;
const path = require('path');
const os   = require('os');
const { v4: uuidv4 } = require('uuid');

// ── Find binary path dynamically at startup ──────────────────────────────
function findBin(names) {
  for (const name of names) {
    try {
      const p = execSync(`which ${name} 2>/dev/null`, { encoding: 'utf8' }).trim();
      if (p) { console.log(`[exec] found ${name} at ${p}`); return p; }
    } catch (_) {}
  }
  return names[0]; // fallback, will fail gracefully
}

// Resolved once at server startup
const BINS = {
  python3: findBin(['python3', 'python3.12', 'python']),
  node:    findBin(['node', 'nodejs']),
  java:    findBin(['java']),
  gpp:     findBin(['g++', 'g++-13']),
  gcc:     findBin(['gcc', 'gcc-13']),
};

console.log('[exec] resolved binaries:', BINS);

// ── Language config using resolved paths ────────────────────────────────
function getLanguageConfig() {
  return {
    python: {
      filename: 'solution.py',
      run: (dir) => `"${BINS.python3}" "${dir}/solution.py" < "${dir}/input.txt"`,
    },
    javascript: {
      filename: 'solution.js',
      run: (dir) => `"${BINS.node}" "${dir}/solution.js" < "${dir}/input.txt"`,
    },
    // Java 11+ single-file: java Solution.java (no javac needed)
    java: {
      filename: 'Solution.java',
      run: (dir) => `cd "${dir}" && "${BINS.java}" Solution.java < input.txt`,
    },
    cpp: {
      filename: 'solution.cpp',
      run: (dir) =>
        `"${BINS.gpp}" -o "${dir}/sol" "${dir}/solution.cpp" && "${dir}/sol" < "${dir}/input.txt"`,
    },
    c: {
      filename: 'solution.c',
      run: (dir) =>
        `"${BINS.gcc}" -o "${dir}/sol" "${dir}/solution.c" && "${dir}/sol" < "${dir}/input.txt"`,
    },
  };
}

function runCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    exec(
      cmd,
      {
        timeout:   timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
        shell:     '/bin/sh',
        env: {
          ...process.env,
          // Ensure all common bin locations are in PATH
          PATH: [
            process.env.PATH,
            '/usr/local/bin',
            '/usr/bin',
            '/bin',
            '/usr/local/sbin',
            '/usr/sbin',
          ].filter(Boolean).join(':'),
        },
      },
      (error, stdout, stderr) => {
        resolve({
          stdout:   stdout || '',
          stderr:   stderr || '',
          exitCode: error ? (error.code || 1) : 0,
          timedOut: !!(error?.killed || error?.signal === 'SIGTERM'),
        });
      }
    );
  });
}

async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const LANGUAGE_CONFIG = getLanguageConfig();
  const config = LANGUAGE_CONFIG[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  const tmpDir = path.join(os.tmpdir(), `cl-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fs.writeFile(path.join(tmpDir, config.filename), code, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '', 'utf8');

    const startTime = Date.now();
    const result    = await runCommand(config.run(tmpDir), timeLimitMs + 8000);

    return {
      stdout:          result.stdout,
      stderr:          result.stderr,
      exitCode:        result.exitCode,
      executionTimeMs: Date.now() - startTime,
      timedOut:        result.timedOut,
    };
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runTestCases(code, language, testCases, timeLimitMs = 5000) {
  const results = [];
  for (const testCase of testCases) {
    try {
      const result         = await executeCode(code, language, testCase.input, timeLimitMs);
      const actualOutput   = result.stdout.trim();
      const expectedOutput = testCase.expected_output.trim();

      let status;
      if (result.timedOut)                      status = 'time_limit_exceeded';
      else if (result.exitCode !== 0)           status = 'runtime_error';
      else if (actualOutput === expectedOutput) status = 'passed';
      else                                      status = 'failed';

      results.push({
        testCaseId:      testCase.id,
        status,
        actualOutput:    result.stdout,
        executionTimeMs: result.executionTimeMs,
        expected:        expectedOutput,
        isHidden:        testCase.is_hidden,
      });
    } catch (err) {
      results.push({
        testCaseId:      testCase.id,
        status:          'runtime_error',
        actualOutput:    `Error: ${err.message}`,
        executionTimeMs: 0,
        expected:        testCase.expected_output,
        isHidden:        testCase.is_hidden,
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
