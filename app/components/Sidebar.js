'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import ThemeToggle from './ThemeToggle';

const menuKeyMap = {
  '/youtube-studio': 'youtube_studio',
  '/content-flow': 'content_flow',
  '/instant-factory': 'instant_campaign',
  '/re-campaigns': 're_campaign',
  '/pillar-campaigns': 'pillar_campaign',
  '/content-planner': 'content_planner',
  '/content-automations': 'content_automations',
  '/products': 'product_database',
  '/deconstruct': 'deconstruct_lab',
  '/multiplier-lab': 'multiplier_lab',
  '/recipe-labs': 'recipe_labs',
  '/product-bridge-inject': 'product_bridging',
  '/sheets-autopilot': 'sheets_autopilot',
  '/video-studio': 'ffmpeg_studio',
  '/tts-studio': 'tts_studio',
  '/scraper': 'video_library',
  '/settings/brand-profiles': 'brand_profiles',
  '/settings/universes': 'universe_manager',
  '/settings/presets': 'operator_presets',
  '/settings/visual-identities': 'operator_presets',
  '/settings/users': 'admin_only',
  '/settings/tenants': 'superadmin_only',
  '/settings': 'system_settings',
  '/system-health': 'system_health'
};

const navItems = [
  { label: 'Dashboard', href: '/', icon: '◈' },

  { section: 'PLANNING' },
  { label: 'Content Planner', href: '/content-planner', icon: '🗓️' },
  { label: 'Product Database', href: '/products', icon: '📦' },
  { label: 'Deconstruct Lab', href: '/deconstruct', icon: '🔬' },
  { label: 'Preset Manager', href: '/settings/presets', icon: '🎛️' },
  { label: 'Visual Identity', href: '/settings/visual-identities', icon: '🎨' },
  { label: 'Brand Profile Manager', href: '/settings/brand-profiles', icon: '🧬' },
  { label: 'Universe Manager', href: '/settings/universes', icon: '🏰' },

  { section: 'WORKFLOW' },
  { label: 'YouTube Studio', href: '/youtube-studio', icon: '▶️' },
  { label: 'RE Campaign', href: '/re-campaigns', icon: '🎬' },
  { label: 'Pillar Campaign', href: '/pillar-campaigns', icon: '🌱' },
  { label: 'Sheets Autopilot', href: '/sheets-autopilot', icon: '🤖' },
  { label: 'Recipe Labs', href: '/recipe-labs', icon: '🍳' },
  { label: 'Instant Campaign', href: '/instant-factory', icon: '🚀' },
  { label: 'Multiplier Lab', href: '/multiplier-lab', icon: '🎛️' },
  { label: 'Product Bridging', href: '/product-bridge-inject', icon: '🎯' },

  { section: 'PUBLISHING' },
  { label: 'ContentFlow Hub', href: '/content-flow', icon: '📊' },
  { label: 'Content Automations', href: '/content-automations', icon: '⏱️' },

  { section: 'TOOLS' },
  { label: 'Video Studio', href: '/video-studio', icon: '🎞' },
  { label: 'TTS Studio', href: '/tts-studio', icon: '🎙' },
  { label: 'Video Library', href: '/scraper', icon: '📼' },

  { section: 'SYSTEM' },
  { label: 'User Management', href: '/settings/users', icon: '👥', adminOnly: true },
  { label: 'Tenant Management', href: '/settings/tenants', icon: '🏢', superadminOnly: true },
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
    if (item.superadminOnly) return user.role === 'superadmin';
    if (user.role === 'admin') return true;
    if (user.role === 'superadmin') return false;
    if (item.adminOnly) return false;

    const requiredKey = menuKeyMap[item.href];
    if (!requiredKey) return true;

    return Array.isArray(user.menuPermissions) && user.menuPermissions.includes(requiredKey);
  };

  const checkIsTenantDisabled = (item) => {
    const menuKey = menuKeyMap[item.href];
    return user?.role !== 'superadmin' && menuKey && Array.isArray(user?.tenantDisabledMenus) && user.tenantDisabledMenus.includes(menuKey);
  };

  const processedItems = [];
  let currentSection = null;
  let sectionChildren = [];

  for (const item of navItems) {
    if (item.href === '/') {
      processedItems.push(item);
      continue;
    }
    if (item.section) {
      if (currentSection) {
        const allowedChildren = sectionChildren.filter(c => isMenuAllowed(c));
        if (allowedChildren.length > 0) {
          processedItems.push(currentSection);
          const enabled = allowedChildren.filter(c => !checkIsTenantDisabled(c));
          const disabled = allowedChildren.filter(c => checkIsTenantDisabled(c));
          processedItems.push(...enabled, ...disabled);
        }
      }
      currentSection = item;
      sectionChildren = [];
    } else {
      sectionChildren.push(item);
    }
  }

  if (currentSection) {
    const allowedChildren = sectionChildren.filter(c => isMenuAllowed(c));
    if (allowedChildren.length > 0) {
      processedItems.push(currentSection);
      const enabled = allowedChildren.filter(c => !checkIsTenantDisabled(c));
      const disabled = allowedChildren.filter(c => checkIsTenantDisabled(c));
      processedItems.push(...enabled, ...disabled);
    }
  }

  const visibleItems = processedItems;

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
            color: 'var(--text-primary)',
            WebkitTextFillColor: 'var(--text-primary)',
            letterSpacing: '0.03em',
            lineHeight: '1',
            fontFamily: 'var(--font-mono)'
          }}>
            MAKNA FLOW
          </h1>
        </div>

        {/* Row 2: Subtitle under logo & MAKNA FLOW */}
        <p style={{
          margin: '8px 0 0 0',
          fontSize: '0.66rem',
          color: 'var(--text-secondary)',
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

          const enabledMenusEnv = process.env.NEXT_PUBLIC_ENABLED_MENUS;
          const enabledMenusSet = enabledMenusEnv
          const menuKey = menuKeyMap[item.href];
          const isTenantDisabled = user?.role !== 'superadmin' && menuKey && Array.isArray(user?.tenantDisabledMenus) && user.tenantDisabledMenus.includes(menuKey);
          const isMenuEnabled = (!enabledMenusSet || enabledMenusSet.has(item.href)) && !isTenantDisabled;

          if (!isMenuEnabled) {
            return (
              <div
                key={item.href}
                className="nav-link disabled"
                onClick={() => alert(`Modul "${item.label}" dinonaktifkan oleh Superadmin untuk organisasi/tenant Anda.`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: 0.4,
                  cursor: 'not-allowed',
                  userSelect: 'none',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  marginBottom: '2px'
                }}
                title="Modul ini dinonaktifkan oleh Superadmin"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="nav-icon">{item.icon}</span>
                  <span style={{ fontSize: '0.85rem' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: '12px' }}>🔒</span>
              </div>
            );
          }

          const isActive = pathname === item.href;
          const isContentFlow = item.href === '/content-flow';

          // Get assigned brand accounts from user
          const userBrandAccounts = (user && Array.isArray(user.assignedBrandNames))
            ? user.assignedBrandNames
            : [];

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
                    className={`sidebar-brand-subtab ${currentAccount === 'all' ? 'sidebar-brand-subtab-active' : ''}`}
                    style={{
                      fontSize: '11px',
                      fontWeight: currentAccount === 'all' ? 700 : 500,
                      padding: '5px 10px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
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
                        className={`sidebar-brand-subtab ${isSubActive ? 'sidebar-brand-subtab-active' : ''}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: isSubActive ? 700 : 500,
                          padding: '5px 10px',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
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

      <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        <div style={{ marginBottom: '12px' }}>
          <ThemeToggle />
        </div>
        {user ? (
          <>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Logged in as: <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong> ({user.role})
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
          </>
        ) : (
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
            🚪 Logout / Login
          </button>
        )}
      </div>
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
