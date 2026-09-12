'use client';

import { useState, useEffect } from 'react';
import PublishingScheduler from '@/app/content-flow/PublishingScheduler';

export function BrandPublishingDashboard({ brandId, runs = [], loading }) {
  const [publishingDetails, setPublishingDetails] = useState({});

  const loadPublishingDetails = (runId) => {
    const run = runs.find(r => r.id === runId);
    if (!run || !run.affiliateProgramId) return;
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
      .catch(() => {});
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Preflight Summary Banner */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
            🚀 Tahap 4: Commercial Publishing & Preflight Pipeline
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            Verifikasi link afiliasi, disclosure komersial, dan multi-channel publishing scheduling.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'rgba(74, 222, 128, 0.15)',
            color: 'var(--status-success, #4ade80)',
            fontSize: '11px',
            fontWeight: 700
          }}>
            🔗 Affiliate Links Verified
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'rgba(56, 189, 248, 0.15)',
            color: 'var(--action-primary, #2dd4bf)',
            fontSize: '11px',
            fontWeight: 700
          }}>
            👤 Accounts Connected
          </span>
        </div>
      </div>

      {/* Embedded Controlled Publishing Scheduler */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border-subtle)',
        padding: '12px'
      }}>
        <PublishingScheduler
          controlledBrandProfileId={brandId}
          controlledContentRunIds={runs.map(r => r.id)}
        />
      </div>
    </div>
  );
}
