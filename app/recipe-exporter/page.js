'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/app/components/Sidebar';
import RecipeExportModal from '@/app/components/recipe-export/RecipeExportModal';
import DedicatedVideoLightbox from '@/app/components/recipe-export/DedicatedVideoLightbox';
import '@/app/components/recipe-export/recipe-export.css';

export default function RecipeExporterPage() {
  const [source, setSource] = useState('labs'); // 'labs' | 'campaign'
  const [filter, setFilter] = useState('all'); // 'all' | 'exported' | 'unexported' | 'ready' | 'legacy' | 'video'
  const [originFilter, setOriginFilter] = useState('all'); // 'all' | 'pillar' | 'multiplier' | 'planner' | 'labs'
  const [campaignFilter, setCampaignFilter] = useState('all'); // 'all' | <campaign_id>
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeExportRecipe, setActiveExportRecipe] = useState(null);
  const [activeLightboxRecipe, setActiveLightboxRecipe] = useState(null);
  const [r2Configured, setR2Configured] = useState(false);

  // Fetch data resep dari API live database
  const fetchRecipes = async (targetSource) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes?source=${targetSource}`);
      const d = await res.json();
      if (d.success && Array.isArray(d.data)) {
        setRecipes(d.data);
      } else {
        setRecipes([]);
      }
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
      setRecipes([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Cek konfigurasi Cloudflare R2
    fetch('/api/settings/r2')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.config) setR2Configured(d.config.isConfigured);
      })
      .catch(() => {});

    setOriginFilter('all');
    setCampaignFilter('all');
    fetchRecipes(source);
  }, [source]);

  // Kumpulkan daftar kampanye unik untuk dropdown
  const uniqueCampaigns = React.useMemo(() => {
    const map = new Map();
    recipes.forEach(r => {
      const cId = r.campaign_id;
      if (cId && !map.has(cId)) {
        map.set(cId, {
          id: cId,
          name: r.campaign_name || cId,
          origin: r.origin_label || r.origin_type || 'Campaign',
          origin_type: r.origin_type
        });
      }
    });
    return Array.from(map.values());
  }, [recipes]);

  const filteredRecipes = recipes.filter(r => {
    // 1. Filter Asal Kampanye (Origin Filter)
    if (originFilter !== 'all' && r.origin_type !== originFilter) return false;

    // 2. Filter Dropdown Kampanye Spesifik
    if (campaignFilter !== 'all' && r.campaign_id !== campaignFilter) return false;

    // 3. Smart Universal Search (Title, Campaign ID, Campaign Name, Category, Summary, Recipe ID)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchCampId = (r.campaign_id || '').toLowerCase().includes(q);
      const matchCampName = (r.campaign_name || '').toLowerCase().includes(q);
      const matchCategory = (r.category || '').toLowerCase().includes(q);
      const matchSummary = (r.summary || '').toLowerCase().includes(q);
      const matchId = String(r.id || '').toLowerCase().includes(q);

      if (!matchTitle && !matchCampId && !matchCampName && !matchCategory && !matchSummary && !matchId) {
        return false;
      }
    }

    // 4. Status Filter
    if (filter === 'exported') return r.isExported;
    if (filter === 'unexported') return !r.isExported;
    if (filter === 'ready') return r.hasSummary;
    if (filter === 'legacy') return !r.hasSummary;
    if (filter === 'video') return r.hasVideo || r.videoR2Url;
    return true;
  });

  const countExported = recipes.filter(r => r.isExported).length;
  const countUnexported = recipes.filter(r => !r.isExported).length;
  const countReady = recipes.filter(r => r.hasSummary).length;
  const countLegacy = recipes.filter(r => !r.hasSummary).length;
  const countVideo = recipes.filter(r => r.hasVideo || r.videoR2Url).length;

  const countPillar = recipes.filter(r => r.origin_type === 'pillar').length;
  const countMultiplier = recipes.filter(r => r.origin_type === 'multiplier').length;
  const countPlanner = recipes.filter(r => r.origin_type === 'planner').length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          
          {/* Top Bar Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '2rem' }}>📱</span>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Recipe Exporter & Webadmin Sync Hub
                </h1>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Pusat Ekspor & Standarisasi Resep Android • Live Database Query • Pelacakan Status Ekspor • Cover 4:3 • R2 CDN
                </div>
              </div>
            </div>

            {/* Source Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                className={`btn btn-sm ${source === 'labs' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', fontWeight: 600 }}
                onClick={() => setSource('labs')}
              >
                🧪 Recipe Labs
              </button>
              <button
                type="button"
                className={`btn btn-sm ${source === 'campaign' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.82rem', fontWeight: 600 }}
                onClick={() => setSource('campaign')}
              >
                📊 Recipe Campaign (Content Planner)
              </button>
            </div>
          </div>

          {/* Overview Context Card */}
          <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {source === 'labs' ? '🧪 Sumber Data: Studio Resep Mandiri (Tabel: recipe_items)' : '📊 Sumber Data: Kampanye Konten Kuliner (Tabel: content_planner_rows)'}
              </strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                {source === 'labs'
                  ? 'Menampilkan resep masakan hasil racikan studio Recipe Labs. Resep lama dapat diperkaya via 1-Klik AI Auto Enrich.'
                  : 'Menampilkan naskah dan aset video kampanye kuliner hasil kurasi Content Planner yang siap disinkronkan ke webadmin.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="recipe-pixel-chip" style={{ color: r2Configured ? 'var(--status-success)' : 'var(--status-warning)', borderColor: r2Configured ? 'var(--status-success)' : 'var(--status-warning)', padding: '4px 10px', fontSize: '0.75rem' }}>
                ☁️ Cloudflare R2: {r2Configured ? 'Terkoneksi' : 'Kredensial Belum Diset'}
              </span>
              <a href="/settings" className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem' }}>
                ⚙️ Pengaturan Storage
              </a>
            </div>
          </div>

          {/* Origin Filter Row (Khusus jika di Recipe Campaign) */}
          {source === 'campaign' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ASAL KAMPANYE:</span>
                {[
                  { id: 'all', label: `🌟 Semua Asal (${recipes.length})` },
                  { id: 'pillar', label: `🏛️ Pillar Campaign (${countPillar})` },
                  { id: 'multiplier', label: `⚡ Multiplier Lab (${countMultiplier})` },
                  { id: 'planner', label: `📅 Content Planner (${countPlanner})` }
                ].map(o => (
                  <button
                    key={o.id}
                    type="button"
                    className={`btn btn-sm ${originFilter === o.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '999px' }}
                    onClick={() => { setOriginFilter(o.id); setCampaignFilter('all'); }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Campaign Selector Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  Pilih Kampanye:
                </label>
                <select
                  value={campaignFilter}
                  onChange={e => setCampaignFilter(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.78rem', padding: '4px 8px', maxWidth: '320px', background: 'var(--surface)' }}
                >
                  <option value="all">-- Semua Kampanye --</option>
                  {uniqueCampaigns
                    .filter(c => originFilter === 'all' || c.origin_type === originFilter)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.origin}] {c.name} ({c.id})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Search Bar & Filter Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `Semua Resep (${recipes.length})` },
                { id: 'exported', label: `✓ Sudah Diekspor (${countExported})` },
                { id: 'unexported', label: `⏳ Belum Diekspor (${countUnexported})` },
                { id: 'ready', label: `⚡ Siap Ekspor (${countReady})` },
                { id: 'legacy', label: `⚠️ Perlu AI Enrich (${countLegacy})` },
                { id: 'video', label: `🎬 Memiliki Video (${countVideo})` }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`recipe-sub-tab-btn ${filter === t.id ? 'active' : ''}`}
                  onClick={() => setFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '320px' }}>
              <input
                type="text"
                placeholder="Cari ID Kampanye (opc_...), judul, atau kategori..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'var(--input-bg)' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Memuat daftar resep dari database...</div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredRecipes.length === 0 && (
            <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📖</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                {recipes.length === 0 ? 'Belum Ada Resep di Database' : 'Tidak Ada Resep yang Sesuai Filter'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                {recipes.length === 0
                  ? source === 'labs'
                    ? 'Belum ada resep yang dibuat di Recipe Labs. Buat kampanye resep studio baru sekarang untuk mulai mengekspor ke aplikasi Android.'
                    : 'Belum ada baris kampanye kuliner di Content Planner. Rencanakan resep baru di Content Planner sekarang.'
                  : 'Coba pilih tab filter lain atau hapus kata kunci pencarian Anda.'}
              </p>
              {recipes.length === 0 ? (
                <a
                  href={source === 'labs' ? '/recipe-labs' : '/content-planner'}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                >
                  <span>➕</span>
                  <span>{source === 'labs' ? 'Buka Recipe Labs Studio' : 'Buka Content Planner Kuliner'}</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setFilter('all'); setSearchQuery(''); }}
                  style={{ fontSize: '0.82rem' }}
                >
                  🔄 Reset Filter Pencarian
                </button>
              )}
            </div>
          )}

          {/* Recipe Cards Grid */}
          {!loading && filteredRecipes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {filteredRecipes.map(item => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--surface)',
                    border: item.isExported ? '1.5px solid var(--status-success)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: item.isExported ? '0 0 0 1px var(--status-success), var(--shadow-card)' : 'var(--shadow-card)',
                    transition: 'all var(--transition)'
                  }}
                >
                  {/* Media Cover */}
                  <div style={{ position: 'relative', width: '100%', height: '180px', background: 'var(--canvas)' }}>
                    <img
                      src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
                      }}
                    />
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--overlay-backdrop)', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                      {item.source}
                    </span>

                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {item.isExported && (
                        <span style={{
                          background: 'var(--status-success)',
                          color: '#ffffff',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          letterSpacing: '0.3px'
                        }}>
                          ✅ SUDAH DIEKSPOR
                        </span>
                      )}
                      {item.hasVideo && (
                        <span style={{
                          background: 'var(--status-warning)',
                          color: '#ffffff',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
                        }}>
                          🎬 Video
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Origin Badge & Campaign ID */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid',
                          background: item.origin_type === 'pillar' ? 'var(--status-info-soft)' : item.origin_type === 'multiplier' ? 'var(--status-warning-soft)' : item.origin_type === 'planner' ? 'var(--status-info-soft)' : 'var(--surface-interactive)',
                          color: item.origin_type === 'pillar' ? 'var(--status-info)' : item.origin_type === 'multiplier' ? 'var(--status-warning)' : item.origin_type === 'planner' ? 'var(--status-info)' : 'var(--text-secondary)',
                          borderColor: item.origin_type === 'pillar' ? 'var(--status-info)' : item.origin_type === 'multiplier' ? 'var(--status-warning)' : item.origin_type === 'planner' ? 'var(--status-info)' : 'var(--border-subtle)'
                        }}
                      >
                        ● {item.origin_label || 'Campaign'}
                      </span>
                      {item.campaign_id && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--surface-interactive)', padding: '2px 6px', borderRadius: '4px' }}>
                          🏷️ {item.campaign_id}
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                      {item.title}
                    </h3>

                    {item.campaign_name && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📂 {item.campaign_name}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="recipe-pixel-chip">⏱️ {item.time}</span>
                      <span className="recipe-pixel-chip">🏷️ {item.category}</span>
                      {item.videoR2Url && (
                        <span className="recipe-pixel-chip" style={{ color: 'var(--status-success)', borderColor: 'var(--status-success)' }}>
                          ☁️ R2 Synced
                        </span>
                      )}
                    </div>

                    {/* Export Status Badge info */}
                    {item.isExported ? (
                      <div style={{
                        padding: '8px 12px',
                        background: 'var(--status-success-soft)',
                        borderRadius: '6px',
                        border: '1.5px solid var(--status-success)',
                        fontSize: '0.75rem',
                        color: 'var(--status-success)',
                        fontWeight: 600,
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✅</span>
                          <span>Terkirim ke <strong>{item.lastExportTarget || 'Android Webadmin'}</strong></span>
                        </div>
                        {item.lastExportedAt && (
                          <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            {new Date(item.lastExportedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ) : null}

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '4px 0 0 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.summary || '(Resep ini belum memiliki summary dan kelompok bahan. Buka modal export untuk menjalankan 1-Klik AI Auto Enrich).'}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div style={{ padding: '12px 16px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: item.hasSummary ? 'var(--status-success)' : 'var(--status-warning)', fontWeight: 700 }}>
                      {item.hasSummary ? '✓ Full Android Standard' : '⚠️ Resep Lama'}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {item.hasVideo && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                          onClick={() => setActiveLightboxRecipe(item)}
                          title="Putar Video Ter-Mute (FFmpeg)"
                        >
                          <span>🔇</span> <span>Preview</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: '0.72rem' }}
                        onClick={() => setActiveExportRecipe(item)}
                      >
                        <span>🚀</span> <span>{item.isExported ? 'Re-Export' : 'Export'}</span>
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* Modal Tuning & Simulator */}
          {activeExportRecipe && (
            <RecipeExportModal
              recipe={activeExportRecipe}
              onClose={() => setActiveExportRecipe(null)}
              onSuccess={(res) => {
                // Refresh list resep untuk memperbarui status isExported
                fetchRecipes(source);
              }}
            />
          )}

          {/* Lightbox Dedicated Modal */}
          {activeLightboxRecipe && (
            <DedicatedVideoLightbox
              recipe={activeLightboxRecipe}
              onClose={() => setActiveLightboxRecipe(null)}
              onProceedToExport={(rec) => {
                setActiveLightboxRecipe(null);
                setActiveExportRecipe(rec);
              }}
            />
          )}

        </div>
      </main>
    </div>
  );
}
