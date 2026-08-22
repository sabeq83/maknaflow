const columns = [
  'id', 'campaign_name', 'execution_mode', 'status', 'aspect_ratio', 'target_ai', 'custom_instruction', 'brand_profile_id',
  'is_bridging_active', 'target_clips_count', 'bridge_at_clip', 'bridge_duration_clips', 'bridging_mode', 'target_product_id', 'ephemeral_product_data', 'promotion_style', 'narrative_mode',
  'post_youtube_draft', 'post_tiktok_draft', 'post_facebook_draft', 'voice_provider', 'voice_persona', 'voice_speed', 'voice_volume',
  'ffmpeg_sync_option', 'ffmpeg_video_scale', 'ffmpeg_sfx_volume', 'ffmpeg_bgm_volume', 'video_model', 'local_scheduler',
  'words_per_clip', 'face_visibility', 'enable_tts', 'enable_glabs', 'enable_ffmpeg', 'enable_social_post',
  'visual_mode', 'product_ref_image_path', 'product_filename_declare', 'angle_multiplier', 'visual_overrides_json',
  'visual_identity_preset_id', 'visual_identity_preset_version',
  'tts_model_quality', 'target_language', 'visual_style',
  'nextcloud_parent_folder', 'fb_draft_mode', 'target_spreadsheet_id', 'sfx_setting', 'enable_vo_audit', 'enable_audio_segment', 'voice_cast_json',
  'target_demographic', 'target_demographic_custom', 'ai_directive', 'mandatory_outro_line'
];

const values = [
  'id', 'campaign_name', 'execution_mode', 'status', 'aspect_ratio', 'target_ai', 'custom_instruction', 'brand_profile_id',
  'is_bridging_active', 'target_clips_count', 'bridge_at_clip', 'bridge_duration_clips', 'bridging_mode', 'target_product_id', 'ephemeral_product_data', 'promotion_style', 'narrative_mode',
  'post_youtube_draft', 'post_tiktok_draft', 'post_facebook_draft', 'voice_provider', 'voice_persona', 'voice_speed', 'voice_volume',
  'ffmpeg_sync_option', 'ffmpeg_video_scale', 'ffmpeg_sfx_volume', 'ffmpeg_bgm_volume', 'video_model', 'local_scheduler',
  'words_per_clip', 'face_visibility', 'enable_tts', 'enable_glabs', 'enable_ffmpeg', 'enable_social_post',
  'visual_mode', 'product_ref_image_path', 'product_filename_declare', 'angle_multiplier', 'visual_overrides_json',
  'visual_identity_preset_id', 'visual_identity_preset_version',
  'tts_model_quality', 'target_language', 'visual_style',
  'nextcloud_parent_folder', 'fb_draft_mode', 'target_spreadsheet_id', 'sfx_setting', 'enable_vo_audit',
  'enable_audio_segment', 'voice_cast_json', 'target_demographic', 'target_demographic_custom', 'ai_directive', 'mandatory_outro_line'
];

console.log('Columns count:', columns.length);
console.log('Values count:', values.length);

for (let i = 0; i < Math.max(columns.length, values.length); i++) {
  console.log(`${String(i + 1).padStart(2)} | Column: ${columns[i] || '---'} <=> Value: ${values[i] || '---'}`);
}
