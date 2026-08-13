'use client';

export default function PresetSummary({ preset, summary, onReset }) {
  if (!preset) return null;
  const entries = [['Narrative',preset.config?.basic_strategy?.narrative_mode],['Visual',summary?.visual_style],['Mode',summary?.visual_mode],['Model',summary?.video_model],['Clips',summary?.target_clips_count],['Words/clip',summary?.words_per_clip]].filter(([,value])=>value!==undefined&&value!=='');
  return <div style={{padding:12,border:'1px solid var(--border-color)',borderRadius:8,fontSize:12}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{preset.label}</b><button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>Reset to Preset</button></div>
    <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:8}}>{entries.map(([label,value])=><span key={label} style={{padding:'4px 7px',background:'var(--bg-secondary)',borderRadius:12}}>{label}: {value}</span>)}</div>
  </div>;
}
