import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import LoginPage from './pages/auth/LoginPage';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProblems from './pages/admin/Problems';
import AdminProblemForm from './pages/admin/ProblemForm';
import AdminAssignments from './pages/admin/Assignments';
import AdminSubmissions from './pages/admin/Submissions';
import AdminStudents from './pages/admin/Students';
import AdminAnalytics from './pages/admin/Analytics';
import StudentDashboard from './pages/student/Dashboard';
import StudentProblem from './pages/student/Problem';
import StudentSubmissions from './pages/student/Submissions';
import Layout from './components/shared/Layout';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400 font-mono text-sm">Initializing CodeLab...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} /> : <LoginPage />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute role="admin"><Layout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="problems" element={<AdminProblems />} />
        <Route path="problems/new" element={<AdminProblemForm />} />
        <Route path="problems/:id/edit" element={<AdminProblemForm />} />
        <Route path="assignments" element={<AdminAssignments />} />
        <Route path="submissions" element={<AdminSubmissions />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>

      {/* Student Routes */}
      <Route path="/student" element={<ProtectedRoute role="student"><Layout /></ProtectedRoute>}>
        <Route index element={<StudentDashboard />} />
        <Route path="problems/:id" element={<StudentProblem />} />
        <Route path="submissions" element={<StudentSubmissions />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? (user.role === 'admin' ? '/admin' : '/student') : '/login'} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
            success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
