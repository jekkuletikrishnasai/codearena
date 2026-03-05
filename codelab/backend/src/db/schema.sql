-- CodeLab Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'student')),
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Problems table
CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  time_limit_ms INTEGER DEFAULT 5000,
  memory_limit_mb INTEGER DEFAULT 256,
  allowed_languages TEXT[] DEFAULT ARRAY['python', 'javascript', 'java', 'cpp', 'c'],
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test cases table
CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE NOT NULL,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  points INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignment problems (many-to-many)
CREATE TABLE IF NOT EXISTS assignment_problems (
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  PRIMARY KEY (assignment_id, problem_id)
);

-- Assignment students (many-to-many)
CREATE TABLE IF NOT EXISTS assignment_students (
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, student_id)
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE NOT NULL,
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  language VARCHAR(20) NOT NULL,
  code TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'accepted', 'wrong_answer', 'time_limit_exceeded', 'memory_limit_exceeded', 'runtime_error', 'compilation_error')),
  score INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  memory_used_mb INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test case results table
CREATE TABLE IF NOT EXISTS test_case_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('passed', 'failed', 'time_limit_exceeded', 'runtime_error')),
  actual_output TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_id ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_problem_id ON test_cases(problem_id);
CREATE INDEX IF NOT EXISTS idx_assignment_students_student_id ON assignment_students(student_id);

-- Seed admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role, full_name)
VALUES (
  'admin',
  'admin@codelab.edu',
  '$2a$10$rBGBpfZDxNqJ8KLGDsrqxuE2OzVbEBj6oNQN4YVn4Bk4b4Z1FGaHm',
  'admin',
  'Course Instructor'
) ON CONFLICT (username) DO NOTHING;

-- Seed sample students (password: student123)
INSERT INTO users (username, email, password_hash, role, full_name)
VALUES 
  ('alice', 'alice@student.edu', '$2a$10$8K1p/a0dR1LXMVuk53lOWeyFHtd0hMz1.v3kJCTXqC5F4KlWzI8M6', 'student', 'Alice Johnson'),
  ('bob', 'bob@student.edu', '$2a$10$8K1p/a0dR1LXMVuk53lOWeyFHtd0hMz1.v3kJCTXqC5F4KlWzI8M6', 'student', 'Bob Smith'),
  ('charlie', 'charlie@student.edu', '$2a$10$8K1p/a0dR1LXMVuk53lOWeyFHtd0hMz1.v3kJCTXqC5F4KlWzI8M6', 'student', 'Charlie Brown')
ON CONFLICT (username) DO NOTHING;
