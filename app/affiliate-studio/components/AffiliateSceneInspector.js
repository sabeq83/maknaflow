'use client';

import { useState } from 'react';

export function AffiliateSceneInspector({
  runId,
  brandId,
  scenes = [],
  activeSceneIndex = 1,
  onSelectScene,
  onSceneUpdated
}) {
  const [activeSubtab, setActiveSubtab] = useState('storyboard'); // 'storyboard' | 'visual' | 'voiceover' | 't2i' | 'i2v'
  const [saving, setSaving] = useState(false);

  const activeScene = scenes.find(s => s.scene_index === activeSceneIndex) || scenes[0] || {
    scene_index: 1,
    duration_sec: 3.5,
    storyboard_text: 'Opening Hook: Visual perhatian utama',
    visual_prompt: 'Cinematic product shot',
    voiceover_script: 'Rasakan keunggulan produk kami.',
    t2i_engine: 'sdxl',
    t2i_prompt: 'cinematic product shot, studio lighting',
    i2v_engine: 'kling',
    i2v_motion_prompt: 'slow camera zoom in',
    scene_status: 'rendered'
  };

  const handleUpdateField = async (field, value) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/affiliate-studio/brands/${brandId}/production/runs/${runId}/scenes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex: activeScene.scene_index,
          updates: { [field]: value }
        })
      });
      const json = await res.json();
      if (json.success) {
        onSceneUpdated?.(json.data);
      }
    } catch (err) {
      console.warn('Failed to update scene field:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg, 12px)',
      border: '1px solid var(--border-subtle)',
      padding: '20px'
    }}>
      {/* Scene Timeline Selector */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
          Scene Sequence Timeline ({scenes.length} Scenes)
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {scenes.map((s, idx) => {
            const isCurrent = s.scene_index === activeSceneIndex;
            return (
              <button
                key={s.scene_index || idx}
                type="button"
                onClick={() => onSelectScene?.(s.scene_index)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: isCurrent ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                  border: '1px solid',
                  borderColor: isCurrent ? 'var(--action-primary)' : 'var(--border-subtle)',
                  color: isCurrent ? 'var(--action-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  minWidth: '110px'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '12px' }}>Scene {s.scene_index}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {s.duration_sec}s · <span style={{ textTransform: 'capitalize' }}>{s.scene_status || 'rendered'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtab Switcher */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '8px'
      }}>
        {[
          { id: 'storyboard', label: '🎬 Storyboard' },
          { id: 'visual', label: '👁️ Visual Plan' },
          { id: 'voiceover', label: '🎙️ Voice-Over' },
          { id: 't2i', label: '🎨 T2I Prompt' },
          { id: 'i2v', label: '🎥 I2V Motion' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubtab(tab.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeSubtab === tab.id ? 'var(--surface-interactive)' : 'transparent',
              color: activeSubtab === tab.id ? 'var(--action-primary)' : 'var(--text-muted)',
              fontWeight: activeSubtab === tab.id ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subtab Content Panels */}
      <div style={{ minHeight: '180px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeSubtab === 'storyboard' && (
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Storyboard Action & Composition
            </label>
            <textarea
              defaultValue={activeScene.storyboard_text || ''}
              onBlur={(e) => handleUpdateField('storyboard_text', e.target.value)}
              rows={4}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {activeSubtab === 'visual' && (
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Visual Plan & Lighting Direction
            </label>
            <textarea
              defaultValue={activeScene.visual_prompt || ''}
              onBlur={(e) => handleUpdateField('visual_prompt', e.target.value)}
              rows={4}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {activeSubtab === 'voiceover' && (
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Voice-Over Audio Narration Script
            </label>
            <textarea
              defaultValue={activeScene.voiceover_script || ''}
              onBlur={(e) => handleUpdateField('voiceover_script', e.target.value)}
              rows={4}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {activeSubtab === 't2i' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>T2I Engine:</span>
              <span style={{
                background: 'var(--surface-raised)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--action-primary)'
              }}>
                {activeScene.t2i_engine || 'SDXL Turbo / Midjourney v6'}
              </span>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Text-to-Image Prompt
              </label>
              <textarea
                defaultValue={activeScene.t2i_prompt || ''}
                onBlur={(e) => handleUpdateField('t2i_prompt', e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontFamily: 'var(--font-mono, monospace)',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        )}

        {activeSubtab === 'i2v' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>I2V Engine:</span>
              <span style={{
                background: 'var(--surface-raised)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent, #a855f7)'
              }}>
                {activeScene.i2v_engine || 'Kling AI 1.5 / Runway Gen-3'}
              </span>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Image-to-Video Motion Prompt & Camera Path
              </label>
              <textarea
                defaultValue={activeScene.i2v_motion_prompt || ''}
                onBlur={(e) => handleUpdateField('i2v_motion_prompt', e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontFamily: 'var(--font-mono, monospace)',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {saving && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          💾 Menyimpan perubahan scene...
        </div>
      )}
    </div>
  );
}
