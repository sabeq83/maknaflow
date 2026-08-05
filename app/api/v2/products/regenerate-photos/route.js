import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { executeWithKeyPool } from '@/lib/gemini';
import { generateImage } from '@/lib/webhook-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { withTenantContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Daftar ID produk wajib dikirim.' }, { status: 400 });
    }

    const db = getDb();
    const results = [];

    for (const id of ids) {
      const p = await db.prepare('SELECT * FROM product_extractions WHERE id = ?').get(id);
      if (!p) continue;

      const rawPhotoPath = p.raw_photo_url ? path.join(process.cwd(), 'public', p.raw_photo_url) : null;
      if (!rawPhotoPath || !fs.existsSync(rawPhotoPath)) {
        console.warn(`Product ID ${id} tidak memiliki file foto raw.`);
        continue;
      }

      try {
        // 1. Kirim gambar raw ke Gemini Vision untuk mengekstrak prompt visual & aksi baru (Bahasa Inggris)
        const imageBuffer = fs.readFileSync(rawPhotoPath);
        const imageBase64 = imageBuffer.toString('base64');

        const geminiResultText = await executeWithKeyPool(1, async (apiKey) => {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
              temperature: 0.4,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'object',
                properties: {
                  clean_photo_t2i_prompt: { type: 'string' },
                  t2i_prompt: { type: 'string' },
                  i2v_action_prompt: { type: 'string' }
                },
                required: ['clean_photo_t2i_prompt', 't2i_prompt', 'i2v_action_prompt']
              }
            }
          });

          const imagePart = {
            inlineData: {
              data: imageBase64,
              mimeType: p.raw_photo_url.endsWith('.png') ? 'image/png' : 'image/jpeg'
            }
          };

          const promptText = `Analyze this raw product image. Generate optimized, clean prompts in English for AI visuals:
          1. "clean_photo_t2i_prompt": A prompt to generate a professional, clean product photo on a neutral monochromatic studio background.
          2. "t2i_prompt": A premium high-fidelity studio product photography prompt.
          3. "i2v_action_prompt": A smooth camera motion prompt (e.g. slow zoom in, slow panning). If it is a closed package, restrict actions to camera motion only.`;

          const res = await model.generateContent([promptText, imagePart]);
          return res.response.text();
        });

        const parsed = JSON.parse(geminiResultText);

        // Update prompt ke database SQLite
        await db.prepare(`
          UPDATE product_extractions
          SET clean_photo_t2i_prompt = ?,
              t2i_prompt = ?,
              i2v_action_prompt = ?,
              extraction_status = 'pending_image'
          WHERE id = ?
        `).run(parsed.clean_photo_t2i_prompt, parsed.t2i_prompt, parsed.i2v_action_prompt, id);

        // 2. Memicu request rendering gambar studio baru ke G-Labs
        let referenceUrl = p.scraped_image_url;
        if (p.cleaned_photo_url) {
          // Gunakan clean photo local yang disajikan via API route
          referenceUrl = `${req.nextUrl.origin}/api/v2/products/image?path=${encodeURIComponent(p.cleaned_photo_url)}`;
        }

        const glabsRes = await generateImage({
          prompt: parsed.clean_photo_t2i_prompt,
          reference_images: [referenceUrl],
          aspect_ratio: '1:1'
        });

        if (glabsRes && glabsRes.task_id) {
          await db.prepare(`
            UPDATE product_extractions
            SET glabs_task_id = ?, extraction_status = 'generating_image'
            WHERE id = ?
          `).run(glabsRes.task_id, id);
          
          results.push({ id, status: 'success', task_id: glabsRes.task_id });
        } else {
          results.push({ id, status: 'failed', error: 'G-Labs did not return a task ID' });
        }

      } catch (err) {
        console.error(`[Regenerate Single Photo Error] ID ${id}:`, err);
        results.push({ id, status: 'failed', error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Batch RE-Generate Photos terpicu untuk ${results.filter(r => r.status === 'success').length} produk.`,
      results
    });

  } catch (err) {
    console.error('[Regenerate Photos API Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
