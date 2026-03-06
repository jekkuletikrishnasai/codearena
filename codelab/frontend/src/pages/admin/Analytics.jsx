import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
        <p className="text-xs text-gray-400">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-mono" style={{ color: p.color }}>{p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/analytics/dashboard').then(res => setData(res.data)).finally(() => setLoading(false));
  }, []);

  const downloadReport = async () => {
    try {
      const res = await api.get('/api/analytics/report', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'codelab-report.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch { toast.error('Failed to download report'); }
  };

  if (loading) return (
    <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>
  );

  const statusData = (data?.submissionsByStatus || []).map(s => ({
    name: s.status.replace(/_/g, ' '),
    value: parseInt(s.count),
  }));

  const langData = (data?.submissionsByLanguage || []).map(s => ({
    name: s.language, count: parseInt(s.count),
  }));

  const dailyData = (data?.submissionsByDay || []).map(d => ({
    date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    count: parseInt(d.count),
  }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Classroom performance overview</p>
        </div>
        <button onClick={downloadReport}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Submissions over time */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">Submissions (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Submission status breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">Submission Results</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {statusData.slice(0, 6).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }}></div>
                    <span className="text-gray-400 capitalize">{s.name}</span>
                  </div>
                  <span className="text-gray-300 font-mono">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Language breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">Language Usage</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={langData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top students */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Award size={14} /> Top Students
          </h3>
          <div className="space-y-3">
            {(data?.topStudents || []).slice(0, 6).map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{s.full_name}</div>
                  <div className="text-xs text-gray-500 font-mono">@{s.username}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-emerald-400">{s.solved} solved</div>
                  <div className="text-xs text-gray-500">{s.attempts} attempts</div>
                </div>
              </div>
            ))}
            {(data?.topStudents?.length || 0) === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No student data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Hardest problems */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
          <AlertTriangle size={14} /> Hardest Problems (Lowest Acceptance Rate)
        </h3>
        <div className="space-y-3">
          {(data?.hardestProblems || []).map((p, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-white truncate">{p.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono capitalize ${
                    p.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' :
                    p.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>{p.difficulty}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${p.acceptance_rate || 0}%` }}></div>
                </div>
              </div>
              <div className="text-right text-xs w-24 flex-shrink-0">
                <div className="text-white font-mono">{p.acceptance_rate || 0}%</div>
                <div className="text-gray-500">{p.total_attempts} attempts</div>
              </div>
            </div>
          ))}
          {(data?.hardestProblems?.length || 0) === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No submission data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
