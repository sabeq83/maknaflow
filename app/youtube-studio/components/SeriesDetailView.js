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
          
          {/* Series Format & Cast Configuration Panel */}
          <div className={styles.subSection} style={{ borderTop: 'none', paddingTop: 0 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Series Narrative Format &amp; Recurring Cast</h3>
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '6px', color: 'var(--text-secondary)' }}>Narrative Mode</label>
                  <select 
                    className={styles.select}
                    value={series.config_json?.narrative_format?.mode || 'narration_only'}
                    onChange={async (e) => {
                      const newFormat = { ...(series.config_json?.narrative_format || {}), mode: e.target.value };
                      await fetch(`/api/v2/youtube-studio/series/${series.id}/narrative`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ format: newFormat, cast: series.config_json?.recurring_cast || [] })
                      });
                      window.location.reload();
                    }}
                  >
                    <option value="narration_only">Narration Only</option>
                    <option value="dialogue_driven">Dialogue Driven</option>
                    <option value="hybrid_narration_dialogue">Hybrid (Narration + Dialogue)</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '6px', color: 'var(--text-secondary)' }}>Narrator Role</label>
                  <input 
                    className={styles.input}
                    type="text" 
                    placeholder="e.g. omniscient_storyteller"
                    value={series.config_json?.narrative_format?.narrator_usage || 'chapter_open_close'}
                    onChange={async (e) => {
                      const newFormat = { ...(series.config_json?.narrative_format || {}), narrator_usage: e.target.value };
                      await fetch(`/api/v2/youtube-studio/series/${series.id}/narrative`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ format: newFormat, cast: series.config_json?.recurring_cast || [] })
                      });
                    }}
                  />
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Recurring Cast Roster</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(series.config_json?.recurring_cast || []).map((member, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{member.display_name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({member.speaker_id})</span>
                      <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'var(--status-neutral)', borderRadius: '4px' }}>{member.speaker_role}</span>
                      <button 
                        type="button" 
                        className={styles.btnMiniDanger} 
                        style={{ marginLeft: 'auto' }}
                        onClick={async () => {
                          const newCast = (series.config_json?.recurring_cast || []).filter((_, i) => i !== idx);
                          await fetch(`/api/v2/youtube-studio/series/${series.id}/narrative`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ format: series.config_json?.narrative_format || {}, cast: newCast })
                          });
                          window.location.reload();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input 
                      id="new-cast-name" 
                      className={styles.input} 
                      type="text" 
                      placeholder="Display Name" 
                      style={{ flex: 1 }} 
                    />
                    <input 
                      id="new-cast-id" 
                      className={styles.input} 
                      type="text" 
                      placeholder="speaker_id" 
                      style={{ flex: 1 }} 
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      style={{ padding: '6px 16px' }}
                      onClick={async () => {
                        const nameEl = document.getElementById('new-cast-name');
                        const idEl = document.getElementById('new-cast-id');
                        if (!nameEl.value || !idEl.value) return;
                        const newCast = [
                          ...(series.config_json?.recurring_cast || []),
                          { speaker_id: idEl.value.trim(), display_name: nameEl.value.trim(), speaker_role: 'supporting', speaker_type: 'character' }
                        ];
                        await fetch(`/api/v2/youtube-studio/series/${series.id}/narrative`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ format: series.config_json?.narrative_format || {}, cast: newCast })
                        });
                        window.location.reload();
                      }}
                    >
                      Add Cast Member
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
