import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initUserTables } from './schema/user-schema.js';
import { pgQuery } from './db-pg.js';

const DB_PATH = path.join(process.cwd(), 'data', 'makna_flow.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = TRUNCATE');
    db.pragma('foreign_keys = ON');
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      initSchema();
    } else {
      console.log('[DB] Skipping schema init/migration during Next.js production build phase');
    }
  }
  return db;
}

function initSchema() {
  // Initialize RBAC User & Permission tables first
  initUserTables(db).catch(err => console.error('[DB Init Error] Failed to initialize user tables:', err.message));

  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      file_type TEXT DEFAULT 'md',
      file_size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      topik TEXT,
      konteks_cep TEXT,
      category_cep TEXT,
      cep TEXT,
      sub_cep_matrix TEXT,
      vfo TEXT,
      key_messages TEXT,
      kb_digunakan TEXT,
      jumlah_klip INTEGER,
      narrative_mode TEXT,
      visual_style TEXT,
      words_per_clip TEXT,
      target_ai TEXT,
      face_visibility TEXT,
      aspect_ratio TEXT,
      instruksi_tambahan TEXT,
      product_name TEXT,
      product_description TEXT,
      target_audience TEXT,
      jumlah_ide INTEGER DEFAULT 1,
      prompt_output_format TEXT DEFAULT 'json',
      raw_response TEXT,
      tanggal_dibuat DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Draft'
    );

    CREATE TABLE IF NOT EXISTS assets (
      asset_id TEXT PRIMARY KEY,
      idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
      storyboard TEXT,
      t2i_prompts TEXT,
      i2v_prompts TEXT,
      tiktok_caption TEXT,
      ig_caption TEXT,
      yt_title TEXT,
      yt_desc TEXT,
      raw_response TEXT,
      tanggal_dibuat DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reverse_results (
      id TEXT PRIMARY KEY,
      source_type TEXT,
      source_url TEXT,
      video_filename TEXT,
      custom_instruction TEXT,
      aspect_ratio TEXT,
      target_ai TEXT,
      prompt_output_format TEXT DEFAULT 'plain_text',
      storyboard TEXT,
      voiceover TEXT,
      t2v_prompts TEXT,
      tiktok_caption TEXT,
      ig_caption TEXT,
      yt_title TEXT,
      yt_desc TEXT,
      raw_response TEXT,
      tanggal_dibuat DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_extractions (
      id TEXT PRIMARY KEY,
      input_source TEXT,
      is_url INTEGER DEFAULT 0,
      product_name TEXT,
      product_description TEXT,
      unique_selling_point TEXT,
      target_audience TEXT,
      pain_point_solved TEXT,
      key_visuals_extracted TEXT,
      raw_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pipeline_assets (
      id TEXT PRIMARY KEY,
      product_id TEXT REFERENCES product_extractions(id),
      selected_idea TEXT,
      all_ideas TEXT,
      hot_trend_detected TEXT,
      audio_blueprint TEXT,
      visual_storyboard TEXT,
      t2i_prompts TEXT,
      i2v_prompts TEXT,
      t2v_prompts TEXT,
      tiktok_caption TEXT,
      ig_caption TEXT,
      yt_title TEXT,
      yt_desc TEXT,
      config TEXT,
      raw_responses TEXT,
      current_stage TEXT DEFAULT 'product',
      status TEXT DEFAULT 'in_progress',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_planners (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      account_name TEXT,
      google_sheet_id TEXT,
      brand_id TEXT,
      product_id TEXT,
      input_mode TEXT DEFAULT 'manual',
      planner_focus TEXT DEFAULT 'product_campaign',
      brand_context TEXT,
      content_goal TEXT,
      pillars_json TEXT DEFAULT '[]',
      pillar_distribution_mode TEXT DEFAULT 'balanced',
      product_name TEXT,
      product_description TEXT,
      product_usp TEXT,
      product_url TEXT,
      affiliate_url TEXT,
      product_photo_url TEXT,
      product_ref_image TEXT,
      platform TEXT DEFAULT 'tiktok',
      objective TEXT DEFAULT 'soft_sell',
      planner_count INTEGER DEFAULT 12,
      status TEXT DEFAULT 'completed',
      generation_version TEXT DEFAULT 'v1.0',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_planner_rows (
      id TEXT PRIMARY KEY,
      planner_id TEXT NOT NULL REFERENCES content_planners(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      pillar_id TEXT,
      pillar TEXT NOT NULL,
      category_cep_id TEXT,
      category_cep TEXT NOT NULL,
      ws_matrix_id TEXT,
      ws_matrix TEXT NOT NULL,
      context TEXT NOT NULL,
      vfo_id TEXT,
      vfo TEXT NOT NULL,
      strategic_angle_id TEXT,
      strategic_angle TEXT NOT NULL,
      narrative_mode TEXT DEFAULT 'Storytelling',
      hook TEXT NOT NULL,
      visual_action TEXT NOT NULL,
      video_id TEXT,
      product_id TEXT,
      product TEXT NOT NULL,
      content_subject TEXT,
      product_reference TEXT,
      commercial_intent TEXT DEFAULT 'soft_sell',
      cta_type TEXT DEFAULT 'product',
      selling_intent TEXT DEFAULT 'soft_sell',
      communication_intent TEXT DEFAULT 'educate',
      validation_status TEXT DEFAULT 'pass',
      similarity_score REAL DEFAULT 0.0,
      generation_metadata TEXT,
      is_locked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_planner_pillars (
      id TEXT PRIMARY KEY,
      brand_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      objective TEXT,
      preferred_cep_types TEXT,
      preferred_vfo_types TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS strategic_campaigns (
      id TEXT PRIMARY KEY,
      campaign_name TEXT NOT NULL,
      source_planner_id TEXT REFERENCES content_planners(id) ON DELETE SET NULL,
      input_mode TEXT DEFAULT 'manual',
      product_id TEXT,
      product_name TEXT NOT NULL,
      product_description TEXT,
      product_usp TEXT,
      product_ref_image TEXT,
      brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'draft',
      vso_config_json TEXT,
      workflow_config_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS strategic_campaign_items (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES strategic_campaigns(id) ON DELETE CASCADE,
      planner_row_id TEXT REFERENCES content_planner_rows(id) ON DELETE SET NULL,
      sequence INTEGER NOT NULL,
      pillar TEXT NOT NULL,
      category_cep TEXT NOT NULL,
      ws_matrix TEXT NOT NULL,
      context TEXT NOT NULL,
      vfo TEXT NOT NULL,
      strategic_angle TEXT NOT NULL,
      hook TEXT NOT NULL,
      visual_action TEXT NOT NULL,
      product TEXT NOT NULL,
      narrative_mode TEXT DEFAULT 'Storytelling',
      target_clips_count INTEGER DEFAULT 4,
      creative_package_json TEXT,
      publishing_package_json TEXT,
      final_package_json TEXT,
      workflow_status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS strategic_campaign_scenes (
      id TEXT PRIMARY KEY,
      campaign_item_id TEXT NOT NULL REFERENCES strategic_campaign_items(id) ON DELETE CASCADE,
      scene_number INTEGER NOT NULL,
      duration_seconds INTEGER DEFAULT 8,
      scene_function TEXT,
      visual_action TEXT NOT NULL,
      voice_over TEXT,
      on_screen_text TEXT,
      t2i_prompt TEXT,
      i2v_prompt TEXT,
      negative_prompt TEXT,
      continuity_reference_json TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_compliance_reviews (
      id TEXT PRIMARY KEY,
      campaign_item_id TEXT REFERENCES strategic_campaign_items(id) ON DELETE CASCADE,
      creative_content_package_id TEXT,
      publishing_content_package_id TEXT,
      platform TEXT DEFAULT 'tiktok',
      review_stage TEXT NOT NULL,
      status TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      detected_issues_json TEXT,
      safe_revisions_json TEXT,
      reviewer_type TEXT DEFAULT 'hybrid_gemini',
      policy_version TEXT DEFAULT 'v1.0_tiktok_shop_health',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS video_library (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_url TEXT,
      filename TEXT NOT NULL,
      local_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT 'video/mp4',
      thumbnail_path TEXT,
      status TEXT DEFAULT 'ready',
      error_note TEXT,
      tags TEXT,
      re_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_flow_items (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL DEFAULT 'opc',
      source_campaign_id TEXT,
      source_item_id TEXT,
      account_name TEXT,
      video_id TEXT NOT NULL,
      campaign_title TEXT,
      hook TEXT,
      nama_produk TEXT,
      link_affiliate TEXT,
      link_produk TEXT,
      caption TEXT,
      production_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      url_asset TEXT,
      drive_link TEXT,
      nextcloud_url TEXT,
      pipeline_status TEXT DEFAULT 'Completed',
      tiktok_status TEXT DEFAULT 'Not Published',
      tiktok_publish_date TEXT,
      permalink_tiktok TEXT,
      facebook_status TEXT DEFAULT 'Not Published',
      facebook_publish_date TEXT,
      permalink_facebook TEXT,
      instagram_status TEXT DEFAULT 'Not Published',
      instagram_publish_date TEXT,
      permalink_instagram TEXT,
      youtube_status TEXT DEFAULT 'Not Published',
      youtube_publish_date TEXT,
      permalink_youtube TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Scheduler V4: Multi-Key Quota Pool
    CREATE TABLE IF NOT EXISTS gemini_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_name TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      tier TEXT DEFAULT 'FREE',
      daily_limit INTEGER DEFAULT 20,
      is_active INTEGER DEFAULT 1,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    const tableInfo = db.prepare('PRAGMA table_info(gemini_api_keys)').all();
    const hasStatus = tableInfo.some(c => c.name === 'status');
    if (!hasStatus) {
      db.prepare('ALTER TABLE gemini_api_keys ADD COLUMN status TEXT DEFAULT "ACTIVE"').run();
    }
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_usages (
      date TEXT NOT NULL,
      key_id INTEGER NOT NULL REFERENCES gemini_api_keys(id) ON DELETE CASCADE,
      used_count INTEGER DEFAULT 0,
      PRIMARY KEY (date, key_id)
    );

    -- Scheduler V4: Job Queue
    CREATE TABLE IF NOT EXISTS scheduler_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      payload TEXT,
      result TEXT,
      error_note TEXT,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      run_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_queue_status ON scheduler_jobs(queue_name, status, run_at);

    -- Scheduler V4: Per-Queue Configuration
    CREATE TABLE IF NOT EXISTS scheduler_config (
      queue_name TEXT PRIMARY KEY,
      is_enabled INTEGER DEFAULT 0,
      mode TEXT DEFAULT 'time_window',
      interval_minutes INTEGER DEFAULT 15,
      jobs_per_day INTEGER DEFAULT 10,
      window_start TEXT DEFAULT '09:00',
      window_end TEXT DEFAULT '17:00',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- V5: Standalone RE Campaigns
    CREATE TABLE IF NOT EXISTS re_campaigns (
      id TEXT PRIMARY KEY,
      campaign_name TEXT NOT NULL,
      status TEXT DEFAULT 'running',
      target_spreadsheet_id TEXT,
      target_markdown_url TEXT,
      aspect_ratio TEXT DEFAULT '9:16',
      target_ai TEXT DEFAULT 'Google Veo (8s)',
      custom_instruction TEXT DEFAULT '',
      brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL,
      is_bridging_active INTEGER DEFAULT 0,
      target_clips_count INTEGER DEFAULT 5,
      bridge_at_clip INTEGER DEFAULT 2,
      bridge_duration_clips INTEGER DEFAULT 0,
      bridging_mode TEXT DEFAULT 'select_existing',
      target_product_id TEXT REFERENCES product_extractions(id) ON DELETE SET NULL,
      ephemeral_product_data TEXT,
      promotion_style TEXT DEFAULT 'Softselling',
      narrative_mode TEXT DEFAULT 'Storytelling',
      post_youtube_draft INTEGER DEFAULT 0,
      post_tiktok_draft INTEGER DEFAULT 0,
      post_facebook_draft INTEGER DEFAULT 0,
      voice_provider TEXT DEFAULT 'gemini',
      voice_persona TEXT DEFAULT 'Kore',
      voice_speed REAL DEFAULT 1.0,
      voice_volume REAL DEFAULT 1.0,
      ffmpeg_sync_option TEXT DEFAULT 'shortest',
      ffmpeg_video_scale REAL DEFAULT 1.0,
      ffmpeg_sfx_volume REAL DEFAULT 0.0,
      ffmpeg_bgm_volume REAL DEFAULT 0.15,
      video_model TEXT DEFAULT 'veo_31_lite',
      local_scheduler INTEGER DEFAULT 0,
      scheduler_pause_at TEXT DEFAULT NULL,
      words_per_clip TEXT DEFAULT '17-19 kata',
      face_visibility TEXT DEFAULT 'Faceless',
      enable_tts INTEGER DEFAULT 1,
      enable_glabs INTEGER DEFAULT 0,
      enable_ffmpeg INTEGER DEFAULT 1,
      enable_social_post INTEGER DEFAULT 1,
      visual_mode TEXT DEFAULT 'pure_t2v',
      product_ref_image_path TEXT,
      product_filename_declare TEXT,
      visual_overrides_json TEXT,
      tts_model_quality TEXT DEFAULT 'speech-2.8-turbo',
      target_language TEXT DEFAULT 'id-ID',
      visual_style TEXT DEFAULT 'Cinematic',
      fb_draft_mode TEXT DEFAULT 'auto',
      sync_mode TEXT DEFAULT 'auto',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS re_campaign_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL REFERENCES re_campaigns(id),
      source_url TEXT NOT NULL,
      scrape_status TEXT DEFAULT 'pending',
      local_video_path TEXT,
      analyze_status TEXT DEFAULT 'pending',
      result_json TEXT,
      tts_status TEXT DEFAULT 'pending',
      tts_batch_id TEXT,
      visual_status TEXT DEFAULT 'pending',
      visual_tasks_json TEXT,
      visual_clip_paths TEXT,
      ffmpeg_status TEXT DEFAULT 'pending',
      ffmpeg_output_path TEXT,
      upload_status TEXT DEFAULT 'pending',
      drive_link TEXT,
      social_post_status TEXT DEFAULT 'pending',
      social_links_json TEXT,
      t2i_start_frame_path TEXT
    );

    -- V5: G Labs Batch Campaigns
    CREATE TABLE IF NOT EXISTS glabs_campaigns (
      id TEXT PRIMARY KEY,
      source_spreadsheet_id TEXT NOT NULL,
      target_drive_folder_id TEXT NOT NULL,
      current_batch INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- V5: Instant Campaign (1-Stage)
    CREATE TABLE IF NOT EXISTS instant_campaigns (
      id TEXT PRIMARY KEY,
      product_name TEXT,
      product_description TEXT,
      product_source_type TEXT,
      product_media_path TEXT,
      product_url TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS instant_campaign_configs (
      campaign_id TEXT PRIMARY KEY REFERENCES instant_campaigns(id),
      narrative_mode TEXT,
      visual_style TEXT,
      words_per_clip INTEGER,
      target_ai_engine TEXT,
      face_visibility TEXT,
      aspect_ratio TEXT,
      total_clips INTEGER DEFAULT 4,
      voice_persona TEXT,
      speed_control REAL,
      custom_instruction TEXT,
      target_language TEXT DEFAULT 'id-ID'
    );

    CREATE TABLE IF NOT EXISTS instant_campaign_outputs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES instant_campaigns(id),
      unified_production_json TEXT,
      error_log TEXT
    );

    -- V5.1: Brand DNA Profiles
    CREATE TABLE IF NOT EXISTS brand_profiles (
      id TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      tone_of_voice TEXT DEFAULT 'Kasual/Gaul',
      visual_signature TEXT NOT NULL,
      color_palette TEXT,
      forbidden_elements TEXT,
      brand_slogan_or_cta TEXT,
      raw_guideline_text TEXT,
      guideline_filename TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS brand_products (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      brand_profile_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      affiliate_link TEXT,
      tracking_code TEXT,
      landing_page_url TEXT,
      product_name_override TEXT,
      cta_override TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, brand_profile_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS campaign_product_bindings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_campaign_id TEXT NOT NULL,
      source_item_id TEXT,
      brand_profile_id TEXT,
      brand_product_id TEXT,
      product_id TEXT NOT NULL,
      product_name_snapshot TEXT,
      product_url_snapshot TEXT,
      affiliate_link_snapshot TEXT,
      tracking_code_snapshot TEXT,
      affiliate_source TEXT NOT NULL,
      affiliate_status TEXT NOT NULL,
      resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- V5.9: Standalone FFmpeg Studio Jobs
    CREATE TABLE IF NOT EXISTS ffmpeg_studio_jobs (
      id TEXT PRIMARY KEY,
      video_source_type TEXT NOT NULL,
      video_path TEXT NOT NULL,
      audio_source_type TEXT NOT NULL,
      audio_path TEXT NOT NULL,
      sync_option TEXT NOT NULL,
      bgm_path TEXT,
      bgm_volume REAL DEFAULT 0.15,
      sfx_volume REAL DEFAULT 0.0,
      video_scale REAL DEFAULT 1.0,
      output_path TEXT,
      status TEXT DEFAULT 'pending',
      error_log TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tts_studio_batches (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_ref_id TEXT,
      provider_active TEXT NOT NULL,
      voice_persona TEXT NOT NULL,
      config_speed REAL DEFAULT 1.0,
      config_volume REAL DEFAULT 1.0,
      tts_model_quality TEXT DEFAULT 'speech-2.8-turbo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tts_studio_clips (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      clip_index INTEGER NOT NULL,
      source_text TEXT NOT NULL,
      audio_path TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(batch_id) REFERENCES tts_studio_batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS glabs_tasks (
      task_id TEXT PRIMARY KEY,
      campaign_id TEXT,
      item_id INTEGER,
      clip_index INTEGER,
      prompt TEXT NOT NULL,
      status TEXT DEFAULT 'processing',
      video_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS re_plus_recomm_jobs (
      id TEXT PRIMARY KEY,
      campaign_name TEXT NOT NULL,
      source_urls_json TEXT NOT NULL,
      target_recommendations_count INTEGER DEFAULT 3,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS re_plus_recomm_outputs (
      id TEXT PRIMARY KEY,
      recomm_job_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      video_deconstruction_json TEXT,
      recommended_product_name TEXT NOT NULL,
      short_description TEXT NOT NULL,
      unique_selling_point TEXT NOT NULL,
      scraped_image_url TEXT,
      local_image_path TEXT,
      is_selected_by_user INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(recomm_job_id) REFERENCES re_plus_recomm_jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS re_item_angle_variants (
      id TEXT PRIMARY KEY,
      re_item_id INTEGER NOT NULL,
      angle_name TEXT NOT NULL,
      angle_category TEXT NOT NULL,
      matrix_strategy_used TEXT NOT NULL,
      system_targeting TEXT NOT NULL,
      voice_persona_assigned TEXT NOT NULL,
      angle_description TEXT NOT NULL,
      visual_tasks_json TEXT NOT NULL,
      glabs_task_ids TEXT,
      tts_status TEXT DEFAULT 'pending',
      tts_batch_id TEXT,
      visual_status TEXT DEFAULT 'pending',
      visual_clip_paths TEXT,
      ffmpeg_status TEXT DEFAULT 'pending',
      ffmpeg_output_path TEXT,
      upload_status TEXT DEFAULT 'pending',
      drive_link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(re_item_id) REFERENCES re_campaign_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      severity_level TEXT DEFAULT 'WARNING',
      module_name TEXT NOT NULL,
      reference_id TEXT,
      error_message TEXT NOT NULL,
      human_resolution_hint TEXT,
      is_resolved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sheets_campaigns (
      id TEXT PRIMARY KEY,
      campaign_name TEXT NOT NULL,
      campaign_type TEXT NOT NULL,
      target_language TEXT DEFAULT 'id-ID',
      spreadsheet_id TEXT NOT NULL,
      gdrive_folder_id TEXT,
      aspect_ratio TEXT DEFAULT '9:16',
      target_ai TEXT DEFAULT 'Google Veo (8s)',
      video_model TEXT DEFAULT 'veo_31_lite',
      visual_mode TEXT DEFAULT 'hybrid_lock',
      words_per_clip TEXT DEFAULT '17-19 kata',
      face_visibility TEXT DEFAULT 'Faceless',
      custom_instruction TEXT DEFAULT '',
      brand_profile_id TEXT,
      visual_overrides_json TEXT,
      is_bridging_active INTEGER DEFAULT 0,
      target_clips_count INTEGER DEFAULT 4,
      bridge_at_clip INTEGER DEFAULT 2,
      bridge_duration_clips INTEGER DEFAULT 1,
      bridging_mode TEXT DEFAULT 'select_existing',
      target_product_id TEXT,
      promotion_style TEXT DEFAULT 'Softselling',
      narrative_mode TEXT DEFAULT 'Storytelling',
      enable_tts INTEGER DEFAULT 0,
      enable_glabs INTEGER DEFAULT 0,
      enable_ffmpeg INTEGER DEFAULT 0,
      enable_social_post INTEGER DEFAULT 0,
      voice_provider TEXT DEFAULT 'minimax',
      voice_persona TEXT DEFAULT 'Professional Anchor',
      voice_speed REAL DEFAULT 1.0,
      voice_volume REAL DEFAULT 1.0,
      ffmpeg_sync_option TEXT DEFAULT 'smart_sync',
      ffmpeg_video_scale REAL DEFAULT 1.0,
      ffmpeg_sfx_volume REAL DEFAULT 0.0,
      ffmpeg_bgm_volume REAL DEFAULT 0.15,
      tts_model_quality TEXT DEFAULT 'speech-2.8-turbo',
      status TEXT DEFAULT 'active',
      visual_style TEXT DEFAULT 'Cinematic',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sheets_jobs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      url_or_topic TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      storyboard TEXT,
      voiceover TEXT,
      local_video_path TEXT,
      local_audio_path TEXT,
      gdrive_folder_url TEXT,
      retry_count INTEGER DEFAULT 0,
      visual_status TEXT DEFAULT 'pending',
      ffmpeg_status TEXT DEFAULT 'pending',
      visual_clip_paths TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(campaign_id) REFERENCES sheets_campaigns(id) ON DELETE CASCADE
    );

    -- V8.9: Deconstruct Lab (Discovery Engine)
    CREATE TABLE IF NOT EXISTS re_deconstruct_batches (
      id TEXT PRIMARY KEY,
      batch_name TEXT NOT NULL,
      target_recommendation_count INTEGER DEFAULT 3,
      status TEXT DEFAULT 'processing',
      total_videos INTEGER DEFAULT 0,
      processed_videos INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS re_deconstructed_assets (
      id TEXT PRIMARY KEY,
      batch_id TEXT REFERENCES re_deconstruct_batches(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      original_caption TEXT,
      local_video_path TEXT,
      gemini_file_uri TEXT,
      original_storyboard_json TEXT,
      product_ideas_json TEXT,
      viral_pattern_summary TEXT,
      status TEXT DEFAULT 'pending_download',
      error_message TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS re_multiplier_tasks (
      id TEXT PRIMARY KEY,
      deconstruct_asset_id TEXT REFERENCES re_deconstructed_assets(id) ON DELETE CASCADE,
      target_product_url TEXT,
      affiliate_url TEXT,
      vso_config_json TEXT,
      bridging_config_json TEXT,
      audio_config_json TEXT,
      remake_storyboard_json TEXT,
      t2i_i2v_prompts_json TEXT,
      new_caption TEXT,
      glabs_task_ids TEXT,
      ffmpeg_output_path TEXT,
      status TEXT DEFAULT 'pending_resolution',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- V9.0: Recipe Labs (Text & Image Content - Recipe Edition)
    CREATE TABLE IF NOT EXISTS recipe_campaigns (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      custom_category TEXT,
      visual_style TEXT DEFAULT 'Food Porn',
      nextcloud_parent_folder TEXT DEFAULT 'MAKNA_Recipes',
      post_to_facebook INTEGER DEFAULT 0,
      enable_glabs INTEGER DEFAULT 1,
      target_recipe_count INTEGER DEFAULT 1,
      images_per_recipe INTEGER DEFAULT 4,
      status TEXT DEFAULT 'processing',
      nextcloud_folder_url TEXT,
      campaign_type TEXT DEFAULT 'static',
      brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL,
      spreadsheet_id TEXT,
      config_json TEXT,
      local_scheduler INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recipe_items (
      id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES recipe_campaigns(id) ON DELETE CASCADE,
      recipe_title TEXT,
      recipe_markdown_text TEXT,
      t2i_prompts_json TEXT,
      img_1_raw_path TEXT,
      img_2_process_path TEXT,
      img_3_result_path TEXT,
      img_4_plated_path TEXT,
      img_5_path TEXT,
      img_6_path TEXT,
      img_grid_path TEXT,
      fb_post_id TEXT,
      fb_post_status TEXT,
      status TEXT DEFAULT 'pending_gemini',
      video_storyboard_json TEXT,
      video_dna_json TEXT,
      seo_data_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bridge_injector_campaigns (
      id TEXT PRIMARY KEY,
      campaign_name TEXT NOT NULL,
      original_script_md TEXT NOT NULL,
      bridging_mode TEXT DEFAULT 'select_existing',
      target_product_id TEXT,
      ephemeral_product_data TEXT,
      status TEXT DEFAULT 'pending_storyboard',
      custom_instruction TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(target_product_id) REFERENCES product_extractions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bridge_injector_outputs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES bridge_injector_campaigns(id) ON DELETE CASCADE,
      injected_vo_1 TEXT NOT NULL,
      injected_vo_2 TEXT NOT NULL,
      injected_vo_3 TEXT NOT NULL,
      injected_vo_4 TEXT NOT NULL,
      clip2_t2i_prompt TEXT NOT NULL,
      clip2_i2v_prompt TEXT NOT NULL,
      clip2_t2i_task_id TEXT,
      clip2_t2i_image_path TEXT,
      clip2_i2v_task_id TEXT,
      clip2_video_path TEXT,
      injected_script_md_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe Migration for brand_schedules table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS brand_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_id TEXT NOT NULL,
        slot_index INTEGER NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        target_daily_posts INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(brand_id, slot_index)
      );
    `);
  } catch (e) {}

  try {
    const cfiCols = db.prepare(`PRAGMA table_info(content_flow_items)`).all().map(c => c.name);
    if (!cfiCols.includes('catatan')) db.prepare(`ALTER TABLE content_flow_items ADD COLUMN catatan TEXT`).run();
  } catch (e) {}

  try {
    const itemsCols = db.prepare(`PRAGMA table_info(strategic_campaign_items)`).all().map(c => c.name);
    if (!itemsCols.includes('generation_status')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN generation_status TEXT DEFAULT 'pending'`).run();
    if (!itemsCols.includes('tts_status')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN tts_status TEXT DEFAULT 'pending'`).run();
    if (!itemsCols.includes('visual_status')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN visual_status TEXT DEFAULT 'pending'`).run();
    if (!itemsCols.includes('ffmpeg_status')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN ffmpeg_status TEXT DEFAULT 'pending'`).run();
    if (!itemsCols.includes('social_post_status')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN social_post_status TEXT DEFAULT 'pending'`).run();
    if (!itemsCols.includes('retry_count')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN retry_count INTEGER DEFAULT 0`).run();
    if (!itemsCols.includes('tts_batch_id')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN tts_batch_id TEXT`).run();
    if (!itemsCols.includes('visual_tasks_json')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN visual_tasks_json TEXT DEFAULT '[]'`).run();
    if (!itemsCols.includes('visual_clip_paths')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN visual_clip_paths TEXT`).run();
    if (!itemsCols.includes('ffmpeg_output_path')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN ffmpeg_output_path TEXT`).run();
    if (!itemsCols.includes('upload_status')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN upload_status TEXT DEFAULT 'pending'`).run();
    if (!itemsCols.includes('drive_link')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN drive_link TEXT`).run();
    if (!itemsCols.includes('social_links_json')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN social_links_json TEXT`).run();
    if (!itemsCols.includes('error_message')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN error_message TEXT`).run();
    if (!itemsCols.includes('video_dna_json')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN video_dna_json TEXT`).run();
    if (!itemsCols.includes('video_id')) db.prepare(`ALTER TABLE strategic_campaign_items ADD COLUMN video_id TEXT`).run();
  } catch (_) {}

  try {
    const scCols = db.prepare(`PRAGMA table_info(strategic_campaigns)`).all().map(c => c.name);
    if (!scCols.includes('scheduler_pause_at')) db.prepare(`ALTER TABLE strategic_campaigns ADD COLUMN scheduler_pause_at TEXT`).run();
    if (!scCols.includes('enable_social_post')) db.prepare(`ALTER TABLE strategic_campaigns ADD COLUMN enable_social_post INTEGER DEFAULT 0`).run();
    if (!scCols.includes('target_spreadsheet_id')) db.prepare(`ALTER TABLE strategic_campaigns ADD COLUMN target_spreadsheet_id TEXT`).run();
    if (!scCols.includes('nextcloud_parent_folder')) db.prepare(`ALTER TABLE strategic_campaigns ADD COLUMN nextcloud_parent_folder TEXT DEFAULT 'MAKNA_Strategic_Campaigns'`).run();
    if (!scCols.includes('account_name')) db.prepare(`ALTER TABLE strategic_campaigns ADD COLUMN account_name TEXT`).run();
    if (!scCols.includes('brand_profile_id')) db.prepare(`ALTER TABLE strategic_campaigns ADD COLUMN brand_profile_id TEXT`).run();
  } catch (_) {}

  // Safe Migration for strategic_campaign_scenes start frames
  try {
    const sceneCols = db.prepare(`PRAGMA table_info(strategic_campaign_scenes)`).all().map(c => c.name);
    if (!sceneCols.includes('start_frame_path')) db.prepare(`ALTER TABLE strategic_campaign_scenes ADD COLUMN start_frame_path TEXT`).run();
    if (!sceneCols.includes('task_id')) db.prepare(`ALTER TABLE strategic_campaign_scenes ADD COLUMN task_id TEXT`).run();
    if (!sceneCols.includes('voice_over_audio_path')) db.prepare(`ALTER TABLE strategic_campaign_scenes ADD COLUMN voice_over_audio_path TEXT`).run();
    if (!sceneCols.includes('local_clip_path')) db.prepare(`ALTER TABLE strategic_campaign_scenes ADD COLUMN local_clip_path TEXT`).run();
  } catch (_) {}

  // Safe migration: Add brand_profile_id to existing tables if not present
  const migrateBrandFK = (tableName) => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
      if (!cols.find(c => c.name === 'brand_profile_id')) {
        db.prepare(`ALTER TABLE ${tableName} ADD COLUMN brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL`).run();
        console.log(`[DB Migration] Added brand_profile_id to ${tableName}`);
      }
    } catch (e) {
      console.warn(`[DB Migration] Skipped ${tableName}:`, e.message);
    }
  };
  migrateBrandFK('re_campaigns');
  migrateBrandFK('instant_campaigns');
  migrateBrandFK('bridge_injector_campaigns');

  try {
    const reCols = db.prepare('PRAGMA table_info(re_campaigns)').all().map(c => c.name);
    if (!reCols.includes('target_demographic')) {
      db.prepare('ALTER TABLE re_campaigns ADD COLUMN target_demographic TEXT DEFAULT NULL').run();
      console.log('[DB Migration] Added target_demographic to re_campaigns');
    }
    if (!reCols.includes('target_demographic_custom')) {
      db.prepare('ALTER TABLE re_campaigns ADD COLUMN target_demographic_custom TEXT DEFAULT NULL').run();
      console.log('[DB Migration] Added target_demographic_custom to re_campaigns');
    }
  } catch (e) {
    console.error('[DB Migration Error] re_campaigns:', e.message);
  }

  try {
    const opcCols = db.prepare('PRAGMA table_info(pillar_campaigns)').all().map(c => c.name);
    if (!opcCols.includes('target_demographic')) {
      db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN target_demographic TEXT DEFAULT NULL').run();
      console.log('[DB Migration] Added target_demographic to pillar_campaigns');
    }
    if (!opcCols.includes('target_demographic_custom')) {
      db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN target_demographic_custom TEXT DEFAULT NULL').run();
      console.log('[DB Migration] Added target_demographic_custom to pillar_campaigns');
    }
  } catch (e) {
    console.error('[DB Migration Error] pillar_campaigns:', e.message);
  }

  try {
    const cols = db.prepare('PRAGMA table_info(recipe_campaigns)').all();
    if (!cols.find(c => c.name === 'enable_glabs')) {
      db.prepare('ALTER TABLE recipe_campaigns ADD COLUMN enable_glabs INTEGER DEFAULT 1').run();
      console.log('[DB Migration] Added enable_glabs to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'nextcloud_parent_folder')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN nextcloud_parent_folder TEXT DEFAULT 'MAKNA_Recipes'").run();
      console.log('[DB Migration] Added nextcloud_parent_folder to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'post_to_facebook')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN post_to_facebook INTEGER DEFAULT 0").run();
      console.log('[DB Migration] Added post_to_facebook to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'campaign_type')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN campaign_type TEXT DEFAULT 'static'").run();
      console.log('[DB Migration] Added campaign_type to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'brand_profile_id')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL").run();
      console.log('[DB Migration] Added brand_profile_id to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'spreadsheet_id')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN spreadsheet_id TEXT").run();
      console.log('[DB Migration] Added spreadsheet_id to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'config_json')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN config_json TEXT").run();
      console.log('[DB Migration] Added config_json to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'images_per_recipe')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN images_per_recipe INTEGER DEFAULT 4").run();
      console.log('[DB Migration] Added images_per_recipe to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'selected_layout_id')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN selected_layout_id TEXT DEFAULT '4_editorial_split'").run();
      console.log('[DB Migration] Added selected_layout_id to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'grid_gap_size')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN grid_gap_size INTEGER DEFAULT 12").run();
      console.log('[DB Migration] Added grid_gap_size to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'grid_border_radius')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN grid_border_radius INTEGER DEFAULT 16").run();
      console.log('[DB Migration] Added grid_border_radius to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'grid_outer_padding')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN grid_outer_padding INTEGER DEFAULT 16").run();
      console.log('[DB Migration] Added grid_outer_padding to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'grid_bg_color')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN grid_bg_color TEXT DEFAULT '#0d0d12'").run();
      console.log('[DB Migration] Added grid_bg_color to recipe_campaigns');
    }
    if (!cols.find(c => c.name === 'source_deconstruct_asset_id')) {
      db.prepare("ALTER TABLE recipe_campaigns ADD COLUMN source_deconstruct_asset_id TEXT REFERENCES re_deconstructed_assets(id) ON DELETE SET NULL").run();
      console.log('[DB Migration] Added source_deconstruct_asset_id to recipe_campaigns');
    }
  } catch (err) {
    console.error('[DB Migration Error recipe_campaigns]:', err.message);
  }

  try {
    const itemCols = db.prepare('PRAGMA table_info(recipe_items)').all();
    if (!itemCols.find(c => c.name === 'fb_post_id')) {
      db.prepare("ALTER TABLE recipe_items ADD COLUMN fb_post_id TEXT").run();
    }
    if (!itemCols.find(c => c.name === 'fb_post_status')) {
      db.prepare("ALTER TABLE recipe_items ADD COLUMN fb_post_status TEXT").run();
    }
    if (!itemCols.find(c => c.name === 'video_storyboard_json')) {
      db.prepare("ALTER TABLE recipe_items ADD COLUMN video_storyboard_json TEXT").run();
      console.log('[DB Migration] Added video_storyboard_json to recipe_items');
    }
    if (!itemCols.find(c => c.name === 'video_dna_json')) {
      db.prepare("ALTER TABLE recipe_items ADD COLUMN video_dna_json TEXT").run();
      console.log('[DB Migration] Added video_dna_json to recipe_items');
    }
    if (!itemCols.find(c => c.name === 'seo_data_json')) {
      db.prepare("ALTER TABLE recipe_items ADD COLUMN seo_data_json TEXT").run();
      console.log('[DB Migration] Added seo_data_json to recipe_items');
    }
    if (!itemCols.find(c => c.name === 'img_5_path')) {
      db.prepare("ALTER TABLE recipe_items ADD COLUMN img_5_path TEXT").run();
      console.log('[DB Migration] Added img_5_path to recipe_items');
    }
    if (!itemCols.find(c => c.name === 'img_6_path')) {
      db.prepare("ALTER TABLE recipe_items ADD COLUMN img_6_path TEXT").run();
      console.log('[DB Migration] Added img_6_path to recipe_items');
    }
  } catch (err) {
    console.error('[DB Migration Error recipe_items]:', err.message);
  }

  // Safe migration: Add bridging and customization columns to re_campaigns
  const migrateReCampaignsBridging = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaigns ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaigns`);
        }
      };
      addColumn('is_bridging_active', 'INTEGER DEFAULT 0');
      addColumn('target_clips_count', 'INTEGER DEFAULT 5');
      addColumn('bridge_at_clip', 'INTEGER DEFAULT 3');
      addColumn('bridging_mode', 'TEXT DEFAULT \'select_existing\'');
      addColumn('target_product_id', 'TEXT REFERENCES product_extractions(id) ON DELETE SET NULL');
      addColumn('ephemeral_product_data', 'TEXT');
      addColumn('promotion_style', 'TEXT DEFAULT \'Softselling\'');
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns bridging migration:', e.message);
    }
  };
  migrateReCampaignsBridging();

  // Safe migration: Add sfx_volume to ffmpeg_studio_jobs if not present
  const migrateFfmpegStudioJobsSFX = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(ffmpeg_studio_jobs)').all();
      if (!cols.find(c => c.name === 'sfx_volume')) {
        db.prepare('ALTER TABLE ffmpeg_studio_jobs ADD COLUMN sfx_volume REAL DEFAULT 0.0').run();
        console.log('[DB Migration] Added column sfx_volume to ffmpeg_studio_jobs');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped ffmpeg_studio_jobs SFX migration:', e.message);
    }
  };
  migrateFfmpegStudioJobsSFX();

  // Safe migration: Add video_scale to ffmpeg_studio_jobs if not present
  const migrateFfmpegStudioJobsScale = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(ffmpeg_studio_jobs)').all();
      if (!cols.find(c => c.name === 'video_scale')) {
        db.prepare('ALTER TABLE ffmpeg_studio_jobs ADD COLUMN video_scale REAL DEFAULT 1.0').run();
        console.log('[DB Migration] Added column video_scale to ffmpeg_studio_jobs');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped ffmpeg_studio_jobs scale migration:', e.message);
    }
  };
  migrateFfmpegStudioJobsScale();

  // Safe migration: Add voice and social settings to re_campaigns
  const migrateReCampaignsSettingsV65 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaigns ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaigns`);
        }
      };
      addColumn('post_youtube_draft', 'INTEGER DEFAULT 0');
      addColumn('post_tiktok_draft', 'INTEGER DEFAULT 0');
      addColumn('post_facebook_draft', 'INTEGER DEFAULT 0');
      addColumn('voice_provider', 'TEXT DEFAULT \'gemini\'');
      addColumn('voice_persona', 'TEXT DEFAULT \'Kore\'');
      addColumn('voice_speed', 'REAL DEFAULT 1.0');
      addColumn('voice_volume', 'REAL DEFAULT 1.0');
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns V6.5 settings migration:', e.message);
    }
  };
  migrateReCampaignsSettingsV65();
  
  // Safe migration: Add bridge_duration_clips to re_campaigns
  const migrateReCampaignsBridgeDuration = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'bridge_duration_clips')) {
        db.prepare('ALTER TABLE re_campaigns ADD COLUMN bridge_duration_clips INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column bridge_duration_clips to re_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns bridge_duration_clips migration:', e.message);
    }
  };
  migrateReCampaignsBridgeDuration();

  // Safe migration: Add visual_style to re_campaigns
  const migrateReCampaignsVisualStyle = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'visual_style')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN visual_style TEXT DEFAULT 'Cinematic'").run();
        console.log('[DB Migration] Added column visual_style to re_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns visual_style migration:', e.message);
    }
  };
  migrateReCampaignsVisualStyle();

  // Safe migration: Add visual_style to sheets_campaigns
  const migrateSheetsCampaignsVisualStyle = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(sheets_campaigns)').all();
      if (!cols.find(c => c.name === 'visual_style')) {
        db.prepare("ALTER TABLE sheets_campaigns ADD COLUMN visual_style TEXT DEFAULT 'Cinematic'").run();
        console.log('[DB Migration] Added column visual_style to sheets_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped sheets_campaigns visual_style migration:', e.message);
    }
  };
  migrateSheetsCampaignsVisualStyle();

  // Safe migration: Add retry_count to sheets_jobs
  const migrateSheetsJobsRetryCount = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(sheets_jobs)').all();
      if (!cols.find(c => c.name === 'retry_count')) {
        db.prepare('ALTER TABLE sheets_jobs ADD COLUMN retry_count INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column retry_count to sheets_jobs');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped sheets_jobs retry_count migration:', e.message);
    }
  };
  migrateSheetsJobsRetryCount();

  // Safe migration: Add account_name, google_sheet_id, product_url, affiliate_url, product_photo_url to content_planners, and video_id to content_planner_rows
  const migrateContentPlannersFields = () => {
    try {
      const cpCols = db.prepare('PRAGMA table_info(content_planners)').all().map(c => c.name);
      if (!cpCols.includes('account_name')) db.prepare('ALTER TABLE content_planners ADD COLUMN account_name TEXT').run();
      if (!cpCols.includes('google_sheet_id')) db.prepare('ALTER TABLE content_planners ADD COLUMN google_sheet_id TEXT').run();
      if (!cpCols.includes('product_url')) db.prepare('ALTER TABLE content_planners ADD COLUMN product_url TEXT').run();
      if (!cpCols.includes('affiliate_url')) db.prepare('ALTER TABLE content_planners ADD COLUMN affiliate_url TEXT').run();
      if (!cpCols.includes('product_photo_url')) db.prepare('ALTER TABLE content_planners ADD COLUMN product_photo_url TEXT').run();

      const cprCols = db.prepare('PRAGMA table_info(content_planner_rows)').all().map(c => c.name);
      if (!cprCols.includes('video_id')) db.prepare('ALTER TABLE content_planner_rows ADD COLUMN video_id TEXT').run();
    } catch (e) {
      console.warn('[DB Migration] Skipped content_planners fields migration:', e.message);
    }
  };
  migrateContentPlannersFields();

  // Safe migration: Add prompts_json & captions_json to sheets_jobs
  const migrateSheetsJobsMetadata = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(sheets_jobs)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE sheets_jobs ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to sheets_jobs`);
        }
      };
      addColumn('prompts_json', 'TEXT');
      addColumn('captions_json', 'TEXT');
    } catch (e) {
      console.warn('[DB Migration] Skipped sheets_jobs metadata migration:', e.message);
    }
  };
  migrateSheetsJobsMetadata();

  // Safe migration: Add visual_status, ffmpeg_status, and visual_clip_paths to sheets_jobs
  const migrateSheetsJobsState = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(sheets_jobs)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE sheets_jobs ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to sheets_jobs`);
        }
      };
      addColumn('script_status', "TEXT DEFAULT 'pending'");
      addColumn('tts_status', "TEXT DEFAULT 'pending'");
      addColumn('visual_status', "TEXT DEFAULT 'pending'");
      addColumn('ffmpeg_status', "TEXT DEFAULT 'pending'");
      addColumn('visual_clip_paths', 'TEXT');
    } catch (e) {
      console.warn('[DB Migration] Skipped sheets_jobs state migration:', e.message);
    }
  };
  migrateSheetsJobsState();

  // Safe migration: Add FFmpeg custom configurations to pillar_campaigns (v10.5.4)
  const migratePillarCampaignsFfmpegSettings = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE pillar_campaigns ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to pillar_campaigns`);
        }
      };
      addColumn('ffmpeg_sync_option', "TEXT DEFAULT 'smart_sync'");
      addColumn('ffmpeg_video_scale', 'REAL DEFAULT 1.0');
      addColumn('ffmpeg_sfx_volume', 'REAL DEFAULT 0.0');
      addColumn('ffmpeg_bgm_volume', 'REAL DEFAULT 0.15');
    } catch (e) {
      console.warn('[DB Migration] Skipped pillar_campaigns FFmpeg settings migration:', e.message);
    }
  };
  migratePillarCampaignsFfmpegSettings();

  // Safe migration: Add Facebook Page and Server URL columns to re_campaigns & pillar_campaigns (v10.6)
  const migrateFacebookPageAndServerUrl = () => {
    try {
      // 1. For re_campaigns
      const colsRe = db.prepare('PRAGMA table_info(re_campaigns)').all();
      const addColumnRe = (name, typeAndDefault) => {
        if (!colsRe.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaigns ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaigns`);
        }
      };
      addColumnRe('facebook_page_id', 'TEXT');
      addColumnRe('facebook_server_url', 'TEXT');

      // 2. For pillar_campaigns
      const colsPillar = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      const addColumnPillar = (name, typeAndDefault) => {
        if (!colsPillar.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE pillar_campaigns ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to pillar_campaigns`);
        }
      };
      addColumnPillar('post_facebook_draft', 'INTEGER DEFAULT 0');
      addColumnPillar('facebook_page_id', 'TEXT');
      addColumnPillar('facebook_server_url', 'TEXT');
    } catch (e) {
      console.warn('[DB Migration] Skipped Facebook Page and Server URL migration:', e.message);
    }
  };
  migrateFacebookPageAndServerUrl();



  // Safe migration: Add status & tracking columns to re_campaign_items
  const migrateReCampaignItemsWorkflowV65 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaign_items)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaign_items ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaign_items`);
        }
      };
      addColumn('tts_status', 'TEXT DEFAULT \'pending\'');
      addColumn('tts_batch_id', 'TEXT');
      addColumn('visual_status', 'TEXT DEFAULT \'pending\'');
      addColumn('visual_tasks_json', 'TEXT');
      addColumn('visual_clip_paths', 'TEXT');
      addColumn('ffmpeg_status', 'TEXT DEFAULT \'pending\'');
      addColumn('ffmpeg_output_path', 'TEXT');
      addColumn('upload_status', 'TEXT DEFAULT \'pending\'');
      addColumn('drive_link', 'TEXT');
      addColumn('social_post_status', 'TEXT DEFAULT \'pending\'');
      addColumn('social_links_json', 'TEXT');
      addColumn('retry_count', 'INTEGER DEFAULT 0');
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaign_items V6.5 workflow migration:', e.message);
    }
  };
  migrateReCampaignItemsWorkflowV65();

  // Safe migration: Add FFmpeg custom configurations to re_campaigns
  const migrateReCampaignsFfmpegSettingsV66 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaigns ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaigns`);
        }
      };
      addColumn('ffmpeg_sync_option', 'TEXT DEFAULT \'shortest\'');
      addColumn('ffmpeg_video_scale', 'REAL DEFAULT 1.0');
      addColumn('ffmpeg_sfx_volume', 'REAL DEFAULT 0.0');
      addColumn('ffmpeg_bgm_volume', 'REAL DEFAULT 0.15');
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns V6.6 FFmpeg settings migration:', e.message);
    }
  };
  migrateReCampaignsFfmpegSettingsV66();

  // Safe migration: Add video_model to re_campaigns (v7.2)
  const migrateReCampaignsVideoModelV72 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'video_model')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN video_model TEXT DEFAULT 'veo_31_lite'").run();
        console.log("[DB Migration] Added column video_model to re_campaigns");
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns video_model migration:', e.message);
    }
  };
  migrateReCampaignsVideoModelV72();

  // Safe migration: Add local_scheduler to re_campaigns (v7.3)
  const migrateReCampaignsLocalSchedulerV73 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'local_scheduler')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN local_scheduler INTEGER DEFAULT 0").run();
        console.log("[DB Migration] Added column local_scheduler to re_campaigns");
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns local_scheduler migration:', e.message);
    }
  };
  migrateReCampaignsLocalSchedulerV73();

  // Safe migration: Add scheduler_pause_at to re_campaigns (v7.4)
  // Allows per-campaign "pause before phase" for manual review in local scheduler mode
  const migrateReCampaignsPauseAtV74 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'scheduler_pause_at')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN scheduler_pause_at TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column scheduler_pause_at to re_campaigns");
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns scheduler_pause_at migration:', e.message);
    }
  };
  migrateReCampaignsPauseAtV74();

  // Safe migration: Add words_per_clip and face_visibility to re_campaigns (v7.5)
  const migrateReCampaignsCustomConfigsV75 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'words_per_clip')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN words_per_clip TEXT DEFAULT '17-19 kata'").run();
        console.log("[DB Migration] Added column words_per_clip to re_campaigns");
      }
      if (!cols.find(c => c.name === 'face_visibility')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN face_visibility TEXT DEFAULT 'Faceless'").run();
        console.log("[DB Migration] Added column face_visibility to re_campaigns");
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns custom configurations migration:', e.message);
    }
  };
  migrateReCampaignsCustomConfigsV75();

  // Safe migration: Add enable_tts, enable_ffmpeg, and enable_social_post to re_campaigns (v8.0)
  const migrateReCampaignsWorkmodeOptionsV80 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaigns ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaigns`);
        }
      };
      addColumn('enable_tts', 'INTEGER DEFAULT 1');
      addColumn('enable_ffmpeg', 'INTEGER DEFAULT 1');
      addColumn('enable_social_post', 'INTEGER DEFAULT 1');
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns workmode options migration:', e.message);
    }
  };
  migrateReCampaignsWorkmodeOptionsV80();

  // Safe migration: Add visual_mode, product_ref_image_path, product_filename_declare and t2i_start_frame_path (v8.1)
  const migrateReCampaignsBridgingV81 = () => {
    try {
      const colsCampaign = db.prepare('PRAGMA table_info(re_campaigns)').all();
      const addCampaignCol = (name, typeAndDefault) => {
        if (!colsCampaign.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaigns ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaigns`);
        }
      };
      addCampaignCol('visual_mode', "TEXT DEFAULT 'pure_t2v'");
      addCampaignCol('product_ref_image_path', 'TEXT');
      addCampaignCol('product_filename_declare', 'TEXT');

      const colsItems = db.prepare('PRAGMA table_info(re_campaign_items)').all();
      if (!colsItems.find(c => c.name === 't2i_start_frame_path')) {
        db.prepare('ALTER TABLE re_campaign_items ADD COLUMN t2i_start_frame_path TEXT').run();
        console.log('[DB Migration] Added column t2i_start_frame_path to re_campaign_items');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns bridging v8.1 migration:', e.message);
    }
  };
  migrateReCampaignsBridgingV81();

  // Safe migration: Add angle_multiplier to re_campaigns (v8.3)
  const migrateReCampaignsAngleMultiplierV83 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'angle_multiplier')) {
        db.prepare('ALTER TABLE re_campaigns ADD COLUMN angle_multiplier INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column angle_multiplier to re_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns angle_multiplier migration:', e.message);
    }
  };
  migrateReCampaignsAngleMultiplierV83();

  // Safe migration: Add enable_glabs to re_campaigns
  const migrateReCampaignsEnableGlabsV8x = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'enable_glabs')) {
        db.prepare('ALTER TABLE re_campaigns ADD COLUMN enable_glabs INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column enable_glabs to re_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns enable_glabs migration:', e.message);
    }
  };
  migrateReCampaignsEnableGlabsV8x();

  // Safe migration: Change scheduler config for re_plus_recomm to manual mode (v8.2)
  const migrateSchedulerConfigRePlusRecommV82 = () => {
    try {
      db.prepare("UPDATE scheduler_config SET mode = 'manual', is_enabled = 0 WHERE queue_name = 're_plus_recomm'").run();
      console.log("[DB Migration] Changed re_plus_recomm mode to manual in scheduler_config");
    } catch (e) {
      console.warn('[DB Migration] Skipped re_plus_recomm scheduler_config migration:', e.message);
    }
  };
  migrateSchedulerConfigRePlusRecommV82();

  // Safe migration: Add visual_overrides_json to re_campaigns (v8.4)
  const migrateReCampaignsVisualOverridesV84 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'visual_overrides_json')) {
        db.prepare('ALTER TABLE re_campaigns ADD COLUMN visual_overrides_json TEXT').run();
        console.log('[DB Migration] Added column visual_overrides_json to re_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns visual_overrides_json migration:', e.message);
    }
  };
  migrateReCampaignsVisualOverridesV84();

  // Safe migration: Clean up visual_style_preset for non-mascot human demographics (v10.20.47)
  const cleanupVsoHumanPresetsV102047 = () => {
    try {
      const cleanupTable = (tableName) => {
        const rows = db.prepare(`SELECT id, visual_overrides_json FROM ${tableName} WHERE visual_overrides_json IS NOT NULL`).all();
        for (const row of rows) {
          try {
            const vso = JSON.parse(row.visual_overrides_json);
            if (vso && vso.subject_demographic && !vso.subject_demographic.startsWith('mascot_universe_') && vso.visual_style_preset !== null) {
              vso.visual_style_preset = null;
              db.prepare(`UPDATE ${tableName} SET visual_overrides_json = ? WHERE id = ?`).run(JSON.stringify(vso), row.id);
            }
          } catch (e) {}
        }
      };
      cleanupTable('pillar_campaigns');
      cleanupTable('re_campaigns');
    } catch (e) {
      console.warn('[DB Migration] Skipped VSO human presets cleanup:', e.message);
    }
  };
  cleanupVsoHumanPresetsV102047();

  // Safe migration: Create Organic Pillar Campaign tables (v8.5)
  const migrateOrganicPillarV85 = () => {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pillar_campaigns (
          id TEXT PRIMARY KEY,
          campaign_name TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          content_pillar TEXT NOT NULL,
          custom_hook TEXT NOT NULL,
          visual_action_guideline TEXT NOT NULL,
          custom_instruction TEXT,
          brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL,
          narrative_mode TEXT DEFAULT 'Storytelling',
          visual_style TEXT DEFAULT 'Cinematic',
          face_visibility TEXT DEFAULT 'Faceless',
          is_bridging_active INTEGER DEFAULT 0,
          target_clips_count INTEGER DEFAULT 4,
          bridge_at_clip INTEGER DEFAULT 2,
          bridging_mode TEXT DEFAULT 'select_existing',
          target_product_id TEXT REFERENCES product_extractions(id) ON DELETE SET NULL,
          ephemeral_product_data TEXT,
          aspect_ratio TEXT DEFAULT '9:16',
          target_ai TEXT DEFAULT 'Google Veo (8s)',
          video_model TEXT DEFAULT 'veo_31_lite',
          visual_mode TEXT DEFAULT 'hybrid_lock',
          product_ref_image_path TEXT,
          product_filename_declare TEXT,
          visual_overrides_json TEXT,
          enable_tts INTEGER DEFAULT 0,
          enable_glabs INTEGER DEFAULT 0,
          enable_ffmpeg INTEGER DEFAULT 0,
          enable_social_post INTEGER DEFAULT 0,
          post_facebook_draft INTEGER DEFAULT 0,
          facebook_page_id TEXT,
          facebook_server_url TEXT,
          upload_markdown INTEGER DEFAULT 0,
          upload_spreadsheet INTEGER DEFAULT 0,
          target_spreadsheet_id TEXT,
          target_markdown_url TEXT,
          local_scheduler INTEGER DEFAULT 0,
          scheduler_pause_at TEXT,
          voice_provider TEXT DEFAULT 'minimax',
          voice_persona TEXT DEFAULT 'Indonesian_casual_reporter_vv2',
          words_per_clip TEXT DEFAULT '17-19 kata',
          is_mass_production INTEGER DEFAULT 0,
          tts_model_quality TEXT DEFAULT 'speech-2.8-turbo',
          voice_speed REAL DEFAULT 1.0,
          target_language TEXT DEFAULT 'id-ID',
          ffmpeg_sync_option TEXT DEFAULT 'smart_sync',
          ffmpeg_video_scale REAL DEFAULT 1.0,
          ffmpeg_sfx_volume REAL DEFAULT 0.0,
          ffmpeg_bgm_volume REAL DEFAULT 0.15,
          fb_draft_mode TEXT DEFAULT 'auto',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );


        CREATE TABLE IF NOT EXISTS pillar_campaign_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id TEXT NOT NULL REFERENCES pillar_campaigns(id) ON DELETE CASCADE,
          generation_status TEXT DEFAULT 'pending',
          result_json TEXT,
          tts_status TEXT DEFAULT 'pending',
          tts_batch_id TEXT,
          visual_status TEXT DEFAULT 'pending',
          visual_tasks_json TEXT,
          visual_clip_paths TEXT,
          ffmpeg_status TEXT DEFAULT 'pending',
          ffmpeg_output_path TEXT,
          upload_status TEXT DEFAULT 'pending',
          drive_link TEXT,
          social_post_status TEXT DEFAULT 'pending',
          social_links_json TEXT,
          t2i_start_frame_path TEXT,
          retry_count INTEGER DEFAULT 0,
          row_creative_payload TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Safe migration: Add G Labs, Drive Upload, and Local Scheduler columns to pillar_campaigns (v8.5.1/v8.5.2)
      const columnsToAdd = [
        { name: 'enable_glabs', type: 'INTEGER DEFAULT 0' },
        { name: 'upload_markdown', type: 'INTEGER DEFAULT 0' },
        { name: 'upload_spreadsheet', type: 'INTEGER DEFAULT 0' },
        { name: 'target_spreadsheet_id', type: 'TEXT' },
        { name: 'target_markdown_url', type: 'TEXT' },
        { name: 'local_scheduler', type: 'INTEGER DEFAULT 0' },
        { name: 'scheduler_pause_at', type: 'TEXT' },
        { name: 'voice_speed', type: 'REAL DEFAULT 1.0' },
        { name: 'voice_volume', type: 'REAL DEFAULT 1.0' }
      ];

      for (const col of columnsToAdd) {
        try {
          db.exec(`ALTER TABLE pillar_campaigns ADD COLUMN ${col.name} ${col.type}`);
          console.log(`[DB Migration] Added column ${col.name} to pillar_campaigns`);
        } catch (e) {
          // Expected to fail if column already exists
        }
      }

      console.log('[DB Migration] Verified Organic Pillar Campaign V8.5/V8.5.2 tables exist');
    } catch (e) {
      console.warn('[DB Migration] Skipped Organic Pillar Campaign V8.5 migration:', e.message);
    }
  };
  migrateOrganicPillarV85();

  // Safe migration: Add target_audience column to content_planners
  const migrateContentPlannerTargetAudience = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(content_planners)').all();
      if (!cols.find(c => c.name === 'target_audience')) {
        db.prepare('ALTER TABLE content_planners ADD COLUMN target_audience TEXT').run();
        console.log('[DB Migration] Added column target_audience to content_planners');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped content_planners target_audience migration:', e.message);
    }
  };
  migrateContentPlannerTargetAudience();

  const migrateContentPlannerDualMode = () => {
    try {
      const plannerCols = db.prepare('PRAGMA table_info(content_planners)').all().map(c => c.name);
      const plannerFields = [
        ['planner_focus', "TEXT DEFAULT 'product_campaign'"],
        ['brand_context', 'TEXT'],
        ['content_goal', 'TEXT'],
        ['pillars_json', "TEXT DEFAULT '[]'"],
        ['pillar_distribution_mode', "TEXT DEFAULT 'balanced'"]
      ];
      for (const [name, type] of plannerFields) {
        if (!plannerCols.includes(name)) db.prepare(`ALTER TABLE content_planners ADD COLUMN ${name} ${type}`).run();
      }
      const rowCols = db.prepare('PRAGMA table_info(content_planner_rows)').all().map(c => c.name);
      const rowFields = [
        ['content_subject', 'TEXT'],
        ['product_reference', 'TEXT'],
        ['commercial_intent', "TEXT DEFAULT 'soft_sell'"],
        ['cta_type', "TEXT DEFAULT 'product'"]
      ];
      for (const [name, type] of rowFields) {
        if (!rowCols.includes(name)) db.prepare(`ALTER TABLE content_planner_rows ADD COLUMN ${name} ${type}`).run();
      }
      db.prepare("UPDATE content_planners SET planner_focus = 'product_campaign' WHERE planner_focus IS NULL").run();
    } catch (e) {
      console.warn('[DB Migration] Skipped Content Planner dual-mode migration:', e.message);
    }
  };
  migrateContentPlannerDualMode();

  const migrateOperatorJobs = () => {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS operator_jobs (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
          idempotency_key TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          request_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          current_stage TEXT NOT NULL DEFAULT 'queued',
          planner_id TEXT,
          campaign_id TEXT,
          result_json TEXT,
          error_code TEXT,
          error_message TEXT,
          locked_at DATETIME,
          locked_by TEXT,
          next_attempt_at DATETIME,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS operator_jobs_tenant_idempotency_uq
          ON operator_jobs (tenant_id, idempotency_key);
        CREATE TABLE IF NOT EXISTS operator_job_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
          job_id TEXT NOT NULL REFERENCES operator_jobs(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          event_json TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS operator_job_events_job_idx
          ON operator_job_events (tenant_id, job_id, created_at);
      `);
      const operatorColumns = db.prepare('PRAGMA table_info(operator_jobs)').all();
      if (!operatorColumns.find(column => column.name === 'next_attempt_at')) {
        db.prepare('ALTER TABLE operator_jobs ADD COLUMN next_attempt_at DATETIME').run();
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped Operator API migration:', e.message);
    }
  };
  migrateOperatorJobs();

  // Safe migration: Add mass production columns (v8.6)
  const migrateOrganicPillarV86 = () => {
    try {
      const colsCampaign = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      if (!colsCampaign.find(c => c.name === 'is_mass_production')) {
        db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN is_mass_production INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column is_mass_production to pillar_campaigns');
      }

      const colsItems = db.prepare('PRAGMA table_info(pillar_campaign_items)').all();
      if (!colsItems.find(c => c.name === 'row_creative_payload')) {
        db.prepare('ALTER TABLE pillar_campaign_items ADD COLUMN row_creative_payload TEXT').run();
        console.log('[DB Migration] Added column row_creative_payload to pillar_campaign_items');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped Organic Pillar Campaign V8.6 migration:', e.message);
    }
  };
  migrateOrganicPillarV86();

  // Safe migration: Add tts_model_quality column (v8.7 / MiniMax V2 upgrade)
  const migrateTtsModelQuality = () => {
    try {
      const colsRe = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!colsRe.find(c => c.name === 'tts_model_quality')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN tts_model_quality TEXT DEFAULT 'speech-2.8-turbo'").run();
        console.log("[DB Migration] Added column tts_model_quality to re_campaigns");
      }
      
      const colsBatches = db.prepare('PRAGMA table_info(tts_studio_batches)').all();
      if (!colsBatches.find(c => c.name === 'tts_model_quality')) {
        db.prepare("ALTER TABLE tts_studio_batches ADD COLUMN tts_model_quality TEXT DEFAULT 'speech-2.8-turbo'").run();
        console.log("[DB Migration] Added column tts_model_quality to tts_studio_batches");
      }

      const colsPillar = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      if (colsPillar.length > 0 && !colsPillar.find(c => c.name === 'tts_model_quality')) {
        db.prepare("ALTER TABLE pillar_campaigns ADD COLUMN tts_model_quality TEXT DEFAULT 'speech-2.8-turbo'").run();
        console.log("[DB Migration] Added column tts_model_quality to pillar_campaigns");
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped tts_model_quality migration:', e.message);
    }
  };
  migrateTtsModelQuality();

  // Safe migration: Add target_language to campaigns (v8.9)
  const migrateMultiLanguageV89 = () => {
    try {
      const tables = ['re_campaigns', 'pillar_campaigns', 'instant_campaign_configs'];
      for (const table of tables) {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all();
        if (!cols.find(c => c.name === 'target_language')) {
          db.prepare(`ALTER TABLE ${table} ADD COLUMN target_language TEXT DEFAULT 'id-ID'`).run();
          console.log(`[DB Migration] Added target_language to ${table}`);
        }
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped Multi-Language target_language migration:', e.message);
    }
  };
  migrateMultiLanguageV89();

  // Safe migration: Add target_markdown_url column to re_campaigns
  const migrateReCampaignTargetMarkdownUrl = () => {
    try {
      const colsRe = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!colsRe.find(c => c.name === 'target_markdown_url')) {
        db.prepare('ALTER TABLE re_campaigns ADD COLUMN target_markdown_url TEXT').run();
        console.log('[DB Migration] Added column target_markdown_url to re_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped target_markdown_url to re_campaigns migration:', e.message);
    }
  };
  migrateReCampaignTargetMarkdownUrl();

  // Safe migration: Add mass production to instant_campaigns and create instant_campaign_items (v9.0)
  const migrateInstantFactoryMassV9 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(instant_campaigns)').all();
      if (!cols.find(c => c.name === 'is_mass_production')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN is_mass_production INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column is_mass_production to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'local_scheduler')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN local_scheduler INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column local_scheduler to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'scheduler_pause_at')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN scheduler_pause_at TEXT DEFAULT NULL').run();
        console.log('[DB Migration] Added column scheduler_pause_at to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'enable_glabs')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN enable_glabs INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column enable_glabs to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'enable_tts')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN enable_tts INTEGER DEFAULT 1').run();
        console.log('[DB Migration] Added column enable_tts to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'enable_ffmpeg')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN enable_ffmpeg INTEGER DEFAULT 1').run();
        console.log('[DB Migration] Added column enable_ffmpeg to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'enable_social_post')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN enable_social_post INTEGER DEFAULT 1').run();
        console.log('[DB Migration] Added column enable_social_post to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'post_youtube_draft')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN post_youtube_draft INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column post_youtube_draft to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'post_tiktok_draft')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN post_tiktok_draft INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column post_tiktok_draft to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'post_facebook_draft')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN post_facebook_draft INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column post_facebook_draft to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'is_bridging_active')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN is_bridging_active INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column is_bridging_active to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'bridge_at_clip')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN bridge_at_clip INTEGER DEFAULT 2').run();
        console.log('[DB Migration] Added column bridge_at_clip to instant_campaigns');
      }
      if (!cols.find(c => c.name === 'visual_mode')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN visual_mode TEXT DEFAULT \'hybrid_lock\'').run();
        console.log('[DB Migration] Added column visual_mode to instant_campaigns');
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS instant_campaign_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id TEXT NOT NULL REFERENCES instant_campaigns(id) ON DELETE CASCADE,
          row_creative_payload TEXT,
          generation_status TEXT CHECK(generation_status IN ('pending_sourcing', 'pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
          result_json TEXT,
          tts_status TEXT CHECK(tts_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
          tts_batch_id TEXT,
          visual_status TEXT CHECK(visual_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
          visual_tasks_json TEXT,
          visual_clip_paths TEXT,
          ffmpeg_status TEXT CHECK(ffmpeg_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
          ffmpeg_output_path TEXT,
          upload_status TEXT CHECK(upload_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
          drive_link TEXT,
          social_post_status TEXT CHECK(social_post_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
          social_links_json TEXT,
          retry_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[DB Migration] Verified instant_campaign_items table exists');
    } catch (e) {
      console.warn('[DB Migration] Skipped migrateInstantFactoryMassV9:', e.message);
    }
  };
  migrateInstantFactoryMassV9();

  // Safe migration: Add product database v9.0 columns to product_extractions
  const migrateProductExtractionsV9 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(product_extractions)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE product_extractions ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to product_extractions`);
        }
      };
      addColumn('category', 'TEXT');
      addColumn('tags', 'TEXT');
      addColumn('photo_url', 'TEXT');
      addColumn('source_url', 'TEXT');
      addColumn('affiliate_link', 'TEXT');
      addColumn('raw_description', 'TEXT');
      addColumn('scraped_image_url', 'TEXT'); // URL CDN asli foto produk untuk fallback re-download
      addColumn('raw_photo_url', 'TEXT');
      addColumn('clean_photo_url', 'TEXT');
    } catch (e) {
      console.warn('[DB Migration] Skipped product_extractions v9 migration:', e.message);
    }
  };
  migrateProductExtractionsV9();

  // Safe migration: Add product database v10.2 columns to product_extractions
  const migrateProductExtractionsV10 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(product_extractions)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE product_extractions ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to product_extractions`);
        }
      };
      addColumn('cleaned_photo_url', 'TEXT');
      addColumn('t2i_prompt', 'TEXT');
      addColumn('generated_photo_url', 'TEXT');
      addColumn('active_photo', "TEXT DEFAULT 'generated_photo_url'");
      addColumn('is_in_packaging', 'INTEGER DEFAULT 0');
      addColumn('packaging_type', 'TEXT');
      addColumn('i2v_action_prompt', 'TEXT');

      // Initialize existing rows for backward compatibility
      db.prepare(`
        UPDATE product_extractions
        SET cleaned_photo_url = clean_photo_url
        WHERE cleaned_photo_url IS NULL AND clean_photo_url IS NOT NULL
      `).run();

      db.prepare(`
        UPDATE product_extractions
        SET active_photo = 'cleaned_photo_url'
        WHERE active_photo IS NULL AND clean_photo_url IS NOT NULL AND generated_photo_url IS NULL
      `).run();
    } catch (e) {
      console.warn('[DB Migration] Skipped product_extractions v10 migration:', e.message);
    }
  };
  migrateProductExtractionsV10();

  // Safe migration: Add product database v10.14.0 columns for bulk enrichment to product_extractions
  const migrateProductExtractionsV11 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(product_extractions)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE product_extractions ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to product_extractions`);
        }
      };
      addColumn('extraction_status', "TEXT DEFAULT 'completed'");
      addColumn('glabs_task_id', 'TEXT');
      addColumn('clean_photo_t2i_prompt', 'TEXT');
    } catch (e) {
      console.warn('[DB Migration] Skipped product_extractions v11 migration:', e.message);
    }
  };
  migrateProductExtractionsV11();

  // Safe migration: Add product_truth & geometric_truth columns to product_extractions
  const migrateProductExtractionsV12 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(product_extractions)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE product_extractions ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to product_extractions`);
        }
      };
      addColumn('product_truth', 'TEXT');
      addColumn('geometric_truth', 'TEXT');
    } catch (e) {
      console.warn('[DB Migration] Skipped product_extractions v12 migration:', e.message);
    }
  };
  migrateProductExtractionsV12();

  // Safe migration: Add nextcloud output URLs to re_multiplier_tasks
  const migrateReMultiplierNextcloud = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_multiplier_tasks)').all();
      if (!cols.find(c => c.name === 'nextcloud_video_url')) {
        db.prepare('ALTER TABLE re_multiplier_tasks ADD COLUMN nextcloud_video_url TEXT').run();
        console.log('[DB Migration] Added column nextcloud_video_url to re_multiplier_tasks');
      }
      if (!cols.find(c => c.name === 'nextcloud_md_url')) {
        db.prepare('ALTER TABLE re_multiplier_tasks ADD COLUMN nextcloud_md_url TEXT').run();
        console.log('[DB Migration] Added column nextcloud_md_url to re_multiplier_tasks');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped Nextcloud migration for re_multiplier_tasks:', e.message);
    }
  };
  migrateReMultiplierNextcloud();

  // Safe migration: Add tags to re_deconstructed_assets
  const migrateReDeconstructedAssetsTags = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_deconstructed_assets)').all();
      if (!cols.find(c => c.name === 'tags')) {
        db.prepare('ALTER TABLE re_deconstructed_assets ADD COLUMN tags TEXT').run();
        console.log('[DB Migration] Added column tags to re_deconstructed_assets');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped tags migration for re_deconstructed_assets:', e.message);
    }
  };
  migrateReDeconstructedAssetsTags();

  // Safe migration: Add nextcloud_parent_folder to re_campaigns and pillar_campaigns
  const migrateNextcloudParentFolderV10 = () => {
    try {
      const reCols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!reCols.find(c => c.name === 'nextcloud_parent_folder')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN nextcloud_parent_folder TEXT DEFAULT 'MAKNA_Production_Final'").run();
        console.log('[DB Migration] Added column nextcloud_parent_folder to re_campaigns');
      }

      const pillarCols = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      if (!pillarCols.find(c => c.name === 'nextcloud_parent_folder')) {
        db.prepare("ALTER TABLE pillar_campaigns ADD COLUMN nextcloud_parent_folder TEXT DEFAULT 'MAKNA_Production_Final'").run();
        console.log('[DB Migration] Added column nextcloud_parent_folder to pillar_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped nextcloud_parent_folder migration:', e.message);
    }
  };
  migrateNextcloudParentFolderV10();

  // Safe migration: Add fb_draft_mode to re_campaigns and pillar_campaigns
  const migrateFBDraftModeV11 = () => {
    try {
      const reCols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!reCols.find(c => c.name === 'fb_draft_mode')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN fb_draft_mode TEXT DEFAULT 'auto'").run();
        console.log('[DB Migration] Added column fb_draft_mode to re_campaigns');
      }

      const pillarCols = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      if (!pillarCols.find(c => c.name === 'fb_draft_mode')) {
        db.prepare("ALTER TABLE pillar_campaigns ADD COLUMN fb_draft_mode TEXT DEFAULT 'auto'").run();
        console.log('[DB Migration] Added column fb_draft_mode to pillar_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped fb_draft_mode migration:', e.message);
    }
  };
  migrateFBDraftModeV11();

  // Safe migration: Add bridge_duration_clips to pillar_campaigns table
  const migratePillarCampaignBridgeDurationClips = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      if (!cols.find(c => c.name === 'bridge_duration_clips')) {
        db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN bridge_duration_clips INTEGER DEFAULT 1').run();
        console.log('[DB Migration] Added column bridge_duration_clips to pillar_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped bridge_duration_clips migration for pillar_campaigns:', e.message);
    }
  };
  migratePillarCampaignBridgeDurationClips();

  // Safe migration: Add sfx_setting to re_campaigns and pillar_campaigns (v10.8.4)
  const migrateSfxSetting = () => {
    try {
      const reCols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!reCols.find(c => c.name === 'sfx_setting')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN sfx_setting TEXT DEFAULT 'without_sfx'").run();
        console.log('[DB Migration] Added column sfx_setting to re_campaigns');
      }

      const pillarCols = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      if (!pillarCols.find(c => c.name === 'sfx_setting')) {
        db.prepare("ALTER TABLE pillar_campaigns ADD COLUMN sfx_setting TEXT DEFAULT 'without_sfx'").run();
        console.log('[DB Migration] Added column sfx_setting to pillar_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped sfx_setting migration:', e.message);
    }
  };
  migrateSfxSetting();

  // Safe migration: Add enable_audio_segment + voice_cast_json to re_campaigns, pillar_campaigns, sheets_campaigns (v10.19.0)
  const migrateAudioSegmentAndVoiceCast = () => {
    try {
      const reCols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!reCols.find(c => c.name === 'enable_audio_segment')) {
        db.prepare('ALTER TABLE re_campaigns ADD COLUMN enable_audio_segment INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added enable_audio_segment to re_campaigns');
      }
      if (!reCols.find(c => c.name === 'voice_cast_json')) {
        db.prepare('ALTER TABLE re_campaigns ADD COLUMN voice_cast_json TEXT').run();
        console.log('[DB Migration] Added voice_cast_json to re_campaigns');
      }

      const pillarCols = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      if (!pillarCols.find(c => c.name === 'enable_audio_segment')) {
        db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN enable_audio_segment INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added enable_audio_segment to pillar_campaigns');
      }
      if (!pillarCols.find(c => c.name === 'voice_cast_json')) {
        db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN voice_cast_json TEXT').run();
        console.log('[DB Migration] Added voice_cast_json to pillar_campaigns');
      }

      const sheetsCols = db.prepare('PRAGMA table_info(sheets_campaigns)').all();
      if (!sheetsCols.find(c => c.name === 'enable_audio_segment')) {
        db.prepare('ALTER TABLE sheets_campaigns ADD COLUMN enable_audio_segment INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added enable_audio_segment to sheets_campaigns');
      }
      if (!sheetsCols.find(c => c.name === 'voice_cast_json')) {
        db.prepare('ALTER TABLE sheets_campaigns ADD COLUMN voice_cast_json TEXT').run();
        console.log('[DB Migration] Added voice_cast_json to sheets_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped audio_segment + voice_cast migration:', e.message);
    }
  };
  migrateAudioSegmentAndVoiceCast();

  // Safe migration: Disable campaign and scraper queue auto-scheduling in scheduler_config (v9.7.5)
  const migrateSchedulerConfigCampaignsManual = () => {
    try {
      db.prepare(`
        UPDATE scheduler_config 
        SET is_enabled = 0, mode = 'manual' 
        WHERE queue_name LIKE 're_%' 
           OR queue_name LIKE 'pillar_%' 
           OR queue_name = 'glabs_campaign'
           OR queue_name = 'product_scraper'
      `).run();
      console.log("[DB Migration] Changed all re_*, pillar_*, glabs_campaign, and product_scraper queue modes to manual and disabled.");

      // Clean up historical payload-less completed/failed campaign jobs to shrink the db
      const result = db.prepare(`
        DELETE FROM scheduler_jobs 
        WHERE (queue_name LIKE 're_%' OR queue_name LIKE 'pillar_%') 
          AND payload IS NULL
      `).run();
      console.log(`[DB Migration] Cleaned up ${result.changes} redundant campaign jobs from scheduler_jobs table.`);
      
      // Run VACUUM to reclaim space
      db.prepare('VACUUM').run();
      console.log("[DB Migration] VACUUM executed successfully.");
    } catch (e) {
      console.warn('[DB Migration] Skipped campaign scheduler_config migration:', e.message);
    }
  };
  migrateSchedulerConfigCampaignsManual();

  // Safe migration: Add local_scheduler to recipe_campaigns (v9.7.6)
  const migrateRecipeCampaignsLocalSchedulerV976 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(recipe_campaigns)').all();
      if (!cols.find(c => c.name === 'local_scheduler')) {
        db.prepare('ALTER TABLE recipe_campaigns ADD COLUMN local_scheduler INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column local_scheduler to recipe_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped recipe_campaigns local_scheduler migration:', e.message);
    }
  };
  migrateRecipeCampaignsLocalSchedulerV976();

  // Safe migration: Add RE Campaign V2 Human-in-the-Loop columns to re_campaign_items (v10.0)
  const migrateReCampaignItemsV2 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaign_items)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaign_items ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaign_items`);
        }
      };
      addColumn('original_deconstruction_json', 'TEXT');
      addColumn('new_video_plan_json', 'TEXT');
      addColumn('video_dna_json', 'TEXT');
      addColumn('t2i_images_json', 'TEXT');
      addColumn('workflow_status', "TEXT DEFAULT 'pending'");
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaign_items v2 migration:', e.message);
    }
  };
  migrateReCampaignItemsV2();

  // Safe migration: Add columns for regenerating all start frames to re_campaign_items (v10.3)
  const migrateReCampaignItemsRegenStartFrames = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaign_items)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaign_items ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaign_items`);
        }
      };
      addColumn('regenerate_start_frames_status', 'TEXT DEFAULT NULL');
      addColumn('regenerate_start_frames_progress', 'TEXT DEFAULT NULL');
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaign_items regenerate_start_frames migration:', e.message);
    }
  };
  migrateReCampaignItemsRegenStartFrames();

  // Safe migration: Add sync_mode to re_campaigns (v10.2.1)
  const migrateReCampaignsSyncModeV1021 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!cols.find(c => c.name === 'sync_mode')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN sync_mode TEXT DEFAULT 'auto'").run();
        console.log('[DB Migration] Added column sync_mode to re_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaigns sync_mode migration:', e.message);
    }
  };
  migrateReCampaignsSyncModeV1021();

  // Safe migration: Add OPC Campaign V2 Human-in-the-Loop columns to pillar_campaign_items (v10.3.8)
  const migratePillarCampaignItemsV2 = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(pillar_campaign_items)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE pillar_campaign_items ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to pillar_campaign_items`);
        }
      };
      addColumn('new_video_plan_json', 'TEXT');
      addColumn('video_dna_json', 'TEXT');
      addColumn('t2i_images_json', 'TEXT');
      addColumn('workflow_status', "TEXT DEFAULT 'pending'");
      addColumn('regenerate_start_frames_status', 'TEXT DEFAULT NULL');
      addColumn('regenerate_start_frames_progress', 'TEXT DEFAULT NULL');
    } catch (e) {
      console.warn('[DB Migration] Skipped pillar_campaign_items v2 migration:', e.message);
    }
  };
  migratePillarCampaignItemsV2();

  // Safe migration: Add product_url to re_campaign_items (v10.11)
  const migrateReCampaignItemsProductUrl = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(re_campaign_items)').all();
      if (!cols.find(c => c.name === 'product_url')) {
        db.prepare('ALTER TABLE re_campaign_items ADD COLUMN product_url TEXT DEFAULT NULL').run();
        console.log('[DB Migration] Added column product_url to re_campaign_items');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped re_campaign_items product_url migration:', e.message);
    }
  };
  migrateReCampaignItemsProductUrl();

  // Safe migration: Add TikTok compliance Vo safe check columns (v10.11.1)
  const migrateTikTokSafeComplianceV10111 = () => {
    try {
      // 1. re_campaigns
      const colsReCampaigns = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!colsReCampaigns.find(c => c.name === 'enable_vo_audit')) {
        db.prepare('ALTER TABLE re_campaigns ADD COLUMN enable_vo_audit INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column enable_vo_audit to re_campaigns');
      }

      // 2. pillar_campaigns
      const colsPillarCampaigns = db.prepare('PRAGMA table_info(pillar_campaigns)').all();
      if (!colsPillarCampaigns.find(c => c.name === 'enable_vo_audit')) {
        db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN enable_vo_audit INTEGER DEFAULT 0').run();
        console.log('[DB Migration] Added column enable_vo_audit to pillar_campaigns');
      }

      // 3. re_campaign_items
      const colsReItems = db.prepare('PRAGMA table_info(re_campaign_items)').all();
      const addReItemCol = (name, typeAndDefault) => {
        if (!colsReItems.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE re_campaign_items ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to re_campaign_items`);
        }
      };
      addReItemCol('original_voiceover', 'TEXT DEFAULT NULL');
      addReItemCol('tiktok_safe_voiceover', 'TEXT DEFAULT NULL');
      addReItemCol('compliance_status', "TEXT DEFAULT 'pending'");
      addReItemCol('compliance_score', 'INTEGER DEFAULT 0');
      addReItemCol('compliance_log_json', 'TEXT DEFAULT NULL');
      addReItemCol('selected_vo_version', "TEXT DEFAULT 'original'");

      // 4. pillar_campaign_items
      const colsPillarItems = db.prepare('PRAGMA table_info(pillar_campaign_items)').all();
      const addPillarItemCol = (name, typeAndDefault) => {
        if (!colsPillarItems.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE pillar_campaign_items ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to pillar_campaign_items`);
        }
      };
      addPillarItemCol('original_voiceover', 'TEXT DEFAULT NULL');
      addPillarItemCol('tiktok_safe_voiceover', 'TEXT DEFAULT NULL');
      addPillarItemCol('compliance_status', "TEXT DEFAULT 'pending'");
      addPillarItemCol('compliance_score', 'INTEGER DEFAULT 0');
      addPillarItemCol('compliance_log_json', 'TEXT DEFAULT NULL');
      addPillarItemCol('selected_vo_version', "TEXT DEFAULT 'original'");

      // 5. re_multiplier_tasks
      const colsMultiplierTasks = db.prepare('PRAGMA table_info(re_multiplier_tasks)').all();
      if (colsMultiplierTasks.length > 0) {
        const addMultiplierCol = (name, typeAndDefault) => {
          if (!colsMultiplierTasks.find(c => c.name === name)) {
            db.prepare(`ALTER TABLE re_multiplier_tasks ADD COLUMN ${name} ${typeAndDefault}`).run();
            console.log(`[DB Migration] Added column ${name} to re_multiplier_tasks`);
          }
        };
        addMultiplierCol('enable_vo_audit', 'INTEGER DEFAULT 1');
        addMultiplierCol('original_voiceover', 'TEXT DEFAULT NULL');
        addMultiplierCol('tiktok_safe_voiceover', 'TEXT DEFAULT NULL');
        addMultiplierCol('compliance_status', "TEXT DEFAULT 'pending'");
        addMultiplierCol('compliance_score', 'INTEGER DEFAULT 0');
        addMultiplierCol('compliance_log_json', 'TEXT DEFAULT NULL');
        addMultiplierCol('selected_vo_version', "TEXT DEFAULT 'original'");
      }

      // 6. bridge_injector_campaigns & bridge_injector_items
      const colsBridgeCamp = db.prepare('PRAGMA table_info(bridge_injector_campaigns)').all();
      if (colsBridgeCamp.length > 0 && !colsBridgeCamp.find(c => c.name === 'enable_vo_audit')) {
        db.prepare('ALTER TABLE bridge_injector_campaigns ADD COLUMN enable_vo_audit INTEGER DEFAULT 1').run();
        console.log('[DB Migration] Added column enable_vo_audit to bridge_injector_campaigns');
      }
      if (colsBridgeCamp.length > 0 && !colsBridgeCamp.find(c => c.name === 'account_name')) {
        db.prepare('ALTER TABLE bridge_injector_campaigns ADD COLUMN account_name TEXT DEFAULT NULL').run();
        console.log('[DB Migration] Added column account_name to bridge_injector_campaigns');
      }
      if (colsBridgeCamp.length > 0 && !colsBridgeCamp.find(c => c.name === 'paused_previous_status')) {
        db.prepare('ALTER TABLE bridge_injector_campaigns ADD COLUMN paused_previous_status TEXT DEFAULT NULL').run();
        console.log('[DB Migration] Added column paused_previous_status to bridge_injector_campaigns');
      }

      const colsBridgeItems = db.prepare('PRAGMA table_info(bridge_injector_items)').all();
      if (colsBridgeItems.length > 0) {
        const addBridgeItemCol = (name, typeAndDefault) => {
          if (!colsBridgeItems.find(c => c.name === name)) {
            db.prepare(`ALTER TABLE bridge_injector_items ADD COLUMN ${name} ${typeAndDefault}`).run();
            console.log(`[DB Migration] Added column ${name} to bridge_injector_items`);
          }
        };
        addBridgeItemCol('original_voiceover', 'TEXT DEFAULT NULL');
        addBridgeItemCol('tiktok_safe_voiceover', 'TEXT DEFAULT NULL');
        addBridgeItemCol('compliance_status', "TEXT DEFAULT 'pending'");
        addBridgeItemCol('compliance_score', 'INTEGER DEFAULT 0');
        addBridgeItemCol('account_name', 'TEXT DEFAULT NULL');
        addBridgeItemCol('compliance_log_json', 'TEXT DEFAULT NULL');
        addBridgeItemCol('selected_vo_version', "TEXT DEFAULT 'original'");
      }

      // 7. instant_campaigns & instant_campaign_items
      const colsInstantCamp = db.prepare('PRAGMA table_info(instant_campaigns)').all();
      if (colsInstantCamp.length > 0 && !colsInstantCamp.find(c => c.name === 'enable_vo_audit')) {
        db.prepare('ALTER TABLE instant_campaigns ADD COLUMN enable_vo_audit INTEGER DEFAULT 1').run();
        console.log('[DB Migration] Added column enable_vo_audit to instant_campaigns');
      }

      const colsInstantItems = db.prepare('PRAGMA table_info(instant_campaign_items)').all();
      if (colsInstantItems.length > 0) {
        const addInstantItemCol = (name, typeAndDefault) => {
          if (!colsInstantItems.find(c => c.name === name)) {
            db.prepare(`ALTER TABLE instant_campaign_items ADD COLUMN ${name} ${typeAndDefault}`).run();
            console.log(`[DB Migration] Added column ${name} to instant_campaign_items`);
          }
        };
        addInstantItemCol('original_voiceover', 'TEXT DEFAULT NULL');
        addInstantItemCol('tiktok_safe_voiceover', 'TEXT DEFAULT NULL');
        addInstantItemCol('compliance_status', "TEXT DEFAULT 'pending'");
        addInstantItemCol('compliance_score', 'INTEGER DEFAULT 0');
        addInstantItemCol('compliance_log_json', 'TEXT DEFAULT NULL');
        addInstantItemCol('selected_vo_version', "TEXT DEFAULT 'original'");
      }

    } catch (e) {
      console.warn('[DB Migration] Skipped TikTok Safe compliance migration:', e.message);
    }
  };
  migrateTikTokSafeComplianceV10111();

  // Safe migration: Add bridge_injector_items and campaign_type (v11.0.0)
  const migrateBridgeInjectorBulk = () => {
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS bridge_injector_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id TEXT NOT NULL REFERENCES bridge_injector_campaigns(id) ON DELETE CASCADE,
          original_script_url TEXT NOT NULL,
          product_url TEXT NOT NULL,
          nextcloud_folder TEXT NOT NULL,
          original_script_content TEXT,
          target_product_id TEXT REFERENCES product_extractions(id) ON DELETE SET NULL,
          download_status TEXT DEFAULT 'pending',
          gemini_status TEXT DEFAULT 'pending',
          t2i_status TEXT DEFAULT 'pending',
          i2v_status TEXT DEFAULT 'pending',
          sync_status TEXT DEFAULT 'pending',
          workflow_status TEXT DEFAULT 'pending',
          injected_vo_1 TEXT,
          injected_vo_2 TEXT,
          injected_vo_3 TEXT,
          injected_vo_4 TEXT,
          clip2_t2i_prompt TEXT,
          clip2_i2v_prompt TEXT,
          clip2_t2i_task_id TEXT,
          clip2_t2i_image_path TEXT,
          clip2_i2v_task_id TEXT,
          clip2_video_path TEXT,
          injected_script_md_path TEXT,
          custom_instruction TEXT,
          local_clip1_path TEXT,
          local_clip2_path TEXT,
          local_clip3_path TEXT,
          local_audio_clip1_path TEXT,
          tts_status TEXT DEFAULT 'pending',
          ffmpeg_status TEXT DEFAULT 'pending',
          enable_tts INTEGER DEFAULT 1,
          enable_ffmpeg INTEGER DEFAULT 1,
          voice_provider TEXT DEFAULT 'minimax',
          voice_persona TEXT DEFAULT 'Indonesian_casual_reporter_vv2',
          voice_speed REAL DEFAULT 1.0,
          voice_volume REAL DEFAULT 1.0,
          ffmpeg_video_scale REAL DEFAULT 1.0,
          ffmpeg_sfx_volume REAL DEFAULT 0.0,
          ffmpeg_bgm_volume REAL DEFAULT 0.0,
          ffmpeg_sync_option TEXT DEFAULT 'smart_sync',
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      console.log('[DB Migration] Verified/Created bridge_injector_items table');

      const cols = db.prepare('PRAGMA table_info(bridge_injector_campaigns)').all();
      if (!cols.find(c => c.name === 'campaign_type')) {
        db.prepare("ALTER TABLE bridge_injector_campaigns ADD COLUMN campaign_type TEXT DEFAULT 'single'").run();
        console.log("[DB Migration] Added column campaign_type to bridge_injector_campaigns");
      }
      if (!cols.find(c => c.name === 'custom_instruction')) {
        db.prepare("ALTER TABLE bridge_injector_campaigns ADD COLUMN custom_instruction TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column custom_instruction to bridge_injector_campaigns");
      }
      if (!cols.find(c => c.name === 'enable_tts')) {
        db.prepare("ALTER TABLE bridge_injector_campaigns ADD COLUMN enable_tts INTEGER DEFAULT 1").run();
        console.log("[DB Migration] Added column enable_tts to bridge_injector_campaigns");
      }
      if (!cols.find(c => c.name === 'enable_ffmpeg')) {
        db.prepare("ALTER TABLE bridge_injector_campaigns ADD COLUMN enable_ffmpeg INTEGER DEFAULT 1").run();
        console.log("[DB Migration] Added column enable_ffmpeg to bridge_injector_campaigns");
      }
      if (!cols.find(c => c.name === 'voice_provider')) {
        db.prepare("ALTER TABLE bridge_injector_campaigns ADD COLUMN voice_provider TEXT DEFAULT 'minimax'").run();
        console.log("[DB Migration] Added column voice_provider to bridge_injector_campaigns");
      }
      if (!cols.find(c => c.name === 'voice_persona')) {
        db.prepare("ALTER TABLE bridge_injector_campaigns ADD COLUMN voice_persona TEXT DEFAULT 'Indonesian_casual_reporter_vv2'").run();
        console.log("[DB Migration] Added column voice_persona to bridge_injector_campaigns");
      }
      if (!cols.find(c => c.name === 'voice_speed')) {
        db.prepare("ALTER TABLE bridge_injector_campaigns ADD COLUMN voice_speed REAL DEFAULT 1.0").run();
        console.log("[DB Migration] Added column voice_speed to bridge_injector_campaigns");
      }
      if (!cols.find(c => c.name === 'voice_volume')) {
        db.prepare("ALTER TABLE bridge_injector_campaigns ADD COLUMN voice_volume REAL DEFAULT 1.0").run();
        console.log("[DB Migration] Added column voice_volume to bridge_injector_campaigns");
      }

      const itemCols = db.prepare('PRAGMA table_info(bridge_injector_items)').all();
      if (!itemCols.find(c => c.name === 'custom_instruction')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN custom_instruction TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column custom_instruction to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'local_clip1_path')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN local_clip1_path TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column local_clip1_path to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'local_clip2_path')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN local_clip2_path TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column local_clip2_path to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'local_clip3_path')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN local_clip3_path TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column local_clip3_path to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'local_audio_clip1_path')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN local_audio_clip1_path TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column local_audio_clip1_path to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'tts_status')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN tts_status TEXT DEFAULT 'pending'").run();
        console.log("[DB Migration] Added column tts_status to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'ffmpeg_status')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN ffmpeg_status TEXT DEFAULT 'pending'").run();
        console.log("[DB Migration] Added column ffmpeg_status to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'enable_tts')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN enable_tts INTEGER DEFAULT 1").run();
        console.log("[DB Migration] Added column enable_tts to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'enable_ffmpeg')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN enable_ffmpeg INTEGER DEFAULT 1").run();
        console.log("[DB Migration] Added column enable_ffmpeg to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'voice_provider')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN voice_provider TEXT DEFAULT 'gemini'").run();
        console.log("[DB Migration] Added column voice_provider to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'voice_persona')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN voice_persona TEXT DEFAULT 'Kore'").run();
        console.log("[DB Migration] Added column voice_persona to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'voice_speed')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN voice_speed REAL DEFAULT 1.0").run();
        console.log("[DB Migration] Added column voice_speed to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'voice_volume')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN voice_volume REAL DEFAULT 1.0").run();
        console.log("[DB Migration] Added column voice_volume to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'ffmpeg_video_scale')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN ffmpeg_video_scale REAL DEFAULT 1.0").run();
        console.log("[DB Migration] Added column ffmpeg_video_scale to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'ffmpeg_sfx_volume')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN ffmpeg_sfx_volume REAL DEFAULT 0.0").run();
        console.log("[DB Migration] Added column ffmpeg_sfx_volume to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'ffmpeg_bgm_volume')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN ffmpeg_bgm_volume REAL DEFAULT 0.0").run();
        console.log("[DB Migration] Added column ffmpeg_bgm_volume to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'ffmpeg_sync_option')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN ffmpeg_sync_option TEXT DEFAULT 'smart_sync'").run();
        console.log("[DB Migration] Added column ffmpeg_sync_option to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'original_clip1_filename')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN original_clip1_filename TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column original_clip1_filename to bridge_injector_items");
      }
      if (!itemCols.find(c => c.name === 'nextcloud_url')) {
        db.prepare("ALTER TABLE bridge_injector_items ADD COLUMN nextcloud_url TEXT DEFAULT NULL").run();
        console.log("[DB Migration] Added column nextcloud_url to bridge_injector_items");
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped bridge_injector_items / campaign_type / custom_instruction / tts / ffmpeg migration:', e.message);
    }
  };
  migrateBridgeInjectorBulk();

  // Safe migration: Add narrative_mode to re_campaigns and sheets_campaigns (v10.20.36)
  const migrateNarrativeModeV102036 = () => {
    try {
      const reCols = db.prepare('PRAGMA table_info(re_campaigns)').all();
      if (!reCols.find(c => c.name === 'narrative_mode')) {
        db.prepare("ALTER TABLE re_campaigns ADD COLUMN narrative_mode TEXT DEFAULT 'Storytelling'").run();
        console.log('[DB Migration] Added column narrative_mode to re_campaigns');
      }

      const sheetsCols = db.prepare('PRAGMA table_info(sheets_campaigns)').all();
      if (!sheetsCols.find(c => c.name === 'narrative_mode')) {
        db.prepare("ALTER TABLE sheets_campaigns ADD COLUMN narrative_mode TEXT DEFAULT 'Storytelling'").run();
        console.log('[DB Migration] Added column narrative_mode to sheets_campaigns');
      }
    } catch (e) {
      console.warn('[DB Migration] Skipped narrative_mode migration:', e.message);
    }
  };
  migrateNarrativeModeV102036();

  // Safe migration: Add custom parent folders and webhook override columns to brand_profiles
  const migrateBrandProfilesCustomIntegration = () => {
    try {
      const cols = db.prepare('PRAGMA table_info(brand_profiles)').all();
      const addColumn = (name, typeAndDefault) => {
        if (!cols.find(c => c.name === name)) {
          db.prepare(`ALTER TABLE brand_profiles ADD COLUMN ${name} ${typeAndDefault}`).run();
          console.log(`[DB Migration] Added column ${name} to brand_profiles`);
        }
      };
      addColumn('storage_provider', 'TEXT');
      addColumn('nextcloud_target_folder', 'TEXT');
      addColumn('drive_target_folder', 'TEXT');
      addColumn('drive_glabs_folder_id', 'TEXT');
      addColumn('webhook_host', 'TEXT');
      addColumn('webhook_port', 'TEXT');
      addColumn('webhook_api_key', 'TEXT');

      db.exec(`
        CREATE TABLE IF NOT EXISTS glabs_task_routes (
          task_id TEXT PRIMARY KEY,
          host TEXT NOT NULL,
          port TEXT NOT NULL,
          api_key TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      console.warn('[DB Migration] Skipped brand_profiles custom integration migration:', e.message);
    }
  };
  migrateBrandProfilesCustomIntegration();
}


