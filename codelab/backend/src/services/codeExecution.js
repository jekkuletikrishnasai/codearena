const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const LANGUAGE_CONFIG = {
  python: {
    image: 'python:3.11-slim',
    filename: 'solution.py',
    command: (file) => `python ${file}`,
    extension: '.py',
  },
  javascript: {
    image: 'node:18-slim',
    filename: 'solution.js',
    command: (file) => `node ${file}`,
    extension: '.js',
  },
  java: {
    image: 'openjdk:17-slim',
    filename: 'Solution.java',
    command: (file) => `javac ${file} && java Solution`,
    extension: '.java',
  },
  cpp: {
    image: 'gcc:12',
    filename: 'solution.cpp',
    command: (file) => `g++ -o solution ${file} && ./solution`,
    extension: '.cpp',
  },
  c: {
    image: 'gcc:12',
    filename: 'solution.c',
    command: (file) => `gcc -o solution ${file} && ./solution`,
    extension: '.c',
  },
};

const TIMEOUT_MS = parseInt(process.env.CODE_EXECUTION_TIMEOUT) || 10000;

async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const executionId = uuidv4();
  const tmpDir = path.join(os.tmpdir(), `codelab-${executionId}`);

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    const codeFile = path.join(tmpDir, config.filename);
    const inputFile = path.join(tmpDir, 'input.txt');
    await fs.writeFile(codeFile, code);
    await fs.writeFile(inputFile, stdin);

    const dockerCmd = buildDockerCommand(config, codeFile, inputFile, tmpDir, timeLimitMs);

    const startTime = Date.now();
    const result = await runCommand(dockerCmd, TIMEOUT_MS);
    const executionTime = Date.now() - startTime;

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTimeMs: executionTime,
      timedOut: result.timedOut,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function buildDockerCommand(config, codeFile, inputFile, tmpDir, timeLimitMs) {
  const timeoutSec = Math.ceil(timeLimitMs / 1000) + 2;
  const filename = path.basename(codeFile);
  const cmd = config.command(filename);

  return [
    'docker run',
    '--rm',
    '--network none',
    '--memory 256m',
    '--memory-swap 256m',
    '--cpus 0.5',
    `--ulimit nproc=50:50`,
    `--ulimit nofile=64:64`,
    `-v "${tmpDir}:/sandbox"`,
    '-w /sandbox',
    `--timeout ${timeLimitMs / 1000}`,
    `${config.image}`,
    `timeout ${timeoutSec} sh -c "${cmd} < input.txt"`,
  ].join(' ');
}

function runCommand(cmd, timeout) {
  return new Promise((resolve) => {
    let timedOut = false;
    const process = exec(cmd, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error ? (error.code || 1) : 0,
        timedOut,
      });
    });

    setTimeout(() => {
      timedOut = true;
    }, timeout);
  });
}

async function runTestCases(code, language, testCases, timeLimitMs = 5000) {
  const results = [];

  for (const testCase of testCases) {
    try {
      const result = await executeCode(code, language, testCase.input, timeLimitMs);
      const actualOutput = result.stdout.trim();
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
        testCaseId: testCase.id,
        status,
        actualOutput: result.stdout,
        executionTimeMs: result.executionTimeMs,
        expected: expectedOutput,
        isHidden: testCase.is_hidden,
      });
    } catch (err) {
      results.push({
        testCaseId: testCase.id,
        status: 'runtime_error',
        actualOutput: err.message,
        executionTimeMs: 0,
        expected: testCase.expected_output,
        isHidden: testCase.is_hidden,
      });
    }
  }

  return results;
}

// Fallback: simulate execution when Docker is not available
async function executeCodeSimulated(code, language, stdin = '') {
  await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
  return {
    stdout: `Simulated output for ${language}\n(Docker not available - configure Docker for real execution)`,
    stderr: '',
    exitCode: 0,
    executionTimeMs: Math.floor(Math.random() * 500) + 100,
    timedOut: false,
    simulated: true,
  };
}

async function runTestCasesSimulated(code, language, testCases) {
  const results = [];
  for (const testCase of testCases) {
    await new Promise(r => setTimeout(r, 100));
    const passed = Math.random() > 0.3;
    results.push({
      testCaseId: testCase.id,
      status: passed ? 'passed' : 'failed',
      actualOutput: passed ? testCase.expected_output : 'Wrong output',
      executionTimeMs: Math.floor(Math.random() * 200) + 50,
      expected: testCase.expected_output,
      isHidden: testCase.is_hidden,
    });
  }
  return results;
}

const isDockerAvailable = () => {
  return new Promise(resolve => {
    exec('docker info', (err) => resolve(!err));
  });
};

module.exports = {
  executeCode,
  runTestCases,
  executeCodeSimulated,
  runTestCasesSimulated,
  isDockerAvailable,
  LANGUAGE_CONFIG,
};
