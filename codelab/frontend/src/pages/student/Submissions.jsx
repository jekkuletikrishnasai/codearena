import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

const StatusBadge = ({ status }) => {
  const configs = {
    accepted: 'bg-emerald-500/20 text-emerald-400',
    wrong_answer: 'bg-red-500/20 text-red-400',
    time_limit_exceeded: 'bg-yellow-500/20 text-yellow-400',
    runtime_error: 'bg-orange-500/20 text-orange-400',
    compilation_error: 'bg-red-500/20 text-red-400',
    running: 'bg-blue-500/20 text-blue-400',
    pending: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-mono capitalize ${configs[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

export default function StudentSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.get('/api/submissions').then(res => setSubmissions(res.data.submissions)).finally(() => setLoading(false));
  }, []);

  const viewDetail = async (id) => {
    if (selected?.id === id) { setSelected(null); return; }
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/submissions/${id}`);
      setSelected(res.data.submission);
    } catch (e) {
      console.error('Failed to load submission detail', e);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="p-8 flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">My Submissions</h1>
          <p className="text-gray-400 mt-1">{submissions.length} total submissions</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr>
                  {['Problem', 'Language', 'Score', 'Status', 'Time', 'Submitted'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {submissions.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    No submissions yet. Start solving problems!
                  </td></tr>
                ) : submissions.map(s => (
                  <tr key={s.id} onClick={() => viewDetail(s.id)}
                    className={`cursor-pointer transition-colors ${selected?.id === s.id ? 'bg-sky-500/5 border-l-2 border-sky-500' : 'hover:bg-gray-800/50'}`}>
                    <td className="px-5 py-3">
                      <Link to={`/student/problems/${s.problem_id}`} onClick={e => e.stopPropagation()}
                        className="text-sm font-medium text-white hover:text-sky-400 transition-colors">
                        {s.problem_title}
                      </Link>
                    </td>
                    <td className="px-5 py-3"><span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{s.language}</span></td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-300">{s.score}/{s.max_score}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{s.execution_time_ms ? `${s.execution_time_ms}ms` : '-'}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{new Date(s.submitted_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {(selected || detailLoading) && (
        <div className="w-96 flex-shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl sticky top-6 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Submission Detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : selected && (
              <div className="p-4 space-y-4 max-h-[85vh] overflow-y-auto">

                {/* Status + Score */}
                <div className="flex items-center gap-3">
                  <StatusBadge status={selected.status} />
                  <span className="text-xs text-gray-500 font-mono">{selected.score}/{selected.max_score} passed</span>
                  {selected.execution_time_ms && <span className="text-xs text-gray-500 font-mono">{selected.execution_time_ms}ms</span>}
                </div>

                {/* Problem + Language */}
                <div className="text-xs text-gray-500">
                  <span className="text-gray-300 font-medium">{selected.problem_title}</span>
                  <span className="mx-2">·</span>
                  <span className="font-mono bg-gray-800 px-2 py-0.5 rounded text-gray-400">{selected.language}</span>
                </div>

                {/* Your Code */}
                <div>
                  <div className="text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wider">Your Code</div>
                  <pre className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap border border-gray-700">{selected.code}</pre>
                </div>

                {/* Test Results */}
                {selected.testCaseResults?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Test Results</div>
                    <div className="space-y-2">
                      {selected.testCaseResults.map((r, i) => (
                        <div key={i} className={`rounded-lg border text-xs ${r.status === 'passed' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                          <div className="flex items-center justify-between px-3 py-2">
                            <span className={r.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}>
                              {r.is_hidden ? '🔒 Hidden Test' : `Test Case #${i + 1}`}
                            </span>
                            <div className="flex items-center gap-2">
                              {r.execution_time_ms && <span className="text-gray-500 font-mono">{r.execution_time_ms}ms</span>}
                              <span className={`capitalize font-mono font-semibold ${r.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {r.status}
                              </span>
                            </div>
                          </div>

                          {/* Show details only for non-hidden, non-passed tests */}
                          {!r.is_hidden && r.status !== 'passed' && (
                            <div className="px-3 pb-3 space-y-1.5 border-t border-gray-700 pt-2 font-mono">
                              {r.input && (
                                <div>
                                  <span className="text-gray-500">Input: </span>
                                  <pre className="inline whitespace-pre-wrap text-gray-300">{r.input}</pre>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500">Expected: </span>
                                <pre className="inline whitespace-pre-wrap text-emerald-400">{r.expected_output}</pre>
                              </div>
                              <div>
                                <span className="text-gray-500">Got: </span>
                                <pre className="inline whitespace-pre-wrap text-red-400">{r.actual_output || '(no output)'}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
