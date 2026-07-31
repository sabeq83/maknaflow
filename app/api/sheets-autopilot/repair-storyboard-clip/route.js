import { NextResponse } from 'next/server';
import { getDb, getSheetsCampaign, getSetting } from '@/lib/db';
import { getAuthorizedClient } from '@/lib/google-auth';
import { google } from 'googleapis';
import { scrapeUrl, downloadECommerceImage } from '@/lib/url-scraper';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseGeminiJSON } from '@/lib/json-parser';
import { executeWithKeyPool } from '@/lib/gemini';
import { generateMinimaxVO } from '@/lib/minimax-tts';
import fs from 'fs';
import path from 'path';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('id-ID', { hour12: false });
  const line = `[${ts}] [repair-storyboard-clip] ${msg}`;
  console.log(line);
  return line;
}

export async function POST(request) {
  const logs = [];
  const addLog = (msg) => { logs.push(log(msg)); };

  try {
    const body = await request.json();
    const { jobId, clipIndex } = body;

    if (!jobId || !clipIndex) {
      return NextResponse.json({ error: 'jobId dan clipIndex diperlukan' }, { status: 400 });
    }

    addLog(`Memulai re-alignment storyboard untuk Klip ${clipIndex} pada job ${jobId}...`);

    const db = getDb();
    const job = await db.prepare('SELECT * FROM sheets_jobs WHERE id = ?').get(jobId);
    if (!job) return NextResponse.json({ error: `Job ${jobId} tidak ditemukan` }, { status: 404 });

    const campaign = await getSheetsCampaign(job.campaign_id);
    if (!campaign) return NextResponse.json({ error: `Campaign tidak ditemukan` }, { status: 404 });

    const batchId = job.batch_id;
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // ─── STEP 1: Product Sourcing & Scrape Check ─────────────────────────────
    addLog('Mencari URL produk dari Google Sheets...');
    const auth = getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetName = campaign.campaign_type === 'OPC' ? 'CAMPAIGN_OPC'
      : campaign.campaign_type === 'RE' ? 'CAMPAIGN_RE'
      : campaign.campaign_type === 'IFC' ? 'CAMPAIGN_IFC'
      : 'CAMPAIGN';

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: campaign.spreadsheet_id,
      range: `'${sheetName}'!A1:Z1`
    });
    const headers = (headerRes.data.values?.[0] || []).map(h => h.trim().toLowerCase());
    const linkProductIdx = headers.findIndex(h =>
      ['link product', 'link_product', 'link produk', 'url produk', 'url product', 'url_product'].includes(h)
    );

    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId: campaign.spreadsheet_id,
      range: `'${sheetName}'!A${job.row_index}:Z${job.row_index}`
    });
    const row = rowRes.data.values?.[0] || [];
    const productUrl = linkProductIdx !== -1 ? row[linkProductIdx]?.trim() : '';

    if (!productUrl || !productUrl.startsWith('http')) {
      return NextResponse.json({ error: `URL produk tidak valid atau kosong pada baris ${job.row_index}` }, { status: 400 });
    }

    addLog(`URL Produk ditemukan: ${productUrl}`);

    // Cek di DB apakah sudah pernah sukses scrape
    let product = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(productUrl, productUrl);
    
    if (product && product.product_name) {
      addLog(`Aset produk ditemukan di database: "${product.product_name}". Melewati scraping.`);
    } else {
      addLog(`Memulai Playwright scraping JIT untuk URL: ${productUrl}`);
      const scrapeResult = await scrapeUrl(productUrl);
      addLog('Scraping HTML berhasil. Mengekstrak metadata menggunakan Gemini...');

      const extractedData = await executeWithKeyPool(1, async (apiKey) => {
        const extractPrompt = `Lakukan ekstraksi terstruktur detail produk dari konten halaman toko berikut ke dalam JSON.
Halaman Konten:
${scrapeResult.fullText}

Hasilkan JSON dengan struktur:
{
  "product_name": "Nama Produk komersial lengkap beserta brand",
  "product_description": "Deskripsi singkat fungsi dan kegunaan produk",
  "unique_selling_point": "USP utama atau kelebihan produk",
  "scraped_image_url": "URL gambar produk asli dari CDN yang bersih",
  "target_audience": "Target pasar ideal",
  "pain_point_solved": "Masalah utama yang diselesaikan produk"
}`;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        });
        const result = await model.generateContent(extractPrompt);
        return parseGeminiJSON(result.response.text());
      });

      if (!extractedData.product_name) {
        throw new Error('Gemini gagal mengekstrak nama produk.');
      }

      addLog(`Metadata produk berhasil diekstrak: "${extractedData.product_name}"`);

      let localImagePath = null;
      if (extractedData.scraped_image_url && extractedData.scraped_image_url.startsWith('http')) {
        const safeFilename = `autopilot_jit_${Date.now()}.png`;
        localImagePath = `/uploads/products/${safeFilename}`;
        const absoluteLocalPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);
        
        const uploadsDir = path.dirname(absoluteLocalPath);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        addLog(`Mengunduh gambar produk dari ${extractedData.scraped_image_url}...`);
        await downloadECommerceImage(extractedData.scraped_image_url, absoluteLocalPath);
        addLog(`Gambar berhasil disimpan secara fisik ke ${localImagePath}`);
      }

      const dbProductData = {
        id: `pe_jit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        input_source: productUrl,
        is_url: 1,
        product_name: extractedData.product_name,
        product_description: extractedData.product_description || '',
        unique_selling_point: extractedData.unique_selling_point || '',
        target_audience: extractedData.target_audience || '',
        pain_point_solved: extractedData.pain_point_solved || '',
        key_visuals_extracted: JSON.stringify(extractedData.key_visuals_extracted || []),
        raw_response: JSON.stringify(extractedData),
        category: 'Autopilot JIT Sourcing',
        tags: 'autopilot, JIT',
        photo_url: localImagePath,
        source_url: productUrl,
        scraped_image_url: extractedData.scraped_image_url || null,
        affiliate_link: '',
        raw_description: extractedData.product_description || ''
      };

      await db.prepare(`
        INSERT INTO product_extractions (
          id, input_source, is_url, product_name, product_description, unique_selling_point,
          target_audience, pain_point_solved, key_visuals_extracted, raw_response, category,
          tags, photo_url, source_url, scraped_image_url, affiliate_link, raw_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dbProductData.id, dbProductData.input_source, dbProductData.is_url, dbProductData.product_name,
        dbProductData.product_description, dbProductData.unique_selling_point, dbProductData.target_audience,
        dbProductData.pain_point_solved, dbProductData.key_visuals_extracted, dbProductData.raw_response,
        dbProductData.category, dbProductData.tags, dbProductData.photo_url, dbProductData.source_url,
        dbProductData.scraped_image_url, dbProductData.affiliate_link, dbProductData.raw_description
      );
      product = dbProductData;
      addLog('Aset produk baru disimpan ke database SQLite.');
    }

    // ─── STEP 2: Script Re-alignment (Gemini) ────────────────────────────────
    addLog('Membaca naskah/storyboard dari database...');
    const storyboard = JSON.parse(job.storyboard || '[]');
    const voiceover = JSON.parse(job.voiceover || '[]');
    const prompts_json = JSON.parse(job.prompts_json || '{}');

    const cIndex = Number(clipIndex) - 1;
    if (cIndex < 0 || cIndex >= storyboard.length) {
      return NextResponse.json({ error: `Klip ${clipIndex} di luar batas total klip (${storyboard.length})` }, { status: 400 });
    }

    addLog(`Menyiapkan prompt Gemini untuk menyelaraskan Klip ${clipIndex}...`);
    const prevClip = storyboard[cIndex - 1] || {};
    const prevVo = voiceover.find(v => Number(v.scene || v.clip) === clipIndex - 1) || {};
    const nextClip = storyboard[cIndex + 1] || {};
    const nextVo = voiceover.find(v => Number(v.scene || v.clip) === clipIndex + 1) || {};

    const aspectRatio = campaign.aspect_ratio || '9:16';
    const geminiPrompt = `Anda adalah AI video producer ahli. Tugas Anda adalah MEMPERBAIKI naskah & prompt visual untuk Klip ${clipIndex} (jembatan produk) agar kohesif antara Klip ${clipIndex - 1} dan Klip ${clipIndex + 1}.

DATA PRODUK:
- Nama: ${product.product_name}
- Deskripsi: ${product.product_description}
- USP: ${product.unique_selling_point}
- Target Audience: ${product.target_audience}
- Pain Point: ${product.pain_point_solved}

KONTEKS KLIP:
- Klip ${clipIndex - 1}: Visual="${prevClip.visual_description || ''}", Narasi="${prevVo.narration || prevVo.voiceover_text || ''}"
- Klip ${clipIndex + 1}: Visual="${nextClip.visual_description || ''}", Narasi="${nextVo.narration || nextVo.voiceover_text || ''}"
- Klip ${clipIndex} lama: Visual="${storyboard[cIndex]?.visual_description || ''}", Narasi="${voiceover.find(v => Number(v.scene || v.clip) === clipIndex)?.narration || ''}"

PERSYARATAN:
1. Narasi 17-19 kata, menghubungkan Klip ${clipIndex - 1} ke Klip ${clipIndex + 1} secara logis.
2. T2I prompt: single line, wajib format LAYER baku berikut:
   (VERTICAL 9:16) --ar ${aspectRatio} --no landscape [LAYER 1: OPTICS] (Shot on [Camera], [Lens]). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: [shoulder-to-wrist framing, faceless], Product Lock: [nama produk, geometri, material]). [LAYER 3: SCENE & LIGHT] (Environment: [lokasi], Lighting: [pencahayaan]). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: [aksi tersirat]).
3. I2V prompt: single line, HANYA gerakan kamera, wajib format LAYER baku berikut:
   (VERTICAL 9:16) --ar ${aspectRatio} --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: [nama file produk], Consistency: MAX). [LAYER 2: MICRO-PACING & ACTION (MANDATE 49)] ([00:00-00:02]: Slow Zoom In on label, [00:02-00:05]: Orbital Pan, [00:05-00:08]: Rack Focus to background + TRANSITION LOCK). [LAYER 3: SFX] SFX: [ambient sfx].
   DILARANG di I2V: kata gerakan tangan/tubuh (hand tilts, fingers, pouring, dripping, arm, wrist, adding, mixing). HANYA gerakan kamera.
4. JANGAN isi t2v_prompt — biarkan null.

Respon JSON:
{
  "visual_description": "Deskripsi visual baru Klip ${clipIndex}",
  "camera_movement": "Gerakan kamera",
  "audio_mood": "Mood SFX/musik",
  "narration": "Narasi 17-19 kata",
  "t2i_prompt": "(VERTICAL 9:16) --ar ${aspectRatio} --no landscape [LAYER 1: OPTICS] ... [LAYER 2: SUBJECT & VISUAL TRUTH] ... [LAYER 3: SCENE & LIGHT] ... [LAYER 4: KINETIC IMPLICATION] ...",
  "i2v_prompt": "(VERTICAL 9:16) --ar ${aspectRatio} --no landscape [LAYER 1: INPUT & TRUTH LOCK] ... [LAYER 2: MICRO-PACING & ACTION (MANDATE 49)] ... [LAYER 3: SFX] ...",
  "t2v_prompt": null
}`;

    addLog('Mengirim request ke Gemini untuk re-alignment...');
    const rawGeminiResponse = await executeWithKeyPool(1, async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
      });
      const result = await model.generateContent(geminiPrompt);
      return result.response.text();
    });

    const parsedGemini = parseGeminiJSON(rawGeminiResponse);
    addLog(`Gemini re-alignment selesai: "${parsedGemini.narration}"`);

    // Update Storyboard
    storyboard[cIndex].visual_description = parsedGemini.visual_description || storyboard[cIndex].visual_description;
    storyboard[cIndex].camera_movement = parsedGemini.camera_movement || storyboard[cIndex].camera_movement;
    storyboard[cIndex].audio_mood = parsedGemini.audio_mood || storyboard[cIndex].audio_mood;

    // Update Voiceover
    let voElem = voiceover.find(v => Number(v.scene || v.clip || v.scene_number) === clipIndex);
    if (!voElem) {
      voElem = { scene: clipIndex, narration: parsedGemini.narration };
      voiceover.push(voElem);
    } else {
      voElem.narration = parsedGemini.narration || voElem.narration;
    }

    // Update Prompts JSON
    if (parsedGemini.t2i_prompt) {
      if (!prompts_json.t2i_prompts) prompts_json.t2i_prompts = [];
      let pElem = prompts_json.t2i_prompts.find(p => Number(p.clip) === clipIndex);
      if (pElem) pElem.prompt = parsedGemini.t2i_prompt;
      else prompts_json.t2i_prompts.push({ clip: clipIndex, prompt: parsedGemini.t2i_prompt });
    }
    if (parsedGemini.i2v_prompt) {
      if (!prompts_json.i2v_prompts) prompts_json.i2v_prompts = [];
      let pElem = prompts_json.i2v_prompts.find(p => Number(p.clip) === clipIndex);
      if (pElem) pElem.prompt = parsedGemini.i2v_prompt;
      else prompts_json.i2v_prompts.push({ clip: clipIndex, prompt: parsedGemini.i2v_prompt });
    }
    // Klip ini menggunakan T2I+I2V, HAPUS T2V entry untuk clipIndex jika ada
    if (prompts_json.t2v_prompts) {
      prompts_json.t2v_prompts = prompts_json.t2v_prompts.filter(p => Number(p.clip) !== clipIndex);
    }

    await db.prepare('UPDATE sheets_jobs SET storyboard = ?, voiceover = ?, prompts_json = ? WHERE id = ?')
      .run(JSON.stringify(storyboard), JSON.stringify(voiceover), JSON.stringify(prompts_json), jobId);

    addLog('Database sheets_jobs berhasil diperbarui dengan naskah/prompt baru.');

    // ─── STEP 3: Audio (TTS) Re-generation ───────────────────────────────────
    const provider = campaign.voice_provider || 'minimax';
    const persona = campaign.voice_persona || 'Professional Anchor';
    const ext = provider === 'minimax' ? 'mp3' : 'wav';
    const clipAudioName = `tts_autopilot_${batchId}_clip_${cIndex}.${ext}`;
    const absoluteClipAudioPath = path.join(tempDir, clipAudioName);

    addLog(`Merender audio Klip ${clipIndex} baru via ${provider} (${persona})...`);
    if (provider === 'minimax') {
      await generateMinimaxVO(parsedGemini.narration, persona, absoluteClipAudioPath, {
        speed: campaign.voice_speed || 1.0,
        volume: campaign.voice_volume || 1.0,
        model: campaign.tts_model_quality,
        language: campaign.target_language || 'id-ID'
      });
    } else {
      const { generateGeminiExact8sAudio } = await import('@/lib/gemini-8s-tts');
      await generateGeminiExact8sAudio(parsedGemini.narration, persona, absoluteClipAudioPath);
    }

    // Bangun ulang list audio klip dan cek keberadaan file
    const clipsAudioPaths = [];
    for (let i = 0; i < storyboard.length; i++) {
      const pathName = `tts_autopilot_${batchId}_clip_${i}.${ext}`;
      const absPath = path.join(tempDir, pathName);
      if (!fs.existsSync(absPath)) {
        const tElem = voiceover.find(v => Number(v.scene || v.clip || v.scene_number) === i + 1);
        const tText = tElem ? tElem.narration : '';
        addLog(`[TTS Fallback] File audio klip ${i + 1} hilang dari disk, merender ulang...`);
        if (provider === 'minimax') {
          await generateMinimaxVO(tText, persona, absPath, {
            speed: campaign.voice_speed || 1.0,
            volume: campaign.voice_volume || 1.0,
            model: campaign.tts_model_quality,
            language: campaign.target_language || 'id-ID'
          });
        } else {
          const { generateGeminiExact8sAudio } = await import('@/lib/gemini-8s-tts');
          await generateGeminiExact8sAudio(tText, persona, absPath);
        }
      }
      clipsAudioPaths.push(absPath);
    }

    // Concatenate all audio clips using FFmpeg
    const combinedAudioName = `tts_combined_${batchId}_final.mp3`;
    const absoluteCombinedPath = path.join(tempDir, combinedAudioName);
    
    const { execSync } = await import('child_process');
    const filterString = clipsAudioPaths.map((_, index) => `[${index}:a]`).join('') + `concat=n=${clipsAudioPaths.length}:v=0:a=1[a]`;
    
    let ffmpegCmd = `ffmpeg -y `;
    clipsAudioPaths.forEach(p => {
      ffmpegCmd += `-i "${p}" `;
    });
    ffmpegCmd += `-filter_complex "${filterString}" -map "[a]" "${absoluteCombinedPath}"`;
    
    addLog('Menggabungkan seluruh audio clips dengan FFmpeg...');
    execSync(ffmpegCmd);
    const finalAudioPath = `/temp/${combinedAudioName}`;
    addLog(`Voiceover gabungan sukses dibuat: ${finalAudioPath}`);

    await db.prepare('UPDATE sheets_jobs SET local_audio_path = ? WHERE id = ?').run(finalAudioPath, jobId);

    // ─── STEP 4: Video Re-generation & Storage Upload ────────────────────────
    addLog('Memanggil repair-clip API secara internal untuk memproses video & upload...');
    const localPort = process.env.PORT || '3000';
    
    const repairRes = await fetch(`http://127.0.0.1:${localPort}/api/sheets-autopilot/repair-clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobId,
        clipIndex
      })
    });

    const repairJson = await repairRes.json();
    if (repairJson.logs && Array.isArray(repairJson.logs)) {
      repairJson.logs.forEach(l => addLog(`[repair-clip] ${l}`));
    }

    if (!repairRes.ok || !repairJson.success) {
      throw new Error(repairJson.error || 'Gagal merender video atau mengunggah via repair-clip');
    }

    addLog('✅ Seluruh rangkaian perbaikan naskah, audio, video, dan upload selesai!');

    return NextResponse.json({
      success: true,
      jobId,
      clipIndex,
      newNarration: parsedGemini.narration,
      newT2iPrompt: parsedGemini.t2i_prompt,
      newI2vPrompt: parsedGemini.i2v_prompt,
      driveFolder: repairJson.driveFolder,
      logs
    });

  } catch (err) {
    console.error('[repair-storyboard-clip] ERROR:', err);
    return NextResponse.json({ error: err.message, logs }, { status: 500 });
  }
}
