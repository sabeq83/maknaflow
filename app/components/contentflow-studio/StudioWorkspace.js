'use client';

import { useState, useEffect } from 'react';
import PlannerConfigurationForm from '../campaign-forms/PlannerConfigurationForm';
import ReCampaignConfigurationForm from '../campaign-forms/ReCampaignConfigurationForm';
import MultiplierConfigurationForm from '../campaign-forms/MultiplierConfigurationForm';
import RecipeLabsConfigurationForm from '../campaign-forms/RecipeLabsConfigurationForm';

import ImportPlannerModal from '../ImportPlannerModal';
import { buildOutputManifest, toZonedInput, zonedInputToIso } from '@/lib/contentflow-studio-manifest';

const DAYS_OF_WEEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function StudioWorkspace() {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'table'
  const [slots, setSlots] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    ready_for_review: 0,
    approved: 0,
    published: 0,
    failed: 0
  });

  // Filters
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Creation Wizard Modal State
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0); // 0 campaign, 1 optional Planner, 3 existing form, 4 outputs/schedule
  const [createdPlanner, setCreatedPlanner] = useState(null); // { id, title, rows: [] }
  const [selectedEngine, setSelectedEngine] = useState(null);
  const [outputManifest, setOutputManifest] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountIds, setAccountIds] = useState([]);
  const [submitKey, setSubmitKey] = useState('');
  const [productRefFile, setProductRefFile] = useState(null);
  const [createdBatchId, setCreatedBatchId] = useState(null);
  const [enginePayload, setEnginePayload] = useState(null);
  const [slotScheduleMap, setSlotScheduleMap] = useState({});
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [wizardError, setWizardError] = useState('');

  // Slot Detail Drawer / Modal State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [approvingSlot, setApprovingSlot] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [customCaption, setCustomCaption] = useState('');
  const [showEvidenceInput, setShowEvidenceInput] = useState(false);
  const [manualEvidenceUrl, setManualEvidenceUrl] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [currentDate, selectedBrandId, statusFilter]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  async function fetchInitialData() {
    try {
      setLoading(true);

      // Start & end date of the month in ISO format
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);

      const params = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        brand_id: selectedBrandId,
        status: statusFilter
      });

      const [resCal, resBrands] = await Promise.all([
        fetch(`/api/v2/contentflow-studio/calendar?${params.toString()}`).then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/brand-profiles').then(r => r.json()).catch(() => ({ profiles: [] }))
      ]);

      if (resCal.success) {
        setSlots(resCal.data || []);
        if (resCal.metrics) setMetrics(resCal.metrics);
      }
      if (resBrands?.profiles) {
        setBrandProfiles(resBrands.profiles);
      }
    } catch (e) {
      console.error('Failed to load studio calendar data:', e);
    } finally {
      setLoading(false);
    }
  }

  // Month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const currentMonthToday = () => setCurrentDate(new Date());

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Calendar matrix calculation
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Adjust so Monday = 0, Sunday = 6
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function startWizard() {
    setCreatedPlanner(null); setSelectedEngine(null); setEnginePayload(null);
    setOutputManifest([]); setSlotScheduleMap({}); setAccountIds([]); setProductRefFile(null);
    setSubmitKey(crypto.randomUUID()); setWizardError(''); setWizardStep(0); setShowWizard(true);
    fetch('/api/v2/publishing/accounts?provider=repliz').then(r=>r.json()).then(d=>setAccounts(d.data || d.accounts || [])).catch(()=>setAccounts([]));
  }
  const handlePlannerSuccess = async result => {
    setWizardSubmitting(true); setWizardError('');
    try {
      const id = result.planner_id || result.planner?.id;
      if (!id) throw Error('Planner tidak mengembalikan identitas.');
      const run = await fetch(`/api/content-planner/${id}/execute`, { method:'POST' }).then(r=>r.json());
      if (!run.success) throw Error(run.error);
      const d = await fetch(`/api/content-planner/${id}`).then(r=>r.json());
      if (!d.success) throw Error(d.error);
      setCreatedPlanner({ ...d.planner, rows:d.planner.rows || d.rows || [] }); setWizardStep(3);
    } catch(e) { setWizardError(e.message); } finally { setWizardSubmitting(false); }
  };
  const handleEngineCapture = captured => {
    try {
      const payload = captured.config || captured;
      const rows = createdPlanner?.rows || [];
      const chosen = captured.selected_row_ids ? rows.filter(r=>captured.selected_row_ids.map(String).includes(String(r.id))) : rows;
      const manifest = buildOutputManifest(selectedEngine, selectedEngine==='pillar' ? captured.global_settings : payload, chosen);
      setEnginePayload(captured.config || captured); setProductRefFile(captured.productRefImage || null);
      setOutputManifest(manifest);
      const base = Date.now() + 2*86400000;
      setSlotScheduleMap(Object.fromEntries(manifest.map((o,n)=>[o.outputKey,{
        scheduledPublishAt:toZonedInput(base+n*86400000), scheduledProductionAt:toZonedInput(base+(n-1)*86400000)
      }]))); setWizardStep(4);
    } catch(e) { setWizardError(e.message); if(selectedEngine==='pillar') throw e; }
  };
  const handleCommitBatch = async () => {
    setWizardSubmitting(true); setWizardError('');
    try {
      if (!accountIds.length) throw Error('Pilih minimal satu akun tujuan.');
      const sourceKind = selectedEngine==='pillar' ? (createdPlanner?.planner_focus==='recipe_campaign'?'planner_recipe':'planner_pillar') : ({re:'re_campaign',multiplier:'multiplier_lab',recipe:'recipe_labs'})[selectedEngine];
      const input = { schemaVersion:2,engineKind:selectedEngine,sourceKind,plannerId:selectedEngine==='pillar'?createdPlanner.id:null,
        enginePayload,title:enginePayload?.campaign_name || enginePayload?.global_settings?.campaign_name || 'Studio Batch',timezone:'Asia/Jakarta',idempotencyKey:submitKey,
        outputSchedules:outputManifest.map(o=>({ outputKey:o.outputKey,productionAt:zonedInputToIso(slotScheduleMap[o.outputKey].scheduledProductionAt),publishAt:zonedInputToIso(slotScheduleMap[o.outputKey].scheduledPublishAt),accountIds })) };
      let body=JSON.stringify(input),headers={'Content-Type':'application/json'};
      if(productRefFile){ body=new FormData();body.append('input',JSON.stringify(input));body.append('productRefImage',productRefFile);headers={}; }
      const d=await fetch('/api/v2/contentflow-studio/batches',{method:'POST',headers,body}).then(r=>r.json());
      if(!d.success)throw Error(d.error);
      setCreatedBatchId(d.data.id);setShowWizard(false);fetchInitialData();
    }catch(e){setWizardError(e.message);}finally{setWizardSubmitting(false);}
  };
  async function activateBatch(id) {
    const d=await fetch(`/api/v2/contentflow-studio/batches/${id}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'activate_slots'})}).then(r=>r.json());
    if(!d.success){setApprovalError(d.error);return;}
    setCreatedBatchId(null);setSelectedSlot(null);fetchInitialData();
  }

  async function openSlot(id) {
    const d=await fetch(`/api/v2/contentflow-studio/slots/${id}`).then(r=>r.json());
    if(d.success){setSelectedSlot(d.data);setCustomCaption(d.data.final_caption||'');setApprovalError('');}
  }
  // Approval Handler
  const handleApproveSlot = async (publishMode = 'schedule') => {
    if (!selectedSlot) return;
    setApprovingSlot(true);
    setApprovalError('');

    try {
      const res = await fetch(`/api/v2/contentflow-studio/slots/${selectedSlot.id}/approve-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approved',
          clientRevisionHash: selectedSlot.current_revision_hash,
          publishMode,
          customCaption: customCaption || undefined,
          manualEvidenceUrl: manualEvidenceUrl || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setSelectedSlot(null);
        fetchInitialData();
      } else {
        setApprovalError(data.error || 'Gagal menyetujui publikasi slot.');
      }
    } catch (err) {
      setApprovalError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setApprovingSlot(false);
    }
  };

  // Helper formatting
  const getEngineBadge = (sourceKind) => {
    switch (sourceKind) {
      case 'pillar':
      case 'planner_pillar':
      case 'planner_recipe':
        return <span style={{color:'var(--action-primary)'}}>Pillar</span>;
      case 're_campaign':
      case 're':
        return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--status-info-soft)', color: 'var(--status-info)', fontSize: '0.72rem', fontWeight: 600 }}>RE</span>;
      case 'multiplier_lab':
      case 'multiplier':
        return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--status-warning-soft)', color: 'var(--status-warning)', fontSize: '0.72rem', fontWeight: 600 }}>MUL</span>;
      case 'recipe_labs':
      case 'recipe':
        return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--status-success-soft)', color: 'var(--status-success)', fontSize: '0.72rem', fontWeight: 600 }}>REC</span>;
      default:
        return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-interactive)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>STD</span>;
    }
  };

  const getStatusBadge = (stageStatus, pubStatus) => {
    if (pubStatus === 'published') {
      return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--status-success-soft)', color: 'var(--status-success)', fontSize: '0.72rem' }}>✅ Terbit</span>;
    }
    if (pubStatus === 'scheduled') {
      return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--status-info-soft)', color: 'var(--status-info)', fontSize: '0.72rem' }}>⏰ Terjadwal</span>;
    }
    if (pubStatus === 'approved') {
      return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--status-info-soft)', color: 'var(--status-info)', fontSize: '0.72rem' }}>👍 Disetujui</span>;
    }
    if (['completed','ready'].includes(stageStatus)) {
      return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--status-warning-soft)', color: 'var(--status-warning)', fontSize: '0.72rem' }}>👀 Perlu Review</span>;
    }
    if (stageStatus === 'in_progress') {
      return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-interactive)', color: 'var(--text-primary)', fontSize: '0.72rem' }}>⚙️ Diproduksi</span>;
    }
    if (stageStatus === 'failed') {
      return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--status-danger-soft)', color: 'var(--status-danger)', fontSize: '0.72rem' }}>❌ Gagal</span>;
    }
    return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>⏳ Antrean</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        background: 'var(--surface-raised)',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid var(--border)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>✨</span>
            <h1 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              ContentFlow Studio
            </h1>
            <span style={{
              background: 'var(--status-info-soft)',
              color: 'var(--status-info)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              Orkestrasi Terpadu
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Perencanaan ide konten satu sesi, produksi sekuensial multi-engine, dan approval publikasi terjadwal.
          </p>
        </div>

        <button
          type="button"
          onClick={startWizard}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--action-primary)',
            color: 'var(--on-action-primary)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <span>⚡ Buat Batch Konten Baru</span>
        </button>
      </div>

      {/* Quick Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px'
      }}>
        {[
          { label: 'Total Slot Konten', value: metrics.total, color: 'var(--text-primary)' },
          { label: 'Menunggu Review', value: metrics.ready_for_review, color: 'var(--status-warning)' },
          { label: 'Dalam Produksi', value: metrics.in_progress, color: 'var(--text-secondary)' },
          { label: 'Disetujui / Terjadwal', value: metrics.approved, color: 'var(--status-info)' },
          { label: 'Berhasil Terbit', value: metrics.published, color: 'var(--status-success)' }
        ].map((m, i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{m.label}</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: m.color }}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* View Switcher & Filter Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Navigation month */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={prevMonth}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            ◀ Sebelumnya
          </button>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '150px', textAlign: 'center' }}>
            {monthNames[month]} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Selanjutnya ▶
          </button>
          <button
            type="button"
            onClick={currentMonthToday}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface-interactive)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.78rem'
            }}
          >
            Hari Ini
          </button>
        </div>

        {/* View Mode & Brand Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedBrandId}
            onChange={e => setSelectedBrandId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem'
            }}
          >
            <option value="all">Semua Brand Profile</option>
            {brandProfiles.map(b => (
              <option key={b.id} value={b.id}>{b.name || b.brand_name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: viewMode === 'calendar' ? 'var(--action-primary)' : 'var(--surface)',
                color: viewMode === 'calendar' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              📅 Kalender
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: viewMode === 'table' ? 'var(--action-primary)' : 'var(--surface)',
                color: viewMode === 'table' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              📋 Tabel
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area: Calendar or Table */}
      {viewMode === 'calendar' ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          {/* Calendar Day Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            background: 'var(--surface-subtle)',
            borderBottom: '1px solid var(--border)'
          }}>
            {DAYS_OF_WEEK.map(d => (
              <div key={d} style={{ padding: '10px', textAlign: 'center', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: 'minmax(120px, auto)'
          }}>
            {/* Blank offset days before first day of month */}
            {Array.from({ length: adjustedFirstDay }).map((_, i) => (
              <div key={`empty-${i}`} style={{ background: 'var(--surface-subtle)', opacity: 0.5, borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

              // Slots belonging to this day (by scheduled_publish_at)
              const daySlots = slots.filter(s => {
                if (!s.scheduled_publish_at) return false;
                return s.scheduled_publish_at.startsWith(dateStr);
              });

              const isToday = new Date().toISOString().slice(0, 10) === dateStr;

              return (
                <div
                  key={dayNum}
                  style={{
                    borderRight: '1px solid var(--border-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: isToday ? 'var(--surface-interactive)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontWeight: isToday ? 700 : 500,
                      fontSize: '0.85rem',
                      color: isToday ? 'var(--action-primary)' : 'var(--text-primary)'
                    }}>
                      {dayNum}
                    </span>
                    {daySlots.length > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {daySlots.length} konten
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '110px' }}>
                    {daySlots.map(slot => (
                      <div
                        key={slot.id}
                        onClick={() => openSlot(slot.id)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          boxShadow: 'var(--shadow-card)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {getEngineBadge(slot.source_kind)}
                          {getStatusBadge(slot.stage_status, slot.publishing_status)}
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          #{slot.slot_number} {slot.batch_title || 'Konten'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Table View */
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px' }}>#</th>
                <th style={{ padding: '10px 14px' }}>Judul Batch / Topik</th>
                <th style={{ padding: '10px 14px' }}>Engine</th>
                <th style={{ padding: '10px 14px' }}>Jadwal Produksi</th>
                <th style={{ padding: '10px 14px' }}>Jadwal Tayang</th>
                <th style={{ padding: '10px 14px' }}>Status Produksi</th>
                <th style={{ padding: '10px 14px' }}>Status Publikasi</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {slots.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada slot konten untuk bulan ini. Klik "Buat Batch Konten Baru" untuk memulai.
                  </td>
                </tr>
              ) : (
                slots.map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 14px' }}>{s.slot_number || idx + 1}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.batch_title}</td>
                    <td style={{ padding: '10px 14px' }}>{getEngineBadge(s.source_kind)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {s.scheduled_production_at ? new Date(s.scheduled_production_at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {s.scheduled_publish_at ? new Date(s.scheduled_publish_at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{getStatusBadge(s.stage_status, null)}</td>
                    <td style={{ padding: '10px 14px' }}>{getStatusBadge(null, s.publishing_status)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => openSlot(s.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface-interactive)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.78rem'
                        }}
                      >
                        Tinjau
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {createdBatchId && <div style={{padding:14,background:'var(--status-info-soft)',color:'var(--text-primary)'}}>Draft tersimpan. Produksi belum dimulai. <button type="button" onClick={()=>activateBatch(createdBatchId)}>▶ Generate Content</button></div>}
      {showWizard && wizardStep===3 && selectedEngine==='pillar' && createdPlanner && <ImportPlannerModal isOpen initialPlannerId={createdPlanner.id} onClose={()=>setWizardStep(1)} onConfigurationSubmit={handleEngineCapture} />}
      {/* Creation Wizard Modal */}
      {showWizard && !(wizardStep===3 && selectedEngine==='pillar') && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--overlay-backdrop)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: 'var(--shadow-modal)'
          }}>
            {/* Wizard Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  ⚡ Wizard Kreasi Batch Studio
                </h2>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {['Pilih Campaign', ...(selectedEngine==='pillar'?['Planner Sekali Pakai']:[]), 'Konfigurasi Existing', 'Jadwal Output'].map((st, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: wizardStep === (i + 1) ? 700 : 500,
                        color: wizardStep === (i + 1) ? 'var(--action-primary)' : 'var(--text-muted)'
                      }}
                    >
                      {st} {i < 3 ? '→' : ''}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWizard(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {wizardError && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--status-danger-soft)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                ⚠️ {wizardError}
              </div>
            )}

            {wizardStep===0 && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
              {[['pillar','Pillar Campaign','Planner baru → produksi Pillar'],['re','Reverse Engineering','Referensi video → produksi RE'],['multiplier','Multiplier','Blueprint dan kombinasi → produksi'],['recipe','Recipe Labs','Konfigurasi resep gambar/video existing']].map(([kind,label,desc])=><button key={kind} type="button" onClick={()=>{setCreatedPlanner(null);setEnginePayload(null);setOutputManifest([]);setSlotScheduleMap({});setProductRefFile(null);setSelectedEngine(kind);setWizardError('');setWizardStep(kind==='pillar'?1:3);}} style={{padding:20,border:'1px solid var(--border-subtle)',borderRadius:10,background:'var(--surface-raised)',color:'var(--text-primary)',textAlign:'left',cursor:'pointer'}}><strong>{label}</strong><p style={{color:'var(--text-muted)'}}>{desc}</p></button>)}
            </div>}
            {wizardStep===1 && <div>
              <p>Planner hanya digunakan sekali untuk batch ini. Focus Recipe pada Generator Planner mengikuti jalur produksi Recipe/Pillar existing.</p>
              {wizardSubmitting ? <p>Generator Planner sedang bekerja…</p> : <PlannerConfigurationForm mode="direct" onSuccess={handlePlannerSuccess} onCancel={()=>setWizardStep(0)} />}
            </div>}
            {wizardStep===3 && selectedEngine==='pillar' && <div><p>Review hasil Planner dan konfigurasi produksi pada form Pillar existing.</p><button type="button" onClick={()=>setWizardStep(0)}>Ganti jenis campaign</button></div>}
            {wizardStep===3 && selectedEngine==='re' && <ReCampaignConfigurationForm mode="capture" onCapture={handleEngineCapture} onCancel={()=>setWizardStep(0)} />}
            {wizardStep===3 && selectedEngine==='multiplier' && <MultiplierConfigurationForm mode="capture" onCapture={handleEngineCapture} onCancel={()=>setWizardStep(0)} />}
            {wizardStep===3 && selectedEngine==='recipe' && <RecipeLabsConfigurationForm mode="capture" onCapture={handleEngineCapture} onCancel={()=>setWizardStep(0)} />}
            {/* Step 4: Schedule Allocation per Slot */}
            {wizardStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    Alokasikan Jadwal Tayang per Baris Konten ({outputManifest.length} slot)
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Tentukan waktu publikasi untuk masing-masing slot. Sistem otomatis mengatur waktu produksi lebih awal.
                  </p>
                </div>

                <div style={{
                  maxHeight: '320px',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {outputManifest.map((row, idx) => {
                    const rowSched = slotScheduleMap[row.outputKey] || {};
                    return (
                      <div
                        key={row.outputKey}
                        style={{
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--surface-raised)',
                          display: 'grid',
                          gridTemplateColumns: '30px 1fr 220px',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.85rem' }}>#{idx + 1}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {row.title || `Slot Konten #${idx + 1}`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {row.mediaType === 'image' ? 'Gambar' : 'Video'}
                          </div>
                        </div>
                        <div>
                          <label style={{fontSize:12,color:'var(--text-secondary)'}}>Mulai produksi (WIB)<input type="datetime-local" value={rowSched.scheduledProductionAt || ''} onChange={e=>setSlotScheduleMap(prev=>({...prev,[row.outputKey]:{...prev[row.outputKey],scheduledProductionAt:e.target.value}}))} style={{width:'100%',background:'var(--input-bg)',color:'var(--text-primary)',border:'1px solid var(--border-subtle)',padding:6}} /></label>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                            Waktu Tayang (WIB)
                          </label>
                          <input
                            type="datetime-local"
                            value={rowSched.scheduledPublishAt || ''}
                            onChange={(e) => {
                              const pubTime = e.target.value;
                              const prodTime = pubTime ? toZonedInput(new Date(zonedInputToIso(pubTime)).getTime() - 86400000) : '';
                              setSlotScheduleMap({
                                ...slotScheduleMap,
                                [row.outputKey]: {
                                  scheduledPublishAt: pubTime,
                                  scheduledProductionAt: prodTime
                                }
                              });
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              width: '100%'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div><h4>Akun tujuan Repliz</h4>{accounts.length ? accounts.filter(a=>a.provider==='repliz').map(a=><label key={a.id} style={{display:'block'}}><input type="checkbox" checked={accountIds.includes(a.id)} onChange={e=>setAccountIds(prev=>e.target.checked?[...prev,a.id]:prev.filter(id=>id!==a.id))} /> {a.display_name || a.id} · {a.platform}</label>):<p>Akun belum tersedia. Hubungkan akun melalui Publishing Scheduler.</p>}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitBatch}
                    disabled={wizardSubmitting}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--action-primary)',
                      color: 'var(--on-action-primary)',
                      fontWeight: 600,
                      cursor: wizardSubmitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {wizardSubmitting ? 'Mendaftarkan Batch Studio...' : 'Simpan Draft & Kunci Planner bila digunakan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slot Review & Approval Drawer / Modal */}
      {selectedSlot && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--overlay-backdrop)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: 'var(--shadow-modal)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Slot #{selectedSlot.slot_number} Review
                  </span>
                  {getEngineBadge(selectedSlot.source_kind)}
                  {selectedSlot.error_message && <p style={{color:'var(--status-warning)'}}>{selectedSlot.error_message}</p>}
                  {selectedSlot.stage_status==='draft' && <button type="button" onClick={()=>activateBatch(selectedSlot.batch_id)}>▶ Generate Batch</button>}
                  {selectedSlot.stage_status==='needs_review' && selectedSlot.source_campaign_id && <a href={selectedSlot.batch_engine_kind==='recipe'?'/recipe-labs':`/${({pillar:'pillar-campaigns',re:'re-campaigns',multiplier:'multiplier-lab'})[selectedSlot.batch_engine_kind] || 'pillar-campaigns'}/${selectedSlot.source_campaign_id}`} target="_blank" rel="noreferrer">Review Campaign Sumber</a>}
                  {getStatusBadge(selectedSlot.stage_status, selectedSlot.publishing_status)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {selectedSlot.batch_title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {approvalError && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--status-danger-soft)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                ⚠️ {approvalError}
              </div>
            )}

            {/* Media Preview */}
            <div style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Media Output Kreatif
              </span>
              {(selectedSlot.output_media_type==='video' ? selectedSlot.final_media_url : null) ? (
                <video
                  controls
                  src={selectedSlot.final_media_url}
                  style={{ width: '100%', maxHeight: '300px', borderRadius: '6px', background: 'var(--surface-raised)' }}
                />
              ) : (selectedSlot.output_media_type==='image' ? selectedSlot.final_media_url : null) ? (
                <img
                  src={selectedSlot.final_media_url}
                  alt="Output"
                  style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '6px' }}
                />
              ) : (
                <div style={{
                  padding: '30px',
                  textAlign: 'center',
                  background: 'var(--surface-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}>
                  {selectedSlot.stage_status === 'in_progress'
                    ? '⚙️ Media sedang diproduksi oleh worker engine...'
                    : '⏳ Media belum selesai diproduksi. Menunggu jadwal produksi slot.'}
                </div>
              )}
            </div>

            {/* Hook & Caption */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Caption / Teks Publikasi
              </label>
              <textarea
                rows={3}
                value={customCaption || (selectedSlot.final_caption || selectedSlot.creative_snapshot_json?.caption || selectedSlot.creative_snapshot_json?.hook_text || '')}
                onChange={e => setCustomCaption(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const textToCopy = customCaption || (selectedSlot.final_caption || selectedSlot.creative_snapshot_json?.caption || selectedSlot.creative_snapshot_json?.hook_text || '');
                    if (textToCopy) {
                      navigator.clipboard.writeText(textToCopy);
                      alert('Caption berhasil disalin ke clipboard!');
                    }
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-interactive)',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  📋 Salin Teks / Caption
                </button>
                {((selectedSlot.output_media_type==='video' ? selectedSlot.final_media_url : null) || (selectedSlot.output_media_type==='image' ? selectedSlot.final_media_url : null)) && (
                  <a
                    href={(selectedSlot.output_media_type==='video' ? selectedSlot.final_media_url : null) || (selectedSlot.output_media_type==='image' ? selectedSlot.final_media_url : null)}
                    download
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-interactive)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    💾 Unduh File Media
                  </a>
                )}
              </div>
            </div>

            {/* Manual Evidence Toggle */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowEvidenceInput(!showEvidenceInput)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--action-primary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: 0
                }}
              >
                {showEvidenceInput ? '▲ Tutup Upload Manual' : '▼ Unggah Bukti Tayang Manual (Jika publish di luar sistem)'}
              </button>

              {showEvidenceInput && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    type="text"
                    value={manualEvidenceUrl}
                    onChange={e => setManualEvidenceUrl(e.target.value)}
                    placeholder="URL Postingan / Bukti Tayang (Instagram / TikTok / YouTube)"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleApproveSlot('manual_evidence')}
                    disabled={!manualEvidenceUrl.trim() || approvingSlot}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--status-success)',
                      color: '#fff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Simpan Bukti Tayang Manual
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => handleApproveSlot('now')}
                disabled={approvingSlot}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-interactive)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🚀 Publikasikan Sekarang
              </button>
              <button
                type="button"
                onClick={() => handleApproveSlot('schedule')}
                disabled={approvingSlot}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  fontWeight: 600,
                  cursor: approvingSlot ? 'not-allowed' : 'pointer'
                }}
              >
                {approvingSlot ? 'Memproses...' : '👍 Setujui & Jadwalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
