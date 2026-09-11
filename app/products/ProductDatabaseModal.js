'use client';

import React, { useState, useEffect } from 'react';

export default function ProductDatabaseModal({
  isOpen,
  productId,
  product = null,
  brandId = null,
  brandName = null,
  onClose,
  onSuccess
}) {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [productBrandLinks, setProductBrandLinks] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [toastMsg, setToastMsg] = useState({ text: '', type: 'success' });

  // Form State
  const [formData, setFormData] = useState({
    product_name: product?.product_name || product?.name || '',
    product_description: product?.product_description || product?.description || '',
    category: product?.category || '',
    tags: Array.isArray(product?.tags) ? product.tags.join(', ') : (product?.tags || ''),
    affiliate_link: product?.affiliate_link || product?.affiliate_url || '',
    source_url: product?.source_url || '',
    packaging_status: product?.packaging_status || (product?.is_in_packaging ? 'packaged' : 'packaged'),
    packaging_type: product?.packaging_type || '',
    packaging_notes: product?.packaging_notes || '',
    unique_selling_point: product?.unique_selling_point || product?.usp || '',
    clean_photo_t2i_prompt: product?.clean_photo_t2i_prompt || '',
    product_truth: product?.product_truth || '',
    geometric_truth: product?.geometric_truth || '',
    photo_provider: product?.photo_provider || 'system_default',
  });

  const [rawPhotoFile, setRawPhotoFile] = useState(null);
  const [rawPhotoPreview, setRawPhotoPreview] = useState(null);
  const [regenerateOnSave, setRegenerateOnSave] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(product);

  // New link form state
  const [newLinkBrandId, setNewLinkBrandId] = useState(brandId || '');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTrackingCode, setNewLinkTrackingCode] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: 'success' }), 3500);
  };

  const activeProductId = productId || product?.id || product?.productId;

  // 1. Fetch full product detail if activeProductId is present
  useEffect(() => {
    if (!activeProductId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/v2/products/${activeProductId}`).then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/v2/brand-profiles').then(r => r.json()).catch(() => ({ success: false })),
      fetch(`/api/v2/products/${activeProductId}/brands`).then(r => r.json()).catch(() => ({ success: false }))
    ]).then(([prodRes, brandsRes, linksRes]) => {
      if (prodRes.success && prodRes.data) {
        const p = prodRes.data;
        setCurrentProduct(p);
        setFormData({
          product_name: p.product_name || '',
          product_description: p.product_description || p.raw_description || '',
          category: p.category || '',
          tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
          affiliate_link: p.affiliate_link || '',
          source_url: p.source_url || '',
          packaging_status: p.packaging_status || (p.is_in_packaging ? 'packaged' : 'packaged'),
          packaging_type: p.packaging_type || '',
          packaging_notes: p.packaging_notes || '',
          unique_selling_point: p.unique_selling_point || '',
          clean_photo_t2i_prompt: p.clean_photo_t2i_prompt || '',
          product_truth: p.product_truth || '',
          geometric_truth: p.geometric_truth || '',
          photo_provider: p.photo_provider || 'system_default',
        });
      }

      if (brandsRes.success && Array.isArray(brandsRes.data)) {
        setBrandProfiles(brandsRes.data);
        if (brandId) setNewLinkBrandId(brandId);
        else if (brandsRes.data.length > 0 && !newLinkBrandId) {
          setNewLinkBrandId(brandsRes.data[0].id);
        }
      }

      if (linksRes.success && Array.isArray(linksRes.data)) {
        setProductBrandLinks(linksRes.data);
      }
    }).finally(() => {
      setLoading(false);
    });
  }, [activeProductId, brandId]);

  const fetchBrandLinks = async () => {
    if (!activeProductId) return;
    try {
      const res = await fetch(`/api/v2/products/${activeProductId}/brands`);
      const data = await res.json();
      if (data.success) {
        setProductBrandLinks(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch brand links:', e);
    }
  };

  // Handle Photo selection
  const handleRawPhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormErrors(prev => ({ ...prev, raw_photo: 'Format file harus JPG, PNG, atau WebP' }));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setFormErrors(prev => ({ ...prev, raw_photo: 'Ukuran file maksimal 15MB' }));
      return;
    }

    setFormErrors(prev => {
      const next = { ...prev };
      delete next.raw_photo;
      return next;
    });
    setRawPhotoFile(file);
    setRawPhotoPreview(URL.createObjectURL(file));
  };

  // Client-side validation
  function validateProductForm() {
    const errors = {};
    if (!formData.product_name.trim() || formData.product_name.trim().length < 2) {
      errors.product_name = 'Nama produk wajib diisi (min 2 karakter)';
    }
    if (!formData.product_description.trim() || formData.product_description.trim().length < 10) {
      errors.product_description = 'Deskripsi produk wajib diisi (min 10 karakter)';
    }
    if (!activeProductId && !rawPhotoFile) {
      errors.raw_photo = 'Foto produk wajib diunggah saat membuat produk baru';
    }
    if (!formData.packaging_status) {
      errors.packaging_status = 'Status kemasan wajib dipilih';
    }
    if (formData.packaging_status === 'packaged' && !formData.packaging_type.trim()) {
      errors.packaging_type = 'Jenis kemasan wajib diisi jika produk dikemas';
    }
    return errors;
  }

  // Save full product via Multipart
  async function handleSaveProduct(e) {
    e.preventDefault();

    const errors = validateProductForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSaving(true);

    try {
      const payload = new FormData();
      const productPayload = {
        product_name: formData.product_name.trim(),
        product_description: formData.product_description.trim(),
        raw_description: formData.product_description.trim(),
        category: formData.category.trim() || null,
        tags: formData.tags.trim() || null,
        affiliate_link: formData.affiliate_link.trim() || null,
        source_url: formData.source_url.trim() || null,
        packaging_status: formData.packaging_status,
        packaging_type: formData.packaging_status === 'packaged' ? formData.packaging_type.trim() : null,
        packaging_notes: formData.packaging_notes?.trim() || null,
        unique_selling_point: formData.unique_selling_point.trim() || null,
        clean_photo_t2i_prompt: formData.clean_photo_t2i_prompt.trim() || null,
        product_truth: formData.product_truth.trim() || null,
        geometric_truth: formData.geometric_truth.trim() || null,
        photo_provider: formData.photo_provider !== 'system_default' ? formData.photo_provider : null,
      };
      payload.set('product', JSON.stringify(productPayload));
      if (rawPhotoFile) payload.set('raw_photo', rawPhotoFile);
      if (activeProductId && regenerateOnSave) payload.set('regenerate', 'true');

      const url = activeProductId
        ? `/api/v2/products/${activeProductId}`
        : '/api/v2/products';
      const method = activeProductId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: payload });
      const data = await res.json();

      if (data.success) {
        showToast(activeProductId ? '✅ Produk berhasil diperbarui!' : '✅ Produk berhasil ditambahkan!');
        onSuccess?.(data.data || currentProduct);
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        if (data.errors) {
          setFormErrors(data.errors);
        }
        showToast(data.error || Object.values(data.errors || {})[0] || 'Gagal menyimpan produk', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Save / update Brand Profile link
  async function handleSaveBrandLink() {
    if (!newLinkBrandId || !newLinkUrl.trim()) {
      showToast('Brand dan Affiliate Link wajib diisi.', 'error');
      return;
    }
    setSavingLink(true);
    try {
      const res = await fetch(`/api/v2/brand-profiles/${newLinkBrandId}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: activeProductId,
          affiliateLink: newLinkUrl.trim(),
          trackingCode: newLinkTrackingCode.trim() || null
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Link brand berhasil disimpan!');
        setNewLinkUrl('');
        setNewLinkTrackingCode('');
        fetchBrandLinks();
      } else {
        showToast(data.error || 'Gagal menyimpan link', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingLink(false);
    }
  }

  // Delete brand link
  async function handleDeleteBrandLink(link) {
    if (!confirm(`Hapus link affiliate untuk brand ${link.brand_name}?`)) return;
    try {
      const res = await fetch(`/api/v2/brand-profiles/${link.brand_profile_id}/products?productId=${activeProductId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑 Link brand ${link.brand_name} berhasil dihapus.`);
        fetchBrandLinks();
      } else {
        showToast(data.error || 'Gagal menghapus link', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-panel, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          border: '1px solid var(--border, #1e293b)',
          borderRadius: 'var(--radius, 16px)',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Toast Alert */}
        {toastMsg.text && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '24px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: toastMsg.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 700,
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            {toastMsg.text}
          </div>
        )}

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border, #1e293b)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✏️</span> Edit Data Produk (Product Database)
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
              {brandName ? `Brand Aktif: ${brandName} · ` : ''}ID: <code>{activeProductId}</code>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #94a3b8)', fontSize: '1.4rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '14px' }}>
            Memuat data produk...
          </div>
        ) : (
          <form onSubmit={handleSaveProduct}>
            {/* 1. Nama & Kategori */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.product_name ? 'var(--status-danger, #f87171)' : 'var(--text-muted, #94a3b8)' }}>
                  Nama Produk *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.product_name}
                  onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="Nama produk..."
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '13px', outline: 'none' }}
                />
                {formErrors.product_name && <span style={{ fontSize: '0.75rem', color: 'var(--status-danger, #f87171)', marginTop: '4px', display: 'block' }}>{formErrors.product_name}</span>}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                  Kategori
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Contoh: Kitchen & Dining"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>

            {/* 2. Tags & Fallback Link */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                  Tags (Pisah koma)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.tags}
                  onChange={e => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="pisau, dapur, praktis"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                  Default Affiliate Link (Legacy/Fallback)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.affiliate_link}
                  onChange={e => setFormData({ ...formData, affiliate_link: e.target.value })}
                  placeholder="https://shope.ee/..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>

            {/* 3. Deskripsi Produk */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.product_description ? 'var(--status-danger, #f87171)' : 'var(--text-muted, #94a3b8)' }}>
                Deskripsi Produk *
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                value={formData.product_description}
                onChange={e => setFormData({ ...formData, product_description: e.target.value })}
                placeholder="Deskripsi singkat mengenai produk (min 10 karakter)..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '13px', outline: 'none', resize: 'vertical' }}
              />
              {formErrors.product_description && <span style={{ fontSize: '0.75rem', color: 'var(--status-danger, #f87171)', marginTop: '4px', display: 'block' }}>{formErrors.product_description}</span>}
            </div>

            {/* 4. USP */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                Unique Selling Proposition (USP) - Satu Poin per Baris
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                value={formData.unique_selling_point}
                onChange={e => setFormData({ ...formData, unique_selling_point: e.target.value })}
                placeholder="- Bilah baja Jerman tahan karat&#10;- Gagang ergonomis kayu rosewood&#10;- Sangat presisi dan tajam"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical' }}
              />
            </div>

            {/* 5. Seksi Pengaturan Kemasan & Prompts AI */}
            <div style={{
              background: 'var(--surface-interactive, rgba(15, 23, 42, 0.8))',
              border: '1px solid var(--border, #1e293b)',
              borderRadius: 'var(--radius-sm, 10px)',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📦 Kemasan & Prompt AI
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px', alignItems: 'start' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.packaging_status ? 'var(--status-danger, #f87171)' : 'var(--text-muted, #94a3b8)' }}>
                    Status Kemasan *
                  </label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary, #f8fafc)' }}>
                      <input
                        type="radio"
                        name="packaging_status"
                        value="packaged"
                        checked={formData.packaging_status === 'packaged'}
                        onChange={e => setFormData({ ...formData, packaging_status: e.target.value })}
                        style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                      />
                      📦 Dikemas
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary, #f8fafc)' }}>
                      <input
                        type="radio"
                        name="packaging_status"
                        value="unpackaged"
                        checked={formData.packaging_status === 'unpackaged'}
                        onChange={e => setFormData({ ...formData, packaging_status: e.target.value })}
                        style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                      />
                      🔓 Tidak Dikemas
                    </label>
                  </div>
                  {formErrors.packaging_status && <span style={{ fontSize: '0.75rem', color: 'var(--status-danger, #f87171)', marginTop: '4px', display: 'block' }}>{formErrors.packaging_status}</span>}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.packaging_type ? 'var(--status-danger, #f87171)' : 'var(--text-muted, #94a3b8)' }}>
                    Jenis Kemasan {formData.packaging_status === 'packaged' ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.packaging_type}
                    onChange={e => setFormData({ ...formData, packaging_type: e.target.value })}
                    placeholder="Botol Kaca, Kotak Kardus, Pouch..."
                    disabled={formData.packaging_status !== 'packaged'}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '13px', opacity: formData.packaging_status === 'packaged' ? 1 : 0.4 }}
                  />
                  {formErrors.packaging_type && <span style={{ fontSize: '0.75rem', color: 'var(--status-danger, #f87171)', marginTop: '4px', display: 'block' }}>{formErrors.packaging_type}</span>}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#10b981' }}>
                  🛡️ Product Truth (T2I Physics & Packaging Lock)
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={formData.product_truth}
                  onChange={e => setFormData({ ...formData, product_truth: e.target.value })}
                  placeholder="Deskripsi fisik kemasan resmi produk untuk acuan render AI..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '12px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#c084fc' }}>
                  📐 Geometric Truth (I2V Geometry & Material Lock)
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={formData.geometric_truth}
                  onChange={e => setFormData({ ...formData, geometric_truth: e.target.value })}
                  placeholder="Deskripsi geometri wadah & fisika permukaan..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '12px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#60a5fa' }}>
                  ✨ Prompt Foto Clean (Clean Photo T2I Prompt)
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={formData.clean_photo_t2i_prompt}
                  onChange={e => setFormData({ ...formData, clean_photo_t2i_prompt: e.target.value })}
                  placeholder="Deskripsi visual untuk menghasilkan foto clean latar putih..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(96, 165, 250, 0.3)', background: 'var(--surface-interactive, #090e1a)', color: 'var(--text-primary, #f8fafc)', fontSize: '12px' }}
                />
              </div>

              {/* Upload Foto Raw */}
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.raw_photo ? 'var(--status-danger, #f87171)' : '#38bdf8' }}>
                  📷 Foto Produk Raw {!activeProductId ? '*' : '(Ganti Foto)'}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleRawPhotoSelect}
                  style={{ width: '100%', padding: '8px', background: '#090e1a', border: `1px dashed ${formErrors.raw_photo ? '#f87171' : '#38bdf8'}`, borderRadius: '8px', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer', fontSize: '12px' }}
                />
                {rawPhotoPreview && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={rawPhotoPreview} alt="Preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #38bdf8' }} />
                    <span style={{ fontSize: '12px', color: '#38bdf8' }}>✅ {rawPhotoFile?.name}</span>
                  </div>
                )}
                {formErrors.raw_photo && <span style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px', display: 'block' }}>{formErrors.raw_photo}</span>}
              </div>

              {/* Provider Selection */}
              <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                  🤖 Provider Foto Clean
                </label>
                <select
                  value={formData.photo_provider}
                  onChange={e => setFormData({ ...formData, photo_provider: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: '#090e1a', color: 'var(--text-primary, #f8fafc)', fontSize: '13px' }}
                >
                  <option value="system_default">🔧 Default Sistem</option>
                  <option value="glabs">🏭 G-Labs</option>
                  <option value="gemini">✨ Gemini AI</option>
                </select>
              </div>
            </div>

            {/* 6. Brand Profile Affiliate Links Section */}
            {activeProductId && (
              <div style={{ marginTop: '16px', padding: '16px', border: '1px solid var(--border, #1e293b)', borderRadius: '10px', background: 'var(--surface-interactive, rgba(15, 23, 42, 0.8))', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>
                  🔗 Affiliate Links per Brand Profile
                </h4>

                {/* List of active brand links */}
                {productBrandLinks.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '12px' }}>
                    Belum ada brand profile yang terhubung ke produk ini.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {productBrandLinks.map(link => (
                      <div key={link.brand_product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090e1a', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #1e293b)' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>{link.brand_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', wordBreak: 'break-all' }}>{link.affiliate_link}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteBrandLink(link)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '12px', cursor: 'pointer', padding: '4px 8px' }}
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add / Update Brand Link Form */}
                <div style={{ background: '#090e1a', padding: '12px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Tambah / Update Link Brand</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <select
                      value={newLinkBrandId}
                      onChange={e => setNewLinkBrandId(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border, #1e293b)', background: 'var(--bg-panel, #0f172a)', color: 'var(--text-primary, #f8fafc)', fontSize: '12px' }}
                    >
                      <option value="">-- Pilih Brand --</option>
                      {brandProfiles.map(bp => (
                        <option key={bp.id} value={bp.id}>{bp.brand_name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Tracking Code (Opsional)"
                      value={newLinkTrackingCode}
                      onChange={e => setNewLinkTrackingCode(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border, #1e293b)', background: 'var(--bg-panel, #0f172a)', color: 'var(--text-primary, #f8fafc)', fontSize: '12px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Affiliate Link (https://...)"
                      value={newLinkUrl}
                      onChange={e => setNewLinkUrl(e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border, #1e293b)', background: 'var(--bg-panel, #0f172a)', color: 'var(--text-primary, #f8fafc)', fontSize: '12px' }}
                    />
                    <button
                      type="button"
                      disabled={savingLink}
                      onClick={handleSaveBrandLink}
                      style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '12px', cursor: savingLink ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {savingLink ? 'Menyimpan...' : 'Simpan Link'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border, #1e293b)' }}>
              {activeProductId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginRight: 'auto', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={regenerateOnSave}
                    onChange={e => setRegenerateOnSave(e.target.checked)}
                    style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  Regenerate Foto & AI Enrichment saat disimpan
                </label>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border, #1e293b)', background: 'transparent', color: 'var(--text-primary, #f8fafc)', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#38bdf8', color: '#0f172a', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Menyimpan...' : (activeProductId ? '💾 Simpan Perubahan Produk' : '📦 Tambah Produk')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
