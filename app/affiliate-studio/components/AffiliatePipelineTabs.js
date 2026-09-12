'use client';

/**
 * AffiliatePipelineTabs
 * Workflow V2 Numbered Pipeline Navigation
 * Grouped into:
 * - Setup Area: Overview (🏢), Products (📦)
 * - Pipeline Stages (1-5): 1. Calendar → 2. Planner → 3. Production → 4. Publishing → 5. Performance
 */
export function AffiliatePipelineTabs({
  activeView = 'calendar',
  onNavigate,
  counts = {}
}) {
  const setupTabs = [
    { key: 'overview', label: 'Overview', icon: '🏢', count: counts.overviewCount },
    { key: 'products', label: 'Products', icon: '📦', count: counts.productsCount ? `${counts.productsCount} Ready` : null }
  ];

  const pipelineStages = [
    { step: 1, key: 'calendar', label: 'Content Calendar', badge: counts.draftSchedulesCount ? `${counts.draftSchedulesCount} Draft` : null },
    { step: 2, key: 'planner', label: 'Content Planner', badge: counts.plannerRowsCount ? `${counts.plannerRowsCount} Rows` : null },
    { step: 3, key: 'production', label: 'Production Workspace', badge: counts.productionRunsCount ? `${counts.productionRunsCount} Runs` : null },
    { step: 4, key: 'publishing', label: 'Publishing', badge: counts.publishingScheduledCount ? `${counts.publishingScheduledCount} Scheduled` : null },
    { step: 5, key: 'performance', label: 'Performance & Advisory', badge: counts.performanceGmvFormatted || null }
  ];

  return (
    <nav
      aria-label="Affiliate Studio Workflow Pipeline"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'var(--shadow-card, 0 4px 20px rgba(0,0,0,0.15))',
        flexWrap: 'wrap',
        gap: '8px'
      }}
    >
      {/* Setup Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {setupTabs.map(tab => {
          const isActive = activeView === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onNavigate?.(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid',
                borderColor: isActive ? 'var(--action-primary, #2dd4bf)' : 'transparent',
                background: isActive ? 'var(--action-primary-soft, rgba(45, 212, 191, 0.12))' : 'transparent',
                color: isActive ? 'var(--action-primary, #2dd4bf)' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count && (
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: 'var(--surface-interactive)',
                    color: 'var(--text-muted)'
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Nav Divider */}
      <div
        style={{
          width: '1px',
          height: '24px',
          background: 'var(--border-subtle)',
          margin: '0 4px'
        }}
      />

      {/* End-to-End Workflow Stages (1 - 5) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        {pipelineStages.map(stage => {
          const isActive = activeView === stage.key;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onNavigate?.(stage.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid',
                borderColor: isActive ? 'var(--action-primary, #2dd4bf)' : 'transparent',
                background: isActive ? 'var(--action-primary-soft, rgba(45, 212, 191, 0.12))' : 'transparent',
                color: isActive ? 'var(--action-primary, #2dd4bf)' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  background: isActive ? 'var(--action-primary, #2dd4bf)' : 'var(--surface-interactive)',
                  color: isActive ? 'var(--on-action-primary, #042f2e)' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 800
                }}
              >
                {stage.step}
              </span>
              <span>{stage.label}</span>
              {stage.badge && (
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: 'var(--surface-interactive)',
                    color: 'var(--text-muted)'
                  }}
                >
                  {stage.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
