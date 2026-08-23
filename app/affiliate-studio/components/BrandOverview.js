import Link from 'next/link';
import styles from './AffiliateStudio.module.css';

export function BrandOverview({ overview, loading, error, onRefresh }) {
  if (loading && !overview) {
    return <div className={styles.loadingState}>Loading brand overview data...</div>;
  }

  if (error) {
    return (
      <div className={styles.overviewError}>
        <p>Gagal memuat overview: {error}</p>
        <button onClick={onRefresh} className={styles.btnSecondary}>Refresh</button>
      </div>
    );
  }

  if (!overview) return null;

  const { brand, summaries, sources, generatedAt, partial, warnings, links } = overview;

  return (
    <div className={styles.overviewContainer}>
      {loading && <div className={styles.refreshingOverlay}>Refreshing...</div>}
      
      <div className={styles.overviewHeaderRow}>
        <div className={styles.timestamp}>
          Generated at: {new Date(generatedAt).toLocaleString()} | Freshness: live
        </div>
        <button onClick={onRefresh} disabled={loading} className={styles.btnSecondary}>
          🔄 Refresh
        </button>
      </div>

      {partial && (
        <div className={styles.partialWarning}>
          <strong>⚠️ Partial Data Warning:</strong> Beberapa modul eksternal gagal dimuat. Angka bertanda *Unavailable* mungkin tidak akurat atau tidak lengkap.
          <ul className={styles.warningList}>
            {warnings.map((w, idx) => (
              <li key={idx}>[{w.code}] {w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Brand Profile Details */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionCardHeader}>
          <h3>🧬 Brand DNA Guideline</h3>
          <Link href={links.brandProfiles} className={styles.deepLink}>Manage Profiles ↗</Link>
        </div>
        <div className={styles.brandGrid}>
          <div className={styles.dnaItem}>
            <strong>Tone of Voice:</strong>
            <p>{brand.toneOfVoice || 'Not specified'}</p>
          </div>
          <div className={styles.dnaItem}>
            <strong>Visual Signature:</strong>
            <p>{brand.visualSignature || 'Not specified'}</p>
          </div>
          <div className={styles.dnaItem}>
            <strong>Content Strategy & Goal:</strong>
            <p>{brand.contentGoal || 'Not specified'}</p>
          </div>
          <div className={styles.dnaItem}>
            <strong>Content Pillars:</strong>
            <div className={styles.pillarsContainer}>
              {brand.contentPillars.length > 0 ? brand.contentPillars.map((p, idx) => (
                <span key={idx} className={styles.pillarTag}>{p}</span>
              )) : <span className={styles.noPillar}>No pillars configured</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Database Projections */}
      <div className={styles.summariesGrid}>
        
        {/* Products */}
        <div className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <h4>📦 Products Portfolio</h4>
            <Link href={links.products} className={styles.deepLink}>Database ↗</Link>
          </div>
          <div className={styles.cardContent}>
            {summaries.products ? (
              <div className={styles.metrics}>
                <div className={styles.metricItem}>
                  <span className={styles.metricVal}>{summaries.products.linked}</span>
                  <span className={styles.metricLabel}>Linked Products</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricVal}>{summaries.products.active}</span>
                  <span className={styles.metricLabel}>Active</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={`${styles.metricVal} ${summaries.products.missingAffiliateLink > 0 ? styles.alertMetric : ''}`}>
                    {summaries.products.missingAffiliateLink}
                  </span>
                  <span className={styles.metricLabel}>Missing Link</span>
                </div>
              </div>
            ) : (
              <div className={styles.metricUnavailable}>Unavailable</div>
            )}
            <div className={styles.sourceTag}>source: brand_products (active association)</div>
          </div>
        </div>

        {/* Content Planners */}
        <div className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <h4>🗓️ Content Planners</h4>
            <Link href={links.contentPlanner} className={styles.deepLink}>Editorial ↗</Link>
          </div>
          <div className={styles.cardContent}>
            {summaries.planners ? (
              <div className={styles.metrics}>
                <div className={styles.metricItem}>
                  <span className={styles.metricVal}>{summaries.planners.total}</span>
                  <span className={styles.metricLabel}>Total Planners</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricVal}>{summaries.planners.rows}</span>
                  <span className={styles.metricLabel}>Total Rows</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricVal}>{summaries.planners.draft}</span>
                  <span className={styles.metricLabel}>Draft</span>
                </div>
              </div>
            ) : (
              <div className={styles.metricUnavailable}>Unavailable</div>
            )}
            <div className={styles.sourceTag}>source: content_planners (distinct match)</div>
          </div>
        </div>

        {/* Campaign Programs */}
        <div className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <h4>🎬 Production Campaigns</h4>
            <div className={styles.engineTabs}>
              <Link href={links.reCampaigns} className={styles.engineLink}>RE ↗</Link>
              <Link href={links.pillarCampaigns} className={styles.engineLink}>Pillar ↗</Link>
              <Link href={links.recipeLabs} className={styles.engineLink}>Recipe ↗</Link>
            </div>
          </div>
          <div className={styles.cardContent}>
            {summaries.campaigns ? (
              <div>
                <div className={styles.metrics}>
                  <div className={styles.metricItem}>
                    <span className={styles.metricVal}>{summaries.campaigns.total}</span>
                    <span className={styles.metricLabel}>Total</span>
                  </div>
                  <div className={styles.metricItem}>
                    <span className={styles.metricVal}>{summaries.campaigns.active}</span>
                    <span className={styles.metricLabel}>Active</span>
                  </div>
                  <div className={styles.metricItem}>
                    <span className={styles.metricVal}>{summaries.campaigns.completed}</span>
                    <span className={styles.metricLabel}>Completed</span>
                  </div>
                </div>
                <div className={styles.engineSplit}>
                  <span>RE: {summaries.campaigns.byEngine?.re || 0}</span> | 
                  <span> Pillar: {summaries.campaigns.byEngine?.pillar || 0}</span> | 
                  <span> Recipe: {summaries.campaigns.byEngine?.recipe || 0}</span>
                </div>
              </div>
            ) : (
              <div className={styles.metricUnavailable}>Unavailable</div>
            )}
            <div className={styles.sourceTag}>coverage: RE, OPC, Recipe (partial coverage)</div>
          </div>
        </div>

        {/* ContentFlow Hub */}
        <div className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <h4>📊 ContentFlow Assets</h4>
            <Link href={links.contentFlow} className={styles.deepLink}>Hub ↗</Link>
          </div>
          <div className={styles.cardContent}>
            {summaries.contentFlow ? (
              <div className={styles.metrics}>
                <div className={styles.metricItem}>
                  <span className={styles.metricVal}>{summaries.contentFlow.total}</span>
                  <span className={styles.metricLabel}>Total Assets</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricVal}>{summaries.contentFlow.ready}</span>
                  <span className={styles.metricLabel}>Ready</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricVal}>{summaries.contentFlow.publishedAny}</span>
                  <span className={styles.metricLabel}>Published</span>
                </div>
              </div>
            ) : (
              <div className={styles.metricUnavailable}>Unavailable</div>
            )}
            <div className={styles.sourceTag}>source: content_flow_items (precedence match)</div>
          </div>
        </div>

      </div>
    </div>
  );
}
