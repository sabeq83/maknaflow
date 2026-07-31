'use client';

import Sidebar from '../components/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ContentPlannerDashboard() {
  const router = useRouter();
  const [planners, setPlanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Form State
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
  const [plannerCount, setPlannerCount] = useState(12);
  const [targetAudience, setTargetAudience] = useState('genz_casual');
  const [customTargetAudience, setCustomTargetAudience] = useState('');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);

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

  useEffect(() => {
    fetchPlanners();
    fetch('/api/product-agent').then(r => r.json()).then(d => { if (d.success) setExistingProducts(d.data || []); }).catch(() => {});
    fetch('/api/v2/brand-profiles').then(r => r.json()).then(d => { if (d.success) setBrandProfiles(d.data || []); }).catch(() => {});
  }, []);

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

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!productName || !productDesc) {
      showToast('Nama Produk dan Deskripsi Wajib Diisi', 'error');
      return;
    }

    const selectedBrand = brandProfiles.find(b => b.id === selectedBrandId);
    const effectiveAccountName = (
      selectedBrand?.brand_name ||
      accountName ||
      productName
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
          title: title || `Planner - ${productName}`,
          account_name: effectiveAccountName,
          google_sheet_id: (googleSheetId || '').trim(),
          input_mode: inputMode,
          brand_id: selectedBrandId || null,
          product_id: selectedProductId || null,
          product_name: productName,
          product_description: productDesc,
          product_usp: productUsp,
          product_url: productUrl.trim(),
          affiliate_url: affiliateUrl.trim(),
          product_photo_url: productPhotoUrl.trim(),
          platform,
          objective,
          planner_count: plannerCount,
          target_audience: effectiveTargetAudience
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

      <main className="main-content" style={{ padding: '32px', background: '#0a0a0c', minHeight: '100vh', color: '#f3f4f6' }}>
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            padding: '12px 24px', borderRadius: '8px',
            background: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#fff', fontWeight: 600, boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>🗓️</span> Content Planner Web App
            </h1>
            <p style={{ color: '#9ca3af', marginTop: '6px', fontSize: '14px' }}>
              Mesin perencanaan konten strategis 9-kolom berbasis Strategic Frameworks & Decision Tree AI (VFO, CEP, W'S Matrix, Strategic Angle).
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '12px 24px', background: 'linear-[#6366f1, #4f46e5]',
              backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'
            }}
          >
            <span>✨</span> Buat Content Planner Baru
          </button>
        </div>

        {/* Planner List Grid */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>Memuat daftar planner...</div>
        ) : planners.length === 0 ? (
          <div style={{
            padding: '64px 24px', textAlign: 'center', background: '#121318',
            borderRadius: '16px', border: '1px stroke #1e2029'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗓️</div>
            <h3 style={{ fontSize: '20px', color: '#f3f4f6', marginBottom: '8px' }}>Belum ada Content Planner</h3>
            <p style={{ color: '#9ca3af', maxWidth: '480px', margin: '0 auto 24px' }}>
              Mulai buat perencanaan konten terstruktur 9 kolom untuk produk Anda dalam hitungan detik.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '10px 20px', background: '#4f46e5', color: '#fff',
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
                    background: '#121318', border: '1px solid #27272a', borderRadius: '14px',
                    padding: '20px', cursor: 'pointer', transition: 'all 0.2s ease',
                    position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#27272a'}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#fff' }}>{p.title}</h4>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px',
                        background: isDraft ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isDraft ? '#f59e0b' : '#10b981'
                      }}>
                        {isDraft ? 'Draft' : `${p.row_count || 0} Baris`}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📦 {p.product_name}
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
                          background: isExecuting ? '#312e81' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                          color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700,
                          cursor: isExecuting ? 'not-allowed' : 'pointer', fontSize: '13px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
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
                            background: syncingIds[p.id] ? '#064e3b' : '#065f46',
                            color: '#34d399', border: '1px solid #059669', borderRadius: '8px', fontWeight: 600,
                            cursor: syncingIds[p.id] ? 'not-allowed' : 'pointer', fontSize: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                          }}
                        >
                          {syncingIds[p.id] ? '⏳ Menyinkronkan...' : '📊 Sync ke Google Sheet'}
                        </button>
                      ) : null
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #1f2937', fontSize: '12px', color: '#6b7280' }}>
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
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
          }}>
            <div style={{
              background: '#121318', border: '1px solid #27272a', borderRadius: '16px',
              width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#fff' }}>
                  ✨ Generator Content Planner Baru
                </h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleGenerate}>
                {/* Input Mode Selector */}
                <div style={{ marginBottom: '20px', background: '#18181b', padding: '4px', borderRadius: '10px', display: 'flex' }}>
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer',
                      background: inputMode === 'manual' ? '#4f46e5' : 'transparent',
                      color: inputMode === 'manual' ? '#fff' : '#9ca3af'
                    }}
                  >
                    ✏️ Direct Manual Input (Instan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('existing')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer',
                      background: inputMode === 'existing' ? '#4f46e5' : 'transparent',
                      color: inputMode === 'existing' ? '#fff' : '#9ca3af'
                    }}
                  >
                    📦 Pilih dari Database Produk
                  </button>
                </div>

                {inputMode === 'existing' && (
                  <div style={{ marginBottom: '16px', background: '#18181b', padding: '14px', borderRadius: '10px', border: '1px solid #27272a' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '8px', fontWeight: 600 }}>
                      🔍 Cari & Pilih Produk dari Database:
                    </label>
                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ketik untuk mencari nama produk..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        style={{
                          width: '100%', padding: '10px 36px 10px 12px', background: '#09090b',
                          border: '1px solid #3f3f46', borderRadius: '8px', color: '#fff', fontSize: '13px'
                        }}
                      />
                      {productSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setProductSearchQuery('')}
                          style={{
                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '14px'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Filtered Product Selection List */}
                    <div style={{ maxHeight: '160px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #27272a', background: '#09090b' }}>
                      {existingProducts.filter(p => (p.product_name || '').toLowerCase().includes(productSearchQuery.toLowerCase())).length === 0 ? (
                        <div style={{ padding: '12px', fontSize: '13px', color: '#71717a', textAlign: 'center' }}>
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
                                  background: isSelected ? '#312e81' : 'transparent',
                                  color: isSelected ? '#818cf8' : '#e4e4e7',
                                  fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#27272a'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div>
                                  <div style={{ fontWeight: isSelected ? 700 : 500 }}>{p.product_name}</div>
                                  {p.unique_selling_point && (
                                    <div style={{ fontSize: '11px', color: isSelected ? '#a5b4fc' : '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '380px' }}>
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
                {selectedProductId && (
                  <div style={{
                    marginBottom: '16px', padding: '12px 14px', borderRadius: '10px',
                    background: 'rgba(6, 78, 59, 0.25)', border: '1px solid rgba(16, 185, 129, 0.4)',
                    display: 'flex', gap: '12px', alignItems: 'center'
                  }}>
                    <div style={{
                      width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0,
                      background: '#18181b', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center'
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
                          background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)'
                        }}>
                          ✓ Product Image Verified
                        </span>
                        <span style={{ fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {productPhotoUrl ? productPhotoUrl.split('/').pop() : 'Tanpa foto clean'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {productName || 'Tanpa Nama Produk'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {productUsp || productDesc || 'Visual produk siap digunakan untuk ideasi & kampanye.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Brand Profile Dropdown (Taruh di atas Judul Planner) */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>
                    🧬 Brand Profile (Akun Brand):
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={e => {
                      const bId = e.target.value;
                      setSelectedBrandId(bId);
                      const b = brandProfiles.find(item => item.id === bId);
                      const acc = b ? (b.brand_name || '') : accountName;
                      if (b) {
                        setAccountName(b.brand_name || '');
                      }
                      if (!isTitleManuallyEdited || !title) {
                        const autoTitle = generateAutofillTitle(acc, productName);
                        if (autoTitle) setTitle(autoTitle);
                      }
                    }}
                    style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                  >
                    <option value="">-- Pilih Brand Profile (Opsional) --</option>
                    {brandProfiles.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.brand_name} {b.niche ? `(${b.niche})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 600 }}>Judul Planner (Opsional):</label>
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
                      style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
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
                    style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Nama Produk *:</label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Premium Cocoa Powder / Ceramide Moisturizer"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Deskripsi Produk & Manfaat *:</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Jelaskan fungsi utama, bahan, dan manfaat produk untuk pengguna..."
                    value={productDesc}
                    onChange={e => setProductDesc(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>USP / Unique Selling Point:</label>
                  <input
                    type="text"
                    placeholder="misal: 5X Ceramide, Halal MUI, Tekstur gel dingin instan"
                    value={productUsp}
                    onChange={e => setProductUsp(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                {/* URL Fields */}
                {inputMode === 'manual' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>URL Produk:</label>
                        <input
                          type="text"
                          placeholder="https://shopee.co.id/product/..."
                          value={productUrl}
                          onChange={e => setProductUrl(e.target.value)}
                          style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>URL Affiliate:</label>
                        <input
                          type="text"
                          placeholder="https://shope.ee/..."
                          value={affiliateUrl}
                          onChange={e => setAffiliateUrl(e.target.value)}
                          style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>URL Foto Produk:</label>
                      <input
                        type="text"
                        placeholder="https://images.shopee.co.id/..."
                        value={productPhotoUrl}
                        onChange={e => setProductPhotoUrl(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                        🔗 URL Produk (Otomatis Ditarik):
                      </label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={productUrl}
                        onChange={e => setProductUrl(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#818cf8', marginBottom: '6px', fontWeight: 700 }}>
                        🛍️ URL Affiliate Kampanye (Isi Di Sini):
                      </label>
                      <input
                        type="text"
                        placeholder="https://shope.ee/..."
                        value={affiliateUrl}
                        onChange={e => setAffiliateUrl(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#1e1b4b', border: '1px solid #6366f1', borderRadius: '8px', color: '#fff', fontWeight: 600 }}
                      />
                    </div>
                  </div>
                )}

                {/* Target Demografi Audiens (Preset Prompt Builder) */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>
                    🎯 Target Demografi Audiens (Personalitas Hook):
                  </label>
                  <select
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
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
                      style={{ width: '100%', padding: '10px', marginTop: '8px', background: '#18181b', border: '1px solid #6366f1', borderRadius: '8px', color: '#fff' }}
                    />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Platform Target:</label>
                    <select
                      value={platform}
                      onChange={e => setPlatform(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="tiktok">TikTok (Short Form)</option>
                      <option value="reels">Instagram Reels</option>
                      <option value="youtube_shorts">YouTube Shorts</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>Jumlah Baris Planner:</label>
                    <select
                      value={plannerCount}
                      onChange={e => setPlannerCount(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="6">6 Baris Plan (1x CEP)</option>
                      <option value="12">12 Baris Plan (2x CEP - Standar)</option>
                      <option value="18">18 Baris Plan (3x CEP)</option>
                      <option value="24">24 Baris Plan (4x CEP - Massal)</option>
                      <option value="30">30 Baris Plan (5x CEP - Maksimal)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  style={{
                    width: '100%', padding: '14px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
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
