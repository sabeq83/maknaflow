'use client';

import { useState, useEffect } from 'react';
import { AffiliateSceneInspector } from './AffiliateSceneInspector';

export function AffiliateProductionWorkspace({
  brandId,
  brandName,
  onNavigateToPublishing
}) {
  const [runs, setRuns] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [activeScenes, setActiveScenes] = useState([]);
  const [activeSceneIndex, setActiveSceneIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  useEffect(() => {
    loadBrandRuns();
  }, [brandId]);

  const loadBrandRuns = async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/affiliate-studio/brands/${brandId}/runs`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRuns(json.data);
        if (json.data.length > 0 && !activeRunId) {
          loadRunScenes(json.data[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load production runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRunScenes = async (runId) => {
    setActiveRunId(runId);
    try {
      const res = await fetch(`/api/v2/affiliate-studio/brands/${brandId}/production/runs/${runId}/scenes`);
      const json = await res.json();
      if (json.success && json.data?.scenes) {
        setActiveScenes(json.data.scenes);
        setActiveSceneIndex(1);
      }
    } catch (err) {
      console.warn('Failed to load run scenes:', err);
    }
  };

  const handleReconcileEngine = async () => {
    if (!activeRunId) return;
    try {
      const res = await fetch(`/api/v2/affiliate-studio/brands/${brandId}/production/runs/${activeRunId}/actions/reconcile_engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (json.success) {
        showToast('⚡ Sinkronisasi state engine Pillar berhasil!');
        loadBrandRuns();
      }
    } catch (err) {
      showToast('Gagal sinkronisasi engine');
    }
  };

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

      {/* Stage 3 Header */}
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
            🎬 Tahap 3: Production Workspace (Pillar Campaign Interaction Model)
          </h2>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Brand: <strong>{brandName || 'MAKNA Brand'}</strong> · Scene-Level Generation & Visual Inspector
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleReconcileEngine}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            🔄 Reconcile Engine
          </button>
          <button
            type="button"
            onClick={() => onNavigateToPublishing?.()}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              background: 'var(--action-primary, #2dd4bf)',
              color: 'var(--on-action-primary, #042f2e)',
              border: 'none',
              fontWeight: 750,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Lanjut ke Publishing →
          </button>
        </div>
      </div>

      {/* Workspace Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 340px) 1fr',
        gap: '16px',
        alignItems: 'start'
      }}>
        {/* Left Column: Content Runs Rail */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-subtle)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
            Content Runs ({runs.length} Items)
          </div>

          {runs.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Belum ada content run aktif. Ingest row dari <strong>Tahap 2: Content Planner</strong>.
            </div>
          ) : (
            runs.map((r, idx) => {
              const isSelected = activeRunId === r.id;
              const product = r.productSnapshot?.name || 'Produk Brand';
              const cep = r.productSnapshot?.cep_code || r.categoryCep || 'Problem-Solution';

              return (
                <div
                  key={r.id}
                  onClick={() => loadRunScenes(r.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: isSelected ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--action-primary)' : 'var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                      Item #{idx + 1} — {cep}
                    </span>
                    <span style={{
                      fontSize: '10.5px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      background: r.normalizedStatus === 'Ready' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                      color: r.normalizedStatus === 'Ready' ? 'var(--status-success)' : 'var(--action-primary)'
                    }}>
                      {r.normalizedStatus || 'Generating'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {product} · 5 Scenes · Multi-Platform
                  </div>

                  {/* Stage Progress Rail */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    {['Storyboard', 'VO Audio', 'Visual Plan', 'Rendering', 'Ready'].map((step, sIdx) => {
                      const isReady = r.normalizedStatus === 'Ready';
                      const isDone = isReady || sIdx <= 2;
                      const isActive = !isReady && sIdx === 3;

                      return (
                        <div
                          key={step}
                          title={step}
                          style={{
                            flex: 1,
                            height: '4px',
                            borderRadius: '2px',
                            background: isDone ? 'var(--status-success, #4ade80)' : (isActive ? 'var(--action-primary, #2dd4bf)' : 'var(--border-subtle)')
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Scene Inspector */}
        <AffiliateSceneInspector
          runId={activeRunId}
          brandId={brandId}
          scenes={activeScenes}
          activeSceneIndex={activeSceneIndex}
          onSelectScene={(idx) => setActiveSceneIndex(idx)}
          onSceneUpdated={(updated) => {
            setActiveScenes(prev => prev.map(s => s.scene_index === updated.scene_index ? updated : s));
          }}
        />
      </div>
    </div>
  );
}