// ========================
// Knowledge Base Operations
// ========================
export function getAllKnowledgeBases() {
  const db = getDb();
  return db.prepare('SELECT id, name, file_type, file_size, created_at FROM knowledge_bases ORDER BY created_at DESC').all();
}

export function getAllKnowledgeBasesWithContent() {
  const db = getDb();
  return db.prepare('SELECT * FROM knowledge_bases ORDER BY created_at ASC').all();
}

export function getKnowledgeBase(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id);
}

export function getKnowledgeBasesByIds(ids) {
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM knowledge_bases WHERE id IN (${placeholders})`).all(...ids);
}

export function createKnowledgeBase({ id, name, content, file_type, file_size }) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO knowledge_bases (id, name, content, file_type, file_size) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, content, file_type, file_size);
}

export function deleteKnowledgeBase(id) {
  const db = getDb();
  return db.prepare('DELETE FROM knowledge_bases WHERE id = ?').run(id);
}

// ========================
// Ideas Operations
// ========================
export function getAllIdeas() {
  const db = getDb();
  return db.prepare('SELECT * FROM ideas ORDER BY tanggal_dibuat DESC').all();
}

export function getIdea(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM ideas WHERE id = ?').get(id);
}

export function getIdeasByProduct(productName) {
  const db = getDb();
  return db.prepare('SELECT * FROM ideas WHERE product_name = ? ORDER BY tanggal_dibuat DESC').all(productName);
}

export function createIdea(idea) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ideas (id, topik, konteks_cep, category_cep, cep, sub_cep_matrix, vfo, key_messages, kb_digunakan, jumlah_klip,
      narrative_mode, visual_style, words_per_clip, target_ai, face_visibility, aspect_ratio,
      instruksi_tambahan, product_name, product_description, target_audience, jumlah_ide, prompt_output_format, raw_response, status)
    VALUES (@id, @topik, @konteks_cep, @category_cep, @cep, @sub_cep_matrix, @vfo, @key_messages, @kb_digunakan, @jumlah_klip,
      @narrative_mode, @visual_style, @words_per_clip, @target_ai, @face_visibility, @aspect_ratio,
      @instruksi_tambahan, @product_name, @product_description, @target_audience, @jumlah_ide, @prompt_output_format, @raw_response, @status)
  `);
  return stmt.run(idea);
}

