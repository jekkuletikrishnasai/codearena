const express = require('express');
const { query } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/dashboard - admin analytics
router.get('/dashboard', authenticate, requireAdmin, async (req, res) => {
  try {
    const [
      totalStudents, totalProblems, totalSubmissions, recentSubmissions,
      submissionsByStatus, submissionsByLanguage, submissionsByDay,
      topStudents, hardestProblems, difficultyStats
    ] = await Promise.all([
      query("SELECT COUNT(*) FROM users WHERE role='student'"),
      query("SELECT COUNT(*) FROM problems"),
      query("SELECT COUNT(*) FROM submissions"),
      query("SELECT COUNT(*) FROM submissions WHERE submitted_at > NOW() - INTERVAL '24 hours'"),
      query("SELECT status, COUNT(*) as count FROM submissions GROUP BY status ORDER BY count DESC"),
      query("SELECT language, COUNT(*) as count FROM submissions GROUP BY language ORDER BY count DESC"),
      query(`
        SELECT DATE(submitted_at) as date, COUNT(*) as count
        FROM submissions
        WHERE submitted_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(submitted_at)
        ORDER BY date
      `),
      query(`
        SELECT u.full_name, u.username,
          COUNT(DISTINCT s.problem_id) FILTER (WHERE s.status='accepted') as solved,
          COUNT(DISTINCT s.id) as attempts,
          ROUND(COUNT(DISTINCT s.problem_id) FILTER (WHERE s.status='accepted')::numeric / 
            NULLIF(COUNT(DISTINCT s.problem_id), 0) * 100, 1) as accuracy
        FROM users u
        LEFT JOIN submissions s ON u.id = s.student_id
        WHERE u.role = 'student'
        GROUP BY u.id, u.full_name, u.username
        ORDER BY solved DESC
        LIMIT 10
      `),
      query(`
        SELECT p.title, p.difficulty,
          COUNT(DISTINCT s.id) as total_attempts,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status='accepted') as accepted,
          ROUND(COUNT(DISTINCT s.id) FILTER (WHERE s.status='accepted')::numeric /
            NULLIF(COUNT(DISTINCT s.id), 0) * 100, 1) as acceptance_rate
        FROM problems p
        LEFT JOIN submissions s ON p.id = s.problem_id
        GROUP BY p.id, p.title, p.difficulty
        HAVING COUNT(DISTINCT s.id) > 0
        ORDER BY acceptance_rate ASC
        LIMIT 10
      `),
      query(`
        SELECT difficulty, COUNT(*) as count,
          AVG(CASE WHEN s.status='accepted' THEN 1 ELSE 0 END) * 100 as avg_acceptance
        FROM problems p
        LEFT JOIN submissions s ON p.id = s.problem_id
        GROUP BY difficulty
      `),
    ]);

    res.json({
      summary: {
        totalStudents: parseInt(totalStudents.rows[0].count),
        totalProblems: parseInt(totalProblems.rows[0].count),
        totalSubmissions: parseInt(totalSubmissions.rows[0].count),
        recentSubmissions: parseInt(recentSubmissions.rows[0].count),
      },
      submissionsByStatus: submissionsByStatus.rows,
      submissionsByLanguage: submissionsByLanguage.rows,
      submissionsByDay: submissionsByDay.rows,
      topStudents: topStudents.rows,
      hardestProblems: hardestProblems.rows,
      difficultyStats: difficultyStats.rows,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/report - generate CSV report
router.get('/report', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.full_name, u.username, u.email,
        p.title as problem_title, p.difficulty,
        s.language, s.status, s.score, s.max_score, s.submitted_at
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      JOIN problems p ON s.problem_id = p.id
      ORDER BY s.submitted_at DESC
    `);

    const csv = [
      'Student Name,Username,Email,Problem,Difficulty,Language,Status,Score,Max Score,Submitted At',
      ...result.rows.map(r =>
        `"${r.full_name}","${r.username}","${r.email}","${r.problem_title}","${r.difficulty}","${r.language}","${r.status}",${r.score},${r.max_score},"${r.submitted_at}"`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="codelab-report.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
