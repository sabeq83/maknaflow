import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getProductExtraction, getAllKnowledgeBasesWithContent, createPipelineAsset, updatePipelineAsset, getPipelineAsset } from '@/lib/db';
import { generateContentFlexible } from '@/lib/gemini';
import { buildIdeationAgentPrompt, buildNarrationAgentPrompt, buildVisualAgentPrompt, buildPromptAgentPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const body = await request.json();
    const { product_id, action, config = {} } = body;

    if (!product_id) {
      return NextResponse.json({ success: false, error: 'Product ID wajib diisi' }, { status: 400 });
    }

    const product = await getProductExtraction(product_id);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product tidak ditemukan' }, { status: 404 });
    }

    const kbs = await getAllKnowledgeBasesWithContent();
    if (kbs.length === 0) {
      return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base.' }, { status: 400 });
    }

    const kbMapped = kbs.map(kb => ({ name: kb.name, content: kb.content }));
    const productData = {
      product_name: product.product_name,
      product_description: product.product_description,
      unique_selling_point: product.unique_selling_point,
      target_audience: product.target_audience,
      pain_point_solved: product.pain_point_solved,
      key_visuals_extracted: (() => { try { return JSON.parse(product.key_visuals_extracted); } catch { return []; } })(),
    };

    // ========================================================
    // ACTION: ideation — Run Stage 2 only (Uses Google Search)
    // ========================================================
    if (action === 'ideation') {
      const ideationPrompt = buildIdeationAgentPrompt(kbMapped, productData, { jumlah_ide: config.jumlah_ide || 3 });
      
      // Use standard connection bypass via useSearch
      const ideationText = await generateContentFlexible({
        prompt: ideationPrompt,
        useSearch: true
      });
      const ideationParsed = parseGeminiJSON(ideationText);

      const assetId = uuidv4();
      await createPipelineAsset({
        id: assetId, product_id,
        selected_idea: null, all_ideas: JSON.stringify(ideationParsed.strategic_ideas || []),
        hot_trend_detected: ideationParsed.hot_trend_detected || '',
        audio_blueprint: null, visual_storyboard: null,
        t2i_prompts: null, i2v_prompts: null, t2v_prompts: null,
        tiktok_caption: null, ig_caption: null, yt_title: null, yt_desc: null,
        config: JSON.stringify(config),
        raw_responses: JSON.stringify({ stage2: ideationText }),
        current_stage: 'ideation', status: 'idea_ready',
      });

      return NextResponse.json({
        success: true,
        data: {
          id: assetId, product_name: product.product_name,
          hot_trend_detected: ideationParsed.hot_trend_detected || '',
          strategic_ideas: ideationParsed.strategic_ideas || [],
        },
      });
    }

    // ========================================================
    // ACTION: run_pipeline — Run Stage 3→5 sequentially
    // ========================================================
    if (action === 'run_pipeline') {
      const { pipeline_id, selected_idea } = body;
      if (!pipeline_id || !selected_idea) {
        return NextResponse.json({ success: false, error: 'pipeline_id dan selected_idea wajib diisi' }, { status: 400 });
      }

      const rawResponses = {};

      await updatePipelineAsset(pipeline_id, {
        selected_idea: JSON.stringify(selected_idea),
        current_stage: 'narration', status: 'in_progress',
      });

      // ---- STAGE 3: NARRATION ----
      let audioBlueprint;
      try {
        const narrationPrompt = buildNarrationAgentPrompt(kbMapped, selected_idea, {
          pacing_level: config.pacing_level || 'Level 2: Fast / Promo',
          jumlah_klip: config.jumlah_klip || 5,
        });
        const narrationText = await generateContentFlexible({ prompt: narrationPrompt });
        rawResponses.stage3 = narrationText;
        const narrationParsed = parseGeminiJSON(narrationText);
        audioBlueprint = narrationParsed.audio_blueprint || narrationParsed;
        await updatePipelineAsset(pipeline_id, {
          audio_blueprint: JSON.stringify(audioBlueprint),
          current_stage: 'visual', raw_responses: JSON.stringify(rawResponses),
        });
      } catch (e) {
        await updatePipelineAsset(pipeline_id, { status: 'error_stage3', raw_responses: JSON.stringify(rawResponses) });
        return NextResponse.json({ success: false, error: `Stage 3 (Narration) gagal: ${e.message}` }, { status: 500 });
      }

      // ---- STAGE 4: VISUAL ----
      let visualStoryboard;
      try {
        const visualPrompt = buildVisualAgentPrompt(kbMapped, audioBlueprint, productData, {
          auteur_style: config.auteur_style || 'Hyper-Realist UGC',
          face_visibility: config.face_visibility || 'Faceless',
        });
        const visualText = await generateContentFlexible({ prompt: visualPrompt });
        rawResponses.stage4 = visualText;
        const visualParsed = parseGeminiJSON(visualText);
        visualStoryboard = visualParsed.visual_storyboard || visualParsed;
        await updatePipelineAsset(pipeline_id, {
          visual_storyboard: JSON.stringify(visualStoryboard),
          current_stage: 'prompt_engineer', raw_responses: JSON.stringify(rawResponses),
        });
      } catch (e) {
        await updatePipelineAsset(pipeline_id, { status: 'error_stage4', raw_responses: JSON.stringify(rawResponses) });
        return NextResponse.json({ success: false, error: `Stage 4 (Visual) gagal: ${e.message}` }, { status: 500 });
      }

      // ---- STAGE 5: PROMPT ENGINEER + CAPTIONS ----
      let promptOutput;
      try {
        const promptEngPrompt = buildPromptAgentPrompt(kbMapped, visualStoryboard, audioBlueprint, {
          aspect_ratio: config.aspect_ratio || '(VERTICAL 9:16) --ar 9:16',
          target_ai: config.target_ai || 'Google Veo (8s)',
          voice_provider: config.voice_provider || 'gemini',
          voice_cast: config.voice_cast || config.voice_cast_json || null
        });
        const promptText = await generateContentFlexible({ prompt: promptEngPrompt });
        rawResponses.stage5 = promptText;
        promptOutput = parseGeminiJSON(promptText, config.voice_provider || 'gemini');
        await updatePipelineAsset(pipeline_id, {
          t2i_prompts: JSON.stringify(promptOutput.t2i_prompts || []),
          i2v_prompts: JSON.stringify(promptOutput.i2v_prompts || []),
          t2v_prompts: JSON.stringify(promptOutput.t2v_prompts || []),
          tiktok_caption: promptOutput.tiktok_caption || '',
          ig_caption: promptOutput.ig_caption || '',
          yt_title: promptOutput.yt_title || '',
          yt_desc: promptOutput.yt_desc || '',
          current_stage: 'completed', status: 'completed',
          raw_responses: JSON.stringify(rawResponses),
        });
      } catch (e) {
        await updatePipelineAsset(pipeline_id, { status: 'error_stage5', raw_responses: JSON.stringify(rawResponses) });
        return NextResponse.json({ success: false, error: `Stage 5 (Prompt Engineer) gagal: ${e.message}` }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: pipeline_id, audio_blueprint: audioBlueprint, visual_storyboard: visualStoryboard,
          t2i_prompts: promptOutput.t2i_prompts || [], i2v_prompts: promptOutput.i2v_prompts || [],
          t2v_prompts: promptOutput.t2v_prompts || [],
          tiktok_caption: promptOutput.tiktok_caption || '', ig_caption: promptOutput.ig_caption || '',
          yt_title: promptOutput.yt_title || '', yt_desc: promptOutput.yt_desc || '',
          status: 'completed',
        },
      });
    }

    // ========================================================
    // ACTION: regenerate — Regenerate specific stage
    // ========================================================
    if (action === 'regenerate') {
      const { pipeline_id, stage } = body;
      if (!pipeline_id || !stage) {
        return NextResponse.json({ success: false, error: 'pipeline_id dan stage wajib diisi' }, { status: 400 });
      }

      const existing = await getPipelineAsset(pipeline_id);
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Pipeline asset tidak ditemukan' }, { status: 404 });
      }

      const selectedIdea = (() => { try { return JSON.parse(existing.selected_idea); } catch { return {}; } })();
      const savedConfig = (() => { try { return JSON.parse(existing.config); } catch { return {}; } })();
      const mergedConfig = { ...savedConfig, ...config };

      // REGENERATE NARRATION (Stage 3)
      if (stage === 'narration') {
        const narrationPrompt = buildNarrationAgentPrompt(kbMapped, selectedIdea, {
          pacing_level: mergedConfig.pacing_level || 'Level 2: Fast / Promo',
          jumlah_klip: mergedConfig.jumlah_klip || 5,
        });
        const text = await generateContentFlexible({ prompt: narrationPrompt });
        const parsed = parseGeminiJSON(text);
        const audioBlueprint = parsed.audio_blueprint || parsed;
        await updatePipelineAsset(pipeline_id, { audio_blueprint: JSON.stringify(audioBlueprint) });
        return NextResponse.json({ success: true, data: { stage: 'narration', audio_blueprint: audioBlueprint } });
      }

      // REGENERATE PROMPTS (Stage 5 — t2i, i2v, t2v, captions)
      if (stage === 'prompts') {
        const audioBlueprint = (() => { try { return JSON.parse(existing.audio_blueprint); } catch { return {}; } })();
        const visualStoryboard = (() => { try { return JSON.parse(existing.visual_storyboard); } catch { return {}; } })();
        const promptEngPrompt = buildPromptAgentPrompt(kbMapped, visualStoryboard, audioBlueprint, {
          aspect_ratio: mergedConfig.aspect_ratio || '(VERTICAL 9:16) --ar 9:16',
          target_ai: mergedConfig.target_ai || 'Google Veo (8s)',
        });
        const text = await generateContentFlexible({ prompt: promptEngPrompt });
        const parsed = parseGeminiJSON(text);
        await updatePipelineAsset(pipeline_id, {
          t2i_prompts: JSON.stringify(parsed.t2i_prompts || []),
          i2v_prompts: JSON.stringify(parsed.i2v_prompts || []),
          t2v_prompts: JSON.stringify(parsed.t2v_prompts || []),
          tiktok_caption: parsed.tiktok_caption || '',
          ig_caption: parsed.ig_caption || '',
          yt_title: parsed.yt_title || '',
          yt_desc: parsed.yt_desc || '',
        });
        return NextResponse.json({
          success: true,
          data: {
            stage: 'prompts',
            t2i_prompts: parsed.t2i_prompts || [], i2v_prompts: parsed.i2v_prompts || [],
            t2v_prompts: parsed.t2v_prompts || [],
            tiktok_caption: parsed.tiktok_caption || '', ig_caption: parsed.ig_caption || '',
            yt_title: parsed.yt_title || '', yt_desc: parsed.yt_desc || '',
          },
        });
      }

      return NextResponse.json({ success: false, error: 'Stage tidak valid. Gunakan "narration" atau "prompts".' }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Action tidak valid.' }, { status: 400 });
  } catch (error) {
    console.error('Pipeline v54 error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
