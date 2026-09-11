'use client';

import React, { useState } from 'react';

export default function ProductEditModal({
  product,
  brandId,
  brandName,
  isOpen,
  onClose,
  onSuccess
}) {
  if (!isOpen || !product) return null;

  const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'pricing', 'dna', 'assoc'
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    product_name: product.product_name || product.name || '',
    category: product.category || 'Kitchen & Dining',
    sku: product.sku || product.product_id || product.id || '',
    product_description: product.product_description || product.description || '',
    affiliate_link: product.affiliate_link || product.affiliate_url || '',
    price: product.price !== undefined ? product.price : 149000,
    commission_rate: product.commission_rate !== undefined ? product.commission_rate : 15,
    target_audience: product.target_audience || 'Ibu rumah tangga, pecinta masak, praktis & higienis',
    unique_selling_point: product.unique_selling_point || product.usp || '',
    pain_point_solved: product.pain_point_solved || '',
    key_visuals_extracted: product.key_visuals_extracted || '',
    tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
    assoc_status: product.assoc_status || product.readiness_status || 'ACTIVE_ASSOC'
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const productId = product.id || product.product_id;
      
      // 1. Update Core Product via PUT /api/v2/products/[id]
      const updatePayload = {
        product_name: form.product_name,
        category: form.category,
        product_description: form.product_description,
        price: Number(form.price) || 0,
        commission_rate: Number(form.commission_rate) || 0,
        target_audience: form.target_audience,
        unique_selling_point: form.unique_selling_point,
        pain_point_solved: form.pain_point_solved,
        key_visuals_extracted: form.key_visuals_extracted,
        affiliate_link: form.affiliate_link,
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags
      };

      const res = await fetch(`/api/v2/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menyimpan perubahan produk.');
      }

      // 2. Jika ada brandId dan affiliate_link, perbarui relasi brand profile
      if (brandId && form.affiliate_link) {
        await fetch(`/api/v2/brand-profiles/${brandId}/products`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: productId,
            affiliateLink: form.affiliate_link.trim(),
            assocStatus: form.assoc_status
          })
        }).catch(err => console.warn('Gagal sinkronisasi link brand:', err));
      }

      const updated = {
        ...product,
        ...form,
        readiness_status: form.assoc_status
      };

      onSuccess?.(updated);
      onClose();
    } catch (err) {
      console.error('Error saving product:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan produk.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface-bg, #0f172a)',
        color: 'var(--text-main, #f8fafc)',
        border: '1px solid var(--border-color, #1e293b)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color, #1e293b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-header, rgba(15, 23, 42, 0.6))'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✏️</span> Edit Detail Produk
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
              Brand: <strong>{brandName || 'Brand Profile'}</strong> · SKU: {form.sku}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '10px 24px 0 24px',
          borderBottom: '1px solid var(--border-color, #1e293b)',
          background: 'var(--surface-subtle, #090e1a)'
        }}>
          {[
            { id: 'basic', label: 'Informasi Dasar', icon: '📝' },
            { id: 'pricing', label: 'Harga & Komisi', icon: '💰' },
            { id: 'dna', label: 'USP & DNA Produk', icon: '🧬' },
            { id: 'assoc', label: 'Status Asosiasi', icon: '🔗' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? 600 : 500,
                color: activeTab === tab.id ? 'var(--primary, #38bdf8)' : 'var(--text-muted, #94a3b8)',
                background: activeTab === tab.id ? 'var(--surface-bg, #0f172a)' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary, #38bdf8)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ marginRight: '6px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errorMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '13px'
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* TAB 1: INFORMASI DASAR */}
            {activeTab === 'basic' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                    Nama Produk <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.product_name}
                    onChange={(e) => handleChange('product_name', e.target.value)}
                    placeholder="Nama produk lengkap"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                      Kategori
                    </label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                      placeholder="e.g. Kitchen & Dining, Fashion"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #1e293b)',
                        background: 'var(--surface-subtle, #090e1a)',
                        color: 'var(--text-main, #f8fafc)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                      SKU / Product ID
                    </label>
                    <input
                      type="text"
                      disabled
                      value={form.sku}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #1e293b)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-muted, #64748b)',
                        fontSize: '13px',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                    Deskripsi Produk
                  </label>
                  <textarea
                    rows={4}
                    value={form.product_description}
                    onChange={(e) => handleChange('product_description', e.target.value)}
                    placeholder="Deskripsi singkat produk untuk konteks copywriting..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                    Affiliate Link URL
                  </label>
                  <input
                    type="url"
                    value={form.affiliate_link}
                    onChange={(e) => handleChange('affiliate_link', e.target.value)}
                    placeholder="https://vt.tiktok.com/... atau https://shopee.co.id/..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </>
            )}

            {/* TAB 2: HARGA & KOMISI */}
            {activeTab === 'pricing' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                      Harga Jual (Rp)
                    </label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => handleChange('price', e.target.value)}
                      placeholder="149000"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #1e293b)',
                        background: 'var(--surface-subtle, #090e1a)',
                        color: 'var(--text-main, #f8fafc)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                      Komisi Affiliate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.commission_rate}
                      onChange={(e) => handleChange('commission_rate', e.target.value)}
                      placeholder="15"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #1e293b)',
                        background: 'var(--surface-subtle, #090e1a)',
                        color: 'var(--text-main, #f8fafc)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                    Target Audience / Demografi Konsumen
                  </label>
                  <textarea
                    rows={3}
                    value={form.target_audience}
                    onChange={(e) => handleChange('target_audience', e.target.value)}
                    placeholder="Contoh: Ibu rumah tangga usia 25-45 tahun yang gemar masak sehat dan cepat..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </>
            )}

            {/* TAB 3: USP & DNA PRODUK */}
            {activeTab === 'dna' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                    Unique Selling Point (USP)
                  </label>
                  <input
                    type="text"
                    value={form.unique_selling_point}
                    onChange={(e) => handleChange('unique_selling_point', e.target.value)}
                    placeholder="Keunggulan utama yang membedakan dari kompetitor..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                    Pain Points yang Diatasi
                  </label>
                  <textarea
                    rows={3}
                    value={form.pain_point_solved}
                    onChange={(e) => handleChange('pain_point_solved', e.target.value)}
                    placeholder="Masalah spesifik apa yang diselesaikan produk ini bagi pembeli..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                    Key Visuals & Fitur Unggulan
                  </label>
                  <textarea
                    rows={2}
                    value={form.key_visuals_extracted}
                    onChange={(e) => handleChange('key_visuals_extracted', e.target.value)}
                    placeholder="Visual detail: bilah pisau stainless, pegangan ergonomis kayu..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                    Tags (Pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    placeholder="alatdapur, praktis, viral, pisauestetik"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </>
            )}

            {/* TAB 4: STATUS ASOSIASI */}
            {activeTab === 'assoc' && (
              <>
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'var(--surface-subtle, #090e1a)',
                  border: '1px solid var(--border-color, #1e293b)'
                }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted, #94a3b8)' }}>
                    Status Asosiasi Produk dengan Brand Profile
                  </label>
                  <select
                    value={form.assoc_status}
                    onChange={(e) => handleChange('assoc_status', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #1e293b)',
                      background: 'var(--surface-bg, #0f172a)',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ACTIVE_ASSOC">🟢 ACTIVE ASSOC (Siap diproduksi & dijadwalkan)</option>
                    <option value="CANDIDATE">🟡 CANDIDATE (Tahap evaluasi produk)</option>
                    <option value="INACTIVE">⚪ INACTIVE (Non-aktifkan dari jadwal)</option>
                  </select>
                  <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                    Produk dengan status <strong>ACTIVE ASSOC</strong> akan otomatis tersedia di dropdown pilihan rencana kampanye Content Calendar.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color, #1e293b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'var(--surface-header, rgba(15, 23, 42, 0.6))'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #1e293b)',
                background: 'transparent',
                color: 'var(--text-main, #f8fafc)',
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
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary, #38bdf8)',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
