'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';

const menuKeyMap = {
  '/content-flow': 'content_planner',
  '/instant-factory': 'instant_campaign',
  '/re-campaigns': 'opc_mass_bridging',
  '/pillar-campaigns': 'pillar_campaign',
  '/content-planner': 'content_planner',
  '/products': 'product_database',
  '/deconstruct': 'opc_mass_bridging',
  '/multiplier-lab': 'bridge_injector',
  '/recipe-labs': 'recipe_labs',
  '/product-bridge-inject': 'bridge_injector',
  '/sheets-autopilot': 'sheets_autopilot',
  '/video-studio': 'ffmpeg_studio',
  '/tts-studio': 'tts_studio',
  '/scraper': 'video_library',
  '/sync': 'system_settings',
  '/settings/brand-profiles': 'brand_profiles',
  '/settings/users': 'admin_only',
  '/settings': 'system_settings',
  '/system-health': 'system_settings'
};

const navItems = [
  { label: 'Dashboard', href: '/', icon: '◈' },
  { section: 'WORKFLOW' },
  { label: 'ContentFlow Hub', href: '/content-flow', icon: '📊' },
  { label: 'Instant Factory', href: '/instant-factory', icon: '🚀' },
  { label: 'RE Campaign', href: '/re-campaigns', icon: '🎬' },
  { label: 'Organic Pillar', href: '/pillar-campaigns', icon: '🌱' },
  { label: 'Content Planner', href: '/content-planner', icon: '🗓️' },
  { label: 'Product Database', href: '/products', icon: '📦' },
  { label: 'Deconstruct Lab', href: '/deconstruct', icon: '🔬' },
  { label: 'Multiplier Lab', href: '/multiplier-lab', icon: '🎛️' },
  { label: 'Recipe Labs', href: '/recipe-labs', icon: '🍳' },
  { label: 'Product Bridging', href: '/product-bridge-inject', icon: '🎯' },
  { label: 'Sheets Autopilot', href: '/sheets-autopilot', icon: '🤖' },
  { section: 'TOOLS' },
  { label: 'Video Studio', href: '/video-studio', icon: '🎞' },
  { label: 'TTS Studio', href: '/tts-studio', icon: '🎙' },
  { label: 'Video Library', href: '/scraper', icon: '📼' },
  { label: 'MAKNA Hub Sync', href: '/sync', icon: '☁️' },
  { section: 'SYSTEM' },
  { label: 'Brand Profile Manager', href: '/settings/brand-profiles', icon: '🧬' },
  { label: 'User Management', href: '/settings/users', icon: '👥', adminOnly: true },
  { label: 'System Health', href: '/system-health', icon: '🩺' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
];

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAccount = searchParams ? (searchParams.get('account') || 'all') : 'all';
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(err => console.error('[Sidebar Auth Check Failed]', err))
      .finally(() => setLoading(false));
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  };

  const isMenuAllowed = (item) => {
    if (item.href === '/' || item.href === '/content-flow') return true;
    if (!user) return true;
    if (user.role === 'admin') return true;
    if (item.adminOnly) return false;

    const requiredKey = menuKeyMap[item.href];
    if (!requiredKey) return true;

    return Array.isArray(user.menuPermissions) && user.menuPermissions.includes(requiredKey);
  };

  const visibleItems = navItems.filter((item, idx, arr) => {
    if (item.section) {
      const nextSectionIdx = arr.findIndex((x, i) => i > idx && x.section);
      const childItems = arr.slice(idx + 1, nextSectionIdx === -1 ? arr.length : nextSectionIdx);
      return childItems.some(child => !child.section && isMenuAllowed(child));
    }
    return isMenuAllowed(item);
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        {/* Row 1: Logo Icon + MAKNA GRID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0,242,254,0.15), rgba(16,185,129,0.15))',
            border: '1px solid rgba(0,242,254,0.3)',
            boxShadow: '0 0 14px rgba(0,242,254,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg viewBox="0 0 64 64" fill="none" style={{ width: '24px', height: '24px' }}>
              <defs>
                <linearGradient id="gridGradM_sb" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00F2FE" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="22" fill="rgba(0,242,254,0.1)"/>
              <path d="M16 48 L16 16 L32 34 L48 16 L48 48" stroke="url(#gridGradM_sb)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 28 L24 28 L32 37 L40 28 L48 28" stroke="#00F2FE" strokeWidth="1.5" opacity="0.6" strokeDasharray="2 2"/>
              <path d="M16 38 L48 38" stroke="#10B981" strokeWidth="1.5" opacity="0.5" strokeDasharray="2 2"/>
              <circle cx="16" cy="16" r="3.5" fill="#00F2FE"/>
              <circle cx="48" cy="16" r="3.5" fill="#00F2FE"/>
              <circle cx="32" cy="34" r="4" fill="#10B981"/>
              <circle cx="16" cy="48" r="3.5" fill="#00F2FE"/>
              <circle cx="48" cy="48" r="3.5" fill="#00F2FE"/>
            </svg>
          </div>
          <h1 style={{
            margin: 0,
            fontSize: '1.35rem',
            fontWeight: 800,
            color: '#ffffff',
            WebkitTextFillColor: '#ffffff',
            letterSpacing: '0.03em',
            lineHeight: '1'
          }}>
            MAKNA FLOW
          </h1>
        </div>

        {/* Row 2: Subtitle under logo & MAKNA FLOW */}
        <p style={{
          margin: '8px 0 0 0',
          fontSize: '0.66rem',
          color: '#ffffff',
          opacity: 0.85,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          lineHeight: '1.2'
        }}>
          Isolated SaaS Platform
        </p>
      </div>

      <nav className="sidebar-nav">
        {visibleItems.map((item, i) => {
          if (item.section) {
            return <div key={`sec_${i}`} className="nav-section">{item.section}</div>;
          }

          const isActive = pathname === item.href;
          const isContentFlow = item.href === '/content-flow';

          // Get assigned brand accounts from user
          const userBrandAccounts = (user && Array.isArray(user.assignedBrandNames) && user.assignedBrandNames.length > 0)
            ? user.assignedBrandNames
            : ['nutribake', 'siasatsehat', 'nutriblend', 'dapurbotani'];

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </div>
                {isContentFlow && (
                  <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
                )}
              </Link>

              {/* Sub-menu Brand Accounts for ContentFlow Hub */}
              {isContentFlow && (pathname.startsWith('/content-flow')) && (
                <div style={{
                  paddingLeft: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  marginTop: '4px',
                  marginBottom: '8px'
                }}>
                  <Link
                    href="/content-flow?account=all"
                    style={{
                      fontSize: '11px',
                      color: currentAccount === 'all' ? '#ffffff' : '#a1a1aa',
                      fontWeight: currentAccount === 'all' ? 700 : 500,
                      padding: '5px 10px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: currentAccount === 'all' ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.2) 100%)' : 'rgba(255,255,255,0.02)',
                      borderLeft: currentAccount === 'all' ? '3px solid #10b981' : '3px solid transparent',
                      boxShadow: currentAccount === 'all' ? '0 0 12px rgba(16,185,129,0.25)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>🌐</span> Semua Akun
                  </Link>
                  {userBrandAccounts.map(acc => {
                    const isSubActive = currentAccount.toLowerCase() === acc.toLowerCase();
                    return (
                      <Link
                        key={acc}
                        href={`/content-flow?account=${encodeURIComponent(acc)}`}
                        style={{
                          fontSize: '11px',
                          color: isSubActive ? '#ffffff' : '#a1a1aa',
                          fontWeight: isSubActive ? 700 : 500,
                          padding: '5px 10px',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isSubActive ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.2) 100%)' : 'rgba(255,255,255,0.02)',
                          borderLeft: isSubActive ? '3px solid #10b981' : '3px solid transparent',
                          boxShadow: isSubActive ? '0 0 12px rgba(16,185,129,0.25)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span>🏷️</span> @{acc}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {user && (
        <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
          <div style={{ fontSize: '0.85rem', color: '#a0aec0', marginBottom: '0.5rem' }}>
            Logged in as: <strong style={{ color: '#fff' }}>{user.username}</strong> ({user.role})
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            🚪 Logout
          </button>
        </div>
      )}
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={<aside className="sidebar"><div style={{ padding: '1rem', color: '#a1a1aa' }}>Loading...</div></aside>}>
      <SidebarContent />
    </Suspense>
  );
}
