/**
 * Code Execution Service — Local child_process
 *
 * Uses full absolute binary paths (avoids Render's restricted PATH).
 * All 5 languages work on Render free tier:
 *
 *   Python     → /usr/bin/python3       (Python 3.12)
 *   JavaScript → /usr/bin/node          (Node.js 20+)
 *   Java       → /usr/bin/java file.java (Java 21 single-file, no javac needed!)
 *   C++        → /usr/bin/g++           (GCC 13)
 *   C          → /usr/bin/gcc           (GCC 13)
 */

const { exec } = require('child_process');
const fs       = require('fs').promises;
const path     = require('path');
const os       = require('os');
const { v4: uuidv4 } = require('uuid');

const LANGUAGE_CONFIG = {
  python: {
    filename: 'solution.py',
    run: (dir) => `/usr/bin/python3 "${dir}/solution.py" < "${dir}/input.txt"`,
  },
  javascript: {
    filename: 'solution.js',
    run: (dir) => `/usr/bin/node "${dir}/solution.js" < "${dir}/input.txt"`,
  },
  // Java 11+ supports running .java files directly: java Solution.java
  // No javac needed! Class must be named Solution.
  java: {
    filename: 'Solution.java',
    run: (dir) => `cd "${dir}" && /usr/bin/java Solution.java < input.txt`,
  },
  cpp: {
    filename: 'solution.cpp',
    run: (dir) =>
      `/usr/bin/g++ -o "${dir}/solution_bin" "${dir}/solution.cpp" && "${dir}/solution_bin" < "${dir}/input.txt"`,
  },
  c: {
    filename: 'solution.c',
    run: (dir) =>
      `/usr/bin/gcc -o "${dir}/solution_bin" "${dir}/solution.c" && "${dir}/solution_bin" < "${dir}/input.txt"`,
  },
};

function runCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    exec(
      cmd,
      { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, shell: '/bin/sh' },
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
