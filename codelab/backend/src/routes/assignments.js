const express = require('express');
const { query, getClient } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/assignments
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await query(`
        SELECT a.*, u.full_name as creator_name,
          COUNT(DISTINCT ap.problem_id) as problem_count,
          COUNT(DISTINCT ast.student_id) as student_count
        FROM assignments a
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN assignment_problems ap ON a.id = ap.assignment_id
        LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
        GROUP BY a.id, u.full_name
        ORDER BY a.created_at DESC
      `);
    } else {
      result = await query(`
        SELECT a.*, 
          COUNT(DISTINCT ap.problem_id) as problem_count,
          COUNT(DISTINCT s.id) FILTER (WHERE s.student_id = $1 AND s.status = 'accepted') as solved_count
        FROM assignments a
        JOIN assignment_students ast ON a.id = ast.assignment_id
        LEFT JOIN assignment_problems ap ON a.id = ap.assignment_id
        LEFT JOIN submissions s ON ap.problem_id = s.problem_id AND s.student_id = $1
        WHERE ast.student_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `, [req.user.id]);
    }
    res.json({ assignments: result.rows });
  } catch (err) {
    console.error('Get assignments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assignments/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT a.*, u.full_name as creator_name
      FROM assignments a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = result.rows[0];

    // Get problems
    const problems = await query(`
      SELECT p.id, p.title, p.difficulty, p.allowed_languages, ap.order_index
      FROM problems p
      JOIN assignment_problems ap ON p.id = ap.problem_id
      WHERE ap.assignment_id = $1
      ORDER BY ap.order_index
    `, [req.params.id]);

    // Get students (admin only)
    if (req.user.role === 'admin') {
      const students = await query(`
        SELECT u.id, u.username, u.full_name, u.email
        FROM users u
        JOIN assignment_students ast ON u.id = ast.student_id
        WHERE ast.assignment_id = $1
      `, [req.params.id]);
      assignment.students = students.rows;
    }

    assignment.problems = problems.rows;
    res.json({ assignment });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assignments (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { title, description, dueDate, problemIds, studentIds } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO assignments (title, description, due_date, created_by)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [title, description, dueDate || null, req.user.id]);

    const assignment = result.rows[0];

    if (problemIds?.length) {
      for (let i = 0; i < problemIds.length; i++) {
        await client.query(
          'INSERT INTO assignment_problems (assignment_id, problem_id, order_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [assignment.id, problemIds[i], i]
        );
      }
    }

    if (studentIds?.length) {
      for (const sid of studentIds) {
        await client.query(
          'INSERT INTO assignment_students (assignment_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [assignment.id, sid]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ assignment });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create assignment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/assignments/:id (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { title, description, dueDate, problemIds, studentIds } = req.body;
  // Convert empty string to null so PostgreSQL accepts it for TIMESTAMP column
  const dueDateValue = dueDate && dueDate.trim() !== '' ? dueDate : null;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE assignments SET title=$1, description=$2, due_date=$3, updated_at=NOW() WHERE id=$4',
      [title, description || null, dueDateValue, req.params.id]
    );

    if (problemIds !== undefined) {
      await client.query('DELETE FROM assignment_problems WHERE assignment_id=$1', [req.params.id]);
      for (let i = 0; i < problemIds.length; i++) {
        await client.query(
          'INSERT INTO assignment_problems (assignment_id, problem_id, order_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [req.params.id, problemIds[i], i]
        );
      }
    }

    if (studentIds !== undefined) {
      await client.query('DELETE FROM assignment_students WHERE assignment_id=$1', [req.params.id]);
      for (const sid of studentIds) {
        await client.query(
          'INSERT INTO assignment_students (assignment_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, sid]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Assignment updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update assignment error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/assignments/:id (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM assignments WHERE id=$1', [req.params.id]);
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;