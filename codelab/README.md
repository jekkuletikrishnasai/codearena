# 🧪 CodeLab — Programming Assessment Platform

A full-stack web application for instructors to assign and evaluate coding problems, and for students to practice and submit solutions in a Monaco-powered code editor.

---

## 📁 Project Structure

```
codelab/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.js          # PostgreSQL connection pool
│   │   │   ├── schema.sql        # Full database schema + seed data
│   │   │   └── setup.js          # DB setup script
│   │   ├── middleware/
│   │   │   └── auth.js           # JWT auth middleware + role guards
│   │   ├── routes/
│   │   │   ├── auth.js           # Login, register, /me
│   │   │   ├── problems.js       # CRUD for problems + test cases
│   │   │   ├── submissions.js    # Submit, run, fetch results
│   │   │   ├── assignments.js    # Assignment management
│   │   │   ├── analytics.js      # Dashboard stats + CSV report
│   │   │   └── users.js          # Student management
│   │   ├── services/
│   │   │   └── codeExecution.js  # Docker-based sandbox runner
│   │   └── server.js             # Express app entry point
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx   # Auth state & JWT handling
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   └── LoginPage.jsx
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Problems.jsx
│   │   │   │   ├── ProblemForm.jsx   # Create/edit problems + test cases
│   │   │   │   ├── Assignments.jsx
│   │   │   │   ├── Submissions.jsx   # Live submission monitor
│   │   │   │   ├── Students.jsx
│   │   │   │   └── Analytics.jsx     # Recharts dashboard
│   │   │   └── student/
│   │   │       ├── Dashboard.jsx
│   │   │       ├── Problem.jsx       # Monaco Editor + run/submit
│   │   │       └── Submissions.jsx
│   │   ├── components/
│   │   │   └── shared/
│   │   │       └── Layout.jsx        # Sidebar navigation
│   │   ├── utils/
│   │   │   └── api.js               # Axios instance
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   │   └── index.html
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Docker (for code execution sandbox)
- npm or yarn

---

### Step 1: Clone & Configure

```bash
git clone <your-repo>
cd codelab

# Configure backend environment
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/codelab
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

---

### Step 2: Set Up PostgreSQL

Make sure PostgreSQL is running, then:

```bash
# Create the database
createdb codelab

# Run the schema (from the backend directory)
cd backend
npm install
npm run setup-db
```

This creates all tables and seeds:
| User | Role | Password |
|------|------|----------|
| `admin` | Instructor | `admin123` |
| `alice` | Student | `student123` |
| `bob` | Student | `student123` |
| `charlie` | Student | `student123` |

---

### Step 3: Start the Backend

```bash
# In /backend
npm run dev
# Server starts at http://localhost:5000
```

---

### Step 4: Start the Frontend

```bash
# In /frontend
npm install
npm start
# App starts at http://localhost:3000
```

---

### Step 5: Pull Docker Images for Code Execution

For real code execution in isolated containers:

```bash
docker pull python:3.11-slim
docker pull node:18-slim
docker pull openjdk:17-slim
docker pull gcc:12
```

> **Note:** If Docker is not available, the platform falls back to **simulated execution** automatically. Students can still run and submit code — results will be simulated for demo purposes.

---

## 🐳 Full Docker Compose Setup

Run everything with one command:

```bash
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| PostgreSQL | localhost:5432 |

Then run the DB setup:
```bash
docker-compose exec backend npm run setup-db
```

---

## 🔑 API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register new student |
| GET | `/api/auth/me` | Get current user |

### Problems
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/problems` | All users |
| GET | `/api/problems/:id` | All users |
| POST | `/api/problems` | Admin only |
| PUT | `/api/problems/:id` | Admin only |
| DELETE | `/api/problems/:id` | Admin only |

### Submissions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/submissions` | Submit code for evaluation |
| POST | `/api/submissions/run` | Run code with custom stdin |
| GET | `/api/submissions` | List submissions |
| GET | `/api/submissions/:id` | Submission + test case results |

### Assignments
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/assignments` | All users |
| POST | `/api/assignments` | Admin only |
| PUT | `/api/assignments/:id` | Admin only |
| DELETE | `/api/assignments/:id` | Admin only |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/dashboard` | All stats, charts data |
| GET | `/api/analytics/report` | Download CSV report |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/students` | List all students |
| POST | `/api/users/students` | Create student |
| DELETE | `/api/users/:id` | Remove student |

---

## ⚙️ Code Execution Architecture

The code execution pipeline works as follows:

1. Student submits code → backend receives it
2. API responds immediately with `{ status: "running" }` (non-blocking)
3. Background process runs test cases:
   - Each test case runs in an isolated Docker container
   - Network access is disabled (`--network none`)
   - Memory limited to 256MB
   - CPU limited to 0.5 cores
   - Process limit enforced with `ulimit`
   - `timeout` command enforces time limits
4. Results are saved to `test_case_results` table
5. Frontend polls `/submissions/:id` every 1.5s until status changes

### Supported Languages
| Language | Docker Image | File |
|----------|-------------|------|
| Python | `python:3.11-slim` | `solution.py` |
| JavaScript | `node:18-slim` | `solution.js` |
| Java | `openjdk:17-slim` | `Solution.java` |
| C++ | `gcc:12` | `solution.cpp` |
| C | `gcc:12` | `solution.c` |

---

## 🎨 Features at a Glance

### Admin (Instructor)
- ✅ Create problems with rich descriptions, difficulty levels, time/memory limits
- ✅ Add visible sample test cases and hidden evaluation test cases
- ✅ Create assignments with specific problems and students
- ✅ Monitor all student submissions in real-time
- ✅ View student code and test case results
- ✅ Analytics dashboard with charts (submission trends, acceptance rates, language breakdown)
- ✅ Top students leaderboard
- ✅ Export full submission report as CSV

### Student
- ✅ View assigned problems with difficulty badges
- ✅ Monaco Editor with syntax highlighting for all supported languages
- ✅ Language starter templates auto-inserted
- ✅ Run code with custom stdin before submitting
- ✅ Submit and see per-test-case results in real-time
- ✅ Hidden test cases show pass/fail only (input/output hidden)
- ✅ Submission history with code viewer

---

## 🛠 Technology Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Tailwind CSS, Monaco Editor, Recharts |
| Backend | Node.js, Express |
| Database | PostgreSQL 15 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Code Execution | Docker sandbox with per-language images |
| Routing | React Router v6 |
| HTTP Client | Axios |
| Notifications | react-hot-toast |

---

## 🔒 Security Features

- Passwords hashed with bcrypt (10 rounds)
- JWT-based stateless authentication
- Role-based route guards (admin/student)
- Code runs in isolated Docker containers with:
  - No network access
  - Memory limits
  - CPU limits
  - Process limits (ulimit)
  - Execution timeout
- Students cannot see hidden test case inputs/outputs

---

## 📝 Adding Sample Problems

After setup, log in as admin and create a problem. Here's an example:

**Title:** Sum of Two Numbers  
**Difficulty:** Easy  
**Description:**
```
Given two integers A and B on a single line, print their sum.

Input: Two space-separated integers A and B.
Output: A single integer, the sum of A and B.

Constraints: -10^9 ≤ A, B ≤ 10^9
```

**Test Cases:**
| Input | Output | Hidden |
|-------|--------|--------|
| `3 5` | `8` | No |
| `0 0` | `0` | No |
| `-5 10` | `5` | Yes |
| `1000000000 1000000000` | `2000000000` | Yes |

**Sample Python Solution:**
```python
a, b = map(int, input().split())
print(a + b)
```
