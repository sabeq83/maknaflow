'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '../components/ThemeToggle';
import ContentFlowLogo from '../components/ContentFlowLogo';

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
        window.location.href = '/dashboard';
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
      position: 'relative',
      padding: '20px'
    }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px', width: '148px' }}>
        <ThemeToggle />
      </div>

      <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
        <Link
          href="/"
          style={{
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          ← Beranda Publik
        </Link>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '380px',
        padding: '36px 32px',
        boxSizing: 'border-box',
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-modal)'
      }}>
        {/* LOGO & TITLE */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <ContentFlowLogo variant="stacked" size="lg" showTagline={true} />
          </div>

          <div style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#93c5fd',
            fontSize: '0.72rem',
            fontWeight: 700,
            marginTop: '8px'
          }}>
            🔒 Internal Enterprise Portal
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
            Akses khusus staf &amp; operator internal terotorisasi.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--status-danger-soft)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: 'var(--status-danger)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            marginBottom: '18px'
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
                outline: 'none',
                boxSizing: 'border-box'
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
                  outline: 'none',
                  boxSizing: 'border-box'
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
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px var(--accent-glow)',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'Memverifikasi...' : 'Masuk ke Portal Internal'}
          </button>
        </form>

        {/* FOOTER LINKS */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '6px' }}>
            <Link href="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
          </div>
          <div>Target: <span style={{ color: 'var(--link)' }}>contentflow-stg.ast402.my.id</span></div>
        </div>
      </div>
    </div>
  );
}
