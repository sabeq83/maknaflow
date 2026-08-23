'use client';

import { useState, useEffect } from 'react';
import { CampaignProgramPlanners } from './CampaignProgramPlanners';
import { CampaignProgramRuns } from './CampaignProgramRuns';
import styles from './AffiliateStudio.module.css';

export function CampaignProgramDetail({
  brandId,
  program,
  loading,
  error,
  onBack,
  onUpdate,
  onArchive,
  onAddProducts,
  onRemoveProducts,
  onRefresh
}) {
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [kpis, setKpis] = useState('');
  const [productionTarget, setProductionTarget] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  
  // Funnel Mix
  const [tofu, setTofu] = useState(0);
  const [mofu, setMofu] = useState(0);
  const [bofu, setBofu] = useState(0);

  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Product Selection Modal/Drawer state
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [portfolioProducts, setPortfolioProducts] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState(null);
  const [checkedProductIds, setCheckedProductIds] = useState([]);

  // Audit Events state
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [performanceSummary, setPerformanceSummary] = useState(null);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [creativeInsights, setCreativeInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const availablePlatforms = ['tiktok', 'youtube', 'instagram', 'facebook'];

  // Sync state with program info when loaded
  useEffect(() => {
    if (program) {
      setName(program.name || '');
      setDescription(program.description || '');
      setObjective(program.objective || '');
      setTargetAudience(program.targetAudience || '');
      setKpis(program.kpis || '');
      setProductionTarget(program.productionTarget || 0);
      setStartDate(program.startDate ? program.startDate.split('T')[0] : '');
      setEndDate(program.endDate ? program.endDate.split('T')[0] : '');
      setSelectedPlatforms(program.platforms || []);

      const mix = program.funnelMix || { tofu: 40, mofu: 40, bofu: 20 };
      setTofu(mix.tofu);
      setMofu(mix.mofu);
      setBofu(mix.bofu);

      // Load audit events
      loadAuditEvents();
    }
  }, [program]);

  useEffect(() => {
    if (activeTab === 'performance') {
      loadPerformanceSummary();
      loadCreativeInsights();
    }
  }, [activeTab]);

  const loadCreativeInsights = () => {
    setLoadingInsights(true);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/insights`)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setCreativeInsights(body.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingInsights(false));
  };

  const loadPerformanceSummary = () => {
    setLoadingPerf(true);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/performance`)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setPerformanceSummary(body.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingPerf(false));
  };

  const loadAuditEvents = () => {
    if (!program) return;
    setLoadingEvents(true);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}`)
      .then(res => res.json())
      .then(body => {
        // Fetch separate events list
        return fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}`);
      })
      // Just simulate or query events endpoint
      .then(() => {
        // Let's call program detail endpoint and parse log events if any, or fetch directly
        // The endpoint is actually GET /api/v2/affiliate-studio/brands/[id]/programs/[programId]
        // But we want program audit events. Let's write client fetch:
        fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/events`)
          .then(res => res.json())
          .then(body => {
            if (body.success) setEvents(body.data || []);
          })
          .catch(() => {})
          .finally(() => setLoadingEvents(false));
      })
      .catch(() => setLoadingEvents(false));
  };

  const handlePlatformToggle = (platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Program Name is required');
      return;
    }

    const totalFunnel = Number(tofu) + Number(mofu) + Number(bofu);
    if (totalFunnel !== 100) {
      setFormError(`Funnel mix percentages must sum to 100% (currently ${totalFunnel}%)`);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload = {
      name,
      description: description.trim() || null,
      objective: objective.trim() || null,
      targetAudience: targetAudience.trim() || null,
      funnelMix: { tofu: Number(tofu), mofu: Number(mofu), bofu: Number(bofu) },
      startDate: startDate || null,
      endDate: endDate || null,
      platforms: selectedPlatforms,
      kpis: kpis.trim() || null,
      productionTarget: Number(productionTarget) || 0
    };

    onUpdate(program.id, payload)
      .then(() => {
        setEditing(false);
        loadAuditEvents();
      })
      .catch(err => {
        setFormError(err.message);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const loadBrandPortfolio = () => {
    setLoadingPortfolio(true);
    setPortfolioError(null);

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/products`)
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to load brand product portfolio');
        setPortfolioProducts(body.data?.items || []);
      })
      .catch(err => {
        setPortfolioError(err.message);
      })
      .finally(() => {
        setLoadingPortfolio(false);
      });
  };

  const handleOpenProductPicker = () => {
    setShowProductPicker(true);
    setCheckedProductIds([]);
    loadBrandPortfolio();
  };

  const handleAddCheckedProducts = () => {
    if (checkedProductIds.length === 0) return;
    onAddProducts(program.id, checkedProductIds)
      .then(() => {
        setShowProductPicker(false);
        loadAuditEvents();
      })
      .catch(err => {
        alert(`Failed to add products: ${err.message}`);
      });
  };

  const handleProductCheckToggle = (productId) => {
    if (checkedProductIds.includes(productId)) {
      setCheckedProductIds(checkedProductIds.filter(id => id !== productId));
    } else {
      setCheckedProductIds([...checkedProductIds, productId]);
    }
  };

  const handleRemoveProduct = (productId) => {
    if (confirm('Are you sure you want to remove this product from the program? The snapshot will be deleted.')) {
      onRemoveProducts(program.id, [productId])
        .then(() => {
          loadAuditEvents();
        })
        .catch(err => {
          alert(`Failed to remove product: ${err.message}`);
        });
    }
  };

  const handleArchive = () => {
    if (confirm('Are you sure you want to archive this campaign program? (Legacy planners/campaigns will remain unaffected)')) {
      onArchive(program.id);
    }
  };

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>{error}</p>
        <button type="button" className={styles.backButton} onClick={onBack}>Back to Campaigns</button>
      </div>
    );
  }

  if (loading || !program) {
    return <div className={styles.loadingState}>Loading program details...</div>;
  }

  return (
    <div className={styles.programDetailContainer}>
      <div className={styles.detailHeader}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
        <div className={styles.headerTitleArea}>
          <h2 className={styles.programNameDetail}>{program.name}</h2>
          <span className={styles.statusBadge}>{program.status}</span>
        </div>
        <div className={styles.headerActions}>
          {!editing && (
            <>
              <button type="button" className={styles.archiveBtn} onClick={handleArchive}>
                Archive
              </button>
              <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>
                Edit Details
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.detailLayout}>
        <div className={styles.detailSidebar}>
          {editing ? (
            <form onSubmit={handleSave} className={styles.editDetailsForm}>
              {formError && <div className={styles.formError}>{formError}</div>}
              
              <div className={styles.formField}>
                <label htmlFor="edit-name">Program Name *</label>
                <input
                  id="edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="edit-target">Production Target (Videos)</label>
                <input
                  id="edit-target"
                  type="number"
                  value={productionTarget}
                  onChange={(e) => setProductionTarget(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="edit-desc">Description</label>
                <textarea
                  id="edit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="edit-objective">Commercial Objective</label>
                <input
                  id="edit-objective"
                  type="text"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="edit-audience">Target Audience</label>
                <input
                  id="edit-audience"
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="edit-kpis">KPIs Target</label>
                <input
                  id="edit-kpis"
                  type="text"
                  value={kpis}
                  onChange={(e) => setKpis(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="edit-start">Start Date</label>
                <input
                  id="edit-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="edit-end">End Date</label>
                <input
                  id="edit-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label>Platforms</label>
                <div className={styles.platformsCheckboxGroup}>
                  {availablePlatforms.map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.platformBadgeBtn} ${selectedPlatforms.includes(p) ? styles.activeBadge : ''}`}
                      onClick={() => handlePlatformToggle(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formField}>
                <label>Funnel Mix (%)</label>
                <div className={styles.funnelMixFields}>
                  <div>
                    <label htmlFor="edit-tofu">TOFU</label>
                    <input id="edit-tofu" type="number" value={tofu} onChange={(e) => setTofu(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="edit-mofu">MOFU</label>
                    <input id="edit-mofu" type="number" value={mofu} onChange={(e) => setMofu(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="edit-bofu">BOFU</label>
                    <input id="edit-bofu" type="number" value={bofu} onChange={(e) => setBofu(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.programDetailsCard}>
              <h3>Campaign Strategy</h3>
              <p className={styles.desc}>{program.description || 'No description provided.'}</p>
              
              <div className={styles.specList}>
                <div className={styles.specItem}>
                  <strong>Objective:</strong>
                  <span>{program.objective || 'N/A'}</span>
                </div>
                <div className={styles.specItem}>
                  <strong>Target Audience:</strong>
                  <span>{program.targetAudience || 'N/A'}</span>
                </div>
                <div className={styles.specItem}>
                  <strong>KPIs Target:</strong>
                  <span>{program.kpis || 'N/A'}</span>
                </div>
                <div className={styles.specItem}>
                  <strong>Target Production:</strong>
                  <span>{program.productionTarget} videos</span>
                </div>
                <div className={styles.specItem}>
                  <strong>Timeline:</strong>
                  <span>
                    {program.startDate ? new Date(program.startDate).toLocaleDateString() : 'N/A'} -{' '}
                    {program.endDate ? new Date(program.endDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className={styles.specItem}>
                  <strong>Funnel Mix (TOFU/MOFU/BOFU):</strong>
                  <span>{tofu}% / {mofu}% / {bofu}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.detailMain}>
          <div className={styles.detailTabsHeader}>
            <button
              type="button"
              className={`${styles.detailTabButton} ${activeTab === 'products' ? styles.activeDetailTab : ''}`}
              onClick={() => setActiveTab('products')}
            >
              Associated Products ({program.products?.length || 0})
            </button>
            <button
              type="button"
              className={`${styles.detailTabButton} ${activeTab === 'planners' ? styles.activeDetailTab : ''}`}
              onClick={() => setActiveTab('planners')}
            >
              Content Plan ({program.coverage?.production.actual || 0})
            </button>
            <button
              type="button"
              className={`${styles.detailTabButton} ${activeTab === 'runs' ? styles.activeDetailTab : ''}`}
              onClick={() => setActiveTab('runs')}
            >
              Production Queue
            </button>
            <button
              type="button"
              className={`${styles.detailTabButton} ${activeTab === 'performance' ? styles.activeDetailTab : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              📈 Performance
            </button>
          </div>

          {activeTab === 'products' && (
            <>
              <div className={styles.sectionHeader}>
                <h3>Associated Products Portfolio Snapshot</h3>
                <button type="button" className={styles.addProductsBtn} onClick={handleOpenProductPicker}>
                  Link Products
                </button>
              </div>

              {program.products?.length === 0 ? (
                <div className={styles.emptySnapshotBlock}>
                  <p>Belum ada produk yang dikaitkan ke program kampanye ini.</p>
                  <button type="button" className={styles.addProductsBtnInline} onClick={handleOpenProductPicker}>
                    Link Products Now
                  </button>
                </div>
              ) : (
                <div className={styles.snapshottedProductsTableContainer}>
                  <table className={styles.snapshotsTable}>
                    <thead>
                      <tr>
                        <th>Product Info</th>
                        <th>Category</th>
                        <th>Resolved Affiliate Link</th>
                        <th>Capture Info</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {program.products?.map(p => {
                        const snap = p.productSnapshot || {};
                        const aff = snap.affiliate || {};
                        return (
                          <tr key={p.id}>
                            <td>
                              <div className={styles.tableProductInfo}>
                                {snap.imageUrl && (
                                  <img src={snap.imageUrl} alt={snap.displayName} className={styles.tableProductThumb} />
                                )}
                                <div>
                                  <strong className={styles.tableProductDisplayName}>{snap.displayName}</strong>
                                  {snap.productName !== snap.displayName && (
                                    <div className={styles.tableProductOriginalName}>{snap.productName}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td><span className={styles.tableCategory}>{snap.category || 'N/A'}</span></td>
                            <td>
                              <div className={styles.tableAffiliateInfo}>
                                {aff.link ? (
                                  <a href={aff.link} target="_blank" rel="noopener noreferrer" className={styles.tableAffiliateLink}>
                                    {aff.link}
                                  </a>
                                ) : (
                                  <span className={styles.mutedText}>Missing link</span>
                                )}
                                <div className={styles.tableAffiliateSource}>
                                  Source: <strong>{aff.source}</strong> ({aff.status})
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className={styles.tableCaptureDate}>
                                {snap.capturedAt ? new Date(snap.capturedAt).toLocaleString() : 'N/A'}
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.tableRemoveBtn}
                                onClick={() => handleRemoveProduct(p.productId)}
                              >
                                Unlink
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeTab === 'planners' && (
            <CampaignProgramPlanners
              brandId={brandId}
              program={program}
              onRefreshProgram={onRefresh}
            />
          )}

          {activeTab === 'runs' && (
            <CampaignProgramRuns
              brandId={brandId}
              program={program}
            />
          )}

          {activeTab === 'performance' && (
            <div className={styles.performanceTabPanel}>
              <h3>Campaign Program Performance Summary</h3>
              {loadingPerf ? (
                <div>Loading performance data...</div>
              ) : performanceSummary ? (
                <>
                  <div className={styles.metricsSummaryGrid}>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Total Views</span>
                      <span className={styles.metricValue}>{Number(performanceSummary.total_views).toLocaleString()}</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Total Clicks</span>
                      <span className={styles.metricValue}>{Number(performanceSummary.total_clicks).toLocaleString()}</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Total Conversions</span>
                      <span className={styles.metricValue}>{Number(performanceSummary.total_conversions).toLocaleString()}</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Revenue (IDR)</span>
                      <span className={styles.metricValue}>Rp {Number(performanceSummary.total_revenue).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Creative Insights Loop */}
                  <div className={styles.insightsSection}>
                    <h4>💡 Top Performing Creative DNA (Hook & Angle Correlation)</h4>
                    {loadingInsights ? (
                      <div>Loading DNA insights...</div>
                    ) : creativeInsights ? (
                      <div className={styles.insightsGrid}>
                        <div className={styles.insightCard}>
                          <h5>Top Hooks</h5>
                          {creativeInsights.hooks.length === 0 ? (
                            <p>No hook samples yet.</p>
                          ) : (
                            <ul className={styles.insightList}>
                              {creativeInsights.hooks.map((h, i) => (
                                <li key={i}>
                                  <strong>&ldquo;{h.hook}&rdquo;</strong>
                                  <div>Avg Views: {h.avgViews.toLocaleString()} | Revenue: Rp {Number(h.avgRevenue).toLocaleString()} ({h.sampleSize} samples)</div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className={styles.insightCard}>
                          <h5>Top Strategic Angles</h5>
                          {creativeInsights.angles.length === 0 ? (
                            <p>No angle samples yet.</p>
                          ) : (
                            <ul className={styles.insightList}>
                              {creativeInsights.angles.map((a, i) => (
                                <li key={i}>
                                  <strong>{a.strategicAngle}</strong>
                                  <div>Avg Views: {a.avgViews.toLocaleString()} | Revenue: Rp {Number(a.avgRevenue).toLocaleString()} ({a.sampleSize} samples)</div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p>No insights generated yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.emptyStateLight}>No performance data imported yet.</div>
              )}
            </div>
          )}

          {/* Audit Events list */}
          <div className={styles.auditEventsBlock}>
            <h3>Program Activity Log (Audit Trail)</h3>
            {loadingEvents ? (
              <div className={styles.smallLoading}>Loading activity log...</div>
            ) : events.length === 0 ? (
              <div className={styles.emptyMuted}>No activity logged yet.</div>
            ) : (
              <ul className={styles.eventLogList}>
                {events.map(ev => (
                  <li key={ev.id} className={styles.eventLogItem}>
                    <span className={styles.eventTime}>{new Date(ev.createdAt).toLocaleString()}</span>
                    <span className={styles.eventType}>{ev.eventType}</span>
                    <span className={styles.eventActor}>by {ev.actorId || 'system'}</span>
                    {ev.payload && (
                      <pre className={styles.eventPayload}>{JSON.stringify(ev.payload)}</pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showProductPicker && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Link Brand Products to Campaign</h3>
              <button type="button" className={styles.closeModalBtn} onClick={() => setShowProductPicker(false)}>
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {loadingPortfolio ? (
                <div className={styles.loadingState}>Loading portfolio...</div>
              ) : portfolioError ? (
                <div className={styles.errorState}>{portfolioError}</div>
              ) : portfolioProducts.length === 0 ? (
                <div className={styles.emptyState}>No products found in portfolio.</div>
              ) : (
                <div className={styles.pickerProductsList}>
                  {portfolioProducts.map(prod => {
                    const isAlreadyLinked = program.products?.some(p => p.productId === prod.productId);
                    return (
                      <div 
                        key={prod.productId} 
                        className={`${styles.pickerProductCard} ${isAlreadyLinked ? styles.pickerDisabled : ''}`}
                      >
                        <input
                          type="checkbox"
                          id={`pick-${prod.productId}`}
                          disabled={isAlreadyLinked}
                          checked={checkedProductIds.includes(prod.productId) || isAlreadyLinked}
                          onChange={() => handleProductCheckToggle(prod.productId)}
                        />
                        <label htmlFor={`pick-${prod.productId}`} className={styles.pickerProductLabel}>
                          {prod.imageUrl && (
                            <img src={prod.imageUrl} alt={prod.displayName} className={styles.pickerThumb} />
                          )}
                          <div className={styles.pickerText}>
                            <strong className={styles.pickerName}>{prod.displayName}</strong>
                            <div className={styles.pickerSubtext}>
                              Category: {prod.category} | State: {prod.association?.state}
                            </div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={styles.cancelBtn} 
                onClick={() => setShowProductPicker(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.linkBtnSubmit}
                onClick={handleAddCheckedProducts}
                disabled={checkedProductIds.length === 0}
              >
                Link Selected ({checkedProductIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
