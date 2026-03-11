import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { RefreshCw, Eye, ChevronRight } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const configs = {
    accepted: { cls: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
    wrong_answer: { cls: 'bg-red-500/20 text-red-400', dot: 'bg-red-400' },
    time_limit_exceeded: { cls: 'bg-yellow-500/20 text-yellow-400', dot: 'bg-yellow-400' },
    runtime_error: { cls: 'bg-orange-500/20 text-orange-400', dot: 'bg-orange-400' },
    compilation_error: { cls: 'bg-orange-500/20 text-orange-400', dot: 'bg-orange-400' },
    running: { cls: 'bg-blue-500/20 text-blue-400', dot: 'bg-blue-400 animate-pulse' },
    pending: { cls: 'bg-gray-500/20 text-gray-400', dot: 'bg-gray-400' },
  };
  const c = configs[status] || configs.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-mono ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    api.get('/submissions').then(res => setSubmissions(res.data.submissions)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const viewSubmission = async (id) => {
    const res = await api.get(`/submissions/${id}`);
    setSelected(res.data.submission);
  };

  const filtered = filter === 'all' ? submissions : submissions.filter(s => s.status === filter);

  return (
    <div className="p-8 flex gap-6 h-full">
      {/* Left: submissions list */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Submissions</h1>
            <p className="text-gray-400 mt-1">{submissions.length} total submissions</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {['all', 'accepted', 'wrong_answer', 'runtime_error', 'compilation_error', 'running', 'pending'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-colors ${
                filter === s ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:border-gray-600'
              }`}>{s.replace(/_/g, ' ')}</button>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No submissions found</div>
            ) : filtered.map(sub => (
              <div key={sub.id}
                onClick={() => viewSubmission(sub.id)}
                className={`p-4 cursor-pointer transition-colors ${selected?.id === sub.id ? 'bg-sky-500/5 border-l-2 border-sky-500' : 'hover:bg-gray-800/50'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold text-sky-400 flex-shrink-0">
                    {sub.student_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white">{sub.student_name}</span>
                      <span className="text-gray-600 text-xs">@{sub.username}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded">{sub.language}</span>
                      <span>·</span>
                      <span className="truncate">{sub.problem_title}</span>
                      <span>·</span>
                      <span>{new Date(sub.submitted_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={sub.status} />
                    <span className="text-xs text-gray-500 font-mono">{sub.score}/{sub.max_score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: submission detail */}
      {selected && (
        <div className="w-96 flex-shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl sticky top-0 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Submission Detail</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{selected.id?.slice(0, 8)}...</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
            </div>
            <div className="p-4 space-y-4 max-h-screen overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-gray-500 mb-0.5">Student</div>
                  <div className="text-white font-medium">{selected.student_name}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-gray-500 mb-0.5">Language</div>
                  <div className="text-sky-400 font-mono">{selected.language}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-gray-500 mb-0.5">Score</div>
                  <div className="text-white font-mono">{selected.score}/{selected.max_score}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-gray-500 mb-0.5">Time</div>
                  <div className="text-white font-mono">{selected.execution_time_ms || '-'}ms</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-2">Status</div>
                <StatusBadge status={selected.status} />
              </div>

              {/* Code */}
              <div>
                <div className="text-xs text-gray-500 mb-2">Code</div>
                <pre className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {selected.code}
                </pre>
              </div>

              {/* Test results */}
              {selected.testCaseResults?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Test Cases ({selected.testCaseResults.length})</div>
                  <div className="space-y-2">
                    {selected.testCaseResults.map((r, i) => (
                      <div key={i} className={`rounded-lg p-3 text-xs ${r.status === 'passed' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                        <div className="flex justify-between mb-1">
                          <span className={r.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}>
                            {r.is_hidden ? '🔒 Hidden' : `Test #${i + 1}`} — {r.status}
                          </span>
                          <span className="text-gray-500 font-mono">{r.execution_time_ms}ms</span>
                        </div>
                        {!r.is_hidden && r.status !== 'passed' && (
                          <div className="font-mono text-gray-400 space-y-0.5">
                            <div>Input: <span className="text-gray-300">{r.input?.substring(0, 40)}</span></div>
                            <div>Expected: <span className="text-emerald-400">{r.expected_output?.substring(0, 40)}</span></div>
                            <div>Got: <span className="text-red-400">{r.actual_output?.substring(0, 40)}</span></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
