import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getIdea, getAllKnowledgeBasesWithContent, createAsset, updateIdeaStatus, getAsset, updateAssetPrompts } from '@/lib/db';
import { getGeminiModel } from '@/lib/gemini';
import { buildNarrationAgentPrompt, buildVisualAgentPrompt, buildPromptAgentPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const { idea_id, action, asset_id } = await request.json();

    if (!idea_id) {
      return NextResponse.json({ success: false, error: 'Idea ID is required' }, { status: 400 });
    }

    const idea = await getIdea(idea_id);
    if (!idea) {
      return NextResponse.json({ success: false, error: 'Idea tidak ditemukan' }, { status: 404 });
    }

    const kbs = await getAllKnowledgeBasesWithContent();
    if (kbs.length === 0) {
      return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base.' }, { status: 400 });
    }

    const kbMapped = kbs.map(kb => ({ name: kb.name, content: kb.content }));
    const model = await getGeminiModel();

    // Prepare idea data for v54.9 prompts
    const selectedIdea = {
      topik: idea.topik || idea.cep || '',
      narrative_mode: idea.narrative_mode || 'Mode B (Realist-Viral)',
      core_conflict: idea.cep || idea.konteks_cep || '',
      hook_strategy: idea.key_messages || idea.sub_cep_matrix || '',
    };

    const productData = {
      product_name: idea.product_name || '',
      product_description: idea.product_description || '',
      unique_selling_point: idea.product_description || '',
      target_audience: idea.target_audience || '',
      pain_point_solved: '',
      key_visuals_extracted: [],
    };

    if (action === 'regenerate_prompts' && asset_id) {
      const asset = await getAsset(asset_id);
      if (!asset) return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });

      let audioBlueprint;
      try { audioBlueprint = JSON.parse(asset.storyboard); } catch { audioBlueprint = {}; }

      // Use Stage 5 (Prompt Agent) to regenerate
      const promptEngPrompt = buildPromptAgentPrompt(
        kbMapped,
        { clips: audioBlueprint },
        { script_clips: audioBlueprint },
        { aspect_ratio: idea.aspect_ratio || '(VERTICAL 9:16) --ar 9:16', target_ai: idea.target_ai || 'Google Veo (8s)' }
      );

      const promptEngResult = await model.generateContent(promptEngPrompt);
      const promptEngResponseText = promptEngResult.response.text();
      const promptEngParsed = parseGeminiJSON(promptEngResponseText);

      const t2i_prompts = JSON.stringify(promptEngParsed.t2i_prompts || []);
      const i2v_prompts = JSON.stringify(promptEngParsed.i2v_prompts || []);

      await updateAssetPrompts(asset_id, t2i_prompts, i2v_prompts, 'REGENERATE PROMPTS (v54.9):\n' + promptEngResponseText);

      return NextResponse.json({
        success: true,
        data: {
          ...asset,
          t2i_prompts: promptEngParsed.t2i_prompts || [],
          i2v_prompts: promptEngParsed.i2v_prompts || [],
        }
      });
    }

    // ========================================================================
    // STAGE 3: NARRATION (Audio Blueprint)
    // ========================================================================
    const narrationPrompt = buildNarrationAgentPrompt(kbMapped, selectedIdea, {
      pacing_level: 'Level 2: Fast / Promo',
      jumlah_klip: idea.jumlah_klip || 5,
    });

    const narrationResult = await model.generateContent(narrationPrompt);
    const narrationText = narrationResult.response.text();
    let narrationParsed;
    try {
      narrationParsed = parseGeminiJSON(narrationText);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'Gagal mem-parsing respons Gemini (Stage 3: Narration). Coba lagi.',
      }, { status: 500 });
    }

    const audioBlueprint = narrationParsed.audio_blueprint || narrationParsed;

    // ========================================================================
    // STAGE 4: VISUAL (Storyboard)
    // ========================================================================
    const visualPrompt = buildVisualAgentPrompt(kbMapped, audioBlueprint, productData, {
      auteur_style: idea.visual_style || 'Hyper-Realist UGC',
      face_visibility: idea.face_visibility || 'Faceless',
    });

    const visualResult = await model.generateContent(visualPrompt);
    const visualText = visualResult.response.text();
    let visualParsed;
    try {
      visualParsed = parseGeminiJSON(visualText);
    } catch {
      visualParsed = { visual_storyboard: { clips: [] } };
    }

    const visualStoryboard = visualParsed.visual_storyboard || visualParsed;

    // Build storyboard in legacy format (merge audio + visual)
    const clips = visualStoryboard.clips || [];
    const scriptClips = audioBlueprint.script_clips || [];
    const mergedStoryboard = clips.map((clip, i) => ({
      scene: clip.clip || i + 1,
      duration: scriptClips[i]?.time_segment || '8s',
      narration: scriptClips[i]?.dialogue_line || '',
      visual_description: clip.visual_action || clip.visual_description || '',
      camera_movement: clip.camera_movement || '',
      audio_mood: scriptClips[i]?.sfx_direction || '',
    }));

    // ========================================================================
    // STAGE 5: PROMPT ENGINEER (T2I + I2V)
    // ========================================================================
    let promptOutput = { t2i_prompts: [], i2v_prompts: [] };
    let promptSuccess = false;

    try {
      const promptEngPrompt = buildPromptAgentPrompt(kbMapped, visualStoryboard, audioBlueprint, {
        aspect_ratio: idea.aspect_ratio || '(VERTICAL 9:16) --ar 9:16',
        target_ai: idea.target_ai || 'Google Veo (8s)',
        voice_provider: idea.voice_provider || 'gemini',
        voice_cast: idea.voice_cast_json || null
      });

      const promptResult = await model.generateContent(promptEngPrompt);
      const promptText = promptResult.response.text();
      promptOutput = parseGeminiJSON(promptText, idea.voice_provider || 'gemini');
      promptSuccess = true;
    } catch (e) {
      console.warn('Prompt Engineer stage failed, saving storyboard anyway.', e);
    }

    // Save asset to DB
    const assetId = uuidv4();
    const asset = {
      asset_id: assetId,
      idea_id: idea_id,
      storyboard: JSON.stringify(mergedStoryboard),
      t2i_prompts: JSON.stringify(promptOutput.t2i_prompts || []),
      i2v_prompts: JSON.stringify(promptOutput.i2v_prompts || []),
      t2v_prompts: JSON.stringify(promptOutput.t2v_prompts || []),
      tiktok_caption: promptOutput.tiktok_caption || '',
      ig_caption: promptOutput.ig_caption || '',
      yt_title: promptOutput.yt_title || '',
      yt_desc: promptOutput.yt_desc || '',
      raw_response: `NARRATION (v54.9):\n${narrationText}\n\nVISUAL (v54.9):\n${visualText}`,
    };

    await createAsset(asset);
    await updateIdeaStatus(idea_id, 'Generated');

    return NextResponse.json({
      success: true,
      data: {
        ...asset,
        storyboard: mergedStoryboard,
        t2i_prompts: promptOutput.t2i_prompts || [],
        i2v_prompts: promptOutput.i2v_prompts || [],
        partial_success: !promptSuccess,
      },
    });
  } catch (error) {
    console.error('Production error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
