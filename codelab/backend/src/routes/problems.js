const express = require('express');
const { query } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/problems - list all problems (admin) or assigned problems (student)
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await query(`
        SELECT p.*, u.full_name as creator_name,
          COUNT(DISTINCT s.id) as submission_count,
          COUNT(DISTINCT tc.id) as test_case_count
        FROM problems p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN submissions s ON p.id = s.problem_id
        LEFT JOIN test_cases tc ON p.id = tc.problem_id
        GROUP BY p.id, u.full_name
        ORDER BY p.created_at DESC
      `);
    } else {
      result = await query(`
        SELECT DISTINCT p.*, 
          COUNT(DISTINCT tc.id) FILTER (WHERE tc.is_hidden = false) as visible_test_cases,
          s.status as my_best_status,
          COUNT(DISTINCT s.id) as my_attempts
        FROM problems p
        JOIN assignment_problems ap ON p.id = ap.problem_id
        JOIN assignment_students ast ON ap.assignment_id = ast.assignment_id
        LEFT JOIN test_cases tc ON p.id = tc.problem_id
        LEFT JOIN submissions s ON p.id = s.problem_id AND s.student_id = $1
        WHERE ast.student_id = $1
        GROUP BY p.id, s.status
        ORDER BY p.created_at DESC
      `, [req.user.id]);
    }
    res.json({ problems: result.rows });
  } catch (err) {
    console.error('Get problems error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/problems/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, u.full_name as creator_name
      FROM problems p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const problem = result.rows[0];

    // Get test cases (hidden for students)
    const tcResult = await query(`
      SELECT * FROM test_cases 
      WHERE problem_id = $1 
      ${req.user.role !== 'admin' ? 'AND is_hidden = false' : ''}
      ORDER BY order_index, created_at
    `, [req.params.id]);

    problem.testCases = tcResult.rows;
    res.json({ problem });
  } catch (err) {
    console.error('Get problem error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/problems - create problem (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, description, difficulty, timeLimitMs, memoryLimitMb, allowedLanguages, testCases } = req.body;

    if (!title || !description || !difficulty) {
      return res.status(400).json({ error: 'Title, description, and difficulty required' });
    }

    const client = await require('../db').getClient();
    try {
      await client.query('BEGIN');

      const problemResult = await client.query(`
        INSERT INTO problems (title, description, difficulty, time_limit_ms, memory_limit_mb, allowed_languages, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [title, description, difficulty, timeLimitMs || 5000, memoryLimitMb || 256, allowedLanguages || ['python', 'javascript', 'java', 'cpp', 'c'], req.user.id]);

      const problem = problemResult.rows[0];

      if (testCases && testCases.length > 0) {
        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          await client.query(`
            INSERT INTO test_cases (problem_id, input, expected_output, is_hidden, points, order_index)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [problem.id, tc.input, tc.expectedOutput, tc.isHidden || false, tc.points || 1, i]);
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ problem });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create problem error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/problems/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, description, difficulty, timeLimitMs, memoryLimitMb, allowedLanguages, testCases } = req.body;

    const client = await require('../db').getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        UPDATE problems SET title=$1, description=$2, difficulty=$3, time_limit_ms=$4, 
        memory_limit_mb=$5, allowed_languages=$6, updated_at=NOW()
        WHERE id=$7 RETURNING *
      `, [title, description, difficulty, timeLimitMs, memoryLimitMb, allowedLanguages, req.params.id]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Problem not found' });
      }

      if (testCases !== undefined) {
        await client.query('DELETE FROM test_cases WHERE problem_id = $1', [req.params.id]);
        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          await client.query(`
            INSERT INTO test_cases (problem_id, input, expected_output, is_hidden, points, order_index)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [req.params.id, tc.input, tc.expectedOutput, tc.isHidden || false, tc.points || 1, i]);
        }
      }

      await client.query('COMMIT');
      res.json({ problem: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update problem error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/problems/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM problems WHERE id = $1', [req.params.id]);
    res.json({ message: 'Problem deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
