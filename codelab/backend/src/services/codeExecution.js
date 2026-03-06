/**
 * Code Execution Service — Local child_process
 *
 * Runs code directly on the server using the runtimes already
 * installed on Render's Ubuntu instances:
 *   python3, node, java (OpenJDK 21), gcc, g++
 *
 * No external API. No Docker. No keys. Works on Render free tier.
 */

const { exec } = require('child_process');
const fs       = require('fs').promises;
const path     = require('path');
const os       = require('os');
const { v4: uuidv4 } = require('uuid');

const LANGUAGE_CONFIG = {
  python: {
    filename: 'solution.py',
    run: (dir) => `cd "${dir}" && python3 solution.py < input.txt`,
  },
  javascript: {
    filename: 'solution.js',
    run: (dir) => `cd "${dir}" && node solution.js < input.txt`,
  },
  java: {
    filename: 'Solution.java',
    run: (dir) => `cd "${dir}" && javac Solution.java && java Solution < input.txt`,
  },
  cpp: {
    filename: 'solution.cpp',
    run: (dir) => `cd "${dir}" && g++ -o solution solution.cpp && ./solution < input.txt`,
  },
  c: {
    filename: 'solution.c',
    run: (dir) => `cd "${dir}" && gcc -o solution solution.c && ./solution < input.txt`,
  },
};

function runCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    const proc = exec(
      cmd,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const timedOut = error?.killed || error?.signal === 'SIGTERM';
        resolve({
          stdout:   stdout || '',
          stderr:   stderr || '',
          exitCode: error ? (error.code || 1) : 0,
          timedOut,
        });
      }
    );
  });
}

async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  const tmpDir = path.join(os.tmpdir(), `cl-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fs.writeFile(path.join(tmpDir, config.filename), code);
    await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '');

    const startTime = Date.now();
    const result    = await runCommand(config.run(tmpDir), timeLimitMs + 5000);

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
      if (result.timedOut)                       status = 'time_limit_exceeded';
      else if (result.exitCode !== 0)            status = 'runtime_error';
      else if (actualOutput === expectedOutput)  status = 'passed';
      else                                       status = 'failed';

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

// Shims for backwards compatibility with submissions.js
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
