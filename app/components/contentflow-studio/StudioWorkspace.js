'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import PlannerConfigurationForm from '../campaign-forms/PlannerConfigurationForm';

import StudioCampaignWizard from './StudioCampaignWizard';
import { updateStudioOutputSchedule } from '@/lib/contentflow-studio-wizard-steps';
import { buildOutputManifest, toZonedInput, zonedInputToIso, createStudioIdempotencyKey } from '@/lib/contentflow-studio-manifest';

const DAYS_OF_WEEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function StudioWorkspace() {
  const wizardSessionRef = useRef(0);
  const renderedWizardSession = wizardSessionRef.current;
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

  // Repliz Account Selector Enhancements
  const [replizSearchQuery, setReplizSearchQuery] = useState('');
  const [isSyncingRepliz, setIsSyncingRepliz] = useState(false);

  // Slot Detail Drawer / Modal State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotModalTab, setSlotModalTab] = useState('details'); // 'details' | 'log'
  const [approvingSlot, setApprovingSlot] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [customCaption, setCustomCaption] = useState('');
  const [showEvidenceInput, setShowEvidenceInput] = useState(false);
  const [manualEvidenceUrl, setManualEvidenceUrl] = useState('');

  // Mitigation States
  const [mitigationLoading, setMitigationLoading] = useState(false);
  const [mitigationSuccess, setMitigationSuccess] = useState('');
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [reschedulePublishAt, setReschedulePublishAt] = useState('');
  const [rescheduleAccountIds, setRescheduleAccountIds] = useState([]);

  // Derived: Draft batches needing activation
  const draftBatches = useMemo(() => {
    const map = new Map();
    (slots || []).forEach(s => {
      if (s.stage_status === 'draft' || s.activation_status === 'manual') {
        if (s.batch_id && !map.has(s.batch_id)) {
          map.set(s.batch_id, { id: s.batch_id, title: s.batch_title || s.batch_id });
        }
      }
    });
    return Array.from(map.values());
  }, [slots]);

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
        fetch('/api/brand-profiles').then(r => r.json()).catch(() => ({ brands: [] }))
      ]);

      if (resCal.success) {
        setSlots(resCal.data || []);
        if (resCal.metrics) setMetrics(resCal.metrics);
      }
      const loadedBrands = resBrands?.brands || resBrands?.profiles || [];
      if (Array.isArray(loadedBrands)) {
        setBrandProfiles(loadedBrands);
      }
    } catch (e) {
      console.error('Failed to load studio calendar data:', e);
    } finally {
      setLoading(false);
    }
  }

  // Reload Repliz Accounts from API with sync parameter
  const reloadReplizAccounts = async () => {
    setIsSyncingRepliz(true);
    try {
      const res = await fetch('/api/v2/publishing/accounts?sync=1&provider=repliz').then(r => r.json());
      if (res.success && (res.data || res.accounts)) {
        setAccounts(res.data || res.accounts || []);
      }
    } catch (err) {
      console.warn('Failed to sync Repliz accounts:', err);
    } finally {
      setIsSyncingRepliz(false);
    }
  };

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
    wizardSessionRef.current += 1;
    setCreatedPlanner(null); setSelectedEngine(null); setEnginePayload(null);
    setOutputManifest([]); setSlotScheduleMap({}); setAccountIds([]); setProductRefFile(null);
    setSubmitKey(createStudioIdempotencyKey()); setWizardError(''); setWizardStep(0); setShowWizard(true);
    setReplizSearchQuery('');
    fetch('/api/v2/publishing/accounts?provider=repliz').then(r=>r.json()).then(d=>setAccounts(d.data || d.accounts || [])).catch(()=>setAccounts([]));
  }

  const handlePlannerSuccess = async (result, session) => {
    if (session !== wizardSessionRef.current) return;
    setWizardSubmitting(true); setWizardError('');
    try {
      const id = result.planner_id || result.planner?.id;
      if (!id) throw Error('Planner tidak mengembalikan identitas.');
      const run = await fetch(`/api/content-planner/${id}/execute`, { method:'POST' }).then(r=>r.json());
      if (!run.success) throw Error(run.error || 'Gagal mengeksekusi planner.');
      const d = await fetch(`/api/content-planner/${id}`).then(r=>r.json());
      if (session !== wizardSessionRef.current) return;
      if (!d.success) throw Error(d.error || 'Gagal memuat detail planner.');
      const p = d.planner || d.data || d;
      const rows = p.rows || d.rows || [];
      if (!rows.length) throw Error('Planner belum memiliki baris konten yang digenerate. Pastikan proses AI generator selesai terlebih dahulu.');
      setCreatedPlanner({ ...p, rows });
      setWizardStep(2);
    } catch(e) { if (session === wizardSessionRef.current) setWizardError(e.message); } finally { if (session === wizardSessionRef.current) setWizardSubmitting(false); }
  };
  const handleEngineCapture = captured => {
    try {
      const payload = captured.config || captured;
      if (selectedEngine==='pillar') payload.global_settings={...payload.global_settings,campaign_name:payload.campaign_name};
      const rows = createdPlanner?.rows || [];
      const chosen = captured.selected_row_ids ? rows.filter(r=>captured.selected_row_ids.map(String).includes(String(r.id))) : rows;
      const manifest = buildOutputManifest(selectedEngine, selectedEngine==='pillar' ? captured.global_settings : payload, chosen, {stableKeys:true});
      setEnginePayload(payload); setProductRefFile(captured.productRefImage || null);
      setOutputManifest(manifest);
      const base = Date.now() + 2*86400000;
      const groupTimes = new Map();
      setSlotScheduleMap(Object.fromEntries(manifest.map((o,n)=>[o.outputKey,{
        scheduledPublishAt:slotScheduleMap[o.outputKey]?.scheduledPublishAt || toZonedInput(base+n*86400000), scheduledProductionAt:(()=>{const group=o.snapshot?.invocationKey||o.outputKey;if(!groupTimes.has(group))groupTimes.set(group,slotScheduleMap[o.outputKey]?.scheduledProductionAt||toZonedInput(base+(n-1)*86400000));return groupTimes.get(group);})()
      }]))); setWizardStep(4);
    } catch(e) { setWizardError(e.message); if(selectedEngine==='pillar') throw e; }
  };
  const handleCommitBatch = async () => {
    setWizardSubmitting(true); setWizardError('');
    try {
      if (!accountIds.length) throw Error('Pilih minimal satu akun tujuan.');
      const sourceKind = selectedEngine==='pillar' ? (createdPlanner?.planner_focus==='recipe_campaign'?'planner_recipe':'planner_pillar') : ({re:'re_campaign',multiplier:'multiplier_lab',recipe:'recipe_labs'})[selectedEngine];
      const input = { schemaVersion:3,engineKind:selectedEngine,sourceKind,plannerId:selectedEngine==='pillar'?createdPlanner.id:null,
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

  async function openSlot(id, defaultTab = 'details') {
    setSlotModalTab(defaultTab);
    setMitigationSuccess('');
    setApprovalError('');
    setShowRescheduleForm(false);
    try {
      const d = await fetch(`/api/v2/contentflow-studio/slots/${id}`).then(r => r.json());
      if (d.success) {
        setSelectedSlot(d.data);
        setCustomCaption(d.data.final_caption || '');
        setReschedulePublishAt(d.data.scheduled_publish_at ? toZonedInput(new Date(d.data.scheduled_publish_at).getTime()) : '');
        setRescheduleAccountIds(d.data.targets?.map(t => t.account_id) || []);
        if (accounts.length === 0) {
          fetch('/api/v2/publishing/accounts?provider=repliz').then(r => r.json()).then(res => setAccounts(res.data || res.accounts || [])).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to open slot:', err);
    }
  }

  // Fast Action: Dispatch Slot Now (Immediate Queue)
  const handleDispatchNow = async (slotId) => {
    const targetId = slotId || selectedSlot?.id;
    if (!targetId) return;
    setMitigationLoading(true);
    setMitigationSuccess('');
    setApprovalError('');
    try {
      const res = await fetch(`/api/v2/contentflow-studio/slots/${targetId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispatch_now' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal memulai eksekusi slot.');
      setMitigationSuccess('⚡ Eksekusi slot dimulai! Worker segera memproses antrean.');
      if (selectedSlot && selectedSlot.id === targetId) {
        const refreshSlot = await fetch(`/api/v2/contentflow-studio/slots/${targetId}`).then(r => r.json());
        if (refreshSlot.success) setSelectedSlot(refreshSlot.data);
      }
      fetchInitialData();
    } catch (err) {
      setApprovalError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setMitigationLoading(false);
    }
  };

  // Fast Action: Quick Retry from Table Row
  const handleQuickRetry = async (slotId) => {
    if (!slotId) return;
    try {
      const res = await fetch(`/api/v2/contentflow-studio/slots/${slotId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_production' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal mengulang produksi.');
      fetchInitialData();
    } catch (err) {
      alert(err.message || 'Gagal mengulang produksi.');
    }
  };

  // Mitigation 1: Retry AI Production (Option 1)
  const handleRetryProduction = async () => {
    if (!selectedSlot) return;
    setMitigationLoading(true);
    setMitigationSuccess('');
    setApprovalError('');
    try {
      const res = await fetch(`/api/v2/contentflow-studio/slots/${selectedSlot.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_production' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal mengulang produksi AI.');
      setMitigationSuccess('✅ Berhasil me-reset status & mengantrekan ulang produksi AI ke background worker.');
      const refreshSlot = await fetch(`/api/v2/contentflow-studio/slots/${selectedSlot.id}`).then(r => r.json());
      if (refreshSlot.success) setSelectedSlot(refreshSlot.data);
      fetchInitialData();
    } catch (err) {
      setApprovalError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setMitigationLoading(false);
    }
  };

  // Mitigation 2: Reschedule & Re-target (Option 2)
  const handleRescheduleMitigation = async () => {
    if (!selectedSlot) return;
    setMitigationLoading(true);
    setMitigationSuccess('');
    setApprovalError('');
    try {
      const payload = {
        action: 'reschedule',
        scheduled_publish_at: reschedulePublishAt ? zonedInputToIso(reschedulePublishAt) : undefined,
        target_account_ids: rescheduleAccountIds
      };
      const res = await fetch(`/api/v2/contentflow-studio/slots/${selectedSlot.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal menjadwalkan ulang.');
      setMitigationSuccess('✅ Jadwal tayang dan akun target berhasil diperbarui.');
      setShowRescheduleForm(false);
      const refreshSlot = await fetch(`/api/v2/contentflow-studio/slots/${selectedSlot.id}`).then(r => r.json());
      if (refreshSlot.success) setSelectedSlot(refreshSlot.data);
      fetchInitialData();
    } catch (err) {
      setApprovalError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setMitigationLoading(false);
    }
  };
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

  // Reactively filter slots based on selected brand profile
  const displayedSlots = useMemo(() => {
    if (!selectedBrandId || selectedBrandId === 'all') return slots;
    return slots.filter(s => {
      let snap = s.batch_config || {};
      if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch {} }
      let slotSnap = s.output_snapshot_json || {};
      if (typeof slotSnap === 'string') { try { slotSnap = JSON.parse(slotSnap); } catch {} }
      const bId = snap.brand_profile_id || snap.selectedBrandId || snap.brandId || snap.brand_id || snap.global_settings?.brand_profile_id || snap.global_settings?.brandId || slotSnap.brand_profile_id || slotSnap.brandId || slotSnap.row?.brand_profile_id || slotSnap.row?.brand_id;
      return String(bId) === String(selectedBrandId);
    });
  }, [slots, selectedBrandId]);

  const computedMetrics = useMemo(() => {
    return {
      total: displayedSlots.length,
      ready_for_review: displayedSlots.filter(s => ['ready', 'needs_review'].includes(s.stage_status) && s.publishing_status === 'not_approved').length,
      in_progress: displayedSlots.filter(s => s.stage_status === 'in_progress').length,
      approved: displayedSlots.filter(s => s.publishing_status === 'approved' || s.publishing_status === 'scheduled').length,
      published: displayedSlots.filter(s => s.publishing_status === 'published').length
    };
  }, [displayedSlots]);

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
        border: '1px solid var(--border-subtle)'
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
          { label: 'Total Slot Konten', value: computedMetrics.total, color: 'var(--text-primary)' },
          { label: 'Menunggu Review', value: computedMetrics.ready_for_review, color: 'var(--status-warning)' },
          { label: 'Dalam Produksi', value: computedMetrics.in_progress, color: 'var(--text-secondary)' },
          { label: 'Disetujui / Terjadwal', value: computedMetrics.approved, color: 'var(--status-info)' },
          { label: 'Berhasil Terbit', value: computedMetrics.published, color: 'var(--status-success)' }
        ].map((m, i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
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
              border: '1px solid var(--border-subtle)',
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
              border: '1px solid var(--border-subtle)',
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
              border: '1px solid var(--border-subtle)',
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
              border: '1px solid var(--border-subtle)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem'
            }}
          >
            <option value="all">Semua Brand Profile ({brandProfiles.length})</option>
            {brandProfiles.map(b => (
              <option key={b.id} value={b.id}>{b.brand_name || b.name || b.id}</option>
            ))}
          </select>

          <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: '6px', overflow: 'hidden' }}>
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
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          {/* Calendar Day Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            background: 'var(--surface-subtle)',
            borderBottom: '1px solid var(--border-subtle)'
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

              // Slots belonging to this day (by scheduled_publish_at) from displayedSlots
              const daySlots = displayedSlots.filter(s => {
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
                        onClick={() => openSlot(slot.id, 'details')}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border-subtle)',
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
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
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
              {displayedSlots.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Belum ada slot konten untuk filter bulan / brand ini. Klik "Buat Batch Konten Baru" untuk memulai.
                  </td>
                </tr>
              ) : (
                displayedSlots.map((s, idx) => (
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
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {s.stage_status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleDispatchNow(s.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'var(--action-primary)',
                            color: 'var(--on-action-primary)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            marginRight: '6px'
                          }}
                          title="Mulai eksekusi antrean worker sekarang"
                        >
                          ⚡ Eksekusi
                        </button>
                      )}
                      {s.stage_status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => handleQuickRetry(s.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--status-danger)',
                            background: 'var(--status-danger-soft)',
                            color: 'var(--status-danger)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            marginRight: '6px'
                          }}
                          title="Ulangi produksi AI"
                        >
                          🔄 Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openSlot(s.id, 'log')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--surface)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          marginRight: '6px'
                        }}
                      >
                        📜 Log
                      </button>
                      <button
                        type="button"
                        onClick={() => openSlot(s.id, 'details')}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
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

      {/* Draft Batches Banner */}
      {draftBatches.length > 0 && (
        <div style={{
          padding: '12px 18px',
          background: 'var(--status-info-soft)',
          color: 'var(--text-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
            <span>📦</span>
            <span>
              Terdapat <strong>{draftBatches.length} Batch</strong> berstatus <strong>Draft</strong> (jadwal belum diaktifkan).
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {draftBatches.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => activateBatch(b.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.8rem'
                }}
              >
                ▶ Aktifkan {b.title ? (b.title.length > 20 ? b.title.slice(0, 20) + '...' : b.title) : b.id}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Creation Wizard Modal */}
      {showWizard && (
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
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '1200px',
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
                  {[['Pilih Campaign',0], ...(selectedEngine==='pillar'?[['Planner',1],['Review Planner',2]]:[]), ['Konfigurasi Campaign',3], ['Jadwal Output',4], ['Review Batch',5]].map(([st,stepId], i, all) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: wizardStep === stepId ? 700 : 500,
                        color: wizardStep === stepId ? 'var(--action-primary)' : 'var(--text-muted)'
                      }}
                    >
                      {st} {i < all.length-1 ? '→' : ''}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={wizardSubmitting}
                onClick={() => {wizardSessionRef.current += 1;setShowWizard(false);}}
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
            {selectedEngine==='pillar' && <div hidden={wizardStep!==1}>
              <p>Planner hanya digunakan sekali untuk batch ini. Pilih fokus dan konfigurasi sesuai Generator Content Planner.</p>
              {wizardSubmitting && <p role="status">Generator Planner sedang bekerja…</p>}
              <PlannerConfigurationForm mode="direct" onSuccess={result=>handlePlannerSuccess(result,renderedWizardSession)} onCancel={()=>setWizardStep(0)} />
            </div>}
            {wizardStep===2 && createdPlanner && <div>
              <h3>Review Content Planner</h3><p>{createdPlanner.rows.length} baris siap untuk dikonfigurasi menjadi Pillar Campaign. Planner belum dikonsumsi.</p>
              <div style={{maxHeight:350,overflow:'auto'}}><table className="table"><thead><tr><th>No</th><th>Rencana Konten</th></tr></thead><tbody>{createdPlanner.rows.map((row,index)=><tr key={row.id}><td>{index+1}</td><td>{row.title||row.hook||row.content_subject||row.topic||`Konten ${index+1}`}</td></tr>)}</tbody></table></div>
              <button type="button" className="btn btn-secondary" onClick={()=>setWizardStep(1)}>Edit Planner</button>{' '}
              <button type="button" className="btn btn-primary" onClick={()=>setWizardStep(3)}>Konfigurasi Pillar →</button>
            </div>}
            {selectedEngine && (selectedEngine!=='pillar'||createdPlanner) && <div hidden={wizardStep!==3}>
              <StudioCampaignWizard engine={selectedEngine} planner={createdPlanner} onCapture={handleEngineCapture} onCancel={()=>{if(window.confirm('Ganti jenis campaign? Isian konfigurasi batch ini akan direset.')) {setSelectedEngine(null);setWizardStep(0);}}} />
            </div>}
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
                  border: '1px solid var(--border-subtle)',
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
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                            Mulai produksi (WIB)
                          </label>
                          <input
                            type="datetime-local"
                            value={rowSched.scheduledProductionAt || ''}
                            onChange={e => setSlotScheduleMap(prev => updateStudioOutputSchedule(outputManifest, prev, row.outputKey, { scheduledProductionAt: e.target.value }))}
                            style={{
                              width: '100%',
                              background: 'var(--input-bg)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-subtle)',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              marginBottom: '6px'
                            }}
                          />
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                            Waktu Tayang (WIB)
                          </label>
                          <input
                            type="datetime-local"
                            value={rowSched.scheduledPublishAt || ''}
                            onChange={(e) => {
                              const pubTime = e.target.value;
                              let prodTime = rowSched.scheduledProductionAt || '';
                              if (pubTime) {
                                try {
                                  prodTime = toZonedInput(new Date(zonedInputToIso(pubTime)).getTime() - 86400000);
                                } catch (err) {
                                  console.warn('Date calculation error:', err);
                                }
                              }
                              setSlotScheduleMap(prev => updateStudioOutputSchedule(outputManifest, prev, row.outputKey, {
                                scheduledPublishAt: pubTime,
                                scheduledProductionAt: prodTime
                              }));
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--input-bg)',
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

                {/* Repliz Accounts Section */}
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        🌐 Akun Tujuan Repliz ({accounts.filter(a => a.provider === 'repliz' && a.status === 'active').length} Akun Terhubung)
                      </h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Hanya akun dengan status <code>connected / active</code> yang ditampilkan.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={reloadReplizAccounts}
                        disabled={isSyncingRepliz}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          cursor: isSyncingRepliz ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ display: 'inline-block', transform: isSyncingRepliz ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
                        {isSyncingRepliz ? 'Menyinkronkan...' : 'Reload Akun Repliz'}
                      </button>

                      {(() => {
                        const activeRepliz = accounts.filter(a => a.provider === 'repliz' && a.status === 'active');
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = activeRepliz.map(a => a.id);
                                setAccountIds(prev => Array.from(new Set([...prev, ...allIds])));
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--surface)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.78rem',
                                cursor: 'pointer'
                              }}
                            >
                              Pilih Semua
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const replizIds = new Set(activeRepliz.map(a => a.id));
                                setAccountIds(prev => prev.filter(id => !replizIds.has(id)));
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--surface)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.78rem',
                                cursor: 'pointer'
                              }}
                            >
                              Batal Pilih
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Search input for accounts */}
                  <div>
                    <input
                      type="text"
                      value={replizSearchQuery}
                      onChange={e => setReplizSearchQuery(e.target.value)}
                      placeholder="🔍 Cari nama akun atau platform (cth: tiktok, instagram, mas benu)..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>

                  {/* Account Grid */}
                  {(() => {
                    const activeRepliz = accounts.filter(a => a.provider === 'repliz' && a.status === 'active');
                    const filteredAccounts = activeRepliz.filter(a => {
                      if (!replizSearchQuery.trim()) return true;
                      const q = replizSearchQuery.toLowerCase();
                      return (a.display_name || a.id || '').toLowerCase().includes(q) || (a.platform || '').toLowerCase().includes(q);
                    });

                    if (activeRepliz.length === 0) {
                      return (
                        <div style={{
                          padding: '20px',
                          textAlign: 'center',
                          background: 'var(--surface-subtle)',
                          borderRadius: '6px',
                          color: 'var(--text-muted)',
                          fontSize: '0.82rem'
                        }}>
                          Belum ada akun Repliz yang terhubung aktif. Klik <strong>Reload Akun Repliz</strong> di atas atau hubungkan akun melalui Publishing Scheduler.
                        </div>
                      );
                    }

                    if (filteredAccounts.length === 0) {
                      return (
                        <div style={{
                          padding: '16px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '0.82rem'
                        }}>
                          Tidak ada akun yang sesuai dengan pencarian "{replizSearchQuery}".
                        </div>
                      );
                    }

                    return (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '8px',
                        maxHeight: '180px',
                        overflowY: 'auto'
                      }}>
                        {filteredAccounts.map(a => {
                          const isChecked = accountIds.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: isChecked ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                                background: isChecked ? 'var(--surface-interactive)' : 'var(--surface)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => setAccountIds(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))}
                                style={{ accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                              />
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {a.display_name || a.id}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                  {a.platform} · <span style={{ color: 'var(--status-success)' }}>● Connected</span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{accountIds.length} akun terpilih untuk batch ini</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={()=>setWizardStep(5)}
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
                    Review Batch →
                  </button>
                </div>
              </div>
            )}
            {wizardStep===5 && <div>
              <h3>Review Batch sebelum disimpan</h3>
              <p>{getEngineBadge(selectedEngine)} · {outputManifest.length} slot · Asia/Jakarta (WIB)</p>
              <p>Batch disimpan sebagai draft. Produksi dimulai setelah Generate Content, mengikuti jadwalnya. Publikasi tetap memerlukan approval.</p>
              {selectedEngine==='pillar'&&<p>Planner akan dikunci untuk batch ini setelah penyimpanan berhasil.</p>}
              <div style={{maxHeight:300,overflow:'auto'}}><table className="table"><thead><tr><th>Output</th><th>Mulai Produksi (WIB)</th><th>Target Tayang (WIB)</th></tr></thead><tbody>{outputManifest.map(output=><tr key={output.outputKey}><td>{output.title}</td><td>{slotScheduleMap[output.outputKey]?.scheduledProductionAt}</td><td>{slotScheduleMap[output.outputKey]?.scheduledPublishAt}</td></tr>)}</tbody></table></div>
              <button type="button" className="btn btn-secondary" onClick={()=>setWizardStep(3)}>Tinjau / Edit Konfigurasi Campaign</button>
              <div style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:20}}><button type="button" className="btn btn-secondary" disabled={wizardSubmitting} onClick={()=>setWizardStep(4)}>← Edit Jadwal</button><button type="button" className="btn btn-primary" disabled={wizardSubmitting} onClick={handleCommitBatch}>{wizardSubmitting?'Menyimpan…':'Simpan Draft Batch'}</button></div>
            </div>}
          </div>
        </div>
      )}

      {/* Slot Review, Mitigation & Log Modal */}
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
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-modal)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Slot #{selectedSlot.slot_number} Review
                  </span>
                  {getEngineBadge(selectedSlot.source_kind)}
                  {getStatusBadge(selectedSlot.stage_status, selectedSlot.publishing_status)}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  {selectedSlot.batch_title || selectedSlot.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs: Detail vs Log */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setSlotModalTab('details')}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: slotModalTab === 'details' ? '2px solid var(--action-primary)' : '2px solid transparent',
                  color: slotModalTab === 'details' ? 'var(--action-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                📝 Detail & Approval
              </button>
              <button
                type="button"
                onClick={() => setSlotModalTab('log')}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: slotModalTab === 'log' ? '2px solid var(--action-primary)' : '2px solid transparent',
                  color: slotModalTab === 'log' ? 'var(--action-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                📜 Log Eksekusi & Audit ({selectedSlot.events?.length || 0})
              </button>
            </div>

            {/* Alerts */}
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

            {mitigationSuccess && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--status-success-soft)',
                border: '1px solid var(--status-success)',
                color: 'var(--status-success)',
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}>
                {mitigationSuccess}
              </div>
            )}

            {/* DRAFT STATE: DISPATCH SECTION */}
            {selectedSlot.stage_status === 'draft' && (
              <div style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    📝 Status Slot: Draft (Belum Diantrekan)
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Menunggu Aktivasi</span>
                </div>
                {selectedSlot.scheduled_production_at && new Date(selectedSlot.scheduled_production_at) < new Date() && (
                  <div style={{
                    background: 'var(--status-warning-soft)',
                    border: '1px solid var(--status-warning)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    color: 'var(--status-warning)'
                  }}>
                    ⚠️ <strong>Jadwal Produksi Terlewat:</strong> Jam produksi ({new Date(selectedSlot.scheduled_production_at).toLocaleString('id-ID')}) sudah lewat. Slot ini akan <strong>langsung diproses seketika</strong> oleh worker AI saat Anda mengklik Eksekusi.
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleDispatchNow(selectedSlot.id)}
                    disabled={mitigationLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--action-primary)',
                      color: 'var(--on-action-primary)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: mitigationLoading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {mitigationLoading ? 'Memproses...' : '⚡ Eksekusi Produksi Sekarang'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotModalTab('log')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    📜 Buka Log Detail Slot
                  </button>
                </div>
              </div>
            )}

            {/* MITIGATION SECTION: Case A - AI Worker Failure (Option 1) */}
            {selectedSlot.stage_status === 'failed' && (
              <div style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--status-danger)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--status-danger)' }}>
                    ❌ Produksi AI Gagal
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mitigasi Opsi 1 (Retry AI)</span>
                </div>
                {selectedSlot.error_message && (
                  <div style={{
                    background: 'var(--status-danger-soft)',
                    border: '1px solid var(--status-danger)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    color: 'var(--status-danger)'
                  }}>
                    <strong>Penyebab:</strong> {selectedSlot.error_message}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleRetryProduction}
                    disabled={mitigationLoading}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--action-primary)',
                      color: 'var(--on-action-primary)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: mitigationLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {mitigationLoading ? 'Memproses...' : '🔄 Ulangi Produksi AI (Retry Dispatch)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotModalTab('log')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    📜 Buka Log Detail Slot
                  </button>
                </div>
              </div>
            )}

            {/* MITIGATION SECTION: Case B - Publishing Failure (Option 2) */}
            {(selectedSlot.publishing_status === 'failed' || selectedSlot.targets?.some(t => t.status === 'failed')) && (
              <div style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--status-warning)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--status-warning)' }}>
                    ⚠️ Gagal Skedul / Publikasi ke Platform
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mitigasi Opsi 2 (Reschedule)</span>
                </div>

                {selectedSlot.targets?.filter(t => t.status === 'failed' && t.error_message).map(t => (
                  <div key={t.id} style={{
                    background: 'var(--status-warning-soft)',
                    border: '1px solid var(--status-warning)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    color: 'var(--status-warning)'
                  }}>
                    <strong>Akun {t.platform}:</strong> {t.error_message}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowRescheduleForm(!showRescheduleForm)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--action-primary)',
                      color: 'var(--on-action-primary)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    {showRescheduleForm ? '▲ Tutup Form Reschedule' : '⏰ Jadwalkan Ulang / Ganti Akun Target (Reschedule)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotModalTab('log')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    📜 Buka Log Detail Slot
                  </button>
                </div>

                {showRescheduleForm && (
                  <div style={{
                    marginTop: '8px',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Waktu Tayang Baru (WIB)
                      </label>
                      <input
                        type="datetime-local"
                        value={reschedulePublishAt}
                        onChange={e => setReschedulePublishAt(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Pilih Akun Tujuan Pengganti
                      </label>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '6px',
                        maxHeight: '130px',
                        overflowY: 'auto'
                      }}>
                        {accounts.filter(a => a.provider === 'repliz' && a.status === 'active').map(a => {
                          const isChecked = rescheduleAccountIds.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: isChecked ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                                background: isChecked ? 'var(--surface-interactive)' : 'var(--surface)',
                                cursor: 'pointer',
                                fontSize: '0.78rem'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => setRescheduleAccountIds(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))}
                                style={{ accentColor: 'var(--action-primary)' }}
                              />
                              <span>{a.display_name || a.id} ({a.platform})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRescheduleMitigation}
                      disabled={mitigationLoading || !reschedulePublishAt}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '6px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--status-success)',
                        color: 'var(--on-action-primary)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: mitigationLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {mitigationLoading ? 'Menyimpan...' : '💾 Simpan Jadwal & Akun Pengganti'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Detail & Approval */}
            {slotModalTab === 'details' && (
              <>
                {/* Media Preview */}
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Media Output Kreatif
                  </span>
                  {(selectedSlot.output_media_type === 'video' ? selectedSlot.final_media_url : null) ? (
                    <video
                      controls
                      src={selectedSlot.final_media_url}
                      style={{ width: '100%', maxHeight: '300px', borderRadius: '6px', background: 'var(--surface-raised)' }}
                    />
                  ) : (selectedSlot.output_media_type === 'image' ? selectedSlot.final_media_url : null) ? (
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

                {/* Target Accounts List */}
                {selectedSlot.targets && selectedSlot.targets.length > 0 && (
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Akun Tujuan Publikasi ({selectedSlot.targets.length})
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedSlot.targets.map(t => (
                        <div
                          key={t.id}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t.platform}</span>
                          <span style={{ color: 'var(--text-muted)' }}>·</span>
                          <span style={{
                            color: t.status === 'published' ? 'var(--status-success)' :
                                   t.status === 'failed' ? 'var(--status-danger)' :
                                   t.status === 'scheduled' ? 'var(--status-info)' : 'var(--text-secondary)'
                          }}>
                            {t.status === 'published' ? '✅ Terbit' :
                             t.status === 'failed' ? '❌ Gagal' :
                             t.status === 'scheduled' ? '⏰ Terjadwal' : '⏳ Menunggu Approval'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--input-bg)',
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
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--surface-interactive)',
                        color: 'var(--text-primary)',
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      📋 Salin Teks / Caption
                    </button>
                    {((selectedSlot.output_media_type === 'video' ? selectedSlot.final_media_url : null) || (selectedSlot.output_media_type === 'image' ? selectedSlot.final_media_url : null)) && (
                      <a
                        href={(selectedSlot.output_media_type === 'video' ? selectedSlot.final_media_url : null) || (selectedSlot.output_media_type === 'image' ? selectedSlot.final_media_url : null)}
                        download
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
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
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--input-bg)',
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
                          color: 'var(--on-action-primary)',
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
                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
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
                      border: '1px solid var(--border-subtle)',
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
              </>
            )}

            {/* TAB CONTENT: Log Eksekusi & Audit Trail */}
            {slotModalTab === 'log' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Riwayat event audit trail untuk slot ini dari <code>content_studio_events</code>:
                  </span>
                </div>

                {(!selectedSlot.events || selectedSlot.events.length === 0) ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: 'var(--surface-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem'
                  }}>
                    Belum ada event audit log tercatat untuk slot ini.
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px',
                    background: 'var(--surface-raised)'
                  }}>
                    {selectedSlot.events.map((ev, i) => (
                      <div
                        key={ev.id || i}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--surface)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: ev.event_type?.includes('fail') ? 'var(--status-danger-soft)' :
                                       ev.event_type?.includes('retry') ? 'var(--status-info-soft)' :
                                       ev.event_type?.includes('reschedule') ? 'var(--status-warning-soft)' : 'var(--surface-interactive)',
                            color: ev.event_type?.includes('fail') ? 'var(--status-danger)' :
                                   ev.event_type?.includes('retry') ? 'var(--status-info)' :
                                   ev.event_type?.includes('reschedule') ? 'var(--status-warning)' : 'var(--text-primary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            fontFamily: 'monospace'
                          }}>
                            {ev.event_type}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {ev.created_at ? new Date(ev.created_at).toLocaleString('id-ID') : '-'}
                          </span>
                        </div>
                        {ev.checkpoint_state && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Status checkpoint: <code>{ev.checkpoint_state}</code>
                          </div>
                        )}
                        {ev.error_message && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--status-danger)', background: 'var(--status-danger-soft)', padding: '4px 8px', borderRadius: '4px' }}>
                            ⚠️ {ev.error_message}
                          </div>
                        )}
                        {ev.payload_json && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {typeof ev.payload_json === 'string' ? ev.payload_json : JSON.stringify(ev.payload_json)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '12px',
                  marginTop: '6px'
                }}>
                  <button
                    type="button"
                    onClick={() => setSlotModalTab('details')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    ← Kembali ke Detail
                  </button>
                  <a
                    href="/content-flow"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-interactive)',
                      color: 'var(--action-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🔗 Buka di ContentFlow / Log Publishing Sistem →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
