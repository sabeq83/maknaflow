import React, { useState, useEffect } from 'react';

/**
 * Shared Component: BrandProductSelector
 * Digunakan di form input pembuatan/pemrosesan campaign
 */
export default function BrandProductSelector({
  selectedBrandId,
  onBrandChange,
  selectedProductId,
  onProductChange,
  explicitOverride = '',
  onOverrideChange,
  required = true,
  affiliateRequired = true
}) {
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [resolutionPreview, setResolutionPreview] = useState(null);
  const [resolving, setResolving] = useState(false);

  // 1. Load brand profiles on mount
  useEffect(() => {
    async function fetchBrands() {
      setLoadingBrands(true);
      try {
        const res = await fetch('/api/v2/brand-profiles');
        const data = await res.json();
        if (data.success) {
          setBrands(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching brand profiles for selector:', err);
      } finally {
        setLoadingBrands(false);
      }
    }
    fetchBrands();
  }, []);

  // 2. Load products on mount or when search category is needed (loads all products of tenant)
  useEffect(() => {
    async function fetchProducts() {
      setLoadingProducts(true);
      try {
        const res = await fetch('/api/v2/products');
        const data = await res.json();
        if (data.success) {
          setProducts(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching products for selector:', err);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, []);

  // 3. Auto-resolve affiliate link preview when selections change
  useEffect(() => {
    if (!selectedProductId) {
      setResolutionPreview(null);
      return;
    }

    async function resolvePreview() {
      setResolving(true);
      try {
        const res = await fetch('/api/v2/affiliate-links/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandProfileId: selectedBrandId || null,
            productId: selectedProductId,
            explicitOverride: explicitOverride || null
          })
        });
        const data = await res.json();
        if (data.success) {
          setResolutionPreview(data.data);
        }
      } catch (err) {
        console.error('Error resolving affiliate link preview:', err);
      } finally {
        setResolving(false);
      }
    }

    const timer = setTimeout(resolvePreview, 300);
    return () => clearTimeout(timer);
  }, [selectedBrandId, selectedProductId, explicitOverride]);

  const selectedProductObj = products.find(p => p.id === selectedProductId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: '8px' }}>

      {/* Row 1: Brand & Product Selection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        {/* Brand Dropdown */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">🎯 Brand Profile {required && '*'}</label>
          <select
            className="form-input"
            value={selectedBrandId || ''}
            onChange={(e) => onBrandChange(e.target.value || null)}
            required={required}
            disabled={loadingBrands}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="">-- Pilih Brand Profile --</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.brand_name}</option>
            ))}
          </select>
          {loadingBrands && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Loading brands...</span>}
        </div>

        {/* Product Dropdown */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">📦 Produk Terkait {required && '*'}</label>
          <select
            className="form-input"
            value={selectedProductId || ''}
            onChange={(e) => onProductChange(e.target.value || '')}
            required={required}
            disabled={loadingProducts}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="">-- Pilih Produk --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.product_name} ({p.category || 'No Category'})</option>
            ))}
          </select>
          {loadingProducts && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Loading products...</span>}
        </div>

      </div>

      {/* Row 2: Selected Product Thumbnail & Clean Photo Preview */}
      {selectedProductObj && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface-interactive)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--surface-interactive)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '4px', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={selectedProductObj.clean_photo_url || selectedProductObj.raw_photo_url || 'https://placehold.co/100x100?text=No+Photo'}
              alt={selectedProductObj.product_name}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{selectedProductObj.product_name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Kemasan: {selectedProductObj.packaging_type || 'Tidak dispesifikasi'} ({selectedProductObj.packaging_status})
            </div>
          </div>
        </div>
      )}

      {/* Row 3: Explicit Affiliate Link Override Input */}
      {selectedProductId && (
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>🔗 Override Affiliate Link (Opsional)</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hanya berlaku untuk item ini saja</span>
          </label>
          <input
            type="text"
            className="form-input"
            value={explicitOverride}
            onChange={(e) => onOverrideChange(e.target.value)}
            placeholder="https://tokopedia.link/... atau https://shope.ee/..."
            style={{ fontSize: '0.8rem' }}
          />
        </div>
      )}

      {/* Row 4: Resolution Telemetry & Validation */}
      {resolving && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="spinner-mini" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }}></span>
          Memproses resolusi affiliate link...
        </div>
      )}

      {!resolving && resolutionPreview && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '6px',
          fontSize: '0.78rem',
          border: '1px solid',
          background:
            resolutionPreview.status === 'missing' ? 'rgba(239, 68, 68, 0.05)' :
            resolutionPreview.source === 'campaign_override' ? 'rgba(108, 92, 231, 0.05)' :
            resolutionPreview.source === 'brand_product' ? 'var(--status-success-soft)' :
            'rgba(241, 196, 15, 0.05)',
          borderColor:
            resolutionPreview.status === 'missing' ? 'rgba(239, 68, 68, 0.2)' :
            resolutionPreview.source === 'campaign_override' ? 'var(--status-neutral-soft)' :
            resolutionPreview.source === 'brand_product' ? 'var(--status-success-soft)' :
            'rgba(241, 196, 15, 0.2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '4px' }}>
            <span>Status Resolusi Link:</span>
            <span style={{
              color:
                resolutionPreview.status === 'missing' ? 'var(--status-danger)' :
                resolutionPreview.source === 'campaign_override' ? '#a55eea' :
                resolutionPreview.source === 'brand_product' ? 'var(--status-success)' :
                'var(--status-warning)'
            }}>
              {resolutionPreview.status === 'missing' ? '⚠️ Missing / Tidak Ada Link' :
               resolutionPreview.source === 'campaign_override' ? '🟣 Campaign Override' :
               resolutionPreview.source === 'brand_product' ? '🟢 Brand Product Link' :
               '🟡 Legacy Product Fallback'}
            </span>
          </div>

          {resolutionPreview.affiliateLink ? (
            <div style={{ fontMemo: 'monospace', wordBreak: 'break-all', color: 'var(--text-normal)' }}>
              {resolutionPreview.affiliateLink}
            </div>
          ) : (
            <div style={{ color: 'var(--status-danger)' }}>
              {affiliateRequired
                ? 'Error: Link affiliate wajib diisi untuk memproses campaign!'
                : 'Peringatan: Tidak ada link affiliate. System akan menggunakan link default kosong.'}
            </div>
          )}

          {resolutionPreview.trackingCode && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Tracking Code: <code style={{ background: 'var(--surface-interactive)', padding: '2px 4px', borderRadius: '3px' }}>{resolutionPreview.trackingCode}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
