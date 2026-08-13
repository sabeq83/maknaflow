export function resolveAutomationAudience({ manualValue = '', manualLocked = false, productAudience = '', presetAudience = '', brandAudience = '', fallback = 'Konsumen yang relevan dengan produk terpilih.' } = {}) {
  const candidates = manualLocked
    ? [['manual', manualValue]]
    : [['product', productAudience], ['preset', presetAudience], ['brand', brandAudience], ['default', fallback]];
  for (const [source, raw] of candidates) {
    const value = String(raw || '').trim();
    if (value) return { value, source };
  }
  return { value: fallback, source: 'default' };
}

export function applyPresetToAutomationForm(form, preset) {
  const config = preset?.config || preset || {};
  const basic = config.basic_strategy || {}, visual = config.visual_engine || {}, workflow = config.workflow || {};
  return {
    ...form,
    preset: preset?.key || form.preset,
    ai_directive: basic.ai_directive ?? form.ai_directive,
    mandatory_outro_line: basic.mandatory_outro_line ?? form.mandatory_outro_line,
    target_demographic: basic.target_demographic ?? form.target_demographic,
    target_demographic_custom: basic.target_demographic_custom ?? '',
    content_goal: config.planner_defaults?.content_goal ?? form.content_goal,
    approval_mode: workflow.approval_mode === 'storyboard' ? 'creative' : (workflow.approval_mode ?? form.approval_mode),
    auto_sync_contentflow: workflow.auto_sync_contentflow ?? form.auto_sync_contentflow,
    preset_summary: { narrative_mode: basic.narrative_mode, visual_style: visual.visual_style, visual_mode: visual.visual_mode, video_model: visual.video_model, target_clips_count: visual.target_clips_count, words_per_clip: visual.words_per_clip }
  };
}
