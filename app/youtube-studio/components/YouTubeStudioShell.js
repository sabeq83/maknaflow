import styles from './YouTubeStudioWorkspace.module.css';

export function YouTubeStudioShell({ activeView, selectedChannel, selectedSeries, selectedEpisode, onNavigate, children }) {
  const renderBreadcrumbs = () => {
    const crumbs = [];
    crumbs.push(
      <span key="root" className={styles.breadcrumbLink} onClick={() => onNavigate('channels')}>
        YouTube Studio
      </span>
    );

    if (selectedChannel && ['channel', 'series', 'episode'].includes(activeView)) {
      crumbs.push(<span key="sep1" className={styles.breadcrumbSeparator}>/</span>);
      crumbs.push(
        <span key="channel" className={styles.breadcrumbLink} onClick={() => onNavigate('channel', selectedChannel.id)}>
          {selectedChannel.name}
        </span>
      );
    }

    if (selectedSeries && ['series', 'episode'].includes(activeView)) {
      crumbs.push(<span key="sep2" className={styles.breadcrumbSeparator}>/</span>);
      crumbs.push(
        <span key="series" className={styles.breadcrumbLink} onClick={() => onNavigate('series', selectedChannel.id, selectedSeries.id)}>
          {selectedSeries.name}
        </span>
      );
    }

    if (selectedEpisode && activeView === 'episode') {
      crumbs.push(<span key="sep3" className={styles.breadcrumbSeparator}>/</span>);
      crumbs.push(
        <span key="episode" className={styles.breadcrumbCurrent}>
          {selectedEpisode.title}
        </span>
      );
    }

    return <div className={styles.breadcrumbs}>{crumbs}</div>;
  };

  return (
    <div className={styles.shell}>
      <header className={styles.shellHeader}>
        {renderBreadcrumbs()}
        {selectedChannel && (
          <div className={styles.headerActiveChannel}>
            Active Channel: <strong>{selectedChannel.name}</strong>
          </div>
        )}
      </header>

      <nav className={styles.localNavigation} aria-label="YouTube Studio Navigation">
        <button
          type="button"
          className={`${styles.navTab} ${['channels', 'channel', 'series', 'episode'].includes(activeView) ? styles.navTabActive : ''}`}
          onClick={() => onNavigate('channels')}
        >
          Channels
        </button>
        <button
          type="button"
          className={`${styles.navTab} ${activeView === 'production' ? styles.navTabActive : ''}`}
          onClick={() => onNavigate('production')}
        >
          Production Queue
        </button>
        <button
          type="button"
          className={`${styles.navTab} ${activeView === 'publishing' ? styles.navTabActive : ''}`}
          onClick={() => onNavigate('publishing')}
        >
          Publishing Hub
        </button>
        <button
          type="button"
          className={`${styles.navTab} ${activeView === 'analytics' ? styles.navTabActive : ''}`}
          onClick={() => onNavigate('analytics')}
        >
          Analytics
        </button>
      </nav>

      <main className={styles.viewContent}>{children}</main>
    </div>
  );
}
