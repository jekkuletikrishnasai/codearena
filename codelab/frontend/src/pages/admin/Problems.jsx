import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Code2, Eye, EyeOff } from 'lucide-react';

const DiffBadge = ({ difficulty }) => {
  const c = { easy: 'text-emerald-400 bg-emerald-500/10', medium: 'text-yellow-400 bg-yellow-500/10', hard: 'text-red-400 bg-red-500/10' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-mono capitalize ${c[difficulty]}`}>{difficulty}</span>;
};

export default function AdminProblems() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => {
    api.get('/api/problems').then(res => setProblems(res.data.problems)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deleteProblem = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/problems/${id}`);
      toast.success('Problem deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = problems.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || p.difficulty === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Problems</h1>
          <p className="text-gray-400 mt-1">{problems.length} problems in the bank</p>
        </div>
        <Link to="/admin/problems/new" className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> New Problem
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search problems..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-sky-500"
        />
        {['all', 'easy', 'medium', 'hard'].map(d => (
          <button key={d} onClick={() => setFilter(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === d ? 'bg-sky-500 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'}`}>
            {d}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Problem</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Difficulty</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Test Cases</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submissions</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Languages</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-500">No problems found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-sky-500/10 rounded-lg flex items-center justify-center">
                        <Code2 size={15} className="text-sky-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{p.title}</div>
                        <div className="text-xs text-gray-500">by {p.creator_name || 'Admin'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><DiffBadge difficulty={p.difficulty} /></td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-300 font-mono">{p.test_case_count || 0}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-300 font-mono">{p.submission_count || 0}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(p.allowed_languages || []).slice(0, 3).map(l => (
                        <span key={l} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">{l}</span>
                      ))}
                      {(p.allowed_languages?.length || 0) > 3 && (
                        <span className="text-xs text-gray-500">+{p.allowed_languages.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/problems/${p.id}/edit`} className="p-1.5 text-gray-500 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors">
                        <Edit size={15} />
                      </Link>
                      <button onClick={() => deleteProblem(p.id, p.title)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
