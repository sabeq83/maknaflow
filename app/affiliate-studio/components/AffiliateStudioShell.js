import { AffiliatePipelineTabs } from './AffiliatePipelineTabs';
import styles from './AffiliateStudio.module.css';

export function AffiliateStudioShell({
  brands = [],
  activeBrand,
  activeView = 'calendar',
  onBrandChange,
  onNavigate,
  counts = {},
  children
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.breadcrumb}>
          <span>Affiliate Studio</span>
          <span className={styles.divider}>/</span>
          <span className={styles.activeLabel}>{activeBrand?.name || 'Loading'}</span>
          <span className={styles.divider}>/</span>
          <span className={styles.activeSubLabel}>
            {activeView.charAt(0).toUpperCase() + activeView.slice(1)}
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

      <AffiliatePipelineTabs
        activeView={activeView}
        onNavigate={onNavigate}
        counts={counts}
      />

      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
