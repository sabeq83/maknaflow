'use client';

import { useState, useEffect } from 'react';
import styles from './AffiliateStudio.module.css';

export function CampaignProgramRuns({ brandId, program }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState(null);
  const [publishingDetails, setPublishingDetails] = useState({});

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

  const loadPublishingDetails = (runId) => {
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/runs/${runId}/publishing`)
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
                <th>Preflight</th>
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
                    <div className={styles.statusColWithLink}>
                      <span className={`${styles.statusBadge} ${styles['status_' + (publishingDetails[r.id]?.projection?.status || r.normalizedStatus)]}`}>
                        {publishingDetails[r.id]?.projection?.status || r.normalizedStatus}
                      </span>
                      {publishingDetails[r.id]?.projection?.deepLink && (
                        <a
                          href={publishingDetails[r.id].projection.deepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.contentFlowDeepLink}
                        >
                          🔗 Flow
                        </a>
                      )}
                    </div>
                  </td>
                  <td>
                    {publishingDetails[r.id]?.preflight ? (
                      <div className={styles.preflightIndicators}>
                        <span className={publishingDetails[r.id].preflight.affiliateLinkPresent ? styles.checkGreen : styles.checkRed} title="Affiliate Link">🔗</span>
                        <span className={publishingDetails[r.id].preflight.accountReady ? styles.checkGreen : styles.checkRed} title="Account Ready">👤</span>
                        <span className={publishingDetails[r.id].preflight.mediaReady ? styles.checkGreen : styles.checkRed} title="Media Ready">📹</span>
                      </div>
                    ) : (
                      <div className={styles.mutedText}>Checking...</div>
                    )}
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