export function updateIdea(id, updates) {
  const db = getDb();
  const existing = getIdea(id);
  return db.prepare('UPDATE ideas SET topik = ?, category_cep = ?, cep = ?, sub_cep_matrix = ?, konteks_cep = ?, vfo = ?, key_messages = ?, kb_digunakan = ?, jumlah_klip = ?, narrative_mode = ?, visual_style = ?, words_per_clip = ?, target_ai = ?, face_visibility = ?, aspect_ratio = ?, instruksi_tambahan = ?, product_name = ?, product_description = ?, target_audience = ?, jumlah_ide = ?, prompt_output_format = ?, raw_response = ?, status = ? WHERE id = ?').run(
    updates.topik !== undefined ? updates.topik : existing.topik,
    updates.category_cep !== undefined ? updates.category_cep : existing.category_cep,
    updates.cep !== undefined ? updates.cep : existing.cep,
    updates.sub_cep_matrix !== undefined ? updates.sub_cep_matrix : existing.sub_cep_matrix,
    updates.konteks_cep !== undefined ? updates.konteks_cep : existing.konteks_cep,
    updates.vfo !== undefined ? updates.vfo : existing.vfo,
    updates.key_messages !== undefined ? updates.key_messages : existing.key_messages,
    updates.kb_digunakan !== undefined ? updates.kb_digunakan : existing.kb_digunakan,
    updates.jumlah_klip !== undefined ? updates.jumlah_klip : existing.jumlah_klip,
    updates.narrative_mode !== undefined ? updates.narrative_mode : existing.narrative_mode,
    updates.visual_style !== undefined ? updates.visual_style : existing.visual_style,
    updates.words_per_clip !== undefined ? updates.words_per_clip : existing.words_per_clip,
    updates.target_ai !== undefined ? updates.target_ai : existing.target_ai,
    updates.face_visibility !== undefined ? updates.face_visibility : existing.face_visibility,
    updates.aspect_ratio !== undefined ? updates.aspect_ratio : existing.aspect_ratio,
    updates.instruksi_tambahan !== undefined ? updates.instruksi_tambahan : existing.instruksi_tambahan,
    updates.product_name !== undefined ? updates.product_name : existing.product_name,
    updates.product_description !== undefined ? updates.product_description : existing.product_description,
    updates.target_audience !== undefined ? updates.target_audience : existing.target_audience,
    updates.jumlah_ide !== undefined ? updates.jumlah_ide : existing.jumlah_ide,
    updates.prompt_output_format !== undefined ? updates.prompt_output_format : existing.prompt_output_format,
    updates.raw_response !== undefined ? updates.raw_response : existing.raw_response,
    updates.status !== undefined ? updates.status : existing.status,
    id
  );
}

