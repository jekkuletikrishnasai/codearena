import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Eye, EyeOff, ArrowLeft, Save } from 'lucide-react';

const LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'c'];

const defaultForm = {
  title: '', description: '', difficulty: 'easy',
  timeLimitMs: 5000, memoryLimitMb: 256,
  allowedLanguages: ['python', 'javascript'],
  testCases: [{ input: '', expectedOutput: '', isHidden: false, points: 1 }],
};

export default function AdminProblemForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      api.get(`/api/problems/${id}`).then(res => {
        const p = res.data.problem;
        setForm({
          title: p.title, description: p.description,
          difficulty: p.difficulty, timeLimitMs: p.time_limit_ms,
          memoryLimitMb: p.memory_limit_mb,
          allowedLanguages: p.allowed_languages,
          testCases: p.testCases?.map(tc => ({
            id: tc.id, input: tc.input,
            expectedOutput: tc.expected_output,
            isHidden: tc.is_hidden, points: tc.points,
          })) || [{ input: '', expectedOutput: '', isHidden: false, points: 1 }],
        });
      }).finally(() => setFetching(false));
    }
  }, [id, isEdit]);

  const toggleLang = (lang) => {
    setForm(f => ({
      ...f,
      allowedLanguages: f.allowedLanguages.includes(lang)
        ? f.allowedLanguages.filter(l => l !== lang)
        : [...f.allowedLanguages, lang],
    }));
  };

  const addTestCase = () => setForm(f => ({
    ...f,
    testCases: [...f.testCases, { input: '', expectedOutput: '', isHidden: false, points: 1 }],
  }));

  const removeTestCase = (i) => setForm(f => ({
    ...f, testCases: f.testCases.filter((_, idx) => idx !== i),
  }));

  const updateTestCase = (i, field, value) => setForm(f => ({
    ...f,
    testCases: f.testCases.map((tc, idx) => idx === i ? { ...tc, [field]: value } : tc),
  }));

  const handleSubmit = async () => {
    if (!form.title || !form.description) return toast.error('Title and description required');
    if (form.allowedLanguages.length === 0) return toast.error('Select at least one language');
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/api/problems/${id}`, form);
        toast.success('Problem updated');
      } else {
        await api.post('/api/problems', form);
        toast.success('Problem created');
      }
      navigate('/admin/problems');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="p-8 flex justify-center">
      <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/admin/problems')} className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Problem' : 'Create Problem'}</h1>
          <p className="text-gray-400 mt-0.5">{isEdit ? 'Update problem details and test cases' : 'Add a new coding problem to the bank'}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500 text-sm"
                placeholder="e.g. Two Sum" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Description (Markdown supported)</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500 text-sm font-mono resize-y"
                placeholder="Describe the problem, constraints, and examples..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Difficulty</label>
                <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500 text-sm">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Time Limit (ms)</label>
                <input type="number" value={form.timeLimitMs} onChange={e => setForm({ ...form, timeLimitMs: parseInt(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Memory Limit (MB)</label>
                <input type="number" value={form.memoryLimitMb} onChange={e => setForm({ ...form, memoryLimitMb: parseInt(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500 text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Languages */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Allowed Languages</h2>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(lang => (
              <button key={lang} onClick={() => toggleLang(lang)}
                className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                  form.allowedLanguages.includes(lang)
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                    : 'bg-gray-800 text-gray-500 border border-gray-700 hover:border-gray-600'
                }`}>
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Test Cases */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Test Cases</h2>
            <button onClick={addTestCase} className="flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 transition-colors">
              <Plus size={15} /> Add Test Case
            </button>
          </div>
          <div className="space-y-4">
            {form.testCases.map((tc, i) => (
              <div key={i} className={`border rounded-xl p-4 ${tc.isHidden ? 'border-violet-500/30 bg-violet-500/5' : 'border-gray-700 bg-gray-800/50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">Test Case #{i + 1}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateTestCase(i, 'isHidden', !tc.isHidden)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors ${tc.isHidden ? 'bg-violet-500/20 text-violet-400' : 'bg-gray-700 text-gray-400 hover:text-gray-300'}`}>
                      {tc.isHidden ? <><EyeOff size={12} /> Hidden</> : <><Eye size={12} /> Visible</>}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Points:</span>
                      <input type="number" value={tc.points} min={1}
                        onChange={e => updateTestCase(i, 'points', parseInt(e.target.value))}
                        className="w-14 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-white text-center" />
                    </div>
                    {form.testCases.length > 1 && (
                      <button onClick={() => removeTestCase(i)} className="text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Input</label>
                    <textarea value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)}
                      rows={3} placeholder="stdin input..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Expected Output</label>
                    <textarea value={tc.expectedOutput} onChange={e => updateTestCase(i, 'expectedOutput', e.target.value)}
                      rows={3} placeholder="expected stdout..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-sky-500 resize-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={() => navigate('/admin/problems')}
            className="px-6 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            <Save size={15} /> {loading ? 'Saving...' : (isEdit ? 'Update Problem' : 'Create Problem')}
          </button>
        </div>
      </div>
    </div>
  );
}
