'use client';

import Sidebar from '../../components/Sidebar';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function GLabsCampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetchDetail();
    const interval = setInterval(fetchDetail, 10000);
    return () => clearInterval(interval);
  }, [id]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchDetail() {
    try {
      const res = await fetch(`/api/v2/glabs-campaigns/${id}`);
      const data = await res.json();
      if (data.campaign) setCampaign(data.campaign);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus() {
    if (!campaign) return;
    const nextStatus = campaign.status === 'active' ? 'paused' : 'active';
    setToggling(true);
    try {
      const res = await fetch(`/api/v2/glabs-campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal update status');
      showToast(`Campaign ${nextStatus === 'active' ? 'dilanjutkan' : 'dijeda'}.`);
      fetchDetail();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setToggling(false);
    }
  }

  if (loading) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ color: 'var(--text-muted)', padding: 48, textAlign: 'center' }}>Memuat...</div>
      </main>
    </div>
  );

  if (!campaign) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>Campaign tidak ditemukan.</div>
      </main>
    </div>
  );

  const statusColor = { active: 'var(--accent-light)', paused: 'var(--text-muted)', completed: 'var(--success)' };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <Link href="/glabs-campaigns" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'none' }}>
              ← Kembali ke G Labs Campaign
            </Link>
            <h1 className="page-title" style={{ marginTop: 8 }}>🎥 G Labs Campaign</h1>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{campaign.id}</span>
              <span style={{ color: statusColor[campaign.status] || 'inherit', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                {campaign.status}
              </span>
            </div>
          </div>
          {campaign.status !== 'completed' && (
            <button
              className={`btn ${campaign.status === 'active' ? 'btn-danger' : 'btn-success'}`}
              onClick={toggleStatus}
              disabled={toggling}
            >
              {campaign.status === 'active' ? '⏸ Pause Campaign' : '▶ Resume Campaign'}
            </button>
          )}
        </div>

        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {toast.msg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="card">
            <div className="card-title"><span className="icon">📊</span> Source Sheet</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', marginBottom: 12, wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
              {campaign.source_spreadsheet_id}
            </div>
            <a
              href={`https://docs.google.com/spreadsheets/d/${campaign.source_spreadsheet_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              Buka Google Sheet →
            </a>
          </div>
          <div className="card">
            <div className="card-title"><span className="icon">📁</span> Target Drive Folder</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', marginBottom: 12, wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
              {campaign.target_drive_folder_id}
            </div>
            <a
              href={`https://drive.google.com/drive/folders/${campaign.target_drive_folder_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              Buka Google Drive →
            </a>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span className="icon">⚙</span> Info Campaign</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Status</span>
              <span style={{ color: statusColor[campaign.status], fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>{campaign.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Batch Saat Ini</span>
              <span style={{ fontWeight: 600 }}>Batch ke-{campaign.current_batch}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Dibuat</span>
              <span style={{ fontSize: '0.85rem' }}>{new Date(campaign.created_at).toLocaleString('id-ID')}</span>
            </div>
          </div>
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <b>3-Phase Loop:</b> Scheduler secara otomatis menjalankan <b>Phase 1</b> (cek status video processing) →{' '}
            <b>Phase 2</b> (guard: tahan jika masih ada yang processing) → <b>Phase 3</b> (submit batch baru dengan 30s delay antar scene).
          </div>
        </div>
      </main>
    </div>
  );
}
