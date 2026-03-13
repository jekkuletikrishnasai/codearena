/**
 * Code Execution — runs locally inside Docker container
 * Base image: node:18-alpine + python3 + gcc + g++ + openjdk17-jdk
 *
 * JAVA STRATEGY: compile-once with javac, run .class file per test case
 *   javac path on Alpine openjdk17-jdk: /usr/lib/jvm/java-17-openjdk/bin/javac
 *   java  path on Alpine openjdk17-jdk: /usr/bin/java (symlink)
 *
 * executeCodeMulti() = compile ONCE → run ALL test cases in parallel
 *   Before: 3 test cases × 8-15s JVM cold-start = 24-45s
 *   After:  1 javac (2-4s) + 3× java -cp . Solution (0.5-1s) = ~3-5s
 */

const { exec } = require('child_process');
const fs   = require('fs').promises;
const path = require('path');
const os   = require('os');
const { v4: uuidv4 } = require('uuid');

const NODE   = process.execPath;
const PYTHON = '/usr/bin/python3';
const JAVA   = '/usr/bin/java';
// javac on Alpine openjdk17-jdk — try multiple known paths
const JAVAC_CANDIDATES = [
  '/usr/lib/jvm/java-17-openjdk/bin/javac',
  '/usr/lib/jvm/java-17-openjdk-amd64/bin/javac',
  '/usr/bin/javac',
];
const GPP = '/usr/bin/g++';
const GCC = '/usr/bin/gcc';

// Resolve javac path once at startup
let JAVAC = null;
async function resolveJavac() {
  if (JAVAC !== null) return JAVAC;
  for (const p of JAVAC_CANDIDATES) {
    try {
      await fs.access(p);
      JAVAC = p;
      console.log(`✅ javac found at: ${JAVAC}`);
      return JAVAC;
    } catch {}
  }
  // Last resort: find via shell
  return new Promise(resolve => {
    exec('which javac || find /usr -name javac 2>/dev/null | head -1', { timeout: 5000 }, (err, stdout) => {
      JAVAC = stdout.trim() || null;
      if (JAVAC) console.log(`✅ javac found via find: ${JAVAC}`);
      else console.warn('⚠️  javac not found — Java will use single-file execution (slower)');
      resolve(JAVAC);
    });
  });
}
// Kick off resolution at module load
resolveJavac();

function runCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    exec(cmd, {
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      shell: '/bin/sh',
      env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/usr/lib/jvm/java-17-openjdk/bin:/bin' },
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
 */
async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const tmpDir = path.join(os.tmpdir(), `cl-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const start = Date.now();

    if (language === 'java') {
      await fs.writeFile(path.join(tmpDir, 'Solution.java'), code, 'utf8');
      await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '', 'utf8');

      const javac = await resolveJavac();

      if (javac) {
        // Compile with javac
        const compileResult = await runCommand(`"${javac}" "${tmpDir}/Solution.java" 2>&1`, 30000);
        if (compileResult.exitCode !== 0) {
          return { stdout: '', stderr: compileResult.stdout || compileResult.stderr, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
        }
        const result = await runCommand(`cd "${tmpDir}" && "${JAVA}" -cp . Solution < input.txt`, timeLimitMs + 5000);
        return { ...result, executionTimeMs: Date.now() - start };
      } else {
        // Fallback: java SourceFile.java (single-file execution, slower but works without javac)
        const result = await runCommand(`cd "${tmpDir}" && "${JAVA}" Solution.java < input.txt`, timeLimitMs + 20000);
        return { ...result, executionTimeMs: Date.now() - start };
      }

    } else if (language === 'python') {
      await fs.writeFile(path.join(tmpDir, 'solution.py'), code, 'utf8');
      await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '', 'utf8');
      const result = await runCommand(`"${PYTHON}" "${tmpDir}/solution.py" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...result, executionTimeMs: Date.now() - start };

    } else if (language === 'javascript') {
      await fs.writeFile(path.join(tmpDir, 'solution.js'), code, 'utf8');
      await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '', 'utf8');
      const result = await runCommand(`"${NODE}" "${tmpDir}/solution.js" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...result, executionTimeMs: Date.now() - start };

    } else if (language === 'cpp') {
      await fs.writeFile(path.join(tmpDir, 'solution.cpp'), code, 'utf8');
      await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '', 'utf8');
      const compileResult = await runCommand(`"${GPP}" -O2 -o "${tmpDir}/sol" "${tmpDir}/solution.cpp" 2>&1`, 30000);
      if (compileResult.exitCode !== 0) {
        return { stdout: '', stderr: compileResult.stdout || compileResult.stderr, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
      }
      const result = await runCommand(`"${tmpDir}/sol" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...result, executionTimeMs: Date.now() - start };

    } else if (language === 'c') {
      await fs.writeFile(path.join(tmpDir, 'solution.c'), code, 'utf8');
      await fs.writeFile(path.join(tmpDir, 'input.txt'), stdin || '', 'utf8');
      const compileResult = await runCommand(`"${GCC}" -O2 -o "${tmpDir}/sol" "${tmpDir}/solution.c" 2>&1`, 30000);
      if (compileResult.exitCode !== 0) {
        return { stdout: '', stderr: compileResult.stdout || compileResult.stderr, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
      }
      const result = await runCommand(`"${tmpDir}/sol" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...result, executionTimeMs: Date.now() - start };

    } else {
      throw new Error(`Unsupported language: ${language}`);
    }
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * OPTIMIZED multi-test-case execution
 * Compile ONCE → run ALL test cases in parallel from same binary.
 *
 * Java:  javac once (2-4s) + N× java -cp . Solution (~0.5s each, parallel)
 * C/C++: compile once (~0.5s) + N× ./sol (parallel, near-instant)
 * Python/JS: no compile, N× parallel runs
 */
async function executeCodeMulti(code, language, testCases, timeLimitMs = 5000) {
  const tmpDir = path.join(os.tmpdir(), `cl-multi-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {

    if (language === 'java') {
      await fs.writeFile(path.join(tmpDir, 'Solution.java'), code, 'utf8');
      const javac = await resolveJavac();

      if (javac) {
        // ── COMPILE ONCE with javac ───────────────────────────────────────────
        const compileResult = await runCommand(`"${javac}" "${tmpDir}/Solution.java" 2>&1`, 30000);
        if (compileResult.exitCode !== 0) {
          const errMsg = compileResult.stdout || compileResult.stderr;
          return testCases.map(tc => ({ testCaseId: tc.id, stdout: '', stderr: errMsg, exitCode: 1, executionTimeMs: 0, timedOut: false }));
        }
        // ── RUN ALL TEST CASES IN PARALLEL from .class ───────────────────────
        return await Promise.all(testCases.map(async (tc, i) => {
          const tcDir = path.join(tmpDir, `tc_${i}`);
          await fs.mkdir(tcDir, { recursive: true });
          await fs.writeFile(path.join(tcDir, 'input.txt'), tc.input || '', 'utf8');
          const start = Date.now();
          const result = await runCommand(
            `"${JAVA}" -cp "${tmpDir}" Solution < "${tcDir}/input.txt"`,
            timeLimitMs + 5000
          );
          return { testCaseId: tc.id, ...result, executionTimeMs: Date.now() - start };
        }));

      } else {
        // ── FALLBACK: java SourceFile.java runs sequentially (slower) ─────────
        // No javac means we can't reuse .class — run each test case independently
        console.warn('javac not found, falling back to java SourceFile.java per test case');
        return await Promise.all(testCases.map(async (tc, i) => {
          const tcDir = path.join(tmpDir, `tc_${i}`);
          await fs.mkdir(tcDir, { recursive: true });
          await fs.writeFile(path.join(tcDir, 'Solution.java'), code, 'utf8');
          await fs.writeFile(path.join(tcDir, 'input.txt'), tc.input || '', 'utf8');
          const start = Date.now();
          const result = await runCommand(
            `cd "${tcDir}" && "${JAVA}" Solution.java < input.txt`,
            timeLimitMs + 20000
          );
          return { testCaseId: tc.id, ...result, executionTimeMs: Date.now() - start };
        }));
      }

    } else if (language === 'cpp' || language === 'c') {
      const compiler = language === 'cpp' ? GPP : GCC;
      const srcFile  = language === 'cpp' ? 'solution.cpp' : 'solution.c';
      await fs.writeFile(path.join(tmpDir, srcFile), code, 'utf8');

      const compileResult = await runCommand(`"${compiler}" -O2 -o "${tmpDir}/sol" "${tmpDir}/${srcFile}" 2>&1`, 30000);
      if (compileResult.exitCode !== 0) {
        const errMsg = compileResult.stdout || compileResult.stderr;
        return testCases.map(tc => ({ testCaseId: tc.id, stdout: '', stderr: errMsg, exitCode: 1, executionTimeMs: 0, timedOut: false }));
      }
      return await Promise.all(testCases.map(async (tc, i) => {
        const tcDir = path.join(tmpDir, `tc_${i}`);
        await fs.mkdir(tcDir, { recursive: true });
        await fs.writeFile(path.join(tcDir, 'input.txt'), tc.input || '', 'utf8');
        const start = Date.now();
        const result = await runCommand(`"${tmpDir}/sol" < "${tcDir}/input.txt"`, timeLimitMs + 5000);
        return { testCaseId: tc.id, ...result, executionTimeMs: Date.now() - start };
      }));

    } else {
      // Python / JavaScript — no compile step, parallel runs
      const srcFile = language === 'python' ? 'solution.py' : 'solution.js';
      const runner  = language === 'python' ? PYTHON : NODE;
      await fs.writeFile(path.join(tmpDir, srcFile), code, 'utf8');

      return await Promise.all(testCases.map(async (tc, i) => {
        const tcDir = path.join(tmpDir, `tc_${i}`);
        await fs.mkdir(tcDir, { recursive: true });
        await fs.writeFile(path.join(tcDir, 'input.txt'), tc.input || '', 'utf8');
        const start = Date.now();
        const result = await runCommand(`"${runner}" "${tmpDir}/${srcFile}" < "${tcDir}/input.txt"`, timeLimitMs + 5000);
        return { testCaseId: tc.id, ...result, executionTimeMs: Date.now() - start };
      }));
    }

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
        result.stderr.includes('error:') || result.stderr.includes('javac') ||
        result.stderr.includes('SyntaxError') || result.stderr.includes('compilation failed')
      );
      let status;
      if (result.timedOut)            status = 'time_limit_exceeded';
      else if (isCompileError)        status = 'compilation_error';
      else if (result.exitCode !== 0) status = 'runtime_error';
      else if (actual === expected)   status = 'passed';
      else                            status = 'failed';
      results.push({ testCaseId: tc.id, status, actualOutput: result.stdout, executionTimeMs: result.executionTimeMs, expected, isHidden: tc.is_hidden });
    } catch (err) {
      results.push({ testCaseId: tc.id, status: 'runtime_error', actualOutput: `Error: ${err.message}`, executionTimeMs: 0, expected: tc.expected_output, isHidden: tc.is_hidden });
    }
  }
  return results;
}

const executeCodeSimulated  = executeCode;
const runTestCasesSimulated = runTestCases;
const isDockerAvailable     = () => Promise.resolve(true);

module.exports = { executeCode, executeCodeMulti, runTestCases, executeCodeSimulated, runTestCasesSimulated, isDockerAvailable };
