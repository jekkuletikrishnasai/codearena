import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, Clock, Code2, ChevronRight, Trophy, Target } from 'lucide-react';

const DiffBadge = ({ d }) => {
  const c = { easy: 'text-emerald-400 bg-emerald-500/10', medium: 'text-yellow-400 bg-yellow-500/10', hard: 'text-red-400 bg-red-500/10' };
  return <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-mono ${c[d]}`}>{d}</span>;
};

const StatusBadge = ({ status }) => {
  if (!status) return null;
  const c = {
    accepted: 'text-emerald-400 bg-emerald-500/10',
    wrong_answer: 'text-red-400 bg-red-500/10',
    running: 'text-blue-400 bg-blue-500/10',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${c[status] || 'text-gray-400 bg-gray-500/10'}`}>{status?.replace(/_/g, ' ')}</span>;
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/api/assignments'), api.get('/api/problems')])
      .then(([a, p]) => {
        setAssignments(a.data.assignments);
        setProblems(p.data.problems);
      }).finally(() => setLoading(false));
  }, []);

  const solved = problems.filter(p => p.my_best_status === 'accepted').length;
  const attempted = problems.filter(p => (p.my_attempts || 0) > 0).length;

  if (loading) return (
    <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Hello, {user?.fullName?.split(' ')[0]} 👋</h1>
        <p className="text-gray-400 mt-1">Ready to code? Here are your assignments.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Problems Solved', value: solved, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Attempted', value: attempted, icon: Target, color: 'text-sky-400', bg: 'bg-sky-500/10' },
          { label: 'Assignments', value: assignments.length, icon: Trophy, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{label}</span>
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={16} className={color} />
              </div>
            </div>
            <div className="text-3xl font-bold text-white font-mono">{value}</div>
          </div>
        ))}
      </div>

      {/* Assignments */}
      {assignments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Your Assignments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map(a => (
              <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-2">{a.title}</h3>
                {a.description && <p className="text-sm text-gray-500 mb-3">{a.description}</p>}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Code2 size={11} /> {a.problem_count || 0} problems</span>
                  {a.due_date && <span className="flex items-center gap-1"><Clock size={11} /> Due {new Date(a.due_date).toLocaleDateString()}</span>}
                  {a.solved_count > 0 && <span className="text-emerald-400">{a.solved_count} solved</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Problems */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Problems to Solve</h2>
        {problems.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-gray-400">No problems assigned yet.</p>
            <p className="text-gray-600 text-sm mt-1">Your instructor hasn't assigned any problems to you yet.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-800">
              {problems.map(p => (
                <Link key={p.id} to={`/student/problems/${p.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    p.my_best_status === 'accepted' ? 'bg-emerald-500/20' : 'bg-gray-800'
                  }`}>
                    {p.my_best_status === 'accepted'
                      ? <CheckCircle size={16} className="text-emerald-400" />
                      : <Code2 size={16} className="text-gray-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{p.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DiffBadge d={p.difficulty} />
                      {p.my_best_status && <StatusBadge status={p.my_best_status} />}
                      {(p.my_attempts || 0) > 0 && (
                        <span className="text-xs text-gray-600">{p.my_attempts} attempt{p.my_attempts !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
