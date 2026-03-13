/**
 * Code Execution Service
 *
 * Java strategy: javac compile-once → java -cp .class per test case
 * javac is discovered at startup using shell `find` — works regardless of JDK install path.
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
// We use execSync so it's resolved before any request comes in.
// Tries PATH first, then find — works on any Alpine/Debian/Ubuntu JDK layout.
let JAVAC = null;
try {
  const fromWhich = execSync('which javac 2>/dev/null', { timeout: 5000 }).toString().trim();
  if (fromWhich) { JAVAC = fromWhich; }
} catch {}

if (!JAVAC) {
  try {
    const fromFind = execSync('find /usr -name "javac" -type f 2>/dev/null | head -1', { timeout: 8000 }).toString().trim();
    if (fromFind) { JAVAC = fromFind; }
  } catch {}
}

if (JAVAC) {
  console.log(`✅ javac found: ${JAVAC}`);
} else {
  console.warn('⚠️  javac not found — Java will use single-file execution (slower). Install openjdk17-jdk.');
}

// Export so the diag endpoint can report it
module.exports._javacPath = () => JAVAC;

// ── Shell execution helper ────────────────────────────────────────────────────
function runCommand(cmd, timeoutMs) {
  return new Promise((resolve) => {
    exec(cmd, {
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      shell: '/bin/sh',
      env: {
        ...process.env,
        PATH: '/usr/local/bin:/usr/bin:/bin',
      },
    }, (error, stdout, stderr) => {
      resolve({
        stdout:   stdout  || '',
        stderr:   stderr  || '',
        exitCode: error   ? (error.code || 1) : 0,
        timedOut: !!(error?.killed || error?.signal === 'SIGTERM'),
      });
    });
  });
}

// ── Helper: compile Java, return { ok, errorMsg } ────────────────────────────
async function compileJava(dir) {
  if (!JAVAC) return { ok: false, errorMsg: 'javac not available on this server. Please contact admin.' };
  const result = await runCommand(`"${JAVAC}" "${dir}/Solution.java" 2>&1`, 30000);
  if (result.exitCode !== 0) {
    return { ok: false, errorMsg: result.stdout || result.stderr };
  }
  return { ok: true };
}

// ── Single execution (used by /run endpoint) ──────────────────────────────────
async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const tmpDir = path.join(os.tmpdir(), `cl-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const start = Date.now();

    if (language === 'java') {
      await fs.writeFile(`${tmpDir}/Solution.java`, code, 'utf8');
      await fs.writeFile(`${tmpDir}/input.txt`, stdin || '', 'utf8');

      if (JAVAC) {
        // compile with javac (fast .class execution)
        const { ok, errorMsg } = await compileJava(tmpDir);
        if (!ok) return { stdout: '', stderr: errorMsg, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
        const res = await runCommand(`"${JAVA}" -cp "${tmpDir}" Solution < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
        return { ...res, executionTimeMs: Date.now() - start };
      } else {
        // fallback: java SourceFile.java (slower — JVM startup per run)
        const res = await runCommand(`cd "${tmpDir}" && "${JAVA}" Solution.java < input.txt`, timeLimitMs + 20000);
        return { ...res, executionTimeMs: Date.now() - start };
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
      const compile = await runCommand(`"${GPP}" -O2 -o "${tmpDir}/sol" "${tmpDir}/solution.cpp" 2>&1`, 30000);
      if (compile.exitCode !== 0) return { stdout: '', stderr: compile.stdout || compile.stderr, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
      const res = await runCommand(`"${tmpDir}/sol" < "${tmpDir}/input.txt"`, timeLimitMs + 5000);
      return { ...res, executionTimeMs: Date.now() - start };

    } else if (language === 'c') {
      await fs.writeFile(`${tmpDir}/solution.c`, code, 'utf8');
      await fs.writeFile(`${tmpDir}/input.txt`, stdin || '', 'utf8');
      const compile = await runCommand(`"${GCC}" -O2 -o "${tmpDir}/sol" "${tmpDir}/solution.c" 2>&1`, 30000);
      if (compile.exitCode !== 0) return { stdout: '', stderr: compile.stdout || compile.stderr, exitCode: 1, executionTimeMs: Date.now() - start, timedOut: false };
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
 * OPTIMIZED multi-test-case execution
 * Compile ONCE → run ALL test cases in PARALLEL.
 *
 * Java with javac:    compile(2-4s) + N× java -cp .class (~0.5s each) = ~3-5s total
 * Java without javac: N× java Solution.java in parallel (still slow ~8-15s but at least parallel)
 * C/C++:              compile(0.5s) + N× ./sol (parallel, instant)
 * Python/JS:          N× parallel runs
 */
