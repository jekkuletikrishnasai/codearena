import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Terminal, Eye, EyeOff, UserPlus, LogIn, CheckCircle } from 'lucide-react';

// ── Shared left panel ────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden lg:flex w-1/2 bg-gray-900 border-r border-gray-800 flex-col items-center justify-center p-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-violet-500/5" />
      <div className="relative z-10 text-center">
        <div className="w-20 h-20 bg-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-sky-500/20">
          <Terminal size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white font-mono mb-3">CodeLab</h1>
        <p className="text-gray-400 text-lg mb-8">Programming Assessment Platform</p>
        <div className="space-y-3 text-left max-w-xs">
          {[
            'Real-time code execution',
            'Automated test case evaluation',
            'Detailed analytics & reports',
            'Multi-language support',
          ].map(f => (
            <div key={f} className="flex items-center gap-3 text-sm text-gray-400">
              <div className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
              {f}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-8 left-8 right-8 bg-gray-800/50 rounded-xl p-4 font-mono text-xs text-gray-500 border border-gray-700/50">
        <div><span className="text-violet-400">def</span> <span className="text-sky-400">solve</span>(n):</div>
        <div className="pl-4"><span className="text-gray-500"># Write your solution here</span></div>
        <div className="pl-4"><span className="text-violet-400">return</span> n * (n + <span className="text-orange-400">1</span>) // <span className="text-orange-400">2</span></div>
      </div>
    </div>
  );
}

// ── Mobile logo ──────────────────────────────────────────────────────────────
function MobileLogo() {
  return (
    <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
      <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center">
        <Terminal size={20} className="text-white" />
      </div>
      <span className="text-xl font-bold text-white font-mono">CodeLab</span>
    </div>
  );
}

// ── Reusable input ───────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, suffix }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono pr-12"
        />
        {suffix && <div className="absolute right-4 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </div>
  );
}

// ── Password strength bar ────────────────────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];
  const textColors = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-emerald-400'];
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-gray-700'}`} />
        ))}
      </div>
      <p className={`text-xs ${textColors[score]}`}>{labels[score]}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════
function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      toast.success(`Welcome back, ${user.fullName}!`);
      navigate(user.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
      <p className="text-gray-400 mb-8">Sign in to your CodeLab account</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="Username or Email"
          value={form.username}
          onChange={set('username')}
          placeholder="username or email"
        />
        <Field
          label="Password"
          type={showPass ? 'text' : 'password'}
          value={form.password}
          onChange={set('password')}
          placeholder="••••••••"
          suffix={
            <button type="button" onClick={() => setShowPass(p => !p)} className="text-gray-500 hover:text-gray-300 transition-colors">
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <LogIn size={17} />
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {/* Demo accounts */}
      <div className="mt-6 p-4 bg-gray-900 rounded-xl border border-gray-800">
        <p className="text-xs text-gray-500 mb-3 font-mono uppercase tracking-wider">Demo Accounts</p>
        <div className="space-y-2">
          <button
            onClick={() => setForm({ username: 'admin', password: 'admin123' })}
            className="w-full text-left text-xs bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 px-3 py-2 rounded-lg transition-colors font-mono"
          >
            👨‍🏫 Instructor — admin / admin123
          </button>
          <button
            onClick={() => setForm({ username: 'alice', password: 'student123' })}
            className="w-full text-left text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 px-3 py-2 rounded-lg transition-colors font-mono"
          >
            👩‍💻 Student — alice / student123
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        New student?{' '}
        <button onClick={onSwitch} className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
          Create an account
        </button>
      </p>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REGISTER
// ══════════════════════════════════════════════════════════════════════════════
function RegisterForm({ onSwitch }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    if (!form.fullName.trim()) return 'Full name is required';
    if (form.username.length < 3) return 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return 'Username can only contain letters, numbers, and underscores';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);

    setLoading(true);
    try {
      await api.post('/register', {
        username: form.username.toLowerCase(),
        email: form.email.toLowerCase(),
        password: form.password,
        fullName: form.fullName,
        role: 'student',
      });
      setDone(true);
      toast.success('Account created! Signing you in…');
      // auto-login
      await login(form.username, form.password);
      navigate('/student');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Account Created!</h3>
        <p className="text-gray-400 text-sm">Redirecting you to your dashboard…</p>
      </div>
    );
  }

  const passwordsMatch = form.confirmPassword && form.password === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword && form.password !== form.confirmPassword;

  return (
    <>
      <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
      <p className="text-gray-400 mb-6">Join CodeLab as a student</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full name */}
        <Field
          label="Full Name"
          value={form.fullName}
          onChange={set('fullName')}
          placeholder="Jane Smith"
        />

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-mono text-sm">@</span>
            <input
              type="text"
              value={form.username}
              onChange={set('username')}
              placeholder="janesmith"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono"
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">Letters, numbers, underscores only</p>
        </div>

        {/* Email */}
        <Field
          label="Email Address"
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="jane@university.edu"
        />

        {/* Password */}
        <div>
          <Field
            label="Password"
            type={showPass ? 'text' : 'password'}
            value={form.password}
            onChange={set('password')}
            placeholder="Min. 6 characters"
            suffix={
              <button type="button" onClick={() => setShowPass(p => !p)} className="text-gray-500 hover:text-gray-300 transition-colors">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <PasswordStrength password={form.password} />
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              placeholder="Re-enter password"
              required
              className={`w-full bg-gray-900 border rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-colors font-mono ${
                passwordsMismatch
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : passwordsMatch
                  ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500'
                  : 'border-gray-700 focus:border-sky-500 focus:ring-sky-500'
              }`}
            />
            <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {passwordsMismatch && <p className="text-xs text-red-400 mt-1">Passwords do not match</p>}
          {passwordsMatch && <p className="text-xs text-emerald-400 mt-1">Passwords match ✓</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
        >
          <UserPlus size={17} />
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <button onClick={onSwitch} className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
          Sign in
        </button>
      </p>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE SHELL
// ══════════════════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <LeftPanel />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <MobileLogo />

          {/* Tab switcher */}
          <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-8">
            {[['login', 'Sign In', LogIn], ['register', 'Sign Up', UserPlus]].map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === key
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="transition-all duration-200">
            {tab === 'login'
              ? <LoginForm onSwitch={() => setTab('register')} />
              : <RegisterForm onSwitch={() => setTab('login')} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}