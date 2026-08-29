export function compileNativeSceneAudioPrompt({ basePrompt, scene, castingSnapshot = [], audioSnapshot = {}, sonicIdentity = {} }) {
  const experience = audioSnapshot.audio_experience || 'narrative_dialogue';
  const lines = [basePrompt, '', 'Audio direction:'];
  for (const block of scene?.audio_blocks || []) {
    if (['narration', 'dialogue', 'whisper'].includes(block.type)) {
      const casting = castingSnapshot.find(item => item.speaker_id === block.speaker_id);
      if (!casting) throw new Error(`YT_UNKNOWN_SPEAKER: ${block.speaker_id}`);
      const voice = casting.flow_binding?.descriptive_voice_prompt || casting.voice_identity_json?.description || casting.description;
      if (!voice) throw new Error(`YT_AUDIO_BINDING_INCOMPLETE: ${block.speaker_id}`);
      const delivery = block.type === 'whisper' ? 'an intimate close-mic whisper' : (block.delivery || 'natural delivery');
      lines.push(`${casting.display_name} speaks in ${delivery}, using ${voice}: “${block.text}”`);
    } else if (block.type === 'sound_event') {
      lines.push(`Sound event: ${block.action || block.text || block.source}; intensity ${block.intensity || 'natural'}; spatial movement ${block.spatial_position || 'centered'}.`);
    } else if (block.type === 'ambience') {
      lines.push(`Ambience: ${block.text || block.source || 'quiet room tone'}.`);
    } else if (block.type === 'breath') {
      lines.push(`Breath sound: ${block.text || block.delivery || 'soft controlled breathing'}.`);
    } else if (block.type === 'silence') {
      lines.push(`Intentional silence for ${block.duration_seconds || block.estimated_duration_seconds} seconds; do not add speech, music, or sound effects during this pause.`);
    }
  }
  if (experience.includes('asmr')) {
    lines.push(`Microphone perspective: ${sonicIdentity.microphone_perspective || 'extreme_close_binaural'}.`);
    lines.push(`Spatial behavior: ${sonicIdentity.spatial_behavior || 'slow_left_to_right'}. Preserve ${sonicIdentity.dynamic_range || 'soft micro-dynamics'} with ${sonicIdentity.noise_floor || 'a quiet treated studio'} noise floor.`);
  }
  if (experience === 'no_talking_asmr') lines.push('No narration, no dialogue, no whisper, and no additional speakers.');
  if ((sonicIdentity.forbidden_sounds || []).length) lines.push(`Do not generate: ${sonicIdentity.forbidden_sounds.join(', ')}.`);
  lines.push('Do not add subtitles, captions, on-screen dialogue text, or any dialogue not present above.');
  return lines.filter(Boolean).join('\n');
}
