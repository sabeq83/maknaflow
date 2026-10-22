'use client';

import { useState, useEffect } from 'react';
import { getBrandEditorialDefaults, shouldHydrateBrandEditorial } from '@/lib/brand-editorial-defaults';
import { DEFAULT_EDITORIAL_ROWS_PER_PILLAR, getBrandEditorialCountOptions } from '@/lib/content-planner-contract';

export default function PlannerConfigurationForm({
  mode = 'direct', // 'direct' | 'capture'
  initialValues = {},
  onCapture = null,
  onSuccess = null,
  onCancel = null,
  isInline = false
}) {
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState(null);

  // Form State
  const [plannerFocus, setPlannerFocus] = useState(initialValues.plannerFocus || 'product_campaign');
  const [recipeCategory, setRecipeCategory] = useState(initialValues.recipeCategory || 'minuman');
  const [recipeProductIds, setRecipeProductIds] = useState(initialValues.recipeProductIds || []);
  const [selectedProductsMap, setSelectedProductsMap] = useState({});
  const [recipeStrategyMode, setRecipeStrategyMode] = useState(initialValues.recipeStrategyMode || 'synergy');
  const [recipeCount, setRecipeCount] = useState(initialValues.recipeCount || 3);
  const [brandContext, setBrandContext] = useState(initialValues.brandContext || '');
  const [contentGoal, setContentGoal] = useState(initialValues.contentGoal || '');
  const [pillars, setPillars] = useState(initialValues.pillars || []);
  const [pillarDraft, setPillarDraft] = useState('');
  const [pillarDistributionMode, setPillarDistributionMode] = useState(initialValues.pillarDistributionMode || 'balanced');
  const [inputMode, setInputMode] = useState(initialValues.inputMode || 'manual');
  const [accountName, setAccountName] = useState(initialValues.accountName || '');
  const [googleSheetId, setGoogleSheetId] = useState(initialValues.googleSheetId || '');
  const [title, setTitle] = useState(initialValues.title || '');
  const [productName, setProductName] = useState(initialValues.productName || '');
  const [productDesc, setProductDesc] = useState(initialValues.productDesc || '');
  const [productUsp, setProductUsp] = useState(initialValues.productUsp || '');
  const [productUrl, setProductUrl] = useState(initialValues.productUrl || '');
  const [affiliateUrl, setAffiliateUrl] = useState(initialValues.affiliateUrl || '');
  const [productPhotoUrl, setProductPhotoUrl] = useState(initialValues.productPhotoUrl || '');
  const [platform, setPlatform] = useState(initialValues.platform || 'tiktok');
  const [objective, setObjective] = useState(initialValues.objective || 'soft_sell');
  const [productPlannerCount, setProductPlannerCount] = useState(initialValues.productPlannerCount || 6);
  const [editorialRowsPerPillar, setEditorialRowsPerPillar] = useState(DEFAULT_EDITORIAL_ROWS_PER_PILLAR);
  const [editorialCountNotice, setEditorialCountNotice] = useState('');
  const [targetAudience, setTargetAudience] = useState(initialValues.targetAudience || 'ibu_rumah_tangga');
  const [customTargetAudience, setCustomTargetAudience] = useState('');
  const [promotionContext, setPromotionContext] = useState(initialValues.promotionContext || '');
  const [customInstructions, setCustomInstructions] = useState(initialValues.customInstructions || '');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [editorialDirty, setEditorialDirty] = useState(false);
  const [editorialSource, setEditorialSource] = useState('empty');
  const [pendingEditorialBrandId, setPendingEditorialBrandId] = useState('');

  // World-Aware state
  const [contentWorld, setContentWorld] = useState(initialValues.contentWorld || 'real_world');
  const [knowledgeDomain, setKnowledgeDomain] = useState(initialValues.knowledgeDomain || 'general');
  const [universeProfile, setUniverseProfile] = useState(initialValues.universeProfile || null);
  const [availableUniverses, setAvailableUniverses] = useState([]);
  const [selectedUniverseInfo, setSelectedUniverseInfo] = useState(null);

  // Existing Product / Brand Selection State
  const [existingProducts, setExistingProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(initialValues.selectedProductId || '');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(initialValues.selectedBrandId || '');
  const [isAffiliateLinkLocked, setIsAffiliateLinkLocked] = useState(false);
  const [isNonAffiliate, setIsNonAffiliate] = useState(false);

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

  const editorialCountOptions = getBrandEditorialCountOptions(pillars.length);
  const maxEditorialRowsPerPillar = editorialCountOptions.length;
  const effectiveEditorialRowsPerPillar = maxEditorialRowsPerPillar > 0
    ? Math.min(editorialRowsPerPillar, maxEditorialRowsPerPillar)
    : 0;
  const effectivePlannerCount = plannerFocus === 'brand_editorial'
    ? pillars.length * effectiveEditorialRowsPerPillar
    : (plannerFocus === 'recipe_campaign' ? (Number.parseInt(recipeCount, 10) || 3) : Number(productPlannerCount));

  useEffect(() => {
    fetch('/api/v2/brand-profiles')
      .then(r => r.json())
      .then(d => { if (d.success) setBrandProfiles(d.data || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if ((plannerFocus === 'product_campaign' && inputMode === 'existing') || plannerFocus === 'recipe_campaign') {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        const query = new URLSearchParams({ limit: '100' });
        if (productSearchQuery.trim()) query.set('search', productSearchQuery.trim());
        fetch(`/api/v2/products?${query}`, { signal: controller.signal })
          .then(r => r.json())
          .then(d => { if (d.success) setExistingProducts(d.data || []); })
          .catch(error => { if (error.name !== 'AbortError') setExistingProducts([]); });
      }, 250);
      return () => { clearTimeout(timer); controller.abort(); };
    }
  }, [plannerFocus, inputMode, productSearchQuery]);

  useEffect(() => {
    if (plannerFocus !== 'product_campaign' || !selectedProductId || isNonAffiliate) {
      if (isNonAffiliate) {
        setAffiliateUrl('');
        setIsAffiliateLinkLocked(true);
      } else {
        setIsAffiliateLinkLocked(false);
      }
      return;
    }
    const controller = new AbortController();
    fetch('/api/v2/affiliate-links/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandProfileId: selectedBrandId || null,
        productId: selectedProductId,
        explicitOverride: null
      }),
      signal: controller.signal
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const resolution = d.data;
          if (resolution.source === 'brand_product') {
            setAffiliateUrl(resolution.affiliateLink || '');
            setIsAffiliateLinkLocked(true);
          } else {
            setAffiliateUrl('');
            setIsAffiliateLinkLocked(false);
          }
        }
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('[Affiliate Auto-Resolve Error]:', error);
        }
      });
    return () => controller.abort();
  }, [selectedProductId, selectedBrandId, plannerFocus, isNonAffiliate]);

  useEffect(() => {
    if (maxEditorialRowsPerPillar > 0 && editorialRowsPerPillar > maxEditorialRowsPerPillar) {
      setEditorialRowsPerPillar(maxEditorialRowsPerPillar);
      setEditorialCountNotice(`Jumlah ide disesuaikan menjadi ${maxEditorialRowsPerPillar} per pilar agar total tidak melebihi 30 baris.`);
    }
  }, [editorialRowsPerPillar, maxEditorialRowsPerPillar]);

  function handleProductSelection(prodId) {
    setSelectedProductId(prodId);
    const prod = existingProducts.find(p => p.id === prodId);
    if (prod) {
      setProductName(prod.product_name);
      setProductDesc(prod.product_description);
      setProductUsp(prod.unique_selling_point);
      setProductUrl(prod.product_url || '');
      setProductPhotoUrl(prod.cleaned_photo_url || prod.clean_photo_url || prod.raw_photo_url || '');

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

      if (!isTitleManuallyEdited || !title) {
        const selectedBrand = brandProfiles.find(b => b.id === selectedBrandId);
        const effectiveAcc = selectedBrand?.brand_name || accountName;
        const autoTitle = generateAutofillTitle(effectiveAcc, prod.product_name);
        if (autoTitle) setTitle(autoTitle);
      }
    }
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
    const defaults = getBrandEditorialDefaults(brand);
    setBrandContext(defaults.brandContext);
    setContentGoal(defaults.contentGoal);
    setPillars(defaults.pillars);
    setPillarDraft('');
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setErrorMsg('');

    if (plannerFocus === 'product_campaign') {
      if (!productName || !productDesc) {
        setErrorMsg('Nama Produk dan Deskripsi Wajib Diisi');
        return;
      }
      if (!isNonAffiliate && !isAffiliateLinkLocked) {
        setErrorMsg('Gagal membuat planner: isikan URL affiliate sesuai nama brand di database produk.');
        return;
      }
    }

    if (plannerFocus === 'brand_editorial' && (!brandContext.trim() || pillars.length === 0)) {
      setErrorMsg('Konteks Brand dan minimal satu Pilar Konten wajib diisi');
      return;
    }

    const selectedBrand = brandProfiles.find(b => b.id === selectedBrandId);
    const effectiveAccountName = (
      selectedBrand?.brand_name ||
      accountName ||
      (plannerFocus === 'brand_editorial' ? 'Editorial' : (plannerFocus === 'recipe_campaign' ? 'Resep Kuliner' : productName))
    ).trim();

    const effectiveTargetAudience = targetAudience === 'custom'
      ? (customTargetAudience.trim() || 'General Audience')
      : targetAudience;

    const payload = {
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
      promotion_context: promotionContext.trim() || null,
      custom_instructions: customInstructions.trim() || null,
      recipe_config: plannerFocus === 'recipe_campaign' ? {
        category: recipeCategory,
        product_ids: recipeProductIds,
        strategy_mode: recipeStrategyMode
      } : null,
      products_snapshot: plannerFocus === 'recipe_campaign'
        ? recipeProductIds.map(id => selectedProductsMap[id] || existingProducts.find(p => p.id === id)).filter(Boolean).map(p => ({
            product_id: p.id,
            name: p.product_name,
            description: p.product_description,
            usp: p.unique_selling_point,
            reference_image: p.product_photo_url || p.photo_url || null
          }))
        : [],
      content_world: contentWorld,
      knowledge_domain: knowledgeDomain,
      universe_profile: universeProfile,
      universe_config_json: selectedUniverseInfo ? JSON.stringify({
        visual_style: selectedUniverseInfo.default_visual_style || 'cinematic_3d_clay',
        human_presence: selectedUniverseInfo.human_presence || 'none',
        scene_count: selectedUniverseInfo.default_scene_count || 7,
        scene_duration: selectedUniverseInfo.default_scene_duration || 8,
        aspect_ratio: selectedUniverseInfo.default_aspect_ratio || '9:16',
      }) : null
    };

    if (mode === 'capture' && onCapture) {
      onCapture(payload);
      return;
    }

    try {
      setGenerating(true);
      const res = await fetch('/api/content-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (onSuccess) onSuccess(data);
      } else {
        setErrorMsg(data.error || 'Gagal menyimpan draft planner.');
      }
    } catch (err) {
      setErrorMsg('Error: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  const formContent = (
    <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {errorMsg && (
        <div style={{
          padding: '12px 16px', background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger)',
          borderRadius: '10px', color: 'var(--status-danger)', fontSize: '13px'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Fokus Planner */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
          🧭 Fokus Planner:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            ['brand_editorial', '🧩 Brand Editorial', 'Berbasis brand, audiens, dan pilar.'],
            ['product_campaign', '📦 Product Campaign', 'Berpusat pada satu produk tunggal.'],
            ['recipe_campaign', '🍳 Recipe Campaign', 'Resep kuliner dengan integrasi produk natural.']
          ].map(([value, label, desc]) => (
            <button key={value} type="button" onClick={() => setPlannerFocus(value)} style={{
              padding: '12px', textAlign: 'left', borderRadius: '10px', cursor: 'pointer',
              border: plannerFocus === value ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
              background: plannerFocus === value ? 'var(--surface-interactive)' : 'var(--surface)', color: 'var(--text-primary)'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>{label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.3 }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Brand Selection */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
          🏷️ Pilih Brand Profile:
        </label>
        <select
          value={selectedBrandId}
          onChange={e => handleBrandSelection(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '10px',
            background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
          }}
        >
          <option value="">-- Tanpa Brand Profile (Input Manual) --</option>
          {brandProfiles.map(b => (
            <option key={b.id} value={b.id}>{b.brand_name}</option>
          ))}
        </select>
      </div>

      {/* Product Campaign Mode Inputs */}
      {plannerFocus === 'product_campaign' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Mode Input Produk:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                  background: inputMode === 'manual' ? 'var(--action-primary)' : 'var(--surface)',
                  color: inputMode === 'manual' ? 'var(--on-action-primary, #ffffff)' : 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                Input Manual
              </button>
              <button
                type="button"
                onClick={() => setInputMode('existing')}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                  background: inputMode === 'existing' ? 'var(--action-primary)' : 'var(--surface)',
                  color: inputMode === 'existing' ? 'var(--on-action-primary, #ffffff)' : 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                Pilih dari Pustaka Produk
              </button>
            </div>
          </div>

          {inputMode === 'existing' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                Pilih Produk Pustaka:
              </label>
              <select
                value={selectedProductId}
                onChange={e => handleProductSelection(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                }}
              >
                <option value="">-- Pilih Produk --</option>
                {existingProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Nama Produk:
            </label>
            <input
              type="text"
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="Contoh: Madu Habbatussauda Al-Barokah"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Deskripsi Produk:
            </label>
            <textarea
              rows={3}
              value={productDesc}
              onChange={e => setProductDesc(e.target.value)}
              placeholder="Deskripsi khasiat, manfaat, atau cara konsumsi produk..."
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
              }}
            />
          </div>
        </div>
      )}

      {/* Brand Editorial Mode Inputs */}
      {plannerFocus === 'brand_editorial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Konteks Brand &amp; Audiens:
            </label>
            <textarea
              rows={3}
              value={brandContext}
              onChange={e => setBrandContext(e.target.value)}
              placeholder="Jelaskan nilai brand, identitas target audiens, dan misi konten..."
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              Pilar Konten (Minimal 1):
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                value={pillarDraft}
                onChange={e => setPillarDraft(e.target.value)}
                placeholder="Tambah pilar (misal: Edukasi Herbal, Tips Sehat Pagi)"
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: '10px',
                  background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (pillarDraft.trim()) {
                    setPillars([...pillars, pillarDraft.trim()]);
                    setPillarDraft('');
                  }
                }}
                style={{
                  padding: '10px 16px', background: 'var(--action-primary)', color: 'var(--on-action-primary, #ffffff)',
                  border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600
                }}
              >
                + Tambah
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {pillars.map((pil, idx) => (
                <span
                  key={idx}
                  style={{
                    background: 'var(--surface-interactive)', color: 'var(--text-primary)', padding: '4px 10px',
                    borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  {pil}
                  <button
                    type="button"
                    onClick={() => setPillars(pillars.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Target Audiens & Jumlah Baris */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
            Target Audiens:
          </label>
          <select
            value={targetAudience}
            onChange={e => setTargetAudience(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
            }}
          >
            <option value="genz_casual">Gen-Z Kasual</option>
            <option value="ibu_rumah_tangga">Ibu Rumah Tangga</option>
            <option value="professional_executive">Profesional / Eksekutif</option>
            <option value="hijab_syari_family">Keluarga Muslim / Syar'i</option>
            <option value="fitness_health_enthusiast">Fitness &amp; Healthy Lifestyle</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
            Target Baris Ide:
          </label>
          <select
            value={productPlannerCount}
            onChange={e => setProductPlannerCount(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              background: 'var(--input-bg, var(--surface))', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px'
            }}
          >
            <option value="6">6 Baris Plan (1x CEP)</option>
            <option value="12">12 Baris Plan (2x CEP - Standar)</option>
            <option value="18">18 Baris Plan (3x CEP)</option>
            <option value="24">24 Baris Plan (4x CEP - Massal)</option>
            <option value="30">30 Baris Plan (5x CEP - Maksimal)</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', background: 'var(--surface)', color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)', borderRadius: '10px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={generating}
          style={{
            flex: 2, padding: '12px', background: 'var(--action-primary)', color: 'var(--on-action-primary, #ffffff)',
            border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          {generating ? '⏳ Menyimpan...' : (mode === 'capture' ? '✅ Konfirmasi Brief Planner' : '💾 Simpan Draft Planner')}
        </button>
      </div>
    </form>
  );

  if (isInline) {
    return formContent;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px',
        width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px',
        boxShadow: 'var(--shadow-modal)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            ✨ Generator Content Planner Baru
          </h2>
          {onCancel && (
            <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
          )}
        </div>
        {formContent}
      </div>
    </div>
  );
}
