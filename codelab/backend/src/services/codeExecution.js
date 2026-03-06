/**
 * Code Execution Service — Multi-Provider with Fallback
 *
 * Tries providers in order until one succeeds. All are FREE, no keys needed.
 *
 * Provider 1: Glot.io        — https://glot.io (free, open, no key needed in anon mode)
 * Provider 2: Codex API      — https://api.codex.jaagrav.in (free, no key)
 * Provider 3: JDoodle        — https://api.jdoodle.com (free 200 req/day with free key)
 *
 * Set in Render environment (optional - has sensible defaults):
 *   CODE_PROVIDER=glot        (or "codex" or "jdoodle")
 *   JDOODLE_CLIENT_ID=xxx     (only if using jdoodle)
 *   JDOODLE_CLIENT_SECRET=xxx (only if using jdoodle)
 */

const axios = require('axios');

// ── Which provider to use (env override or auto) ───────────────────────────
const PREFERRED = (process.env.CODE_PROVIDER || 'glot').toLowerCase();

// ── Glot.io language map ───────────────────────────────────────────────────
const GLOT_LANGUAGES = {
  python:     { language: 'python',     filename: 'main.py',   version: 'latest' },
  javascript: { language: 'javascript', filename: 'main.js',   version: 'latest' },
  java:       { language: 'java',       filename: 'Main.java',  version: 'latest' },
  cpp:        { language: 'cpp',        filename: 'main.cpp',  version: 'latest' },
  c:          { language: 'c',          filename: 'main.c',    version: 'latest' },
};

// ── Codex API language map ─────────────────────────────────────────────────
const CODEX_LANGUAGES = {
  python:     'py',
  javascript: 'js',
  java:       'java',
  cpp:        'cpp',
  c:          'c',
};

// ── JDoodle language map ───────────────────────────────────────────────────
const JDOODLE_LANGUAGES = {
  python:     { language: 'python3',    versionIndex: '4' },
  javascript: { language: 'nodejs',     versionIndex: '4' },
  java:       { language: 'java',       versionIndex: '4' },
  cpp:        { language: 'cpp17',      versionIndex: '1' },
  c:          { language: 'c',          versionIndex: '5' },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER 1: Glot.io (anonymous mode, no key needed)
// ─────────────────────────────────────────────────────────────────────────────
async function executeWithGlot(code, language, stdin, timeLimitMs) {
  const config = GLOT_LANGUAGES[language];
  if (!config) throw new Error(`Glot: unsupported language ${language}`);

  const startTime = Date.now();

  const response = await axios.post(
    `https://glot.io/api/run/${config.language}/${config.version}`,
    {
      files: [{ name: config.filename, content: code }],
      stdin: stdin || '',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        // No auth header = anonymous execution
      },
      timeout: timeLimitMs + 10000,
    }
  );

  const data = response.data;
  const stdout = data.stdout || '';
  const stderr = data.stderr || data.error || '';
  const exitCode = stderr && !stdout ? 1 : 0;

  return {
    stdout,
    stderr,
    exitCode,
    executionTimeMs: Date.now() - startTime,
    timedOut: false,
    provider: 'glot',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER 2: Codex API by Jaagrav (completely free, no key, no rate limit)
// ─────────────────────────────────────────────────────────────────────────────
async function executeWithCodex(code, language, stdin, timeLimitMs) {
  const lang = CODEX_LANGUAGES[language];
  if (!lang) throw new Error(`Codex: unsupported language ${language}`);

  const startTime = Date.now();

  const params = new URLSearchParams();
  params.append('code', code);
  params.append('language', lang);
  params.append('input', stdin || '');

  const response = await axios.post(
    'https://api.codex.jaagrav.in',
    params,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: timeLimitMs + 15000,
    }
  );

  const data = response.data;
  // Codex returns: { output, error, language, info }
  const stdout  = data.output || '';
  const stderr  = data.error  || '';
  const exitCode = data.error ? 1 : 0;

  return {
    stdout,
    stderr,
    exitCode,
    executionTimeMs: Date.now() - startTime,
    timedOut: false,
    provider: 'codex',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER 3: JDoodle (200 req/day free — needs free credentials)
// Get free credentials at: https://www.jdoodle.com/compiler-api/
// ─────────────────────────────────────────────────────────────────────────────
async function executeWithJDoodle(code, language, stdin, timeLimitMs) {
  const config = JDOODLE_LANGUAGES[language];
  if (!config) throw new Error(`JDoodle: unsupported language ${language}`);

  const clientId     = process.env.JDOODLE_CLIENT_ID;
  const clientSecret = process.env.JDOODLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('JDoodle: credentials not configured');

  const startTime = Date.now();

  const response = await axios.post(
    'https://api.jdoodle.com/v1/execute',
    {
      script:        code,
      stdin:         stdin || '',
      language:      config.language,
      versionIndex:  config.versionIndex,
      clientId,
      clientSecret,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: timeLimitMs + 10000,
    }
  );

  const data = response.data;
  const stdout  = data.output || '';
  const stderr  = '';
  const exitCode = data.statusCode === 200 ? 0 : 1;

  return {
    stdout,
    stderr,
    exitCode,
    executionTimeMs: Date.now() - startTime,
    timedOut: false,
    provider: 'jdoodle',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN executeCode — tries providers in order, falls back on error
// ─────────────────────────────────────────────────────────────────────────────
async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  if (!GLOT_LANGUAGES[language]) throw new Error(`Unsupported language: ${language}`);

  // Build ordered provider list based on preference
  const providers = [];

  if (PREFERRED === 'jdoodle' && process.env.JDOODLE_CLIENT_ID) {
    providers.push({ name: 'jdoodle', fn: executeWithJDoodle });
    providers.push({ name: 'codex',   fn: executeWithCodex });
    providers.push({ name: 'glot',    fn: executeWithGlot });
  } else if (PREFERRED === 'codex') {
    providers.push({ name: 'codex',   fn: executeWithCodex });
    providers.push({ name: 'glot',    fn: executeWithGlot });
  } else {
    // Default: glot first, codex as fallback
    providers.push({ name: 'glot',    fn: executeWithGlot });
    providers.push({ name: 'codex',   fn: executeWithCodex });
  }

  let lastError;
  for (const provider of providers) {
    try {
      console.log(`[codeExecution] trying provider: ${provider.name}`);
      const result = await provider.fn(code, language, stdin, timeLimitMs);
      console.log(`[codeExecution] success with: ${provider.name}`);
      return result;
    } catch (err) {
      console.error(`[codeExecution] ${provider.name} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All execution providers failed. Last error: ${lastError?.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Run all test cases
// ─────────────────────────────────────────────────────────────────────────────
async function runTestCases(code, language, testCases, timeLimitMs = 5000) {
  const results = [];

  for (const testCase of testCases) {
    try {
      const result = await executeCode(code, language, testCase.input, timeLimitMs);
      const actualOutput   = result.stdout.trim();
      const expectedOutput = testCase.expected_output.trim();

      let status;
      if (result.timedOut) {
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
      console.error('Execution error for test case:', err.message);
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

// Shims for backwards compatibility with submissions.js
const executeCodeSimulated    = executeCode;
const runTestCasesSimulated   = runTestCases;
const isDockerAvailable       = () => Promise.resolve(true);

module.exports = {
  executeCode,
  runTestCases,
  executeCodeSimulated,
  runTestCasesSimulated,
  isDockerAvailable,
};
