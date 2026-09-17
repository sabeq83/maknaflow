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
  const [archiving, setArchiving] = useState(false);
  const [ingestingRecipe, setIngestingRecipe] = useState(false);
  const [showOpcModal, setShowOpcModal] = useState(false);

  // Selected row for Drawer (especially Recipe Campaign)
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [drawerTab, setDrawerTab] = useState(1);

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

  const isRecipeCampaign = planner?.planner_focus === 'recipe_campaign';

  function parseJsonSafe(val, fallback = null) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (_) { return fallback; }
  }

  const recipeConfig = parseJsonSafe(planner?.recipe_config_json, {});
  const productsSnapshot = parseJsonSafe(planner?.products_snapshot_json, []);

  async function handleExecute() {
    try {
      setExecuting(true);
      showToast(isRecipeCampaign ? 'Memulai Single-Pass AI Generator Resep...' : 'Memulai 3-Fase AI Pipeline...');
      const res = await fetch(`/api/content-planner/${plannerId}/execute`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(isRecipeCampaign ? 'AI Recipe Planner Berhasil Digenerate! 🍳' : 'AI Content Planner Berhasil Dieksekusi! ✨');
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

  async function handleIngestRecipeToOpc() {
    try {
      setIngestingRecipe(true);
      showToast('Meng-ingest baris resep ke Pipeline Produksi OPC...');
      const res = await fetch(`/api/content-planner/${plannerId}/ingest-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoExecute: true })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Berhasil ingest ke OPC Kampanye: ${data.campaign?.campaign_name || 'Recipe Campaign'} (${data.ingested_count} item)! 🚀`);
        setTimeout(() => {
          router.push('/pillar-campaigns');
        }, 800);
      } else {
        showToast('Gagal ingest: ' + (data.error || 'Terjadi kesalahan'), 'error');
      }
    } catch (e) {
      showToast('Error ingest: ' + e.message, 'error');
    } finally {
      setIngestingRecipe(false);
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
        const loadedRows = data.planner.rows || [];
        setRows(loadedRows);
        if (loadedRows.length > 0 && !selectedRowId) {
          setSelectedRowId(loadedRows[0].id);
        }
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

  async function handleToggleArchive() {
    if (!planner) return;
    const targetArchived = !planner.is_archived;
    const actionText = targetArchived ? 'mengarsipkan' : 'memulihkan';
    if (!confirm(`Yakin ingin ${actionText} Content Planner ini?`)) return;

    try {
      setArchiving(true);
      const res = await fetch(`/api/content-planner/${plannerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: targetArchived })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || (targetArchived ? 'Planner berhasil diarsipkan' : 'Planner berhasil dipulihkan'));
        setPlanner(prev => ({ ...prev, is_archived: targetArchived }));
      } else {
        showToast('Gagal mengubah status arsip: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setArchiving(false);
    }
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
        const nextRows = rows.filter(r => r.id !== rowId);
        setRows(nextRows);
        if (selectedRowId === rowId) {
          setSelectedRowId(nextRows.length > 0 ? nextRows[0].id : null);
        }
        showToast('Baris berhasil dihapus');
      }
    } catch (e) {
      showToast('Gagal menghapus: ' + e.message, 'error');
    }
  }

  function handleExport(format) {
    window.open(`/api/content-planner/${plannerId}/export?format=${format}`, '_blank');
  }

  const selectedRow = rows.find(r => r.id === selectedRowId) || (rows.length > 0 ? rows[0] : null);
  const selectedRecipeIdea = parseJsonSafe(selectedRow?.recipe_idea_json, {});

  function getRecipePlainText(row) {
    if (!row) return '';
    const idea = parseJsonSafe(row.recipe_idea_json, {});
    const title = (idea.recipe_title || row.title || 'Resep Kuliner').toUpperCase();
    const servings = idea.servings || '1-2 Porsi';
    const prep = idea.prep_time_minutes || 5;
    const cook = idea.cook_time_minutes || 10;
    const total = Number(prep) + Number(cook);

    let text = `${title}\nPorsi: ${servings} | Waktu: ${total} Menit\n\nBAHAN-BAHAN:\n`;
    const ings = Array.isArray(idea.ingredients) ? idea.ingredients : [];
    if (ings.length === 0) {
      text += `- Bahan-bahan sesuai selera\n`;
    } else {
      for (const ing of ings) {
        const amt = ing.amount ? `${ing.amount} ` : '';
        const unt = ing.unit ? `${ing.unit} ` : '';
        const nm = ing.name || 'Bahan';
        const tag = ing.product_id ? ' (Produk Utama)' : '';
        text += `- ${amt}${unt}${nm}${tag}\n`;
      }
    }

    text += `\nCARA MEMBUAT:\n`;
    const stps = Array.isArray(idea.steps) ? idea.steps : [];
    if (stps.length === 0) {
      text += `1. Campurkan semua bahan hingga matang dan sajikan.\n`;
    } else {
      stps.forEach((st, i) => {
        text += `${i + 1}. ${st.instruction || st}\n`;
      });
    }

    if (Array.isArray(idea.chef_tips) && idea.chef_tips.length > 0) {
      text += `\nTIPS CHEF:\n`;
      idea.chef_tips.forEach(tp => {
        text += `- ${tp}\n`;
      });
    }

    return text;
  }

  function copySelectedRecipePlainText() {
    if (!selectedRow) return;
    const text = getRecipePlainText(selectedRow);
    navigator.clipboard.writeText(text);
    showToast('📋 Teks Naskah Resep Lengkap Berhasil Disalin ke Clipboard!');
  }

  function copyFormattedCaption() {
    if (!selectedRow) return;
    const idea = parseJsonSafe(selectedRow.recipe_idea_json, {});
    const rText = getRecipePlainText(selectedRow);
    const hook = selectedRow.hook || idea.hook_3s || 'Resep viral yang wajib dicoba!';
    const caption = `${hook}\n\n${rText}\n\nYuk recook sekarang! Simpan postingan ini ya ✨\n#ResepKuliner #ResepMudah #MasakDiRumah`;
    navigator.clipboard.writeText(caption);
    showToast('📱 Caption Media Sosial Lengkap Berhasil Disalin!');
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
                {planner?.title || (isRecipeCampaign ? '🍳 Detail Recipe Campaign Planner' : 'Detail Content Planner')}
              </h1>
              {planner?.is_archived && (
                <span style={{
                  background: 'var(--status-warning-soft)',
                  color: 'var(--status-warning)',
                  border: '1px solid var(--status-warning)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  📦 Terarsip
                </span>
              )}
              {isRecipeCampaign ? (
                <span style={{
                  background: 'var(--recipe-accent-soft, var(--status-warning-soft))',
                  color: 'var(--recipe-accent, var(--status-warning))',
                  border: '1px solid var(--recipe-accent, var(--status-warning))',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  🍳 Recipe Campaign
                </span>
              ) : (
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
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>👤 Akun: <strong style={{ color: 'var(--status-neutral)' }}>@{planner?.account_name || 'Umum'}</strong></span>
              {isRecipeCampaign ? (
                <>
                  <span>🍲 Kategori: <strong>{recipeConfig?.category?.toUpperCase() || 'KULINER'}</strong></span>
                  <span>📦 Produk Terkait: <strong>{productsSnapshot?.length || 1} Produk</strong></span>
                  <span>🔀 Strategi: <strong style={{ color: recipeConfig?.strategy_mode === 'rotation' ? 'var(--status-warning)' : 'var(--status-success)' }}>{recipeConfig?.strategy_mode === 'rotation' ? '🔄 Rotasi 1 Produk' : '🌟 Sinergi Kombo'}</strong></span>
                  <span>🎯 Audiens: <strong>{planner?.target_audience || 'Semua Kalangan'}</strong></span>
                </>
              ) : (
                <span>{planner?.planner_focus === 'brand_editorial' ? '🧩 Brand Editorial' : <>📦 Produk: <strong>{planner?.product_name}</strong></>}</span>
              )}
              <span>Platform: <strong>{planner?.platform?.toUpperCase() || 'TIKTOK'}</strong></span>
              <span>Total: <strong>{rows.length} Baris Plan</strong></span>
            </p>
          </div>

          {/* Export & Sync Action Bar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleToggleArchive}
              disabled={archiving}
              style={{
                padding: '8px 14px',
                background: planner?.is_archived ? 'var(--status-warning-soft)' : 'var(--surface-interactive)',
                color: planner?.is_archived ? 'var(--status-warning)' : 'var(--text-secondary)',
                border: `1px solid ${planner?.is_archived ? 'var(--status-warning)' : 'var(--border-subtle)'}`,
                borderRadius: '8px',
                fontWeight: 600,
                cursor: archiving ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {archiving ? '⏳ Memproses...' : (planner?.is_archived ? '🔄 Pulihkan dari Arsip' : '📦 Arsipkan')}
            </button>
            {isRecipeCampaign ? (
              <button
                onClick={handleIngestRecipeToOpc}
                disabled={ingestingRecipe || rows.length === 0}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, var(--recipe-accent, #f59e0b) 0%, #b45309 100%)',
                  color: 'var(--on-action-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: (ingestingRecipe || rows.length === 0) ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
                }}
              >
                {ingestingRecipe ? '⏳ Meng-ingest ke OPC...' : '🚀 Ingest ke OPC Studio'}
              </button>
            ) : (
              <button
                onClick={() => setShowOpcModal(true)}
                style={{ padding: '8px 14px', background: 'var(--status-neutral-soft)', color: 'var(--status-neutral)', border: '1px solid var(--status-neutral)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
              >
                🌱 Ingest ke OPC
              </button>
            )}
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

        {/* Draft Warning & Execute Banner */}
        {(planner?.status === 'draft' || rows.length === 0) && !loading && (
          <div style={{
            marginBottom: '20px', padding: '20px 24px', background: 'var(--bg-secondary)',
            border: `1px solid ${isRecipeCampaign ? 'var(--recipe-accent, #f59e0b)' : 'var(--status-neutral)'}`,
            borderRadius: '12px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
          }}>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: isRecipeCampaign ? 'var(--recipe-accent, #f59e0b)' : 'var(--status-neutral)', fontWeight: 700 }}>
                {isRecipeCampaign ? '🍳 Draft Recipe Campaign Tersimpan' : '📝 Content Planner Ini Masih Berstatus Draft'}
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                {isRecipeCampaign
                  ? `Konfigurasi ${recipeConfig?.category || 'kuliner'} (${productsSnapshot?.length || 1} produk, audiens: ${planner?.target_audience || 'Umum'}) tersimpan. Klik tombol di kanan untuk generate ${planner?.recipe_count || 5} ide resep.`
                  : 'Parameter produk dan platform telah tersimpan. Klik tombol di kanan untuk mengeksekusi AI Pipeline.'}
              </p>
            </div>
            <button
              onClick={handleExecute}
              disabled={executing}
              style={{
                padding: '12px 24px',
                background: isRecipeCampaign ? 'linear-gradient(135deg, var(--recipe-accent, #f59e0b) 0%, #b45309 100%)' : 'var(--action-primary)',
                color: 'var(--on-action-primary)', border: 'none', borderRadius: '10px', fontWeight: 700,
                cursor: executing ? 'not-allowed' : 'pointer', fontSize: '14px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)'
              }}
            >
              {executing
                ? '⏳ Memproses Gemini AI Generator...'
                : (isRecipeCampaign ? `🚀 Generate ${planner?.recipe_count || 5} Resep Sekarang` : '🚀 Eksekusi AI Planner Sekarang')}
            </button>
          </div>
        )}

        {/* Recipe Campaign or Standard Planner Rows Table */}
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat tabel planner...</div>
        ) : (
          <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '14px', marginBottom: '24px' }}>
            {isRecipeCampaign ? (
              /* Recipe-Tailored Table Layout */
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'var(--text-primary)', minWidth: '1200px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-strong)', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '14px 12px', width: '50px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '14px 12px', width: '60px', textAlign: 'center' }}>Lock</th>
                    <th style={{ padding: '14px 12px', width: '130px', color: 'var(--status-warning)' }}>🆔 Video ID</th>
                    <th style={{ padding: '14px 12px', width: '280px' }}>🍲 Judul Resep & Hook Kuliner</th>
                    <th style={{ padding: '14px 12px', width: '140px' }}>Kategori & Sudut</th>
                    <th style={{ padding: '14px 12px', width: '180px' }}>📦 Produk Terikat</th>
                    <th style={{ padding: '14px 12px', width: '140px' }}>Waktu & Porsi</th>
                    <th style={{ padding: '14px 12px', width: '240px' }}>Visual Action (Hero Shot)</th>
                    <th style={{ padding: '14px 12px', width: '180px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const idea = parseJsonSafe(row.recipe_idea_json, {});
                    const isSelected = row.id === selectedRowId;
                    const rTitle = idea.recipe_title || row.title || `Resep #${idx + 1}`;
                    const rHook = row.hook || idea.hook_3s || '-';
                    const rCategory = idea.category || recipeConfig.category || 'kuliner';
                    const rAngle = idea.angle || row.strategic_angle || 'Ide Resep Praktis';
                    const rProduct = row.product_reference || row.product || 'Produk Katalog';
                    const rPrep = idea.prep_time_minutes || 5;
                    const rCook = idea.cook_time_minutes || 10;
                    const rServings = idea.servings || '1-2 Porsi';

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isSelected ? 'var(--status-info-soft)' : (row.is_locked ? 'var(--status-neutral-soft)' : (idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-raised)'))
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
                            {row.video_id || `REC-${String(idx + 1).padStart(3, '0')}`}
                          </span>
                        </td>

                        {/* Title & Hook */}
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', fontSize: '14px' }}>
                            {rTitle}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                            "{rHook}"
                          </div>
                        </td>

                        {/* Category & Angle */}
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ background: 'var(--recipe-accent-soft, var(--status-warning-soft))', color: 'var(--recipe-accent, var(--status-warning))', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>
                              {rCategory}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {rAngle}
                            </span>
                          </div>
                        </td>

                        {/* Product */}
                        <td style={{ padding: '12px' }}>
                          {Array.isArray(idea.featured_products) && idea.featured_products.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {idea.featured_products.map((fp, fIdx) => {
                                const isApp = fp.role?.includes('appliance') || fp.role?.includes('equipment') || /blender|mixer|oven|chopper/i.test(fp.name || fp.product_name || '');
                                return (
                                  <span
                                    key={fIdx}
                                    style={{
                                      background: isApp ? 'var(--status-success-soft)' : 'var(--status-info-soft)',
                                      color: isApp ? 'var(--status-success)' : 'var(--status-info)',
                                      border: `1px solid ${isApp ? 'var(--status-success)' : 'var(--status-info)'}`,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <span>{isApp ? '⚡' : '🍫'}</span>
                                    <span>{fp.product_name || fp.name}</span>
                                    <span style={{ fontSize: '9px', opacity: 0.8 }}>({isApp ? 'Alat' : 'Bahan'})</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ background: 'var(--status-info-soft)', color: 'var(--status-info)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                              🥛 {rProduct}
                            </span>
                          )}
                        </td>

                        {/* Time & Servings */}
                        <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <div>⏱️ {Number(rPrep) + Number(rCook)} mnt ({rPrep}p+{rCook}m)</div>
                          <div>👥 {rServings}</div>
                        </td>

                        {/* Visual Action */}
                        <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {row.visual_action || idea.hero_visual_shot || 'Tampilan hidangan menggugah selera.'}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setSelectedRowId(row.id)}
                              style={{
                                padding: '6px 10px',
                                background: isSelected ? 'var(--recipe-accent, #f59e0b)' : 'var(--surface-interactive)',
                                color: isSelected ? 'var(--on-action-primary)' : 'var(--text-primary)',
                                border: `1px solid ${isSelected ? 'var(--recipe-accent, #f59e0b)' : 'var(--border-subtle)'}`,
                                borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              {isSelected ? '📜 Dibuka ↓' : 'Buka Resep'}
                            </button>
                            <button
                              onClick={() => handleRegenerate(row, 'row')}
                              disabled={regenerating[`${row.id}_row`]}
                              style={{ background: 'var(--status-neutral-soft)', border: 'none', color: 'var(--status-neutral)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                              title="Regenerasi Ide Resep Ini"
                            >
                              {regenerating[`${row.id}_row`] ? '⏳' : '🔄'}
                            </button>
                            <button
                              onClick={() => handleDeleteRow(row.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--status-danger)', cursor: 'pointer', fontSize: '13px' }}
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
            ) : (
              /* Standard 9-Column Planner Table Layout */
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
            )}
          </div>
        )}

        {/* 4-Tab Recipe Production Drawer (Fase 1 Review, Resep Lengkap & Media Sosial) */}
        {isRecipeCampaign && selectedRow && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border-subtle)',
            borderRadius: '16px', padding: '24px', marginBottom: '40px',
            boxShadow: '0 8px 30px var(--overlay-subtle)'
          }}>
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    📜 Detail Naskah &amp; Produksi: {selectedRecipeIdea.recipe_title || selectedRow.title || 'Resep Kuliner'}
                  </h3>
                  <span style={{ background: 'var(--recipe-accent-soft, var(--status-warning-soft))', color: 'var(--recipe-accent, var(--status-warning))', border: '1px solid var(--recipe-accent, var(--status-warning))', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                    {selectedRecipeIdea.category?.toUpperCase() || recipeConfig.category?.toUpperCase() || 'KULINER'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Lineage: Baris #{rows.findIndex(r => r.id === selectedRow.id) + 1} ({selectedRow.video_id || 'REC-001'}) • Produk Terikat: <strong>{selectedRow.product_reference || selectedRow.product || 'Katalog'}</strong> • Target: <strong>{planner?.target_audience || 'Umum'}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={copySelectedRecipePlainText}
                  style={{ padding: '8px 14px', background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                >
                  📋 Salin Teks Resep (Plain Text)
                </button>
                <button
                  onClick={copyFormattedCaption}
                  style={{ padding: '8px 14px', background: 'var(--status-info-soft)', border: '1px solid var(--status-info)', color: 'var(--status-info)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                >
                  📱 Salin Caption Lengkap
                </button>
              </div>
            </div>

            {/* 4 Tabs Selector */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 1, label: '📜 Resep Lengkap (Canonical & Text)' },
                { id: 2, label: '🎬 Storyboard & VO' },
                { id: 3, label: '🖼️ Start Frames Review (4/4)' },
                { id: 4, label: '📱 Paket Sosial & Validasi Caption' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDrawerTab(tab.id)}
                  style={{
                    padding: '8px 16px',
                    background: drawerTab === tab.id ? 'var(--recipe-accent, #f59e0b)' : 'var(--surface-interactive)',
                    color: drawerTab === tab.id ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${drawerTab === tab.id ? 'var(--recipe-accent, #f59e0b)' : 'var(--border-subtle)'}`,
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Resep Lengkap */}
            {drawerTab === 1 && (
              <div>
                {/* Meta summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'var(--surface-raised)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Porsi</div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>{selectedRecipeIdea.servings || '1-2 Porsi'}</div>
                  </div>
                  <div style={{ background: 'var(--surface-raised)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Waktu Persiapan</div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>{selectedRecipeIdea.prep_time_minutes || 5} Menit</div>
                  </div>
                  <div style={{ background: 'var(--surface-raised)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Waktu Memasak</div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>{selectedRecipeIdea.cook_time_minutes || 10} Menit</div>
                  </div>
                  <div style={{ background: 'var(--surface-raised)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tingkat Kesulitan</div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--status-success)' }}>{selectedRecipeIdea.difficulty || 'Mudah'}</div>
                  </div>
                </div>

                {/* Ingredients */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    🛒 Bahan-Bahan &amp; Takaran Pas:
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                    {(Array.isArray(selectedRecipeIdea.ingredients) && selectedRecipeIdea.ingredients.length > 0 ? selectedRecipeIdea.ingredients : [
                      { name: 'Susu Oat Barista Blend', amount: '150', unit: 'ml', product_id: 'prod_1' },
                      { name: 'Bubuk Pure Matcha', amount: '1.5', unit: 'sdt' },
                      { name: 'Sirup Gula Aren', amount: '15', unit: 'ml' },
                      { name: 'Es Batu & Air Hangat', amount: '', unit: 'secukupnya' }
                    ]).map((ing, iIdx) => (
                      <div key={iIdx} style={{ background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          • {ing.name || 'Bahan'}
                        </span>
                        <span style={{ fontSize: '12px', color: ing.product_id ? 'var(--status-info)' : 'var(--text-secondary)', fontWeight: 700, background: ing.product_id ? 'var(--status-info-soft)' : 'var(--surface-interactive)', padding: '2px 8px', borderRadius: '4px' }}>
                          {ing.amount ? `${ing.amount} ` : ''}{ing.unit || ''}{ing.product_id ? ' (Produk Utama)' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Steps */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    🍳 Cara Membuat (Langkah Berurutan):
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(Array.isArray(selectedRecipeIdea.steps) && selectedRecipeIdea.steps.length > 0 ? selectedRecipeIdea.steps : [
                      { index: 1, instruction: 'Larutkan bubuk matcha dengan 50 ml air hangat menggunakan frother hingga berbusa halus.' },
                      { index: 2, instruction: 'Tuang sirup gula aren di dasar gelas saji, lalu tambahkan es batu secukupnya.' },
                      { index: 3, instruction: 'Tuang Susu Oat Barista secara perlahan hingga mengisi 3/4 bagian gelas.' },
                      { index: 4, instruction: 'Tuangkan larutan matcha di bagian paling atas untuk menciptakan layer cantik yang siap disajikan!' }
                    ]).map((st, sIdx) => (
                      <div key={sIdx} style={{ background: 'var(--surface-raised)', padding: '12px 14px', borderRadius: '8px', display: 'flex', gap: '12px', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ background: 'var(--recipe-accent, #f59e0b)', color: 'var(--on-action-primary)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>
                          {st.index || (sIdx + 1)}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          {st.instruction || st}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chef Tips */}
                {Array.isArray(selectedRecipeIdea.chef_tips) && selectedRecipeIdea.chef_tips.length > 0 && (
                  <div style={{ background: 'var(--status-warning-soft)', border: '1px solid var(--status-warning)', padding: '14px', borderRadius: '10px' }}>
                    <h5 style={{ margin: '0 0 6px', color: 'var(--status-warning)', fontSize: '13px', fontWeight: 800 }}>
                      💡 Tips Chef Agar Anti-Gagal:
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-primary)' }}>
                      {selectedRecipeIdea.chef_tips.map((tip, tIdx) => (
                        <li key={tIdx} style={{ marginBottom: '4px' }}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Storyboard & VO */}
            {drawerTab === 2 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {[
                  {
                    num: 1, title: 'Scene 1: Hook / Problem (3-4 Detik)',
                    visual: selectedRow.visual_action || 'Beauty close-up hidangan es batu & pour shot yang menggugah selera.',
                    vo: selectedRow.hook || selectedRecipeIdea.hook_3s || 'Stop beli mahal di kafe, ini resep rahasia 3 bahan yang wajib kamu coba!'
                  },
                  {
                    num: 2, title: 'Scene 2: Persiapan Bahan & Mixing',
                    visual: 'Aksi melarutkan bahan utama dengan foam mixer dan drizzle sirup di dinding gelas.',
                    vo: 'Campurkan bahan utama dengan air hangat sampai merata dan harum sempurna.'
                  },
                  {
                    num: 3, title: 'Scene 3: Eksekusi Produk & Layering',
                    visual: `Tuang produk ${selectedRow.product_reference || 'katalog'} secara perlahan membentuk layer estetik.`,
                    vo: `Tambahkan ${selectedRow.product_reference || 'bahan utama'} agar teksturnya super creamy dan rich.`
                  },
                  {
                    num: 4, title: 'Scene 4: Plating / Hero Taste Shot & CTA',
                    visual: 'Hero shot hasil akhir dengan sedotan, diangkat ke kamera dalam pencahayaan kafe alami.',
                    vo: 'Rasanya mewah banget persis di kafe! Cek link di bio untuk coba produknya ya!'
                  }
                ].map((sc, scIdx) => (
                  <div key={scIdx} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--recipe-accent, var(--status-warning))' }}>
                        🎬 {sc.title}
                      </span>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Visual Action / Shot:</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                        {sc.visual}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--status-info)', textTransform: 'uppercase', fontWeight: 700 }}>Voice-Over (VO):</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontStyle: 'italic', marginTop: '2px', lineHeight: 1.4, background: 'var(--surface)', padding: '8px', borderRadius: '6px' }}>
                        "{sc.vo}"
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Start Frames Review */}
            {drawerTab === 3 && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                  {[1, 2, 3, 4].map(clipIdx => (
                    <div key={clipIdx} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ height: '180px', background: 'var(--surface-interactive)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <span style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Start Frame Clip #{clipIdx}</span>
                        <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--status-success-soft)', color: 'var(--status-success)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          Siap Direview
                        </span>
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Scene #{clipIdx} Hero Visual</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Dipersiapkan via Imagen 3 / G-Labs</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--status-info-soft)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--status-info)' }}>
                  <div>
                    <h5 style={{ margin: '0 0 2px', color: 'var(--status-info)', fontSize: '13px', fontWeight: 800 }}>
                      Gate Persetujuan Fase 2 (Video & Audio Render)
                    </h5>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Setelah di-ingest ke OPC Studio, Start Frames akan digenerate otomatis sebelum masuk ke I2V &amp; TTS Pipeline.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast('Start frames checkpoint aktif di pipeline produksi OPC!')}
                    style={{ padding: '8px 16px', background: 'var(--action-primary)', color: 'var(--on-action-primary)', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                  >
                    🔍 Verifikasi Pipeline
                  </button>
                </div>
              </div>
            )}

            {/* Tab 4: Paket Sosial */}
            {drawerTab === 4 && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {/* Formatted Caption */}
                  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                        📱 Caption Media Sosial Terformat
                      </span>
                      <button onClick={copyFormattedCaption} style={{ background: 'none', border: 'none', color: 'var(--action-primary)', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>
                        Salin 📋
                      </button>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '12px', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto' }}>
{`${selectedRow.hook || selectedRecipeIdea.hook_3s || 'Resep viral yang wajib dicoba!'}

${getRecipePlainText(selectedRow)}

Yuk recook sekarang! Simpan postingan ini ya ✨
#ResepKuliner #ResepMudah #MasakDiRumah #KulinerIndonesia`}
                    </pre>
                  </div>

                  {/* Hashtags & CTA Metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Hashtags Optimal:</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['#ResepViral', '#KulinerKreatif', '#MasakSimpel', '#ResepKafe', '#HomeCafe'].map((tag, tIdx) => (
                          <span key={tIdx} style={{ background: 'var(--surface-interactive)', color: 'var(--recipe-accent, var(--status-warning))', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Call to Action (CTA):</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        "Save resep ini &amp; klik keranjang kuning / link di bio untuk produknya!"
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Product Lineage &amp; Binding:</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Produk Terkait: <strong>{selectedRow.product_reference || selectedRow.product || 'Katalog'}</strong> (ID: {selectedRecipeIdea.primary_product_id || 'prod_001'})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                  🔬 Research Evidence &amp; Sumber Terverifikasi
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
                    <h5 style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Query &amp; Ringkasan</h5>
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
