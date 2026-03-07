import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, UserPlus, LogIn, CheckCircle, Shield } from 'lucide-react';

// ── Particle canvas background ───────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random(),
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,180,60,${p.a * 0.6})`;
        ctx.fill();
      });
      // draw lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(220,180,60,${(1 - dist / 100) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ── Avengers A logo SVG ──────────────────────────────────────────────────────
function AvengersMark({ size = 56, glow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none"
      style={glow ? { filter: 'drop-shadow(0 0 18px #DCB43C) drop-shadow(0 0 6px #DCB43C)' } : {}}>
      <polygon points="28,4 52,48 4,48" stroke="#DCB43C" strokeWidth="3" fill="none" />
      <polygon points="28,14 46,44 10,44" stroke="#DCB43C" strokeWidth="1" fill="rgba(220,180,60,0.04)" />
      <line x1="28" y1="4" x2="28" y2="56" stroke="#DCB43C" strokeWidth="2.5" />
      <line x1="4" y1="48" x2="52" y2="48" stroke="#DCB43C" strokeWidth="2" />
    </svg>
  );
}

// ── Left panel ───────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden lg:flex w-1/2" style={{ height: '100vh', overflow: 'hidden', background: '#000' }}>
      <iframe
        src="/war.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="The Coder's War"
      />
    </div>
  );
}

// ── Shared field ─────────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, suffix }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 tracking-widest"
        style={{ color: 'rgba(220,180,60,0.6)' }}>{label}</label>
      <div className="relative">
        <input
          type={type} value={value} onChange={onChange}
          placeholder={placeholder} required
          className="w-full rounded-lg px-4 py-3 text-sm pr-12 focus:outline-none transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(220,180,60,0.2)',
            color: '#e5e5e5',
            fontFamily: 'monospace',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(220,180,60,0.7)'}
          onBlur={e => e.target.style.borderColor = 'rgba(220,180,60,0.2)'}
        />
        {suffix && <div className="absolute right-4 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </div>
  );
}

// ── Password strength ────────────────────────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-0.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? colors[score] : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[score] }}>{labels[score]}</p>
    </div>
  );
}

// ── Avengers-style submit button ─────────────────────────────────────────────
function HeroButton({ loading, label, loadingLabel, icon: Icon }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-3 rounded-lg font-bold text-sm tracking-widest flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 relative overflow-hidden group"
      style={{ background: 'linear-gradient(135deg, #DCB43C, #B8860B)', color: '#0a0a0f' }}>
      <span className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #fff, transparent)' }} />
      <Icon size={16} />
      {loading ? loadingLabel : label}
    </button>
  );
}

// ══ LOGIN ════════════════════════════════════════════════════════════════════
function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
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
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-black tracking-wider mb-1" style={{ color: '#DCB43C', fontFamily: 'Georgia, serif' }}>
          WELCOME BACK
        </h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Sign in to your CodeLab account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="USERNAME OR EMAIL" value={form.username} onChange={set('username')} placeholder="enter username or email" />
        <Field label="PASSWORD" type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••"
          suffix={
            <button type="button" onClick={() => setShowPass(p => !p)}
              style={{ color: 'rgba(220,180,60,0.5)' }}
              className="hover:opacity-100 transition-opacity">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          } />
        <HeroButton loading={loading} label="ASSEMBLE" loadingLabel="ASSEMBLING…" icon={LogIn} />
      </form>
      <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        New recruit?{' '}
        <button onClick={onSwitch} className="font-semibold transition-colors"
          style={{ color: '#DCB43C' }}>
          Join the team
        </button>
      </p>
    </>
  );
}

// ══ REGISTER ════════════════════════════════════════════════════════════════
function RegisterForm({ onSwitch }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    if (!form.fullName.trim()) return 'Full name is required';
    if (form.username.length < 3) return 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return 'Username: letters, numbers, underscores only';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email';
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
      await api.post('/api/auth/register', {
        username: form.username.toLowerCase(),
        email: form.email.toLowerCase(),
        password: form.password,
        fullName: form.fullName,
        role: 'student',
      });
      setDone(true);
      toast.success('Account created! Signing you in…');
      await login(form.username, form.password);
      navigate('/student');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(220,180,60,0.1)', border: '1px solid rgba(220,180,60,0.3)' }}>
        <CheckCircle size={32} style={{ color: '#DCB43C' }} />
      </div>
      <h3 className="text-xl font-black tracking-wider mb-2" style={{ color: '#DCB43C' }}>HERO REGISTERED!</h3>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Redirecting to your dashboard…</p>
    </div>
  );

  const match = form.confirmPassword && form.password === form.confirmPassword;
  const mismatch = form.confirmPassword && form.password !== form.confirmPassword;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-wider mb-1" style={{ color: '#DCB43C', fontFamily: 'Georgia, serif' }}>
          JOIN THE TEAM
        </h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Create your CodeLab account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="FULL NAME" value={form.fullName} onChange={set('fullName')} placeholder="Your full name" />
        <div>
          <label className="block text-xs font-semibold mb-1.5 tracking-widest" style={{ color: 'rgba(220,180,60,0.6)' }}>USERNAME</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono" style={{ color: 'rgba(220,180,60,0.4)' }}>@</span>
            <input type="text" value={form.username} onChange={set('username')} placeholder="yourname" required
              className="w-full rounded-lg pl-8 pr-4 py-3 text-sm focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(220,180,60,0.2)', color: '#e5e5e5', fontFamily: 'monospace' }}
              onFocus={e => e.target.style.borderColor = 'rgba(220,180,60,0.7)'}
              onBlur={e => e.target.style.borderColor = 'rgba(220,180,60,0.2)'} />
          </div>
        </div>
        <Field label="EMAIL" type="email" value={form.email} onChange={set('email')} placeholder="you@university.edu" />
        <div>
          <Field label="PASSWORD" type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min. 6 characters"
            suffix={<button type="button" onClick={() => setShowPass(p => !p)} style={{ color: 'rgba(220,180,60,0.5)' }}>{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>} />
          <PasswordStrength password={form.password} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 tracking-widest" style={{ color: 'rgba(220,180,60,0.6)' }}>CONFIRM PASSWORD</label>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')}
              placeholder="Re-enter password" required
              className="w-full rounded-lg px-4 py-3 pr-12 text-sm focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${mismatch ? '#ef4444' : match ? '#22c55e' : 'rgba(220,180,60,0.2)'}`,
                color: '#e5e5e5', fontFamily: 'monospace',
              }} />
            <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2"
              style={{ color: 'rgba(220,180,60,0.5)' }}>{showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
          </div>
          {mismatch && <p className="text-xs text-red-400 mt-1">Passwords do not match</p>}
          {match && <p className="text-xs text-green-400 mt-1">Passwords match ✓</p>}
        </div>
        <HeroButton loading={loading} label="ENLIST NOW" loadingLabel="ENLISTING…" icon={UserPlus} />
      </form>
      <p className="mt-5 text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Already a hero?{' '}
        <button onClick={onSwitch} className="font-semibold" style={{ color: '#DCB43C' }}>Sign in</button>
      </p>
    </>
  );
}

