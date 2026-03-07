import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Terminal, Eye, EyeOff, UserPlus, LogIn, CheckCircle, Shield, Code2, BarChart3, Zap } from 'lucide-react';

// ── Left Panel ────────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden lg:flex w-1/2 flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0800 0%, #110e00 40%, #0d0a00 70%, #080600 100%)' }}>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `linear-gradient(rgba(212,170,0,1) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(212,170,0,1) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      {/* Radial glow */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(212,170,0,0.07) 0%, transparent 70%)',
      }} />

      {/* Corner glows */}
      <div className="absolute top-0 left-0 w-40 h-40" style={{
        background: 'radial-gradient(circle at 0% 0%, rgba(212,170,0,0.1) 0%, transparent 70%)',
      }} />
      <div className="absolute bottom-0 right-0 w-40 h-40" style={{
        background: 'radial-gradient(circle at 100% 100%, rgba(212,170,0,0.08) 0%, transparent 70%)',
      }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-12 w-full">

        {/* Logo */}
        <div className="mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: 'linear-gradient(135deg, #D4AA00, #A07800)',
              boxShadow: '0 8px 32px rgba(212,170,0,0.35)',
            }}>
            <Terminal size={38} color="#0a0800" strokeWidth={2.5} />
          </div>
          <h1 className="text-5xl font-black tracking-widest mb-2"
            style={{ fontFamily: 'Georgia, serif', color: '#D4AA00', textShadow: '0 0 40px rgba(212,170,0,0.3)' }}>
            CODELAB
          </h1>
          <div className="w-20 h-px mx-auto mb-3"
            style={{ background: 'linear-gradient(90deg, transparent, #D4AA00, transparent)' }} />
          <p className="text-xs tracking-[0.3em]" style={{ color: 'rgba(212,170,0,0.45)' }}>
            PROGRAMMING ASSESSMENT PLATFORM
          </p>
        </div>

        {/* Features */}
        <div className="w-full max-w-xs space-y-3 mb-10">
          {[
            [Zap,       'Real-time code execution'],
            [Code2,     'Automated test evaluation'],
            [BarChart3, 'Detailed analytics & reports'],
            [Shield,    'Multi-language support'],
          ].map(([Icon, text]) => (
            <div key={text} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(212,170,0,0.05)', border: '1px solid rgba(212,170,0,0.1)' }}>
              <Icon size={15} style={{ color: '#D4AA00', flexShrink: 0 }} />
              <span style={{ color: 'rgba(212,170,0,0.7)', letterSpacing: '0.03em' }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Code snippet */}
        <div className="w-full max-w-xs rounded-xl p-4 text-left font-mono text-xs"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(212,170,0,0.12)' }}>
          <div className="flex gap-1.5 mb-3">
            {['#ff5f57', '#febc2e', '#28c840'].map(c => (
              <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div style={{ color: 'rgba(212,170,0,0.5)' }}>
            <span style={{ color: '#a78bfa' }}>def </span>
            <span style={{ color: '#D4AA00' }}>solve</span>(n):
          </div>
          <div className="pl-4" style={{ color: 'rgba(212,170,0,0.3)' }}># Write your solution</div>
          <div className="pl-4" style={{ color: 'rgba(212,170,0,0.5)' }}>
            <span style={{ color: '#a78bfa' }}>return </span>
            n * (n + <span style={{ color: '#fb923c' }}>1</span>) // <span style={{ color: '#fb923c' }}>2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Logo ───────────────────────────────────────────────────────────────
function MobileLogo() {
  return (
    <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #D4AA00, #A07800)' }}>
        <Terminal size={20} color="#0a0800" strokeWidth={2.5} />
      </div>
      <span className="text-xl font-black tracking-widest"
        style={{ fontFamily: 'Georgia, serif', color: '#D4AA00' }}>
        CODELAB
      </span>
    </div>
  );
}

// ── Input Field ───────────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, suffix }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 tracking-widest"
        style={{ color: 'rgba(212,170,0,0.55)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-xl px-4 py-3 text-sm pr-12 outline-none transition-all duration-200 font-mono"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${focused ? 'rgba(212,170,0,0.6)' : 'rgba(212,170,0,0.15)'}`,
            color: '#e5e5e5',
            boxShadow: focused ? '0 0 0 3px rgba(212,170,0,0.06)' : 'none',
          }}
        />
        {suffix && <div className="absolute right-4 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </div>
  );
}

// ── Password Strength ─────────────────────────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-0.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? colors[score] : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[score] }}>{labels[score]}</p>
    </div>
  );
}

// ── Gold Button ───────────────────────────────────────────────────────────────
function GoldButton({ loading, label, loadingLabel, icon: Icon }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-xl font-black text-sm tracking-widest flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 relative overflow-hidden group"
      style={{
        background: 'linear-gradient(135deg, #D4AA00, #A07800)',
        color: '#0a0800',
        boxShadow: '0 4px 20px rgba(212,170,0,0.3)',
        fontFamily: 'Georgia, serif',
      }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: 'linear-gradient(135deg, #E8C000, #B08800)' }} />
      <Icon size={16} className="relative z-10" />
      <span className="relative z-10">{loading ? loadingLabel : label}</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN FORM
// ══════════════════════════════════════════════════════════════════════════════
function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]  = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

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
      <div className="mb-7">
        <h2 className="text-2xl font-black tracking-wide mb-1"
          style={{ color: '#D4AA00', fontFamily: 'Georgia, serif' }}>
          Welcome back
        </h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Sign in to your CodeLab account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="USERNAME OR EMAIL" value={form.username}
          onChange={set('username')} placeholder="username or email" />
        <Field label="PASSWORD" type={showPass ? 'text' : 'password'}
          value={form.password} onChange={set('password')} placeholder="••••••••"
          suffix={
            <button type="button" onClick={() => setShowPass(p => !p)}
              style={{ color: 'rgba(212,170,0,0.45)' }}
              className="hover:opacity-80 transition-opacity">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          } />
        <GoldButton loading={loading} label="Sign In" loadingLabel="Signing in…" icon={LogIn} />
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
        New student?{' '}
        <button onClick={onSwitch} className="font-semibold hover:opacity-80 transition-opacity"
          style={{ color: '#D4AA00' }}>
          Create an account
        </button>
      </p>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REGISTER FORM
// ══════════════════════════════════════════════════════════════════════════════
function RegisterForm({ onSwitch }) {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    if (!form.fullName.trim())                            return 'Full name is required';
    if (form.username.length < 3)                         return 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(form.username))          return 'Username: letters, numbers, underscores only';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))  return 'Enter a valid email';
    if (form.password.length < 6)                         return 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword)           return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);
    setLoading(true);
    try {
      await api.post('/auth/register', {
        username: form.username.toLowerCase(),
        email:    form.email.toLowerCase(),
        password: form.password,
        fullName: form.fullName,
        role:     'student',
      });
      setDone(true);
      toast.success('Account created! Signing you in…');
      await login(form.username, form.password);
      navigate('/student');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="text-center py-10">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(212,170,0,0.1)', border: '1px solid rgba(212,170,0,0.3)' }}>
        <CheckCircle size={32} style={{ color: '#D4AA00' }} />
      </div>
      <h3 className="text-xl font-black tracking-wide mb-2"
        style={{ color: '#D4AA00', fontFamily: 'Georgia, serif' }}>
        Account Created!
      </h3>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Redirecting to your dashboard…
      </p>
    </div>
  );

  const match    = form.confirmPassword && form.password === form.confirmPassword;
  const mismatch = form.confirmPassword && form.password !== form.confirmPassword;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-wide mb-1"
          style={{ color: '#D4AA00', fontFamily: 'Georgia, serif' }}>
          Create account
        </h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Join CodeLab as a student
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="FULL NAME" value={form.fullName} onChange={set('fullName')} placeholder="Jane Smith" />

        <div>
          <label className="block text-xs font-semibold mb-1.5 tracking-widest"
            style={{ color: 'rgba(212,170,0,0.55)' }}>USERNAME</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono"
              style={{ color: 'rgba(212,170,0,0.4)' }}>@</span>
            <input type="text" value={form.username} onChange={set('username')}
              placeholder="janesmith" required
              className="w-full rounded-xl pl-8 pr-4 py-3 text-sm outline-none font-mono transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,170,0,0.15)', color: '#e5e5e5' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(212,170,0,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(212,170,0,0.06)'; }}
              onBlur={e  => { e.target.style.borderColor = 'rgba(212,170,0,0.15)'; e.target.style.boxShadow = 'none'; }} />
          </div>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Letters, numbers, underscores only</p>
        </div>

        <Field label="EMAIL ADDRESS" type="email" value={form.email}
          onChange={set('email')} placeholder="jane@university.edu" />

        <div>
          <Field label="PASSWORD" type={showPass ? 'text' : 'password'}
            value={form.password} onChange={set('password')} placeholder="Min. 6 characters"
            suffix={
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ color: 'rgba(212,170,0,0.45)' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            } />
          <PasswordStrength password={form.password} />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 tracking-widest"
            style={{ color: 'rgba(212,170,0,0.55)' }}>CONFIRM PASSWORD</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              placeholder="Re-enter password"
              required
              className="w-full rounded-xl px-4 py-3 pr-12 text-sm outline-none font-mono"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${mismatch ? '#ef4444' : match ? '#22c55e' : 'rgba(212,170,0,0.15)'}`,
                color: '#e5e5e5',
              }} />
            <button type="button" onClick={() => setShowConfirm(p => !p)}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              style={{ color: 'rgba(212,170,0,0.45)' }}>
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mismatch && <p className="text-xs text-red-400 mt-1">Passwords do not match</p>}
          {match    && <p className="text-xs text-green-400 mt-1">Passwords match ✓</p>}
        </div>

        <GoldButton loading={loading} label="Create Account" loadingLabel="Creating…" icon={UserPlus} />
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Already have an account?{' '}
        <button onClick={onSwitch} className="font-semibold hover:opacity-80 transition-opacity"
          style={{ color: '#D4AA00' }}>
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
  const [tab, setTab] = useState('login');

  return (
    <div className="min-h-screen flex" style={{ background: '#080600' }}>
      <LeftPanel />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'linear-gradient(145deg, #080600 0%, #0d0a00 100%)' }}>
        <div className="w-full max-w-md">
          <MobileLogo />

          {/* Card */}
          <div className="rounded-2xl p-8" style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(212,170,0,0.12)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,170,0,0.04)',
          }}>
            {/* Tab switcher */}
            <div className="flex rounded-xl p-1 mb-7 gap-1"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,170,0,0.08)' }}>
              {[['login', 'Sign In', LogIn], ['register', 'Sign Up', UserPlus]].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black tracking-widest transition-all duration-200"
                  style={tab === key
                    ? { background: 'linear-gradient(135deg, #D4AA00, #A07800)', color: '#0a0800', fontFamily: 'Georgia, serif' }
                    : { color: 'rgba(212,170,0,0.35)' }}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

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
