import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Terminal, Eye, EyeOff, Code2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      toast.success(`Welcome back, ${user.fullName}!`);
      navigate(user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (username, password) => setForm({ username, password });

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gray-900 border-r border-gray-800 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-violet-500/5"></div>
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-sky-500/20">
            <Terminal size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white font-mono mb-3">CodeLab</h1>
          <p className="text-gray-400 text-lg mb-8">Programming Assessment Platform</p>
          <div className="space-y-3 text-left max-w-xs">
            {['Real-time code execution', 'Automated test case evaluation', 'Detailed analytics & reports', 'Multi-language support'].map(f => (
              <div key={f} className="flex items-center gap-3 text-sm text-gray-400">
                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full"></div>
                {f}
              </div>
            ))}
          </div>
        </div>
        {/* Decorative code */}
        <div className="absolute bottom-8 left-8 right-8 bg-gray-800/50 rounded-xl p-4 font-mono text-xs text-gray-500 border border-gray-700/50">
          <div><span className="text-violet-400">def</span> <span className="text-sky-400">solve</span>(n):</div>
          <div className="pl-4"><span className="text-gray-500"># Write your solution here</span></div>
          <div className="pl-4"><span className="text-violet-400">return</span> n * (n + <span className="text-orange-400">1</span>) // <span className="text-orange-400">2</span></div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center">
              <Terminal size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white font-mono">CodeLab</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Sign in</h2>
          <p className="text-gray-400 mb-8">Enter your credentials to access the platform</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Username or Email</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono"
                placeholder="admin or alice"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Quick login for demo */}
          <div className="mt-8 p-4 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-xs text-gray-500 mb-3 font-mono uppercase tracking-wider">Demo Accounts</p>
            <div className="space-y-2">
              <button onClick={() => quickLogin('admin', 'admin123')} className="w-full text-left text-xs bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 px-3 py-2 rounded-lg transition-colors font-mono">
                👨‍🏫 Instructor — admin / admin123
              </button>
              <button onClick={() => quickLogin('alice', 'student123')} className="w-full text-left text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-3 py-2 rounded-lg transition-colors font-mono">
                👩‍💻 Student — alice / student123
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
