'use client';

import { useState, useEffect } from 'react';
import styles from './AffiliateStudio.module.css';

export function CampaignProgramRuns({ brandId, program }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRuns();
  }, [program.id]);

  const loadRuns = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/runs`)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setRuns(body.data || []);
        } else {
          throw new Error(body.error || 'Failed to fetch runs');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleReconcile = () => {
    setReconciling(true);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/runs/reconcile`, {
      method: 'POST'
    })
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          loadRuns();
        } else {
          throw new Error(body.error || 'Failed to reconcile runs');
        }
      })
      .catch(err => alert(err.message))
      .finally(() => setReconciling(false));
  };

  return (
    <div className={styles.runsWrapper}>
      <div className={styles.blockHeader}>
        <h3>Unified Campaign Production Runs Queue</h3>
        <button 
          type="button" 
          className={styles.reconcileBtn}
          onClick={handleReconcile}
          disabled={reconciling || loading}
        >
          {reconciling ? 'Syncing...' : 'Sync Engine Status'}
        </button>
      </div>

      {loading && <div className={styles.smallLoading}>Loading production runs...</div>}
      {error && <div className={styles.errorState}>{error}</div>}

      {!loading && runs.length === 0 && (
        <div className={styles.emptyStateLight}>
          <p>Belum ada eksekusi produksi (Content Runs) terdaftar untuk program kampanye ini.</p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.snapshotsTable}>
            <thead>
              <tr>
                <th>Planner Context</th>
                <th>Engine & IDs</th>
                <th>Normalized Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id}>
                  <td>
                    <div>
                      <strong>Row {r.sequence} - {r.pillar}</strong>
                      <div className={styles.mutedText}>Category: {r.categoryCep}</div>
                      <div className={styles.runContextText}>"{r.context}"</div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <span className={styles.engineBadge}>{r.engineType.toUpperCase()}</span>
                      <div className={styles.mutedText}>Campaign ID: {r.engineCampaignId}</div>
                      {r.engineItemId && <div className={styles.mutedText}>Item ID: {r.engineItemId}</div>}
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles['status_' + r.normalizedStatus]}`}>
                      {r.normalizedStatus}
                    </span>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <a 
                      href={r.deepLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.openPlannerBtn}
                    >
                      Open Engine View ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
