const express = require('express');
const { query, getClient } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { runTestCases, runTestCasesSimulated, executeCode, executeCodeMulti, executeCodeSimulated, isDockerAvailable } = require('../services/codeExecution');

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

// ── Wall time buffer ─────────────────────────────────────────────────────────
// Java now uses javac+class execution — JVM startup is ~1-2s not 8-15s.
// Add only 8s buffer (covers compile time which happens before timing starts).
const JAVA_JVM_BUFFER_MS = 8000;

function getWallTime(language, problemTimeLimitMs) {
  if (language === 'java') return problemTimeLimitMs + JAVA_JVM_BUFFER_MS;
  return problemTimeLimitMs + 3000; // 3s buffer for other languages
}

// ── Execution queues: separate queues for Run vs Submit ───────────────────────
let activeExecutions = 0;
const MAX_CONCURRENT = 6;
const MAX_CONCURRENT_SUBMIT = 5;
const MAX_CONCURRENT_RUN = 5;
let activeRunExecutions = 0;
let activeSubmissions = 0;
const submitQueue = [];
const runExecutionQueue = [];

// Queue position tracking: submissionId → queue position (1-based, 0 = running)
const submissionQueuePos = new Map();

function getQueueInfo() {
  return {
    activeSubmissions,
    queueLength: submitQueue.length,
    maxSlots: MAX_CONCURRENT_SUBMIT,
    // Estimated seconds per submission slot (Java compile+run ~8s average)
    avgSecondsPerSlot: 8,
  };
}

function runWithSubmitQueue(fn, submissionId) {
  return new Promise((resolve, reject) => {
    const task = () => {
      activeSubmissions++;
      // Now running — position 0 means "your code is executing"
      if (submissionId) submissionQueuePos.set(submissionId, 0);
      fn()
        .then(resolve).catch(reject)
        .finally(() => {
          activeSubmissions--;
          if (submissionId) submissionQueuePos.delete(submissionId);
          if (submitQueue.length > 0) submitQueue.shift()();
        });
    };
    if (activeSubmissions < MAX_CONCURRENT_SUBMIT) {
      task();
    } else {
      // Track queue position (queue length before adding = position)
      const pos = submitQueue.length + 1;
      if (submissionId) submissionQueuePos.set(submissionId, pos);
      submitQueue.push(() => {
        // Update position to 0 (now running) when dequeued
        if (submissionId) submissionQueuePos.set(submissionId, 0);
        task();
      });
    }
  });
}
const executionQueue = [];

function runWithQueue(fn, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timeoutHandle = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Execution queue timeout — server too busy'));
      }
    }, timeoutMs);

    const task = () => {
      if (settled) {
        // Already timed out while waiting in queue — skip and free slot
        activeExecutions--;
        if (executionQueue.length > 0) executionQueue.shift()();
        return;
      }
      activeExecutions++;
      fn()
        .then(r => { if (!settled) { settled = true; clearTimeout(timeoutHandle); resolve(r); } })
        .catch(e => { if (!settled) { settled = true; clearTimeout(timeoutHandle); reject(e); } })
        .finally(() => {
          activeExecutions--;
          if (executionQueue.length > 0) executionQueue.shift()();
        });
    };

    if (activeExecutions < MAX_CONCURRENT) {
      task();
    } else {
      executionQueue.push(task);
    }
  });
}

function runWithRunQueue(fn, timeoutMs = 120000) {  // 120s — covers semaphore wait + javac + run
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('Run queue timeout')); }
    }, timeoutMs);

    const task = () => {
      if (settled) { activeRunExecutions--; if (runExecutionQueue.length > 0) runExecutionQueue.shift()(); return; }
      activeRunExecutions++;
      fn()
        .then(r => { if (!settled) { settled = true; clearTimeout(timeoutHandle); resolve(r); } })
        .catch(e => { if (!settled) { settled = true; clearTimeout(timeoutHandle); reject(e); } })
        .finally(() => { activeRunExecutions--; if (runExecutionQueue.length > 0) runExecutionQueue.shift()(); });
    };

    if (activeRunExecutions < MAX_CONCURRENT_RUN) task();
    else runExecutionQueue.push(task);
  });
}

