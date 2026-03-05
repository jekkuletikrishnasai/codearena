const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/students - list all students (admin)
router.get('/students', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.id, u.username, u.email, u.full_name, u.created_at,
        COUNT(DISTINCT s.id) as total_submissions,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status='accepted') as accepted_submissions,
        COUNT(DISTINCT s.problem_id) FILTER (WHERE s.status='accepted') as problems_solved
      FROM users u
      LEFT JOIN submissions s ON u.id = s.student_id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.full_name
    `);
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/students - create student (admin)
router.post('/students', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const existing = await query('SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (username, email, password_hash, role, full_name) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, email, role, full_name',
      [username, email, hash, 'student', fullName]
    );
    res.status(201).json({ student: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id=$1 AND role=\'student\'', [req.params.id]);
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
