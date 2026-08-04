import { NextResponse } from 'next/server';
import {
  createInstantCampaign,
  updateInstantCampaignStatus,
  saveInstantCampaignOutput,
  getAllKnowledgeBasesWithContent,
  getBrandProfile,
  getDb
} from '@/lib/db';
import { executeWithKeyPool, getGeminiModel, getGeminiModelWithSearch } from '@/lib/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { scrapeUrl } from '@/lib/url-scraper';
import { buildProductAgentPrompt } from '@/lib/prompts';
import { parseGeminiJSON } from '@/lib/json-parser';
import { withTenantContext } from '@/lib/auth';

export const maxDuration = 300; // Allow 5 minutes maximum for Vercel/Next.js Route if deployed
export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, user) => {
  try {
    const formData = await req.formData();
    const id = uuidv4();

    const productName = formData.get('product_name') || 'Minta AI untuk membaca dari URL di bawah';
    const productDescription = formData.get('product_description') || 'Minta AI untuk mengekstrak deskripsi dan USP dari URL di bawah';
    const productUrl = formData.get('product_url') || '';
    const productMedia = formData.get('product_media'); // File object
    
    // Configs
    const narrativeMode = formData.get('narrative_mode') || 'Storytelling';
    const visualStyle = formData.get('visual_style') || 'UGC';
    const totalClips = parseInt(formData.get('total_clips') || '4', 10);
    const wordsPerClip = parseInt(formData.get('words_per_clip') || '12', 10);
    const targetAiEngine = formData.get('target_ai_engine') || 'Google Veo (8s)';
    const faceVisibility = formData.get('face_visibility') || 'Faceless';
    const aspectRatio = formData.get('aspect_ratio') || '9:16';
    const voicePersona = formData.get('voice_persona') || 'Aoede';
    const speedControl = parseFloat(formData.get('speed_control') || '2.5');
    const customInstruction = formData.get('custom_instruction') || '';
    const brandProfileId = formData.get('brand_profile_id') || null;
    const targetLanguage = formData.get('target_language') || 'id-ID';
    const status = formData.get('status') || 'pending';
    const enableGlabs = formData.get('enable_glabs') === '1' ? 1 : 0;
    const enableTts = formData.get('enable_tts') === '0' ? 0 : 1;
    const enableFfmpeg = formData.get('enable_ffmpeg') === '0' ? 0 : 1;
    const enableSocialPost = formData.get('enable_social_post') === '1' ? 1 : 0;
    const postYoutube = formData.get('post_youtube_draft') === '1' ? 1 : 0;
    const postTiktok = formData.get('post_tiktok_draft') === '1' ? 1 : 0;
    const postFacebook = formData.get('post_facebook_draft') === '1' ? 1 : 0;
    const isBridgingActive = formData.get('is_bridging_active') === '1' ? 1 : 0;
    const bridgeAtClip = parseInt(formData.get('bridge_at_clip') || '2', 10);
    const visualMode = formData.get('visual_mode') || 'hybrid_lock';

    let productSourceType = 'text_only';
    let productMediaPath = null;

    // Handle File Upload
    if (productMedia && productMedia.size > 0) {
      productSourceType = 'image';
      const ext = path.extname(productMedia.name) || '.jpg';
      const filename = `product_${id}${ext}`;
      const uploadDir = path.join(process.cwd(), 'data', 'products');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      productMediaPath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await productMedia.arrayBuffer());
      fs.writeFileSync(productMediaPath, buffer);
    } else if (productUrl) {
      productSourceType = 'url';
    }

    let finalProductName = productName;
    let finalProductDescription = productDescription;
    let finalProductUsp = '';

    // If URL is provided, scrape and extract product data synchronously
    if (productUrl) {
      try {
        console.log(`[Instant Factory] Scraping product URL: ${productUrl}`);
        const scraped = await scrapeUrl(productUrl);
        const sourceContent = scraped.fullText;

        const extractionPrompt = buildProductAgentPrompt(sourceContent, true);
        const extractedText = await executeWithKeyPool(1, async (apiKey) => {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          });
          const result = await model.generateContent(extractionPrompt);
          return result.response.text();
        });

        const extractedJson = parseGeminiJSON(extractedText);
        const productData = extractedJson.product_data || extractedJson;

        if (productData.product_name) {
          finalProductName = productData.product_name;
        }
        if (productData.product_description) {
          finalProductDescription = productData.product_description;
        }
        if (productData.unique_selling_point) {
          finalProductUsp = typeof productData.unique_selling_point === 'string'
            ? productData.unique_selling_point
            : JSON.stringify(productData.unique_selling_point);
        }

        // Save to database
        const newProductId = `pe_${Date.now()}`;
        const db = getDb();
        await db.prepare(`
          INSERT INTO product_extractions (id, input_source, is_url, product_name, product_description, unique_selling_point, raw_response)
          VALUES (?, ?, 1, ?, ?, ?, ?)
        `).run(
          newProductId,
          productUrl,
          finalProductName,
          finalProductDescription,
          finalProductUsp,
          extractedText
        );
        console.log(`[Instant Factory] Extracted and saved product ID: ${newProductId}`);
      } catch (err) {
        console.error('[Instant Factory] Failed scraping/extracting product URL:', err);
      }
    }

    const campaignData = {
      id,
      product_name: finalProductName,
      product_description: finalProductDescription,
      product_source_type: productSourceType,
      product_media_path: productMediaPath,
      product_url: productUrl,
      status,
      brand_profile_id: brandProfileId,
      enable_glabs: enableGlabs,
      enable_tts: enableTts,
      enable_ffmpeg: enableFfmpeg,
      enable_social_post: enableSocialPost,
      post_youtube_draft: postYoutube,
      post_tiktok_draft: postTiktok,
      post_facebook_draft: postFacebook,
      is_bridging_active: isBridgingActive,
      bridge_at_clip: bridgeAtClip,
      visual_mode: visualMode
    };

    const configData = {
      narrative_mode: narrativeMode,
      visual_style: visualStyle,
      words_per_clip: wordsPerClip,
      target_ai_engine: targetAiEngine,
      face_visibility: faceVisibility,
      aspect_ratio: aspectRatio,
      total_clips: totalClips,
      voice_persona: voicePersona,
      speed_control: speedControl,
      custom_instruction: customInstruction,
      target_language: targetLanguage
    };

    // 1. Simpan ke database (Pending)
    await createInstantCampaign(campaignData, configData);

    if (status === 'draft') {
      return NextResponse.json({ success: true, campaignId: id, status: 'draft' }, { status: 201 });
    }

    await updateInstantCampaignStatus(id, 'processing');

    // 2. Persiapkan Master Prompt
    const kbs = await getAllKnowledgeBasesWithContent();
    const allowedKBs = ['PROMPT_SYSTEM', 'REALIST_VIRAL_NARRATIVE', 'STRATEGIC_FRAMEWORKS', 'NARRATIVE_STRUCTURE'];
    const kbCombined = kbs
      .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
      .map((kb, i) => `=== KNOWLEDGE BASE ${i + 1}: ${kb.name} ===\n${kb.content}\n`)
      .join('\n');

    // Brand DNA Injection
    let brandMandate = '';
    if (brandProfileId) {
      const brandConfig = await getBrandProfile(brandProfileId);
      if (brandConfig) {
        brandMandate = `\n========================================================================
🚨 BRAND IDENTITY TRANSFORMATION MANDATE (CRITICAL)
========================================================================
Semua output wajib diselaraskan dengan identitas Brand berikut:
- Nama Brand: ${brandConfig.brand_name}
- Tone of Voice (Gaya Bicara Naskah): ${brandConfig.tone_of_voice}
- Gaya Estetika Visual: ${brandConfig.visual_signature}
- Palet Warna Kamera: ${brandConfig.color_palette}
- ELEMEN TERLARANG (Jangan Dimunculkan di Visual/Prompt): ${brandConfig.forbidden_elements}
- Slogan Kampanye/CTA Penutup: ${brandConfig.brand_slogan_or_cta}

${brandConfig.raw_guideline_text ? `[FULL BRAND GUIDELINE CONTEXT]\n${brandConfig.raw_guideline_text.substring(0, 8000)}` : ''}

ATURAN ADAPTASI:
1. JANGAN kloning naskah mentah. Gaya bahasa naskah WAJIB bertipe "${brandConfig.tone_of_voice}".
2. visual_description dan T2I/I2V prompts wajib menggunakan panduan visual: "${brandConfig.visual_signature}" dan warna "${brandConfig.color_palette}".
3. Pastikan TIDAK ADA satupun elemen dari daftar "${brandConfig.forbidden_elements}" yang masuk ke visual_description atau prompts.
4. Akhiri scene terakhir dengan menyertakan Slogan Brand: "${brandConfig.brand_slogan_or_cta}".
========================================================================\n`;
      }
    }

    const languageName = targetLanguage === 'en-US' ? 'ENGLISH (US)' : 'INDONESIAN';

    const masterPrompt = `Kamu adalah "MAKNA v54.9 INFINITE INDUSTRIAL ENGINE" - INSTANT CONTENT FACTORY.
Tugasmu adalah menganalisis produk dan merancang SATU JSON payload padat yang berisi Strategi, Storyboard, Naskah (Voiceover), dan Prompts AI Visual, semua sekaligus!

[KNOWLEDGE BASE INJECTION]
${kbCombined}

[DATA PRODUK]
- Nama: ${finalProductName}
- Deskripsi: ${finalProductDescription}
${finalProductUsp ? `- USP: ${finalProductUsp}` : ''}
- URL Referensi: ${productUrl}

[KONFIGURASI KREATIF]
- Target AI Engine: ${targetAiEngine} (Penting untuk menyesuaikan panjang durasi prompt dan instruksi visual khusus)
- Narrative Mode: ${narrativeMode}
- Visual Style: ${visualStyle}
- Face Visibility: ${faceVisibility}
- Aspect Ratio Target: ${aspectRatio}
- Jumlah Klip/Scene: EXACTLY ${totalClips} klip.
- Voice Persona Target: ${voicePersona} (Sesuaikan gaya bahasa naskah dengan persona suara ini)
- Target Kecepatan Bicara: ${speedControl} kata/detik
- Batas Kata per Klip: Maksimal ${wordsPerClip} kata.
- Custom Instructions: ${customInstruction || 'Tidak ada instruksi khusus.'}
- Target Language: ${languageName}
- LANGUAGE MANDATE (SANGAT KETAT):
  * Jika target bahasa adalah ENGLISH (US): Naskah voiceover ("voiceover_text") dan caption sosial media ("tiktok_caption", "instagram_caption", "youtube_shorts_title", "youtube_shorts_desc") wajib ditulis sepenuhnya dalam Bahasa Inggris yang natural (slang US seperti "POV", "hooked" jika cocok).
  * Jika target bahasa adalah INDONESIAN: Naskah voiceover ("voiceover_text") dan caption sosial media wajib ditulis sepenuhnya dalam Bahasa Indonesia.
  * PERINGATAN: Prompt visual ("t2i_prompt_plaintext" dan "i2v_prompt_plaintext") wajib TETAP selalu ditulis dalam Bahasa Inggris.

${brandMandate}
[TUGAS AGENTIC CHAIN-OF-THOUGHT]
Kamu WAJIB berpikir secara berurutan saat menyusun JSON:
1. Pikirkan SWOT & USP (Strategic Analysis).
2. Tentukan Profil Audiens & Konsep Inti (CEP, VFO, Hook).
3. Untuk setiap adegan (wajib buat tepat ${totalClips} klip/adegan), tulis naskah Voiceover dalam bahasa ${languageName} yang sangat natural, tidak kaku, sesuai dengan mode narasi dan *Voice Persona*. Pastikan jumlah kata sesuai dengan durasi klip (Durasi = Jumlah kata / ${speedControl}).
4. Terjemahkan aksi visual berdasarkan naskah menjadi Prompt T2I dan I2V dalam Bahasa Inggris Murni tanpa enter/newline, pastikan memakai gaya "5-Layer Optical Stack", disesuaikan dengan limitasi/karakteristik *Target AI Engine* (${targetAiEngine}).
5. Buat caption sosial media yang SEO-friendly dalam bahasa ${languageName}.

[ATURAN JSON STRICT FORMATTING]
1. OUTPUT WAJIB BERUPA JSON LENGKAP tanpa karakter backtick (\`\`\`) di awal atau akhir (murni text JSON).
2. DILARANG menggunakan baris baru (\n) di dalam string "t2i_prompt_plaintext" dan "i2v_prompt_plaintext".
3. Escape double quotes dengan benar.

{
  "campaign_strategy": {
    "swot_analysis": {
      "strengths": ["...", "..."],
      "weaknesses": ["...", "..."],
      "opportunities": ["...", "..."],
      "threats": ["...", "..."]
    },
    "unique_selling_point": "Kalimat deklarasi USP produk yang tajam",
    "target_audience_profile": "Demografis dan psikografis audiens ideal",
    "core_campaign_concept": {
      "cep_type": "Tipe CEP pilihan dari kerangka kerja",
      "situation_context": "Konteks situasi relevan yang membungkus iklan",
      "vfo_matrix": "Penyelarasan Value, Feature, dan Outcome",
      "hook_strategy": "Metode hook 3 detik pertama"
    }
  },
  "production_storyboard": [
    {
      "scene_number": 1,
      "duration": "8s",
      "audio_segment": {
        "voiceover_text": "Teks Voiceover alami Indonesia...",
        "word_count": 12,
        "audio_mood": "Instruksi intonasi"
      },
      "visual_segment": {
        "visual_action": "Deskripsi visual sinkron",
        "camera_movement": "Instruksi kamera sinematik"
      },
      "ai_generation_prompts": {
        "t2i_prompt_plaintext": "ENGLISH PLAINTEXT 5-Layer Optical Stack prompt siap copy-paste. MUST IN ONE LINE. --ar ${aspectRatio}",
        "i2v_prompt_plaintext": "ENGLISH PLAINTEXT motion prompt siap copy-paste. MUST IN ONE LINE. --ar ${aspectRatio}"
      }
    }
  ],
  "distribution_assets": {
    "tiktok_caption": "Caption TikTok",
    "instagram_caption": "Caption IG",
    "youtube_shorts_title": "Judul YouTube Shorts",
    "youtube_shorts_desc": "Deskripsi Shorts"
  }
}`;

    // 3. Panggil Gemini via Key Pool (Konsumsi 1 Token/Cost)
    let rawResponse = '';
    
    // Check if we need image capabilities (multimodal)
    const geminiPayload = [];
    if (productMediaPath && fs.existsSync(productMediaPath)) {
      const mimeType = 'image/jpeg'; // Fallback
      // You can upload to Gemini first if it's large, or just pass as inlineData.
      // We will pass as inlineData for simplicity since images are usually small.
      const imageBuffer = fs.readFileSync(productMediaPath);
      geminiPayload.push({
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: extToMime(path.extname(productMediaPath))
        }
      });
    }
    
    geminiPayload.push({ text: masterPrompt });

    rawResponse = await executeWithKeyPool(1, async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelParams = {
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 65535,
        }
      };

      modelParams.generationConfig.responseMimeType = 'application/json';

      const model = genAI.getGenerativeModel(modelParams);
      const result = await model.generateContent(geminiPayload);
      return result.response.text();
    });

    // Validasi JSON (Mengakomodasi kembalian markdown JSON jika responseMimeType mati)
    let parsedJson = null;
    try {
      const cleanJsonStr = rawResponse.replace(/^\s*```(json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsedJson = JSON.parse(cleanJsonStr);
    } catch (e) {
      // JSON Parse error, let's try to save raw to errorLog
      await updateInstantCampaignStatus(id, 'failed');
      await saveInstantCampaignOutput(uuidv4(), id, null, `JSON Parse Error: ${e.message}\nRaw Output: ${rawResponse}`);
      return NextResponse.json({ success: false, error: 'AI mengembalikan format JSON yang tidak valid.' }, { status: 500 });
    }

    // 4. Sukses, simpan hasil.
    await updateInstantCampaignStatus(id, 'completed');
    await saveInstantCampaignOutput(uuidv4(), id, JSON.stringify(parsedJson));

    return NextResponse.json({
      success: true,
      campaignId: id,
      data: parsedJson
    });

  } catch (error) {
    console.error('Instant Factory Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

function extToMime(ext) {
  ext = ext.toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}
