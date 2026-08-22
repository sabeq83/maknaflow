import styles from './YouTubeStudioWorkspace.module.css';

export function AnalyticsPlaceholder() {
  return (
    <div className={styles.analyticsPlaceholder}>
      <div className={styles.sectionHeader}>
        <h2>YouTube Analytics</h2>
        <p className={styles.sectionDesc}>Performance insights, retention metrics, and A/B test experiments.</p>
      </div>

      <div className={styles.emptyState} style={{ borderStyle: 'dashed', paddingBlock: '60px' }}>
        <span className={styles.emptyIcon} style={{ fontSize: '3rem' }}>📈</span>
        <h3>Analytics Dashboard — Coming Next</h3>
        <p style={{ maxWidth: '480px', marginInline: 'auto' }}>
          Real-time watch duration, traffic sources, audience retention curves, and monetization readiness metrics will be integrated directly via the YouTube API in future phases.
        </p>
      </div>
    </div>
  );
}
