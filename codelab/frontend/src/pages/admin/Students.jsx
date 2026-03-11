import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Save, AlertTriangle } from 'lucide-react';

export default function AdminStudents() {
  const [students, setStudents]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [showBulk, setShowBulk]         = useState(false);
  const [bulkPattern, setBulkPattern]   = useState('loadtest_');
  const [bulkPreview, setBulkPreview]   = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [form, setForm] = useState({ username: '', email: '', password: '', fullName: '' });

  const load = () => api.get('/api/users/students')
    .then(r => setStudents(r.data.students))
    .finally(() => setLoading(false));

  useEffect(load, []);

  useEffect(() => {
    if (!bulkPattern.trim()) { setBulkPreview([]); return; }
    const matches = students.filter(s =>
      s.username.toLowerCase().includes(bulkPattern.toLowerCase()) ||
      s.full_name.toLowerCase().includes(bulkPattern.toLowerCase()) ||
      s.email.toLowerCase().includes(bulkPattern.toLowerCase())
    );
    setBulkPreview(matches);
  }, [bulkPattern, students]);

  const createStudent = async () => {
    if (!form.username || !form.email || !form.password || !form.fullName)
      return toast.error('All fields required');
    try {
      await api.post('/api/users/students', form);
      toast.success('Student created');
      setShowModal(false);
      setForm({ username: '', email: '', password: '', fullName: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const deleteStudent = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    await api.delete(`/api/users/${id}`);
    toast.success('Student removed');
    load();
  };

  const bulkDelete = async () => {
    if (bulkPreview.length === 0) return;
    if (!window.confirm(`Permanently delete ${bulkPreview.length} students matching "${bulkPattern}"? This cannot be undone.`)) return;

    setBulkDeleting(true);
    setBulkProgress(0);
    let deleted = 0;
    let failed = 0;

    for (const s of bulkPreview) {
      try {
        await api.delete(`/api/users/${s.id}`);
        deleted++;
      } catch { failed++; }
      setBulkProgress(Math.round(((deleted + failed) / bulkPreview.length) * 100));
      await new Promise(r => setTimeout(r, 50)); // avoid overwhelming backend
    }

    setBulkDeleting(false);
    toast.success(`Deleted ${deleted} students${failed > 0 ? `, ${failed} failed` : ''}`);
    setShowBulk(false);
    setBulkPattern('loadtest_');
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-gray-400 mt-1">{students.length} enrolled students</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Trash2 size={15} /> Bulk Delete
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                {['Student', 'Email', 'Submissions', 'Accepted', 'Problems Solved', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {students.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-500">No students yet</td></tr>
              ) : students.map(s => (
                <tr key={s.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-sky-500/10 rounded-full flex items-center justify-center text-sky-400 font-semibold text-sm">
                        {s.full_name?.[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{s.full_name}</div>
                        <div className="text-xs text-gray-500 font-mono">@{s.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-400">{s.email}</td>
                  <td className="px-5 py-4 text-sm font-mono text-gray-300">{s.total_submissions || 0}</td>
                  <td className="px-5 py-4 text-sm font-mono text-emerald-400">{s.accepted_submissions || 0}</td>
                  <td className="px-5 py-4 text-sm font-mono text-sky-400">{s.problems_solved || 0}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => deleteStudent(s.id, s.full_name)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-white">Add Student</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: 'fullName', label: 'Full Name', placeholder: 'Jane Smith' },
                { key: 'username', label: 'Username',  placeholder: 'janesmith' },
                { key: 'email',    label: 'Email',     placeholder: 'jane@student.edu', type: 'email' },
                { key: 'password', label: 'Password',  placeholder: '••••••••', type: 'password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm text-gray-400 mb-1.5">{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
                <button onClick={createStudent} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-sm font-medium transition-colors">
                  <Save size={14} /> Add Student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE MODAL */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-lg">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-400" />
                <h2 className="font-semibold text-white">Bulk Delete Students</h2>
              </div>
              {!bulkDeleting && (
                <button onClick={() => setShowBulk(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Match pattern <span className="text-gray-600">(username, name, or email contains)</span>
                </label>
                <input
                  value={bulkPattern}
                  onChange={e => setBulkPattern(e.target.value)}
                  disabled={bulkDeleting}
                  placeholder="e.g. loadtest_"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-red-500 disabled:opacity-50"
                />
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                {bulkPreview.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">No students match this pattern</p>
                ) : (
                  <>
                    <p className="text-xs text-red-400 font-semibold mb-2 uppercase tracking-wider">
                      {bulkPreview.length} students will be deleted:
                    </p>
                    {bulkPreview.slice(0, 8).map(s => (
                      <div key={s.id} className="text-xs text-gray-400 font-mono py-0.5">
                        @{s.username} — {s.email}
                      </div>
                    ))}
                    {bulkPreview.length > 8 && (
                      <div className="text-xs text-gray-600 mt-1">...and {bulkPreview.length - 8} more</div>
                    )}
                  </>
                )}
              </div>

              {bulkDeleting && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Deleting students…</span>
                    <span className="font-mono">{bulkProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${bulkProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowBulk(false)} disabled={bulkDeleting}
                  className="flex-1 py-2.5 text-gray-400 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-sm transition-colors">
                  Cancel
                </button>
                <button onClick={bulkDelete}
                  disabled={bulkPreview.length === 0 || bulkDeleting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                  <Trash2 size={14} />
                  {bulkDeleting ? `Deleting… ${bulkProgress}%` : `Delete ${bulkPreview.length} Students`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
