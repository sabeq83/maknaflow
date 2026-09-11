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

  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'visual_ai' | 'brand_links'
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
      if (errors.product_name || errors.product_description) {
        setActiveTab('basic');
      } else if (errors.raw_photo || errors.packaging_status || errors.packaging_type) {
        setActiveTab('visual_ai');
      }
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'var(--overlay-backdrop, rgba(2, 6, 14, 0.76))',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface, #101827)',
          color: 'var(--text-primary, #f4f7fb)',
          border: '1px solid var(--border-subtle, #26354a)',
          borderRadius: 'var(--radius-lg, 16px)',
          boxShadow: 'var(--shadow-modal, 0 26px 80px rgba(0, 0, 0, 0.52))',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Toast Alert */}
        {toastMsg.text && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '24px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm, 8px)',
            background: toastMsg.type === 'error' ? 'var(--status-danger, #fb7185)' : 'var(--action-primary, #2dd4bf)',
            color: toastMsg.type === 'error' ? '#ffffff' : 'var(--on-action-primary, #042f2e)',
            fontSize: '12px',
            fontWeight: 700,
            zIndex: 20,
            boxShadow: 'var(--shadow-card, 0 4px 12px rgba(0,0,0,0.3))'
          }}>
            {toastMsg.text}
          </div>
        )}

        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle, #26354a)',
          background: 'var(--surface-raised, #162235)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 750, color: 'var(--text-primary, #f4f7fb)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✏️</span> {activeProductId ? 'Edit Data Produk' : 'Tambah Produk Baru'}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #8290a5)' }}>
              {brandName ? `Brand: ${brandName} · ` : ''}ID: <code>{activeProductId || 'Baru'}</code>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #8290a5)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Semantic 3-Tab Navigation Bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle, #26354a)',
          background: 'var(--surface-raised, #162235)',
          padding: '0 16px',
          gap: '4px',
          overflowX: 'auto'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'basic' ? 'var(--surface-interactive, #1c2a40)' : 'transparent',
              borderBottom: activeTab === 'basic' ? '2px solid var(--action-primary, #2dd4bf)' : '2px solid transparent',
              color: activeTab === 'basic' ? 'var(--action-primary, #2dd4bf)' : 'var(--text-muted, #8290a5)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderTopLeftRadius: '6px',
              borderTopRightRadius: '6px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>📝</span> Info Dasar & USP
            {(formErrors.product_name || formErrors.product_description) && (
              <span style={{ color: 'var(--status-danger, #fb7185)', fontSize: '11px' }}>●</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('visual_ai')}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'visual_ai' ? 'var(--surface-interactive, #1c2a40)' : 'transparent',
              borderBottom: activeTab === 'visual_ai' ? '2px solid var(--action-primary, #2dd4bf)' : '2px solid transparent',
              color: activeTab === 'visual_ai' ? 'var(--action-primary, #2dd4bf)' : 'var(--text-muted, #8290a5)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderTopLeftRadius: '6px',
              borderTopRightRadius: '6px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>🎨</span> Foto & AI Truth Engine
            {(formErrors.raw_photo || formErrors.packaging_status || formErrors.packaging_type) && (
              <span style={{ color: 'var(--status-danger, #fb7185)', fontSize: '11px' }}>●</span>
            )}
          </button>

          {activeProductId && (
            <button
              type="button"
              onClick={() => setActiveTab('brand_links')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: activeTab === 'brand_links' ? 'var(--surface-interactive, #1c2a40)' : 'transparent',
                borderBottom: activeTab === 'brand_links' ? '2px solid var(--action-primary, #2dd4bf)' : '2px solid transparent',
                color: activeTab === 'brand_links' ? 'var(--action-primary, #2dd4bf)' : 'var(--text-muted, #8290a5)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>🔗</span> Brand Affiliate Links
              <span style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: 'var(--status-info-soft, rgba(96, 165, 250, 0.14))',
                color: 'var(--status-info, #60a5fa)',
                fontWeight: 700
              }}>
                {productBrandLinks.length}
              </span>
            </button>
          )}
        </div>

        {/* Scrollable Modal Form Body */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted, #8290a5)', fontSize: '14px' }}>
            ⏳ Memuat data produk...
          </div>
        ) : (
          <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ========================================================
                  TAB 1: INFO DASAR & USP
                  ======================================================== */}
              {activeTab === 'basic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Nama Produk & Kategori */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.product_name ? 'var(--status-danger, #fb7185)' : 'var(--text-secondary, #b6c2d2)' }}>
                        Nama Produk *
                      </label>
                      <input
                        type="text"
                        value={formData.product_name}
                        onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                        placeholder="Contoh: Pisau Dapur Chef Stainless Steel"
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: formErrors.product_name ? '1px solid var(--status-danger, #fb7185)' : '1px solid var(--border-subtle, #26354a)',
                          background: 'var(--input-bg, #0c1422)',
                          color: 'var(--text-primary, #f4f7fb)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                      {formErrors.product_name && (
                        <span style={{ fontSize: '11px', color: 'var(--status-danger, #fb7185)', marginTop: '4px', display: 'block' }}>
                          {formErrors.product_name}
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary, #b6c2d2)' }}>
                        Kategori
                      </label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Contoh: Kitchen & Dining / Peralatan Masak"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: '1px solid var(--border-subtle, #26354a)',
                          background: 'var(--input-bg, #0c1422)',
                          color: 'var(--text-primary, #f4f7fb)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Tags & Default Fallback Link */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary, #b6c2d2)' }}>
                        Tags (Pisah Koma)
                      </label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={e => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="pisau, dapur, tajam, anti-karat"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: '1px solid var(--border-subtle, #26354a)',
                          background: 'var(--input-bg, #0c1422)',
                          color: 'var(--text-primary, #f4f7fb)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary, #b6c2d2)' }}>
                        Default Affiliate Link (Fallback)
                      </label>
                      <input
                        type="text"
                        value={formData.affiliate_link}
                        onChange={e => setFormData({ ...formData, affiliate_link: e.target.value })}
                        placeholder="https://shope.ee/..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: '1px solid var(--border-subtle, #26354a)',
                          background: 'var(--input-bg, #0c1422)',
                          color: 'var(--text-primary, #f4f7fb)',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Deskripsi Produk */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.product_description ? 'var(--status-danger, #fb7185)' : 'var(--text-secondary, #b6c2d2)' }}>
                      Deskripsi Produk *
                    </label>
                    <textarea
                      rows={3}
                      value={formData.product_description}
                      onChange={e => setFormData({ ...formData, product_description: e.target.value })}
                      placeholder="Deskripsi detail mengenai fungsi, keunggulan, dan spesifikasi produk (min 10 karakter)..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm, 8px)',
                        border: formErrors.product_description ? '1px solid var(--status-danger, #fb7185)' : '1px solid var(--border-subtle, #26354a)',
                        background: 'var(--input-bg, #0c1422)',
                        color: 'var(--text-primary, #f4f7fb)',
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                    {formErrors.product_description && (
                      <span style={{ fontSize: '11px', color: 'var(--status-danger, #fb7185)', marginTop: '4px', display: 'block' }}>
                        {formErrors.product_description}
                      </span>
                    )}
                  </div>

                  {/* Unique Selling Proposition (USP) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary, #b6c2d2)' }}>
                      Unique Selling Proposition (USP) — Satu Poin per Baris
                    </label>
                    <textarea
                      rows={3}
                      value={formData.unique_selling_point}
                      onChange={e => setFormData({ ...formData, unique_selling_point: e.target.value })}
                      placeholder="- Bilah baja Jerman tahan karat&#10;- Gagang ergonomis kayu rosewood&#10;- Sangat tajam & presisi untuk memotong daging tebal"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm, 8px)',
                        border: '1px solid var(--border-subtle, #26354a)',
                        background: 'var(--input-bg, #0c1422)',
                        color: 'var(--text-primary, #f4f7fb)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono, monospace)',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ========================================================
                  TAB 2: FOTO & AI TRUTH ENGINE
                  ======================================================== */}
              {activeTab === 'visual_ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Upload Foto Raw Produk & Provider */}
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md, 12px)',
                    background: 'var(--surface-interactive, #1c2a40)',
                    border: '1px solid var(--border-subtle, #26354a)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', alignItems: 'start' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.raw_photo ? 'var(--status-danger, #fb7185)' : 'var(--action-primary, #2dd4bf)' }}>
                          📷 Foto Produk Raw {!activeProductId ? '*' : '(Ganti Foto)'}
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleRawPhotoSelect}
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: 'var(--input-bg, #0c1422)',
                            border: `1px dashed ${formErrors.raw_photo ? 'var(--status-danger, #fb7185)' : 'var(--action-primary, #2dd4bf)'}`,
                            borderRadius: 'var(--radius-sm, 8px)',
                            color: 'var(--text-muted, #8290a5)',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        />
                        {rawPhotoPreview && (
                          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img
                              src={rawPhotoPreview}
                              alt="Preview"
                              style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--action-primary, #2dd4bf)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--action-primary, #2dd4bf)', fontWeight: 600 }}>
                              ✅ {rawPhotoFile?.name}
                            </span>
                          </div>
                        )}
                        {formErrors.raw_photo && (
                          <span style={{ fontSize: '11px', color: 'var(--status-danger, #fb7185)', marginTop: '4px', display: 'block' }}>
                            {formErrors.raw_photo}
                          </span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary, #b6c2d2)' }}>
                          🤖 Provider Foto Clean
                        </label>
                        <select
                          value={formData.photo_provider}
                          onChange={e => setFormData({ ...formData, photo_provider: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 'var(--radius-sm, 8px)',
                            border: '1px solid var(--border-subtle, #26354a)',
                            background: 'var(--input-bg, #0c1422)',
                            color: 'var(--text-primary, #f4f7fb)',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        >
                          <option value="system_default">🔧 Default Sistem</option>
                          <option value="glabs">🏭 G-Labs (Local Worker)</option>
                          <option value="gemini">✨ Gemini AI Image</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Status & Jenis Kemasan */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.packaging_status ? 'var(--status-danger, #fb7185)' : 'var(--text-secondary, #b6c2d2)' }}>
                        Status Kemasan *
                      </label>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary, #f4f7fb)' }}>
                          <input
                            type="radio"
                            name="packaging_status"
                            value="packaged"
                            checked={formData.packaging_status === 'packaged'}
                            onChange={e => setFormData({ ...formData, packaging_status: e.target.value })}
                            style={{ accentColor: 'var(--action-primary, #2dd4bf)', cursor: 'pointer' }}
                          />
                          📦 Dikemas
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary, #f4f7fb)' }}>
                          <input
                            type="radio"
                            name="packaging_status"
                            value="unpackaged"
                            checked={formData.packaging_status === 'unpackaged'}
                            onChange={e => setFormData({ ...formData, packaging_status: e.target.value })}
                            style={{ accentColor: 'var(--action-primary, #2dd4bf)', cursor: 'pointer' }}
                          />
                          🔓 Tidak Dikemas
                        </label>
                      </div>
                      {formErrors.packaging_status && (
                        <span style={{ fontSize: '11px', color: 'var(--status-danger, #fb7185)', marginTop: '4px', display: 'block' }}>
                          {formErrors.packaging_status}
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: formErrors.packaging_type ? 'var(--status-danger, #fb7185)' : 'var(--text-secondary, #b6c2d2)' }}>
                        Jenis Kemasan {formData.packaging_status === 'packaged' ? '*' : ''}
                      </label>
                      <input
                        type="text"
                        value={formData.packaging_type}
                        onChange={e => setFormData({ ...formData, packaging_type: e.target.value })}
                        placeholder="Botol Kaca, Kotak Kardus, Pouch..."
                        disabled={formData.packaging_status !== 'packaged'}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: formErrors.packaging_type ? '1px solid var(--status-danger, #fb7185)' : '1px solid var(--border-subtle, #26354a)',
                          background: 'var(--input-bg, #0c1422)',
                          color: 'var(--text-primary, #f4f7fb)',
                          fontSize: '13px',
                          opacity: formData.packaging_status === 'packaged' ? 1 : 0.45,
                          outline: 'none'
                        }}
                      />
                      {formErrors.packaging_type && (
                        <span style={{ fontSize: '11px', color: 'var(--status-danger, #fb7185)', marginTop: '4px', display: 'block' }}>
                          {formErrors.packaging_type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Prompts (Product Truth, Geometric Truth, Clean Photo Prompt) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--status-success, #4ade80)' }}>
                        🛡️ Product Truth (T2I Physics & Packaging Lock)
                      </label>
                      <textarea
                        rows={2}
                        value={formData.product_truth}
                        onChange={e => setFormData({ ...formData, product_truth: e.target.value })}
                        placeholder="Deskripsi fisik kemasan resmi produk untuk acuan render AI..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: '1px solid var(--status-success-soft, rgba(74, 222, 128, 0.3))',
                          background: 'var(--input-bg, #0c1422)',
                          color: 'var(--text-primary, #f4f7fb)',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--status-neutral, #a78bfa)' }}>
                        📐 Geometric Truth (I2V Geometry & Material Lock)
                      </label>
                      <textarea
                        rows={2}
                        value={formData.geometric_truth}
                        onChange={e => setFormData({ ...formData, geometric_truth: e.target.value })}
                        placeholder="Deskripsi geometri wadah & fisika permukaan..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: '1px solid var(--status-neutral-soft, rgba(167, 139, 250, 0.3))',
                          background: 'var(--input-bg, #0c1422)',
                          color: 'var(--text-primary, #f4f7fb)',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--status-info, #60a5fa)' }}>
                        ✨ Prompt Foto Clean (Clean Photo T2I Prompt)
                      </label>
                      <textarea
                        rows={2}
                        value={formData.clean_photo_t2i_prompt}
                        onChange={e => setFormData({ ...formData, clean_photo_t2i_prompt: e.target.value })}
                        placeholder="Deskripsi visual untuk menghasilkan foto clean latar putih..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: '1px solid var(--status-info-soft, rgba(96, 165, 250, 0.3))',
                          background: 'var(--input-bg, #0c1422)',
                          color: 'var(--text-primary, #f4f7fb)',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================
                  TAB 3: BRAND AFFILIATE LINKS
                  ======================================================== */}
              {activeTab === 'brand_links' && activeProductId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md, 12px)',
                    background: 'var(--surface-interactive, #1c2a40)',
                    border: '1px solid var(--border-subtle, #26354a)'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--action-primary, #2dd4bf)', marginBottom: '10px' }}>
                      🔗 Daftar Affiliate Links per Brand Profile
                    </div>

                    {/* List of active brand links */}
                    {productBrandLinks.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #8290a5)', marginBottom: '12px' }}>
                        Belum ada brand profile yang terhubung ke produk ini.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                        {productBrandLinks.map(link => (
                          <div
                            key={link.brand_product_id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: 'var(--input-bg, #0c1422)',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm, 8px)',
                              border: '1px solid var(--border-subtle, #26354a)'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #f4f7fb)' }}>
                                {link.brand_name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #8290a5)', wordBreak: 'break-all' }}>
                                {link.affiliate_link}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteBrandLink(link)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--status-danger, #fb7185)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                padding: '4px 8px'
                              }}
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add / Update Brand Link Form */}
                    <div style={{
                      background: 'var(--input-bg, #0c1422)',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--border-subtle, #26354a)'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary, #b6c2d2)' }}>
                        Tambah / Update Link Brand
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <select
                          value={newLinkBrandId}
                          onChange={e => setNewLinkBrandId(e.target.value)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle, #26354a)',
                            background: 'var(--surface, #101827)',
                            color: 'var(--text-primary, #f4f7fb)',
                            fontSize: '12px',
                            outline: 'none'
                          }}
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
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle, #26354a)',
                            background: 'var(--surface, #101827)',
                            color: 'var(--text-primary, #f4f7fb)',
                            fontSize: '12px',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Affiliate Link (https://...)"
                          value={newLinkUrl}
                          onChange={e => setNewLinkUrl(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle, #26354a)',
                            background: 'var(--surface, #101827)',
                            color: 'var(--text-primary, #f4f7fb)',
                            fontSize: '12px',
                            outline: 'none'
                          }}
                        />
                        <button
                          type="button"
                          disabled={savingLink}
                          onClick={handleSaveBrandLink}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'var(--action-primary, #2dd4bf)',
                            color: 'var(--on-action-primary, #042f2e)',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: savingLink ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {savingLink ? 'Menyimpan...' : 'Simpan Link'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Persistent Sticky Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border-subtle, #26354a)',
              background: 'var(--surface-raised, #162235)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px'
            }}>
              {activeProductId && (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text-muted, #8290a5)',
                  marginRight: 'auto',
                  userSelect: 'none'
                }}>
                  <input
                    type="checkbox"
                    checked={regenerateOnSave}
                    onChange={e => setRegenerateOnSave(e.target.checked)}
                    style={{ accentColor: 'var(--action-primary, #2dd4bf)', cursor: 'pointer' }}
                  />
                  Regenerate Foto & AI Enrichment saat disimpan
                </label>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  border: '1px solid var(--border-strong, #3c506b)',
                  background: 'var(--surface-interactive, #1c2a40)',
                  color: 'var(--text-secondary, #b6c2d2)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  border: 'none',
                  background: 'var(--action-primary, #2dd4bf)',
                  color: 'var(--on-action-primary, #042f2e)',
                  fontSize: '13px',
                  fontWeight: 750,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: saving ? 0.7 : 1
                }}
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
