'use client';

import Sidebar from './components/Sidebar';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [brandOverview, setBrandOverview] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) setStats(data.data);

      const v2Res = await fetch('/api/v2/dashboard/stats');
      const v2Data = await v2Res.json();
      if (v2Data.success) setBrandOverview(v2Data.stats || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const getBrandBadgeStyle = (accountName) => {
    const acc = (accountName || '').toLowerCase().trim();
    if (acc === 'dummybrand01' || acc.includes('blue') || acc.includes('skincare')) {
      return { background: 'rgba(37, 99, 235, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#93c5fd' };
    }
    if (acc === 'dummybrand02' || acc.includes('red') || acc.includes('food')) {
      return { background: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fca5a5' };
    }
    if (acc === 'siasatsehat' || acc.includes('sehat') || acc.includes('health')) {
      return { background: 'rgba(16, 185, 129, 0.25)', border: '1px solid rgba(16, 185, 129, 0.5)', color: '#6ee7b7' };
    }
    return { background: 'rgba(14, 165, 233, 0.2)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#7dd3fc' };
  };

  const getStatusBadge = (status) => {
    if (status === 'Published') {
      return <span style={{ padding: '3px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.18)', border: '1px solid #10b981', color: '#34d399', fontSize: '11px', fontWeight: 700 }}>Published</span>;
    }
    if (status === 'Scheduled') {
      return <span style={{ padding: '3px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.18)', border: '1px solid #f59e0b', color: '#fbbf24', fontSize: '11px', fontWeight: 700 }}>Scheduled</span>;
    }
    return <span style={{ padding: '3px 10px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.18)', border: '1px solid #475569', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Not Published</span>;
  };

  return (
    <div className="layout-with-sidebar">
      <Sidebar />

      <main className="main-content" style={{ padding: '32px 36px', background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        <div style={{ maxWidth: '1380px', width: '100%', margin: '0 auto' }}>
          
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
                  Dashboard
                </h1>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.4)', color: '#38bdf8' }}>
                  Decoupled V2.0 Active
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                Ringkasan Eksekutif & Akses Cepat MAKNA Flow Platform
              </p>
            </div>
            <button
              onClick={fetchStats}
              style={{
                padding: '10px 18px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                backdropFilter: 'blur(10px)', transition: 'all 0.2s ease'
              }}
            >
              🔄 Refresh Stats
            </button>
          </div>

          {/* BARIS 1: 4 EXECUTIVE METRIC CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            
            {/* Card 1: Content Ready */}
            <div style={{
              padding: '20px 22px', borderRadius: '16px', background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--accent-glow) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#7dd3fc', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  🎬 KONTEN SIAP PUBLISH
                </span>
                <span style={{ fontSize: '18px' }}>🎥</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '14px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.02em' }}>{stats?.contentReadyCount ?? '—'}</span>
                <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Video Ready</span>
              </div>
            </div>

            {/* Card 2: Active Campaigns */}
            <div style={{
              padding: '20px 22px', borderRadius: '16px', background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#6ee7b7', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  🌱 KAMPANYE AKTIF
                </span>
                <span style={{ fontSize: '18px' }}>⚡</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '14px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#34d399', letterSpacing: '-0.02em' }}>{stats?.activeCampaignCount ?? '—'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>OPC & Strategic</span>
              </div>
            </div>

            {/* Card 3: Products Catalog */}
            <div style={{
              padding: '20px 22px', borderRadius: '16px', background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(245, 158, 11, 0.08) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#fde047', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  📦 KATALOG PRODUK
                </span>
                <span style={{ fontSize: '18px' }}>🏷️</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '14px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.02em' }}>{stats?.productCount ?? '—'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>SKUs Active</span>
              </div>
            </div>

            {/* Card 4: Server Cluster Health */}
            <div style={{
              padding: '20px 22px', borderRadius: '16px', background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(99, 102, 241, 0.08) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.35)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  🟢 SERVER CLUSTER
                </span>
                <span style={{ fontSize: '18px' }}>🖥️</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '14px' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#818cf8', letterSpacing: '-0.02em' }}>3 / 3 Nodes</span>
                <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>PostgreSQL Node 3</span>
              </div>
            </div>

          </div>

          {/* BARIS 2: QUICK ACTION LAUNCHPAD */}
          <div style={{ padding: '22px 24px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '28px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚡ QUICK ACTION LAUNCHPAD
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Pintas Akses Modul Utama</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              
              <Link
                href="/content-flow"
                style={{
                  padding: '14px 18px', borderRadius: '14px', background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px',
                  boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)', transition: 'all 0.2s ease', border: '1px solid rgba(255,255,255,0.2)'
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📱</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Content Flow Hub</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>Kelola & Publish Content</div>
                </div>
              </Link>

              <Link
                href="/content-planner"
                style={{
                  padding: '14px 18px', borderRadius: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📅</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>+ Content Plan</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Import & Ingest OPC</div>
                </div>
              </Link>

              <Link
                href="/re-campaigns"
                style={{
                  padding: '14px 18px', borderRadius: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⚡</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>+ Kampanye RE</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reverse Engineering</div>
                </div>
              </Link>

              <Link
                href="/pillar-campaigns"
                style={{
                  padding: '14px 18px', borderRadius: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🌱</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>+ Kampanye OPC</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Organic Pillar Content</div>
                </div>
              </Link>

            </div>
          </div>

          {/* BARIS BANNER: GLOBAL BRAND OVERVIEW */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏬 Global Brand Overview
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status Posting & Stok Video Per Akun</span>
            </div>

            {loading ? (
              <div style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                Memuat data ringkasan brand...
              </div>
            ) : brandOverview.length === 0 ? (
              <div style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                Belum ada data brand terdaftar.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {brandOverview.map((b) => (
                  <div
                    key={b.account_name}
                    style={{
                      padding: '20px', borderRadius: '16px', background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-glass) 100%)',
                      border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{
                        fontSize: '12px', fontWeight: 800, padding: '4px 12px', borderRadius: '10px',
                        ...getBrandBadgeStyle(b.account_name)
                      }}>
                        @{b.account_name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        Active Account
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px', background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700 }}>🎵 TikTok</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{b.tiktok_posted}</div>
                      </div>
                      <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 700 }}>📘 FB</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{b.facebook_posted}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#e879f9', fontWeight: 700 }}>📸 IG</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{b.instagram_posted}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stok Available:</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#34d399' }}>{b.available_stock} Video Completed</div>
                      </div>
                      <Link
                        href={`/content-flow?brand=${encodeURIComponent(b.account_name)}`}
                        style={{
                          padding: '8px 14px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                          color: 'var(--text-primary)', textDecoration: 'none', fontSize: '12px', fontWeight: 700, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        Kelola ➡️
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BARIS 3: RECENT CONTENT (LEFT) & PLATFORM READINESS (RIGHT) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
            
            {/* Left Box: 5 Recent Content Flow Items */}
            <div style={{ padding: '24px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 800, display: 'block' }}>
                    📱 5 Konten Siap Publish Terbaru
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Terhubung langsung ke PostgreSQL Node 3</span>
                </div>
                <Link href="/content-flow" style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Lihat Semua Konten ➔
                </Link>
              </div>

              {loading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Memuat data dari PostgreSQL Node 3...</div>
              ) : !stats?.recentItems || stats.recentItems.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Belum ada konten di database.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.recentItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '14px 16px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '8px', flexShrink: 0,
                          ...getBrandBadgeStyle(item.account_name)
                        }}>
                          @{item.account_name || 'Umum'}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.hook || 'Tanpa Hook'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {getStatusBadge(item.tiktok_status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Box: Platform Readiness Progress */}
            <div style={{ padding: '24px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}>
              <div>
                <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                  📊 Progress Publikasi Platform
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '20px' }}>
                  Persentase konten terpublikasi per channel
                </span>

                {/* TikTok */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>🎵 TikTok</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{stats?.platformStats?.tiktokPct ?? 0}% Published</span>
                  </div>
                  <div style={{ height: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ width: `${stats?.platformStats?.tiktokPct ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)', borderRadius: '6px', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>

                {/* Facebook */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>📘 Facebook</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{stats?.platformStats?.fbPct ?? 0}% Published</span>
                  </div>
                  <div style={{ height: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ width: `${stats?.platformStats?.fbPct ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)', borderRadius: '6px', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>

                {/* Instagram */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: '#e879f9', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>📸 Instagram</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{stats?.platformStats?.igPct ?? 0}% Published</span>
                  </div>
                  <div style={{ height: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ width: `${stats?.platformStats?.igPct ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, #c084fc 0%, #e879f9 100%)', borderRadius: '6px', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>

              </div>

              <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-glass)', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💡</span>
                <span>Status publikasi diperbarui secara otomatis setiap kali Anda mengubah status di <strong>ContentFlow Hub</strong>.</span>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
