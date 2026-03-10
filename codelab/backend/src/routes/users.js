const express = require('express');
const bcrypt  = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/users/students ───────────────────────────────────────────────────
router.get('/students', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.created_at,
        COUNT(s.id)                                                         AS total_submissions,
        COUNT(s.id) FILTER (WHERE s.status = 'accepted')                    AS accepted_submissions,
        COUNT(DISTINCT s.problem_id) FILTER (WHERE s.status = 'accepted')   AS problems_solved
      FROM users u
      LEFT JOIN submissions s ON s.student_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.full_name ASC
    `);
    res.json({ students: result.rows });
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/users/students ──────────────────────────────────────────────────
router.post('/students', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    if (!username || !email || !password || !fullName)
      return res.status(400).json({ error: 'All fields required' });

    const existing = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Username or email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (username, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, 'student', $4)
       RETURNING id, username, email, role, full_name`,
      [username, email, hash, fullName]
    );
    res.status(201).json({ student: result.rows[0] });
  } catch (err) {
    console.error('Create student error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/users/admins ─────────────────────────────────────────────────────
router.get('/admins', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, username, email, full_name, created_at
      FROM users
      WHERE role = 'admin'
      ORDER BY full_name ASC
    `);
    res.json({ admins: result.rows });
  } catch (err) {
    console.error('Get admins error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id)
      return res.status(400).json({ error: 'Cannot delete your own account' });

    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id', [targetId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
