import { normalizeLocale } from '@/lib/youtube-studio-contract';
import styles from './YouTubeStudioWorkspace.module.css';

export function SeriesDetailView({
  series,
  ideas,
  episodes,
  newEpisodeTitle,
  setNewEpisodeTitle,
  isGeneratingIdeas,
  handleGenerateEpisodeIdeas,
  handleAdoptIdea,
  handleRejectIdea,
  handleCreateEpisodeManual,
  onOpenEpisode,
  selectedChannel
}) {
  return (
    <div className={styles.seriesDetailView}>
      <section className={styles.workflowStep} aria-labelledby="step-episodes-title">
        <div className={styles.stepHeader}>
          <h2 id="step-episodes-title">Series: {series.name}</h2>
          {series.pillar && <span className={styles.kbStepBadge}>Pillar: {series.pillar}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Sub-section 1: AI Episode Ideas Backlog */}
          <div className={styles.subSection} style={{ borderTop: 'none', paddingTop: 0 }}>
            <div className={styles.subSectionHeader}>
              <h3>AI Episode Suggestion Backlog</h3>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleGenerateEpisodeIdeas} 
                disabled={isGeneratingIdeas}
              >
                {isGeneratingIdeas ? '⚡ Generating Backlog...' : 'Suggest Episode Ideas (AI)'}
              </button>
            </div>

            <div className={styles.cardsList}>
              {ideas.map(idea => (
                <div key={idea.id} className={styles.ideaCard}>
                  <div className={styles.ideaCardInfo}>
                    <h4>{idea.title}</h4>
                    {idea.angle && <p><strong>Angle:</strong> {idea.angle}</p>}
                    {idea.content_promise && <p><strong>Promise:</strong> {idea.content_promise}</p>}
                    {idea.rationale && <p><strong>Rationale:</strong> {idea.rationale}</p>}
                  </div>
                  
                  <div className={styles.ideaActions}>
                    <span className={styles.badge}>{idea.status}</span>
                    {idea.status === 'suggested' && (
                      <div className={styles.buttonRow}>
                        <button 
                          type="button" 
                          className="btn btn-success" 
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          onClick={() => handleAdoptIdea(idea.id)}
                        >
                          Adopt
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          onClick={() => handleRejectIdea(idea.id)}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {ideas.length === 0 && (
                <div className={styles.prereqNotice} style={{ borderStyle: 'dashed' }}>
                  No AI suggestions generated yet. Click "Suggest Episode Ideas" to generate.
                </div>
              )}
            </div>
          </div>

          {/* Sub-section 2: Planned Episodes Backlog */}
          <div className={styles.subSection}>
            <div className={styles.subSectionHeader}>
              <h3>Planned Episodes Backlog</h3>
              <div className={styles.buttonRow}>
                <input 
                  aria-label="Manual Episode Title"
                  className={styles.input}
                  type="text" 
                  placeholder="Manual Episode Title" 
                  value={newEpisodeTitle}
                  onChange={(e) => setNewEpisodeTitle(e.target.value)}
                />
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleCreateEpisodeManual}
                >
                  Plan Episode
                </button>
              </div>
            </div>

            <div className={styles.cardsList}>
              {episodes.filter(ep => ep.series_id === series.id).map(ep => (
                <div 
                  key={ep.id} 
                  onClick={() => onOpenEpisode(ep)}
                  className={styles.episodeCard}
                >
                  <div className={styles.episodeInfo}>
                    <h4>{ep.title}</h4>
                    <div className={styles.episodeMeta}>
                      <span>Locale: {normalizeLocale(ep.locale)}</span>
                      <span>Duration: {ep.target_duration_seconds}s</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    <span className={styles.badge} style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>
                      {ep.status}
                    </span>
                    {ep.source_idea_id && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Adopted from Idea</span>}
                    <span className={styles.viewDetailsLink} style={{ fontSize: '0.78rem', color: 'var(--link)', marginTop: '4px' }}>Open Workspace →</span>
                  </div>
                </div>
              ))}

              {episodes.filter(ep => ep.series_id === series.id).length === 0 && (
                <div className={styles.prereqNotice} style={{ borderStyle: 'dashed' }}>
                  No planned episodes backlog found for this series. Adopt suggestions or add manually.
                </div>
              )}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
