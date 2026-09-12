'use client';

import { useState, useEffect, useMemo } from 'react';

export function CampaignProgramPlanners({
  brandId,
  program,
  onRefreshProgram
}) {
  const [plannersData, setPlannersData] = useState({ linked: [], available: [] });
  const [loadingPlanners, setLoadingPlanners] = useState(false);
  const [plannersError, setPlannersError] = useState(null);

  // Link/Unlink states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedPlannerId, setSelectedPlannerId] = useState('');
  const [linking, setLinking] = useState(false);

  // Row Config states
  const [activePlannerRows, setActivePlannerRows] = useState(null);
  const [activePlannerId, setActivePlannerId] = useState(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  useEffect(() => {
    loadPlanners();
  }, [program?.id, brandId]);

  const loadPlanners = () => {
    if (!brandId) return;
    setLoadingPlanners(true);
    setPlannersError(null);
    const url = program?.id
      ? `/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/planners`
      : `/api/v2/affiliate-studio/brands/${brandId}/planners`;

    fetch(url)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          let linked = [];
          let available = [];
          if (Array.isArray(body.data)) {
            linked = body.data;
          } else if (body.data?.linked) {
            linked = body.data.linked;
            available = body.data.available || [];
          }
          setPlannersData({ linked, available });
          if (linked.length > 0 && !activePlannerId) {
            handleOpenRowConfig(linked[0].id);
          }
        } else {
          throw new Error(body.error || 'Failed to fetch planners connection');
        }
      })
      .catch(err => {
        setPlannersError(err.message);
      })
      .finally(() => {
        setLoadingPlanners(false);
      });
  };

  const handleOpenRowConfig = (plannerId) => {
    setActivePlannerId(plannerId);
    setLoadingRows(true);
    setRowsError(null);

    const url = program?.id
      ? `/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/planners/${plannerId}/rows`
      : `/api/v2/affiliate-studio/brands/${brandId}/planners/${plannerId}/rows`;

    fetch(url)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setActivePlannerRows(body.data || []);
        } else {
          throw new Error(body.error || 'Failed to load planner rows');
        }
      })
      .catch(err => {
        setRowsError(err.message);
      })
      .finally(() => {
        setLoadingRows(false);
      });
  };

  const handleToggleRowApproval = async (rowId, currentStatus) => {
    const nextStatus = currentStatus === 'approved' ? 'review' : 'approved';
    try {
      const res = await fetch(`/api/v2/affiliate-studio/brands/${brandId}/planners/${activePlannerId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIds: [rowId],
          allApproved: false
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal mengubah status approval');

      setActivePlannerRows(prev =>
        prev.map(r => r.id === rowId ? { ...r, status: nextStatus, metadata: { ...r.metadata, approval_status: nextStatus } } : r)
      );
      showToast(nextStatus === 'approved' ? 'Row disetujui ✅' : 'Row dikembalikan ke review ⏳');
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status');
    }
  };

  const handleBulkApproveAll = async () => {
    if (!activePlannerId) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/v2/affiliate-studio/brands/${brandId}/planners/${activePlannerId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allApproved: true })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal bulk approve');

      showToast(`✓ Semua ${json.data.updatedCount} baris berhasil diapprove!`);
      handleOpenRowConfig(activePlannerId);
    } catch (err) {
      showToast(err.message || 'Gagal bulk approve');
    } finally {
      setIsApproving(false);
    }
  };

  const handleIngestToProduction = async () => {
    if (!activePlannerId) return;
    setIsIngesting(true);
    try {
      const res = await fetch(`/api/v2/affiliate-studio/brands/${brandId}/planners/${activePlannerId}/ingest-production`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: program?.id || null })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal ingest ke production');

      showToast(`🚀 ${json.data.runsCreated} content runs berhasil dibuat di Production Workspace!`);
      onRefreshProgram?.();
    } catch (err) {
      showToast(err.message || 'Gagal ingest ke production');
    } finally {
      setIsIngesting(false);
    }
  };

  // Compute 6 CEP Coverage & Readiness
  const rows = activePlannerRows || [];
  const approvedCount = rows.filter(r => r.status === 'approved' || r.metadata?.approval_status === 'approved').length;
  const uniqueCeps = useMemo(() => {
    const ceps = new Set();
    rows.forEach(r => {
      const cep = r.categoryCep || r.category || r.metadata?.cep_code;
      if (cep) ceps.add(cep);
    });
    return ceps.size;
  }, [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          padding: '12px 20px',
          borderRadius: '10px',
          border: '1px solid var(--action-primary)',
          boxShadow: 'var(--shadow-card)',
          zIndex: 99999,
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Stage 2 Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '16px 20px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border-subtle)'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            📋 Tahap 2: AI Content Planner Workspace & Coverage Review
          </h2>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Review sudut pandang 6 CEP, Hook visual, naskah Voice-Over, dan gerbang approval produksi.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleBulkApproveAll}
            disabled={isApproving || rows.length === 0}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontWeight: 650,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ✓ Bulk Approve All Rows
          </button>
          <button
            type="button"
            onClick={handleIngestToProduction}
            disabled={isIngesting || approvedCount === 0}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              background: approvedCount > 0 ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : 'var(--surface-raised)',
              color: approvedCount > 0 ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              fontWeight: 750,
              fontSize: '12px',
              cursor: approvedCount > 0 ? 'pointer' : 'not-allowed',
              opacity: approvedCount > 0 ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🚀 Ingest Approved Rows ke Production
          </button>
        </div>
      </div>

      {/* KPI Coverage Cards (6 CEP & Readiness) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Siklus 6 CEP Coverage</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent, #a855f7)', marginTop: '4px' }}>
            {uniqueCeps} / 6 CEP Terjadwal
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>✓ Siklus Multi-Sudut Pandang</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Kesiapan Produk</span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--action-primary, #2dd4bf)', marginTop: '4px' }}>
            {rows[0]?.product || rows[0]?.metadata?.product_name || 'Serum Retinol 0.5%'}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>✓ Physical Truth & Formula Siap</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Approved Rows</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--status-success, #4ade80)', marginTop: '4px' }}>
            {approvedCount} / {rows.length} Approved
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Siap Ingest ke Produksi</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Kanal Siar</span>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            Multi-Platform Broadcast
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📸 IG · 🎵 TikTok · 📘 FB · ▶️ YT</span>
        </div>
      </div>

      {/* Connected Planner Sesi List */}
      {plannersData.linked.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {plannersData.linked.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleOpenRowConfig(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: activePlannerId === p.id ? 700 : 500,
                border: '1px solid',
                borderColor: activePlannerId === p.id ? 'var(--action-primary)' : 'var(--border-subtle)',
                background: activePlannerId === p.id ? 'var(--surface-interactive)' : 'var(--surface)',
                color: activePlannerId === p.id ? 'var(--action-primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Planner Rows Table */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '12px 16px', width: '40px' }}>#</th>
                <th style={{ padding: '12px 16px', width: '180px' }}>Sudut Pandang (6 CEP)</th>
                <th style={{ padding: '12px 16px', width: '180px' }}>Target Produk</th>
                <th style={{ padding: '12px 16px', width: '140px' }}>Kanal Distribusi</th>
                <th style={{ padding: '12px 16px' }}>Hook Visual & Naskah Voice-Over (Output AI Generator)</th>
                <th style={{ padding: '12px 16px', width: '140px' }}>Human Approval</th>
                <th style={{ padding: '12px 16px', width: '90px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    ⏳ Memuat data planner rows...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada baris konten di planner ini. Kirim brief dari <strong>Tahap 1: Content Calendar</strong> untuk memulai.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const meta = row.metadata || {};
                  const isApproved = row.status === 'approved' || meta.approval_status === 'approved';
                  const platforms = meta.target_platforms || ['instagram', 'tiktok'];

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#c084fc',
                          border: '1px solid rgba(168, 85, 247, 0.25)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {row.categoryCep || row.category || meta.cep_code || 'Problem-Solution'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{row.product || meta.product_name || 'Produk Brand'}</strong>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '4px', fontSize: '13px' }}>
                          {platforms.includes('instagram') && <span title="Instagram Reels">📸</span>}
                          {platforms.includes('tiktok') && <span title="TikTok">🎵</span>}
                          {platforms.includes('facebook') && <span title="Facebook">📘</span>}
                          {platforms.includes('youtube') && <span title="YouTube Shorts">▶️</span>}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                          "{row.hook || 'Hook visual konten'}"
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {row.body || row.visualAction || 'Naskah Voice-Over dan visual storyboard terintegrasi.'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: isApproved ? 'rgba(74, 222, 128, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                          color: isApproved ? 'var(--status-success, #4ade80)' : 'var(--status-warning, #fbbf24)',
                          border: '1px solid',
                          borderColor: isApproved ? 'rgba(74, 222, 128, 0.3)' : 'rgba(251, 191, 36, 0.3)'
                        }}>
                          {isApproved ? 'Approved ✅' : 'Review ⏳'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleRowApproval(row.id, isApproved ? 'approved' : 'review')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          Toggle
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
