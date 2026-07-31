'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

const TONE_OPTIONS = [
  'Kasual/Gaul',
  'Profesional/Edukatif',
  'ASMR/Menenangkan',
  'Motivasi/Tegas',
];

const emptyForm = {
  brand_name: '',
  tone_of_voice: 'Kasual/Gaul',
  visual_signature: '',
  raw_guideline_text: '',
  guideline_filename: '',
  storage_provider: '',
  nextcloud_target_folder: '',
  drive_target_folder: '',
  drive_glabs_folder_id: '',
  webhook_host: '',
  webhook_port: '',
  webhook_api_key: '',
};

export default function BrandProfilesPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [inputMode, setInputMode] = useState('manual');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchProfiles(); }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchProfiles() {
    try {
      const res = await fetch('/api/v2/brand-profiles');
      const data = await res.json();
      if (data.success) setProfiles(data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleFileExtract(e) {
    const file = e.target.files[0];
    if (!file) return;
    setIsExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v2/brand-profiles/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({
          ...prev,
          brand_name: data.data.brand_name || prev.brand_name,
          tone_of_voice: data.data.tone_of_voice || prev.tone_of_voice,
          visual_signature: data.data.visual_signature || prev.visual_signature,
          raw_guideline_text: data.data.raw_guideline_text || '',
          guideline_filename: data.data.guideline_filename || '',
        }));
        showToast('✅ Brand Guideline berhasil diekstrak! Silakan review dan edit.');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!formData.brand_name.trim() || !formData.visual_signature.trim()) {
      showToast('Brand Name dan Visual Signature wajib diisi.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/v2/brand-profiles/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error('Gagal mengupdate');
        showToast('Brand Profile berhasil diupdate!');
      } else {
        const res = await fetch('/api/v2/brand-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error('Gagal menyimpan');
        showToast('Brand Profile baru berhasil dibuat!');
      }
      setFormData({ ...emptyForm });
      setEditingId(null);
      setShowForm(false);
      setInputMode('manual');
      fetchProfiles();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEdit(id) {
    try {
      const res = await fetch(`/api/v2/brand-profiles/${id}`);
      const data = await res.json();
      if (data.success) {
        setFormData({
          brand_name: data.data.brand_name || '',
          tone_of_voice: data.data.tone_of_voice || 'Kasual/Gaul',
          visual_signature: data.data.visual_signature || '',
          raw_guideline_text: data.data.raw_guideline_text || '',
          guideline_filename: data.data.guideline_filename || '',
          storage_provider: data.data.storage_provider || '',
          nextcloud_target_folder: data.data.nextcloud_target_folder || '',
          drive_target_folder: data.data.drive_target_folder || '',
          drive_glabs_folder_id: data.data.drive_glabs_folder_id || '',
          webhook_host: data.data.webhook_host || '',
          webhook_port: data.data.webhook_port || '',
          webhook_api_key: data.data.webhook_api_key || '',
        });
        setEditingId(id);
        setShowForm(true);
        setInputMode('manual');
      }
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus Brand Profile ini secara permanen?')) return;
    try {
      const res = await fetch(`/api/v2/brand-profiles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus');
      showToast('Brand Profile berhasil dihapus');
      fetchProfiles();
    } catch (e) { showToast(e.message, 'error'); }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">🧬 Brand Profile Manager</h1>
            <p className="page-subtitle">Kelola identitas merek Anda — setiap konten AI akan diselaraskan dengan Brand Profile yang dipilih.</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(v => !v); if (showForm) { setEditingId(null); setFormData({ ...emptyForm }); setInputMode('manual'); } }}>
            {showForm ? '✕ Tutup Form' : '+ New Brand Profile'}
          </button>
        </div>

        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {toast.msg}
          </div>
        )}

        {showForm && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-title"><span className="icon">✦</span> {editingId ? 'Edit Brand Profile' : 'New Brand Profile'}</div>

            {/* Input Mode Toggle */}
            {!editingId && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-glass)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setInputMode('manual')} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', background: inputMode === 'manual' ? 'var(--accent)' : 'none', color: inputMode === 'manual' ? '#fff' : 'var(--text-secondary)' }}>📝 Input Manual</button>
                <button type="button" onClick={() => setInputMode('upload')} style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)', background: inputMode === 'upload' ? 'var(--accent)' : 'none', color: inputMode === 'upload' ? '#fff' : 'var(--text-secondary)' }}>📄 Upload Guideline</button>
              </div>
            )}

            {/* Upload Section */}
            {inputMode === 'upload' && !editingId && (
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Upload Brand Guideline (.pdf, .md, .txt)</label>
                <input
                  type="file"
                  accept=".pdf,.md,.txt,.docx"
                  onChange={handleFileExtract}
                  className="form-input"
                  disabled={isExtracting}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {isExtracting
                    ? '🔄 AI sedang membaca dan mengekstrak Brand DNA dari dokumen Anda...'
                    : 'AI akan otomatis membaca dokumen dan mengisi form di bawah. Anda bisa menyempurnakan sebelum menyimpan.'}
                </div>
                {isExtracting && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                    <div className="spinner" style={{ width: 18, height: 18 }}></div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent-light)' }}>Extracting brand identity...</span>
                  </div>
                )}
                {formData.guideline_filename && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: '8px' }}>
                    ✅ File terproses: <strong>{formData.guideline_filename}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Structured Form Fields */}
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Brand Name *</label>
                    <input className="form-input" name="brand_name" value={formData.brand_name} onChange={handleChange} required placeholder="Contoh: Glow Naturals" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tone of Voice</label>
                    <select className="form-select" name="tone_of_voice" value={formData.tone_of_voice} onChange={handleChange}>
                      {TONE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Visual Signature *</label>
                  <textarea className="form-textarea" name="visual_signature" value={formData.visual_signature} onChange={handleChange} required placeholder='Contoh: pencahayaan golden hour, macro shots, clean aesthetic minimalis' style={{ minHeight: '80px' }} />
                </div>

                {/* AI WEBHOOK & STORAGE DESTINATIONS SECTION */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-light)', marginBottom: '16px' }}>🌐 AI Webhook & Storage Destinations</h3>
                  
                  {/* AI Webhook Config */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>AI Webhook Config (G-Labs GPU Override)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Webhook Host IP</label>
                        <input className="form-input" name="webhook_host" value={formData.webhook_host} onChange={handleChange} placeholder="Contoh: 100.117.59.92" style={{ padding: '8px' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Port</label>
                        <input className="form-input" name="webhook_port" value={formData.webhook_port} onChange={handleChange} placeholder="8765" style={{ padding: '8px' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>API Key Override</label>
                        <input className="form-input" type="password" name="webhook_api_key" value={formData.webhook_api_key} onChange={handleChange} placeholder="Optional G-Labs API Key" style={{ padding: '8px' }} />
                      </div>
                    </div>
                  </div>

                  {/* Storage Destination Config */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>Cloud Storage Destination Override</h4>
                    
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Storage Provider</label>
                      <select className="form-select" name="storage_provider" value={formData.storage_provider} onChange={handleChange} style={{ padding: '8px' }}>
                        <option value="">-- Gunakan Setelan Global --</option>
                        <option value="nextcloud">Nextcloud</option>
                        <option value="gdrive">Google Drive</option>
                      </select>
                    </div>

                    {formData.storage_provider === 'nextcloud' && (
                      <div className="form-group animate-fade-in">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Nextcloud Target Folder (Parent Path)</label>
                        <input className="form-input" name="nextcloud_target_folder" value={formData.nextcloud_target_folder} onChange={handleChange} placeholder="Contoh: MAKNA_Assets/Nutribake" style={{ padding: '8px' }} />
                      </div>
                    )}

                    {formData.storage_provider === 'gdrive' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="animate-fade-in">
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Google Drive Folder Name</label>
                          <input className="form-input" name="drive_target_folder" value={formData.drive_target_folder} onChange={handleChange} placeholder="Contoh: Nutribake Drive Folder" style={{ padding: '8px' }} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Google Drive Folder ID (Direct Parent)</label>
                          <input className="form-input" name="drive_glabs_folder_id" value={formData.drive_glabs_folder_id} onChange={handleChange} placeholder="Contoh: 1abc123xyz_ID" style={{ padding: '8px' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Menyimpan...' : editingId ? '💾 Update Profile' : '💾 Simpan Brand Profile'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...emptyForm }); setInputMode('manual'); }}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Profiles List */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Memuat Brand Profiles...</div>
        ) : profiles.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🧬</div>
            <p style={{ color: 'var(--text-muted)' }}>Belum ada Brand Profile. Klik "+ New Brand Profile" untuk memulai.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ideas-table">
              <thead>
                <tr>
                  <th>Brand Name</th>
                  <th>Tone of Voice</th>
                  <th>Visual Signature</th>
                  <th>Storage Destination</th>
                  <th>G-Labs Host</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.brand_name}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(108,92,231,0.12)', color: 'var(--accent-light)' }}>
                        {p.tone_of_voice}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.visual_signature}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {p.storage_provider === 'nextcloud' ? '☁️ Nextcloud' : p.storage_provider === 'gdrive' ? '📁 Google Drive' : '⚙️ Global Settings'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {p.webhook_host ? `🖥️ ${p.webhook_host}` : '⚙️ Global Webhook'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {p.guideline_filename ? `📄 ${p.guideline_filename}` : '📝 Manual'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(p.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(p.id)}>✏️ Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
