/**
 * Code Execution Service
 *
 * KEY FIX: Java compilation is serialized (max 2 concurrent javac processes)
 * to prevent OOM on Render free tier (512MB RAM).
 * Compiled .class files are then run in parallel per test case.
 */

const { exec, execSync } = require('child_process');
const fs   = require('fs').promises;
const path = require('path');
const os   = require('os');
const { v4: uuidv4 } = require('uuid');

const NODE   = process.execPath;
const PYTHON = '/usr/bin/python3';
const JAVA   = '/usr/bin/java';
const GPP    = '/usr/bin/g++';
const GCC    = '/usr/bin/gcc';

// ── Discover javac synchronously at startup ───────────────────────────────────
let JAVAC = null;
try {
  const r = execSync('which javac 2>/dev/null', { timeout: 5000 }).toString().trim();
  if (r) JAVAC = r;
} catch {}
if (!JAVAC) {
  try {
    const r = execSync('find /usr -name "javac" -type f 2>/dev/null | head -1', { timeout: 8000 }).toString().trim();
    if (r) JAVAC = r;
  } catch {}
}
console.log(JAVAC ? `✅ javac: ${JAVAC}` : '⚠️  javac not found — Java will be slow');

// ── Java compile semaphore: max 2 concurrent javac processes ──────────────────
// On free tier (512MB RAM), running 10 JVMs simultaneously causes OOM kills.
// Serializing compilation prevents this — runs still execute in parallel after.
// ── Java semaphores: throttle both compile AND run to prevent OOM ─────────────
// Free tier = 512MB RAM. Each JVM needs ~80-100MB.
// MAX 2 compile + MAX 4 run = peak ~600MB — safe.
// Without throttling: 20 students × 3 test cases = 60 JVMs → OOM kills.
let activeCompilations = 0;
const MAX_COMPILATIONS = 2;
const compileQueue = [];

let activeJavaRuns = 0;
const MAX_JAVA_RUNS = 4;   // max parallel JVM instances across ALL submissions
const javaRunQueue = [];

function withCompileSemaphore(fn) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (activeCompilations < MAX_COMPILATIONS) {
        activeCompilations++;
        fn()
          .then(resolve).catch(reject)
          .finally(() => {
            activeCompilations--;
            if (compileQueue.length > 0) compileQueue.shift()();
          });
      } else {
        compileQueue.push(attempt);
      }
    };
    attempt();
  });
}

function withJavaRunSemaphore(fn) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (activeJavaRuns < MAX_JAVA_RUNS) {
        activeJavaRuns++;
        fn()
          .then(resolve).catch(reject)
          .finally(() => {
            activeJavaRuns--;
            if (javaRunQueue.length > 0) javaRunQueue.shift()();
          });
      } else {
        javaRunQueue.push(attempt);
      }
    };
    attempt();
  });
}

// ── Shell execution helper ────────────────────────────────────────────────────
function runCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    exec(cmd, {
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      shell: '/bin/sh',
      env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' },
    }, (error, stdout, stderr) => {
      // Log runtime errors to help debugging
      if (error && !error.killed) {
        const preview = (stderr || stdout || '').substring(0, 120);
        if (preview) console.error(`[exec err] ${preview}`);
      }
      resolve({
        stdout:   stdout  || '',
        stderr:   stderr  || '',
        exitCode: error   ? (error.code || 1) : 0,
        timedOut: !!(error?.killed || error?.signal === 'SIGTERM'),
      });
    });
  });
}

// ── Java compile helper ───────────────────────────────────────────────────────
async function compileJava(dir) {
  if (!JAVAC) return { ok: false, errorMsg: 'javac not installed on this server.' };
  return withCompileSemaphore(async () => {
    const result = await runCommand(`"${JAVAC}" "${dir}/Solution.java" 2>&1`, 30000);
    if (result.exitCode !== 0) {
      return { ok: false, errorMsg: result.stdout || result.stderr };
    }
    return { ok: true };
  });
}

