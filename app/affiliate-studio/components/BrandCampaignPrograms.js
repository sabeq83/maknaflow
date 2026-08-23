'use client';

import { useState } from 'react';
import styles from './AffiliateStudio.module.css';

export function BrandCampaignPrograms({ programs = [], loading, error, onCreate, onSelect, onRefresh }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [kpis, setKpis] = useState('');
  const [productionTarget, setProductionTarget] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  
  // Funnel Mix percentages
  const [tofu, setTofu] = useState(40);
  const [mofu, setMofu] = useState(40);
  const [bofu, setBofu] = useState(20);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const availablePlatforms = ['tiktok', 'youtube', 'instagram', 'facebook'];

  const handlePlatformToggle = (platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleSubmit = (e) => {
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

    onCreate(payload)
      .then(() => {
        setName('');
        setDescription('');
        setObjective('');
        setTargetAudience('');
        setKpis('');
        setProductionTarget(10);
        setStartDate('');
        setEndDate('');
        setSelectedPlatforms([]);
        setTofu(40);
        setMofu(40);
        setBofu(20);
        setShowCreateForm(false);
      })
      .catch(err => {
        setFormError(err.message);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className={styles.campaignsContainer}>
      <div className={styles.toolbar}>
        <h2 className={styles.viewTitle}>Active Campaign Programs</h2>
        <div className={styles.toolbarActions}>
          <button 
            type="button" 
            className={styles.refreshButton}
            onClick={onRefresh}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            className={styles.createButton}
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setFormError(null);
            }}
          >
            {showCreateForm ? 'Cancel' : 'Create Program'}
          </button>
        </div>
      </div>

      {error && <div className={styles.errorState}>{error}</div>}

      {showCreateForm && (
        <form onSubmit={handleSubmit} className={styles.createProgramForm}>
          <h3>New Campaign Program</h3>
          {formError && <div className={styles.formError}>{formError}</div>}
          
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label htmlFor="prog-name">Program Name *</label>
              <input
                id="prog-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q3 Healthy Foods Launch"
                required
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="prog-target">Production Target (Videos/Content)</label>
              <input
                id="prog-target"
                type="number"
                value={productionTarget}
                onChange={(e) => setProductionTarget(e.target.value)}
                min="0"
              />
            </div>

            <div className={styles.formFieldFull}>
              <label htmlFor="prog-desc">Description</label>
              <textarea
                id="prog-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the campaign's purpose..."
                rows="2"
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="prog-objective">Commercial Objective</label>
              <input
                id="prog-objective"
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g., Promote new chia-seed recipe variants"
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="prog-audience">Target Audience</label>
              <input
                id="prog-audience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Healthy lifestyle moms 25-45"
              />
            </div>

            <div className={styles.formField}>
              <label>Platforms</label>
              <div className={styles.platformsCheckboxGroup}>
                {availablePlatforms.map(platform => (
                  <button
                    key={platform}
                    type="button"
                    className={`${styles.platformBadgeBtn} ${selectedPlatforms.includes(platform) ? styles.activeBadge : ''}`}
                    onClick={() => handlePlatformToggle(platform)}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formField}>
              <label htmlFor="prog-kpis">KPIs Target</label>
              <input
                id="prog-kpis"
                type="text"
                value={kpis}
                onChange={(e) => setKpis(e.target.value)}
                placeholder="e.g., 500 affiliate sales conversion"
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="prog-start">Start Date</label>
              <input
                id="prog-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="prog-end">End Date</label>
              <input
                id="prog-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className={styles.formFieldFull}>
              <label>Funnel Mix Target (%) - Sum must be 100%</label>
              <div className={styles.funnelMixFields}>
                <div className={styles.funnelField}>
                  <label htmlFor="prog-tofu">TOFU (Awareness)</label>
                  <input
                    id="prog-tofu"
                    type="number"
                    value={tofu}
                    onChange={(e) => setTofu(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>
                <div className={styles.funnelField}>
                  <label htmlFor="prog-mofu">MOFU (Consideration)</label>
                  <input
                    id="prog-mofu"
                    type="number"
                    value={mofu}
                    onChange={(e) => setMofu(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>
                <div className={styles.funnelField}>
                  <label htmlFor="prog-bofu">BOFU (Conversion)</label>
                  <input
                    id="prog-bofu"
                    type="number"
                    value={bofu}
                    onChange={(e) => setBofu(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Program'}
            </button>
          </div>
        </form>
      )}

      {loading && <div className={styles.loadingState}>Loading programs...</div>}

      {!loading && programs.length === 0 && (
        <div className={styles.emptyState}>
          <h3>No Campaign Programs Active</h3>
          <p>Mulailah orkestrasi promosi brand dengan membuat program baru pertama Anda.</p>
        </div>
      )}

      {!loading && programs.length > 0 && (
        <div className={styles.programsGrid}>
          {programs.map(program => (
            <div 
              key={program.id} 
              className={styles.programCard}
              onClick={() => onSelect(program.id)}
            >
              <div className={styles.programCardHeader}>
                <h4 className={styles.programName}>{program.name}</h4>
                <span className={styles.programStatusBadge}>{program.status}</span>
              </div>
              
              <p className={styles.programDescription}>
                {program.description || 'No description provided.'}
              </p>

              <div className={styles.programMetadata}>
                <div className={styles.metadataRow}>
                  <strong>Platforms:</strong>
                  <div className={styles.platformBadges}>
                    {program.platforms.length > 0 ? (
                      program.platforms.map(p => (
                        <span key={p} className={styles.platformBadge}>{p}</span>
                      ))
                    ) : (
                      <span className={styles.mutedText}>None specified</span>
                    )}
                  </div>
                </div>

                <div className={styles.metadataRow}>
                  <strong>Target:</strong>
                  <span>{program.productionTarget} videos</span>
                </div>

                <div className={styles.metadataRow}>
                  <strong>Duration:</strong>
                  <span>
                    {program.startDate ? new Date(program.startDate).toLocaleDateString() : 'N/A'} -{' '}
                    {program.endDate ? new Date(program.endDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
