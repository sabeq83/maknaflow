import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getAllKnowledgeBasesWithContent, createIdea } from '@/lib/db';
import { getGeminiModel, getGeminiModelWithSearch } from '@/lib/gemini';
import { buildIdeationAgentPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      product_name,
      product_description,
      target_audience,
      jumlah_ide,
      jumlah_klip,
      narrative_mode,
      visual_style,
      words_per_clip,
      target_ai,
      face_visibility,
      aspect_ratio,
      instruksi_tambahan,
      prompt_output_format,
    } = body;

    // Validate
    if (!product_name) {
      return NextResponse.json({ success: false, error: 'Nama Produk wajib diisi' }, { status: 400 });
    }

    // Auto-read ALL knowledge bases
    const kbs = await getAllKnowledgeBasesWithContent();
    if (kbs.length === 0) {
      return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base. Upload di Settings terlebih dahulu.' }, { status: 400 });
    }

    // Build prompt using v54.9 Ideation Agent
    const productData = {
      product_name,
      product_description: product_description || '',
      unique_selling_point: product_description || '',
      target_audience: target_audience || 'General public',
      pain_point_solved: '',
    };

    const prompt = buildIdeationAgentPrompt(
      kbs.map(kb => ({ name: kb.name, content: kb.content })),
      productData,
      { jumlah_ide: jumlah_ide || 3 }
    );

    // Call Gemini (try with search first for hot trend)
    let model;
    try {
      model = await getGeminiModelWithSearch();
    } catch {
      model = await getGeminiModel();
    }
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    let parsed;
    try {
      parsed = parseGeminiJSON(responseText);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'Gagal mem-parsing respons Gemini. Coba lagi.',
      }, { status: 500 });
    }

    // Map v54.9 output to legacy idea format for backward compatibility
    const ideas = parsed.strategic_ideas || parsed.ideas || [parsed];
    const savedIdeas = [];
    const kbNames = kbs.map(kb => kb.name).join(', ');

    for (const ideaData of ideas) {
      const idea = {
        id: uuidv4(),
        topik: ideaData.topik || ideaData.cep || '',
        konteks_cep: ideaData.cavac_angle || ideaData.konteks_cep || '',
        category_cep: ideaData.narrative_mode || ideaData.category_cep || '',
        cep: ideaData.core_conflict || ideaData.cep || '',
        sub_cep_matrix: ideaData.hook_strategy || ideaData.sub_cep_matrix || '',
        vfo: ideaData.cavac_angle || ideaData.vfo || '',
        key_messages: ideaData.hook_strategy || ideaData.key_message || ideaData.key_messages || '',
        kb_digunakan: kbNames,
        jumlah_klip: jumlah_klip || 5,
        narrative_mode: narrative_mode || '',
        visual_style: visual_style || '',
        words_per_clip: words_per_clip || '',
        target_ai: target_ai || '',
        face_visibility: face_visibility || '',
        aspect_ratio: aspect_ratio || '',
        instruksi_tambahan: instruksi_tambahan || '',
        product_name: product_name,
        product_description: product_description || '',
        target_audience: target_audience || '',
        jumlah_ide: jumlah_ide || 1,
        prompt_output_format: prompt_output_format || 'json',
        raw_response: responseText,
        status: 'Draft',
      };

      await createIdea(idea);
      savedIdeas.push(idea);
    }

    return NextResponse.json({
      success: true,
      data: savedIdeas,
      count: savedIdeas.length,
      hot_trend: parsed.hot_trend_detected || null,
    });
  } catch (error) {
    console.error('Ideation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
