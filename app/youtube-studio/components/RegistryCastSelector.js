import { useCallback, useEffect, useState } from 'react';
import styles from './ChannelAudioRegistry.module.css';

export function RegistryCastSelector({ scope, id, disabled = false }) {
  const [eligible, setEligible] = useState([]);
  const [selected, setSelected] = useState([]);
  const [notice, setNotice] = useState('');
  const base = `/api/v2/youtube-studio/${scope}/${id}`;

  const load = useCallback(async () => {
    const [eligibleRes, selectedRes] = await Promise.all([fetch(`${base}/eligible-cast`), fetch(`${base}/cast-bindings`)]);
    const eligibleJson = await eligibleRes.json();
    const selectedJson = await selectedRes.json();
    setEligible(eligibleJson.speakers || []);
    setSelected((selectedJson.data || []).map(item => item.id));
  }, [base]);

  useEffect(() => { load().catch(error => setNotice(error.message)); }, [load]);

  const save = async () => {
    const res = await fetch(`${base}/cast-bindings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speaker_ids: selected }) });
    const json = await res.json();
    if (!json.success) return setNotice(typeof json.error === 'string' ? json.error : json.error?.message);
    setNotice('Cast selection saved from Channel Registry.');
    await load();
  };

  return <div className={styles.stack}>
    <p className={styles.muted}>Only speakers approved in the parent registry can be selected.</p>
    {eligible.map(item => <label className={styles.speakerCard} key={item.id}><input type="checkbox" disabled={disabled} checked={selected.includes(item.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, item.id] : ids.filter(value => value !== item.id))} /> <strong>{item.display_name}</strong> <span className={styles.muted}>({item.speaker_id} · {item.speaker_type})</span></label>)}
    {!eligible.length && <div className={styles.notice}>No eligible speakers. Configure the Channel Character &amp; Voice Registry first.</div>}
    {notice && <div className={styles.notice}>{notice}</div>}
    <button type="button" className="btn btn-secondary" disabled={disabled} onClick={save}>Save registry cast</button>
  </div>;
}
