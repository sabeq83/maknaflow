import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';
import { executeWithKeyPool } from './gemini.js';
import { generateImage, getTaskStatus, getFileUrl } from './webhook-client.js';
import { downloadECommerceImage } from './url-scraper.js';

function logToBulk(message) {
  try {
    const logDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'product_bulk_logs.txt');
    const timestamp = new Date().toLocaleString('id-ID');
    const logLine = `[${timestamp}] ${message}`;
    console.log(`[Product Bulk Worker] ${message}`);
    fs.appendFileSync(logPath, `${logLine}\n`);
  } catch (err) {
    console.error('[Bulk Worker Logger Error]:', err.message);
  }
}

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
}

// Helper to convert file to base64
const fileToBase64 = (filePath) => {
  let absolutePath = filePath;
  if (!fs.existsSync(absolutePath)) {
    absolutePath = filePath.startsWith('/') ? path.join(process.cwd(), 'public', filePath) : filePath;
  }
  if (!fs.existsSync(absolutePath)) return null;
  const buffer = fs.readFileSync(absolutePath);
  
  let mimeType = 'image/png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    mimeType = 'image/jpeg';
  } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    mimeType = 'image/png';
  } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    mimeType = 'image/webp';
  }
  
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

export async function processProductBulkEnrichment() {
  const db = getDb();
  
  // =========================================================================
  // FASE 1: BATCH ENRICHMENT VIA GEMINI (Max 10 Produk 'pending')
  // =========================================================================
  const pendingProducts = await db.prepare("SELECT * FROM product_extractions WHERE extraction_status = 'pending' LIMIT 10").all();
  
  if (pendingProducts.length > 0) {
    logToBulk(`Menemukan ${pendingProducts.length} produk raw dalam antrean. Memulai pengayaan batch Gemini AI...`);
    
    const productsList = pendingProducts.map(p => ({
      id: p.id,
      product_name: p.product_name,
      raw_description: p.raw_description || ''
    }));

    const prompt = `Anda adalah expert E-commerce Copywriter dan Branding Strategist.
Analisis daftar produk mentah berikut:
${JSON.stringify(productsList, null, 2)}

Untuk setiap produk, lakukan analisis komersial mendalam dan kembalikan output dalam format JSON terstruktur yang valid.
Format JSON output persis:
{
  "products": [
    {
      "id": "ID produk asli yang diberikan di input",
      "product_name": "Nama produk komersial rapi beserta brand",
      "unique_selling_point": ["USP 1", "USP 2", "USP 3"],
      "category": "Kategori produk (misal: Skincare, Kuliner, Fashion, Gadget)",
      "packaging_type": "Bentuk kemasan fisik produk (misal: Botol Plastik, Jar Kaca, Pouch, Sachet, Dus Kotak)",
      "is_in_packaging": 1, // 1 jika biasanya ditampilkan di dalam kemasan saat promosi, 0 jika produk telanjang/tidak dalam kemasan
      "t2i_prompt": "Prompt visual start-frame statis realistis dalam Bahasa Inggris untuk Text-to-Image (T2I), deskripsikan produk, pencahayaan studio, dan detail latar belakang minimalis tepercaya.",
      "i2v_action_prompt": "Prompt aksi visual dalam Bahasa Inggris untuk Image-to-Video (I2V), deskripsikan pergerakan kamera halus seperti lambat memutar, panning, atau slow zoom.",
      "target_audience": "Target pembeli utama produk",
      "pain_point_solved": "Masalah nyata yang dipecahkan oleh produk ini",
      "clean_photo_t2i_prompt": "Prompt T2I khusus Bahasa Inggris untuk menghasilkan gambar foto studio produk yang bersih, estetik, dan profesional. Fokuskan deskripsi pada produk diletakkan di atas meja studio minimalis, pencahayaan alami lembut dari samping, latar belakang bersih monokromatik netral."
    }
  ]
}

Aturan Penting:
1. Pastikan JSON terstruktur dengan benar dan semua string valid (hindari unescaped double quotes).
2. Output visual prompt wajib Bahasa Inggris.
3. ID produk wajib sesuai dengan data input.`;

    try {
      const rawResponse = await executeWithKeyPool(1, async (apiKey) => {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const { GEMINI_MODELS } = await import('./gemini.js');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODELS.PRIMARY,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8
          }
        });
        const result = await model.generateContent([{ text: prompt }]);
        return result.response.text();
      });

      const enrichedResult = JSON.parse(rawResponse);
      const enrichedProducts = enrichedResult.products || [];

      await db.transaction(async () => {
        for (const item of enrichedProducts) {
          await db.prepare(`
            UPDATE product_extractions
            SET product_name = ?,
                unique_selling_point = ?,
                category = ?,
                packaging_type = ?,
                is_in_packaging = ?,
                t2i_prompt = ?,
                i2v_action_prompt = ?,
                target_audience = ?,
                pain_point_solved = ?,
                clean_photo_t2i_prompt = ?,
                extraction_status = 'pending_image'
            WHERE id = ?
          `).run(
            item.product_name,
            JSON.stringify(item.unique_selling_point),
            item.category,
            item.packaging_type,
            Number(item.is_in_packaging || 0),
            item.t2i_prompt,
            item.i2v_action_prompt,
            item.target_audience,
            item.pain_point_solved,
            item.clean_photo_t2i_prompt,
            item.id
          );
          logToBulk(`[Gemini Enrichment] Produk "${item.product_name}" berhasil diperkaya.`);
        }
      })();
      logToBulk(`Pekerjaan Gemini batch selesai untuk ${enrichedProducts.length} produk.`);
    } catch (err) {
      logToBulk(`[ERROR Gemini Batch] Gagal memproses batch: ${err.message}`);
    }
  }

  // =========================================================================
  // FASE 2: DISPATCH STUDIO SHOT GENERATION KE G-LABS
  // =========================================================================
  const pendingImageProducts = await db.prepare("SELECT * FROM product_extractions WHERE extraction_status = 'pending_image' LIMIT 5").all();
  
  for (const product of pendingImageProducts) {
    try {
      logToBulk(`[G-Labs Dispatch] Mengirim tugas render foto studio untuk "${product.product_name}"...`);
      
      let referenceImages = null;
      if (product.scraped_image_url && product.scraped_image_url.startsWith('http')) {
        try {
          const refFilename = `raw_${product.id}.png`;
          const refAbsPath = path.join(process.cwd(), 'public', 'uploads', 'products', refFilename);
          
          logToBulk(`[G-Labs Dispatch] Mengunduh gambar referensi ke lokal: ${product.scraped_image_url}`);
          const downloadSuccess = await downloadECommerceImage(product.scraped_image_url, refAbsPath);
          
          if (downloadSuccess && fs.existsSync(refAbsPath)) {
            // Update database so we keep track of the local raw image
            const localRelPath = `/uploads/products/${refFilename}`;
            await db.prepare("UPDATE product_extractions SET raw_photo_url = ? WHERE id = ?").run(localRelPath, product.id);
            
            const base64Str = fileToBase64(refAbsPath);
            if (base64Str) {
              referenceImages = [base64Str];
              logToBulk(`[G-Labs Dispatch] Gambar referensi berhasil dikonversi ke Base64.`);
            }
          }
        } catch (downloadErr) {
          logToBulk(`[G-Labs Dispatch] [WARNING] Gagal mengunduh gambar referensi secara lokal: ${downloadErr.message}. Mencoba fallback...`);
        }
        
        // Fallback to raw URL if download or conversion failed
        if (!referenceImages) {
          referenceImages = [product.scraped_image_url];
          logToBulk(`[G-Labs Dispatch] Fallback mengirimkan raw URL ke G-Labs.`);
        }
      }

      const res = await generateImage({
        prompt: product.clean_photo_t2i_prompt || 'a professional clean product photo',
        reference_images: referenceImages,
        aspect_ratio: '1:1'
      });

      if (res && res.task_id) {
        await db.prepare("UPDATE product_extractions SET glabs_task_id = ?, extraction_status = 'generating_image' WHERE id = ?")
          .run(res.task_id, product.id);
        logToBulk(`[G-Labs Dispatch] Task ID ${res.task_id} berhasil didaftarkan untuk "${product.product_name}".`);
      } else {
        throw new Error('G-Labs Webhook tidak mengembalikan task_id');
      }
    } catch (err) {
      logToBulk(`[ERROR G-Labs Dispatch] Gagal mengirim task untuk "${product.product_name}": ${err.message}`);
      await db.prepare("UPDATE product_extractions SET extraction_status = 'failed' WHERE id = ?").run(product.id);
    }
  }

  // =========================================================================
  // FASE 3: POLLING & UNDUH HASIL GAMBAR VERSI STUDIO
  // =========================================================================
  const activeImageTasks = await db.prepare("SELECT * FROM product_extractions WHERE extraction_status = 'generating_image'").all();

  for (const product of activeImageTasks) {
    try {
      logToBulk(`[Polling G-Labs] Memeriksa status task ${product.glabs_task_id} untuk "${product.product_name}"...`);
      const statusResult = await getTaskStatus(product.glabs_task_id);
      const taskStatus = (statusResult?.status || '').toLowerCase();

      if (taskStatus === 'completed') {
        const files = statusResult.results || statusResult.files || [];
        let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) || files[0];
        
        if (imageFile) {
          if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
            imageFile = imageFile.split('/').pop();
          }
          const downloadUrl = getFileUrl(imageFile);
          const safeFilename = `studio_prod_${product.id}_${Date.now()}.png`;
          const localRelPath = `/uploads/products/${safeFilename}`;
          const localAbsPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);

          logToBulk(`Mengunduh hasil foto studio dari G-Labs: ${downloadUrl}`);
          await downloadFile(downloadUrl, localAbsPath);
          logToBulk(`Foto studio berhasil disimpan ke: ${localRelPath}`);

          await db.prepare(`
            UPDATE product_extractions 
            SET photo_url = ?, 
                generated_photo_url = ?, 
                clean_photo_url = ?, 
                cleaned_photo_url = ?,
                active_photo = 'generated_photo_url',
                extraction_status = 'completed' 
            WHERE id = ?
          `).run(localRelPath, localRelPath, localRelPath, localRelPath, product.id);

          logToBulk(`✅ [COMPLETED] Produk "${product.product_name}" selesai diproses sepenuhnya!`);
        } else {
          logToBulk(`[G-Labs Warning] Task ${product.glabs_task_id} dilaporkan selesai tetapi tidak ada file gambar.`);
        }
      } else if (taskStatus === 'failed') {
        logToBulk(`❌ [FAILED] Task G-Labs ${product.glabs_task_id} gagal diproses.`);
        await db.prepare("UPDATE product_extractions SET extraction_status = 'failed' WHERE id = ?").run(product.id);
      }
    } catch (err) {
      logToBulk(`[ERROR Polling] Gagal memantau task ${product.glabs_task_id}: ${err.message}`);
    }
  }
}
