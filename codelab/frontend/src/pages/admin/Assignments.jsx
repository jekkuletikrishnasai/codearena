import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit, Calendar, Users, Code2, X, Save } from 'lucide-react';

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [problems, setProblems] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', problemIds: [], studentIds: [] });

  const load = () => {
    Promise.all([
      api.get('/assignments'),
      api.get('/problems'),
      api.get('/users/students'),
    ]).then(([a, p, s]) => {
      setAssignments(a.data.assignments);
      setProblems(p.data.problems);
      setStudents(s.data.students);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm({ title: '', description: '', dueDate: '', problemIds: [], studentIds: [] });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = async (id) => {
    const res = await api.get(`/assignments/${id}`);
    const a = res.data.assignment;
    setForm({
      title: a.title,
      description: a.description || '',
      dueDate: a.due_date ? a.due_date.split('T')[0] : '',
      problemIds: a.problems?.map(p => p.id) || [],
      studentIds: a.students?.map(s => s.id) || [],
    });
    setEditingId(id);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title) return toast.error('Title required');
    try {
      if (editingId) {
        await api.put(`/assignments/${editingId}`, form);
        toast.success('Assignment updated');
      } else {
        await api.post('/assignments', form);
        toast.success('Assignment created');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Failed to save'); }
  };

  const deleteAssignment = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await api.delete(`/assignments/${id}`);
    toast.success('Deleted');
    load();
  };

  const toggleId = (list, id) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Assignments</h1>
          <p className="text-gray-400 mt-1">{assignments.length} assignments</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> New Assignment
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map(a => (
            <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-white">{a.title}</h3>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(a.id)} className="p-1.5 text-gray-500 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => deleteAssignment(a.id, a.title)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {a.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{a.description}</p>}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-gray-500">
                  <Code2 size={12} /><span>{a.problem_count || 0} problems</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Users size={12} /><span>{a.student_count || 0} students</span>
                </div>
                {a.due_date && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar size={12} />
                    <span>{new Date(a.due_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {assignments.length === 0 && (
            <div className="col-span-3 py-16 text-center">
              <div className="text-gray-600 text-5xl mb-4">📋</div>
              <p className="text-gray-500">No assignments yet. Create your first one!</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900">
              <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit' : 'New'} Assignment</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
                  placeholder="Assignment title" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Problems ({form.problemIds.length} selected)</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {problems.map(p => (
                    <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 cursor-pointer">
                      <input type="checkbox" checked={form.problemIds.includes(p.id)}
                        onChange={() => setForm({ ...form, problemIds: toggleId(form.problemIds, p.id) })}
                        className="rounded border-gray-600 bg-gray-700 text-sky-500" />
                      <span className="text-sm text-gray-300 flex-1">{p.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono capitalize ${
                        p.difficulty === 'easy' ? 'text-emerald-400 bg-emerald-500/10' :
                        p.difficulty === 'medium' ? 'text-yellow-400 bg-yellow-500/10' : 'text-red-400 bg-red-500/10'
                      }`}>{p.difficulty}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Students ({form.studentIds.length} selected)</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 cursor-pointer">
                      <input type="checkbox" checked={form.studentIds.includes(s.id)}
                        onChange={() => setForm({ ...form, studentIds: toggleId(form.studentIds, s.id) })}
                        className="rounded border-gray-600 bg-gray-700 text-sky-500" />
                      <span className="text-sm text-gray-300 flex-1">{s.full_name}</span>
                      <span className="text-xs text-gray-500 font-mono">@{s.username}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="px-5 py-2 text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
                <button onClick={save} className="flex items-center gap-2 px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-sm font-medium transition-colors">
                  <Save size={15} /> {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