async function executeCodeMulti(code, language, testCases, timeLimitMs = 5000) {
  const tmpDir = path.join(os.tmpdir(), `cl-multi-${uuidv4()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {

    // ── JAVA ─────────────────────────────────────────────────────────────────
    if (language === 'java') {
      await fs.writeFile(`${tmpDir}/Solution.java`, code, 'utf8');

      if (JAVAC) {
        // Compile ONCE
        const { ok, errorMsg } = await compileJava(tmpDir);
        if (!ok) {
          return testCases.map(tc => ({ testCaseId: tc.id, stdout: '', stderr: errorMsg, exitCode: 1, executionTimeMs: 0, timedOut: false }));
        }
        // Run ALL in parallel from .class file
        return await Promise.all(testCases.map(async (tc, i) => {
          const tcDir = `${tmpDir}/tc_${i}`;
          await fs.mkdir(tcDir, { recursive: true });
          await fs.writeFile(`${tcDir}/input.txt`, tc.input || '', 'utf8');
          const start = Date.now();
          const res = await runCommand(`"${JAVA}" -cp "${tmpDir}" Solution < "${tcDir}/input.txt"`, timeLimitMs + 5000);
          return { testCaseId: tc.id, ...res, executionTimeMs: Date.now() - start };
        }));

      } else {
        // No javac — run java Solution.java in parallel (each its own JVM, but parallel)
        return await Promise.all(testCases.map(async (tc, i) => {
          const tcDir = `${tmpDir}/tc_${i}`;
          await fs.mkdir(tcDir, { recursive: true });
          await fs.writeFile(`${tcDir}/Solution.java`, code, 'utf8');
          await fs.writeFile(`${tcDir}/input.txt`, tc.input || '', 'utf8');
          const start = Date.now();
          const res = await runCommand(`cd "${tcDir}" && "${JAVA}" Solution.java < input.txt`, timeLimitMs + 20000);
          return { testCaseId: tc.id, ...res, executionTimeMs: Date.now() - start };
        }));
      }

    // ── C / C++ ──────────────────────────────────────────────────────────────
    } else if (language === 'cpp' || language === 'c') {
      const compiler = language === 'cpp' ? GPP : GCC;
      const srcFile  = language === 'cpp' ? 'solution.cpp' : 'solution.c';
      await fs.writeFile(`${tmpDir}/${srcFile}`, code, 'utf8');
      const compile = await runCommand(`"${compiler}" -O2 -o "${tmpDir}/sol" "${tmpDir}/${srcFile}" 2>&1`, 30000);
      if (compile.exitCode !== 0) {
        const errMsg = compile.stdout || compile.stderr;
        return testCases.map(tc => ({ testCaseId: tc.id, stdout: '', stderr: errMsg, exitCode: 1, executionTimeMs: 0, timedOut: false }));
      }
      return await Promise.all(testCases.map(async (tc, i) => {
        const tcDir = `${tmpDir}/tc_${i}`;
        await fs.mkdir(tcDir, { recursive: true });
        await fs.writeFile(`${tcDir}/input.txt`, tc.input || '', 'utf8');
        const start = Date.now();
        const res = await runCommand(`"${tmpDir}/sol" < "${tcDir}/input.txt"`, timeLimitMs + 5000);
        return { testCaseId: tc.id, ...res, executionTimeMs: Date.now() - start };
      }));

    // ── Python / JavaScript ───────────────────────────────────────────────────
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
  executeCode,
  executeCodeMulti,
  runTestCases,
  executeCodeSimulated,
  runTestCasesSimulated,
  isDockerAvailable,
  _javacPath: () => JAVAC,
};
