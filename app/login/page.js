'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '../components/ThemeToggle';

const EyeIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = ({ style }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 014.122-.963c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = '/';
      } else {
        setError(data.error || 'Login gagal. Periksa username & password.');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan atau server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, var(--surface-raised) 0%, var(--canvas) 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: 'var(--text-primary)',
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px', width: '148px' }}>
        <ThemeToggle />
      </div>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '36px',
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-modal)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px auto',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(0,242,254,0.15), var(--status-success-soft))',
            border: '1px solid rgba(0,242,254,0.3)',
            boxShadow: '0 0 24px rgba(0,242,254,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg viewBox="0 0 64 64" fill="none" style={{ width: '42px', height: '42px' }}>
              <defs>
                <linearGradient id="gridGradM_lg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00F2FE" />
                  <stop offset="50%" stopColor="var(--status-info)" />
                  <stop offset="100%" stopColor="var(--status-success)" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="22" fill="rgba(0,242,254,0.12)"/>
              <path d="M16 48 L16 16 L32 34 L48 16 L48 48" stroke="url(#gridGradM_lg)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 28 L24 28 L32 37 L40 28 L48 28" stroke="#00F2FE" strokeWidth="1.5" opacity="0.6" strokeDasharray="2 2"/>
              <path d="M16 38 L48 38" stroke="var(--status-success)" strokeWidth="1.5" opacity="0.5" strokeDasharray="2 2"/>
              <circle cx="16" cy="16" r="3.5" fill="#00F2FE"/>
              <circle cx="48" cy="16" r="3.5" fill="#00F2FE"/>
              <circle cx="32" cy="34" r="4" fill="var(--status-success)"/>
              <circle cx="16" cy="48" r="3.5" fill="#00F2FE"/>
              <circle cx="48" cy="48" r="3.5" fill="#00F2FE"/>
            </svg>
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--link) 0%, var(--status-success) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px'
          }}>
            MAKNA FLOW
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Isolated SaaS Content Flow Platform
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--status-danger-soft)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: 'var(--status-danger)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '20px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 14px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                  padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? (
                  <EyeOffIcon style={{ width: '18px', height: '18px' }} />
                ) : (
                  <EyeIcon style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--action-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--on-action-primary)',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px var(--accent-glow)',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'Processing...' : 'Masuk ke Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
