'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

const CEP_OPTIONS = [
  { code: 'CEP 1', label: 'CEP 1: Situasi Masak Cepat & Sibuk' },
  { code: 'CEP 2', label: 'CEP 2: Masak Bersama Keluarga / Akhir Pekan' },
  { code: 'CEP 3', label: 'CEP 3: Menu Sehat & Diet Rendah Minyak' },
  { code: 'CEP 4', label: 'CEP 4: Pemula Belajar Masak Anti-Gagal' },
  { code: 'CEP 5', label: 'CEP 5: Jamuan Acara & Hari Spesial' },
  { code: 'CEP 6', label: 'CEP 6: Hemat Biaya & Food Prep Awet' }
];

const DEFAULT_BRAND_PILLARS = [
  'Edukasi & Resep Masak',
  'Behind The Scene & Story',
  'UGC & Testimoni Pelanggan',
  'Tips Praktis & Food Prep',
  'Promo & Diskon Eksklusif',
  'Entertainment & Tren Kuliner'
];

const PLATFORMS_CONFIG = [
  { id: 'instagram', label: 'Instagram', icon: '📸', color: '#ec4899' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', color: '#06b6d4' },
  { id: 'facebook', label: 'Facebook', icon: '📘', color: '#3b82f6' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', color: '#ef4444' }
];

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function AffiliateContentCalendar({
  brandId,
  brandName,
  onNavigateToPlanner
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [publishingAccounts, setPublishingAccounts] = useState([]);
  const [brandProducts, setBrandProducts] = useState([]);
  const [toastMsg, setToastMsg] = useState('');

  // Modal State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planType, setPlanType] = useState('brand_editorial'); // 'brand_editorial' (LEFT) | 'product_campaign' (RIGHT)
  const [selectedProductId, setSelectedProductId] = useState('');
  const [promotionContext, setPromotionContext] = useState('');
  const [contentCount, setContentCount] = useState(8);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [postingFrequency, setPostingFrequency] = useState('2'); // '1', '2', '3', '4', 'every2', 'every3'
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram', 'tiktok', 'facebook']);
  const [draftRows, setDraftRows] = useState([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [brandProfileData, setBrandProfileData] = useState({
    context: '',
    goal: '',
    pillars: DEFAULT_BRAND_PILLARS
  });

  // Selected schedule detail modal / drawer
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [dispatchingRepliz, setDispatchingRepliz] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();

  // 1. Fetch schedules for active month & brand
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        brand_name: brandName || '',
        month: String(currentMonth),
        year: String(currentYear)
      });
      const res = await fetch(`/api/affiliate-studio/content-schedules?${q.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSchedules(json.data || []);
        if (Array.isArray(json.accounts)) {
          setPublishingAccounts(json.accounts);
        }
      }
    } catch (err) {
      console.warn('Failed to load schedules:', err);
      showToast('Gagal memuat jadwal kalender ❌');
    } finally {
      setLoading(false);
    }
  }, [brandName, currentMonth, currentYear]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // 2. Fetch products for active brand
  useEffect(() => {
    if (!brandId) return;
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/products?readiness=all`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.items) {
          setBrandProducts(json.data.items);
          if (json.data.items.length > 0 && !selectedProductId) {
            setSelectedProductId(json.data.items[0].productId);
          }
        }
      })
      .catch(() => {});
  }, [brandId]);

  // 3. Fetch active brand profile for editorial context, goals & pillars
  useEffect(() => {
    fetch('/api/brand-profiles')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.brands)) {
          const match = json.brands.find(b => b.id === brandId || b.brand_name === brandName);
          if (match) {
            let parsedPillars = [];
            try {
              parsedPillars = typeof match.editorial_content_pillars_json === 'string'
                ? JSON.parse(match.editorial_content_pillars_json)
                : (match.editorial_content_pillars_json || []);
            } catch (_) {}

            setBrandProfileData({
              context: match.editorial_brand_context || match.tone_of_voice || 'Brand berfokus pada konten berkualitas dan engagement audiens.',
              goal: match.editorial_content_goal || 'Membangun authority dan engagement audiens.',
              pillars: (Array.isArray(parsedPillars) && parsedPillars.length > 0) ? parsedPillars : DEFAULT_BRAND_PILLARS
            });
          }
        }
      })
      .catch(() => {});
  }, [brandId, brandName]);

  // Calendar Days Computation
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sunday
    // Adjust to Monday = 0
    const startOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();

    const cells = [];

    // Prev month trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const dateObj = new Date(currentYear, currentMonth - 2, dayNum);
      const dateStr = dateObj.toISOString().split('T')[0];
      cells.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        isPrev: true
      });
    }

    // Current month days
    const todayStr = new Date().toISOString().split('T')[0];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth - 1, d);
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    // Next month leading days to complete grid (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const dateObj = new Date(currentYear, currentMonth, n);
      const dateStr = dateObj.toISOString().split('T')[0];
      cells.push({
        dayNum: n,
        dateStr,
        isCurrentMonth: false,
        isNext: true
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Group schedules by YYYY-MM-DD
  const schedulesByDate = useMemo(() => {
    const map = {};
    schedules.forEach(item => {
      const d = new Date(item.scheduled_at);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(item);
    });
    return map;
  }, [schedules]);

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Toggle platform checkbox
  const handleTogglePlatform = (pId) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(pId)) {
        if (prev.length === 1) return prev; // Minimal 1 platform
        return prev.filter(p => p !== pId);
      }
      return [...prev, pId];
    });
  };

  // Active brand pillars (dynamic with fallback)
  const activeBrandPillars = useMemo(() => {
    return (brandProfileData.pillars && brandProfileData.pillars.length > 0)
      ? brandProfileData.pillars
      : DEFAULT_BRAND_PILLARS;
  }, [brandProfileData.pillars]);

  // Dynamic Editorial Content Count Options based on active pillars count (1x - 4x)
  const editorialCountOptions = useMemo(() => {
    const n = (activeBrandPillars && activeBrandPillars.length > 0) ? activeBrandPillars.length : 7;
    return [
      { value: n * 1, label: `${n * 1} Konten (1 Ide per Pilar)`, multiplier: 1 },
      { value: n * 2, label: `${n * 2} Konten (2 Ide per Pilar)`, multiplier: 2 },
      { value: n * 3, label: `${n * 3} Konten (3 Ide per Pilar)`, multiplier: 3 },
      { value: n * 4, label: `${n * 4} Konten (4 Ide per Pilar / 1 Bulan)`, multiplier: 4 },
    ];
  }, [activeBrandPillars]);

  // Auto-sync contentCount for brand_editorial to stay aligned with active pillars
  useEffect(() => {
    if (planType === 'brand_editorial' && editorialCountOptions.length > 0) {
      const exists = editorialCountOptions.some(opt => opt.value === contentCount);
      if (!exists) {
        setContentCount(editorialCountOptions[0].value);
      }
    }
  }, [planType, editorialCountOptions, contentCount]);

  // Generate Draft Rows
  const handleGeneratePlanDraft = () => {
    const count = parseInt(contentCount, 10) || (planType === 'brand_editorial' ? (editorialCountOptions[0]?.value || 7) : 6);
    const baseDate = new Date(startDate);
    const rows = [];

    const defaultTimeSlots = {
      '1': ['10:00'],
      '2': ['10:00', '16:00'],
      '3': ['09:00', '13:00', '19:00'],
      '4': ['08:00', '12:00', '16:00', '20:00'],
      'every2': ['10:00'],
      'every3': ['10:00']
    };

    const slots = defaultTimeSlots[postingFrequency] || ['10:00'];
    let currentDayOffset = 0;
    let slotIdx = 0;

    const selectedProduct = brandProducts.find(p => p.productId === selectedProductId);
    const resolvedProdName = selectedProduct?.displayName || selectedProduct?.name || 'Produk Unggulan';

    for (let i = 0; i < count; i++) {
      const rowDate = new Date(baseDate);

      if (postingFrequency === 'every2') {
        rowDate.setDate(baseDate.getDate() + (i * 2));
      } else if (postingFrequency === 'every3') {
        rowDate.setDate(baseDate.getDate() + (i * 3));
      } else {
        rowDate.setDate(baseDate.getDate() + currentDayOffset);
      }

      const dateStr = rowDate.toISOString().split('T')[0];
      const timeStr = slots[slotIdx % slots.length];

      if (postingFrequency !== 'every2' && postingFrequency !== 'every3') {
        slotIdx++;
        if (slotIdx % slots.length === 0) {
          currentDayOffset++;
        }
      }

      const cepIdx = i % CEP_OPTIONS.length;
      const pillarIdx = i % activeBrandPillars.length;

      rows.push({
        id: `draft_${i}_${Date.now()}`,
        cep_code: planType === 'product_campaign' ? CEP_OPTIONS[cepIdx].code : null,
        pillar_name: planType === 'brand_editorial' ? activeBrandPillars[pillarIdx] : null,
        product_name: planType === 'product_campaign' ? resolvedProdName : null,
        date: dateStr,
        time: timeStr
      });
    }

    setDraftRows(rows);
  };

  // Save Plan to Database
  const handleSavePlan = async () => {
    if (draftRows.length === 0) {
      showToast('Klik "Buat Rencana Konten" terlebih dahulu.');
      return;
    }

    setSavingPlan(true);
    try {
      const selectedProduct = brandProducts.find(p => p.productId === selectedProductId);
      const productName = planType === 'product_campaign' ? (selectedProduct?.displayName || selectedProduct?.name) : null;

      const items = draftRows.map(row => ({
        cep_code: planType === 'product_campaign' ? row.cep_code : null,
        pillar_name: planType === 'brand_editorial' ? row.pillar_name : null,
        product_name: productName,
        scheduled_at: `${row.date}T${row.time}:00`
      }));

      // Map platform to Repliz accounts
      const matchedAccountIds = publishingAccounts
        .filter(acc => selectedPlatforms.includes(acc.platform))
        .map(acc => acc.id);

      const payload = {
        plan_type: planType,
        brand_name: brandName || 'MAKNA Brand',
        product_id: planType === 'product_campaign' ? selectedProductId : null,
        product_name: productName,
        promotion_context: promotionContext,
        target_platforms: selectedPlatforms,
        target_account_ids: matchedAccountIds,
        items
      };

      const res = await fetch('/api/affiliate-studio/content-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menyimpan rencana kalender.');
      }

      showToast(`🎉 ${draftRows.length} jadwal konten berhasil ditambahkan ke kalender!`);
      setShowPlanModal(false);
      setDraftRows([]);
      fetchSchedules();
    } catch (err) {
      console.error('Error saving plan:', err);
      showToast(err.message || 'Gagal menyimpan rencana.');
    } finally {
      setSavingPlan(false);
    }
  };

  // Dispatch to Repliz
  const handleDispatchRepliz = async (sched) => {
    setDispatchingRepliz(true);
    try {
      const res = await fetch('/api/affiliate-studio/content-schedules/publish-repliz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: sched.id,
          caption: sched.promotion_context || `Konten Spesial ${sched.product_name || sched.brand_name}`,
          media_url: sched.db_product_photo_url || ''
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal dispatch ke Repliz.');
      }
      showToast(json.message || 'Berhasil dijadwalkan ke Repliz! 🚀');
      setSelectedSchedule(null);
      fetchSchedules();
    } catch (err) {
      console.error('Error dispatching Repliz:', err);
      showToast(err.message || 'Gagal dispatch ke Repliz ❌');
    } finally {
      setDispatchingRepliz(false);
    }
  };

  // Open modal prefilled with specific date
  const handleOpenAddOnDate = (dateStr) => {
    setStartDate(dateStr);
    setDraftRows([]);
    setShowPlanModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--surface-bg, #0f172a)',
          color: 'var(--text-main, #f8fafc)',
          padding: '12px 20px',
          borderRadius: '10px',
          border: '1px solid var(--primary, #38bdf8)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 99999,
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '16px 20px',
        background: 'var(--surface-bg, #0f172a)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #1e293b)'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-main, #f8fafc)' }}>
            📅 Content Calendar & Repliz Scheduling
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
            Jadwalkan konten editorial brand dan kampanye produk dengan integrasi multi-channel broadcast.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setDraftRows([]);
              setShowPlanModal(true);
            }}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              background: 'var(--primary, #38bdf8)',
              color: '#0f172a',
              border: 'none',
              fontWeight: 750,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>+</span> Tambahkan Plan
          </button>

          <button
            type="button"
            onClick={() => onNavigateToPlanner?.()}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.1)',
              color: 'var(--primary, #38bdf8)',
              border: '1px solid var(--primary, #38bdf8)',
              fontWeight: 650,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>⚡</span> Buka Content Planner
          </button>
        </div>
      </div>

      {/* Calendar Shell */}
      <div style={{
        background: 'var(--surface-bg, #0f172a)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #1e293b)',
        overflow: 'hidden'
      }}>
        {/* Calendar Nav Bar */}
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color, #1e293b)',
          background: 'var(--surface-header, rgba(15, 23, 42, 0.6))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'var(--surface-subtle, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              ‹ Prev
            </button>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #f8fafc)' }}>
              📅 {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'var(--surface-subtle, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Next ›
            </button>
            <button
              type="button"
              onClick={handleToday}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'transparent',
                border: '1px solid var(--border-color, #334155)',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Bulan Ini
            </button>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
            Total <strong style={{ color: 'var(--primary, #38bdf8)' }}>{schedules.length}</strong> Konten Terjadwal
            {loading && <span style={{ marginLeft: '8px', fontSize: '11px' }}>⏳ Memuat...</span>}
          </div>
        </div>

        {/* Weekday Headers (Mon-Sun) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          background: 'var(--surface-subtle, #090e1a)',
          borderBottom: '1px solid var(--border-color, #1e293b)'
        }}>
          {['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'].map((day, idx) => (
            <div
              key={day}
              style={{
                padding: '10px',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: idx >= 5 ? '#f43f5e' : 'var(--text-muted, #94a3b8)',
                letterSpacing: '0.5px'
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Date Cells Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          background: 'var(--border-color, #1e293b)',
          gap: '1px'
        }}>
          {calendarGrid.map((cell, idx) => {
            const daySchedules = schedulesByDate[cell.dateStr] || [];
            return (
              <div
                key={`${cell.dateStr}_${idx}`}
                style={{
                  background: cell.isCurrentMonth ? 'var(--surface-bg, #0f172a)' : 'rgba(15, 23, 42, 0.4)',
                  minHeight: '120px',
                  maxHeight: '160px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  opacity: cell.isCurrentMonth ? 1 : 0.45,
                  overflow: 'hidden'
                }}
              >
                {/* Cell Header: Date Number & Add Button */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px'
                }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: cell.isToday ? 800 : 600,
                    color: cell.isToday ? 'var(--primary, #38bdf8)' : 'var(--text-main, #f8fafc)',
                    background: cell.isToday ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    padding: cell.isToday ? '2px 6px' : '0',
                    borderRadius: '4px'
                  }}>
                    {cell.dayNum}
                  </span>

                  {cell.isCurrentMonth && (
                    <button
                      type="button"
                      onClick={() => handleOpenAddOnDate(cell.dateStr)}
                      title="Tambah jadwal di tanggal ini"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted, #94a3b8)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '0 4px',
                        lineHeight: 1
                      }}
                    >
                      +
                    </button>
                  )}
                </div>

                {/* List of Schedules in this date */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  overflowY: 'auto',
                  flex: 1,
                  paddingRight: '2px'
                }}>
                  {daySchedules.map(sched => {
                    const timeStr = new Date(sched.scheduled_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const isCampaign = sched.plan_type === 'product_campaign';
                    const platforms = Array.isArray(sched.target_platforms) ? sched.target_platforms : ['instagram', 'tiktok'];

                    return (
                      <div
                        key={sched.id}
                        onClick={() => setSelectedSchedule(sched)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: isCampaign ? 'rgba(56, 189, 248, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                          borderLeft: isCampaign ? '3px solid #38bdf8' : '3px solid #a855f7',
                          borderTop: '1px solid var(--border-color, #1e293b)',
                          borderRight: '1px solid var(--border-color, #1e293b)',
                          borderBottom: '1px solid var(--border-color, #1e293b)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 750, color: isCampaign ? '#38bdf8' : '#c084fc' }}>
                            {timeStr}
                          </span>
                          <span style={{ fontSize: '9px', opacity: 0.75 }}>
                            {sched.cep_code || sched.pillar_name || 'Konten'}
                          </span>
                        </div>
                        <div style={{
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: 'var(--text-main, #f8fafc)'
                        }}>
                          {sched.product_name || sched.pillar_name || 'Brand Post'}
                        </div>
                        {/* Multi-Platform Badges */}
                        <div style={{ display: 'flex', gap: '3px', marginTop: '3px', fontSize: '9px' }}>
                          {platforms.includes('instagram') && <span title="Instagram">📸</span>}
                          {platforms.includes('tiktok') && <span title="TikTok">🎵</span>}
                          {platforms.includes('facebook') && <span title="Facebook">📘</span>}
                          {platforms.includes('youtube') && <span title="YouTube">▶️</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL TAMBAHKAN PLAN */}
      {showPlanModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
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
            maxWidth: '780px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color, #1e293b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-header, rgba(15, 23, 42, 0.6))'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  📅 Buat Rencana Jadwal Konten
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                  Brand: <strong>{brandName || 'MAKNA Brand'}</strong> · Terintegrasi dengan Repliz Multi-Platform
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 1. Plan Type Switcher (Brand Editorial KIRI, Product Campaign KANAN) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted, #94a3b8)' }}>
                  1. Pilih Tipe Plan
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Brand Editorial di KIRI */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlanType('brand_editorial');
                      setContentCount(editorialCountOptions[0]?.value || (activeBrandPillars.length || 7));
                      setDraftRows([]);
                    }}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: planType === 'brand_editorial' ? '2px solid var(--primary, #38bdf8)' : '1px solid var(--border-color, #1e293b)',
                      background: planType === 'brand_editorial' ? 'rgba(56, 189, 248, 0.12)' : 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontWeight: 750, fontSize: '14px', marginBottom: '4px', color: planType === 'brand_editorial' ? 'var(--primary, #38bdf8)' : 'inherit' }}>
                      🏛️ Brand Editorial
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                      Konten pilar otoritas brand, edukasi umum, lifestyle, dan interaksi audiens.
                    </div>
                  </button>

                  {/* Product Campaign di KANAN */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlanType('product_campaign');
                      setContentCount(6);
                      setDraftRows([]);
                    }}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: planType === 'product_campaign' ? '2px solid #a855f7' : '1px solid var(--border-color, #1e293b)',
                      background: planType === 'product_campaign' ? 'rgba(168, 85, 247, 0.12)' : 'var(--surface-subtle, #090e1a)',
                      color: 'var(--text-main, #f8fafc)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontWeight: 750, fontSize: '14px', marginBottom: '4px', color: planType === 'product_campaign' ? '#c084fc' : 'inherit' }}>
                      📦 Product Campaign
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                      Pengetesan siklus 6 CEP spesifik untuk 1 produk dengan konteks promosi.
                    </div>
                  </button>
                </div>
              </div>

              {/* 2.A Subform: Brand Editorial */}
              {planType === 'brand_editorial' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Snapshot Konteks & Pilar dari Brand Profile Aktif */}
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'var(--surface-subtle, #090e1a)',
                    border: '1px solid var(--border-color, #1e293b)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ fontSize: '12px', display: 'flex', gap: '6px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary, #38bdf8)', minWidth: '110px' }}>📌 Konteks Brand:</span>
                      <span style={{ color: 'var(--text-main, #f8fafc)' }}>
                        {brandProfileData.context || 'Brand berfokus pada konten berkualitas tinggi.'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', display: 'flex', gap: '6px' }}>
                      <span style={{ fontWeight: 700, color: '#c084fc', minWidth: '110px' }}>🎯 Tujuan Konten:</span>
                      <span style={{ color: 'var(--text-main, #f8fafc)' }}>
                        {brandProfileData.goal || 'Membangun authority dan engagement audiens.'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-muted, #94a3b8)' }}>🏛️ Pilar Konten Brand:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {activeBrandPillars.map(p => (
                          <span
                            key={p}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: 'rgba(56, 189, 248, 0.12)',
                              color: 'var(--primary, #38bdf8)',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              border: '1px solid rgba(56, 189, 248, 0.25)'
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Form Parameters Editorial */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                        Jumlah Konten
                      </label>
                      <select
                        value={contentCount}
                        onChange={(e) => setContentCount(Number(e.target.value))}
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
                      >
                        {editorialCountOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                        Jadwalkan Mulai
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
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

                  {/* Frequency Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                      Frekuensi Posting (Berapa Kali Sehari / Interval)
                    </label>
                    <select
                      value={postingFrequency}
                      onChange={(e) => setPostingFrequency(e.target.value)}
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
                    >
                      <option value="1">1x Posting per Hari (10:00 WIB)</option>
                      <option value="2">2x Posting per Hari (10:00 & 16:00 WIB)</option>
                      <option value="3">3x Posting per Hari (09:00, 13:00, 19:00 WIB)</option>
                      <option value="4">4x Posting per Hari (08:00, 12:00, 16:00, 20:00 WIB)</option>
                      <option value="every2">1x Posting tiap 2 Hari (2 Hari Sekali)</option>
                      <option value="every3">1x Posting tiap 3 Hari (3 Hari Sekali)</option>
                    </select>
                  </div>

                  {/* Multi-Platform Broadcast Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                      🎯 Target Kanal Distribusi (Multi-Platform Broadcast)
                    </label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {PLATFORMS_CONFIG.map(p => (
                        <label
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: selectedPlatforms.includes(p.id) ? 'rgba(56, 189, 248, 0.12)' : 'var(--surface-subtle, #090e1a)',
                            border: selectedPlatforms.includes(p.id) ? '1px solid var(--primary, #38bdf8)' : '1px solid var(--border-color, #1e293b)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPlatforms.includes(p.id)}
                            onChange={() => handleTogglePlatform(p.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Trigger Generate Draft Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleGeneratePlanDraft}
                      style={{
                        width: '100%',
                        padding: '11px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--primary, #38bdf8)',
                        color: '#0f172a',
                        fontWeight: 750,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ Buat Rencana Baris Jadwal ({contentCount} Konten)
                    </button>
                  </div>
                </div>
              )}

              {/* 2.B Subform: Product Campaign */}
              {planType === 'product_campaign' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                        Pilih 1 Produk Target
                      </label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
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
                      >
                        {brandProducts.map(p => (
                          <option key={p.productId} value={p.productId}>
                            {p.displayName || p.productName || p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                        Jumlah Konten (Siklus 6 CEP)
                      </label>
                      <select
                        value={contentCount}
                        onChange={(e) => setContentCount(Number(e.target.value))}
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
                      >
                        <option value="6">6 Konten (1 Siklus 6 CEP Penuh)</option>
                        <option value="12">12 Konten (2 Siklus 6 CEP)</option>
                        <option value="18">18 Konten (3 Siklus 6 CEP)</option>
                        <option value="24">24 Konten (4 Siklus 6 CEP / 1 Bulan)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                      Konteks Promosi Khusus (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={promotionContext}
                      onChange={(e) => setPromotionContext(e.target.value)}
                      placeholder="Contoh: Promo Flash Sale Gajian Diskon 25% + Free Ongkir se-Indonesia..."
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
                        Jadwalkan Mulai
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
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
                        Frekuensi Posting
                      </label>
                      <select
                        value={postingFrequency}
                        onChange={(e) => setPostingFrequency(e.target.value)}
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
                      >
                        <option value="1">1x Posting per Hari (10:00 WIB)</option>
                        <option value="2">2x Posting per Hari (10:00 & 16:00 WIB)</option>
                        <option value="3">3x Posting per Hari (09:00, 13:00, 19:00 WIB)</option>
                        <option value="4">4x Posting per Hari (08:00, 12:00, 16:00, 20:00 WIB)</option>
                        <option value="every2">1x Posting tiap 2 Hari</option>
                        <option value="every3">1x Posting tiap 3 Hari</option>
                      </select>
                    </div>
                  </div>

                  {/* Multi-Platform Broadcast Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted, #94a3b8)' }}>
                      🎯 Target Kanal Distribusi (Multi-Platform Broadcast)
                    </label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {PLATFORMS_CONFIG.map(p => (
                        <label
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: selectedPlatforms.includes(p.id) ? 'rgba(168, 85, 247, 0.12)' : 'var(--surface-subtle, #090e1a)',
                            border: selectedPlatforms.includes(p.id) ? '1px solid #a855f7' : '1px solid var(--border-color, #1e293b)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPlatforms.includes(p.id)}
                            onChange={() => handleTogglePlatform(p.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Trigger Generate Draft Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleGeneratePlanDraft}
                      style={{
                        width: '100%',
                        padding: '11px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#a855f7',
                        color: '#ffffff',
                        fontWeight: 750,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ Buat Rencana Baris Jadwal (6 CEP - {contentCount} Konten)
                    </button>
                  </div>
                </div>
              )}

              {/* Draft Rows Table */}
              {draftRows.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted, #94a3b8)' }}>
                    Preview Baris Jadwal ({draftRows.length} Konten)
                  </div>
                  <div style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color, #1e293b)',
                    borderRadius: '8px'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-subtle, #090e1a)', color: 'var(--text-muted, #94a3b8)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>{planType === 'product_campaign' ? 'CEP Target' : 'Pilar'}</th>
                          <th style={{ padding: '8px 10px' }}>Tanggal</th>
                          <th style={{ padding: '8px 10px' }}>Jam WIB</th>
                          <th style={{ padding: '8px 10px' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftRows.map((row, idx) => (
                          <tr key={row.id} style={{ borderTop: '1px solid var(--border-color, #1e293b)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>{idx + 1}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {planType === 'product_campaign' ? (
                                <select
                                  value={row.cep_code}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDraftRows(prev => prev.map((r, i) => i === idx ? { ...r, cep_code: val } : r));
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color, #1e293b)',
                                    background: 'var(--surface-bg, #0f172a)',
                                    color: 'var(--text-main, #f8fafc)',
                                    fontSize: '11px'
                                  }}
                                >
                                  {CEP_OPTIONS.map(c => (
                                    <option key={c.code} value={c.code}>{c.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <select
                                  value={row.pillar_name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDraftRows(prev => prev.map((r, i) => i === idx ? { ...r, pillar_name: val } : r));
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color, #1e293b)',
                                    background: 'var(--surface-bg, #0f172a)',
                                    color: 'var(--text-main, #f8fafc)',
                                    fontSize: '11px'
                                  }}
                                >
                                  {activeBrandPillars.map(pil => (
                                    <option key={pil} value={pil}>{pil}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="date"
                                value={row.date}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftRows(prev => prev.map((r, i) => i === idx ? { ...r, date: val } : r));
                                }}
                                style={{
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color, #1e293b)',
                                  background: 'var(--surface-bg, #0f172a)',
                                  color: 'var(--text-main, #f8fafc)',
                                  fontSize: '11px'
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="time"
                                value={row.time}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftRows(prev => prev.map((r, i) => i === idx ? { ...r, time: val } : r));
                                }}
                                style={{
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color, #1e293b)',
                                  background: 'var(--surface-bg, #0f172a)',
                                  color: 'var(--text-main, #f8fafc)',
                                  fontSize: '11px'
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <button
                                type="button"
                                onClick={() => setDraftRows(prev => prev.filter((_, i) => i !== idx))}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                onClick={() => setShowPlanModal(false)}
                disabled={savingPlan}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #1e293b)',
                  background: 'transparent',
                  color: 'var(--text-main, #f8fafc)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePlan}
                disabled={savingPlan || draftRows.length === 0}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary, #38bdf8)',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: (savingPlan || draftRows.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (savingPlan || draftRows.length === 0) ? 0.6 : 1
                }}
              >
                {savingPlan ? 'Menyimpan...' : '💾 Simpan Rencana ke Kalender'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE DETAIL DRAWER / MODAL */}
      {selectedSchedule && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
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
            maxWidth: '520px',
            padding: '20px 24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                📌 Detail Jadwal Konten
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSchedule(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #94a3b8)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Waktu Tayang: </span>
                <strong>{new Date(selectedSchedule.scheduled_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })} WIB</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Tipe: </span>
                <strong>{selectedSchedule.plan_type === 'product_campaign' ? '🎯 Product Campaign' : '🏛️ Brand Editorial'}</strong>
              </div>
              {selectedSchedule.product_name && (
                <div>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Produk: </span>
                  <strong>{selectedSchedule.product_name}</strong>
                </div>
              )}
              {selectedSchedule.cep_code && (
                <div>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>CEP: </span>
                  <strong>{selectedSchedule.cep_code}</strong>
                </div>
              )}
              {selectedSchedule.pillar_name && (
                <div>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Pilar: </span>
                  <strong>{selectedSchedule.pillar_name}</strong>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Status: </span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: selectedSchedule.status === 'scheduled' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: selectedSchedule.status === 'scheduled' ? '#38bdf8' : '#f59e0b'
                }}>
                  {selectedSchedule.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedSchedule(null);
                  onNavigateToPlanner?.(selectedSchedule);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #1e293b)',
                  background: 'var(--surface-subtle, #090e1a)',
                  color: 'var(--text-main, #f8fafc)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📋 Buka Content Planner
              </button>
              <button
                type="button"
                disabled={dispatchingRepliz || selectedSchedule.status === 'scheduled'}
                onClick={() => handleDispatchRepliz(selectedSchedule)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary, #38bdf8)',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: (dispatchingRepliz || selectedSchedule.status === 'scheduled') ? 'not-allowed' : 'pointer',
                  opacity: selectedSchedule.status === 'scheduled' ? 0.6 : 1
                }}
              >
                {selectedSchedule.status === 'scheduled' ? '✓ Terjadwal di Repliz' : (dispatchingRepliz ? 'Mendispatch...' : '🚀 Jadwalkan ke Repliz')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
