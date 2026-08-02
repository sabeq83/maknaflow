import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';
import { downloadFromUrl } from './video-downloader.js';
import { uploadVideoToGemini, GEMINI_MODELS } from './gemini.js';
import { buildProductDiscoveryPrompt } from './prompts.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pengunduh Gambar E-commerce Tangguh (Bypasses Hotlink Protections)
 */
async function downloadECommerceImage(url, destPath) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://shopee.co.id/'
  };

  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Gagal mengunduh gambar dari e-commerce. Status HTTP: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
  return destPath;
}

/**
 * Custom Gemini REST call that includes tools for Google Search Grounding
 */
async function generateWithVideoAndGrounding(fileUri, mimeType, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS.PRIMARY}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        parts: [
          { fileData: { fileUri, mimeType } },
          { text: prompt }
        ]
      }
    ],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 16384
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Grounding API Error: HTTP ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini Grounding API returned empty response candidates');
  }
  return text;
}

/**
 * Menjalankan Pipa Sourcing Grounding Otonom V8.2
 */
export async function runSourcingGroundingPipeline(jobId) {
  const db = getDb();
  const job = await db.prepare("SELECT * FROM re_plus_recomm_jobs WHERE id = ?").get(jobId);
  if (!job) return;

  const urls = JSON.parse(job.source_urls_json);
  
  // Get API key
  const { getAvailableApiKey, getSetting } = await import('./db.js');
  const singleKey = getSetting('gemini_api_key');
  const apiKeyObj = await getAvailableApiKey();
  const apiKey = singleKey || (apiKeyObj ? apiKeyObj.api_key : process.env.GEMINI_API_KEY);

  if (!apiKey) {
    await db.prepare("UPDATE re_plus_recomm_jobs SET status = 'failed' WHERE id = ?").run(jobId);
    throw new Error('No active API Key found for Gemini Grounding');
  }

  await db.prepare("UPDATE re_plus_recomm_jobs SET status = 'scraping' WHERE id = ?").run(jobId);

  for (const url of urls) {
    let videoEntry = null;
    try {
      console.log(`[Recomm Pipeline] Scraping/downloading video from URL: ${url}`);
      videoEntry = await downloadFromUrl(url);

      await db.prepare("UPDATE re_plus_recomm_jobs SET status = 'analyzing' WHERE id = ?").run(jobId);

      // Upload video to Gemini
      console.log(`[Recomm Pipeline] Uploading video ${videoEntry.filename} to Gemini...`);
      const uploadResult = await uploadVideoToGemini(videoEntry.filePath, videoEntry.mimeType, apiKey);

      // Build Prompt
      const geminiPrompt = buildProductDiscoveryPrompt("", job.target_recommendations_count);

      // Call Grounding API
      console.log(`[Recomm Pipeline] Running Gemini Search Grounding for discovery...`);
      let responseText;
      try {
        responseText = await generateWithVideoAndGrounding(uploadResult.fileUri, uploadResult.mimeType, geminiPrompt, apiKey);
      } catch (groundingError) {
        console.warn(`[Recomm Pipeline] Search Grounding failed (${groundingError.message}). Retrying with gemini-flash-latest (no grounding)...`);
        
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              parts: [
                { fileData: { fileUri: uploadResult.fileUri, mimeType: uploadResult.mimeType } },
                { text: geminiPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json'
          }
        };
        
        const response = await fetch(genUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Fallback Gemini API Error: HTTP ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
          throw new Error('Fallback Gemini API returned empty response candidates');
        }
      }

      // Parse JSON response
      const { parseGeminiJSON } = await import('./json-parser.js');
      const parsedData = parseGeminiJSON(responseText);

      const recommendations = parsedData.recommendations || [];
      console.log(`[Recomm Pipeline] Gemini discovered ${recommendations.length} recommendations`);

      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      for (const prod of recommendations) {
        const outputId = `repo_${uuidv4()}`;
        const localFilename = `${outputId}.png`;
        const localImagePath = `/uploads/products/${localFilename}`;
        const absoluteLocalPath = path.join(uploadsDir, localFilename);

        try {
          if (prod.scraped_image_url) {
            console.log(`[Recomm Downloader] Downloading image from ${prod.scraped_image_url}...`);
            await downloadECommerceImage(prod.scraped_image_url, absoluteLocalPath);
          } else {
            throw new Error('scraped_image_url is empty');
          }
        } catch (downloadError) {
          console.warn(`[Recomm Downloader] Failed to download image (${prod.scraped_image_url}), using placeholder fallback:`, downloadError.message);
          const defaultPlaceholder = path.join(process.cwd(), 'public', 'placeholder-product.png');
          if (fs.existsSync(defaultPlaceholder)) {
            fs.copyFileSync(defaultPlaceholder, absoluteLocalPath);
          } else {
            fs.writeFileSync(absoluteLocalPath, ''); // Write a blank file
          }
        }

        // Insert output row
        await db.prepare(`
          INSERT INTO re_plus_recomm_outputs (id, recomm_job_id, source_url, video_deconstruction_json, recommended_product_name, short_description, unique_selling_point, scraped_image_url, local_image_path, is_selected_by_user)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          outputId,
          job.id,
          url,
          JSON.stringify(parsedData.video_analysis || {}),
          prod.product_name || 'Produk Baru',
          prod.short_description || '',
          prod.unique_selling_point || '',
          prod.scraped_image_url || '',
          localImagePath
        );
      }
    } catch (err) {
      console.error(`[Recomm Pipeline] Failed to process URL ${url}:`, err.message);
    } finally {
      if (videoEntry?.filePath) {
        const { cleanupTempFile } = await import('./video-downloader.js');
        cleanupTempFile(videoEntry.filePath);
      }
    }
  }

  await db.prepare("UPDATE re_plus_recomm_jobs SET status = 'completed' WHERE id = ?").run(jobId);
}

/**
 * Mengupdate data rekomendasi produk berdasarkan hasil suntingan user di antarmuka
 */
export async function updateRecommendedProduct(outputId, updateData, uploadedFile = null) {
  const db = getDb();
  const currentData = await db.prepare("SELECT * FROM re_plus_recomm_outputs WHERE id = ?").get(outputId);
  if (!currentData) {
    throw new Error("Data produk rekomendasi tidak ditemukan.");
  }

  const { recommended_product_name, short_description, unique_selling_point, is_selected_by_user } = updateData;
  let finalImagePath = currentData.local_image_path;

  if (uploadedFile) {
    const fileExt = path.extname(uploadedFile.name) || '.png';
    const newFilename = `${outputId}_custom${fileExt}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const absolutePath = path.join(uploadsDir, newFilename);
    const newLocalPath = `/uploads/products/${newFilename}`;

    // Hapus file foto lama jika ada
    if (currentData.local_image_path) {
      const oldAbsoluteFile = path.join(process.cwd(), 'public', currentData.local_image_path);
      if (fs.existsSync(oldAbsoluteFile) && !currentData.local_image_path.includes('placeholder')) {
        try { fs.unlinkSync(oldAbsoluteFile); } catch (e) { /* ignore */ }
      }
    }

    fs.writeFileSync(absolutePath, uploadedFile.buffer);
    finalImagePath = newLocalPath;
  }

  const isSelected = is_selected_by_user !== undefined ? Number(is_selected_by_user) : currentData.is_selected_by_user;

  await db.prepare(`
    UPDATE re_plus_recomm_outputs 
    SET recommended_product_name = ?, 
        short_description = ?, 
        unique_selling_point = ?, 
        local_image_path = ?,
        is_selected_by_user = ?
    WHERE id = ?
  `).run(
    recommended_product_name !== undefined ? recommended_product_name : currentData.recommended_product_name,
    short_description !== undefined ? short_description : currentData.short_description,
    unique_selling_point !== undefined ? unique_selling_point : currentData.unique_selling_point,
    finalImagePath,
    isSelected,
    outputId
  );

  return { id: outputId, local_image_path: finalImagePath };
}
