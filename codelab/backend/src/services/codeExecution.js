/**
 * Code Execution Service — Wandbox
 * Free, no API key, no signup, no rate limits.
 * https://wandbox.org
 */

const axios = require('axios');

const WANDBOX_COMPILERS = {
  python:     'cpython-3.12.0',
  javascript: 'nodejs-20.2.0',
  java:       'openjdk-jdk-21+35',
  cpp:        'gcc-13.2.0',
  c:          'gcc-13.2.0',
};

async function executeCode(code, language, stdin = '', timeLimitMs = 5000) {
  const compiler = WANDBOX_COMPILERS[language];
  if (!compiler) throw new Error(`Unsupported language: ${language}`);

  const startTime = Date.now();

  const response = await axios.post(
    'https://wandbox.org/api/compile.json',
    {
      compiler,
      code,
      stdin: stdin || '',
      'compiler-option-raw': language === 'c' ? '-std=c11' : '',
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: timeLimitMs + 15000,
    }
  );

  const data = response.data;
  const stdout   = data.program_output || '';
  const stderr   = data.compiler_error || data.program_error || '';
  const exitCode = data.status === '0' || data.status === 0 ? 0 : 1;

  return {
    stdout,
    stderr,
    exitCode,
    executionTimeMs: Date.now() - startTime,
    timedOut: false,
  };
}

async function runTestCases(code, language, testCases, timeLimitMs = 5000) {
  const results = [];

  for (const testCase of testCases) {
    try {
      const result = await executeCode(code, language, testCase.input, timeLimitMs);
      const actualOutput   = result.stdout.trim();
      const expectedOutput = testCase.expected_output.trim();

      let status;
      if (result.timedOut)             status = 'time_limit_exceeded';
      else if (result.exitCode !== 0)  status = 'runtime_error';
      else if (actualOutput === expectedOutput) status = 'passed';
      else                             status = 'failed';

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
