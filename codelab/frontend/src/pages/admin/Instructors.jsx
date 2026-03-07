import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Shield, Eye, EyeOff } from 'lucide-react';

export default function AdminInstructors() {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const load = () =>
    api.get('/api/users/admins')
       .then(r => setInstructors(r.data.admins || []))
       .catch(() => setInstructors([]))
       .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.fullName || !form.username || !form.email || !form.password)
      return toast.error('All fields required');
    if (form.password.length < 6)
      return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await api.post('/api/auth/create-admin', form);
      toast.success(`Instructor "${form.fullName}" created!`);
      setShowModal(false);
      setForm({ fullName: '', username: '', email: '', password: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create instructor');
    } finally { setSaving(false); }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Remove instructor "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/users/${id}`);
      toast.success('Instructor removed');
      load();
    } catch { toast.error('Failed to remove'); }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Instructors</h1>
          <p className="text-gray-400 mt-1">{instructors.length} instructor{instructors.length !== 1 ? 's' : ''} with admin access</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Add Instructor
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr>
                {['Instructor', 'Username', 'Email', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {instructors.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-500">No instructors yet. Add one above.</td></tr>
              ) : instructors.map(inst => (
                <tr key={inst.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                        <Shield size={14} className="text-violet-400" />
                      </div>
                      <span className="text-white font-medium">{inst.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-400 font-mono text-sm">@{inst.username}</td>
                  <td className="px-5 py-4 text-gray-400 text-sm">{inst.email}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => remove(inst.id, inst.full_name)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Shield size={16} className="text-violet-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Add Instructor</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Full Name',  key: 'fullName',  placeholder: 'Dr. John Smith',       type: 'text' },
                { label: 'Username',   key: 'username',  placeholder: 'johnsmith',             type: 'text' },
                { label: 'Email',      key: 'email',     placeholder: 'john@college.edu',      type: 'email' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">{label}</label>
                  <input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              ))}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                    placeholder="Min. 6 characters"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 pr-10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3 text-xs text-violet-300">
                <Shield size={12} className="inline mr-1" />
                Instructors get full admin access — they can create problems, assignments, and view all student data.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={create} disabled={saving}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Shield size={14} />
                {saving ? 'Creating…' : 'Create Instructor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
