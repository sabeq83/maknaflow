'use client';

import { useState, useEffect, useRef } from 'react';

export default function ReferenceAssetManager({ ownerType, ownerId, allowedRoles = [], universeId = null }) {
  const [activeRole, setActiveRole] = useState(allowedRoles[0] || 'visual_style');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  
  // Approval Form State
  const [approvingAssetId, setApprovingAssetId] = useState(null);
  const [attestation, setAttestation] = useState(false);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAssets();
  }, [ownerType, ownerId, activeRole]);

  // Set up polling for generating assets
  useEffect(() => {
    const hasGenerating = assets.some(a => a.status === 'generating');
    if (!hasGenerating) return;

    const interval = setInterval(() => {
      pollGeneratingAssets();
    }, 4000);

    return () => clearInterval(interval);
  }, [assets]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/reference-assets?owner_type=${ownerType}&owner_id=${ownerId}&role=${activeRole}`);
      const json = await res.json();
      if (json.success) {
        setAssets(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load reference assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const pollGeneratingAssets = async () => {
    const generating = assets.filter(a => a.status === 'generating');
    let updated = false;

    const promises = generating.map(async (asset) => {
      try {
        const res = await fetch(`/api/v2/reference-assets/${asset.id}/status`);
        const json = await res.json();
        if (json.success && json.data.status !== 'generating') {
          updated = true;
        }
      } catch (e) {
        console.error('Error polling status:', e);
      }
    });

    await Promise.all(promises);
    if (updated) {
      fetchAssets();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitting(true);
    setActionError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('owner_type', ownerType);
    formData.append('owner_id', ownerId);
    formData.append('role', activeRole);
    if (universeId) {
      formData.append('universe_id', universeId);
    }

    try {
      const res = await fetch('/api/v2/reference-assets/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Upload failed');
      
      fetchAssets();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiGenerate = async () => {
    setSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch('/api/v2/reference-assets/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          owner_type: ownerType,
          owner_id: ownerId,
          role: activeRole,
          universe_id: universeId,
          custom_instruction: customInstruction
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Generation trigger failed');
      
      setCustomInstruction('');
      fetchAssets();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportLegacy = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/v2/reference-assets/import-legacy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          owner_type: ownerType,
          owner_id: ownerId,
          role: activeRole
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Legacy import failed');
      fetchAssets();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/v2/reference-assets/${id}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notes,
          attestation
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Approval failed');
      
      setApprovingAssetId(null);
      setNotes('');
      setAttestation(false);
      fetchAssets();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleReject = async (id) => {
    if (!confirm('Are you sure you want to reject this draft?')) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/v2/reference-assets/${id}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Rejection failed');
      
      setApprovingAssetId(null);
      setNotes('');
      fetchAssets();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleArchive = async (id) => {
    if (!confirm('Are you sure you want to archive this reference asset?')) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/v2/reference-assets/${id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Archive failed');
      
      fetchAssets();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const approvedAsset = assets.find(a => a.status === 'approved');
  const draftAssets = assets.filter(a => a.status !== 'approved');

  const isHuman = ownerType === 'visual_identity' || ownerType === 'character';

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 24, marginTop: 24 }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--action-primary)', marginBottom: 16 }}>
        🖼️ Visual Reference Registry
      </h3>

      {/* Role Tabs */}
      {allowedRoles.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
          {allowedRoles.map(role => (
            <button
              key={role}
              type="button"
              onClick={() => { setActiveRole(role); setApprovingAssetId(null); setActionError(null); }}
              style={{
                background: activeRole === role ? 'var(--action-primary)' : 'none',
                border: activeRole === role ? 'none' : '1px solid var(--border-color)',
                color: activeRole === role ? '#fff' : 'var(--text-secondary)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {role.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <div style={{ background: 'var(--status-danger-soft)', border: '1px solid rgba(251, 113, 133, 0.2)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 16, fontSize: '0.8rem', color: 'var(--status-danger)' }}>
          ⚠️ Error: {actionError}
        </div>
      )}

      {/* Actions Toolbar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Upload Block */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 'var(--radius)', border: '1px dashed var(--border-color)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--text-muted)' }}>UPLOAD REFERENCE</span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={submitting}
            accept=".png,.jpg,.jpeg,.webp"
            style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
          />
        </div>

        {/* AI Generate Block */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 'var(--radius)', border: '1px dashed var(--border-color)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--text-muted)' }}>GENERATE WITH AI</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Custom direction prompt..."
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              disabled={submitting}
              style={{
                flex: 1,
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.75rem'
              }}
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={submitting}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            >
              {submitting ? 'Gen...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Legacy Import Block */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 'var(--radius)', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={handleImportLegacy}
            disabled={submitting}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', fontSize: '0.75rem' }}
          >
            🔄 Import Legacy Path Reference
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', py: 12 }}>Loading Registry...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {/* Approved Active Reference */}
          <div style={{ background: 'rgba(20, 30, 50, 0.4)', border: '2px solid var(--status-success)', borderRadius: 'var(--radius)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--status-success)', textTransform: 'uppercase' }}>ACTIVE APPROVED</span>
              {approvedAsset && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v{approvedAsset.version}</span>
              )}
            </div>
            
            {approvedAsset ? (
              <div>
                <img
                  src={approvedAsset.public_path}
                  alt="Active approved reference"
                  style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: 12, border: '1px solid var(--border-color)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>SHA256: {approvedAsset.sha256?.substring(0, 16)}...</span>
                  <span>{approvedAsset.width}x{approvedAsset.height}</span>
                </div>
                {approvedAsset.review_notes && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 4, marginTop: 8 }}>
                    <strong>Notes:</strong> {approvedAsset.review_notes}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => handleArchive(approvedAsset.id)}
                  className="btn btn-danger btn-sm"
                  style={{ width: '100%', marginTop: 12, fontSize: '0.75rem', padding: '6px 0' }}
                >
                  Archive Active Asset
                </button>
              </div>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                No active approved reference.
              </div>
            )}
          </div>

          {/* Registry Drafts and Alternatives */}
          <div style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 16 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: 12, color: 'var(--text-secondary)' }}>VERSIONS & ALTERNATIVES</span>
            
            {draftAssets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '40px 0' }}>No pending drafts.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
                {draftAssets.map(asset => (
                  <div key={asset.id} style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
                    {asset.status === 'generating' ? (
                      <div style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: 4, fontSize: '0.6rem', color: 'var(--accent-color)' }}>
                        <span className="spinner" style={{ display: 'block', width: 16, height: 16, border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 4 }} />
                        Generating
                      </div>
                    ) : asset.public_path ? (
                      <img src={asset.public_path} alt="Draft reference" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} />
                    ) : (
                      <div style={{ width: 80, height: 80, background: 'rgba(255,0,0,0.1)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--status-danger)' }}>Failed</div>
                    )}

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>v{asset.version}</span>
                          <span style={{ 
                            fontSize: '0.6rem', 
                            padding: '2px 6px', 
                            borderRadius: 10, 
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: asset.status === 'draft' ? 'var(--status-info-soft)' : asset.status === 'failed' ? 'var(--status-danger-soft)' : 'rgba(255,255,255,0.05)',
                            color: asset.status === 'draft' ? 'var(--status-info)' : asset.status === 'failed' ? 'var(--status-danger)' : 'var(--text-muted)'
                          }}>{asset.status}</span>
                        </div>
                        {asset.generation_prompt && (
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {asset.generation_prompt}
                          </p>
                        )}
                        {asset.status === 'failed' && (
                          <p style={{ fontSize: '0.65rem', color: 'var(--status-danger)', margin: 0 }}>
                            Error: {asset.failure_message || 'Generation failed'}
                          </p>
                        )}
                      </div>

                      {asset.status === 'draft' && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={() => { setApprovingAssetId(asset.id); setNotes(''); setAttestation(false); }}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1, fontSize: '0.65rem', padding: '4px 0' }}
                          >
                            Review & Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(asset.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.65rem', padding: '4px 8px' }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Modal / Backdrop Overlay */}
      {approvingAssetId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 24, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--action-primary)' }}>
              📝 Review Reference Asset Draft (v{assets.find(a => a.id === approvingAssetId)?.version})
            </h4>

            {isHuman && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--status-warning-soft)', border: '1px solid rgba(245,158,11,0.2)', padding: 12, borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: '#fff', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={attestation}
                  onChange={(e) => setAttestation(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <strong>Faceless Policy Attestation:</strong> Saya menjamin bahwa gambar subjek manusia ini bebas dari fitur wajah lengkap (mata/hidung/mulut) sesuai kepatuhan faceless video.
                </span>
              </label>
            )}

            <label className="form-label" style={{ margin: 0 }}>
              Review Notes (Optional)
              <textarea
                rows={3}
                placeholder="Catatan persetujuan atau alasan revisi..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.75rem', fontFamily: 'inherit' }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => handleApprove(approvingAssetId)}
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '0.8rem', padding: '10px 0' }}
              >
                Approve & Set Active
              </button>
              <button
                type="button"
                onClick={() => handleReject(approvingAssetId)}
                className="btn btn-danger"
                style={{ flex: 1, fontSize: '0.8rem', padding: '10px 0' }}
              >
                Reject Draft
              </button>
              <button
                type="button"
                onClick={() => setApprovingAssetId(null)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '10px 14px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS style tags for animation */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
