import styles from './AffiliateStudio.module.css';

export function AffiliateStudioShell({ brands = [], activeBrand, onBrandChange, children }) {
  const tabs = [
    { label: 'Overview', enabled: true },
    { label: 'Products', enabled: false },
    { label: 'Campaigns', enabled: false },
    { label: 'Planner', enabled: false },
    { label: 'Production', enabled: false },
    { label: 'Publishing', enabled: false },
    { label: 'Performance', enabled: false }
  ];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <span>Affiliate Studio</span>
          <span className={styles.divider}>/</span>
          <span className={styles.activeLabel}>{activeBrand?.name || 'Loading'}</span>
          <span className={styles.divider}>/</span>
          <span className={styles.activeSubLabel}>Overview</span>
        </div>
        
        <div className={styles.brandSelectorContainer}>
          <label htmlFor="brand-switcher" className={styles.switcherLabel}>Active Brand Profile:</label>
          <select
            id="brand-switcher"
            value={activeBrand?.id || ''}
            onChange={(e) => onBrandChange(e.target.value)}
            className={styles.brandSelector}
          >
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </header>

      <nav className={styles.localNavigation} aria-label="Affiliate Studio Navigation">
        {tabs.map(t => (
          <button
            key={t.label}
            disabled={!t.enabled}
            className={`${styles.navTab} ${t.enabled ? styles.navTabActive : styles.navTabDisabled}`}
            title={!t.enabled ? `${t.label} module is coming soon in later phases` : ''}
          >
            {t.label} {!t.enabled && <span className={styles.badge}>Later</span>}
          </button>
        ))}
      </nav>

      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
