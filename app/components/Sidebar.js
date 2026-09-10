'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import ThemeToggle from './ThemeToggle';
import ContentFlowLogo from './ContentFlowLogo';

const menuKeyMap = {
  '/youtube-studio': 'youtube_studio',
  '/affiliate-studio': 'affiliate_studio',
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
  { label: 'Dashboard', href: '/dashboard', icon: '◈' },

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
  { label: 'Affiliate Studio', href: '/affiliate-studio', icon: '◆' },
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
    if (item.href === '/' || item.href === '/dashboard' || item.href === '/content-flow') return true;
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
      <div className="sidebar-brand" style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'block' }}>
          <ContentFlowLogo variant="horizontal" size="sm" showTagline={true} />
        </Link>
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#93C5FD', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🔒 Internal Enterprise
          </span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            v2.0 Staging
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {visibleItems.map((item, i) => {
          if (item.section) {
            return <div key={`sec_${i}`} className="nav-section">{item.section}</div>;
          }

          const enabledMenusEnv = process.env.NEXT_PUBLIC_ENABLED_MENUS;
          const enabledMenusSet = enabledMenusEnv ? new Set(enabledMenusEnv.split(',')) : null;
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
