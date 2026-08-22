import styles from './YouTubeStudioWorkspace.module.css';

export function PublishingHub({ episodes, onOpenEpisode }) {
  const publishingStatuses = [
    'Ready to Publish',
    'Uploaded'
  ];

  const publishableItems = episodes.filter(ep => publishingStatuses.includes(ep.status));

  return (
    <div className={styles.publishingHub}>
      <div className={styles.sectionHeader}>
        <h2>Publishing Hub</h2>
        <p className={styles.sectionDesc}>Manage metadata packages, schedules, and draft uploads for fully rendered videos.</p>
      </div>

      {publishableItems.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📤</span>
          <h3>No Rendered Videos Ready</h3>
          <p>Episodes appear here once their final video render is successfully compiled in the workspace review stage.</p>
        </div>
      ) : (
        <div className={styles.queueContainer}>
          <table className={styles.queueTable} role="grid">
            <thead>
              <tr role="row">
                <th role="columnheader">Episode Title</th>
                <th role="columnheader">Target Duration</th>
                <th role="columnheader">Publish Status</th>
                <th role="columnheader" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {publishableItems.map((item) => (
                <tr key={item.id} role="row" className={styles.queueRow}>
                  <td role="gridcell" className={styles.queueTitleCell}>
                    <strong>{item.title}</strong>
                    <span className={styles.queueSubText}>Locale: {item.locale}</span>
                  </td>
                  <td role="gridcell" style={{ fontFamily: 'var(--font-mono)' }}>
                    {item.target_duration_seconds}s
                  </td>
                  <td role="gridcell">
                    <span className={styles.badge} style={{ 
                      background: 'var(--status-success-soft)', 
                      color: 'var(--status-success)',
                      border: '1px solid var(--status-success)'
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td role="gridcell" style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenEpisode(item)}
                    >
                      Open Workspace →
                    </button>
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
