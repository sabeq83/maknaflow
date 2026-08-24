'use client';

import { useState, useEffect } from 'react';
import styles from './AffiliateStudio.module.css';

export function BrandProductionRuns({ brandId, runs = [], loading, onRefresh }) {
  const [reconciling, setReconciling] = useState(false);
  const [publishingDetails, setPublishingDetails] = useState({});

  const loadPublishingDetails = (runId) => {
    const run = runs.find(r => r.id === runId);
    if (!run) return;
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${run.affiliateProgramId}/runs/${runId}/publishing`)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setPublishingDetails(prev => ({
            ...prev,
            [runId]: body.data
          }));
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (runs && runs.length > 0) {
      runs.forEach(r => {
        if (!publishingDetails[r.id]) {
          loadPublishingDetails(r.id);
        }
      });
    }
  }, [runs]);

  const handleReconcile = () => {
    setReconciling(true);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/runs/reconcile`, {
      method: 'POST'
    })
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          if (onRefresh) onRefresh();
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
        <h3>Brand-Wide Campaign Production Runs Queue</h3>
        <button 
          type="button" 
          className={styles.reconcileBtn}
          onClick={handleReconcile}
          disabled={reconciling || loading}
        >
          {reconciling ? 'Syncing...' : 'Sync All Engine Statuses'}
        </button>
      </div>

      {loading && <div className={styles.smallLoading}>Loading production runs...</div>}

      {!loading && runs.length === 0 && (
        <div className={styles.emptyStateLight}>
          <p>Belum ada eksekusi produksi (Content Runs) terdaftar untuk brand profile ini.</p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.snapshotsTable}>
            <thead>
              <tr>
                <th>Campaign Program</th>
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
                    <span style={{ fontWeight: 'bold' }}>{r.programTitle || 'N/A'}</span>
                  </td>
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
                    <div className={styles.statusColWithLink}>
                      <span className={`${styles.statusBadge} ${styles['status_' + (publishingDetails[r.id]?.projection?.status || r.normalizedStatus)]}`}>
                        {publishingDetails[r.id]?.projection?.status || r.normalizedStatus}
                      </span>
                    </div>
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
