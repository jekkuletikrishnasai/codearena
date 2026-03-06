import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { Code2, Users, Send, CheckCircle, TrendingUp, Clock, AlertCircle, Plus } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const colors = {
    accepted: 'bg-emerald-500/20 text-emerald-400',
    wrong_answer: 'bg-red-500/20 text-red-400',
    time_limit_exceeded: 'bg-yellow-500/20 text-yellow-400',
    runtime_error: 'bg-orange-500/20 text-orange-400',
    compilation_error: 'bg-red-500/20 text-red-400',
    running: 'bg-blue-500/20 text-blue-400',
    pending: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentSubs, setRecentSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/analytics/dashboard'),
      api.get('/api/submissions?limit=5'),
    ]).then(([analyticsRes, subRes]) => {
      setStats(analyticsRes.data.summary);
      setRecentSubs(subRes.data.submissions.slice(0, 8));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents || 0, icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Problems', value: stats?.totalProblems || 0, icon: Code2, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Submissions', value: stats?.totalSubmissions || 0, icon: Send, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Last 24h', value: stats?.recentSubmissions || 0, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.fullName} 👋</h1>
          <p className="text-gray-400 mt-1">Here's what's happening in your classroom</p>
        </div>
        <div className="flex gap-3">
          <Link to="/admin/problems/new" className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New Problem
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">{label}</span>
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
            </div>
            <div className="text-3xl font-bold text-white font-mono">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Recent Submissions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Submissions</h2>
          <Link to="/admin/submissions" className="text-sm text-sky-400 hover:text-sky-300">View all →</Link>
        </div>
        <div className="divide-y divide-gray-800">
          {recentSubs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No submissions yet</div>
          ) : recentSubs.map(sub => (
            <div key={sub.id} className="p-4 flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold text-gray-400">
                {sub.student_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{sub.student_name}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-sm text-gray-400 truncate">{sub.problem_title}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{sub.language}</span>
                  <span className="text-xs text-gray-600">{new Date(sub.submitted_at).toLocaleString()}</span>
                </div>
              </div>
              <StatusBadge status={sub.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
