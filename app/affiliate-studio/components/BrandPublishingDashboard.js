'use client';

import { useState, useEffect } from 'react';
import styles from './AffiliateStudio.module.css';

export function BrandPublishingDashboard({ brandId, runs = [], loading }) {
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

  return (
    <div className={styles.runsWrapper}>
      <div className={styles.blockHeader}>
        <h3>Brand-Wide Content Publishing & Preflight Pipeline</h3>
      </div>

      {loading && <div className={styles.smallLoading}>Loading publishing pipeline...</div>}

      {!loading && runs.length === 0 && (
        <div className={styles.emptyStateLight}>
          <p>Belum ada konten dalam antrean penerbitan untuk brand profile ini.</p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.snapshotsTable}>
            <thead>
              <tr>
                <th>Campaign Program</th>
                <th>Content Topic</th>
                <th>Preflight Check</th>
                <th>Publishing Status</th>
                <th>ContentFlow Lineage</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const details = publishingDetails[r.id] || {};
                const preflight = details.preflight || {};
                const proj = details.projection || {};
                return (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 'bold' }}>{r.programTitle}</span>
                    </td>
                    <td>
                      <div>
                        <strong>Row {r.sequence} - {r.pillar}</strong>
                        <div className={styles.runContextText}>"{r.context}"</div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.preflightIndicators}>
                        <span 
                          className={preflight.affiliateLinkPresent ? styles.checkGreen : styles.checkRed} 
                          title={preflight.affiliateLinkPresent ? "Affiliate Link Present" : "Missing Affiliate Link"}
                        >
                          🔗 Link {preflight.affiliateLinkPresent ? 'OK' : 'Missing'}
                        </span>
                        <span 
                          className={preflight.accountReady ? styles.checkGreen : styles.checkRed} 
                          title={preflight.accountReady ? "Social Account Connected" : "Social Account Offline"}
                        >
                          👤 Account {preflight.accountReady ? 'OK' : 'Offline'}
                        </span>
                        <span 
                          className={preflight.mediaReady ? styles.checkGreen : styles.checkRed} 
                          title={preflight.mediaReady ? "Video Rendered & Ready" : "Video Rendering / Missing"}
                        >
                          📹 Media {preflight.mediaReady ? 'OK' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles['status_' + (proj.status || r.normalizedStatus)]}`}>
                        {proj.status || r.normalizedStatus}
                      </span>
                    </td>
                    <td>
                      {proj.deepLink ? (
                        <a 
                          href={proj.deepLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={styles.openPlannerBtn}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Open ContentFlow ↗
                        </a>
                      ) : (
                        <span className={styles.mutedText}>Not Ingested in Flow</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
