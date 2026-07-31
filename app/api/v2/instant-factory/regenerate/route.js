import { NextResponse } from 'next/server';
import { getInstantCampaign, saveInstantCampaignOutput, getAllKnowledgeBasesWithContent } from '@/lib/db';
import { executeWithKeyPool } from '@/lib/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req) {
  try {
    const { campaignId, targetTab } = await req.json();
    const campaign = await getInstantCampaign(campaignId);
    
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }
    
    const config = campaign.config || {};
    const existingOutput = campaign.output && campaign.output.unified_production_json ? JSON.parse(campaign.output.unified_production_json) : null;
    
    if (!existingOutput) {
      return NextResponse.json({ success: false, error: 'Output not found to regenerate' }, { status: 400 });
    }

    const kbs = await getAllKnowledgeBasesWithContent();
    const allowedKBs = ['PROMPT_SYSTEM', 'REALIST_VIRAL_NARRATIVE', 'STRATEGIC_FRAMEWORKS', 'NARRATIVE_STRUCTURE'];
    const kbCombined = kbs.filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
      .map((kb, i) => `=== KNOWLEDGE BASE ${i + 1}: ${kb.name} ===\n${kb.content}\n`).join('\n');

    let specificInstruction = '';
    let jsonFormat = '';

    if (targetTab === 'voiceover') {
      specificInstruction = `Tulis ulang naskah Voiceover bahasa Indonesia untuk seluruh klip. Buat lebih natural, menarik, dan sesuai dengan Voice Persona (${config.voice_persona}). Pastikan jumlah kata sesuai kecepatan ${config.speed_control || 2.5} kata/detik. JANGAN ubah visual action atau prompt, HANYA audio_segment.`;
      jsonFormat = `[
  {
    "scene_number": 1,
    "audio_segment": {
      "voiceover_text": "...",
      "word_count": 10,
      "audio_mood": "..."
    }
  }
]`;
    } else if (targetTab === 't2i_prompts') {
      specificInstruction = `Tulis ulang HANYA T2I Prompt (Text-to-Image) dalam bahasa Inggris Murni untuk seluruh klip berdasarkan visual action dan voiceover yang ada. Gunakan gaya 5-Layer Optical Stack. Sesuaikan dengan Aspect Ratio ${config.aspect_ratio} dan karakteristik AI Engine ${config.target_ai_engine}.`;
      jsonFormat = `[
  {
    "scene_number": 1,
    "t2i_prompt_plaintext": "ENGLISH PLAINTEXT MUST IN ONE LINE. --ar ${config.aspect_ratio || '9:16'}"
  }
]`;
    } else if (targetTab === 'i2v_prompts') {
      specificInstruction = `Tulis ulang HANYA I2V Prompt (Image-to-Video / Motion) dalam bahasa Inggris Murni untuk seluruh klip berdasarkan visual action. Gunakan instruksi pergerakan kamera dinamis yang sesuai limitasi AI Engine ${config.target_ai_engine}.`;
      jsonFormat = `[
  {
    "scene_number": 1,
    "i2v_prompt_plaintext": "ENGLISH PLAINTEXT MUST IN ONE LINE. --ar ${config.aspect_ratio || '9:16'}"
  }
]`;
    } else if (targetTab === 'social_copy') {
      specificInstruction = `Tulis ulang teks Social Media Copy (Caption Instagram, TikTok, dan YouTube Shorts). Buat lebih SEO-friendly, menarik, dan menggunakan hook yang kuat sesuai target audiens.`;
      jsonFormat = `{
  "tiktok_caption": "...",
  "instagram_caption": "...",
  "youtube_shorts_title": "...",
  "youtube_shorts_desc": "..."
}`;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid targetTab' }, { status: 400 });
    }

    const masterPrompt = `Kamu adalah "MAKNA v54.9 INFINITE INDUSTRIAL ENGINE" - INSTANT CONTENT FACTORY REGENERATOR.
Tugasmu adalah memperbaiki dan MENULIS ULANG hanya sebagian elemen spesifik dari kampanye produksi konten.

[KNOWLEDGE BASE INJECTION]
${kbCombined}

[DATA PRODUK]
- Nama: ${campaign.product_name}
- Deskripsi: ${campaign.product_description}

[KONFIGURASI KREATIF]
- Target AI Engine: ${config.target_ai_engine}
- Narrative Mode: ${config.narrative_mode}
- Visual Style: ${config.visual_style}
- Face Visibility: ${config.face_visibility}
- Aspect Ratio Target: ${config.aspect_ratio}
- Voice Persona Target: ${config.voice_persona}
- Target Kecepatan Bicara: ${config.speed_control || 2.5} kata/detik

[CURRENT CAMPAIGN CONTEXT (JANGAN DIUBAH, HANYA SEBAGAI REFERENSI)]
${JSON.stringify({
  strategy: existingOutput.campaign_strategy,
  storyboard: existingOutput.production_storyboard
}, null, 2)}

[TUGAS SPESIFIK REGENERATE]
${specificInstruction}

[ATURAN JSON STRICT FORMATTING]
1. OUTPUT WAJIB BERUPA JSON LENGKAP tanpa karakter backtick (\`\`\`) di awal atau akhir (murni text JSON).
2. Format array/object harus persis sesuai dengan template di bawah ini.

FORMAT YANG DIHARAPKAN:
${jsonFormat}`;

    const rawResponse = await executeWithKeyPool(1, async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 65535,
          responseMimeType: 'application/json',
        }
      });
      const result = await model.generateContent(masterPrompt);
      return result.response.text();
    });

    let parsedJson = null;
    try {
      const cleanJsonStr = rawResponse.replace(/^\s*```(json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsedJson = JSON.parse(cleanJsonStr);
    } catch (e) {
      return NextResponse.json({ success: false, error: 'AI mengembalikan format JSON yang tidak valid: ' + e.message }, { status: 500 });
    }

    // Merge into existing
    if (targetTab === 'voiceover') {
      parsedJson.forEach(newClip => {
        const scene = existingOutput.production_storyboard.find(s => s.scene_number === newClip.scene_number);
        if (scene) scene.audio_segment = newClip.audio_segment;
      });
    } else if (targetTab === 't2i_prompts') {
      parsedJson.forEach(newClip => {
        const scene = existingOutput.production_storyboard.find(s => s.scene_number === newClip.scene_number);
        if (scene) {
          if (!scene.ai_generation_prompts) scene.ai_generation_prompts = {};
          scene.ai_generation_prompts.t2i_prompt_plaintext = newClip.t2i_prompt_plaintext;
        }
      });
    } else if (targetTab === 'i2v_prompts') {
      parsedJson.forEach(newClip => {
        const scene = existingOutput.production_storyboard.find(s => s.scene_number === newClip.scene_number);
        if (scene) {
          if (!scene.ai_generation_prompts) scene.ai_generation_prompts = {};
          scene.ai_generation_prompts.i2v_prompt_plaintext = newClip.i2v_prompt_plaintext;
        }
      });
    } else if (targetTab === 'social_copy') {
      existingOutput.distribution_assets = parsedJson;
    }

    await saveInstantCampaignOutput(campaign.output.id, campaignId, JSON.stringify(existingOutput));

    return NextResponse.json({ success: true, data: existingOutput });
  } catch (error) {
    console.error('Regenerate Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
