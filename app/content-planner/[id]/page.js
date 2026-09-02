'use client';

import Sidebar from '../../components/Sidebar';
import ImportPlannerModal from '../../components/ImportPlannerModal';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ContentPlannerWorkbench() {
  const params = useParams();
  const router = useRouter();
  const plannerId = params.id;

  const [planner, setPlanner] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState({}); // { rowId_field: boolean }
  const [editingCell, setEditingCell] = useState(null); // { rowId, field }
  const [cellValue, setCellValue] = useState('');
  const [toast, setToast] = useState(null);

  const [executing, setExecuting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showOpcModal, setShowOpcModal] = useState(false);

  // Research UI State
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshQuery, setRefreshQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [researchDetail, setResearchDetail] = useState(null);
  const [loadingResearch, setLoadingResearch] = useState(false);

  useEffect(() => {
    if (plannerId) {
      fetchPlannerDetail();
    }
  }, [plannerId]);

  async function handleExecute() {
    try {
      setExecuting(true);
      showToast('Memulai 3-Fase AI Pipeline...');
      const res = await fetch(`/api/content-planner/${plannerId}/execute`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('AI Content Planner Berhasil Dieksekusi!');
        fetchPlannerDetail();
      } else {
        showToast('Gagal eksekusi: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error eksekusi: ' + e.message, 'error');
    } finally {
      setExecuting(false);
    }
  }

  async function handleSyncContentFlow() {
    try {
      setSyncing(true);
      showToast('Mengirim data ke Content Flow API...');
      const res = await fetch(`/api/content-planner/${plannerId}/sync-contentflow`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Berhasil sinkronisasi ${data.synced_rows} baris ke Content Flow Web App! 🚀`);
        fetchPlannerDetail();
      } else {
        showToast('Gagal sinkronisasi Content Flow: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error sync: ' + e.message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function fetchPlannerDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/content-planner/${plannerId}`);
      const data = await res.json();
      if (data.success) {
        setPlanner(data.planner);
        setRows(data.planner.rows || []);
      } else {
        showToast('Gagal memuat detail planner: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchResearchDetail() {
    try {
      setLoadingResearch(true);
      const res = await fetch(`/api/content-planner/${plannerId}/research`);
      const data = await res.json();
      if (data.success) {
        setResearchDetail(data);
      } else {
        showToast('Gagal memuat data research: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error riset: ' + e.message, 'error');
    } finally {
      setLoadingResearch(false);
    }
  }

  async function handleOpenEvidenceModal() {
    setShowEvidenceModal(true);
    await fetchResearchDetail();
  }

  async function handleTriggerRefresh() {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/content-planner/${plannerId}/research/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: refreshQuery || null })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Riset baru berhasil dijadwalkan! Hermes agent sedang bekerja.');
        setShowRefreshModal(false);
        setRefreshQuery('');
        fetchPlannerDetail();
      } else {
        showToast('Gagal refresh: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error refresh: ' + e.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function toggleLock(row) {
    const newLockState = row.is_locked ? 0 : 1;
    try {
      const res = await fetch(`/api/content-planner/${plannerId}/rows/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_locked: newLockState })
      });
      const data = await res.json();
      if (data.success) {
        setRows(rows.map(r => r.id === row.id ? { ...r, is_locked: newLockState } : r));
        showToast(newLockState ? 'Baris dikunci 🔒' : 'Kuncian dibuka 🔓');
      }
    } catch (e) {
      showToast('Gagal mengubah kuncian: ' + e.message, 'error');
    }
  }

  async function handleCellSave(rowId, field) {
    try {
      const res = await fetch(`/api/content-planner/${plannerId}/rows/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: cellValue })
      });
      const data = await res.json();
      if (data.success) {
        setRows(rows.map(r => r.id === rowId ? { ...r, [field]: cellValue } : r));
        setEditingCell(null);
        showToast('Perubahan berhasil disimpan');
      }
    } catch (e) {
      showToast('Gagal menyimpan: ' + e.message, 'error');
    }
  }

  async function handleRegenerate(row, scope, field = null) {
    if (row.is_locked) {
      showToast('Baris sedang dikunci (Locked). Buka kuncian terlebih dahulu!', 'error');
      return;
    }

    const key = `${row.id}_${field || scope}`;
    try {
      setRegenerating(prev => ({ ...prev, [key]: true }));
      const res = await fetch(`/api/content-planner/${plannerId}/rows/${row.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, field })
      });
      const data = await res.json();
      if (data.success && data.row) {
        setRows(rows.map(r => r.id === row.id ? { ...r, ...data.row } : r));
        showToast(`Regenerasi ${field || scope} berhasil (menggunakan revision riset terkunci) ✨`);
      } else {
        showToast('Gagal regenerasi: ' + (data.error || 'Terjadi kesalahan'), 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setRegenerating(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleDeleteRow(rowId) {
    if (!confirm('Yakin hapus baris ini?')) return;
    try {
      const res = await fetch(`/api/content-planner/${plannerId}/rows/${rowId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRows(rows.filter(r => r.id !== rowId));
        showToast('Baris berhasil dihapus');
      }
    } catch (e) {
      showToast('Gagal menghapus: ' + e.message, 'error');
    }
  }

  function handleExport(format) {
    window.open(`/api/content-planner/${plannerId}/export?format=${format}`, '_blank');
  }

  const researchStatus = planner?.research?.status || planner?.research_status || 'none';
  const getResearchBadge = (status) => {
    switch (status) {
      case 'validated':
        return { label: '🔬 Research-Backed', bg: 'var(--status-success-soft)', color: 'var(--status-success)', border: 'var(--status-success)' };
      case 'partially_verified':
        return { label: '⚠️ Partially Verified', bg: 'var(--status-info-soft)', color: 'var(--status-info)', border: 'var(--status-info)' };
      case 'stale':
        return { label: '⏳ Stale Research', bg: 'var(--status-warning-soft)', color: 'var(--status-warning)', border: 'var(--status-warning)' };
      case 'rejected':
        return { label: '❌ Research Rejected', bg: 'var(--status-danger-soft)', color: 'var(--status-danger)', border: 'var(--status-danger)' };
      default:
        return { label: '📝 No Research', bg: 'var(--surface-interactive)', color: 'var(--text-muted)', border: 'var(--border-subtle)' };
    }
  };

  const badgeStyle = getResearchBadge(researchStatus);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <div className="page-container">
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            padding: '12px 24px', borderRadius: '8px',
            background: toast.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)',
            color: 'var(--on-action-primary)', fontWeight: 600, boxShadow: '0 10px 25px var(--overlay-subtle)'
          }}>
            {toast.msg}
          </div>
        )}

        {/* Top Control Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/content-planner')}
                style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
              >
                ← Kembali
              </button>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {planner?.title || 'Detail Content Planner'}
              </h1>
              <span style={{
                background: badgeStyle.bg,
                color: badgeStyle.color,
                border: `1px solid ${badgeStyle.border}`,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700
              }}>
                {badgeStyle.label}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>👤 Akun: <strong style={{ color: 'var(--status-neutral)' }}>@{planner?.account_name || 'Umum'}</strong></span>
              <span>{planner?.planner_focus === 'brand_editorial' ? '🧩 Brand Editorial' : <>📦 Produk: <strong>{planner?.product_name}</strong></>}</span>
              <span>Platform: <strong>{planner?.platform?.toUpperCase()}</strong></span>
              {planner?.google_sheet_id && (
                <span>📊 Sheet ID: <strong style={{ color: 'var(--status-success)' }}>{planner.google_sheet_id}</strong></span>
              )}
              {planner?.affiliate_url && (
                <span>🔗 Affiliate: <a href={planner.affiliate_url} target="_blank" rel="noreferrer" style={{ color: 'var(--link)', textDecoration: 'underline' }}>Link</a></span>
              )}
              <span>Total: <strong>{rows.length} Baris Plan</strong></span>
            </p>
          </div>

          {/* Export & Sync Action Bar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowOpcModal(true)}
              style={{ padding: '8px 14px', background: 'var(--status-neutral-soft)', color: 'var(--status-neutral)', border: '1px solid var(--status-neutral)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
            >
              🌱 Ingest ke OPC
            </button>
            <button
              onClick={handleSyncContentFlow}
              disabled={syncing}
              style={{ padding: '8px 14px', background: syncing ? 'var(--surface-interactive)' : 'var(--action-primary)', color: syncing ? 'var(--text-disabled)' : 'var(--on-action-primary)', border: `1px solid ${syncing ? 'var(--border-subtle)' : 'var(--action-primary)'}`, borderRadius: '8px', fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer', fontSize: '13px' }}
            >
              {syncing ? '⏳ Menyinkronkan...' : '🚀 Sync Content Flow'}
            </button>
            <button
              onClick={() => handleExport('csv')}
              style={{ padding: '8px 14px', background: 'var(--status-info-soft)', color: 'var(--status-info)', border: '1px solid var(--status-info)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              📥 CSV
            </button>
            <button
              onClick={() => handleExport('md')}
              style={{ padding: '8px 14px', background: 'var(--status-neutral-soft)', color: 'var(--status-neutral)', border: '1px solid var(--status-neutral)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              📝 MD
            </button>
            <button
              onClick={() => handleExport('json')}
              style={{ padding: '8px 14px', background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              📄 JSON
            </button>
          </div>
        </div>

        {/* Research Evidence Summary Banner */}
        {planner?.research && (
          <div style={{
            marginBottom: '20px', padding: '16px 20px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            borderRadius: '12px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: '14px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  🔍 Research Lineage: {planner.research.query ? `"${planner.research.query}"` : 'Belum ada riset'}
                </span>
                {planner.research.snapshot_sha256 && (
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    SHA: {planner.research.snapshot_sha256}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '16px' }}>
                {planner.research.researched_at && (
                  <span>🕒 Diriset: {new Date(planner.research.researched_at).toLocaleString('id-ID')}</span>
                )}
                {planner.research.source_policy && (
                  <span>🛡️ Policy: {planner.research.source_policy}</span>
                )}
                {planner.research.revision_id && (
                  <span>📦 Revision: {planner.research.revision_id}</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleOpenEvidenceModal}
                style={{
                  padding: '8px 14px', background: 'var(--surface-raised)',
                  border: '1px solid var(--border-strong)', color: 'var(--text-primary)',
                  borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                }}
              >
                🔬 Lihat Evidence & Sumber
              </button>
              <button
                onClick={() => setShowRefreshModal(true)}
                style={{
                  padding: '8px 14px', background: 'var(--status-neutral-soft)',
                  border: '1px solid var(--status-neutral)', color: 'var(--status-neutral)',
                  borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                }}
              >
                🔄 Refresh Riset
              </button>
            </div>
          </div>
        )}

        {/* Draft Warning & Execute Banner */}
        {(planner?.status === 'draft' || rows.length === 0) && !loading && (
          <div style={{
            marginBottom: '20px', padding: '20px 24px', background: 'var(--bg-secondary)',
            border: '1px solid var(--status-neutral)', borderRadius: '12px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
          }}>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: 'var(--status-neutral)', fontWeight: 700 }}>
                📝 Content Planner Ini Masih Berstatus Draft
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--status-neutral)' }}>
                Parameter produk dan platform telah tersimpan. Klik tombol di kanan untuk mengeksekusi 3-Fase AI Pipeline.
              </p>
            </div>
            <button
              onClick={handleExecute}
              disabled={executing}
              style={{
                padding: '12px 24px', background: 'var(--action-primary)',
                color: 'var(--on-action-primary)', border: '1px solid var(--action-primary)', borderRadius: '10px', fontWeight: 700,
                cursor: executing ? 'not-allowed' : 'pointer', fontSize: '14px',
                boxShadow: '0 4px 14px var(--status-neutral-soft)'
              }}
            >
              {executing ? '⏳ Memproses 3-Fase AI Pipeline...' : '🚀 Eksekusi AI Planner Sekarang'}
            </button>
          </div>
        )}

        {/* 9-Column Planner Table */}
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat tabel planner...</div>
        ) : (
          <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'var(--text-primary)', minWidth: '1600px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-strong)', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 12px', width: '50px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '14px 12px', width: '60px', textAlign: 'center' }}>Lock</th>
                  <th style={{ padding: '14px 12px', width: '160px', color: 'var(--status-warning)' }}>🆔 Video ID</th>
                  <th style={{ padding: '14px 12px', width: '150px' }}>1. Pillar</th>
                  <th style={{ padding: '14px 12px', width: '160px' }}>2. Category CEP</th>
                  <th style={{ padding: '14px 12px', width: '160px' }}>3. W'S Matrix</th>
                  <th style={{ padding: '14px 12px', width: '200px' }}>4. Context</th>
                  <th style={{ padding: '14px 12px', width: '140px' }}>5. VFO</th>
                  <th style={{ padding: '14px 12px', width: '180px' }}>6. Strategic Angle & Evidence</th>
                  <th style={{ padding: '14px 12px', width: '260px', background: 'var(--status-neutral-soft)', color: 'var(--status-neutral)' }}>7. Hook (Kalimat 3 Detik)</th>
                  <th style={{ padding: '14px 12px', width: '280px', background: 'var(--status-neutral-soft)', color: 'var(--status-neutral)' }}>8. Visual Action</th>
                  <th style={{ padding: '14px 12px', width: '160px' }}>9. {planner?.planner_focus === 'brand_editorial' ? 'Content Subject' : 'Product'}</th>
                  <th style={{ padding: '14px 12px', width: '120px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const ev = row.evidence;
                  const riskColor = ev?.risk_level === 'high' ? 'var(--status-danger)' : (ev?.risk_level === 'medium' ? 'var(--status-warning)' : 'var(--status-success)');
                  const riskBg = ev?.risk_level === 'high' ? 'var(--status-danger-soft)' : (ev?.risk_level === 'medium' ? 'var(--status-warning-soft)' : 'var(--status-success-soft)');

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: row.is_locked ? 'var(--status-neutral-soft)' : (idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-raised)')
                      }}
                    >
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => toggleLock(row)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                          title={row.is_locked ? 'Unlock Row' : 'Lock Row'}
                        >
                          {row.is_locked ? '🔒' : '🔓'}
                        </button>
                      </td>

                      {/* Video ID */}
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--status-warning)', background: 'var(--status-warning-soft)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--status-warning)' }}>
                          {row.video_id || '-'}
                        </span>
                      </td>

                      {/* Column 1: Pillar */}
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--status-neutral)' }}>{row.pillar}</span>
                      </td>

                      {/* Column 2: Category CEP */}
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: 'var(--surface)', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)' }}>
                          {row.category_cep}
                        </span>
                      </td>

                      {/* Column 3: W'S Matrix */}
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{row.ws_matrix}</td>

                      {/* Column 4: Context */}
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.context}</td>

                      {/* Column 5: VFO */}
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          {row.vfo}
                        </span>
                      </td>

                      {/* Column 6: Strategic Angle & Evidence */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {row.strategic_angle}
                          </span>
                          {ev && (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                              <span style={{ background: riskBg, color: riskColor, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                {ev.risk_level?.toUpperCase()}
                              </span>
                              {ev.source_ids?.length > 0 && (
                                <span style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                  {ev.source_ids.length} Sumber
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Column 7: Hook */}
                      <td style={{ padding: '12px', background: 'var(--status-neutral-soft)' }}>
                        {editingCell?.rowId === row.id && editingCell?.field === 'hook' ? (
                          <div>
                            <textarea
                              rows={3}
                              value={cellValue}
                              onChange={e => setCellValue(e.target.value)}
                              style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--status-neutral)', borderRadius: '6px', padding: '6px' }}
                            />
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                              <button onClick={() => handleCellSave(row.id, 'hook')} style={{ background: 'var(--action-primary)', border: 'none', color: 'var(--on-action-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Simpan</button>
                              <button onClick={() => setEditingCell(null)} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Batal</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, lineHeight: '1.4' }}>"{row.hook}"</span>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                              <button
                                onClick={() => { setEditingCell({ rowId: row.id, field: 'hook' }); setCellValue(row.hook); }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleRegenerate(row, 'hook', 'hook')}
                                disabled={regenerating[`${row.id}_hook`]}
                                style={{ background: 'none', border: 'none', color: 'var(--status-neutral)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                              >
                                {regenerating[`${row.id}_hook`] ? '⏳ Generasi...' : '🔄 Regenerasi Hook'}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 8: Visual Action */}
                      <td style={{ padding: '12px', background: 'var(--status-neutral-soft)' }}>
                        {editingCell?.rowId === row.id && editingCell?.field === 'visual_action' ? (
                          <div>
                            <textarea
                              rows={3}
                              value={cellValue}
                              onChange={e => setCellValue(e.target.value)}
                              style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--status-neutral)', borderRadius: '6px', padding: '6px' }}
                            />
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                              <button onClick={() => handleCellSave(row.id, 'visual_action')} style={{ background: 'var(--action-primary)', border: 'none', color: 'var(--on-action-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Simpan</button>
                              <button onClick={() => setEditingCell(null)} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Batal</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>{row.visual_action}</span>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                              <button
                                onClick={() => { setEditingCell({ rowId: row.id, field: 'visual_action' }); setCellValue(row.visual_action); }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleRegenerate(row, 'visual_action', 'visual_action')}
                                disabled={regenerating[`${row.id}_visual_action`]}
                                style={{ background: 'none', border: 'none', color: 'var(--status-neutral)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                              >
                                {regenerating[`${row.id}_visual_action`] ? '⏳ Generasi...' : '🔄 Regenerasi Visual'}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 9: Product / Content Subject */}
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {planner?.planner_focus === 'brand_editorial' ? (row.content_subject || row.context) : (row.product_reference || row.product)}
                        {planner?.planner_focus === 'brand_editorial' && <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>{row.cta_type || 'save'} · {row.commercial_intent || 'none'}</div>}
                      </td>

                      {/* Actions Column */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            onClick={() => handleRegenerate(row, 'row')}
                            disabled={regenerating[`${row.id}_row`]}
                            style={{ background: 'var(--status-neutral-soft)', border: 'none', color: 'var(--status-neutral)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                            title="Regenerasi Penuh Baris Ini (Struktur Terkunci)"
                          >
                            {regenerating[`${row.id}_row`] ? '⏳' : '🔄 Full'}
                          </button>
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', fontSize: '14px' }}
                            title="Hapus Baris"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Evidence Drawer / Modal */}
        {showEvidenceModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'var(--overlay-subtle)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999
          }}>
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)',
              borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '800px',
              maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 40px var(--overlay-subtle)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🔬 Research Evidence & Sumber Terverifikasi
                </h3>
                <button
                  onClick={() => setShowEvidenceModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  ✕
                </button>
              </div>

              {loadingResearch ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat detail evidence...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h5 style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Query & Ringkasan</h5>
                    <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      "{researchDetail?.brief?.query || researchDetail?.research_context?.query || 'N/A'}"
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'var(--surface-raised)', padding: '12px', borderRadius: '8px' }}>
                      {researchDetail?.brief?.summary || 'Tidak ada ringkasan teks.'}
                    </p>
                  </div>

                  {/* Sources List */}
                  <div>
                    <h5 style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>
                      Sumber Terverifikasi ({researchDetail?.brief?.sources?.length || 0})
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(researchDetail?.brief?.sources || []).map((s, sIdx) => (
                        <div key={sIdx} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                              [{s.id}] {s.title || s.publisher || 'Sumber Web'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Publisher: {s.publisher || '-'} · Authority: {s.authority_class || 'unknown'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', background: s.verification_status === 'verified' ? 'var(--status-success-soft)' : 'var(--status-warning-soft)', color: s.verification_status === 'verified' ? 'var(--status-success)' : 'var(--status-warning)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                              {s.verification_status}
                            </span>
                            {s.url && (
                              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--action-primary)', fontSize: '12px', textDecoration: 'underline' }}>
                                Buka ↗
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Prohibited Claims & Limitations */}
                  {researchDetail?.brief?.prohibited_claims?.length > 0 && (
                    <div style={{ padding: '12px', background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger)', borderRadius: '8px' }}>
                      <h5 style={{ margin: '0 0 4px', color: 'var(--status-danger)', fontSize: '12px', fontWeight: 700 }}>
                        🚨 Prohibited Claims (Dilarang Digunakan)
                      </h5>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--status-danger)' }}>
                        {researchDetail.brief.prohibited_claims.map((pc, pcIdx) => (
                          <li key={pcIdx}>{pc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Refresh Confirmation Modal */}
        {showRefreshModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'var(--overlay-subtle)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999
          }}>
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)',
              borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '500px',
              boxShadow: '0 20px 40px var(--overlay-subtle)'
            }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                🔄 Jadwalkan Refresh Riset Hermes
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
                Refresh riset akan memicu siklus riset baru melalui Hermes Agent. Baris planner saat ini <strong>tidak akan tertimpa otomatis</strong> sampai revisi baru selesai divalidasi dan di-apply secara eksplisit.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Query Riset Khusus (Opsional):
                </label>
                <input
                  type="text"
                  placeholder={`Riset tren konten untuk ${planner?.product_name || planner?.account_name}`}
                  value={refreshQuery}
                  onChange={e => setRefreshQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-raised)', border: '1px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => setShowRefreshModal(false)}
                  style={{ padding: '8px 16px', background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                >
                  Batal
                </button>
                <button
                  onClick={handleTriggerRefresh}
                  disabled={refreshing}
                  style={{ padding: '8px 16px', background: 'var(--action-primary)', border: 'none', color: 'var(--on-action-primary)', borderRadius: '8px', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '13px' }}
                >
                  {refreshing ? '⏳ Menjadwalkan...' : '🚀 Mulai Riset Baru'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ImportPlannerModal
          isOpen={showOpcModal}
          onClose={() => setShowOpcModal(false)}
          initialPlannerId={plannerId}
          onSuccess={(res) => {
            if (res.status === 'draft') {
              showToast(`Draf kampanye OPC "${res.campaign_name}" (${res.ingested_count} item) berhasil disimpan.`);
            } else {
              showToast(`Berhasil di-ingest ke OPC Kampanye: ${res.campaign_name} (${res.ingested_count} item)`);
            }
            router.push('/pillar-campaigns');
          }}
        />
          <footer style={{ marginTop: '80px', padding: '24px 0', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            © 2026 MaknaFlow
          </footer>
        </div>
      </main>
    </div>
  );
}
