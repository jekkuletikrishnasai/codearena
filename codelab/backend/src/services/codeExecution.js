/**
 * Code Execution — runs locally inside Docker container
 * Base image: node:18-alpine + python3 + gcc + g++ + openjdk17
 *
 * Alpine binary paths:
 *   node:    /usr/local/bin/node  (from base image, confirmed via /api/diag)
 *   python3: /usr/bin/python3
 *   java:    /usr/bin/java
 *   gcc:     /usr/bin/gcc
 *   g++:     /usr/bin/g++
 */

const { exec } = require('child_process');
const fs   = require('fs').promises;
const path = require('path');
const os   = require('os');
const { v4: uuidv4 } = require('uuid');

const NODE    = process.execPath;          // always correct — self-referential
const PYTHON  = '/usr/bin/python3';
const JAVA    = '/usr/bin/java';
const GPP     = '/usr/bin/g++';
const GCC     = '/usr/bin/gcc';

const LANGUAGE_CONFIG = {
  python: {
    filename: 'solution.py',
    run: (d) => `"${PYTHON}" "${d}/solution.py" < "${d}/input.txt"`,
  },
  javascript: {
    filename: 'solution.js',
    run: (d) => `"${NODE}" "${d}/solution.js" < "${d}/input.txt"`,
  },
  java: {
    filename: 'Solution.java',
    // Java 11+ single-file execution — no javac needed
    run: (d) => `cd "${d}" && "${JAVA}" Solution.java < input.txt`,
  },
  cpp: {
    filename: 'solution.cpp',
    run: (d) => `"${GPP}" -o "${d}/sol" "${d}/solution.cpp" && "${d}/sol" < "${d}/input.txt"`,
  },
  c: {
    filename: 'solution.c',
    run: (d) => `"${GCC}" -o "${d}/sol" "${d}/solution.c" && "${d}/sol" < "${d}/input.txt"`,
  },
};

function runCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    exec(cmd, {
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      shell: '/bin/sh',
      env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' },
    }, (error, stdout, stderr) => {
      resolve({
        stdout:   stdout || '',
        stderr:   stderr || '',
        exitCode: error ? (error.code || 1) : 0,
        timedOut: !!(error?.killed || error?.signal === 'SIGTERM'),
      });
    });
  });
}

async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const cfg = LANGUAGE_CONFIG[language];
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

async function runTestCases(code, language, testCases, timeLimitMs = 5000) {
  const results = [];
  for (const tc of testCases) {
    try {
      const result   = await executeCode(code, language, tc.input, timeLimitMs);
      const actual   = result.stdout.trim();
      const expected = tc.expected_output.trim();

      // Detect compilation failure by inspecting stderr
      const isCompileError = result.exitCode !== 0 && (
        result.stderr.includes('error: compilation failed') ||   // Java single-file
        result.stderr.includes('javac') ||                        // javac output
        result.stderr.includes(': error:') ||                     // gcc/g++ style
        result.stderr.includes('SyntaxError') ||                  // Python syntax
        result.stderr.includes('error: expected') ||              // C/C++
        result.stderr.includes('compilation failed')              // generic
      );

      let status;
      if (result.timedOut)            status = 'time_limit_exceeded';
      else if (isCompileError)        status = 'compilation_error';
      else if (result.exitCode !== 0) status = 'runtime_error';
      else if (actual === expected)   status = 'passed';
      else                            status = 'failed';

      results.push({
        testCaseId: tc.id, status,
        actualOutput: result.stdout,
        executionTimeMs: result.executionTimeMs,
        expected, isHidden: tc.is_hidden,
      });
    } catch (err) {
      results.push({
        testCaseId: tc.id, status: 'runtime_error',
        actualOutput: `Error: ${err.message}`,
        executionTimeMs: 0,
        expected: tc.expected_output, isHidden: tc.is_hidden,
      });
    }
  }
  return results;
}

const executeCodeSimulated  = executeCode;
const runTestCasesSimulated = runTestCases;
const isDockerAvailable     = () => Promise.resolve(true);

module.exports = { executeCode, runTestCases, executeCodeSimulated, runTestCasesSimulated, isDockerAvailable };
