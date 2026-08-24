'use client';

import styles from './AffiliateStudio.module.css';

export function BrandPerformanceOverview({ data, loading }) {
  if (loading) return <div className={styles.smallLoading}>Loading brand performance dashboard...</div>;

  const totalViews = data?.total_views || 0;
  const totalLikes = data?.total_likes || 0;
  const totalShares = data?.total_shares || 0;
  const totalClicks = data?.total_clicks || 0;
  const totalConversions = data?.total_conversions || 0;
  const totalRevenue = data?.total_revenue || 0.00;

  // Let's compute CTR and Conversion Rate
  const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00';
  const cvr = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '0.00';

  return (
    <div className={styles.performanceTabPanel}>
      <div className={styles.blockHeader}>
        <h3>Consolidated Brand Performance Dashboard</h3>
      </div>

      <div className={styles.metricsSummaryGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Views</span>
          <span className={styles.metricValue}>{totalViews.toLocaleString()}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Likes</span>
          <span className={styles.metricValue}>{totalLikes.toLocaleString()}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Shares</span>
          <span className={styles.metricValue}>{totalShares.toLocaleString()}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Clicks</span>
          <span className={styles.metricValue}>{totalClicks.toLocaleString()}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Conversions</span>
          <span className={styles.metricValue}>{totalConversions.toLocaleString()}</span>
        </div>
        <div className={styles.metricCard} style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <span className={styles.metricLabel} style={{ color: '#22c55e', fontWeight: 'bold' }}>Consolidated Revenue</span>
          <span className={styles.metricValue} style={{ color: '#22c55e' }}>
            IDR {Number(totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className={styles.performanceRatesGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div className={styles.metricCard} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className={styles.metricLabel}>Click-Through Rate (CTR)</span>
          <span className={styles.metricValue} style={{ fontSize: '24px', color: '#3b82f6' }}>{ctr}%</span>
          <span className={styles.mutedText} style={{ fontSize: '12px' }}>Total Clicks / Total Views</span>
        </div>
        <div className={styles.metricCard} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className={styles.metricLabel}>Conversion Rate (CVR)</span>
          <span className={styles.metricValue} style={{ fontSize: '24px', color: '#a855f7' }}>{cvr}%</span>
          <span className={styles.mutedText} style={{ fontSize: '12px' }}>Total Conversions / Total Clicks</span>
        </div>
      </div>
    </div>
  );
}
