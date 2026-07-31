'use client';

import Sidebar from '../components/Sidebar';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const STATUS_COLOR = {
  active:    'var(--accent-light)',
  paused:    'var(--text-muted)',
  completed: 'var(--success)',
};

export default function GLabsCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [toast, setToast] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 10000);
    return () => clearInterval(interval);
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/v2/glabs-campaigns');
      const data = await res.json();
      if (data.campaigns) setCampaigns(data.campaigns);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!sheetId.trim() || !folderId.trim()) {
      showToast('Sheet ID/URL dan Drive Folder ID/URL diperlukan.', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/v2/glabs-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_spreadsheet_id: sheetId.trim(), target_drive_folder_id: folderId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('G Labs Campaign berhasil dibuat!');
      setSheetId('');
      setFolderId('');
      setShowForm(false);
      fetchCampaigns();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(campaign) {
    const nextStatus = campaign.status === 'active' ? 'paused' : 'active';
    setTogglingId(campaign.id);
    try {
      const res = await fetch(`/api/v2/glabs-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal update status');
      showToast(`Campaign ${nextStatus === 'active' ? 'dilanjutkan' : 'dijeda'}.`);
      fetchCampaigns();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">🎥 G Labs Campaign</h1>
            <p className="page-subtitle">Batch video generation via G Labs API — 3-Phase Polling Loop otomatis</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Tutup Form' : '+ New Campaign'}
          </button>
        </div>

        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {toast.msg}
          </div>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-title"><span className="icon">🎥</span> New G Labs Campaign</div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Source Google Sheet (URL atau ID)</label>
                <input
                  className="form-input"
                  placeholder="https://docs.google.com/spreadsheets/d/... atau ID sheet"
                  value={sheetId}
                  onChange={e => setSheetId(e.target.value)}
                  required
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  Sheet harus punya kolom: <code>status</code>, <code>prompt</code> (atau <code>t2v_prompt</code>), <code>video_task_id</code>, <code>video_url</code>
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Target Google Drive Folder (URL atau ID)</label>
                <input
                  className="form-input"
                  placeholder="https://drive.google.com/drive/folders/... atau ID folder"
                  value={folderId}
                  onChange={e => setFolderId(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Membuat...' : '🚀 Buat Campaign'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Memuat kampanye...</div>
        ) : campaigns.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎥</div>
            <p style={{ color: 'var(--text-muted)' }}>Belum ada kampanye. Klik "+ New Campaign" untuk memulai.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns.map(c => (
              <div key={c.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.id.slice(0, 8)}…</span>
                      <span style={{ color: STATUS_COLOR[c.status] || 'inherit', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        {c.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      📊 Sheet: <code style={{ fontSize: '0.75rem' }}>{c.source_spreadsheet_id}</code>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      📁 Folder: <code style={{ fontSize: '0.75rem' }}>{c.target_drive_folder_id}</code>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Batch ke-{c.current_batch} • Dibuat {new Date(c.created_at).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Link href={`/glabs-campaigns/${c.id}`} className="btn btn-secondary btn-sm">
                      Detail →
                    </Link>
                    {c.status !== 'completed' && (
                      <button
                        className={`btn btn-sm ${c.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleStatus(c)}
                        disabled={togglingId === c.id}
                      >
                        {c.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                      </button>
                    )}
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${c.source_spreadsheet_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      📊 Sheet
                    </a>
                    <a
                      href={`https://drive.google.com/drive/folders/${c.target_drive_folder_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      📁 Drive
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