export function updateIdeaStatus(id, status) {
  const db = getDb();
  return db.prepare('UPDATE ideas SET status = ? WHERE id = ?').run(status, id);
}

export function deleteIdea(id) {
  const db = getDb();
  db.prepare('DELETE FROM assets WHERE idea_id = ?').run(id);
  return db.prepare('DELETE FROM ideas WHERE id = ?').run(id);
}

// ========================
// Assets Operations
// ========================
export function getAssetsByIdeaId(ideaId) {
  const db = getDb();
  return db.prepare('SELECT * FROM assets WHERE idea_id = ? ORDER BY tanggal_dibuat DESC').all(ideaId);
}

export function getAsset(assetId) {
  const db = getDb();
  return db.prepare('SELECT * FROM assets WHERE asset_id = ?').get(assetId);
}

export function createAsset(asset) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO assets (asset_id, idea_id, storyboard, t2i_prompts, i2v_prompts, t2v_prompts,
      tiktok_caption, ig_caption, yt_title, yt_desc, raw_response)
    VALUES (@asset_id, @idea_id, @storyboard, @t2i_prompts, @i2v_prompts, @t2v_prompts,
      @tiktok_caption, @ig_caption, @yt_title, @yt_desc, @raw_response)
  `);
  return stmt.run(asset);
}

export function updateAssetPrompts(assetId, t2iPrompts, i2vPrompts, additionalRawResponse) {
  const db = getDb();
  const currentAsset = db.prepare('SELECT raw_response FROM assets WHERE asset_id = ?').get(assetId);
  const newRawResponse = (currentAsset ? currentAsset.raw_response : '') + '\\n\\n' + additionalRawResponse;
  
  const stmt = db.prepare(`
    UPDATE assets 
    SET t2i_prompts = ?, i2v_prompts = ?, raw_response = ?
    WHERE asset_id = ?
  `);
  return stmt.run(t2iPrompts, i2vPrompts, newRawResponse, assetId);
}

export function getAllAssets() {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, i.topik, i.product_name 
    FROM assets a 
    LEFT JOIN ideas i ON a.idea_id = i.id 
    ORDER BY a.tanggal_dibuat DESC
  `).all();
}