// ── Single execution (/run endpoint) ─────────────────────────────────────────
async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const tmpDir = path.join(os.tmpdir(), `cl-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const start = Date.now();

    if (language === 'java') {
      await fs.writeFile(`${tmpDir}/Solution.java`, code, 'utf8');
      await fs.writeFile(`${tmpDir}/input.txt`, stdin || '', 'utf8');
      if (JAVAC) {
        const { ok, errorMsg } = await compileJava(tmpDir);
        if (!ok) return { stdout: '', stderr: errorMsg, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
        return withJavaRunSemaphore(async () => {
          const res = await runCommand(`cd "${tmpDir}" && "${JAVA}" -cp . Solution < input.txt`, timeLimitMs + 5000);
          return { ...res, executionTimeMs: Date.now() - start };
        });
      } else {
        return withJavaRunSemaphore(async () => {
          const res = await runCommand(`cd "${tmpDir}" && "${JAVA}" Solution.java < input.txt`, timeLimitMs + 20000);
          return { ...res, executionTimeMs: Date.now() - start };
        });
      }

    } else if (language === 'python') {
      await fs.writeFile(`${tmpDir}/solution.py`, code, 'utf8');
      await fs.writeFile(`${tmpDir}/input.txt`, stdin || '', 'utf8');
      const res = await runCommand(`"${PYTHON}" "${tmpDir}/solution.py" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...res, executionTimeMs: Date.now() - start };

    } else if (language === 'javascript') {
      await fs.writeFile(`${tmpDir}/solution.js`, code, 'utf8');
      await fs.writeFile(`${tmpDir}/input.txt`, stdin || '', 'utf8');
      const res = await runCommand(`"${NODE}" "${tmpDir}/solution.js" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...res, executionTimeMs: Date.now() - start };

    } else if (language === 'cpp') {
      await fs.writeFile(`${tmpDir}/solution.cpp`, code, 'utf8');
      await fs.writeFile(`${tmpDir}/input.txt`, stdin || '', 'utf8');
      const cr = await runCommand(`"${GPP}" -O2 -o "${tmpDir}/sol" "${tmpDir}/solution.cpp" 2>&1`, 30000);
      if (cr.exitCode !== 0) return { stdout: '', stderr: cr.stdout || cr.stderr, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
      const res = await runCommand(`"${tmpDir}/sol" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...res, executionTimeMs: Date.now() - start };

    } else if (language === 'c') {
      await fs.writeFile(`${tmpDir}/solution.c`, code, 'utf8');
      await fs.writeFile(`${tmpDir}/input.txt`, stdin || '', 'utf8');
      const cr = await runCommand(`"${GCC}" -O2 -o "${tmpDir}/sol" "${tmpDir}/solution.c" 2>&1`, 30000);
      if (cr.exitCode !== 0) return { stdout: '', stderr: cr.stdout || cr.stderr, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
      const res = await runCommand(`"${tmpDir}/sol" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...res, executionTimeMs: Date.now() - start };

    } else {
      throw new Error(`Unsupported language: ${language}`);
    }
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * OPTIMIZED: compile ONCE → run all test cases in parallel.
 * Java compilation is throttled via semaphore to prevent OOM.
 */
async function executeCodeMulti(code, language, testCases, timeLimitMs = 5000) {
  const tmpDir = path.join(os.tmpdir(), `cl-multi-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    if (language === 'java') {
      await fs.writeFile(`${tmpDir}/Solution.java`, code, 'utf8');

      if (JAVAC) {
        const { ok, errorMsg } = await compileJava(tmpDir);
        if (!ok) {
          return testCases.map(tc => ({ testCaseId: tc.id, stdout: '', stderr: errorMsg, exitCode: 1, executionTimeMs: 0, timedOut: false }));
        }
        // Run all test cases — throttled by JVM semaphore to prevent OOM
        return await Promise.all(testCases.map(async (tc, i) => {
          const tcDir = `${tmpDir}/tc_${i}`;
          await fs.mkdir(tcDir, { recursive: true });
          await fs.writeFile(`${tcDir}/input.txt`, tc.input || '', 'utf8');
          return withJavaRunSemaphore(async () => {
            const start = Date.now();
            const res = await runCommand(
              `cd "${tmpDir}" && "${JAVA}" -cp . Solution < "${tcDir}/input.txt"`,
              timeLimitMs + 5000
            );
            return { testCaseId: tc.id, ...res, executionTimeMs: Date.now() - start };
          });
        }));

      } else {
        // No javac fallback — throttled java SourceFile.java
        return await Promise.all(testCases.map(async (tc, i) => {
          const tcDir = `${tmpDir}/tc_${i}`;
          await fs.mkdir(tcDir, { recursive: true });
          await fs.writeFile(`${tcDir}/Solution.java`, code, 'utf8');
          await fs.writeFile(`${tcDir}/input.txt`, tc.input || '', 'utf8');
          return withJavaRunSemaphore(async () => {
            const start = Date.now();
            const res = await runCommand(`cd "${tcDir}" && "${JAVA}" Solution.java < input.txt`, timeLimitMs + 20000);
            return { testCaseId: tc.id, ...res, executionTimeMs: Date.now() - start };
          });
        }));
      }

    } else if (language === 'cpp' || language === 'c') {
      const compiler = language === 'cpp' ? GPP : GCC;
      const srcFile  = language === 'cpp' ? 'solution.cpp' : 'solution.c';
      await fs.writeFile(`${tmpDir}/${srcFile}`, code, 'utf8');
      const cr = await runCommand(`"${compiler}" -O2 -o "${tmpDir}/sol" "${tmpDir}/${srcFile}" 2>&1`, 30000);
      if (cr.exitCode !== 0) {
        return testCases.map(tc => ({ testCaseId: tc.id, stdout: '', stderr: cr.stdout || cr.stderr, exitCode: 1, executionTimeMs: 0, timedOut: false }));
      }
      return await Promise.all(testCases.map(async (tc, i) => {
        const tcDir = `${tmpDir}/tc_${i}`;
        await fs.mkdir(tcDir, { recursive: true });
        await fs.writeFile(`${tcDir}/input.txt`, tc.input || '', 'utf8');
        const start = Date.now();
        const res = await runCommand(`"${tmpDir}/sol" < "${tcDir}/input.txt"`, timeLimitMs + 5000);
        return { testCaseId: tc.id, ...res, executionTimeMs: Date.now() - start };
      }));

    } else {
      const srcFile = language === 'python' ? 'solution.py' : 'solution.js';
      const runner  = language === 'python' ? PYTHON : NODE;
      await fs.writeFile(`${tmpDir}/${srcFile}`, code, 'utf8');
      return await Promise.all(testCases.map(async (tc, i) => {
        const tcDir = `${tmpDir}/tc_${i}`;
        await fs.mkdir(tcDir, { recursive: true });
        await fs.writeFile(`${tcDir}/input.txt`, tc.input || '', 'utf8');
        const start = Date.now();
        const res = await runCommand(`"${runner}" "${tmpDir}/${srcFile}" < "${tcDir}/input.txt"`, timeLimitMs + 5000);
        return { testCaseId: tc.id, ...res, executionTimeMs: Date.now() - start };
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

module.exports = {
  executeCode, executeCodeMulti, runTestCases,
  executeCodeSimulated, runTestCasesSimulated, isDockerAvailable,
  _javacPath: () => JAVAC,
};