// ══ PAGE SHELL ════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const [tab, setTab] = useState('login');

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0f' }}>
      <LeftPanel />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* subtle bg glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #DCB43C, transparent)' }} />

        <div className="relative w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <AvengersMark size={36} glow />
            <span className="text-xl font-black tracking-widest" style={{ color: '#DCB43C', fontFamily: 'Georgia, serif' }}>CODELAB</span>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8" style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(220,180,60,0.15)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,180,60,0.05)',
          }}>
            {/* Shield icon top */}
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(220,180,60,0.1)', border: '1px solid rgba(220,180,60,0.2)' }}>
                <Shield size={22} style={{ color: '#DCB43C' }} />
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-lg p-1 mb-8 gap-1"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(220,180,60,0.1)' }}>
              {[['login', 'SIGN IN', LogIn], ['register', 'SIGN UP', UserPlus]].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-bold tracking-widest transition-all duration-200"
                  style={tab === key
                    ? { background: 'linear-gradient(135deg,#DCB43C,#B8860B)', color: '#0a0a0f' }
                    : { color: 'rgba(220,180,60,0.4)' }}>
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

          {/* Bottom tagline */}
          <p className="text-center text-xs mt-4 tracking-widest" style={{ color: 'rgba(220,180,60,0.25)' }}>
            WHATEVER IT TAKES
          </p>
        </div>
      </div>
    </div>
  );
}
