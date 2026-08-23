import styles from './AffiliateStudio.module.css';

export function AffiliateStudioShell({ brands = [], activeBrand, activeView = 'overview', onBrandChange, onNavigate, children }) {
  const tabs = [
    { key: 'overview', label: 'Overview', enabled: true },
    { key: 'products', label: 'Products', enabled: true },
    { key: 'campaigns', label: 'Campaigns', enabled: true },
    { key: 'planner', label: 'Planner', enabled: false },
    { key: 'production', label: 'Production', enabled: false },
    { key: 'publishing', label: 'Publishing', enabled: false },
    { key: 'performance', label: 'Performance', enabled: false }
  ];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <span>Affiliate Studio</span>
          <span className={styles.divider}>/</span>
          <span className={styles.activeLabel}>{activeBrand?.name || 'Loading'}</span>
          <span className={styles.divider}>/</span>
          <span className={styles.activeSubLabel}>
            {activeView === 'products' ? 'Products' : activeView === 'campaigns' ? 'Campaigns' : 'Overview'}
          </span>
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
            key={t.key}
            disabled={!t.enabled}
            onClick={() => t.enabled && onNavigate && onNavigate(t.key)}
            className={`${styles.navTab} ${!t.enabled ? styles.navTabDisabled : (activeView === t.key ? styles.navTabActive : '')}`}
            aria-current={activeView === t.key ? 'page' : undefined}
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