// ========================
// Settings Operations
// ========================
export function getSetting(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  const db = getDb();
  return db.prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  ).run(key, value);
}

// ========================
// Stats
// ========================
export function getStats() {
  const db = getDb();

  let contentReadyCount = 0;
  try {
    const res = db.prepare('SELECT COUNT(*) as count FROM content_flow_items').get();
    contentReadyCount = res ? res.count : 0;
  } catch (e) {}

  let activeCampaignCount = 0;
  try {
    const pillarCount = db.prepare('SELECT COUNT(*) as count FROM pillar_campaigns').get()?.count || 0;
    const stratCount = db.prepare('SELECT COUNT(*) as count FROM strategic_campaigns').get()?.count || 0;
    activeCampaignCount = pillarCount + stratCount;
  } catch (e) {}

  let productCount = 0;
  try {
    const res = db.prepare('SELECT COUNT(*) as count FROM products').get();
    productCount = res ? res.count : 0;
  } catch (e) {}

  let recentItems = [];
  try {
    recentItems = db.prepare(`
      SELECT id, video_id, account_name, hook, nama_produk, tiktok_status, facebook_status, instagram_status, drive_link, nextcloud_url, url_asset, created_at
      FROM content_flow_items
      ORDER BY created_at DESC
      LIMIT 5
    `).all();
  } catch (e) {}

  let platformStats = { tiktokPct: 0, fbPct: 0, igPct: 0 };
  if (contentReadyCount > 0) {
    try {
      const tiktokPub = db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE tiktok_status = 'Published'").get()?.count || 0;
      const fbPub = db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE facebook_status = 'Published'").get()?.count || 0;
      const igPub = db.prepare("SELECT COUNT(*) as count FROM content_flow_items WHERE instagram_status = 'Published'").get()?.count || 0;

      platformStats = {
        tiktokPct: Math.round((tiktokPub / contentReadyCount) * 100),
        fbPct: Math.round((fbPub / contentReadyCount) * 100),
        igPct: Math.round((igPub / contentReadyCount) * 100)
      };
    } catch (e) {}
  }

  let kbCount = 0;
  try {
    kbCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_bases').get()?.count || 0;
  } catch (e) {}

  return {
    contentReadyCount,
    activeCampaignCount,
    productCount,
    recentItems,
    platformStats,
    kbCount
  };
}

// ========================
// Reverse Engineering Operations
// ========================
export function createReverseResult(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO reverse_results (id, source_type, source_url, video_filename, custom_instruction,
      aspect_ratio, target_ai, prompt_output_format, storyboard, voiceover, t2v_prompts,
      tiktok_caption, ig_caption, yt_title, yt_desc, raw_response)
    VALUES (@id, @source_type, @source_url, @video_filename, @custom_instruction,
      @aspect_ratio, @target_ai, @prompt_output_format, @storyboard, @voiceover, @t2v_prompts,
      @tiktok_caption, @ig_caption, @yt_title, @yt_desc, @raw_response)
  `);
  return stmt.run(data);
}

export function getAllReverseResults() {
  const db = getDb();
  return db.prepare('SELECT id, source_type, source_url, video_filename, aspect_ratio, target_ai, custom_instruction, prompt_output_format, tanggal_dibuat FROM reverse_results ORDER BY tanggal_dibuat DESC').all();
}

export function getReverseResult(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM reverse_results WHERE id = ?').get(id);
}

export function deleteReverseResult(id) {
  const db = getDb();
  return db.prepare('DELETE FROM reverse_results WHERE id = ?').run(id);
}

// ========================
// Product Extraction Operations (v54.9)
// ========================
export function createProductExtraction(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO product_extractions (id, input_source, is_url, product_name, product_description,
      unique_selling_point, target_audience, pain_point_solved, key_visuals_extracted, raw_response,
      category, tags, photo_url, source_url, affiliate_link, raw_description, scraped_image_url,
      raw_photo_url, clean_photo_url, cleaned_photo_url, t2i_prompt, generated_photo_url, active_photo,
      is_in_packaging, packaging_type, i2v_action_prompt)
    VALUES (@id, @input_source, @is_url, @product_name, @product_description,
      @unique_selling_point, @target_audience, @pain_point_solved, @key_visuals_extracted, @raw_response,
      @category, @tags, @photo_url, @source_url, @affiliate_link, @raw_description,
      @scraped_image_url, @raw_photo_url, @clean_photo_url, @cleaned_photo_url, @t2i_prompt, @generated_photo_url, @active_photo,
      @is_in_packaging, @packaging_type, @i2v_action_prompt)
  `);
  // Setup safe default keys
  const safeData = { 
    scraped_image_url: null, 
    raw_photo_url: null, 
    clean_photo_url: null, 
    cleaned_photo_url: null,
    t2i_prompt: null,
    generated_photo_url: null,
    active_photo: 'generated_photo_url',
    is_in_packaging: 0,
    packaging_type: null,
    i2v_action_prompt: null,
    ...data 
  };
  return stmt.run(safeData);
}

export function getProductExtraction(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM product_extractions WHERE id = ?').get(id);
}

export function getAllProductExtractions() {
  const db = getDb();
  return db.prepare('SELECT * FROM product_extractions ORDER BY created_at DESC').all();
}

export function updateProductExtraction(id, data) {
  const db = getDb();
  const updates = [];
  const params = { id };
  
  for (const [key, val] of Object.entries(data)) {
    updates.push(`${key} = @${key}`);
    params[key] = val;
  }
  
  if (updates.length === 0) return;
  
  const stmt = db.prepare(`
    UPDATE product_extractions
    SET ${updates.join(', ')}
    WHERE id = @id
  `);
  return stmt.run(params);
}

export function deleteProductExtraction(id) {
  const db = getDb();
  // Also delete related pipeline assets
  db.prepare('DELETE FROM pipeline_assets WHERE product_id = ?').run(id);
  return db.prepare('DELETE FROM product_extractions WHERE id = ?').run(id);
}

// ========================
// Pipeline Asset Operations (v54.9)
// ========================
export function createPipelineAsset(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO pipeline_assets (id, product_id, selected_idea, all_ideas, hot_trend_detected,
      audio_blueprint, visual_storyboard, t2i_prompts, i2v_prompts, t2v_prompts,
      tiktok_caption, ig_caption, yt_title, yt_desc,
      config, raw_responses, current_stage, status)
    VALUES (@id, @product_id, @selected_idea, @all_ideas, @hot_trend_detected,
      @audio_blueprint, @visual_storyboard, @t2i_prompts, @i2v_prompts, @t2v_prompts,
      @tiktok_caption, @ig_caption, @yt_title, @yt_desc,
      @config, @raw_responses, @current_stage, @status)
  `);
  return stmt.run(data);
}

export function updatePipelineAsset(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  return db.prepare(`UPDATE pipeline_assets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getPipelineAsset(id) {
  const db = getDb();
  return db.prepare(`
    SELECT pa.*, pe.product_name, pe.product_description, pe.unique_selling_point, 
           pe.target_audience, pe.pain_point_solved, pe.key_visuals_extracted
    FROM pipeline_assets pa
    LEFT JOIN product_extractions pe ON pa.product_id = pe.id
    WHERE pa.id = ?
  `).get(id);
}

export function getAllPipelineAssets() {
  const db = getDb();
  return db.prepare(`
    SELECT pa.id, pa.product_id, pa.hot_trend_detected, pa.current_stage, pa.status, pa.created_at,
           pe.product_name
    FROM pipeline_assets pa
    LEFT JOIN product_extractions pe ON pa.product_id = pe.id
    ORDER BY pa.created_at DESC
  `).all();
}

export function deletePipelineAsset(id) {
  const db = getDb();
  return db.prepare('DELETE FROM pipeline_assets WHERE id = ?').run(id);
}

// ========================
// Video Library Operations (V3)
// ========================
export function createVideoLibraryEntry(entry) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO video_library (id, source_type, source_url, filename, local_path,
      file_size, mime_type, thumbnail_path, status, error_note, tags)
    VALUES (@id, @source_type, @source_url, @filename, @local_path,
      @file_size, @mime_type, @thumbnail_path, @status, @error_note, @tags)
  `);
  return stmt.run(entry);
}

export function getAllVideoLibrary(search) {
  const db = getDb();
  if (search) {
    return db.prepare(`SELECT * FROM video_library WHERE filename LIKE ? OR tags LIKE ? ORDER BY created_at DESC`)
      .all(`%${search}%`, `%${search}%`);
  }
  return db.prepare('SELECT * FROM video_library ORDER BY created_at DESC').all();
}

export function getVideoById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM video_library WHERE id = ?').get(id);
}

export function updateVideoStatus(id, status, errorNote) {
  const db = getDb();
  return db.prepare('UPDATE video_library SET status = ?, error_note = ? WHERE id = ?').run(status, errorNote || null, id);
}

export function updateVideoLibraryEntry(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  return db.prepare(`UPDATE video_library SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteVideoFromLibrary(id) {
  const db = getDb();
  return db.prepare('DELETE FROM video_library WHERE id = ?').run(id);
}

export function getVideoLibraryStorageUsage() {
  const db = getDb();
  const result = db.prepare('SELECT COALESCE(SUM(file_size), 0) as total_bytes, COUNT(*) as total_files FROM video_library WHERE status = ?').get('ready');
  return result;
}

// ========================
// Scheduler V4: API Key Pool Operations
// ========================

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function addApiKey(keyName, apiKey, tier = 'FREE', dailyLimit = 20) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO gemini_api_keys (key_name, api_key, tier, daily_limit) VALUES (?, ?, ?, ?)'
  ).run(keyName, apiKey, tier, dailyLimit);
}

export function addApiKeysBulk(keysArray) {
  const db = getDb();
  let addedCount = 0;
  let skippedCount = 0;

  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO gemini_api_keys (key_name, api_key, tier, daily_limit) VALUES (?, ?, ?, ?)'
  );

  const bulkTx = db.transaction((keys) => {
    for (const item of keys) {
      const res = insertStmt.run(
        item.key_name,
        item.api_key,
        item.tier || 'FREE',
        item.daily_limit !== undefined ? Number(item.daily_limit) : 20
      );
      if (res.changes > 0) {
        addedCount++;
      } else {
        skippedCount++;
      }
    }
  });

  bulkTx(keysArray);
  return { addedCount, skippedCount, total: keysArray.length };
}

export function getAllApiKeys() {
  const db = getDb();
  const today = getTodayStr();
  return db.prepare(`
    SELECT k.*, COALESCE(u.used_count, 0) as used_today
    FROM gemini_api_keys k
    LEFT JOIN api_key_usages u ON k.id = u.key_id AND u.date = ?
    ORDER BY k.id ASC
  `).all(today);
}

export function getApiKey(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM gemini_api_keys WHERE id = ?').get(id);
}

export function updateApiKey(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    if (['key_name', 'api_key', 'tier', 'daily_limit', 'is_active'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE gemini_api_keys SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteApiKey(id) {
  const db = getDb();
  db.prepare('DELETE FROM api_key_usages WHERE key_id = ?').run(id);
  return db.prepare('DELETE FROM gemini_api_keys WHERE id = ?').run(id);
}

/**
 * Round-Robin Key Selection: Find an active key with enough remaining quota for today.
 * Returns { id, key_name, api_key, tier, daily_limit, used_today } or null if all exhausted.
 */
export function getAvailableApiKey(cost = 1, excludedIds = []) {
  const db = getDb();
  const today = getTodayStr();
  let query = `
    SELECT k.id, k.key_name, k.api_key, k.tier, k.daily_limit,
           COALESCE(u.used_count, 0) as used_today
    FROM gemini_api_keys k
    LEFT JOIN api_key_usages u ON k.id = u.key_id AND u.date = ?
    WHERE k.is_active = 1
      AND (k.daily_limit - COALESCE(u.used_count, 0)) >= ?
  `;
  const params = [today, cost];
  if (excludedIds && excludedIds.length > 0) {
    const placeholders = excludedIds.map(() => '?').join(',');
    query += ` AND k.id NOT IN (${placeholders})`;
    params.push(...excludedIds);
  }
  query += ` ORDER BY COALESCE(u.used_count, 0) ASC, k.id ASC LIMIT 1`;
  const key = db.prepare(query).get(...params);
  return key || null;
}

export function incrementKeyUsage(keyId, cost = 1) {
  const db = getDb();
  const today = getTodayStr();
  db.prepare(`
    INSERT INTO api_key_usages (date, key_id, used_count)
    VALUES (?, ?, ?)
    ON CONFLICT(date, key_id) DO UPDATE SET used_count = used_count + ?
  `).run(today, keyId, cost, cost);
}

export function markKeyExhausted(keyId) {
  const db = getDb();
  const today = getTodayStr();
  const key = db.prepare('SELECT daily_limit FROM gemini_api_keys WHERE id = ?').get(keyId);
  if (!key) return;
  db.prepare(`
    INSERT INTO api_key_usages (date, key_id, used_count)
    VALUES (?, ?, ?)
    ON CONFLICT(date, key_id) DO UPDATE SET used_count = ?
  `).run(today, keyId, key.daily_limit, key.daily_limit);
}

export function markApiKeyStatus(keyId, status = 'ACTIVE', isActive = 1) {
  const db = getDb();
  return db.prepare('UPDATE gemini_api_keys SET status = ?, is_active = ? WHERE id = ?').run(status, isActive, keyId);
}

export function deleteInvalidApiKeys() {
  const db = getDb();
  const invalidKeys = db.prepare('SELECT id FROM gemini_api_keys WHERE is_active = 0 OR status IN ("INVALID", "REVOKED")').all();
  if (!invalidKeys || invalidKeys.length === 0) {
    return { deletedCount: 0 };
  }
  const ids = invalidKeys.map(k => k.id);
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM api_key_usages WHERE key_id IN (${placeholders})`).run(...ids);
  const res = db.prepare(`DELETE FROM gemini_api_keys WHERE id IN (${placeholders})`).run(...ids);
  return { deletedCount: res.changes };
}

export function getPoolSummary() {
  const db = getDb();
  const today = getTodayStr();
  const result = db.prepare(`
    SELECT
      COUNT(*) as total_keys,
      SUM(CASE WHEN k.is_active = 1 THEN 1 ELSE 0 END) as active_keys,
      SUM(CASE WHEN k.is_active = 1 THEN k.daily_limit ELSE 0 END) as total_capacity,
      SUM(CASE WHEN k.is_active = 1 THEN COALESCE(u.used_count, 0) ELSE 0 END) as total_used
    FROM gemini_api_keys k
    LEFT JOIN api_key_usages u ON k.id = u.key_id AND u.date = ?
  `).get(today);
  return {
    ...result,
    remaining: (result.total_capacity || 0) - (result.total_used || 0),
  };
}

// ========================
// Scheduler V4: Job Queue Operations
// ========================

export function createJob(queueName, payload = null) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO scheduler_jobs (queue_name, payload) VALUES (?, ?)'
  ).run(queueName, payload ? JSON.stringify(payload) : null);
}

export function createDelayedJob(queueName, payload, runAt) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO scheduler_jobs (queue_name, payload, run_at) VALUES (?, ?, ?)'
  ).run(queueName, payload ? JSON.stringify(payload) : null, runAt);
}

/**
 * Atomic claim: SELECT + UPDATE in a transaction to prevent double-processing.
 */
export function claimNextJob(queueName) {
  const db = getDb();
  const now = new Date().toISOString();
  const claim = db.transaction(() => {
    const job = db.prepare(`
      SELECT * FROM scheduler_jobs
      WHERE queue_name = ? AND status = 'pending' AND run_at <= ?
      ORDER BY run_at ASC
      LIMIT 1
    `).get(queueName, now);
    if (!job) return null;
    db.prepare(`
      UPDATE scheduler_jobs SET status = 'running', started_at = ?, attempts = attempts + 1
      WHERE id = ?
    `).run(now, job.id);
    return { ...job, status: 'running', started_at: now, attempts: job.attempts + 1 };
  });
  return claim();
}

export function completeJob(jobId, result = null) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.prepare(
    'UPDATE scheduler_jobs SET status = ?, result = ?, error_note = NULL, completed_at = ? WHERE id = ?'
  ).run('completed', result ? JSON.stringify(result) : null, now, jobId);
}

export function failJob(jobId, errorNote) {
  const db = getDb();
  const now = new Date().toISOString();
  // Check if we should retry
  const job = db.prepare('SELECT attempts, max_attempts FROM scheduler_jobs WHERE id = ?').get(jobId);
  if (job && job.attempts < job.max_attempts) {
    // Retry: set back to pending with a 60s delay
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    return db.prepare(
      'UPDATE scheduler_jobs SET status = ?, error_note = ?, run_at = ? WHERE id = ?'
    ).run('pending', errorNote, retryAt, jobId);
  }
  // Max retries reached: mark as failed
  return db.prepare(
    'UPDATE scheduler_jobs SET status = ?, error_note = ?, completed_at = ? WHERE id = ?'
  ).run('failed', errorNote, now, jobId);
}

export function getJobStats(queueName = null) {
  const db = getDb();
  const where = queueName ? 'WHERE queue_name = ?' : '';
  const args = queueName ? [queueName] : [];
  const stats = db.prepare(`
    SELECT
      queue_name,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM scheduler_jobs ${where}
    GROUP BY queue_name
  `).all(...args);
  return stats;
}

export function getRecentJobs(queueName, limit = 20) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM scheduler_jobs WHERE queue_name = ? ORDER BY created_at DESC LIMIT ?'
  ).all(queueName, limit);
}

export function getJobsCompletedToday(queueName) {
  const db = getDb();
  const today = getTodayStr();
  return db.prepare(`
    SELECT COUNT(*) as count FROM scheduler_jobs
    WHERE queue_name = ? AND status = 'completed'
    AND date(completed_at) = ?
  `).get(queueName, today).count;
}

// ========================
// Scheduler V4: Queue Config Operations
// ========================

const DEFAULT_CONFIGS = {
  scraper:        { is_enabled: 0, mode: 'time_window',  interval_minutes: 15, jobs_per_day: 10,  window_start: '09:00', window_end: '17:00' },
  analyzer:       { is_enabled: 0, mode: 'time_window',  interval_minutes: 15, jobs_per_day: 10,  window_start: '09:00', window_end: '17:00' },
  ideation:       { is_enabled: 0, mode: 'time_window',  interval_minutes: 15, jobs_per_day: 10,  window_start: '09:00', window_end: '17:00' },
  production:     { is_enabled: 0, mode: 'time_window',  interval_minutes: 15, jobs_per_day: 20,  window_start: '10:00', window_end: '16:00' },
  glabs:          { is_enabled: 0, mode: 'time_window',  interval_minutes: 15, jobs_per_day: 20,  window_start: '18:00', window_end: '23:00' },
  re_scraper:     { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  re_analyzer:    { is_enabled: 0, mode: 'manual',       interval_minutes: 15, jobs_per_day: 24,  window_start: '09:00', window_end: '22:00' },
  glabs_campaign: { is_enabled: 0, mode: 'manual',       interval_minutes: 5,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  re_tts:         { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  re_glabs:       { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  re_ffmpeg:      { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  re_social_poster: { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  re_plus_recomm:   { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  pillar_sourcing:  { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  pillar_generator: { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  pillar_tts:       { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  pillar_glabs:     { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  pillar_ffmpeg:    { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  pillar_social_poster: { is_enabled: 0, mode: 'manual', interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  product_scraper:  { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 200, window_start: '00:00', window_end: '23:59' },
  re_deconstruct:   { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  recipe_generator: { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  recipe_glabs:     { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
  recipe_exporter:  { is_enabled: 0, mode: 'manual',       interval_minutes: 2,  jobs_per_day: 100, window_start: '00:00', window_end: '23:59' },
};

export function getSchedulerConfig(queueName) {
  const db = getDb();
  let config = db.prepare('SELECT * FROM scheduler_config WHERE queue_name = ?').get(queueName);
  if (!config && DEFAULT_CONFIGS[queueName]) {
    const def = DEFAULT_CONFIGS[queueName];
    db.prepare(`
      INSERT OR IGNORE INTO scheduler_config (queue_name, is_enabled, mode, interval_minutes, jobs_per_day, window_start, window_end)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(queueName, def.is_enabled, def.mode, def.interval_minutes, def.jobs_per_day, def.window_start, def.window_end);
    config = db.prepare('SELECT * FROM scheduler_config WHERE queue_name = ?').get(queueName);
  }
  return config;
}

export function getAllSchedulerConfigs() {
  const db = getDb();
  // Ensure all default configs exist
  for (const [name, def] of Object.entries(DEFAULT_CONFIGS)) {
    db.prepare(`
      INSERT OR IGNORE INTO scheduler_config (queue_name, is_enabled, mode, interval_minutes, jobs_per_day, window_start, window_end)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, def.is_enabled, def.mode, def.interval_minutes, def.jobs_per_day, def.window_start, def.window_end);
  }
  return db.prepare('SELECT * FROM scheduler_config ORDER BY queue_name ASC').all();
}

export function updateSchedulerConfig(queueName, updates) {
  const db = getDb();
  // Ensure row exists first
  getSchedulerConfig(queueName);
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    if (['is_enabled', 'mode', 'interval_minutes', 'jobs_per_day', 'window_start', 'window_end'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(queueName);
  return db.prepare(`UPDATE scheduler_config SET ${fields.join(', ')} WHERE queue_name = ?`).run(...values);
}

// ========================
// V5: RE Campaigns
// ========================

export function createReCampaign({
  id,
  campaign_name,
  status = 'running',
  aspect_ratio = '9:16',
  target_ai = 'Google Veo (8s)',
  custom_instruction = '',
  brand_profile_id = null,
  is_bridging_active = 0,
  target_clips_count = 5,
  bridge_at_clip = 2,
  bridge_duration_clips = 0,
  bridging_mode = 'select_existing',
  target_product_id = null,
  ephemeral_product_data = null,
  promotion_style = 'Softselling',
  narrative_mode = 'Storytelling',
  post_youtube_draft = 0,
  post_tiktok_draft = 0,
  post_facebook_draft = 0,
  voice_provider = 'gemini',
  voice_persona = 'Kore',
  voice_speed = 1.0,
  voice_volume = 1.0,
  ffmpeg_sync_option = 'shortest',
  ffmpeg_video_scale = 1.0,
  ffmpeg_sfx_volume = 0.0,
  ffmpeg_bgm_volume = 0.15,
  video_model = 'veo_31_lite',
  local_scheduler = 0,
  words_per_clip = '17-19 kata',
  face_visibility = 'Faceless',
  enable_tts = 1,
  enable_glabs = 0,
  enable_ffmpeg = 1,
  enable_social_post = 1,
  visual_mode = 'pure_t2v',
  product_ref_image_path = null,
  product_filename_declare = null,
  angle_multiplier = 0,
  visual_overrides_json = null,
  tts_model_quality = 'speech-2.8-turbo',
  target_language = 'id-ID',
  visual_style = 'Cinematic',
  nextcloud_parent_folder = 'MAKNA_Production_Final',
  fb_draft_mode = 'auto',
  target_spreadsheet_id = null,
  sfx_setting = 'without_sfx',
  enable_vo_audit = 0,
  enable_audio_segment = 0,
  voice_cast_json = null,
  target_demographic = null,
  target_demographic_custom = null
}) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_campaigns (
      id, campaign_name, status, aspect_ratio, target_ai, custom_instruction, brand_profile_id,
      is_bridging_active, target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode, target_product_id, ephemeral_product_data, promotion_style, narrative_mode,
      post_youtube_draft, post_tiktok_draft, post_facebook_draft, voice_provider, voice_persona, voice_speed, voice_volume,
      ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume, video_model, local_scheduler,
      words_per_clip, face_visibility, enable_tts, enable_glabs, enable_ffmpeg, enable_social_post,
      visual_mode, product_ref_image_path, product_filename_declare, angle_multiplier, visual_overrides_json, tts_model_quality, target_language, visual_style,
      nextcloud_parent_folder, fb_draft_mode, target_spreadsheet_id, sfx_setting, enable_vo_audit, enable_audio_segment, voice_cast_json,
      target_demographic, target_demographic_custom
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, campaign_name, status, aspect_ratio, target_ai, custom_instruction, brand_profile_id,
    is_bridging_active, target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode, target_product_id, ephemeral_product_data, promotion_style, narrative_mode,
    post_youtube_draft, post_tiktok_draft, post_facebook_draft, voice_provider, voice_persona, voice_speed, voice_volume,
    ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume, video_model, local_scheduler,
    words_per_clip, face_visibility, enable_tts, enable_glabs, enable_ffmpeg, enable_social_post,
    visual_mode, product_ref_image_path, product_filename_declare, angle_multiplier, visual_overrides_json, tts_model_quality, target_language, visual_style,
    nextcloud_parent_folder, fb_draft_mode, target_spreadsheet_id, sfx_setting, enable_vo_audit,
    enable_audio_segment, voice_cast_json, target_demographic, target_demographic_custom
  );
}

export function getReCampaign(id) {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, b.brand_name 
    FROM re_campaigns c
    LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
    WHERE c.id = ?
  `).get(id);
}

export function listReCampaigns() {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, b.brand_name 
    FROM re_campaigns c
    LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
    ORDER BY c.created_at DESC
  `).all();
}

export function updateReCampaign(id, updates) {
  const db = getDb();
  const allowed = [
    'status', 'target_spreadsheet_id', 'target_markdown_url', 'local_scheduler',
    'scheduler_pause_at', 'enable_tts', 'enable_glabs', 'enable_ffmpeg', 'enable_social_post',
    'angle_multiplier', 'visual_overrides_json', 'tts_model_quality', 'target_language',
    'product_ref_image_path', 'product_filename_declare',
    'voice_provider', 'voice_persona', 'voice_speed', 'voice_volume',
    'ffmpeg_sync_option', 'ffmpeg_video_scale', 'ffmpeg_sfx_volume', 'ffmpeg_bgm_volume',
    'enable_vo_audit',
    'bridge_duration_clips', 'visual_style',
    'post_youtube_draft', 'post_tiktok_draft', 'post_facebook_draft',
    'facebook_page_id', 'facebook_server_url', 'nextcloud_parent_folder', 'fb_draft_mode', 'sfx_setting',
    'narrative_mode',
    'enable_audio_segment', 'voice_cast_json'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE re_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteReCampaign(id) {
  const db = getDb();
  return db.transaction(() => {
    db.prepare('DELETE FROM re_campaign_items WHERE campaign_id = ?').run(id);
    db.prepare('DELETE FROM re_campaigns WHERE id = ?').run(id);
  })();
}

export function addReCampaignItems(campaignId, items) {
  const db = getDb();
  const insert = db.prepare(
    'INSERT INTO re_campaign_items (campaign_id, source_url, product_url) VALUES (?, ?, ?)'
  );
  const insertMany = db.transaction((itemList) => {
    for (const item of itemList) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) insert.run(campaignId, trimmed, null);
      } else if (item && typeof item === 'object') {
        const trimmedUrl = item.source_url?.trim();
        const trimmedProductUrl = item.product_url?.trim() || null;
        if (trimmedUrl) insert.run(campaignId, trimmedUrl, trimmedProductUrl);
      }
    }
  });
  return insertMany(items);
}

export function getNextPendingScrapeItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.scrape_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingAnalyzeItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.scrape_status = 'downloaded' AND i.analyze_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingReTtsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.analyze_status = 'analyzed' AND i.tts_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingReGlabsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE (i.tts_status = 'completed' OR i.tts_status = 'skipped') AND i.visual_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingReFfmpegItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'completed' AND i.ffmpeg_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingSocialPostItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE (i.ffmpeg_status = 'completed' OR i.ffmpeg_status = 'skipped') AND i.social_post_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}


export function checkAndUpdateCampaignCompletion(campaignId) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM re_campaigns WHERE id = ?').get(campaignId);
  if (!campaign || campaign.status === 'completed') return;

  const items = db.prepare('SELECT * FROM re_campaign_items WHERE campaign_id = ?').all(campaignId);
  if (items.length === 0) return;

  const actualNeedsSocial = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  const allFinished = items.every(item => {
    // If it failed at any stage, it is finished (no further progress possible)
    if (
      item.scrape_status === 'failed' ||
      item.analyze_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.visual_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      (actualNeedsSocial && item.social_post_status === 'failed')
    ) {
      return true;
    }

    // Otherwise, check for success state of each enabled stage
    const scrapeSuccess = item.scrape_status === 'downloaded' || item.scrape_status === 'skipped' || item.scrape_status === 'ready' || !item.scrape_status;
    if (!scrapeSuccess) return false;

    const analyzeSuccess = item.analyze_status === 'analyzed' || item.analyze_status === 'skipped' || !item.analyze_status;
    if (!analyzeSuccess) return false;

    const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
    if (!ttsSuccess) return false;

    const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
    if (!visualSuccess) return false;

    const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
    if (!ffmpegSuccess) return false;

    if (actualNeedsSocial) {
      return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
    }

    return true;
  });

  if (allFinished) {
    const hasRetryableFailures = items.some(item => {
      const isFailed = item.scrape_status === 'failed' ||
                       item.analyze_status === 'failed' ||
                       item.tts_status === 'failed' ||
                       item.visual_status === 'failed' ||
                       item.ffmpeg_status === 'failed' ||
                       (actualNeedsSocial && item.social_post_status === 'failed');
      const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
      return isFailed && retryCount < 3;
    });

    if (!hasRetryableFailures) {
      db.prepare("UPDATE re_campaigns SET status = 'completed' WHERE id = ?").run(campaignId);
      console.log(`[DB Monitor] Campaign ${campaignId} marked as completed.`);
    } else {
      console.log(`[DB Monitor] Campaign ${campaignId} has failed items but keeping 'running' for auto-retry.`);
    }
  }
}

export function updateReCampaignItem(id, updates) {
  const db = getDb();
  const allowed = [
    'scrape_status', 'local_video_path', 'analyze_status', 'result_json',
    'tts_status', 'tts_batch_id', 'visual_status', 'visual_tasks_json', 
    'visual_clip_paths', 'ffmpeg_status', 'ffmpeg_output_path', 
    'upload_status', 'drive_link', 'social_post_status', 'social_links_json',
    'retry_count', 't2i_start_frame_path',
    'original_deconstruction_json', 'new_video_plan_json', 'video_dna_json',
    't2i_images_json', 'workflow_status',
    'regenerate_start_frames_status', 'regenerate_start_frames_progress'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  const result = db.prepare(`UPDATE re_campaign_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // Trigger completion check automatically
  try {
    const item = db.prepare('SELECT campaign_id FROM re_campaign_items WHERE id = ?').get(id);
    if (item && item.campaign_id) {
      checkAndUpdateCampaignCompletion(item.campaign_id);
    }
  } catch (e) {
    console.error('[DB] Auto completion check failed:', e);
  }

  return result;
}

export function listReCampaignItems(campaignId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM re_campaign_items WHERE campaign_id = ? ORDER BY id ASC'
  ).all(campaignId);
}

export function getReCampaignStats(campaignId) {
  const db = getDb();
  return db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN scrape_status = 'downloaded' THEN 1 ELSE 0 END) as scraped,
      SUM(CASE WHEN analyze_status = 'analyzed' THEN 1 ELSE 0 END) as analyzed,
      SUM(CASE WHEN scrape_status = 'failed' THEN 1 ELSE 0 END) as scrape_failed,
      SUM(CASE WHEN analyze_status = 'failed' THEN 1 ELSE 0 END) as analyze_failed
    FROM re_campaign_items WHERE campaign_id = ?
  `).get(campaignId);
}

export function createAngleVariant(variant) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_item_angle_variants (
      id, re_item_id, angle_name, angle_category, matrix_strategy_used,
      system_targeting, voice_persona_assigned, angle_description, visual_tasks_json,
      tts_status, visual_status, ffmpeg_status, upload_status
    ) VALUES (
      @id, @re_item_id, @angle_name, @angle_category, @matrix_strategy_used,
      @system_targeting, @voice_persona_assigned, @angle_description, @visual_tasks_json,
      'pending', 'pending', 'pending', 'pending'
    )
  `).run(variant);
}

