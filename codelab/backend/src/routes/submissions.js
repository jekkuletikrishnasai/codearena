const express = require('express');
const { query, getClient } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { runTestCases, runTestCasesSimulated, executeCode, executeCodeSimulated, isDockerAvailable } = require('../services/codeExecution');

const router = express.Router();

// ── Rate limiter: 1 execution per student every 5 seconds ─────────────────────
const lastRunTime = new Map(); // studentId -> timestamp
const RATE_LIMIT_MS = 5000;   // 5 seconds between runs

function isRateLimited(studentId) {
  const last = lastRunTime.get(studentId) || 0;
  return Date.now() - last < RATE_LIMIT_MS;
}
function markRun(studentId) {
  lastRunTime.set(studentId, Date.now());
  // Clean up old entries every 100 calls to prevent memory leak
  if (lastRunTime.size > 200) {
    const cutoff = Date.now() - 60000;
    for (const [k, v] of lastRunTime) {
      if (v < cutoff) lastRunTime.delete(k);
    }
  }
}

// ── Execution queue: max 8 concurrent executions ──────────────────────────────
let activeExecutions = 0;
const MAX_CONCURRENT = 10;
const executionQueue = [];

function runWithQueue(fn) {
  return new Promise((resolve, reject) => {
    const task = () => {
      activeExecutions++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeExecutions--;
          if (executionQueue.length > 0) {
            const next = executionQueue.shift();
            next();
          }
        });
    };
    if (activeExecutions < MAX_CONCURRENT) {
      task();
    } else {
      executionQueue.push(task);
    }
  });
}

