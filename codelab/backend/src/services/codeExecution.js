/**
 * Code Execution — runs locally inside Docker container
 * Base image: node:18-alpine + python3 + gcc + g++ + openjdk17
 *
 * KEY OPTIMIZATION: Java compile-once, run-many
 *   OLD: java Solution.java (JVM cold-start per test case = 8-15s each)
 *   NEW: javac once → java -cp . Solution (runs from .class = 1-2s each)
 */

const { exec } = require('child_process');
const fs   = require('fs').promises;
const path = require('path');
const os   = require('os');
const { v4: uuidv4 } = require('uuid');

const NODE    = process.execPath;
const PYTHON  = '/usr/bin/python3';
const JAVA    = '/usr/bin/java';
const JAVAC   = '/usr/bin/javac';
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
    compile: (d) => `cd "${d}" && "${JAVAC}" Solution.java 2>&1`,
    run: (d) => `cd "${d}" && "${JAVA}" -cp . Solution < input.txt`,
  },
  cpp: {
    filename: 'solution.cpp',
    compile: (d) => `"${GPP}" -O2 -o "${d}/sol" "${d}/solution.cpp" 2>&1`,
    run: (d) => `"${d}/sol" < "${d}/input.txt"`,
  },
  c: {
    filename: 'solution.c',
    compile: (d) => `"${GCC}" -O2 -o "${d}/sol" "${d}/solution.c" 2>&1`,
    run: (d) => `"${d}/sol" < "${d}/input.txt"`,
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

/**
 * Single-input execution (used by /run endpoint)
 * Compile step is separate from run step for compiled languages.
 */
async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const cfg = LANGUAGE_CONFIG[language];
  if (!cfg) throw new Error(`Unsupported language: ${language}`);

  const tmpDir = path.join(os.tmpdir(), `cl-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fs.writeFile(path.join(tmpDir, cfg.filename), code, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '', 'utf8');

    const start = Date.now();

    // Compile if needed
    if (cfg.compile) {
      const compileResult = await runCommand(cfg.compile(tmpDir), 30000);
      if (compileResult.exitCode !== 0) {
        return {
          stdout: '',
          stderr: compileResult.stdout || compileResult.stderr,
          exitCode: compileResult.exitCode,
          executionTimeMs: Date.now() - start,
          timedOut: false,
        };
      }
    }

    const result = await runCommand(cfg.run(tmpDir), timeLimitMs + 5000);

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

/**
 * OPTIMIZED multi-test-case execution — compile ONCE, run all in PARALLEL.
 *
 * Before: Java → 3 test cases × (8-15s JVM startup) = 24-45s
 * After:  Java → javac once (3-5s) + 3× java -cp . Solution (1-2s each) = ~5-7s total
 *
 * C/C++: compile once (~1s) then all test cases run in parallel (~instant)
 * Python/JS: no compile, all test cases run in parallel
 */
async function executeCodeMulti(code, language, testCases, timeLimitMs = 5000) {
  const cfg = LANGUAGE_CONFIG[language];
  if (!cfg) throw new Error(`Unsupported language: ${language}`);

  const tmpDir = path.join(os.tmpdir(), `cl-multi-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fs.writeFile(path.join(tmpDir, cfg.filename), code, 'utf8');

    // ── COMPILE ONCE ──────────────────────────────────────────────────────────
    let compileError = null;
    if (cfg.compile) {
      const compileResult = await runCommand(cfg.compile(tmpDir), 30000);
      if (compileResult.exitCode !== 0) {
        compileError = compileResult.stdout || compileResult.stderr;
      }
    }

    // Compilation failed — return error for all test cases immediately
    if (compileError !== null) {
      return testCases.map(tc => ({
        testCaseId:     tc.id,
        stdout:         '',
        stderr:         compileError,
        exitCode:       1,
        executionTimeMs: 0,
        timedOut:       false,
      }));
    }

    // ── RUN ALL IN PARALLEL ───────────────────────────────────────────────────
    const results = await Promise.all(
      testCases.map(async (tc, i) => {
        const tcDir = path.join(tmpDir, `tc_${i}`);
        await fs.mkdir(tcDir, { recursive: true });
        await fs.writeFile(path.join(tcDir, 'input.txt'), tc.input || '', 'utf8');

        let runCmd;
        if (language === 'java') {
          // -cp points to parent dir where Solution.class lives
          runCmd = `"${JAVA}" -cp "${tmpDir}" Solution < "${tcDir}/input.txt"`;
        } else if (language === 'cpp' || language === 'c') {
          runCmd = `"${tmpDir}/sol" < "${tcDir}/input.txt"`;
        } else if (language === 'python') {
          runCmd = `"${PYTHON}" "${tmpDir}/solution.py" < "${tcDir}/input.txt"`;
        } else {
          runCmd = `"${NODE}" "${tmpDir}/solution.js" < "${tcDir}/input.txt"`;
        }

        const start = Date.now();
        const result = await runCommand(runCmd, timeLimitMs + 5000);

        return {
          testCaseId:     tc.id,
          stdout:         result.stdout,
          stderr:         result.stderr,
          exitCode:       result.exitCode,
          executionTimeMs: Date.now() - start,
          timedOut:       result.timedOut,
        };
      })
    );

    return results;

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

      const isCompileError = result.exitCode !== 0 && (
        result.stderr.includes('error: compilation failed') ||
        result.stderr.includes('javac') ||
        result.stderr.includes(': error:') ||
        result.stderr.includes('SyntaxError') ||
        result.stderr.includes('error: expected') ||
        result.stderr.includes('compilation failed')
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

module.exports = {
  executeCode,
  executeCodeMulti,
  runTestCases,
  executeCodeSimulated,
  runTestCasesSimulated,
  isDockerAvailable,
};
