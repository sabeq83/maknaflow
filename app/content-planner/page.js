'use client';

import Sidebar from '../components/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getBrandEditorialDefaults, shouldHydrateBrandEditorial } from '@/lib/brand-editorial-defaults';
import { DEFAULT_EDITORIAL_ROWS_PER_PILLAR, getBrandEditorialCountOptions } from '@/lib/content-planner-contract';

export default function ContentPlannerDashboard() {
  const router = useRouter();
  const [planners, setPlanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Form State
  const [plannerFocus, setPlannerFocus] = useState('product_campaign');
  const [brandContext, setBrandContext] = useState('');
  const [contentGoal, setContentGoal] = useState('');
  const [pillars, setPillars] = useState([]);
  const [pillarDraft, setPillarDraft] = useState('');
  const [pillarDistributionMode, setPillarDistributionMode] = useState('balanced');
  const [inputMode, setInputMode] = useState('manual'); // 'manual' or 'existing'
  const [accountName, setAccountName] = useState('');
  const [googleSheetId, setGoogleSheetId] = useState('');
  const [title, setTitle] = useState('');
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productUsp, setProductUsp] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [productPhotoUrl, setProductPhotoUrl] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [objective, setObjective] = useState('soft_sell');
  const [productPlannerCount, setProductPlannerCount] = useState(12);
  const [editorialRowsPerPillar, setEditorialRowsPerPillar] = useState(DEFAULT_EDITORIAL_ROWS_PER_PILLAR);
  const [editorialCountNotice, setEditorialCountNotice] = useState('');
  const [targetAudience, setTargetAudience] = useState('genz_casual');
  const [customTargetAudience, setCustomTargetAudience] = useState('');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [editorialDirty, setEditorialDirty] = useState(false);
  const [editorialSource, setEditorialSource] = useState('empty');
  const [pendingEditorialBrandId, setPendingEditorialBrandId] = useState('');

  // World-Aware state (Tahap 1)
  const [contentWorld, setContentWorld] = useState('real_world');
  const [knowledgeDomain, setKnowledgeDomain] = useState('general');
  const [universeProfile, setUniverseProfile] = useState(null);
  const [availableUniverses, setAvailableUniverses] = useState([]);
  const [selectedUniverseInfo, setSelectedUniverseInfo] = useState(null);

  function generateAutofillTitle(accName, prodName) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const cleanAcc = (accName || '').trim();
    const words = (prodName || '').trim().split(/\s+/).filter(Boolean);
    const twoWordsProd = words.slice(0, 2).join(' ');

    if (cleanAcc && twoWordsProd) {
      return `${cleanAcc} - ${dateStr} - ${twoWordsProd}`;
    } else if (twoWordsProd) {
      return `${dateStr} - ${twoWordsProd}`;
    } else if (cleanAcc) {
      return `${cleanAcc} - ${dateStr}`;
    }
    return '';
  }

  // Existing Product / Brand Selection State
  const [existingProducts, setExistingProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [executingIds, setExecutingIds] = useState({});
  const [syncingIds, setSyncingIds] = useState({});
  const editorialCountOptions = getBrandEditorialCountOptions(pillars.length);
  const maxEditorialRowsPerPillar = editorialCountOptions.length;
  const effectiveEditorialRowsPerPillar = maxEditorialRowsPerPillar > 0
    ? Math.min(editorialRowsPerPillar, maxEditorialRowsPerPillar)
    : 0;
  const effectivePlannerCount = plannerFocus === 'brand_editorial'
    ? pillars.length * effectiveEditorialRowsPerPillar
    : Number(productPlannerCount);

  useEffect(() => {
    fetchPlanners();
    fetch('/api/v2/brand-profiles').then(r => r.json()).then(d => { if (d.success) setBrandProfiles(d.data || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (plannerFocus !== 'product_campaign' || inputMode !== 'existing') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ limit: '100' });
      if (productSearchQuery.trim()) query.set('search', productSearchQuery.trim());
      fetch(`/api/v2/products?${query}`, { signal: controller.signal }).then(r => r.json()).then(d => { if (d.success) setExistingProducts(d.data || []); }).catch(error => { if (error.name !== 'AbortError') setExistingProducts([]); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [plannerFocus, inputMode, productSearchQuery]);

  useEffect(() => {
    if (maxEditorialRowsPerPillar > 0 && editorialRowsPerPillar > maxEditorialRowsPerPillar) {
      setEditorialRowsPerPillar(maxEditorialRowsPerPillar);
      setEditorialCountNotice(`Jumlah ide disesuaikan menjadi ${maxEditorialRowsPerPillar} per pilar agar total tidak melebihi 30 baris.`);
      return;
    }
  }, [editorialRowsPerPillar, maxEditorialRowsPerPillar]);

  // Fetch available universes when cartoon_universe is selected
  useEffect(() => {
    if (contentWorld === 'cartoon_universe') {
      fetch('/api/v2/universe-profiles').then(r => r.json()).then(data => {
        if (data.success && data.data) {
          setAvailableUniverses(data.data);
          // Auto-select first if none selected
          if (!universeProfile && data.data.length > 0) {
            const first = data.data[0];
            setUniverseProfile(first.slug);
            setKnowledgeDomain(first.knowledge_domain || 'general');
            setSelectedUniverseInfo(first);
          } else if (universeProfile) {
            const found = data.data.find(p => p.slug === universeProfile);
            if (found) setSelectedUniverseInfo(found);
          }
        }
      }).catch(() => {
        // Fallback: keep PawVille as static option
        setAvailableUniverses([{ slug: 'pawville', name: 'PawVille Pet Universe', knowledge_domain: 'pet_supplies', default_visual_style: 'cinematic_3d_clay', default_scene_count: 7, default_scene_duration: 8, human_presence: 'none' }]);
      });
    } else {
      setAvailableUniverses([]);
      setSelectedUniverseInfo(null);
    }
  }, [contentWorld]);

  async function fetchPlanners() {
    try {
      setLoading(true);
      const res = await fetch('/api/content-planner');
      const data = await res.json();
      if (data.success) {
        setPlanners(data.planners || []);
      }
    } catch (e) {
      showToast('Gagal memuat daftar planner: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectExistingProduct(prodId) {
    setSelectedProductId(prodId);
    const prod = existingProducts.find(p => p.id === prodId);
    if (prod) {
      setProductName(prod.product_name || '');
      setProductDesc(prod.product_description || '');
      setProductUsp(prod.unique_selling_point || '');

      // Extract product URL (supports input_source when is_url=1 or startsWith http, as well as product_url / source_product_url)
      const detectedUrl = prod.product_url || prod.source_product_url || (
        (prod.is_url === 1 || (prod.input_source || '').startsWith('http')) ? prod.input_source : ''
      );
      setProductUrl(detectedUrl || '');

      // Extract product photo URL if available (prioritize clean_photo_url/cleaned_photo_url)
      const detectedPhoto = prod.clean_photo_url || prod.cleaned_photo_url || prod.photo_url || prod.product_photo_url || prod.product_image_url || '';
      setProductPhotoUrl(detectedPhoto || '');

      // Extract target audience if available
      if (prod.target_audience) {
        const presets = ['genz_casual', 'ibu_rumah_tangga', 'professional_executive', 'hijab_syari_family', 'fitness_health_enthusiast'];
        if (presets.includes(prod.target_audience)) {
          setTargetAudience(prod.target_audience);
          setCustomTargetAudience('');
        } else {
          setTargetAudience('custom');
          setCustomTargetAudience(prod.target_audience);
        }
      }

      // Auto-fill Title if title was not manually edited or is empty
      if (!isTitleManuallyEdited || !title) {
        const selectedBrand = brandProfiles.find(b => b.id === selectedBrandId);
        const effectiveAcc = selectedBrand?.brand_name || accountName;
        const autoTitle = generateAutofillTitle(effectiveAcc, prod.product_name);
        if (autoTitle) {
          setTitle(autoTitle);
        }
      }
    }
  }

  function applyBrandEditorialDefaults(profile) {
    if (!profile) return;
    const defaults = getBrandEditorialDefaults(profile);
    setBrandContext(defaults.brandContext);
    setContentGoal(defaults.contentGoal);
    setPillars(defaults.pillars);
    setPillarDraft('');
    setEditorialDirty(false);
    setEditorialSource('profile');
    setPendingEditorialBrandId('');
  }

  function handleBrandSelection(brandId) {
    setSelectedBrandId(brandId);
    const brand = brandProfiles.find(item => item.id === brandId);
    const nextAccount = brand?.brand_name || accountName;
    if (brand) setAccountName(brand.brand_name || '');
    if (!isTitleManuallyEdited || !title) {
      const autoTitle = generateAutofillTitle(nextAccount, productName);
      if (autoTitle) setTitle(autoTitle);
    }
    if (plannerFocus !== 'brand_editorial' || !brand) return;
    if (!shouldHydrateBrandEditorial({ dirty: editorialDirty, brandContext, contentGoal, pillars })) {
      setPendingEditorialBrandId(brandId);
      return;
    }
    applyBrandEditorialDefaults(brand);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (plannerFocus === 'product_campaign' && (!productName || !productDesc)) {
      showToast('Nama Produk dan Deskripsi Wajib Diisi', 'error');
      return;
    }
    if (plannerFocus === 'brand_editorial' && (!brandContext.trim() || pillars.length === 0)) {
      showToast('Konteks Brand dan minimal satu Pilar Konten wajib diisi', 'error');
      return;
    }

    const selectedBrand = brandProfiles.find(b => b.id === selectedBrandId);
    const effectiveAccountName = (
      selectedBrand?.brand_name ||
      accountName ||
      (plannerFocus === 'brand_editorial' ? 'Editorial' : productName)
    ).trim();

    const effectiveTargetAudience = targetAudience === 'custom'
      ? (customTargetAudience.trim() || 'General Audience')
      : targetAudience;

    try {
      setGenerating(true);
      const res = await fetch('/api/content-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || `Planner - ${plannerFocus === 'brand_editorial' ? effectiveAccountName : productName}`,
          account_name: effectiveAccountName,
          google_sheet_id: (googleSheetId || '').trim(),
          input_mode: inputMode,
          planner_focus: plannerFocus,
          brand_context: brandContext.trim(),
          content_goal: contentGoal.trim(),
          pillars,
          pillar_distribution_mode: pillarDistributionMode,
          brand_id: selectedBrandId || null,
          product_id: selectedProductId || null,
          product_name: plannerFocus === 'product_campaign' ? productName : null,
          product_description: plannerFocus === 'product_campaign' ? productDesc : null,
          product_usp: plannerFocus === 'product_campaign' ? productUsp : null,
          product_url: plannerFocus === 'product_campaign' ? productUrl.trim() : null,
          affiliate_url: plannerFocus === 'product_campaign' ? affiliateUrl.trim() : null,
          product_photo_url: plannerFocus === 'product_campaign' ? productPhotoUrl.trim() : null,
          platform,
          objective,
          planner_count: effectivePlannerCount,
          target_audience: effectiveTargetAudience,
          // World-Aware fields (Tahap 1)
          content_world: contentWorld,
          knowledge_domain: knowledgeDomain,
          universe_profile: universeProfile,
          universe_config_json: selectedUniverseInfo ? JSON.stringify({
            visual_style: selectedUniverseInfo.default_visual_style || 'cinematic_3d_clay',
            human_presence: selectedUniverseInfo.human_presence || 'none',
            scene_count: selectedUniverseInfo.default_scene_count || 7,
            scene_duration: selectedUniverseInfo.default_scene_duration || 8,
            aspect_ratio: selectedUniverseInfo.default_aspect_ratio || '9:16',
          }) : null,
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Draft Content Planner Berhasil Disimpan!');
        setShowModal(false);
        fetchPlanners();
      } else {
        showToast('Gagal menyimpan draft planner: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleExecutePlanner(id, e) {
    if (e) e.stopPropagation();
    try {
      setExecutingIds(prev => ({ ...prev, [id]: true }));
      showToast('Memulai 3-Fase AI Pipeline...');
      const res = await fetch(`/api/content-planner/${id}/execute`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast('AI Content Planner Berhasil Dieksekusi!');
        fetchPlanners();
      } else {
        showToast('Gagal eksekusi AI: ' + data.error, 'error');
        fetchPlanners();
      }
    } catch (e) {
      showToast('Error eksekusi: ' + e.message, 'error');
    } finally {
      setExecutingIds(prev => ({ ...prev, [id]: false }));
    }
  }

  async function handleSyncSheets(id, e) {
    if (e) e.stopPropagation();
    try {
      setSyncingIds(prev => ({ ...prev, [id]: true }));
      showToast('Menulis data ke Google Sheet...');
      const res = await fetch(`/api/content-planner/${id}/sync-sheets`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Berhasil sinkronisasi ${data.synced_rows} baris ke Tab "${data.tab_name}" di Google Sheet! ✨`);
        fetchPlanners();
      } else {
        showToast('Gagal sinkronisasi Google Sheet: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error sync: ' + e.message, 'error');
    } finally {
      setSyncingIds(prev => ({ ...prev, [id]: false }));
    }
  }

  async function handleDeletePlanner(id, e) {
    e.stopPropagation();
    if (!confirm('Yakin ingin menghapus Content Planner ini beserta seluruh barisnya?')) return;
    try {
      const res = await fetch(`/api/content-planner/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Planner berhasil dihapus');
        fetchPlanners();
      }
    } catch (e) {
      showToast('Gagal menghapus: ' + e.message, 'error');
    }
  }

  return (
    <div className="layout-with-sidebar">
      <Sidebar />

      <main className="main-content" style={{ padding: '32px', background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            padding: '12px 24px', borderRadius: '8px',
            background: toast.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)',
            color: 'var(--text-primary)', fontWeight: 600, boxShadow: '0 10px 25px var(--overlay-subtle)'
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>🗓️</span> Content Planner Web App
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '14px' }}>
              Mesin perencanaan konten strategis 9-kolom berbasis Strategic Frameworks & Decision Tree AI (VFO, CEP, W'S Matrix, Strategic Angle).
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '12px 24px',
              background: 'var(--action-primary)',
              color: 'var(--on-action-primary)', border: 'none', borderRadius: '10px', fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 14px var(--status-neutral-soft)',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'
            }}
          >
            <span>✨</span> Buat Content Planner Baru
          </button>
        </div>

        {/* Planner List Grid */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat daftar planner...</div>
        ) : planners.length === 0 ? (
          <div style={{
            padding: '64px 24px', textAlign: 'center', background: 'var(--bg-secondary)',
            borderRadius: '16px', border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗓️</div>
            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px' }}>Belum ada Content Planner</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 24px' }}>
              Mulai buat perencanaan konten terstruktur 9 kolom untuk produk Anda dalam hitungan detik.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '10px 20px', background: 'var(--status-neutral)', color: 'var(--text-primary)',
                border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Buat Planner Pertama
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {planners.map(p => {
              const isDraft = p.status === 'draft' || !p.row_count || p.row_count === 0;
              const isExecuting = executingIds[p.id] || p.status === 'generating';

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/content-planner/${p.id}`)}
                  style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '14px',
                    padding: '20px', cursor: 'pointer', transition: 'all 0.2s ease',
                    position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--status-neutral)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{p.title}</h4>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px',
                        background: isDraft ? 'var(--status-warning-soft)' : 'var(--status-success-soft)',
                        color: isDraft ? 'var(--status-warning)' : 'var(--status-success)'
                      }}>
                        {isDraft ? 'Draft' : `${p.row_count || 0} Baris`}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {p.planner_focus === 'brand_editorial' ? '🧩 Brand Editorial' : `📦 ${p.product_name}`}
                    </p>
                  </div>

                  <div>
                    {isDraft ? (
                      <button
                        type="button"
                        onClick={(e) => handleExecutePlanner(p.id, e)}
                        disabled={isExecuting}
                        style={{
                          width: '100%', padding: '10px', marginBottom: '12px',
                          background: isExecuting ? 'var(--status-neutral-soft)' : 'linear-gradient(135deg, var(--status-neutral) 0%, var(--status-neutral) 100%)',
                          color: 'var(--text-primary)', border: 'none', borderRadius: '8px', fontWeight: 700,
                          cursor: isExecuting ? 'not-allowed' : 'pointer', fontSize: '13px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          boxShadow: '0 4px 12px var(--status-neutral-soft)'
                        }}
                      >
                        {isExecuting ? '⏳ Memproses 3-Fase AI...' : '🚀 Eksekusi AI Pipeline'}
                      </button>
                    ) : (
                      p.google_sheet_id ? (
                        <button
                          type="button"
                          onClick={(e) => handleSyncSheets(p.id, e)}
                          disabled={syncingIds[p.id]}
                          style={{
                            width: '100%', padding: '8px 12px', marginBottom: '12px',
                            background: syncingIds[p.id] ? 'var(--status-success-soft)' : 'var(--status-success-soft)',
                            color: 'var(--status-success)', border: '1px solid var(--status-success)', borderRadius: '8px', fontWeight: 600,
                            cursor: syncingIds[p.id] ? 'not-allowed' : 'pointer', fontSize: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                          }}
                        >
                          {syncingIds[p.id] ? '⏳ Menyinkronkan...' : '📊 Sync ke Google Sheet'}
                        </button>
                      ) : null
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #1f2937', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>📊 {p.row_count || 0} / {p.planner_count || 12} Baris Plan</span>
                      <span>{new Date(p.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Generator */}
        {showModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
          }}>
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '16px',
              width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  ✨ Generator Content Planner Baru
                </h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleGenerate}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                    🧭 Fokus Planner:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      ['brand_editorial', '🧩 Brand Editorial', 'Berbasis brand, audiens, dan pilar. Produk tidak wajib.'],
                      ['product_campaign', '📦 Product Campaign', 'Berpusat pada satu produk tertentu.']
                    ].map(([value, label, desc]) => (
                      <button key={value} type="button" onClick={() => setPlannerFocus(value)} style={{
                        padding: '12px', textAlign: 'left', borderRadius: '10px', cursor: 'pointer',
                        border: plannerFocus === value ? '1px solid var(--status-neutral)' : '1px solid var(--border-subtle)',
                        background: plannerFocus === value ? 'var(--status-neutral-soft)' : 'var(--bg-secondary)', color: 'var(--text-primary)'
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* === Content World Selector (Tahap 1) === */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                    🌍 Dunia Konten:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      ['real_world', '🏠 Dunia Nyata', 'Konten realistis dengan manusia & produk nyata'],
                      ['cartoon_universe', '🎬 Cartoon Universe', 'Dunia karakter fiksi animasi']
                    ].map(([value, label, desc]) => (
                      <button key={value} type="button" onClick={() => {
                        setContentWorld(value);
                        if (value === 'cartoon_universe') {
                          setUniverseProfile('pawville');
                          setKnowledgeDomain('pet_supplies');
                        } else {
                          setUniverseProfile(null);
                          if (knowledgeDomain === 'pet_supplies' && value === 'real_world') {
                            // Keep pet_supplies if user already selected it
                          }
                        }
                      }} style={{
                        padding: '10px 8px', textAlign: 'left', borderRadius: '10px', cursor: 'pointer',
                        border: contentWorld === value ? '1px solid var(--status-neutral)' : '1px solid var(--border-subtle)',
                        background: contentWorld === value ? 'var(--status-neutral-soft)' : 'var(--bg-secondary)', color: 'var(--text-primary)'
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '3px' }}>{label}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.3 }}>{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Knowledge Domain Selector */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                    📚 Domain Pengetahuan:
                  </label>
                  <select
                    value={knowledgeDomain}
                    onChange={e => setKnowledgeDomain(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '10px',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                    }}
                  >
                    <option value="general">General</option>
                    <option value="pet_supplies">Pet Supplies</option>
                    <option value="food_culinary">Food &amp; Culinary</option>
                    <option value="history">History</option>
                    <option value="islamic_history">Islamic History</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="home_improvement">Home Improvement</option>
                    <option value="herbal">Herbal</option>
                  </select>
                </div>

                {/* Universe Profile (conditional - only for cartoon_universe) */}
                {contentWorld === 'cartoon_universe' && (
                  <div style={{
                    marginBottom: '20px', background: 'var(--status-neutral-soft)', border: '1px solid var(--status-neutral)',
                    borderRadius: '12px', padding: '16px'
                  }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--status-neutral)', marginBottom: '8px', fontWeight: 600 }}>
                      🏰 Universe Profile:
                    </label>
                    <select
                      value={universeProfile || ''}
                      onChange={e => {
                        const slug = e.target.value;
                        setUniverseProfile(slug);
                        const info = availableUniverses.find(u => u.slug === slug);
                        if (info) {
                          setSelectedUniverseInfo(info);
                          setKnowledgeDomain(info.knowledge_domain || 'general');
                        }
                      }}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        background: 'var(--status-neutral-soft)', border: '1px solid var(--status-neutral)', color: 'var(--text-primary)', fontSize: '14px'
                      }}
                    >
                      {availableUniverses.length === 0 && (
                        <option value="pawville">🐾 PawVille Pet Universe</option>
                      )}
                      {availableUniverses.map(u => (
                        <option key={u.slug} value={u.slug}>
                          {u.slug === 'pawville' ? '🐾' : u.slug === 'kitchentails' ? '🍳' : '🏰'} {u.name}
                        </option>
                      ))}
                    </select>
                    {selectedUniverseInfo && (
                      <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--status-neutral)', lineHeight: 1.5 }}>
                        <strong>Preset:</strong> {selectedUniverseInfo.default_visual_style || 'cinematic_3d_clay'} • {selectedUniverseInfo.default_scene_count || 7} Scene × {selectedUniverseInfo.default_scene_duration || 8}s • {selectedUniverseInfo.human_presence === 'none' ? 'No Human' : selectedUniverseInfo.human_presence}<br/>
                        {selectedUniverseInfo.tone && <><strong>Tone:</strong> {selectedUniverseInfo.tone}<br/></>}
                      </div>
                    )}
                    {!selectedUniverseInfo && (
                      <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--status-neutral)', lineHeight: 1.5 }}>
                        <strong>Preset:</strong> 3D Clay Style • 7 Scene × 8s • No Human<br/>
                        <strong>Karakter:</strong> Mochi (British Shorthair) • Dr. Paw (Shiba Inu) • Coco (Corgi) • Boba (Hamster) • Tofu (Rabbit)
                      </div>
                    )}
                  </div>
                )}

                {/* Input Mode Selector */}
                {plannerFocus === 'product_campaign' && <div style={{ marginBottom: '20px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', display: 'flex' }}>
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer',
                      background: inputMode === 'manual' ? 'var(--status-neutral)' : 'transparent',
                      color: inputMode === 'manual' ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    ✏️ Direct Manual Input (Instan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('existing')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer',
                      background: inputMode === 'existing' ? 'var(--status-neutral)' : 'transparent',
                      color: inputMode === 'existing' ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    📦 Pilih dari Database Produk
                  </button>
                </div>}

                {plannerFocus === 'product_campaign' && inputMode === 'existing' && (
                  <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                      🔍 Cari & Pilih Produk dari Database:
                    </label>
                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ketik untuk mencari nama produk..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        style={{
                          width: '100%', padding: '10px 36px 10px 12px', background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px'
                        }}
                      />
                      {productSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setProductSearchQuery('')}
                          style={{
                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Filtered Product Selection List */}
                    <div style={{ maxHeight: '160px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                      {existingProducts.filter(p => (p.product_name || '').toLowerCase().includes(productSearchQuery.toLowerCase())).length === 0 ? (
                        <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          Tidak ada produk ditemukan
                        </div>
                      ) : (
                        existingProducts
                          .filter(p => (p.product_name || '').toLowerCase().includes(productSearchQuery.toLowerCase()))
                          .map(p => {
                            const isSelected = selectedProductId === p.id;
                            return (
                              <div
                                key={p.id}
                                onClick={() => handleSelectExistingProduct(p.id)}
                                style={{
                                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #18181b',
                                  background: isSelected ? 'var(--status-neutral-soft)' : 'transparent',
                                  color: isSelected ? 'var(--status-neutral)' : 'var(--text-primary)',
                                  fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--border-subtle)'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div>
                                  <div style={{ fontWeight: isSelected ? 700 : 500 }}>{p.product_name}</div>
                                  {p.unique_selling_point && (
                                    <div style={{ fontSize: '11px', color: isSelected ? 'var(--status-neutral)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '380px' }}>
                                      {p.unique_selling_point}
                                    </div>
                                  )}
                                </div>
                                {isSelected && <span style={{ fontSize: '14px' }}>✓</span>}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}

                {/* Product Visual Verification Card */}
                {plannerFocus === 'product_campaign' && selectedProductId && (
                  <div style={{
                    marginBottom: '16px', padding: '12px 14px', borderRadius: '10px',
                    background: 'rgba(6, 78, 59, 0.25)', border: '1px solid var(--status-success-soft)',
                    display: 'flex', gap: '12px', alignItems: 'center'
                  }}>
                    <div style={{
                      width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {productPhotoUrl ? (
                        <img
                          src={productPhotoUrl.startsWith('http') || productPhotoUrl.startsWith('/api/') ? productPhotoUrl : `/api/v2/products/image?path=${encodeURIComponent(productPhotoUrl)}`}
                          alt={productName || 'Product'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{ fontSize: '24px' }}>📦</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                          background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success-soft)'
                        }}>
                          ✓ Product Image Verified
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {productPhotoUrl ? productPhotoUrl.split('/').pop() : 'Tanpa foto clean'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {productName || 'Tanpa Nama Produk'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {productUsp || productDesc || 'Visual produk siap digunakan untuk ideasi & kampanye.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Brand Profile Dropdown (Taruh di atas Judul Planner) */}
                {plannerFocus === 'brand_editorial' && <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>🧬 Brand Profile (Akun Brand) *:</label>
                    <select value={selectedBrandId} required onChange={e => handleBrandSelection(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}>
                      <option value="">-- Pilih Brand Profile --</option>
                      {brandProfiles.map(b => <option key={b.id} value={b.id}>{b.brand_name} {b.niche ? `(${b.niche})` : ''}</option>)}
                    </select>
                  </div>
                  {pendingEditorialBrandId && (
                    <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #92400e', background: 'var(--status-warning-soft)', color: 'var(--status-warning)', fontSize: '12px' }}>
                      Isian editorial sudah Anda ubah. Nilai tidak ditimpa otomatis.
                      <button type="button" onClick={() => applyBrandEditorialDefaults(brandProfiles.find(item => item.id === pendingEditorialBrandId))} style={{ marginLeft: '8px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--status-warning)', background: 'transparent', color: 'var(--status-warning)', cursor: 'pointer' }}>Muat default brand terpilih</button>
                    </div>
                  )}
                  {selectedBrandId && !pendingEditorialBrandId && (
                    <div style={{ marginBottom: '12px', color: editorialSource === 'profile' && !editorialDirty ? 'var(--status-success)' : 'var(--status-neutral)', fontSize: '12px' }}>
                      {editorialSource === 'profile' && !editorialDirty ? '✓ Default dari Brand Profile' : '✎ Disesuaikan untuk planner ini'}
                      {editorialDirty && <button type="button" onClick={() => applyBrandEditorialDefaults(brandProfiles.find(item => item.id === selectedBrandId))} style={{ marginLeft: '8px', border: 0, background: 'none', color: 'var(--status-neutral)', textDecoration: 'underline', cursor: 'pointer' }}>Muat ulang default</button>}
                    </div>
                  )}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>Konteks Brand *:</label>
                    <textarea required rows={3} maxLength={4000} placeholder="Jelaskan niche, positioning, dan nilai akun..." value={brandContext} onChange={e => { setBrandContext(e.target.value); setEditorialDirty(true); setEditorialSource('custom'); }} style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>Tujuan Konten:</label>
                    <textarea rows={2} maxLength={2000} placeholder="misal: Bangun authority, save, share, dan follow" value={contentGoal} onChange={e => { setContentGoal(e.target.value); setEditorialDirty(true); setEditorialSource('custom'); }} style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>Pilar Konten *:</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input value={pillarDraft} maxLength={120} onChange={e => setPillarDraft(e.target.value)} onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const value = pillarDraft.trim();
                          if (value && pillars.length < 12 && !pillars.some(p => p.toLowerCase() === value.toLowerCase())) { setPillars([...pillars, value]); setEditorialDirty(true); setEditorialSource('custom'); }
                          setPillarDraft('');
                        }
                      }} placeholder="misal: Healthy Breakfast" style={{ flex: 1, padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                      <button type="button" onClick={() => {
                        const value = pillarDraft.trim();
                        if (value && pillars.length < 12 && !pillars.some(p => p.toLowerCase() === value.toLowerCase())) { setPillars([...pillars, value]); setEditorialDirty(true); setEditorialSource('custom'); }
                        setPillarDraft('');
                      }} style={{ padding: '10px 14px', border: 0, borderRadius: '8px', background: 'var(--status-neutral)', color: 'var(--text-primary)', cursor: 'pointer' }}>+ Tambah</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                      {pillars.map((pillar, index) => <span key={pillar} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 9px', borderRadius: '999px', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px' }}>
                        {pillar}<button type="button" aria-label={`Hapus ${pillar}`} onClick={() => { setPillars(pillars.filter((_, i) => i !== index)); setEditorialDirty(true); setEditorialSource('custom'); }} style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>✕</button>
                      </span>)}
                      {pillars.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Belum ada pilar.</span>}
                    </div>
                    <select value={pillarDistributionMode} onChange={e => setPillarDistributionMode(e.target.value)} style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}>
                      <option value="balanced">Balanced — dibagi merata</option>
                      <option value="custom" disabled>Custom Weight — Segera Hadir</option>
                      <option value="growth" disabled>Growth Priority — Segera Hadir</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px', padding: '10px 12px', border: '1px solid var(--status-info)', borderRadius: '8px', background: 'var(--status-info-soft)', color: 'var(--status-info)', fontSize: '12px' }}>
                    🛡️ Produk tidak akan dikarang. CTA default diarahkan ke save, share, follow, atau comment.
                  </div>
                </>}

                {plannerFocus === 'product_campaign' && <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    🧬 Brand Profile (Akun Brand):
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={e => handleBrandSelection(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  >
                    <option value="">-- Pilih Brand Profile (Opsional) --</option>
                    {brandProfiles.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.brand_name} {b.niche ? `(${b.niche})` : ''}
                      </option>
                    ))}
                  </select>
                </div>}

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Judul Planner (Opsional):</label>
                    <button
                      type="button"
                      onClick={() => {
                        const selectedBrand = brandProfiles.find(b => b.id === selectedBrandId);
                        const acc = selectedBrand?.brand_name || accountName;
                        const autoTitle = generateAutofillTitle(acc, productName);
                        if (autoTitle) {
                          setTitle(autoTitle);
                          setIsTitleManuallyEdited(false);
                          showToast('✨ Judul planner berhasil di-autofill!', 'success');
                        } else {
                          showToast('Silakan isi Nama Produk atau Brand terlebih dahulu', 'error');
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--status-neutral)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      ✨ Auto-fill
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="namaakun - YYYYMMDD - 2 Kata nama produk"
                    value={title}
                    onChange={e => {
                      setTitle(e.target.value);
                      setIsTitleManuallyEdited(true);
                    }}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                </div>

                {plannerFocus === 'product_campaign' && <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Nama Produk *:</label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Premium Cocoa Powder / Ceramide Moisturizer"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Deskripsi Produk & Manfaat *:</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Jelaskan fungsi utama, bahan, dan manfaat produk untuk pengguna..."
                    value={productDesc}
                    onChange={e => setProductDesc(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>USP / Unique Selling Point:</label>
                  <input
                    type="text"
                    placeholder="misal: 5X Ceramide, Halal MUI, Tekstur gel dingin instan"
                    value={productUsp}
                    onChange={e => setProductUsp(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* URL Fields */}
                {inputMode === 'manual' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>URL Produk:</label>
                        <input
                          type="text"
                          placeholder="https://shopee.co.id/product/..."
                          value={productUrl}
                          onChange={e => setProductUrl(e.target.value)}
                          style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>URL Affiliate:</label>
                        <input
                          type="text"
                          placeholder="https://shope.ee/..."
                          value={affiliateUrl}
                          onChange={e => setAffiliateUrl(e.target.value)}
                          style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>URL Foto Produk:</label>
                      <input
                        type="text"
                        placeholder="https://images.shopee.co.id/..."
                        value={productPhotoUrl}
                        onChange={e => setProductPhotoUrl(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        🔗 URL Produk (Otomatis Ditarik):
                      </label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={productUrl}
                        onChange={e => setProductUrl(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--status-neutral)', marginBottom: '6px', fontWeight: 700 }}>
                        🛍️ URL Affiliate Kampanye (Isi Di Sini):
                      </label>
                      <input
                        type="text"
                        placeholder="https://shope.ee/..."
                        value={affiliateUrl}
                        onChange={e => setAffiliateUrl(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: 'var(--status-neutral-soft)', border: '1px solid var(--status-neutral)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600 }}
                      />
                    </div>
                  </div>
                )}
                </>}

                {/* Target Demografi Audiens (Preset Prompt Builder) */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    🎯 Target Demografi Audiens (Personalitas Hook):
                  </label>
                  <select
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  >
                    <option value="genz_casual">🔥 Gen-Z & Milenial Muda (Gaul, Santai, Relatable)</option>
                    <option value="ibu_rumah_tangga">🏡 Ibu Rumah Tangga & Keluarga (Hangat, Ramah, Solutif)</option>
                    <option value="professional_executive">💼 Profesional & Pekerja Kantoran (Lugas, Berbobot, Refined)</option>
                    <option value="hijab_syari_family">🧕 Komunitas Syari & Keluarga Hijrah (Santun, Islami Alami)</option>
                    <option value="fitness_health_enthusiast">💪 Penggiat Olahraga & Kesehatan (Energik, Motivatif, Informatif)</option>
                    <option value="custom">✏️ Custom / Bebas (Tentukan Sendiri...)</option>
                  </select>

                  {targetAudience === 'custom' && (
                    <input
                      type="text"
                      placeholder="Ketik deskripsi target audiens kustom (misal: Gamers 18-24th)..."
                      value={customTargetAudience}
                      onChange={e => setCustomTargetAudience(e.target.value)}
                      style={{ width: '100%', padding: '10px', marginTop: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--status-neutral)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Platform Target:</label>
                    <select
                      value={platform}
                      onChange={e => setPlatform(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    >
                      <option value="tiktok">TikTok (Short Form)</option>
                      <option value="reels">Instagram Reels</option>
                      <option value="youtube_shorts">YouTube Shorts</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Jumlah Baris Planner:</label>
                    <select
                      disabled={plannerFocus === 'brand_editorial' && pillars.length === 0}
                      value={plannerFocus === 'brand_editorial' ? effectiveEditorialRowsPerPillar : productPlannerCount}
                      onChange={e => {
                        if (plannerFocus === 'brand_editorial') {
                          setEditorialRowsPerPillar(Number(e.target.value));
                          setEditorialCountNotice('');
                        } else {
                          setProductPlannerCount(Number(e.target.value));
                        }
                      }}
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    >
                      {plannerFocus === 'brand_editorial' ? (
                        pillars.length === 0
                          ? <option value={0}>Masukkan Pilar Konten terlebih dahulu</option>
                          : editorialCountOptions.map(option => (
                            <option key={option.rowsPerPillar} value={option.rowsPerPillar}>
                              {option.label}{option.rowsPerPillar === DEFAULT_EDITORIAL_ROWS_PER_PILLAR ? ' (Direkomendasikan)' : ''}
                            </option>
                          ))
                      ) : <>
                        <option value="6">6 Baris Plan (1x CEP)</option>
                        <option value="12">12 Baris Plan (2x CEP - Standar)</option>
                        <option value="18">18 Baris Plan (3x CEP)</option>
                        <option value="24">24 Baris Plan (4x CEP - Massal)</option>
                        <option value="30">30 Baris Plan (5x CEP - Maksimal)</option>
                      </>}
                    </select>
                    {plannerFocus === 'brand_editorial' && editorialCountNotice && (
                      <div style={{ marginTop: '6px', color: 'var(--status-warning)', fontSize: '11px', lineHeight: 1.4 }}>
                        {editorialCountNotice}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  style={{
                    width: '100%', padding: '14px', background: 'linear-gradient(135deg, var(--status-neutral) 0%, var(--status-neutral) 100%)',
                    color: 'var(--text-primary)', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                    fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                  }}
                >
                  {generating ? '⏳ Menyimpan Draft Planner...' : '💾 Simpan Draft Planner'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
