import styles from './YouTubeStudioWorkspace.module.css';

export function ProductionQueue({ episodes, onOpenEpisode }) {
  // Filters for active production episodes
  const productionStatuses = [
    'Researching',
    'Blueprint Draft',
    'Blueprint Approved',
    'Script Draft',
    'Script Approved',
    'In Production',
    'Rendering'
  ];
  
  const activeItems = episodes.filter(ep => productionStatuses.includes(ep.status));

  return (
    <div className={styles.productionQueue}>
      <div className={styles.sectionHeader}>
        <h2>Production Queue</h2>
        <p className={styles.sectionDesc}>Cross-episode overview of all items currently under editorial planning or video asset compilation.</p>
      </div>

      {activeItems.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🎬</span>
          <h3>No Active Production Jobs</h3>
          <p>Go to your Content Series, select or plan an episode, and start AI Research to begin the workflow.</p>
        </div>
      ) : (
        <div className={styles.queueContainer}>
          <table className={styles.queueTable} role="grid">
            <thead>
              <tr role="row">
                <th role="columnheader">Episode Title</th>
                <th role="columnheader">Target Duration</th>
                <th role="columnheader">Current Status</th>
                <th role="columnheader" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map((item) => (
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
                      background: 'var(--status-info-soft)', 
                      color: 'var(--status-info)',
                      border: '1px solid var(--status-info)'
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
