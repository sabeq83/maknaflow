import { useCallback, useEffect, useState } from 'react';
import styles from './ChannelAudioRegistry.module.css';

const emptySpeaker = { speaker_id: '', display_name: '', speaker_type: 'character', description: '', voice_identity: '' };

export function ChannelAudioRegistry({ channel }) {
  const locale = channel.primary_locale || 'id-ID';
  const [data, setData] = useState({ speakers: [], activeConfig: null, draftConfig: null });
  const [config, setConfig] = useState({ audio_production_mode: 'standalone_tts', audio_experience: 'narrative_dialogue', provider: 'google_tts', model_key: '', native_voice_capability: 'descriptive_prompt', sonic_identity_json: {} });
  const [speaker, setSpeaker] = useState(emptySpeaker);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v2/youtube-studio/channels/${channel.id}/voice-registry`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to load audio registry');
    setData(json);
    const current = json.draftConfig || json.activeConfig;
    if (current) setConfig(current);
  }, [channel.id]);

  useEffect(() => { load().catch(error => setNotice({ type: 'error', text: error.message })); }, [load]);

  const saveConfig = async () => {
    setBusy(true); setNotice(null);
    try {
      const payload = { ...config, locale, provider: config.audio_production_mode === 'native_scene_audio' ? 'glabs_google_flow' : config.provider };
      const res = await fetch(`/api/v2/youtube-studio/channels/${channel.id}/audio-config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.success) throw new Error(typeof json.error === 'string' ? json.error : json.error?.message);
      setNotice({ type: 'success', text: 'Draft audio configuration saved. Complete character bindings before activation.' });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  };

  const activate = async () => {
    const configId = data.draftConfig?.id;
    if (!configId) return;
    setBusy(true); setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${channel.id}/audio-config/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config_id: configId }) });
      const json = await res.json();
      if (!json.success) throw new Error(typeof json.error === 'string' ? json.error : json.error?.message);
      setNotice({ type: 'success', text: 'Channel audio configuration activated.' });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  };

  const addSpeaker = async () => {
    setBusy(true); setNotice(null);
    try {
      const res = await fetch(`/api/v2/youtube-studio/channels/${channel.id}/speakers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...speaker, voice_identity_json: { description: speaker.voice_identity } }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSpeaker(emptySpeaker); await load();
    } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  };

  const saveBinding = async (entry, form) => {
    setBusy(true); setNotice(null);
    try {
      const native = config.audio_production_mode === 'native_scene_audio';
      const casting = native
        ? { binding_kind: 'flow_native', provider: 'glabs_google_flow', descriptive_voice_prompt: form.persona }
        : { binding_kind: 'tts', provider: config.provider, persona_key: form.persona, speed: Number(form.speed || 1) };
      const res = await fetch(`/api/v2/youtube-studio/channels/${channel.id}/speakers/${entry.speaker_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: entry.display_name, speaker_type: entry.speaker_type, description: entry.description, voice_identity_json: entry.voice_identity_json || {}, locale, casting }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  };

  const mode = config.audio_production_mode;
  return <section className={styles.section} aria-labelledby="channel-audio-title">
    <div className={styles.header}><div><h2 id="channel-audio-title">Audio, Characters &amp; Voices</h2><p className={styles.muted}>Channel-level source of truth for every Series and Episode.</p></div><span className={styles.notice}>{data.activeConfig ? `Active v${data.activeConfig.version}` : 'No active configuration'}</span></div>
    {notice && <div className={notice.type === 'error' ? styles.error : styles.success}>{notice.text}</div>}
    <div className={styles.grid}>
      <div className={styles.field}><label>Audio production mode</label><select className={styles.select} value={mode} onChange={e => setConfig(value => ({ ...value, audio_production_mode: e.target.value, provider: e.target.value === 'native_scene_audio' ? 'glabs_google_flow' : 'google_tts' }))}><option value="standalone_tts">Standalone Voice Track — TTS</option><option value="native_scene_audio">Native Scene Audio — Google Flow</option></select></div>
      <div className={styles.field}><label>Audio experience</label><select className={styles.select} value={config.audio_experience} onChange={e => setConfig(value => ({ ...value, audio_experience: e.target.value }))}><option value="narrative_dialogue">Narrative / Dialogue</option><option value="spoken_asmr">Spoken ASMR</option><option value="no_talking_asmr">No-Talking ASMR</option><option value="mixed_asmr">Mixed ASMR</option></select></div>
      {mode === 'standalone_tts' && <div className={styles.field}><label>TTS provider</label><select className={styles.select} value={config.provider} onChange={e => setConfig(value => ({ ...value, provider: e.target.value }))}><option value="google_tts">Google TTS</option><option value="minimax">MiniMax</option></select></div>}
      {mode === 'native_scene_audio' && <div className={styles.notice}>Prompt-guided Google Flow audio. Voice consistency is not deterministic until G-Labs exposes voice Ingredients.</div>}
    </div>
    {config.audio_experience?.includes('asmr') && <div className={styles.grid}><div className={styles.field}><label>Microphone perspective</label><select className={styles.select} value={config.sonic_identity_json?.microphone_perspective || 'extreme_close_binaural'} onChange={e => setConfig(value => ({ ...value, sonic_identity_json: { ...(value.sonic_identity_json || {}), microphone_perspective: e.target.value } }))}><option value="extreme_close_binaural">Extreme close binaural</option><option value="close_mono">Close mono</option><option value="stereo_room">Stereo room</option><option value="standard_studio">Standard studio</option></select></div><div className={styles.field}><label>Forbidden sounds (comma separated)</label><input className={styles.input} value={(config.sonic_identity_json?.forbidden_sounds || []).join(', ')} onChange={e => setConfig(value => ({ ...value, sonic_identity_json: { ...(value.sonic_identity_json || {}), forbidden_sounds: e.target.value.split(',').map(item => item.trim()).filter(Boolean) } }))} /></div></div>}
    <div className={styles.actions}><button className="btn btn-primary" disabled={busy} onClick={saveConfig}>Save Draft</button><button className="btn btn-success" disabled={busy || !data.draftConfig} onClick={activate}>Activate Draft</button></div>
    <div className={styles.stack}><h3>Character &amp; Voice Registry</h3>{data.speakers.map(entry => <SpeakerBinding key={entry.id} entry={entry} mode={mode} provider={config.provider} onSave={saveBinding} busy={busy} />)}</div>
    <div className={styles.grid}><div className={styles.field}><label>Speaker ID</label><input className={styles.input} value={speaker.speaker_id} onChange={e => setSpeaker(value => ({ ...value, speaker_id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))} /></div><div className={styles.field}><label>Display name</label><input className={styles.input} value={speaker.display_name} onChange={e => setSpeaker(value => ({ ...value, display_name: e.target.value }))} /></div><div className={styles.field}><label>Type</label><select className={styles.select} value={speaker.speaker_type} onChange={e => setSpeaker(value => ({ ...value, speaker_type: e.target.value }))}><option value="character">Character</option><option value="narrator">Narrator</option></select></div><div className={styles.field}><label>Voice identity</label><input className={styles.input} placeholder="Warm Indonesian baritone, measured cadence…" value={speaker.voice_identity} onChange={e => setSpeaker(value => ({ ...value, voice_identity: e.target.value }))} /></div></div>
    <button className="btn btn-secondary" disabled={busy || !speaker.speaker_id || !speaker.display_name} onClick={addSpeaker}>Add registered speaker</button>
  </section>;
}

function SpeakerBinding({ entry, mode, provider, onSave, busy }) {
  const current = entry.castings?.find(item => mode === 'native_scene_audio' ? item.binding_kind === 'flow_native' : item.binding_kind === 'tts' && item.provider === provider);
  const [persona, setPersona] = useState(current?.persona_key || current?.descriptive_voice_prompt || '');
  const [speed, setSpeed] = useState(current?.speed || 1);
  useEffect(() => { setPersona(current?.persona_key || current?.descriptive_voice_prompt || ''); setSpeed(current?.speed || 1); }, [current?.id]);
  return <div className={styles.speakerCard}><div className={styles.speakerHeader}><strong>{entry.display_name}</strong><span className={styles.muted}>{entry.speaker_id} · {entry.speaker_type}</span></div><div className={styles.row}><input className={styles.input} aria-label={`Voice binding for ${entry.display_name}`} placeholder={mode === 'native_scene_audio' ? 'Descriptive Flow voice prompt' : 'Provider persona ID'} value={persona} onChange={e => setPersona(e.target.value)} />{mode === 'standalone_tts' && <input className={styles.input} type="number" min="0.5" max="2" step="0.1" value={speed} onChange={e => setSpeed(e.target.value)} />}<button className="btn btn-secondary" disabled={busy || !persona} onClick={() => onSave(entry, { persona, speed })}>Save voice</button></div></div>;
}
