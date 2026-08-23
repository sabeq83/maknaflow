'use client';

import { useState, useEffect } from 'react';
import styles from './AffiliateStudio.module.css';

export function CampaignProgramPlanners({
  brandId,
  program,
  onRefreshProgram
}) {
  const [plannersData, setPlannersData] = useState({ linked: [], available: [] });
  const [loadingPlanners, setLoadingPlanners] = useState(false);
  const [plannersError, setPlannersError] = useState(null);

  // Link/Unlink states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedPlannerId, setSelectedPlannerId] = useState('');
  const [linking, setLinking] = useState(false);

  // Row Config states
  const [activePlannerRows, setActivePlannerRows] = useState(null);
  const [activePlannerId, setActivePlannerId] = useState(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState(null);
  const [savingRowId, setSavingRowId] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);

  useEffect(() => {
    loadPlanners();
  }, [program.id]);

  const loadPlanners = () => {
    setLoadingPlanners(true);
    setPlannersError(null);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/planners`)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setPlannersData(body.data || { linked: [], available: [] });
        } else {
          throw new Error(body.error || 'Failed to fetch planners connection');
        }
      })
      .catch(err => {
        setPlannersError(err.message);
      })
      .finally(() => {
        setLoadingPlanners(false);
      });
  };

  const handleLinkPlanner = (e) => {
    e.preventDefault();
    if (!selectedPlannerId) return;

    setLinking(true);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/planners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plannerId: selectedPlannerId })
    })
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setShowLinkModal(false);
          setSelectedPlannerId('');
          loadPlanners();
          onRefreshProgram();
        } else {
          throw new Error(body.error || 'Failed to link planner');
        }
      })
      .catch(err => {
        alert(err.message);
      })
      .finally(() => {
        setLinking(false);
      });
  };

  const handleUnlinkPlanner = (plannerId) => {
    if (!confirm('Are you sure you want to unlink this planner? Row mappings will be cleared, but the original planner remains untouched.')) {
      return;
    }

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/planners/${plannerId}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          if (activePlannerId === plannerId) {
            setActivePlannerRows(null);
            setActivePlannerId(null);
          }
          loadPlanners();
          onRefreshProgram();
        } else {
          throw new Error(body.error || 'Failed to unlink planner');
        }
      })
      .catch(err => {
        alert(err.message);
      });
  };

  const handleOpenRowConfig = (plannerId) => {
    setActivePlannerId(plannerId);
    setLoadingRows(true);
    setRowsError(null);

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/planners/${plannerId}/rows`)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setActivePlannerRows(body.data || []);
        } else {
          throw new Error(body.error || 'Failed to load planner rows');
        }
      })
      .catch(err => {
        setRowsError(err.message);
      })
      .finally(() => {
        setLoadingRows(false);
      });
  };

  const handleSaveRowConfig = (rowId, programProductId, funnelStage, scheduledDate) => {
    setSavingRowId(rowId);
    
    const payload = {
      rowId,
      programProductId: programProductId || null,
      funnelStage: funnelStage || null,
      metadata: { scheduled_date: scheduledDate || null }
    };

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/planners/${activePlannerId}/rows`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          // Update local rows state
          setActivePlannerRows(prev =>
            prev.map(r => r.id === rowId ? { ...r, programProductId, funnelStage, metadata: { scheduled_date: scheduledDate } } : r)
          );
          onRefreshProgram();
        } else {
          throw new Error(body.error || 'Failed to save row linkage');
        }
      })
      .catch(err => {
        alert(err.message);
      })
      .finally(() => {
        setSavingRowId(null);
      });
  };

  const handleLaunchCampaign = (rowId, engineType) => {
    if (!confirm(`Are you sure you want to launch the ${engineType.toUpperCase()} campaign engine for this planner row?`)) {
      return;
    }

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/runs/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plannerId: activePlannerId,
        rowId,
        engineType
      })
    })
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          alert('Campaign launched successfully and registered in production runs.');
          onRefreshProgram();
        } else {
          throw new Error(body.error || 'Failed to launch campaign');
        }
      })
      .catch(err => alert(err.message));
  };

  const handleGetRecommendation = (rowId) => {
    setLoadingRec(true);
    setRecommendation(null);
    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${program.id}/runs/recommend?plannerId=${activePlannerId}&rowId=${rowId}`)
      .then(res => res.json())
      .then(body => {
        if (body.success) {
          setRecommendation(body.data);
          const sel = document.getElementById(`engine-select-${rowId}`);
          if (sel) sel.value = body.data.recommendedEngine;
        } else {
          throw new Error(body.error || 'Failed to get recommendation');
        }
      })
      .catch(err => alert(err.message))
      .finally(() => setLoadingRec(false));
  };

  const coverage = program.coverage || {
    production: { target: 0, actual: 0, progressPercent: 0 },
    funnel: { target: { tofu: 40, mofu: 40, bofu: 20 }, actual: { tofu: 0, mofu: 0, bofu: 0 } },
    products: { total: 0, linked: 0, progressPercent: 0 },
    platforms: { targets: [], actuals: {} }
  };

  const calendarEvents = program.calendar || [];

  return (
    <div className={styles.plannerConnectionWrapper}>
      {/* Coverage summary widgets */}
      <div className={styles.coverageGrid}>
        <div className={styles.coverageCard}>
          <h4>Production Progress</h4>
          <div className={styles.progressContainer}>
            <div className={styles.progressLabel}>
              <span>{coverage.production.actual} / {coverage.production.target} Videos</span>
              <span>{coverage.production.progressPercent}%</span>
            </div>
            <div className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${coverage.production.progressPercent}%` }} 
              />
            </div>
          </div>
        </div>

        <div className={styles.coverageCard}>
          <h4>Associated Products Coverage</h4>
          <div className={styles.progressContainer}>
            <div className={styles.progressLabel}>
              <span>{coverage.products.linked} / {coverage.products.total} Products Linked</span>
              <span>{coverage.products.progressPercent}%</span>
            </div>
            <div className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${coverage.products.progressPercent}%` }} 
              />
            </div>
          </div>
        </div>

        <div className={styles.coverageCard}>
          <h4>Funnel Mix Coverage</h4>
          <div className={styles.funnelMixBars}>
            <div className={styles.funnelBarRow}>
              <span>TOFU</span>
              <div className={styles.funnelSplitBar}>
                <span className={styles.splitTarget}>Target: {coverage.funnel.target.tofu}%</span>
                <span className={styles.splitActual}>Actual: {coverage.funnel.actual.tofu}%</span>
              </div>
            </div>
            <div className={styles.funnelBarRow}>
              <span>MOFU</span>
              <div className={styles.funnelSplitBar}>
                <span className={styles.splitTarget}>Target: {coverage.funnel.target.mofu}%</span>
                <span className={styles.splitActual}>Actual: {coverage.funnel.actual.mofu}%</span>
              </div>
            </div>
            <div className={styles.funnelBarRow}>
              <span>BOFU</span>
              <div className={styles.funnelSplitBar}>
                <span className={styles.splitTarget}>Target: {coverage.funnel.target.bofu}%</span>
                <span className={styles.splitActual}>Actual: {coverage.funnel.actual.bofu}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.plannerMainLayout}>
        <div className={styles.plannerListBlock}>
          <div className={styles.blockHeader}>
            <h3>Connected Editorial Planners</h3>
            <button 
              type="button" 
              className={styles.addPlannerBtn}
              onClick={() => setShowLinkModal(true)}
            >
              Link Content Planner
            </button>
          </div>

          {loadingPlanners && <div className={styles.smallLoading}>Loading planners...</div>}
          {plannersError && <div className={styles.errorState}>{plannersError}</div>}
          
          {!loadingPlanners && plannersData.linked.length === 0 && (
            <div className={styles.emptyStateLight}>
              <p>Belum ada Content Planner yang dihubungkan ke program ini.</p>
            </div>
          )}

          {!loadingPlanners && plannersData.linked.length > 0 && (
            <div className={styles.linkedPlannersList}>
              {plannersData.linked.map(p => (
                <div 
                  key={p.id} 
                  className={`${styles.plannerLinkCard} ${activePlannerId === p.id ? styles.activePlannerCard : ''}`}
                >
                  <div className={styles.plannerLinkCardHeader}>
                    <h4>{p.title}</h4>
                    <span className={styles.plannerStatus}>{p.status}</span>
                  </div>
                  <div className={styles.plannerMetrics}>
                    <span>Rows Linked: <strong>{p.linkedRows} / {p.totalRows}</strong></span>
                    <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className={styles.plannerCardActions}>
                    <a 
                      href={`/content-planner/${p.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.openPlannerBtn}
                    >
                      Open Editor ↗
                    </a>
                    <button 
                      type="button" 
                      className={styles.unlinkBtn}
                      onClick={() => handleUnlinkPlanner(p.id)}
                    >
                      Unlink
                    </button>
                    <button 
                      type="button" 
                      className={styles.manageRowsBtn}
                      onClick={() => handleOpenRowConfig(p.id)}
                    >
                      Map Rows & Funnel →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Calendar Display */}
          <div className={styles.calendarSection}>
            <h3>Brand Coverage Calendar Events</h3>
            {calendarEvents.length === 0 ? (
              <div className={styles.emptyStateLight}>No scheduled posts mapped. Map rows with post dates.</div>
            ) : (
              <div className={styles.calendarGridList}>
                {calendarEvents.map(ev => (
                  <div key={ev.id} className={styles.calendarEventCard}>
                    <div className={styles.eventCardHeader}>
                      <span className={styles.eventDate}>{new Date(ev.date).toLocaleDateString()}</span>
                      <span className={`${styles.eventFunnelBadge} ${styles['funnel_' + ev.funnelStage]}`}>{ev.funnelStage}</span>
                    </div>
                    <div className={styles.eventTitle}>{ev.title}</div>
                    <div className={styles.eventCategory}>Pillar: <strong>{ev.pillar}</strong> | Category: {ev.category}</div>
                    <div className={styles.eventProduct}>Product Focus: <strong>{ev.product}</strong></div>
                    <div className={styles.eventPlatformBadge}>Plat: {ev.platform}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row mapping sidebar/panel */}
        <div className={styles.plannerRowMappingBlock}>
          <h3>Row Mappings Configuration</h3>
          {!activePlannerId ? (
            <div className={styles.selectPlannerPrompt}>
              <p>Pilih "Map Rows & Funnel" pada salah satu planner di samping untuk mulai memetakan baris editorial ke program kampanye.</p>
            </div>
          ) : loadingRows ? (
            <div className={styles.smallLoading}>Loading planner rows...</div>
          ) : rowsError ? (
            <div className={styles.errorState}>{rowsError}</div>
          ) : activePlannerRows.length === 0 ? (
            <div className={styles.emptyStateLight}>No rows in this content planner.</div>
          ) : (
            <div className={styles.plannerRowsList}>
              {activePlannerRows.map(r => (
                <div key={r.id} className={styles.rowMappingCard}>
                  <div className={styles.rowInfoTop}>
                    <strong>Row {r.sequence} - {r.pillar}</strong>
                    <span>{r.categoryCep}</span>
                  </div>
                  <p className={styles.rowContext}>"{r.context}"</p>
                  
                  <div className={styles.mappingFields}>
                    <div className={styles.mapField}>
                      <label htmlFor={`prod-select-${r.id}`}>Target Product:</label>
                      <select
                        id={`prod-select-${r.id}`}
                        value={r.programProductId || ''}
                        onChange={(e) => handleSaveRowConfig(r.id, e.target.value, r.funnelStage, r.metadata?.scheduled_date)}
                        disabled={savingRowId === r.id}
                      >
                        <option value="">-- No Product Associated --</option>
                        {program.products?.map(p => (
                          <option key={p.id} value={p.id}>{p.productSnapshot.displayName}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.mapField}>
                      <label htmlFor={`funnel-select-${r.id}`}>Funnel Stage:</label>
                      <select
                        id={`funnel-select-${r.id}`}
                        value={r.funnelStage || ''}
                        onChange={(e) => handleSaveRowConfig(r.id, r.programProductId, e.target.value, r.metadata?.scheduled_date)}
                        disabled={savingRowId === r.id}
                      >
                        <option value="">-- No Stage --</option>
                        <option value="TOFU">TOFU (Awareness)</option>
                        <option value="MOFU">MOFU (Consideration)</option>
                        <option value="BOFU">BOFU (Conversion)</option>
                      </select>
                    </div>

                    <div className={styles.mapField}>
                      <label htmlFor={`date-input-${r.id}`}>Post Date:</label>
                      <input
                        id={`date-input-${r.id}`}
                        type="date"
                        value={r.metadata?.scheduled_date || ''}
                        onChange={(e) => handleSaveRowConfig(r.id, r.programProductId, r.funnelStage, e.target.value)}
                        disabled={savingRowId === r.id}
                      />
                    </div>
                  </div>

                  <div className={styles.launchAreaRow}>
                    <button
                      type="button"
                      className={styles.recommendBtn}
                      onClick={() => handleGetRecommendation(r.id)}
                      disabled={!r.programProductId || loadingRec}
                    >
                      {loadingRec ? 'Analyzing...' : '💡 Recommend'}
                    </button>
                    <select
                      id={`engine-select-${r.id}`}
                      defaultValue="re"
                      className={styles.engineSelectInline}
                    >
                      <option value="re">RE Campaign</option>
                      <option value="pillar">Pillar Campaign</option>
                      <option value="recipe">Recipe Labs</option>
                      <option value="multiplier">Multiplier Lab</option>
                      <option value="instant">Instant Factory</option>
                      <option value="bridge">Product Bridging</option>
                    </select>
                    <button
                      type="button"
                      className={styles.launchRowBtn}
                      onClick={() => {
                        const sel = document.getElementById(`engine-select-${r.id}`);
                        handleLaunchCampaign(r.id, sel.value);
                      }}
                      disabled={!r.programProductId}
                    >
                      🚀 Launch Engine
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showLinkModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <form onSubmit={handleLinkPlanner}>
              <div className={styles.modalHeader}>
                <h3>Link Editorial Content Planner</h3>
                <button 
                  type="button" 
                  className={styles.closeModalBtn}
                  onClick={() => setShowLinkModal(false)}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
                {plannersData.available.length === 0 ? (
                  <p>Semua Content Planner brand profile ini sudah ditautkan ke program ini atau tidak ada planner tersedia.</p>
                ) : (
                  <div className={styles.formField}>
                    <label htmlFor="avail-planner-select">Select Planner:</label>
                    <select
                      id="avail-planner-select"
                      value={selectedPlannerId}
                      onChange={(e) => setSelectedPlannerId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Available Planner --</option>
                      {plannersData.available.map(avail => (
                        <option key={avail.id} value={avail.id}>
                          {avail.title} ({avail.status} | Created: {new Date(avail.createdAt).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button 
                  type="button" 
                  className={styles.cancelBtn}
                  onClick={() => setShowLinkModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.linkBtnSubmit}
                  disabled={linking || plannersData.available.length === 0 || !selectedPlannerId}
                >
                  {linking ? 'Linking...' : 'Link Planner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {recommendation && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Smart Route Recommendation Result</h3>
              <button type="button" className={styles.closeModalBtn} onClick={() => setRecommendation(null)}>×</button>
            </div>
            <div className={styles.recommendationBody}>
              <div className={styles.recScoreRow}>
                <span className={styles.recEngineBadge}>{recommendation.recommendedEngine.toUpperCase()}</span>
                <span className={styles.recConfidence}>Confidence: {(recommendation.confidence * 100).toFixed(0)}%</span>
              </div>
              <p className={styles.recReasoningText}>{recommendation.reasoning}</p>
              <div className={styles.modalActions}>
                <button type="button" className={styles.submitBtn} onClick={() => setRecommendation(null)}>Apply & Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