export function getAngleVariantsForItem(itemId) {
  const db = getDb();
  return db.prepare('SELECT * FROM re_item_angle_variants WHERE re_item_id = ? ORDER BY created_at ASC').all(itemId);
}

export function updateAngleVariant(id, updates) {
  const db = getDb();
  const allowed = [
    'tts_status', 'tts_batch_id', 'visual_status', 'visual_clip_paths',
    'ffmpeg_status', 'ffmpeg_output_path', 'upload_status', 'drive_link',
    'visual_tasks_json', 'glabs_task_ids'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE re_item_angle_variants SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ========================
// V5: G Labs Campaigns
// ========================

export function createGlabsCampaign({ id, source_spreadsheet_id, target_drive_folder_id }) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO glabs_campaigns (id, source_spreadsheet_id, target_drive_folder_id) VALUES (?, ?, ?)'
  ).run(id, source_spreadsheet_id, target_drive_folder_id);
}

export function listGlabsCampaigns() {
  const db = getDb();
  return db.prepare('SELECT * FROM glabs_campaigns ORDER BY created_at DESC').all();
}

export function getGlabsCampaign(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM glabs_campaigns WHERE id = ?').get(id);
}

export function updateGlabsCampaign(id, updates) {
  const db = getDb();
  const allowed = ['status', 'current_batch'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE glabs_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ==========================================
// V5: REPORTING & CAMPAIGN TRACKER HELPERS
// ==========================================

export function getJobReports() {
  const db = getDb();
  const queueStats = db.prepare(`
    SELECT queue_name, status, COUNT(*) as count 
    FROM scheduler_jobs 
    GROUP BY queue_name, status
  `).all();

  const globalStats = db.prepare(`
    SELECT 
      COUNT(*) as total_jobs,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as total_completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
      AVG(CASE WHEN status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL 
          THEN (julianday(completed_at) - julianday(started_at)) * 86400 ELSE NULL END) as avg_processing_time_sec
    FROM scheduler_jobs
  `).get();

  return { queueStats, globalStats };
}

export function getApiKeyStats() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const keysCount = db.prepare('SELECT COUNT(*) as count FROM gemini_api_keys WHERE is_active = 1').get().count;
  const totalCapacity = keysCount * 1500; // Asumsi 1500 request per hari per key
  
  const totalUsed = db.prepare(`
    SELECT SUM(used_count) as total_used 
    FROM api_key_usages 
    WHERE date = ?
  `).get(today).total_used || 0;

  return { totalCapacity, totalUsed };
}

export function getActiveCampaignsStats() {
  const db = getDb();
  
  // RE Campaigns
  const activeReCampaigns = db.prepare(`
    SELECT c.*, 
           COUNT(i.id) as total_items,
           SUM(CASE WHEN i.scrape_status = 'downloaded' THEN 1 ELSE 0 END) as total_downloaded,
           SUM(CASE WHEN i.analyze_status = 'analyzed' THEN 1 ELSE 0 END) as total_analyzed
    FROM re_campaigns c
    LEFT JOIN re_campaign_items i ON c.id = i.campaign_id
    WHERE c.status IN ('active', 'running', 'pending')
    GROUP BY c.id
  `).all();

  // G Labs Campaigns
  const activeGlabsCampaigns = db.prepare(`
    SELECT * FROM glabs_campaigns
    WHERE status = 'active'
  `).all();

  return { activeReCampaigns, activeGlabsCampaigns };
}

export function getAuditTrail(limit = 50, offset = 0, queueFilter = null, statusFilter = null) {
  const db = getDb();
  let query = 'SELECT * FROM scheduler_jobs WHERE 1=1';
  const params = [];
  
  if (queueFilter && queueFilter !== 'all') {
    query += ' AND queue_name = ?';
    params.push(queueFilter);
  }
  if (statusFilter && statusFilter !== 'all') {
    query += ' AND status = ?';
    params.push(statusFilter);
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const total = db.prepare(countQuery).get(...params).count;

  query += ' ORDER BY COALESCE(completed_at, started_at, created_at) DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const jobs = db.prepare(query).all(...params);
  
  return { total, jobs };
}

export function cleanupOldJobs() {
  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(`
    DELETE FROM scheduler_jobs 
    WHERE status = 'completed' AND completed_at < ?
  `).run(sevenDaysAgo);
}

export function retryJob(jobId) {
  const db = getDb();
  return db.prepare(`
    UPDATE scheduler_jobs 
    SET status = 'pending', attempts = 0, error_note = NULL, started_at = NULL, completed_at = NULL, run_at = ? 
    WHERE id = ?
  `).run(new Date().toISOString(), jobId);
}

// ========================
// Instant Campaign Operations
// ========================
export function createInstantCampaign(campaignData, configData) {
  const db = getDb();
  
  const isMassProd = campaignData.is_mass_production !== undefined ? campaignData.is_mass_production : 0;
  const localSched = campaignData.local_scheduler !== undefined ? campaignData.local_scheduler : 0;
  const initialStatus = campaignData.status || 'pending';

  const brandProfileId = campaignData.brand_profile_id || null;
  const enableGlabs = campaignData.enable_glabs !== undefined ? campaignData.enable_glabs : 0;
  const enableTts = campaignData.enable_tts !== undefined ? campaignData.enable_tts : 1;
  const enableFfmpeg = campaignData.enable_ffmpeg !== undefined ? campaignData.enable_ffmpeg : 1;
  const enableSocialPost = campaignData.enable_social_post !== undefined ? campaignData.enable_social_post : 1;
  const postYoutube = campaignData.post_youtube_draft !== undefined ? campaignData.post_youtube_draft : 0;
  const postTiktok = campaignData.post_tiktok_draft !== undefined ? campaignData.post_tiktok_draft : 0;
  const postFacebook = campaignData.post_facebook_draft !== undefined ? campaignData.post_facebook_draft : 0;
  const isBridgingActive = campaignData.is_bridging_active !== undefined ? campaignData.is_bridging_active : 0;
  const bridgeAtClip = campaignData.bridge_at_clip !== undefined ? campaignData.bridge_at_clip : 2;
  const visualMode = campaignData.visual_mode || 'hybrid_lock';

  const insertCampaign = db.prepare(`
    INSERT INTO instant_campaigns (
      id, product_name, product_description, product_source_type, product_media_path, product_url, status, 
      is_mass_production, local_scheduler, brand_profile_id, enable_glabs, enable_tts, enable_ffmpeg, 
      enable_social_post, post_youtube_draft, post_tiktok_draft, post_facebook_draft, 
      is_bridging_active, bridge_at_clip, visual_mode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertConfig = db.prepare(`
    INSERT INTO instant_campaign_configs (campaign_id, narrative_mode, visual_style, words_per_clip, target_ai_engine, face_visibility, aspect_ratio, total_clips, voice_persona, speed_control, custom_instruction, target_language)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertCampaign.run(
      campaignData.id,
      campaignData.product_name,
      campaignData.product_description,
      campaignData.product_source_type,
      campaignData.product_media_path,
      campaignData.product_url,
      initialStatus,
      isMassProd,
      localSched,
      brandProfileId,
      enableGlabs,
      enableTts,
      enableFfmpeg,
      enableSocialPost,
      postYoutube,
      postTiktok,
      postFacebook,
      isBridgingActive,
      bridgeAtClip,
      visualMode
    );
    
    insertConfig.run(
      campaignData.id,
      configData.narrative_mode,
      configData.visual_style,
      configData.words_per_clip,
      configData.target_ai_engine,
      configData.face_visibility,
      configData.aspect_ratio,
      configData.total_clips,
      configData.voice_persona,
      configData.speed_control,
      configData.custom_instruction,
      configData.target_language || 'id-ID'
    );
  })();
}

export function updateInstantCampaignStatus(id, status) {
  const db = getDb();
  return db.prepare('UPDATE instant_campaigns SET status = ? WHERE id = ?').run(status, id);
}

export function saveInstantCampaignOutput(outputId, campaignId, unifiedJson, errorLog = null) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO instant_campaign_outputs (id, campaign_id, unified_production_json, error_log)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      unified_production_json = excluded.unified_production_json,
      error_log = excluded.error_log
  `).run(outputId, campaignId, unifiedJson, errorLog);
}

export function getInstantCampaign(id) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM instant_campaigns WHERE id = ?').get(id);
  if (!campaign) return null;
  
  const config = db.prepare('SELECT * FROM instant_campaign_configs WHERE campaign_id = ?').get(id);
  const output = db.prepare('SELECT * FROM instant_campaign_outputs WHERE campaign_id = ?').get(id);
  
  return { ...campaign, config, output };
}

export function getAllInstantCampaigns() {
  const db = getDb();
  return db.prepare('SELECT * FROM instant_campaigns ORDER BY created_at DESC').all();
}

export function deleteInstantCampaign(id) {
  const db = getDb();
  
  // Use a transaction to ensure all related data is deleted safely
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM instant_campaign_items WHERE campaign_id = ?').run(id);
    db.prepare('DELETE FROM instant_campaign_outputs WHERE campaign_id = ?').run(id);
    db.prepare('DELETE FROM instant_campaign_configs WHERE campaign_id = ?').run(id);
    db.prepare('DELETE FROM instant_campaigns WHERE id = ?').run(id);
  });
  
  transaction();
}

export function updateInstantCampaign(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(id);
  return db.prepare(`UPDATE instant_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ========================
// BRAND PROFILES CRUD
// ========================

export function createBrandProfile(data) {
  const db = getDb();
  const fields = [
    'id', 'brand_name', 'tone_of_voice', 'visual_signature', 'raw_guideline_text', 'guideline_filename',
    'storage_provider', 'nextcloud_target_folder', 'drive_target_folder', 'drive_glabs_folder_id',
    'webhook_host', 'webhook_port', 'webhook_api_key'
  ];
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map(f => data[f] !== undefined ? data[f] : (f === 'tone_of_voice' ? 'Kasual/Gaul' : ''));
  values[0] = data.id; // ensure correct ID mapping
  
  return db.prepare(
    `INSERT INTO brand_profiles (${fields.join(', ')}) VALUES (${placeholders})`
  ).run(...values);
}

export function getAllBrandProfiles() {
  const db = getDb();
  return db.prepare('SELECT id, brand_name, tone_of_voice, visual_signature, guideline_filename, created_at, storage_provider, webhook_host FROM brand_profiles ORDER BY created_at DESC').all();
}

export function getBrandProfile(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(id);
}

export function updateBrandProfile(id, data) {
  const db = getDb();
  const allowedFields = [
    'brand_name', 'tone_of_voice', 'visual_signature', 'raw_guideline_text', 'guideline_filename',
    'storage_provider', 'nextcloud_target_folder', 'drive_target_folder', 'drive_glabs_folder_id',
    'webhook_host', 'webhook_port', 'webhook_api_key'
  ];
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(data)) {
    if (allowedFields.includes(key) && val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE brand_profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteBrandProfile(id) {
  const db = getDb();
  // FK ON DELETE SET NULL will clear references in re_campaigns and instant_campaigns
  db.prepare('DELETE FROM brand_profiles WHERE id = ?').run(id);
}

// Router G-Labs Tasks
export function saveGlabsTaskRoute(taskId, host, port, apiKey) {
  const db = getDb();
  try {
    db.prepare(`
      INSERT OR REPLACE INTO glabs_task_routes (task_id, host, port, api_key)
      VALUES (?, ?, ?, ?)
    `).run(taskId, host, port, apiKey);
  } catch (e) {
    console.error('[DB] Failed to save G-Labs task route:', e.message);
  }
}

export function getGlabsTaskRoute(taskId) {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM glabs_task_routes WHERE task_id = ?').get(taskId);
  } catch (e) {
    return null;
  }
}

// ========================
// FFmpeg Studio Jobs Operations
// ========================
export function createFfmpegStudioJob(job) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ffmpeg_studio_jobs (
      id, video_source_type, video_path, audio_source_type, audio_path,
      sync_option, bgm_path, bgm_volume, sfx_volume, video_scale, output_path, status, error_log
    )
    VALUES (
      @id, @video_source_type, @video_path, @audio_source_type, @audio_path,
      @sync_option, @bgm_path, @bgm_volume, @sfx_volume, @video_scale, @output_path, @status, @error_log
    )
  `);
  return stmt.run(job);
}

export function getFfmpegStudioJob(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM ffmpeg_studio_jobs WHERE id = ?').get(id);
}

export function getAllFfmpegStudioJobs() {
  const db = getDb();
  return db.prepare('SELECT * FROM ffmpeg_studio_jobs ORDER BY created_at DESC').all();
}

export function updateFfmpegStudioJob(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  return db.prepare(`UPDATE ffmpeg_studio_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getPendingFfmpegStudioJob() {
  const db = getDb();
  return db.prepare("SELECT * FROM ffmpeg_studio_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1").get();
}

export function hasActiveFfmpegStudioJob() {
  const db = getDb();
  const active = db.prepare("SELECT id FROM ffmpeg_studio_jobs WHERE status = 'processing' LIMIT 1").get();
  return !!active;
}

// ========================
// TTS Studio Operations
// ========================

export function createTtsBatch(batch) {
  const db = getDb();
  const payload = {
    tts_model_quality: 'speech-2.8-turbo',
    ...batch
  };
  const stmt = db.prepare(`
    INSERT INTO tts_studio_batches (id, source_type, source_ref_id, provider_active, voice_persona, config_speed, config_volume, tts_model_quality)
    VALUES (@id, @source_type, @source_ref_id, @provider_active, @voice_persona, @config_speed, @config_volume, @tts_model_quality)
  `);
  return stmt.run(payload);
}

export function createTtsClip(clip) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tts_studio_clips (id, batch_id, clip_index, source_text, audio_path, status)
    VALUES (@id, @batch_id, @clip_index, @source_text, @audio_path, @status)
  `);
  return stmt.run(clip);
}

export function updateTtsClip(clipId, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(clipId);
  return db.prepare(`UPDATE tts_studio_clips SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getTtsBatchWithClips(batchId) {
  const db = getDb();
  const batch = db.prepare('SELECT * FROM tts_studio_batches WHERE id = ?').get(batchId);
  if (!batch) return null;
  const clips = db.prepare('SELECT * FROM tts_studio_clips WHERE batch_id = ? ORDER BY clip_index ASC').all(batchId);
  return { ...batch, clips };
}

export function listTtsBatches() {
  const db = getDb();
  return db.prepare('SELECT * FROM tts_studio_batches ORDER BY created_at DESC').all();
}

export function getCompletedTtsBatches() {
  const db = getDb();
  const batches = db.prepare(`
    SELECT DISTINCT b.* FROM tts_studio_batches b
    JOIN tts_studio_clips c ON b.id = c.batch_id
    WHERE c.status = 'completed'
    ORDER BY b.created_at DESC
  `).all();
  
  return batches.map(b => {
    const clips = db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed' ORDER BY clip_index ASC").all(b.id);
    return { ...b, clips };
  });
}

export function deleteTtsBatch(batchId) {
  const db = getDb();
  db.prepare('DELETE FROM tts_studio_clips WHERE batch_id = ?').run(batchId);
  return db.prepare('DELETE FROM tts_studio_batches WHERE id = ?').run(batchId);
}

export function insertGlabsTask(arg1, campaign_id, item_id, clip_index, prompt, status, video_url) {
  const db = getDb();
  let task_id;
  if (typeof arg1 === 'object' && arg1 !== null) {
    task_id = arg1.task_id;
    campaign_id = arg1.campaign_id;
    item_id = arg1.item_id;
    clip_index = arg1.clip_index;
    prompt = arg1.prompt;
    status = arg1.status;
    video_url = arg1.video_url;
  } else {
    task_id = arg1;
  }

  // Use INSERT OR REPLACE to allow updating item_id and other details when task is reused
  return db.prepare(`
    INSERT OR REPLACE INTO glabs_tasks (task_id, campaign_id, item_id, clip_index, prompt, status, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(task_id || null, campaign_id || null, item_id || null, clip_index || null, prompt || null, status || 'processing', video_url || null);
}

export function updateGlabsTaskStatus(taskId, status, videoUrl = null) {
  const db = getDb();
  const now = new Date().toISOString();
  if (videoUrl) {
    return db.prepare(`
      UPDATE glabs_tasks
      SET status = ?, video_url = ?, completed_at = ?
      WHERE task_id = ?
    `).run(status, videoUrl, now, taskId);
  } else {
    return db.prepare(`
      UPDATE glabs_tasks
      SET status = ?, completed_at = ?
      WHERE task_id = ?
    `).run(status, now, taskId);
  }
}

export function getGlabsTask(taskId) {
  const db = getDb();
  return db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(taskId);
}

export function listGlabsTasks(limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare(`
    SELECT t.*, c.campaign_name, i.source_url
    FROM glabs_tasks t
    LEFT JOIN re_campaigns c ON t.campaign_id = c.id
    LEFT JOIN re_campaign_items i ON t.item_id = i.id
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

// ===================================
// RE Plus Recomm Discovery Operations
// ===================================

export function createRecommJob({ id, campaign_name, source_urls_json, target_recommendations_count }) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_plus_recomm_jobs (id, campaign_name, source_urls_json, target_recommendations_count, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(id, campaign_name, source_urls_json, target_recommendations_count || 3);
}

export function getRecommJob(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM re_plus_recomm_jobs WHERE id = ?').get(id);
}

export function listRecommJobs() {
  const db = getDb();
  return db.prepare('SELECT * FROM re_plus_recomm_jobs ORDER BY created_at DESC').all();
}

export function deleteRecommJob(id) {
  const db = getDb();
  return db.prepare('DELETE FROM re_plus_recomm_jobs WHERE id = ?').run(id);
}

export function getRecommOutputsForJob(jobId) {
  const db = getDb();
  return db.prepare('SELECT * FROM re_plus_recomm_outputs WHERE recomm_job_id = ? ORDER BY created_at ASC').all(jobId);
}

export function getRecommOutput(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM re_plus_recomm_outputs WHERE id = ?').get(id);
}

export function createRecommOutput({ id, recomm_job_id, source_url, video_deconstruction_json, recommended_product_name, short_description, unique_selling_point, scraped_image_url, local_image_path }) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_plus_recomm_outputs (id, recomm_job_id, source_url, video_deconstruction_json, recommended_product_name, short_description, unique_selling_point, scraped_image_url, local_image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, recomm_job_id, source_url, video_deconstruction_json, recommended_product_name, short_description, unique_selling_point, scraped_image_url, local_image_path);
}

export function updateRecommOutput(id, updates) {
  const db = getDb();
  const existing = getRecommOutput(id);
  if (!existing) return null;

  return db.prepare(`
    UPDATE re_plus_recomm_outputs
    SET recommended_product_name = ?,
        short_description = ?,
        unique_selling_point = ?,
        local_image_path = ?,
        is_selected_by_user = ?
    WHERE id = ?
  `).run(
    updates.recommended_product_name !== undefined ? updates.recommended_product_name : existing.recommended_product_name,
    updates.short_description !== undefined ? updates.short_description : existing.short_description,
    updates.unique_selling_point !== undefined ? updates.unique_selling_point : existing.unique_selling_point,
    updates.local_image_path !== undefined ? updates.local_image_path : existing.local_image_path,
    updates.is_selected_by_user !== undefined ? updates.is_selected_by_user : existing.is_selected_by_user,
    id
  );
}

// ========================
// V8.5: Organic Pillar Campaign Operations
// ========================

export function createPillarCampaign(campaign) {
  const db = getDb();
  const data = {
    id: campaign.id,
    campaign_name: campaign.campaign_name,
    status: campaign.status || 'pending',
    content_pillar: campaign.content_pillar,
    custom_hook: campaign.custom_hook,
    visual_action_guideline: campaign.visual_action_guideline,
    custom_instruction: campaign.custom_instruction || '',
    brand_profile_id: campaign.brand_profile_id || null,
    narrative_mode: campaign.narrative_mode || 'Storytelling',
    visual_style: campaign.visual_style || 'Cinematic',
    face_visibility: campaign.face_visibility || 'Faceless',
    is_bridging_active: campaign.is_bridging_active !== undefined ? campaign.is_bridging_active : 0,
    target_clips_count: campaign.target_clips_count !== undefined ? campaign.target_clips_count : 4,
    bridge_at_clip: campaign.bridge_at_clip !== undefined ? campaign.bridge_at_clip : 2,
    bridge_duration_clips: campaign.bridge_duration_clips !== undefined ? campaign.bridge_duration_clips : 1,
    bridging_mode: campaign.bridging_mode || 'select_existing',
    target_product_id: campaign.target_product_id || null,
    ephemeral_product_data: campaign.ephemeral_product_data || null,
    aspect_ratio: campaign.aspect_ratio || '9:16',
    target_ai: campaign.target_ai || 'Google Veo (8s)',
    video_model: campaign.video_model || 'veo_31_lite',
    visual_mode: campaign.visual_mode || 'hybrid_lock',
    product_ref_image_path: campaign.product_ref_image_path || null,
    product_filename_declare: campaign.product_filename_declare || null,
    visual_overrides_json: campaign.visual_overrides_json || null,
    enable_tts: campaign.enable_tts !== undefined ? campaign.enable_tts : 0,
    enable_glabs: campaign.enable_glabs !== undefined ? campaign.enable_glabs : 0,
    enable_ffmpeg: campaign.enable_ffmpeg !== undefined ? campaign.enable_ffmpeg : 0,
    enable_social_post: campaign.enable_social_post !== undefined ? campaign.enable_social_post : 0,
    post_facebook_draft: campaign.post_facebook_draft !== undefined ? campaign.post_facebook_draft : 0,
    facebook_page_id: campaign.facebook_page_id || null,
    facebook_server_url: campaign.facebook_server_url || null,
    upload_markdown: campaign.upload_markdown !== undefined ? campaign.upload_markdown : 0,
    upload_spreadsheet: campaign.upload_spreadsheet !== undefined ? campaign.upload_spreadsheet : 0,
    target_spreadsheet_id: campaign.target_spreadsheet_id || null,
    target_markdown_url: campaign.target_markdown_url || null,
    local_scheduler: campaign.local_scheduler !== undefined ? campaign.local_scheduler : 0,
    scheduler_pause_at: campaign.scheduler_pause_at || null,
    voice_provider: campaign.voice_provider || 'minimax',
    voice_persona: campaign.voice_persona || 'Indonesian_casual_reporter_vv2',
    words_per_clip: campaign.words_per_clip || '17-19 kata',
    is_mass_production: campaign.is_mass_production !== undefined ? campaign.is_mass_production : 0,
    tts_model_quality: campaign.tts_model_quality || 'speech-2.8-turbo',
    voice_speed: campaign.voice_speed !== undefined ? campaign.voice_speed : 1.0,
    voice_volume: campaign.voice_volume !== undefined ? campaign.voice_volume : 1.0,
    target_language: campaign.target_language || 'id-ID',
    ffmpeg_sync_option: campaign.ffmpeg_sync_option || 'smart_sync',
    ffmpeg_video_scale: campaign.ffmpeg_video_scale !== undefined ? campaign.ffmpeg_video_scale : 1.0,
    ffmpeg_sfx_volume: campaign.ffmpeg_sfx_volume !== undefined ? campaign.ffmpeg_sfx_volume : 0.0,
    ffmpeg_bgm_volume: campaign.ffmpeg_bgm_volume !== undefined ? campaign.ffmpeg_bgm_volume : 0.15,
    nextcloud_parent_folder: campaign.nextcloud_parent_folder || 'MAKNA_Production_Final',
    fb_draft_mode: campaign.fb_draft_mode || 'auto',
    sfx_setting: campaign.sfx_setting || 'without_sfx',
    enable_vo_audit: campaign.enable_vo_audit !== undefined ? campaign.enable_vo_audit : 0,
    enable_audio_segment: campaign.enable_audio_segment !== undefined ? campaign.enable_audio_segment : 0,
    voice_cast_json: campaign.voice_cast_json || null,
    target_demographic: campaign.target_demographic || null,
    target_demographic_custom: campaign.target_demographic_custom || null
  };
  return db.prepare(`
    INSERT INTO pillar_campaigns (
      id, campaign_name, status, content_pillar, custom_hook, visual_action_guideline, custom_instruction, brand_profile_id,
      narrative_mode, visual_style, face_visibility, is_bridging_active, target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode,
      target_product_id, ephemeral_product_data, aspect_ratio, target_ai, video_model, visual_mode, product_ref_image_path,
      product_filename_declare, visual_overrides_json, enable_tts, enable_ffmpeg, enable_social_post,
      post_facebook_draft, facebook_page_id, facebook_server_url,
      voice_provider, voice_persona, words_per_clip, enable_glabs, upload_markdown, upload_spreadsheet, target_spreadsheet_id, target_markdown_url,
      local_scheduler, scheduler_pause_at, is_mass_production, tts_model_quality, voice_speed, voice_volume, target_language,
      ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume, nextcloud_parent_folder, fb_draft_mode, sfx_setting, enable_vo_audit, enable_audio_segment, voice_cast_json,
      target_demographic, target_demographic_custom
    ) VALUES (
      @id, @campaign_name, @status, @content_pillar, @custom_hook, @visual_action_guideline, @custom_instruction, @brand_profile_id,
      @narrative_mode, @visual_style, @face_visibility, @is_bridging_active, @target_clips_count, @bridge_at_clip, @bridge_duration_clips, @bridging_mode,
      @target_product_id, @ephemeral_product_data, @aspect_ratio, @target_ai, @video_model, @visual_mode, @product_ref_image_path,
      @product_filename_declare, @visual_overrides_json, @enable_tts, @enable_ffmpeg, @enable_social_post,
      @post_facebook_draft, @facebook_page_id, @facebook_server_url,
      @voice_provider, @voice_persona, @words_per_clip, @enable_glabs, @upload_markdown, @upload_spreadsheet, @target_spreadsheet_id, @target_markdown_url,
      @local_scheduler, @scheduler_pause_at, @is_mass_production, @tts_model_quality, @voice_speed, @voice_volume, @target_language,
      @ffmpeg_sync_option, @ffmpeg_video_scale, @ffmpeg_sfx_volume, @ffmpeg_bgm_volume, @nextcloud_parent_folder, @fb_draft_mode, @sfx_setting, @enable_vo_audit, @enable_audio_segment, @voice_cast_json,
      @target_demographic, @target_demographic_custom
    )
  `).run(data);
}

export function getPillarCampaign(id) {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, b.brand_name 
    FROM pillar_campaigns c
    LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
    WHERE c.id = ?
  `).get(id);
}

export function listPillarCampaigns() {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, b.brand_name 
    FROM pillar_campaigns c
    LEFT JOIN brand_profiles b ON c.brand_profile_id = b.id
    ORDER BY c.created_at DESC
  `).all();
}

export function updatePillarCampaign(id, updates) {
  const db = getDb();
  const allowed = [
    'status', 'enable_glabs', 'enable_tts', 'enable_ffmpeg', 'enable_social_post',
    'upload_markdown', 'upload_spreadsheet', 'target_spreadsheet_id', 'target_markdown_url',
    'local_scheduler', 'scheduler_pause_at', 'tts_model_quality', 'voice_speed', 'voice_volume',
    'target_language', 'post_facebook_draft', 'facebook_page_id', 'facebook_server_url',
    'nextcloud_parent_folder', 'fb_draft_mode', 'bridge_duration_clips', 'sfx_setting', 'enable_vo_audit',
    'enable_audio_segment', 'voice_cast_json'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE pillar_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deletePillarCampaign(id) {
  const db = getDb();
  return db.transaction(() => {
    db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(id);
    db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(id);
  })();
}

export function createPillarCampaignItem(item) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO pillar_campaign_items (campaign_id, row_creative_payload, generation_status) VALUES (?, ?, ?)
  `).run(
    item.campaign_id,
    item.row_creative_payload !== undefined ? item.row_creative_payload : null,
    item.generation_status !== undefined ? item.generation_status : 'pending'
  );
}

export function getPillarCampaignItem(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(id);
}

export function listPillarCampaignItems(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaignId);
}

export function checkAndUpdatePillarCampaignCompletion(campaignId) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(campaignId);
  if (!campaign || campaign.status === 'completed') return;

  const items = db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
  if (items.length === 0) return;

  const actualNeedsSocial = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  const allFinished = items.every(item => {
    if (
      item.generation_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.visual_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      (actualNeedsSocial && item.social_post_status === 'failed')
    ) {
      return true;
    }

    const generationSuccess = item.generation_status === 'completed';
    if (!generationSuccess) return false;

    const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
    if (!ttsSuccess) return false;

    const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
    if (!visualSuccess) return false;

    const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
    if (!ffmpegSuccess) return false;

    if (actualNeedsSocial) {
      return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
    }

    return true;
  });

  if (allFinished) {
    const hasRetryableFailures = items.some(item => {
      const isFailed = item.generation_status === 'failed' ||
                       item.tts_status === 'failed' ||
                       item.visual_status === 'failed' ||
                       item.ffmpeg_status === 'failed' ||
                       (actualNeedsSocial && item.social_post_status === 'failed');
      const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
      return isFailed && retryCount < 3;
    });

    if (!hasRetryableFailures) {
      db.prepare("UPDATE pillar_campaigns SET status = 'completed' WHERE id = ?").run(campaignId);
      console.log(`[DB Monitor] Pillar Campaign ${campaignId} marked as completed.`);
    }
  }
}

export function updatePillarCampaignItem(id, updates) {
  const db = getDb();
  const allowed = [
    'generation_status', 'result_json', 'tts_status', 'tts_batch_id', 
    'visual_status', 'visual_tasks_json', 'visual_clip_paths', 
    'ffmpeg_status', 'ffmpeg_output_path', 'upload_status', 'drive_link', 
    'social_post_status', 'social_links_json', 't2i_start_frame_path', 'retry_count',
    'row_creative_payload', 'new_video_plan_json', 'video_dna_json', 't2i_images_json',
    'workflow_status', 'regenerate_start_frames_status', 'regenerate_start_frames_progress'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  const result = db.prepare(`UPDATE pillar_campaign_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  try {
    const item = db.prepare('SELECT campaign_id FROM pillar_campaign_items WHERE id = ?').get(id);
    if (item && item.campaign_id) {
      checkAndUpdatePillarCampaignCompletion(item.campaign_id);
    }
  } catch (e) {
    console.error('[DB] Auto completion check failed for pillar:', e);
  }

  return result;
}

export function getStrategicCampaignItem(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM strategic_campaign_items WHERE id = ?').get(id);
}

export function listStrategicCampaignItems(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM strategic_campaign_items WHERE campaign_id = ? ORDER BY sequence ASC, id ASC').all(campaignId);
}

export function checkAndUpdateStrategicCampaignCompletion(campaignId) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM strategic_campaigns WHERE id = ?').get(campaignId);
  if (!campaign || campaign.status === 'completed') return;

  const items = db.prepare('SELECT * FROM strategic_campaign_items WHERE campaign_id = ?').all(campaignId);
  if (items.length === 0) return;

  const actualNeedsSocial = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  const allFinished = items.every(item => {
    if (
      item.generation_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.visual_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      (actualNeedsSocial && item.social_post_status === 'failed')
    ) {
      return true;
    }

    const generationSuccess = item.generation_status === 'completed';
    if (!generationSuccess) return false;

    const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
    if (!ttsSuccess) return false;

    const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
    if (!visualSuccess) return false;

    const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
    if (!ffmpegSuccess) return false;

    if (actualNeedsSocial) {
      return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
    }

    return true;
  });

  if (allFinished) {
    const hasRetryableFailures = items.some(item => {
      const isFailed = item.generation_status === 'failed' ||
                       item.tts_status === 'failed' ||
                       item.visual_status === 'failed' ||
                       item.ffmpeg_status === 'failed' ||
                       (actualNeedsSocial && item.social_post_status === 'failed');
      const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
      return isFailed && retryCount < 3;
    });

    if (!hasRetryableFailures) {
      db.prepare("UPDATE strategic_campaigns SET status = 'completed' WHERE id = ?").run(campaignId);
      console.log(`[DB Monitor] Strategic Campaign ${campaignId} marked as completed.`);
    }
  }
}

export function updateStrategicCampaignItem(id, updates) {
  const db = getDb();
  const allowed = [
    'generation_status', 'tts_status', 'tts_batch_id', 
    'visual_status', 'visual_tasks_json', 'visual_clip_paths', 
    'ffmpeg_status', 'ffmpeg_output_path', 'upload_status', 'drive_link', 
    'social_post_status', 'social_links_json', 'retry_count', 'error_message',
    'creative_package_json', 'publishing_package_json', 'final_package_json', 'workflow_status', 'video_dna_json'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  const result = db.prepare(`UPDATE strategic_campaign_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  try {
    const item = db.prepare('SELECT campaign_id FROM strategic_campaign_items WHERE id = ?').get(id);
    if (item && item.campaign_id) {
      checkAndUpdateStrategicCampaignCompletion(item.campaign_id);
    }
  } catch (e) {
    console.error('[DB] Auto completion check failed for strategic campaign item:', e);
  }

  return result;
}

export function getNextPendingPillarSourcingItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending_sourcing' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingPillarGeneratorItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingPillarTtsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'completed' AND i.tts_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingPillarGlabsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE (i.tts_status = 'completed' OR i.tts_status = 'skipped') AND i.visual_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingPillarFfmpegItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'completed' AND i.ffmpeg_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingPillarSocialPostItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE (i.ffmpeg_status = 'completed' OR i.ffmpeg_status = 'skipped') AND i.social_post_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function createSystemAuditLog({ severity_level = 'WARNING', module_name, reference_id = null, error_message, human_resolution_hint = null }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO system_audit_logs (severity_level, module_name, reference_id, error_message, human_resolution_hint)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(severity_level, module_name, reference_id, error_message, human_resolution_hint);

  // Auto-trim: Hapus log lama jika lebih dari 500 baris
  try {
    db.exec(`
      DELETE FROM system_audit_logs 
      WHERE id NOT IN (SELECT id FROM system_audit_logs ORDER BY id DESC LIMIT 500)
    `);
  } catch (e) {
    console.error('[DB] Auto trim system_audit_logs failed:', e);
  }

  return result;
}

export function listSystemAuditLogs(includeResolved = false) {
  const db = getDb();
  if (includeResolved) {
    return db.prepare("SELECT * FROM system_audit_logs ORDER BY id DESC").all();
  } else {
    return db.prepare("SELECT * FROM system_audit_logs WHERE is_resolved = 0 ORDER BY id DESC").all();
  }
}

export function resolveSystemAuditLog(id) {
  const db = getDb();
  return db.prepare("UPDATE system_audit_logs SET is_resolved = 1 WHERE id = ?").run(id);
}

export function clearResolvedSystemAuditLogs() {
  const db = getDb();
  return db.exec("DELETE FROM system_audit_logs WHERE is_resolved = 1");
}


// ============================================================================
// V9.0: Instant Factory Mass Production Helper Operations
// ============================================================================

export function createInstantCampaignItem({ campaign_id, row_creative_payload, generation_status = 'pending' }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO instant_campaign_items (campaign_id, row_creative_payload, generation_status)
    VALUES (?, ?, ?)
  `);
  return stmt.run(campaign_id, row_creative_payload, generation_status);
}

export function listInstantCampaignItems(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM instant_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaignId);
}

export function getInstantCampaignItem(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM instant_campaign_items WHERE id = ?').get(id);
}

export function checkAndUpdateInstantCampaignCompletion(campaignId) {
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM instant_campaigns WHERE id = ?').get(campaignId);
  if (!campaign || campaign.status === 'completed') return;

  const items = db.prepare('SELECT * FROM instant_campaign_items WHERE campaign_id = ?').all(campaignId);
  if (items.length === 0) return;

  const config = db.prepare('SELECT * FROM instant_campaign_configs WHERE campaign_id = ?').get(campaignId);
  
  const enableSocialPost = campaign.enable_social_post !== undefined ? campaign.enable_social_post : 0;
  const actualNeedsSocial = enableSocialPost === 1 || campaign.post_facebook_draft === 1 || campaign.post_youtube_draft === 1 || campaign.post_tiktok_draft === 1;

  const allFinished = items.every(item => {
    if (
      item.generation_status === 'failed' ||
      item.tts_status === 'failed' ||
      item.visual_status === 'failed' ||
      item.ffmpeg_status === 'failed' ||
      (actualNeedsSocial && item.social_post_status === 'failed')
    ) {
      return true;
    }

    const generationSuccess = item.generation_status === 'completed';
    if (!generationSuccess) return false;

    const ttsSuccess = item.tts_status === 'completed' || item.tts_status === 'skipped';
    if (!ttsSuccess) return false;

    const visualSuccess = item.visual_status === 'completed' || item.visual_status === 'skipped';
    if (!visualSuccess) return false;

    const ffmpegSuccess = item.ffmpeg_status === 'completed' || item.ffmpeg_status === 'skipped';
    if (!ffmpegSuccess) return false;

    if (actualNeedsSocial) {
      return item.social_post_status === 'completed' || item.social_post_status === 'skipped';
    }

    return true;
  });

  if (allFinished) {
    const hasRetryableFailures = items.some(item => {
      const isFailed = item.generation_status === 'failed' ||
                       item.tts_status === 'failed' ||
                       item.visual_status === 'failed' ||
                       item.ffmpeg_status === 'failed' ||
                       (actualNeedsSocial && item.social_post_status === 'failed');
      const retryCount = item.retry_count !== undefined ? Number(item.retry_count) : 0;
      return isFailed && retryCount < 3;
    });

    if (!hasRetryableFailures) {
      db.prepare("UPDATE instant_campaigns SET status = 'completed' WHERE id = ?").run(campaignId);
      console.log(`[DB Monitor] Instant Campaign ${campaignId} marked as completed.`);
    }
  }
}

export function updateInstantCampaignItem(id, updates) {
  const db = getDb();
  const allowed = [
    'generation_status', 'result_json', 'tts_status', 'tts_batch_id', 
    'visual_status', 'visual_tasks_json', 'visual_clip_paths', 
    'ffmpeg_status', 'ffmpeg_output_path', 'upload_status', 'drive_link', 
    'social_post_status', 'social_links_json', 'retry_count',
    'row_creative_payload'
  ];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  const result = db.prepare(`UPDATE instant_campaign_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  try {
    const item = db.prepare('SELECT campaign_id FROM instant_campaign_items WHERE id = ?').get(id);
    if (item && item.campaign_id) {
      checkAndUpdateInstantCampaignCompletion(item.campaign_id);
    }
  } catch (e) {
    console.error('[DB] Auto completion check failed for instant campaign:', e);
  }

  return result;
}

export function getNextPendingInstantSourcingItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending_sourcing' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingInstantGeneratorItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingInstantTtsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'completed' AND i.tts_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingInstantGlabsItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE (i.tts_status = 'completed' OR i.tts_status = 'skipped') AND i.visual_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingInstantFfmpegItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'completed' AND i.ffmpeg_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

export function getNextPendingInstantSocialPostItem() {
  const db = getDb();
  return db.prepare(
    "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE (i.ffmpeg_status = 'completed' OR i.ffmpeg_status = 'skipped') AND i.social_post_status = 'pending' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
  ).get();
}

// ==========================================
// Sheets Autopilot CRUD Helpers (V10.3)
// ==========================================

export function createSheetsCampaign(campaign) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sheets_campaigns (
      id, campaign_name, campaign_type, target_language, spreadsheet_id, gdrive_folder_id,
      aspect_ratio, target_ai, video_model, visual_mode, words_per_clip, face_visibility,
      custom_instruction, brand_profile_id, visual_overrides_json, is_bridging_active,
      target_clips_count, bridge_at_clip, bridge_duration_clips, bridging_mode,
      target_product_id, promotion_style, narrative_mode, enable_tts, enable_glabs, enable_ffmpeg,
      enable_social_post, voice_provider, voice_persona, voice_speed, voice_volume,
      ffmpeg_sync_option, ffmpeg_video_scale, ffmpeg_sfx_volume, ffmpeg_bgm_volume,
      tts_model_quality, status, visual_style, enable_audio_segment, voice_cast_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  return stmt.run(
    campaign.id, campaign.campaign_name, campaign.campaign_type, campaign.target_language || 'id-ID',
    campaign.spreadsheet_id, campaign.gdrive_folder_id || null,
    campaign.aspect_ratio || '9:16', campaign.target_ai || 'Google Veo (8s)',
    campaign.video_model || 'veo_31_lite', campaign.visual_mode || 'hybrid_lock',
    campaign.words_per_clip || '17-19 kata', campaign.face_visibility || 'Faceless',
    campaign.custom_instruction || '', campaign.brand_profile_id || null,
    campaign.visual_overrides_json || null, campaign.is_bridging_active || 0,
    campaign.target_clips_count || 4, campaign.bridge_at_clip || 2,
    campaign.bridge_duration_clips || 1, campaign.bridging_mode || 'select_existing',
    campaign.target_product_id || null, campaign.promotion_style || 'Softselling',
    campaign.narrative_mode || 'Storytelling',
    campaign.enable_tts || 0, campaign.enable_glabs || 0, campaign.enable_ffmpeg || 0,
    campaign.enable_social_post || 0, campaign.voice_provider || 'minimax',
    campaign.voice_persona || 'Professional Anchor', campaign.voice_speed || 1.0,
    campaign.voice_volume || 1.0, campaign.ffmpeg_sync_option || 'smart_sync',
    campaign.ffmpeg_video_scale || 1.0, campaign.ffmpeg_sfx_volume || 0.0,
    campaign.ffmpeg_bgm_volume || 0.15, campaign.tts_model_quality || 'speech-2.8-turbo',
    campaign.status || 'active', campaign.visual_style || 'Cinematic',
    campaign.enable_audio_segment || 0, campaign.voice_cast_json || null
  );
}

export function getSheetsCampaigns() {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM sheets_jobs j WHERE campaign_id = c.id AND j.id = (
        SELECT id FROM sheets_jobs WHERE campaign_id = j.campaign_id AND row_index = j.row_index ORDER BY created_at DESC LIMIT 1
      )) as total_jobs,
      (SELECT COUNT(*) FROM sheets_jobs j WHERE campaign_id = c.id AND status = 'completed' AND j.id = (
        SELECT id FROM sheets_jobs WHERE campaign_id = j.campaign_id AND row_index = j.row_index ORDER BY created_at DESC LIMIT 1
      )) as completed_jobs,
      (SELECT COUNT(*) FROM sheets_jobs j WHERE campaign_id = c.id AND status = 'failed' AND j.id = (
        SELECT id FROM sheets_jobs WHERE campaign_id = j.campaign_id AND row_index = j.row_index ORDER BY created_at DESC LIMIT 1
      )) as failed_jobs,
      (SELECT COUNT(*) FROM sheets_jobs j WHERE campaign_id = c.id AND status = 'processing' AND j.id = (
        SELECT id FROM sheets_jobs WHERE campaign_id = j.campaign_id AND row_index = j.row_index ORDER BY created_at DESC LIMIT 1
      )) as processing_jobs
    FROM sheets_campaigns c
    ORDER BY c.created_at DESC
  `).all();
}

export function getSheetsCampaign(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM sheets_campaigns WHERE id = ?').get(id);
}

export function deleteSheetsCampaign(id) {
  const db = getDb();
  return db.prepare('DELETE FROM sheets_campaigns WHERE id = ?').run(id);
}

export function updateSheetsCampaignStatus(id, status) {
  const db = getDb();
  return db.prepare('UPDATE sheets_campaigns SET status = ? WHERE id = ?').run(status, id);
}

export function createSheetsJob(job) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sheets_jobs (
      id, campaign_id, batch_id, row_index, url_or_topic, status, storyboard, voiceover,
      local_video_path, local_audio_path, gdrive_folder_url, retry_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    job.id, job.campaign_id, job.batch_id, job.row_index, job.url_or_topic, job.status || 'pending',
    job.storyboard || null, job.voiceover || null, job.local_video_path || null,
    job.local_audio_path || null, job.gdrive_folder_url || null, job.retry_count || 0
  );
}

export function getSheetsJobs(campaignId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM sheets_jobs j
    WHERE campaign_id = ? AND j.id = (
      SELECT id FROM sheets_jobs
      WHERE campaign_id = j.campaign_id AND row_index = j.row_index
      ORDER BY created_at DESC LIMIT 1
    )
    ORDER BY row_index ASC
  `).all(campaignId);
}

export function getSheetsJob(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM sheets_jobs WHERE id = ?').get(id);
}

export function updateSheetsJobStatus(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE sheets_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// ========================
// V8.9: Deconstruct Lab CRUD
// ========================

export function createDeconstructBatch(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO re_deconstruct_batches (id, batch_name, target_recommendation_count, total_videos)
    VALUES (?, ?, ?, ?)
  `).run(data.id, data.batch_name, data.target_recommendation_count, data.total_videos);
  return data.id;
}