// POST /api/submissions - submit code
router.post('/', authenticate, async (req, res) => {
  const { problemId, assignmentId, language, code } = req.body;

  if (!problemId || !language || !code) {
    return res.status(400).json({ error: 'Problem ID, language, and code required' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get problem with test cases
    const problemResult = await client.query(
      'SELECT * FROM problems WHERE id = $1', [problemId]
    );
    if (problemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Problem not found' });
    }
    const problem = problemResult.rows[0];

    if (!problem.allowed_languages.includes(language)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Language ${language} not allowed for this problem` });
    }

    const testCasesResult = await client.query(
      'SELECT * FROM test_cases WHERE problem_id = $1 ORDER BY order_index', [problemId]
    );
    const testCases = testCasesResult.rows;

    // Create submission record
    const submissionResult = await client.query(`
      INSERT INTO submissions (student_id, problem_id, assignment_id, language, code, status, max_score)
      VALUES ($1, $2, $3, $4, $5, 'running', $6) RETURNING *
    `, [req.user.id, problemId, assignmentId || null, language, code, testCases.length]);

    const submission = submissionResult.rows[0];
    await client.query('COMMIT');

    // Run test cases (async - respond immediately)
    res.status(202).json({
      submission: { id: submission.id, status: 'running' },
      message: 'Submission received and running',
    });

    // Execute in background with queue to prevent overload
    runWithQueue(() => processSubmission(submission.id, code, language, testCases, problem)).catch(console.error);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function processSubmission(submissionId, code, language, testCases, problem) {
  const client = await getClient();
  try {
    // Run each test case individually through the shared queue
    // This prevents 20 submissions × 3 test cases = 60 simultaneous Java processes
    const results = await Promise.all(
      testCases.map(tc =>
        runWithQueue(() =>
          executeCode(code, language, tc.input, problem.time_limit_ms || 5000)
            .then(result => {
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
              return {
                testCaseId: tc.id, status,
                actualOutput: result.stdout,
                executionTimeMs: result.executionTimeMs,
                expected, isHidden: tc.is_hidden,
              };
            })
            .catch(err => ({
              testCaseId: tc.id, status: 'runtime_error',
              actualOutput: `Error: ${err.message}`,
              executionTimeMs: 0,
              expected: tc.expected_output, isHidden: tc.is_hidden,
            }))
        )
      )
    );

    const passed = results.filter(r => r.status === 'passed').length;
    const total = results.length;

    let overallStatus = 'accepted';
    if (results.some(r => r.status === 'compilation_error'))   overallStatus = 'compilation_error';
    else if (results.some(r => r.status === 'time_limit_exceeded')) overallStatus = 'time_limit_exceeded';
    else if (results.some(r => r.status === 'runtime_error'))  overallStatus = 'runtime_error';
    else if (results.some(r => r.status === 'failed'))         overallStatus = 'wrong_answer';

    const avgTime = results.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) / results.length;

    await client.query('BEGIN');

    await client.query(`
      UPDATE submissions SET status=$1, score=$2, execution_time_ms=$3, submitted_at=NOW()
      WHERE id=$4
    `, [overallStatus, passed, Math.round(avgTime), submissionId]);

    for (const result of results) {
      await client.query(`
        INSERT INTO test_case_results (submission_id, test_case_id, status, actual_output, execution_time_ms)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [submissionId, result.testCaseId, result.status, result.actualOutput?.substring(0, 10000), result.executionTimeMs]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await client.query(`UPDATE submissions SET status='runtime_error' WHERE id=$1`, [submissionId]);
    console.error('Process submission error:', err);
  } finally {
    client.release();
  }
}

// POST /api/submissions/run - run code without submitting
router.post('/run', authenticate, async (req, res) => {
  try {
    const { code, language, stdin = '' } = req.body;
    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language required' });
    }

    // Rate limit: 1 run per student per 5 seconds
    if (isRateLimited(req.user.id)) {
      const waitMs = RATE_LIMIT_MS - (Date.now() - (lastRunTime.get(req.user.id) || 0));
      return res.status(429).json({
        error: `Please wait ${Math.ceil(waitMs / 1000)} second(s) before running again.`
      });
    }
    markRun(req.user.id);

    // Queue execution to prevent server overload
    const result = await runWithQueue(async () => {
      const dockerAvailable = await isDockerAvailable();
      return dockerAvailable
        ? await executeCode(code, language, stdin)
        : await executeCodeSimulated(code, language, stdin);
    });

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTimeMs: result.executionTimeMs,
      simulated: result.simulated || false,
    });
  } catch (err) {
    console.error('Run code error:', err);
    res.status(500).json({ error: 'Code execution failed', details: err.message });
  }
});

// GET /api/submissions - list submissions
router.get('/', authenticate, async (req, res) => {
  try {
    const { problemId, studentId, assignmentId } = req.query;
    let whereClause = '';
    const params = [];
    const conditions = [];

    if (req.user.role === 'student') {
      conditions.push(`s.student_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (studentId) {
      conditions.push(`s.student_id = $${params.length + 1}`);
      params.push(studentId);
    }

    if (problemId) {
      conditions.push(`s.problem_id = $${params.length + 1}`);
      params.push(problemId);
    }

    if (assignmentId) {
      conditions.push(`s.assignment_id = $${params.length + 1}`);
      params.push(assignmentId);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const result = await query(`
      SELECT s.*, p.title as problem_title, u.full_name as student_name, u.username
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      JOIN users u ON s.student_id = u.id
      ${whereClause}
      ORDER BY s.submitted_at DESC
      LIMIT 100
    `, params);

    res.json({ submissions: result.rows });
  } catch (err) {
    console.error('Get submissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/submissions/:id - get submission details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*, p.title as problem_title, u.full_name as student_name
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      JOIN users u ON s.student_id = u.id
      WHERE s.id = $1 ${req.user.role === 'student' ? 'AND s.student_id = $2' : ''}
    `, req.user.role === 'student' ? [req.params.id, req.user.id] : [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = result.rows[0];

    // Get test case results
    const tcResults = await query(`
      SELECT tcr.*, tc.input, tc.expected_output, tc.is_hidden, tc.points
      FROM test_case_results tcr
      JOIN test_cases tc ON tcr.test_case_id = tc.id
      WHERE tcr.submission_id = $1
      ORDER BY tc.order_index
    `, [req.params.id]);

    // Hide hidden test case details for students
    const filteredResults = tcResults.rows.map(r => {
      if (req.user.role === 'student' && r.is_hidden) {
        return { ...r, input: '[hidden]', expected_output: '[hidden]', actual_output: '[hidden]' };
      }
      return r;
    });

    submission.testCaseResults = filteredResults;
    res.json({ submission });
  } catch (err) {
    console.error('Get submission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
