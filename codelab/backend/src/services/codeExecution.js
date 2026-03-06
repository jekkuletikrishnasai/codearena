/**
 * Code Execution Service — Piston API
 *
 * Piston is a free, open-source code execution engine.
 * Public API at https://emkc.org/api/v2/piston — NO API KEY, NO rate limit.
 * Supports 70+ languages. Built by Engineer Man, used by repl.it.
 *
 * No setup needed. Just deploy and it works.
 *
 * Optional: self-host Piston on Render for 100% uptime guarantee.
 * See: https://github.com/engineer-man/piston
 */

const axios = require('axios');

const PISTON_URL = (process.env.PISTON_URL || 'https://emkc.org/api/v2/piston').replace(/\/$/, '');

// ── Language config for Piston ─────────────────────────────────────────────
// Each entry: { language, version, filename }
// Run GET https://emkc.org/api/v2/piston/runtimes to see all available versions
const LANGUAGE_CONFIG = {
  python: {
    language: 'python',
    version: '3.10.0',
    filename: 'solution.py',
  },
  javascript: {
    language: 'javascript',
    version: '18.15.0',
    filename: 'solution.js',
  },
  java: {
    language: 'java',
    version: '15.0.2',
    filename: 'Solution.java',
  },
  cpp: {
    language: 'c++',
    version: '10.2.0',
    filename: 'solution.cpp',
  },
  c: {
    language: 'c',
    version: '10.2.0',
    filename: 'solution.c',
  },
};

// ── Execute a single code + stdin via Piston ──────────────────────────────
async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  const startTime = Date.now();

  let response;
  try {
    response = await axios.post(
      `${PISTON_URL}/execute`,
      {
        language: config.language,
        version: config.version,
        files: [{ name: config.filename, content: code }],
        stdin: stdin || '',
        run_timeout: timeLimitMs,
        compile_timeout: 10000,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: timeLimitMs + 15000, // axios timeout > execution timeout
      }
    );
  } catch (err) {
    // Network / Piston down
    throw new Error(`Piston API error: ${err.message}`);
  }

  const data = response.data;
  const executionTimeMs = Date.now() - startTime;

  // Piston returns { run: { stdout, stderr, code, signal, output } }
  // and optionally { compile: { stdout, stderr, code } } for compiled langs
  const compileStderr = data.compile?.stderr || '';
  const compileCode   = data.compile?.code;

  // Compilation failed
  if (compileCode !== undefined && compileCode !== 0) {
    return {
      stdout: '',
      stderr: compileStderr || data.compile?.output || 'Compilation failed',
      exitCode: compileCode,
      executionTimeMs,
      timedOut: false,
      compilationError: true,
    };
  }

  const run = data.run || {};
  const stdout  = run.stdout || '';
  const stderr  = run.stderr || '';
  const exitCode = run.code ?? (run.signal ? 1 : 0);
  const timedOut = run.signal === 'SIGKILL' || (timeLimitMs && executionTimeMs >= timeLimitMs + 14000);

  return {
    stdout,
    stderr,
    exitCode,
    executionTimeMs,
    timedOut,
    compilationError: false,
  };
}

// ── Run all test cases ────────────────────────────────────────────────────
async function runTestCases(code, language, testCases, timeLimitMs = 5000) {
  const results = [];

  for (const testCase of testCases) {
    try {
      const result = await executeCode(code, language, testCase.input, timeLimitMs);
      const actualOutput   = result.stdout.trim();
      const expectedOutput = testCase.expected_output.trim();

      let status;
      if (result.compilationError) {
        status = 'runtime_error'; // treated as compile/runtime error
      } else if (result.timedOut) {
        status = 'time_limit_exceeded';
      } else if (result.exitCode !== 0) {
        status = 'runtime_error';
      } else if (actualOutput === expectedOutput) {
        status = 'passed';
      } else {
        status = 'failed';
      }

      results.push({
        testCaseId:      testCase.id,
        status,
        actualOutput:    result.stdout,
        executionTimeMs: result.executionTimeMs,
        expected:        expectedOutput,
        isHidden:        testCase.is_hidden,
      });
    } catch (err) {
      console.error('Piston execution error:', err.message);
      results.push({
        testCaseId:      testCase.id,
        status:          'runtime_error',
        actualOutput:    `Execution error: ${err.message}`,
        executionTimeMs: 0,
        expected:        testCase.expected_output,
        isHidden:        testCase.is_hidden,
      });
    }
  }

  return results;
}

// ── Shims for backwards compatibility with submissions.js ─────────────────
const executeCodeSimulated = executeCode;
const runTestCasesSimulated = runTestCases;
const isDockerAvailable = () => Promise.resolve(true); // always "available"

module.exports = {
  executeCode,
  runTestCases,
  executeCodeSimulated,
  runTestCasesSimulated,
  isDockerAvailable,
  LANGUAGE_CONFIG,
};