export function createDeconstructAsset(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO re_deconstructed_assets (id, batch_id, source_url, original_caption)
    VALUES (?, ?, ?, ?)
  `).run(data.id, data.batch_id, data.source_url, data.original_caption || null);
}

export function getDeconstructBatches() {
  const db = getDb();
  return db.prepare(`
    SELECT id, batch_name, target_recommendation_count, status, total_videos, processed_videos, created_at
    FROM re_deconstruct_batches
    ORDER BY created_at DESC
  `).all();
}

export function getDeconstructBatchById(id) {
  const db = getDb();
  const batch = db.prepare('SELECT * FROM re_deconstruct_batches WHERE id = ?').get(id);
  if (!batch) return null;
  const assets = db.prepare('SELECT * FROM re_deconstructed_assets WHERE batch_id = ? ORDER BY created_at ASC').all(id);
  return { ...batch, assets };
}

export function deleteDeconstructBatch(id) {
  const db = getDb();
  db.prepare('DELETE FROM re_deconstructed_assets WHERE batch_id = ?').run(id);
  db.prepare('DELETE FROM re_deconstruct_batches WHERE id = ?').run(id);
}

export function getNextPendingDeconstructAsset() {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, b.target_recommendation_count
    FROM re_deconstructed_assets a
    JOIN re_deconstruct_batches b ON a.batch_id = b.id
    WHERE a.status = 'pending_download'
    ORDER BY a.created_at ASC
    LIMIT 1
  `).get();
}

