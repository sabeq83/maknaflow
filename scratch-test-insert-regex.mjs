import { interceptQuery, sqliteToPgQuery } from './lib/db.js';
import { tenantContext } from './lib/tenant-context.js';

const sql = `
    INSERT INTO re_campaigns (
      id, campaign_name, execution_mode, status, aspect_ratio, target_ai, custom_instruction, brand_profile_id,
      is_bridging_active, target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode, target_product_id, ephemeral_product_data, promotion_style, narrative_mode,
      post_youtube_draft, post_tiktok_draft, post_facebook_draft, voice_provider, voice_persona, voice_speed, voice_volume,
      ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume, video_model, local_scheduler,
      words_per_clip, face_visibility, enable_tts, enable_glabs, enable_ffmpeg, enable_social_post,
      visual_mode, product_ref_image_path, product_filename_declare, angle_multiplier, visual_overrides_json,
      visual_identity_preset_id, visual_identity_preset_version,
      tts_model_quality, target_language, visual_style,
      nextcloud_parent_folder, fb_draft_mode, target_spreadsheet_id, sfx_setting, enable_vo_audit, enable_audio_segment, voice_cast_json,
      target_demographic, target_demographic_custom, ai_directive, mandatory_outro_line
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const params = Array.from({ length: 57 }, (_, i) => `param_${i + 1}`);

const qMarkCount = (sql.match(/\?/g) || []).length;
console.log('Original ? count:', qMarkCount);

tenantContext.run('test_tenant', () => {
  const intercepted = interceptQuery(sql, params);
  const interceptedQMarkCount = (intercepted.sql.match(/\?/g) || []).length;
  console.log('Intercepted ? count:', interceptedQMarkCount);
  console.log('--- Params count:', intercepted.params.length);

  const pgSql = sqliteToPgQuery(intercepted.sql);
  const pgPlaceholderCount = (pgSql.match(/\$\d+/g) || []).length;
  console.log('PG $ count:', pgPlaceholderCount);
  
  // Find highest index of $ in pgSql
  const matches = pgSql.match(/\$(\d+)/g);
  const maxIdx = matches ? Math.max(...matches.map(m => parseInt(m.substring(1)))) : 0;
  console.log('Max PG index:', maxIdx);
});
