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

  useEffect(() => {
    api.get('/api/submissions').then(res => setSubmissions(res.data.submissions)).finally(() => setLoading(false));
  }, []);

  const viewDetail = async (id) => {
    const res = await api.get(`/api/submissions/${id}`);
    setSelected(res.data.submission);
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
                    className={`cursor-pointer transition-colors ${selected?.id === s.id ? 'bg-sky-500/5' : 'hover:bg-gray-800/50'}`}>
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

      {selected && (
        <div className="w-80 flex-shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl sticky top-0 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Submission Detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
            </div>
            <div className="p-4 space-y-4 max-h-screen overflow-y-auto">
              <StatusBadge status={selected.status} />
              <div className="text-xs text-gray-500 font-mono">{selected.score}/{selected.max_score} test cases passed</div>
              <div>
                <div className="text-xs text-gray-500 mb-1.5">Your Code</div>
                <pre className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">{selected.code}</pre>
              </div>
              {selected.testCaseResults?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Test Results</div>
                  <div className="space-y-1.5">
                    {selected.testCaseResults.map((r, i) => (
                      <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg ${r.status === 'passed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        <span>{r.is_hidden ? '🔒 Hidden' : `Test #${i + 1}`}</span>
                        <span className="capitalize font-mono">{r.status}</span>
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
