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
        showToast(`Regenerasi ${field || scope} berhasil ✨`);
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

  return (
    <div className="layout-with-sidebar">
      <Sidebar />

      <main className="main-content" style={{ padding: '24px', background: '#0a0a0c', minHeight: '100vh', color: '#f3f4f6' }}>
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

        {/* Top Control Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => router.push('/content-planner')}
                style={{ background: '#1f2937', border: 'none', color: '#9ca3af', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
              >
                ← Kembali
              </button>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {planner?.title || 'Detail Content Planner'}
              </h1>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>👤 Akun: <strong style={{ color: '#818cf8' }}>@{planner?.account_name || 'Umum'}</strong></span>
              <span>📦 Produk: <strong>{planner?.product_name}</strong></span>
              <span>Platform: <strong>{planner?.platform?.toUpperCase()}</strong></span>
              {planner?.google_sheet_id && (
                <span>📊 Sheet ID: <strong style={{ color: '#34d399' }}>{planner.google_sheet_id}</strong></span>
              )}
              {planner?.affiliate_url && (
                <span>🔗 Affiliate: <a href={planner.affiliate_url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>Link</a></span>
              )}
              <span>Total: <strong>{rows.length} Baris Plan</strong></span>
            </p>
          </div>

          {/* Export & Sync Action Bar */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowOpcModal(true)}
              style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', color: '#ffffff', border: '1px solid #6366f1', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}
            >
              🌱 Ingest ke OPC (Organic Pillar)
            </button>
            <button
              onClick={handleSyncContentFlow}
              disabled={syncing}
              style={{ padding: '8px 14px', background: syncing ? '#064e3b' : '#059669', color: '#ffffff', border: '1px solid #10b981', borderRadius: '8px', fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer', fontSize: '13px' }}
            >
              {syncing ? '⏳ Menyinkronkan...' : '🚀 Sync ke Content Flow'}
            </button>
            <button
              onClick={() => handleExport('csv')}
              style={{ padding: '8px 14px', background: '#1e2937', color: '#38bdf8', border: '1px solid #334155', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              📥 Export CSV
            </button>
            <button
              onClick={() => handleExport('md')}
              style={{ padding: '8px 14px', background: '#1e2937', color: '#a78bfa', border: '1px solid #334155', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              📝 Export Markdown
            </button>
            <button
              onClick={() => handleExport('json')}
              style={{ padding: '8px 14px', background: '#1e2937', color: '#34d399', border: '1px solid #334155', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
            >
              📄 Export JSON
            </button>
          </div>
        </div>

        {/* Draft Warning & Execute Banner */}
        {(planner?.status === 'draft' || rows.length === 0) && !loading && (
          <div style={{
            marginBottom: '20px', padding: '20px 24px', background: '#1e1b4b',
            border: '1px solid #4338ca', borderRadius: '12px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
          }}>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: '#818cf8', fontWeight: 700 }}>
                📝 Content Planner Ini Masih Berstatus Draft
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#c7d2fe' }}>
                Parameter produk dan platform telah tersimpan. Klik tombol di kanan untuk mengeksekusi 3-Fase AI Pipeline.
              </p>
            </div>
            <button
              onClick={handleExecute}
              disabled={executing}
              style={{
                padding: '12px 24px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700,
                cursor: executing ? 'not-allowed' : 'pointer', fontSize: '14px',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}
            >
              {executing ? '⏳ Memproses 3-Fase AI Pipeline...' : '🚀 Eksekusi AI Planner Sekarang'}
            </button>
          </div>
        )}

        {/* 9-Column Planner Table */}
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center', color: '#9ca3af' }}>Memuat tabel planner...</div>
        ) : (
          <div style={{ overflowX: 'auto', background: '#121318', border: '1px solid #27272a', borderRadius: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#e5e7eb', minWidth: '1600px' }}>
              <thead>
                <tr style={{ background: '#18181b', borderBottom: '1px solid #27272a', textTransform: 'uppercase', fontSize: '11px', color: '#9ca3af', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 12px', width: '50px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '14px 12px', width: '60px', textAlign: 'center' }}>Lock</th>
                  <th style={{ padding: '14px 12px', width: '160px', color: '#fbbf24' }}>🆔 Video ID</th>
                  <th style={{ padding: '14px 12px', width: '150px' }}>1. Pillar</th>
                  <th style={{ padding: '14px 12px', width: '160px' }}>2. Category CEP</th>
                  <th style={{ padding: '14px 12px', width: '160px' }}>3. W'S Matrix</th>
                  <th style={{ padding: '14px 12px', width: '200px' }}>4. Context</th>
                  <th style={{ padding: '14px 12px', width: '150px' }}>5. VFO</th>
                  <th style={{ padding: '14px 12px', width: '160px' }}>6. Strategic Angle</th>
                  <th style={{ padding: '14px 12px', width: '260px', background: '#1e1b4b', color: '#c7d2fe' }}>7. Hook (Kalimat 3 Detik)</th>
                  <th style={{ padding: '14px 12px', width: '280px', background: '#1e1b4b', color: '#c7d2fe' }}>8. Visual Action</th>
                  <th style={{ padding: '14px 12px', width: '140px' }}>9. Product</th>
                  <th style={{ padding: '14px 12px', width: '120px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid #1f2937',
                      background: row.is_locked ? 'rgba(30, 27, 75, 0.25)' : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)')
                    }}
                  >
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: '#6b7280' }}>{idx + 1}</td>
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
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#fbbf24', background: '#1c1917', padding: '3px 8px', borderRadius: '4px', border: '1px solid #44403c' }}>
                        {row.video_id || '-'}
                      </span>
                    </td>

                    {/* Column 1: Pillar */}
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 600, color: '#818cf8' }}>{row.pillar}</span>
                    </td>

                    {/* Column 2: Category CEP */}
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: '#27272a', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', color: '#e4e4e7' }}>
                        {row.category_cep}
                      </span>
                    </td>

                    {/* Column 3: W'S Matrix */}
                    <td style={{ padding: '12px', color: '#a1a1aa' }}>{row.ws_matrix}</td>

                    {/* Column 4: Context */}
                    <td style={{ padding: '12px', color: '#d4d4d8' }}>{row.context}</td>

                    {/* Column 5: VFO */}
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: '#064e3b', color: '#6ee7b7', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {row.vfo}
                      </span>
                    </td>

                    {/* Column 6: Strategic Angle */}
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: '#451a03', color: '#fcd34d', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {row.strategic_angle}
                      </span>
                    </td>

                    {/* Column 7: Hook */}
                    <td style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.05)' }}>
                      {editingCell?.rowId === row.id && editingCell?.field === 'hook' ? (
                        <div>
                          <textarea
                            rows={3}
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid #6366f1', borderRadius: '6px', padding: '6px' }}
                          />
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <button onClick={() => handleCellSave(row.id, 'hook')} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Simpan</button>
                            <button onClick={() => setEditingCell(null)} style={{ background: '#374151', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Batal</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ color: '#f3f4f6', fontWeight: 600, lineHeight: '1.4' }}>"{row.hook}"</span>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                            <button
                              onClick={() => { setEditingCell({ rowId: row.id, field: 'hook' }); setCellValue(row.hook); }}
                              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleRegenerate(row, 'hook', 'hook')}
                              disabled={regenerating[`${row.id}_hook`]}
                              style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                            >
                              {regenerating[`${row.id}_hook`] ? '⏳ Generasi...' : '🔄 Regenerasi Hook'}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Column 8: Visual Action */}
                    <td style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.05)' }}>
                      {editingCell?.rowId === row.id && editingCell?.field === 'visual_action' ? (
                        <div>
                          <textarea
                            rows={3}
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            style={{ width: '100%', background: '#18181b', color: '#fff', border: '1px solid #6366f1', borderRadius: '6px', padding: '6px' }}
                          />
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <button onClick={() => handleCellSave(row.id, 'visual_action')} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Simpan</button>
                            <button onClick={() => setEditingCell(null)} style={{ background: '#374151', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Batal</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ color: '#d1d5db', lineHeight: '1.4' }}>{row.visual_action}</span>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                            <button
                              onClick={() => { setEditingCell({ rowId: row.id, field: 'visual_action' }); setCellValue(row.visual_action); }}
                              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleRegenerate(row, 'visual_action', 'visual_action')}
                              disabled={regenerating[`${row.id}_visual_action`]}
                              style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                            >
                              {regenerating[`${row.id}_visual_action`] ? '⏳ Generasi...' : '🔄 Regenerasi Visual'}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Column 9: Product */}
                    <td style={{ padding: '12px', fontWeight: 600, color: '#f3f4f6' }}>{row.product}</td>

                    {/* Actions Column */}
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleRegenerate(row, 'row')}
                          disabled={regenerating[`${row.id}_row`]}
                          style={{ background: '#312e81', border: 'none', color: '#a5b4fc', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                          title="Regenerasi Penuh Baris Ini"
                        >
                          {regenerating[`${row.id}_row`] ? '⏳' : '🔄 Full'}
                        </button>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
                          title="Hapus Baris"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Import Planner Modal for OPC */}
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
      </main>
    </div>
  );
}