export function updateDeconstructAsset(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE re_deconstructed_assets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function updateDeconstructBatchProgress(batchId) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as cnt FROM re_deconstructed_assets WHERE batch_id = ?').get(batchId).cnt;
  const processed = db.prepare("SELECT COUNT(*) as cnt FROM re_deconstructed_assets WHERE batch_id = ? AND status IN ('deconstructed', 'failed')").get(batchId).cnt;
  const newStatus = processed >= total ? 'completed' : 'processing';
  db.prepare('UPDATE re_deconstruct_batches SET processed_videos = ?, status = ? WHERE id = ?').run(processed, newStatus, batchId);
  return { total, processed, status: newStatus };
}

// ========================
// V8.9: Multiplier Lab CRUD
// ========================

export function createMultiplierTask(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO re_multiplier_tasks (
      id, deconstruct_asset_id, target_product_url, affiliate_url,
      vso_config_json, bridging_config_json, audio_config_json, status, enable_vo_audit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.deconstruct_asset_id,
    data.target_product_url || null,
    data.affiliate_url || null,
    data.vso_config_json || null,
    data.bridging_config_json || null,
    data.audio_config_json || null,
    data.status || 'pending_resolution',
    data.enable_vo_audit !== undefined ? Number(data.enable_vo_audit) : 1
  );
  return data.id;
}

export function getMultiplierTasks() {
  const db = getDb();
  return db.prepare(`
    SELECT t.*, a.source_url as asset_source_url
    FROM re_multiplier_tasks t
    LEFT JOIN re_deconstructed_assets a ON t.deconstruct_asset_id = a.id
    ORDER BY t.created_at DESC
  `).all();
}

export function getMultiplierTaskById(id) {
  const db = getDb();
  return db.prepare(`
    SELECT t.*, a.source_url as asset_source_url, a.original_storyboard_json
    FROM re_multiplier_tasks t
    LEFT JOIN re_deconstructed_assets a ON t.deconstruct_asset_id = a.id
    WHERE t.id = ?
  `).get(id);
}

export function deleteMultiplierTask(id) {
  const db = getDb();
  db.prepare('DELETE FROM re_multiplier_tasks WHERE id = ?').run(id);
}

export function updateMultiplierTask(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE re_multiplier_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getNextPendingMultiplierTask() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM re_multiplier_tasks
    WHERE status IN ('pending_resolution', 'resolving_product', 'remaking', 'generating_audio', 'generating_visuals', 'ffmpeg_muxing')
    ORDER BY created_at ASC
    LIMIT 1
  `).get();
}

// ==========================================
// V9.0 RECIPE LABS HELPERS
// ==========================================

export function createRecipeCampaign(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO recipe_campaigns (
      id, category, custom_category, visual_style, nextcloud_parent_folder, post_to_facebook, enable_glabs, target_recipe_count, images_per_recipe, selected_layout_id, grid_gap_size, grid_border_radius, grid_outer_padding, grid_bg_color, status, campaign_type, brand_profile_id, spreadsheet_id, config_json, source_deconstruct_asset_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.category,
    data.custom_category || null,
    data.visual_style || 'Food Porn',
    data.nextcloud_parent_folder || 'MAKNA_Recipes',
    data.post_to_facebook !== undefined ? Number(data.post_to_facebook) : 0,
    data.enable_glabs !== undefined ? Number(data.enable_glabs) : 1,
    data.target_recipe_count || 1,
    data.images_per_recipe || 4,
    data.selected_layout_id || '4_editorial_split',
    data.grid_gap_size !== undefined ? Number(data.grid_gap_size) : 12,
    data.grid_border_radius !== undefined ? Number(data.grid_border_radius) : 16,
    data.grid_outer_padding !== undefined ? Number(data.grid_outer_padding) : 16,
    data.grid_bg_color || '#0d0d12',
    data.status || 'processing',
    data.campaign_type || 'static',
    data.brand_profile_id || null,
    data.spreadsheet_id || null,
    data.config_json || null,
    data.source_deconstruct_asset_id || null
  );
  return data.id;
}

export function getRecipeCampaigns() {
  const db = getDb();
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM recipe_items i WHERE i.campaign_id = c.id) as total_items,
      (SELECT COUNT(*) FROM recipe_items i WHERE i.campaign_id = c.id AND i.status = 'completed') as completed_items
    FROM recipe_campaigns c
    ORDER BY c.created_at DESC
  `).all();
}

export function getRecipeCampaignById(id) {
  const db = getDb();
  return db.prepare(`SELECT * FROM recipe_campaigns WHERE id = ?`).get(id);
}

export function updateRecipeCampaign(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE recipe_campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteRecipeCampaign(id) {
  const db = getDb();
  db.prepare(`DELETE FROM recipe_campaigns WHERE id = ?`).run(id);
}

export function createRecipeItem(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO recipe_items (
      id, campaign_id, recipe_title, recipe_markdown_text, t2i_prompts_json, status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.campaign_id,
    data.recipe_title || null,
    data.recipe_markdown_text || null,
    data.t2i_prompts_json || null,
    data.status || 'pending_gemini'
  );
  return data.id;
}

export function getRecipeItemsByCampaign(campaignId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM recipe_items WHERE campaign_id = ? ORDER BY created_at ASC`).all(campaignId);
}

export function getRecipeItemById(id) {
  const db = getDb();
  return db.prepare(`SELECT * FROM recipe_items WHERE id = ?`).get(id);
}

export function updateRecipeItem(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  return db.prepare(`UPDATE recipe_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function cleanupStaleJobs() {
  const db = getDb();
  const result = db.prepare(`
    UPDATE scheduler_jobs 
    SET status = 'pending', started_at = NULL 
    WHERE status = 'running'
  `).run();
  console.log(`[DB Boot Cleanup] Berhasil memulihkan ${result.changes} pekerjaan yang tertahan.`);
}

export function retryReCampaignItem(itemId) {
  const db = getDb();
  const item = db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
  if (!item) return false;

  const updates = { retry_count: 0 };
  if (item.scrape_status === 'failed') updates.scrape_status = 'pending';
  else if (item.analyze_status === 'failed') updates.analyze_status = 'pending';
  else if (item.tts_status === 'failed') updates.tts_status = 'pending';
  else if (item.visual_status === 'failed') {
    updates.visual_status = 'pending';
    updates.visual_tasks_json = null;
  }
  else if (item.ffmpeg_status === 'failed') updates.ffmpeg_status = 'pending';
  else if (item.upload_status === 'failed') updates.upload_status = 'pending';
  else if (item.social_post_status === 'failed') updates.social_post_status = 'pending';

  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE re_campaign_items SET ${fields} WHERE id = ?`).run(...values, itemId);

  // Set campaign status back to running to ensure scheduler picks it up
  db.prepare(`UPDATE re_campaigns SET status = 'running' WHERE id = ?`).run(item.campaign_id);

  return true;
}

export function resetReCampaignItem(itemId) {
  const db = getDb();
  const item = db.prepare('SELECT campaign_id FROM re_campaign_items WHERE id = ?').get(itemId);
  if (!item) return false;

  db.prepare(`
    UPDATE re_campaign_items SET
      scrape_status = 'pending',
      analyze_status = 'pending',
      tts_status = 'pending',
      visual_status = 'pending',
      ffmpeg_status = 'pending',
      upload_status = 'pending',
      social_post_status = 'pending',
      workflow_status = 'ready_for_review',
      retry_count = 0,
      tts_batch_id = null,
      visual_clip_paths = null,
      ffmpeg_output_path = null,
      visual_tasks_json = null,
      t2i_images_json = null,
      t2i_start_frame_path = null,
      original_deconstruction_json = null,
      new_video_plan_json = null,
      video_dna_json = null,
      result_json = null,
      drive_link = null,
      social_links_json = null
    WHERE id = ?
  `).run(itemId);

  // Set campaign status back to running to ensure scheduler picks it up
  db.prepare(`UPDATE re_campaigns SET status = 'running' WHERE id = ?`).run(item.campaign_id);

  return true;
}

export function upsertContentFlowItem(item) {
  const db = getDb();
  const id = item.id || `cf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO content_flow_items (
      id, source_type, source_campaign_id, source_item_id, account_name, video_id,
      campaign_title, hook, nama_produk, link_affiliate, link_produk, caption,
      production_date, url_asset, drive_link, nextcloud_url, pipeline_status,
      tiktok_status, tiktok_publish_date, permalink_tiktok,
      facebook_status, facebook_publish_date, permalink_facebook,
      instagram_status, instagram_publish_date, permalink_instagram,
      youtube_status, youtube_publish_date, permalink_youtube,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      account_name = CASE WHEN EXCLUDED.account_name IS NOT NULL AND LENGTH(EXCLUDED.account_name) > 0 AND EXCLUDED.account_name != 'Umum' THEN EXCLUDED.account_name ELSE content_flow_items.account_name END,
      video_id = CASE WHEN EXCLUDED.video_id IS NOT NULL AND LENGTH(EXCLUDED.video_id) > 0 THEN EXCLUDED.video_id ELSE content_flow_items.video_id END,
      campaign_title = CASE WHEN EXCLUDED.campaign_title IS NOT NULL AND LENGTH(EXCLUDED.campaign_title) > 0 THEN EXCLUDED.campaign_title ELSE content_flow_items.campaign_title END,
      hook = CASE WHEN EXCLUDED.hook IS NOT NULL AND LENGTH(EXCLUDED.hook) > 0 THEN EXCLUDED.hook ELSE content_flow_items.hook END,
      nama_produk = CASE WHEN EXCLUDED.nama_produk IS NOT NULL AND LENGTH(EXCLUDED.nama_produk) > 0 AND EXCLUDED.nama_produk != 'Umum' THEN EXCLUDED.nama_produk ELSE content_flow_items.nama_produk END,
      link_affiliate = CASE WHEN EXCLUDED.link_affiliate IS NOT NULL AND LENGTH(EXCLUDED.link_affiliate) > 0 THEN EXCLUDED.link_affiliate ELSE content_flow_items.link_affiliate END,
      link_produk = CASE WHEN EXCLUDED.link_produk IS NOT NULL AND LENGTH(EXCLUDED.link_produk) > 0 THEN EXCLUDED.link_produk ELSE content_flow_items.link_produk END,
      caption = CASE WHEN EXCLUDED.caption IS NOT NULL AND LENGTH(EXCLUDED.caption) > 0 THEN EXCLUDED.caption ELSE content_flow_items.caption END,
      url_asset = CASE WHEN EXCLUDED.url_asset IS NOT NULL AND LENGTH(EXCLUDED.url_asset) > 0 THEN EXCLUDED.url_asset ELSE content_flow_items.url_asset END,
      drive_link = CASE WHEN EXCLUDED.drive_link IS NOT NULL AND LENGTH(EXCLUDED.drive_link) > 0 THEN EXCLUDED.drive_link ELSE content_flow_items.drive_link END,
      nextcloud_url = CASE WHEN EXCLUDED.nextcloud_url IS NOT NULL AND LENGTH(EXCLUDED.nextcloud_url) > 0 THEN EXCLUDED.nextcloud_url ELSE content_flow_items.nextcloud_url END,
      pipeline_status = CASE WHEN EXCLUDED.pipeline_status IS NOT NULL AND LENGTH(EXCLUDED.pipeline_status) > 0 THEN EXCLUDED.pipeline_status ELSE content_flow_items.pipeline_status END,
      updated_at = EXCLUDED.updated_at
  `);

  stmt.run(
    id,
    item.source_type || 'opc',
    item.source_campaign_id || null,
    item.source_item_id || null,
    item.account_name || 'Umum',
    item.video_id || `VID-${Date.now().toString(36).toUpperCase()}`,
    item.campaign_title || '',
    item.hook || '',
    item.nama_produk || '',
    item.link_affiliate || '',
    item.link_produk || '',
    item.caption || '',
    item.production_date || now,
    item.url_asset || '',
    item.drive_link || '',
    item.nextcloud_url || '',
    item.pipeline_status || 'Completed',
    item.tiktok_status || 'Not Published',
    item.tiktok_publish_date || null,
    item.permalink_tiktok || null,
    item.facebook_status || 'Not Published',
    item.facebook_publish_date || null,
    item.permalink_facebook || null,
    item.instagram_status || 'Not Published',
    item.instagram_publish_date || null,
    item.permalink_instagram || null,
    item.youtube_status || 'Not Published',
    item.youtube_publish_date || null,
    item.permalink_youtube || null,
    item.created_at || now,
    now
  );

  // Auto-sync to PostgreSQL Storage Node 3 (non-blocking but returns promise)
  let pgPromise = null;
  try {
    pgPromise = pgQuery(`
      INSERT INTO content_flow_items (
        id, source_type, source_campaign_id, source_item_id, account_name, video_id,
        campaign_title, hook, nama_produk, link_affiliate, link_produk, caption,
        production_date, url_asset, drive_link, nextcloud_url, pipeline_status,
        tiktok_status, facebook_status, instagram_status, youtube_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (id) DO UPDATE SET
        account_name = CASE WHEN EXCLUDED.account_name IS NOT NULL AND LENGTH(EXCLUDED.account_name) > 0 AND EXCLUDED.account_name != 'Umum' THEN EXCLUDED.account_name ELSE content_flow_items.account_name END,
        video_id = CASE WHEN EXCLUDED.video_id IS NOT NULL AND LENGTH(EXCLUDED.video_id) > 0 THEN EXCLUDED.video_id ELSE content_flow_items.video_id END,
        campaign_title = CASE WHEN EXCLUDED.campaign_title IS NOT NULL AND LENGTH(EXCLUDED.campaign_title) > 0 THEN EXCLUDED.campaign_title ELSE content_flow_items.campaign_title END,
        hook = CASE WHEN EXCLUDED.hook IS NOT NULL AND LENGTH(EXCLUDED.hook) > 0 THEN EXCLUDED.hook ELSE content_flow_items.hook END,
        nama_produk = CASE WHEN EXCLUDED.nama_produk IS NOT NULL AND LENGTH(EXCLUDED.nama_produk) > 0 AND EXCLUDED.nama_produk != 'Umum' THEN EXCLUDED.nama_produk ELSE content_flow_items.nama_produk END,
        link_affiliate = CASE WHEN EXCLUDED.link_affiliate IS NOT NULL AND LENGTH(EXCLUDED.link_affiliate) > 0 THEN EXCLUDED.link_affiliate ELSE content_flow_items.link_affiliate END,
        link_produk = CASE WHEN EXCLUDED.link_produk IS NOT NULL AND LENGTH(EXCLUDED.link_produk) > 0 THEN EXCLUDED.link_produk ELSE content_flow_items.link_produk END,
        caption = CASE WHEN EXCLUDED.caption IS NOT NULL AND LENGTH(EXCLUDED.caption) > 0 THEN EXCLUDED.caption ELSE content_flow_items.caption END,
        url_asset = CASE WHEN EXCLUDED.url_asset IS NOT NULL AND LENGTH(EXCLUDED.url_asset) > 0 THEN EXCLUDED.url_asset ELSE content_flow_items.url_asset END,
        drive_link = CASE WHEN EXCLUDED.drive_link IS NOT NULL AND LENGTH(EXCLUDED.drive_link) > 0 THEN EXCLUDED.drive_link ELSE content_flow_items.drive_link END,
        nextcloud_url = CASE WHEN EXCLUDED.nextcloud_url IS NOT NULL AND LENGTH(EXCLUDED.nextcloud_url) > 0 THEN EXCLUDED.nextcloud_url ELSE content_flow_items.nextcloud_url END,
        pipeline_status = CASE WHEN EXCLUDED.pipeline_status IS NOT NULL AND LENGTH(EXCLUDED.pipeline_status) > 0 THEN EXCLUDED.pipeline_status ELSE content_flow_items.pipeline_status END,
        updated_at = EXCLUDED.updated_at;
    `, [
      id, item.source_type || 'opc', item.source_campaign_id || null, String(item.source_item_id || ''),
      item.account_name || 'Umum', item.video_id || `VID-${Date.now().toString(36).toUpperCase()}`,
      item.campaign_title || '', item.hook || '', item.nama_produk || 'Umum', item.link_affiliate || '', item.link_produk || '',
      item.caption || '', item.production_date || now, item.url_asset || '', item.drive_link || '', item.nextcloud_url || '',
      item.pipeline_status || 'Completed', item.tiktok_status || 'Not Published', item.facebook_status || 'Not Published',
      item.instagram_status || 'Not Published', item.youtube_status || 'Not Published', item.created_at || now, now
    ]).catch(err => console.error('[DB PG Sync Error]', err.message));
  } catch (err) {
    console.error('[DB PG Connection/Sync Exception]', err);
  }

  return pgPromise ? pgPromise.then(() => id) : Promise.resolve(id);
}

export function getContentFlowItems(filters = {}) {
  const db = getDb();
  let sql = `SELECT * FROM content_flow_items WHERE 1=1`;
  const params = [];

  if (filters.allowedAccounts && Array.isArray(filters.allowedAccounts)) {
    if (filters.allowedAccounts.length > 0) {
      const placeholders = filters.allowedAccounts.map(() => 'LOWER(?)').join(',');
      sql += ` AND LOWER(account_name) IN (${placeholders})`;
      params.push(...filters.allowedAccounts);
    } else {
      sql += ` AND 1=0`; // User has no assigned brand permissions
    }
  }

  if (filters.sourceType && filters.sourceType !== 'all') {
    sql += ` AND source_type = ?`;
    params.push(filters.sourceType);
  }
  if (filters.accountName && filters.accountName !== 'all') {
    sql += ` AND LOWER(account_name) = LOWER(?)`;
    params.push(filters.accountName);
  }
  if (filters.productName && filters.productName !== 'all') {
    sql += ` AND nama_produk = ?`;
    params.push(filters.productName);
  }
  if (filters.pipelineStatus && filters.pipelineStatus !== 'all') {
    sql += ` AND pipeline_status = ?`;
    params.push(filters.pipelineStatus);
  }
  if (filters.tiktokStatus && filters.tiktokStatus !== 'Semua') {
    sql += ` AND tiktok_status = ?`;
    params.push(filters.tiktokStatus);
  }
  if (filters.facebookStatus && filters.facebookStatus !== 'Semua') {
    sql += ` AND facebook_status = ?`;
    params.push(filters.facebookStatus);
  }
  if (filters.instagramStatus && filters.instagramStatus !== 'Semua') {
    sql += ` AND instagram_status = ?`;
    params.push(filters.instagramStatus);
  }
  if (filters.q && filters.q.trim()) {
    const qStr = `%${filters.q.trim()}%`;
    sql += ` AND (video_id LIKE ? OR hook LIKE ? OR nama_produk LIKE ? OR campaign_title LIKE ? OR caption LIKE ?)`;
    params.push(qStr, qStr, qStr, qStr, qStr);
  }

  sql += ` ORDER BY created_at ASC`;

  const page = parseInt(filters.page || '1', 10);
  const limit = parseInt(filters.limit || '20', 10);
  const offset = (page - 1) * limit;

  // Get total count
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const totalCountRes = db.prepare(countSql).get(...params);
  const totalItems = totalCountRes ? totalCountRes.count : 0;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const items = db.prepare(sql).all(...params);

  // Distinct account list & product list
  const accountsRes = db.prepare(`SELECT DISTINCT account_name FROM content_flow_items WHERE account_name IS NOT NULL AND account_name != ''`).all();
  let accounts = accountsRes.map(a => a.account_name);
  if (filters.allowedAccounts && Array.isArray(filters.allowedAccounts)) {
    accounts = accounts.filter(a => filters.allowedAccounts.includes(a));
  }

  const productsRes = db.prepare(`SELECT DISTINCT nama_produk FROM content_flow_items WHERE nama_produk IS NOT NULL AND nama_produk != ''`).all();
  const products = productsRes.map(p => p.nama_produk);

  return {
    items,
    total_items: totalItems,
    current_page: page,
    total_pages: totalPages,
    available_accounts: accounts,
    available_products: products
  };
}

export function updateContentFlowPublishStatus(id, updateData) {
  const db = getDb();
  const allowedKeys = [
    'tiktok_status', 'tiktok_publish_date', 'permalink_tiktok',
    'facebook_status', 'facebook_publish_date', 'permalink_facebook',
    'instagram_status', 'instagram_publish_date', 'permalink_instagram',
    'youtube_status', 'youtube_publish_date', 'permalink_youtube',
    'account_name', 'drive_link', 'nextcloud_url', 'url_asset',
    'link_produk', 'link_affiliate', 'nama_produk', 'pipeline_status', 'catatan'
  ];

  const fields = [];
  const values = [];

  for (const key of Object.keys(updateData)) {
    if (allowedKeys.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(updateData[key]);
    }
  }

  if (fields.length === 0) return false;

  fields.push(`updated_at = ?`);
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE content_flow_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return true;
}

export function getContentFlowItemById(id) {
  const db = getDb();
  return db.prepare(`SELECT * FROM content_flow_items WHERE id = ?`).get(id);
}

export function deleteContentFlowItem(id) {
  const db = getDb();
  return db.prepare('DELETE FROM content_flow_items WHERE id = ?').run(id).changes;
}

export function deleteContentFlowBrandItems(accountName) {
  const db = getDb();
  return db.prepare('DELETE FROM content_flow_items WHERE account_name = ?').run(accountName).changes;
}
