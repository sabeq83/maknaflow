import { NextResponse } from 'next/server';
import { getDb, updateReCampaignItem } from '../../../../../../../lib/db';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    const { 
      new_video_plan, 
      video_dna, 
      enable_tts, 
      enable_glabs, 
      enable_ffmpeg,
      voice_provider,
      voice_persona,
      voice_speed,
      voice_volume,
      ffmpeg_video_scale,
      ffmpeg_sfx_volume,
      ffmpeg_bgm_volume,
      ffmpeg_sync_option,
      sync_mode,
      only_save,
      selected_vo_version,
      caption
    } = await req.json();

    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare("SELECT * FROM re_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Campaign item not found" }, { status: 404 });
    }

    const campaign = await db.prepare("SELECT * FROM re_campaigns WHERE id = ?").get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    // 1. Map new_video_plan to storyboard/voiceover/prompts for backward compatibility
    let oldParsed = {};
    try {
      oldParsed = JSON.parse(item.result_json || '{}');
    } catch {}

    const storyboard = new_video_plan.map((p, idx) => ({
      scene: p.clip_index || (idx + 1),
      duration: "8s",
      visual_description: p.visual_action || p.i2v_prompt || p.t2v_prompt || p.t2i_prompt || "",
      camera_movement: "",
      audio_mood: ""
    }));

    const voiceover = new_video_plan.map((p, idx) => ({
      scene: p.clip_index || (idx + 1),
      narration: p.new_vo || "",
      duration: "8s",
      cta_facebook: p.cta_facebook || "",
      cta_tiktok: p.cta_tiktok || ""
    }));

    const t2v_prompts = new_video_plan.map((p, idx) => ({
      clip: p.clip_index || (idx + 1),
      prompt: p.t2v_prompt || ""
    }));

    const t2i_prompts = new_video_plan.map((p, idx) => ({
      clip: p.clip_index || (idx + 1),
      prompt: p.t2i_prompt || ""
    }));

    const i2v_prompts = new_video_plan.map((p, idx) => ({
      clip: p.clip_index || (idx + 1),
      prompt: p.i2v_prompt || ""
    }));

    const updatedResultJson = JSON.stringify({
      ...oldParsed,
      storyboard,
      voiceover,
      t2v_prompts,
      t2i_prompts,
      i2v_prompts,
      social_media_package: {
        caption: caption || oldParsed.social_media_package?.caption || oldParsed.caption || oldParsed.universal_caption || ""
      }
    });

    if (only_save) {
      // Update campaign settings (without changing campaign status to 'running')
      await db.prepare(`
        UPDATE re_campaigns
        SET enable_tts = ?, enable_glabs = ?, enable_ffmpeg = ?,
            voice_provider = ?, voice_persona = ?, voice_speed = ?, voice_volume = ?,
            ffmpeg_video_scale = ?, ffmpeg_sfx_volume = ?, ffmpeg_bgm_volume = ?, ffmpeg_sync_option = ?, sync_mode = ?
        WHERE id = ?
      `).run(
        enable_tts ? 1 : 0,
        enable_glabs ? 1 : 0,
        enable_ffmpeg ? 1 : 0,
        voice_provider || campaign.voice_provider || 'gemini',
        voice_persona || campaign.voice_persona || 'Kore',
        voice_speed !== undefined ? Number(voice_speed) : Number(campaign.voice_speed || 1.0),
        voice_volume !== undefined ? Number(voice_volume) : Number(campaign.voice_volume || 1.0),
        ffmpeg_video_scale !== undefined ? Number(ffmpeg_video_scale) : Number(campaign.ffmpeg_video_scale || 1.0),
        ffmpeg_sfx_volume !== undefined ? Number(ffmpeg_sfx_volume) : Number(campaign.ffmpeg_sfx_volume || 0.0),
        ffmpeg_bgm_volume !== undefined ? Number(ffmpeg_bgm_volume) : Number(campaign.ffmpeg_bgm_volume || 0.15),
        ffmpeg_sync_option || campaign.ffmpeg_sync_option || 'smart_sync',
        sync_mode || campaign.sync_mode || 'auto',
        campaign.id
      );

      // Save plan and settings without changing workflow status
      await updateReCampaignItem(itemId, {
        new_video_plan_json: JSON.stringify(new_video_plan),
        video_dna_json: JSON.stringify(video_dna),
        result_json: updatedResultJson,
        selected_vo_version: selected_vo_version || item.selected_vo_version || 'original'
      });

      return NextResponse.json({
        success: true,
        message: "Storyboard draft berhasil disimpan!"
      });
    }

    // 2. Update campaign production settings
    await db.prepare(`
      UPDATE re_campaigns
      SET enable_tts = ?, enable_glabs = ?, enable_ffmpeg = ?, status = 'running',
          voice_provider = ?, voice_persona = ?, voice_speed = ?, voice_volume = ?,
          ffmpeg_video_scale = ?, ffmpeg_sfx_volume = ?, ffmpeg_bgm_volume = ?, ffmpeg_sync_option = ?, sync_mode = ?
      WHERE id = ?
    `).run(
      enable_tts ? 1 : 0,
      enable_glabs ? 1 : 0,
      enable_ffmpeg ? 1 : 0,
      voice_provider || campaign.voice_provider || 'gemini',
      voice_persona || campaign.voice_persona || 'Kore',
      voice_speed !== undefined ? Number(voice_speed) : Number(campaign.voice_speed || 1.0),
      voice_volume !== undefined ? Number(voice_volume) : Number(campaign.voice_volume || 1.0),
      ffmpeg_video_scale !== undefined ? Number(ffmpeg_video_scale) : Number(campaign.ffmpeg_video_scale || 1.0),
      ffmpeg_sfx_volume !== undefined ? Number(ffmpeg_sfx_volume) : Number(campaign.ffmpeg_sfx_volume || 0.0),
      ffmpeg_bgm_volume !== undefined ? Number(ffmpeg_bgm_volume) : Number(campaign.ffmpeg_bgm_volume || 0.15),
      ffmpeg_sync_option || campaign.ffmpeg_sync_option || 'smart_sync',
      sync_mode || campaign.sync_mode || 'auto',
      campaign.id
    );

    // 3. Reset execution flags on item level and set workflow_status to 'production_processing'
    await updateReCampaignItem(itemId, {
      new_video_plan_json: JSON.stringify(new_video_plan),
      video_dna_json: JSON.stringify(video_dna),
      result_json: updatedResultJson,
      workflow_status: 'production_processing',
      tts_status: enable_tts ? 'pending' : 'skipped',
      visual_status: enable_glabs ? 'pending' : 'skipped',
      ffmpeg_status: enable_ffmpeg ? 'pending' : 'skipped',
      social_post_status: 'pending', // Reset for posting draft
      selected_vo_version: selected_vo_version || item.selected_vo_version || 'original'
    });

    return NextResponse.json({
      success: true,
      message: "Item campaign approved and queued for production."
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