// POST /api/submissions - submit code
router.post('/', authenticate, async (req, res) => {
  const { problemId, assignmentId, language, code } = req.body;

  if (!problemId || !language || !code) {
    return res.status(400).json({ error: 'Problem ID, language, and code required' });
  }

  try {
    // ── Use pooled query() (not getClient) so we don't hold a connection ──
    const problemResult = await query('SELECT * FROM problems WHERE id = $1', [problemId]);
    if (problemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found' });
    }
    const problem = problemResult.rows[0];

    if (!problem.allowed_languages.includes(language)) {
      return res.status(400).json({ error: `Language ${language} not allowed for this problem` });
    }

    const testCasesResult = await query(
      'SELECT * FROM test_cases WHERE problem_id = $1 ORDER BY order_index', [problemId]
    );
    const testCases = testCasesResult.rows;

    // Create submission record — brief single INSERT, no transaction needed
    const submissionResult = await query(`
      INSERT INTO submissions (student_id, problem_id, assignment_id, language, code, status, max_score)
      VALUES ($1, $2, $3, $4, $5, 'running', $6) RETURNING id, status
    `, [req.user.id, problemId, assignmentId || null, language, code, testCases.length]);

    const submission = submissionResult.rows[0];

    // Respond immediately — client starts polling
    res.status(202).json({
      submission: { id: submission.id, status: 'running' },
      message: 'Submission received and running',
    });

    // Execute in background with queue to prevent overload
    runWithSubmitQueue(() => processSubmission(submission.id, code, language, testCases, problem), submission.id).catch(console.error);

  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function processSubmission(submissionId, code, language, testCases, problem) {
  // ── PHASE 1: Compile ONCE + run ALL test cases in parallel ────────────────
  // executeCodeMulti compiles Java once (javac, ~3-5s) then runs all test cases
  // in parallel from the .class file (~1-2s each).
  //
  // Before this fix: 3 Java test cases × 8-15s JVM startup each = 24-45s
  // After this fix:  1 compile (3-5s) + 3 parallel runs (1-2s) = ~5-7s total
  //
  // The entire submission takes ONE queue slot (not N slots), freeing up
  // capacity for other students.
  const wallTime = getWallTime(language, problem.time_limit_ms || 10000);

  const rawResults = await runWithQueue(() =>
    executeCodeMulti(code, language, testCases, wallTime)
  ).catch(err =>
    // Queue timeout or system error — return error for all test cases
    testCases.map(tc => ({
      testCaseId: tc.id, stdout: '', stderr: err.message,
      exitCode: 1, executionTimeMs: 0, timedOut: false,
    }))
  );

  const results = rawResults.map((result, i) => {
    const tc       = testCases[i];
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
      errorOutput:  result.stderr,
      executionTimeMs: result.executionTimeMs,
      expected, isHidden: tc.is_hidden,
    };
  });

  // ── PHASE 2: Write results to DB (grab client only NOW, briefly) ──────────
  const client = await getClient();
  try {
    const passed = results.filter(r => r.status === 'passed').length;

    let overallStatus = 'accepted';
    if (results.some(r => r.status === 'compilation_error'))        overallStatus = 'compilation_error';
    else if (results.some(r => r.status === 'time_limit_exceeded')) overallStatus = 'time_limit_exceeded';
    else if (results.some(r => r.status === 'runtime_error'))       overallStatus = 'runtime_error';
    else if (results.some(r => r.status === 'failed'))              overallStatus = 'wrong_answer';

    const avgTime = results.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) / (results.length || 1);

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
      `, [submissionId, result.testCaseId, result.status,
          (result.actualOutput || result.errorOutput || '').substring(0, 10000),
          result.executionTimeMs]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await query(`UPDATE submissions SET status='runtime_error' WHERE id=$1`, [submissionId]);
    console.error('Process submission DB error:', err);
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

    // Use dedicated run queue — separate from submit queue so runs are never starved
    const result = await runWithRunQueue(async () => {
      const dockerAvailable = await isDockerAvailable();
      return dockerAvailable
        ? await executeCode(code, language, stdin, 30000)
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

// GET /api/submissions/:id/status — LIGHTWEIGHT polling endpoint
// Only returns status field — no JOINs, no test case data.
// Frontend polls this while waiting, then fetches full details only once done.
router.get('/:id/status', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, status, score, max_score, execution_time_ms
       FROM submissions
       WHERE id = $1 ${req.user.role === 'student' ? 'AND student_id = $2' : ''}`,
      req.user.role === 'student' ? [req.params.id, req.user.id] : [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const row = result.rows[0];
    const queueInfo = getQueueInfo();

    // queuePosition: null = done/not in queue, 0 = currently executing, N = Nth in queue
    const queuePosition = submissionQueuePos.has(req.params.id)
      ? submissionQueuePos.get(req.params.id)
      : (row.status === 'running' ? 0 : null);

    // Estimated wait: position × avg seconds per slot
    const estimatedWaitSec = queuePosition > 0
      ? queuePosition * queueInfo.avgSecondsPerSlot
      : 0;

    res.json({
      ...row,
      queuePosition,
      estimatedWaitSec,
      activeSubmissions: queueInfo.activeSubmissions,
      queueLength: queueInfo.queueLength,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
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

// DELETE /api/submissions/:id — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    // Delete test case results first (FK constraint), then the submission
    await query('DELETE FROM test_case_results WHERE submission_id = $1', [req.params.id]);
    const result = await query('DELETE FROM submissions WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    console.error('Delete submission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
