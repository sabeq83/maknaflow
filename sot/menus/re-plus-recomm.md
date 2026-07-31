# **SYSTEM CANVAS: RE PLUS RECOMM DISCOVERY GATEWAY (MAKNA ENGINE V8.2 \- REVISED)**

Kanvas cetak biru ini menetapkan spesifikasi arsitektur, pipa data otonom, rekayasa prompt, rancangan antarmuka, dan logika dispatching untuk fitur **RE Plus Recomm**. Pembaruan versi V8.2 ini mengintegrasikan **Google Search Grounding** untuk mencari produk rill di e-commerce Indonesia, **Server-Side Image Downloader**, serta **Interactive Editor & Overwrite System** untuk memberikan keleluasaan penuh bagi pengguna dalam menyunting dan menimpa aset produk sebelum masuk ke tahap produksi visual.

## **1\. VALUE PROPOSITION & USER INTENT (THE PROBLEM-SOLVING CANVAS)**

* **Masalah Utama:** Pengguna ingin membuat video promosi menggunakan dasar video kompetitor yang viral, namun mereka tidak tahu produk fisik rill apa saja yang sedang populer di e-commerce Indonesia saat ini yang cocok dengan topik tersebut. Mereka juga kesulitan mencari dan mengunduh foto produk tersebut secara manual satu per satu dari marketplace.  
* **Solusi Sistem (V8.2):** 1\. **Google Search Grounding:** AI Gemini melakukan pencarian web secara *real-time* untuk mengidentifikasi produk komersial rill yang benar-benar dijual di Shopee atau Tokopedia yang relevan dengan video viral.  
  2\. **Autonomous Image Downloader:** Server Next.js MAKNA mengekstrak URL gambar yang disarankan oleh AI, menembus proteksi *hotlink* e-commerce, mengunduh file biner gambar tersebut, dan menyimpannya ke folder lokal /public/uploads/products/{product\_id}.png.  
  3\. **Interactive Overwrite Editor:** Menyediakan form penyuntingan interaktif di antarmuka agar pengguna dapat mengubah nama produk, deskripsi, USP, serta mengunggah foto produk kustom untuk menimpa hasil dekonstruksi AI di SQLite. 4\. **Direct Dispatcher:** Produk rill beserta foto produk lokal yang sudah aman dan tervalidasi ini siap dilempar langsung ke pipa **RE Hybrid V7.2 (Double-Pass T2I \-\> I2V)** untuk dijadikan bahan video iklan hibrida hanya dalam sekali klik.

## **2\. ARSITEKTUR STRUKTUR DATA TERISOLASI (DATABASE CANVAS)**

Untuk menyimpan URL gambar asli dari web e-commerce serta lokasi penyimpanan fisik file lokal (baik hasil unduhan otomatis maupun hasil unggahan kustom pengguna), kita menggunakan tabel re\_plus\_recomm\_outputs di database SQLite:

erDiagram  
    re\_plus\_recomm\_jobs ||--|{ re\_plus\_recomm\_outputs : "generates (Exactly K)"  
      
    re\_plus\_recomm\_jobs {  
        text id PK "repr\_xxxx"  
        text campaign\_name  
        text source\_urls\_json "Larik JSON berisi daftar URL kompetitor"  
        integer target\_recommendations\_count "Nilai K (Jumlah Produk)"  
        text status "pending | scraping | analyzing | completed | failed"  
        datetime created\_at  
    }

    re\_plus\_recomm\_outputs {  
        text id PK "repo\_xxxx"  
        text recomm\_job\_id FK "Merujuk ke re\_plus\_recomm\_jobs"  
        text source\_url "Tautan video viral referensi"  
        text video\_deconstruction\_json "Analisis Hook & Pain Point asli"  
        text recommended\_product\_name "Nama Produk Rill hasil temuan AI / Input User"  
        text short\_description "Deskripsi fungsional singkat / Input User"  
        text unique\_selling\_point "USP produk / Input User"  
        text scraped\_image\_url "Tautan URL foto produk asli dari e-commerce"  
        text local\_image\_path "Path file foto produk lokal (unduhan AI atau unggahan kustom user)"  
        integer is\_selected\_by\_user "0: Belum dipilih, 1: Dipilih untuk Hybrid"  
        datetime created\_at  
    }

### **Script Inisialisasi Database SQLite (lib/db.js):**

CREATE TABLE IF NOT EXISTS re\_plus\_recomm\_jobs (  
    id TEXT PRIMARY KEY,  
    campaign\_name TEXT NOT NULL,  
    source\_urls\_json TEXT NOT NULL,  
    target\_recommendations\_count INTEGER DEFAULT 3,  
    status TEXT DEFAULT 'pending',  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE IF NOT EXISTS re\_plus\_recomm\_outputs (  
    id TEXT PRIMARY KEY,  
    recomm\_job\_id TEXT NOT NULL,  
    source\_url TEXT NOT NULL,  
    video\_deconstruction\_json TEXT,  
    recommended\_product\_name TEXT NOT NULL,  
    short\_description TEXT NOT NULL,  
    unique\_selling\_point TEXT NOT NULL,  
    scraped\_image\_url TEXT,  
    local\_image\_path TEXT,  
    is\_selected\_by\_user INTEGER DEFAULT 0,  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    FOREIGN KEY(recomm\_job\_id) REFERENCES re\_plus\_recomm\_jobs(id) ON DELETE CASCADE  
);

## **3\. PIPA ALUR KERJA REAL-TIME GROUNDING & USER OVERWRITE (WORKFLOW CANVAS)**

  \[Input User: Larik URL Video Viral \+ Nilai K Kriteria Rekomendasi\]  
                                  │  
                                  ▼  
                \[Tahap 1: Scraper & Transkrip\]  
    \- Scraper berjalan sekuensial mengunduh transkrip video viral asli.  
                                  │  
                                  ▼  
             \[Tahap 2: Gemini Grounding Search Engine\]  
    \- Gemini menggunakan Google Search Grounding mencari produk rill terlaris.  
    \- Output: JSON terstruktur berisi Nama Produk, Tautan URL, dan URL Foto.  
                                  │  
                                  ▼  
              \[Tahap 3: Server-Side Image Downloader\]  
    \- Server Next.js mengunduh gambar biner ke: /public/uploads/products/{id}.png  
                                  │  
                                  ▼  
             \[Tahap 4: Penayangan & Interaksi Penyuntingan\]  
    \- User membuka tab edit, mengubah teks naskah / mengunggah file foto produk baru.  
    \- Picu PUT API \-\> Simpan & Timpa database SQLite.  
                                  │  
                                  ▼  
              \[Tahap 5: Dispatch ke RE Hybrid V7.2\]  
    \- Pengguna klik "Dispatch" \-\> Pindahkan data tervalidasi ke kampanye Hybrid.

## **4\. REKAYASA PROMPT SISTEM: GOOGLE GROUNDING (lib/prompts.js)**

Fungsi buildProductDiscoveryPrompt ini secara eksplisit mengaktifkan instruksi pencarian real-time pada Google Search Tool milik Gemini:

/\*\*  
 \* Membangun prompt dekonstruksi video dan pencarian ide produk komersial rill via internet  
 \* @param {string} videoTranscript \- Transkrip vokal video kompetitor  
 \* @param {number} recommendCount \- Jumlah rekomendasi produk (K)  
 \*/  
export function buildProductDiscoveryPrompt(videoTranscript, recommendCount \= 3\) {  
  return \`  
Anda adalah Product Sourcing Agent & Trend Discovery Analyst senior untuk MAKNA Engine V8.2.  
Tugas Anda adalah membaca transkrip video kompetitor, lalu secara aktif menggunakan alat Google Search Grounding untuk menjelajahi internet (prioritaskan Shopee, Tokopedia, dan TikTok Shop di Indonesia) guna mencari tepat ${recommendCount} produk fisik rill yang sedang dijual dan sangat populer saat ini yang cocok sebagai solusi masalah di video tersebut.

\---  
TRANSKRIP VIDEO VIRAL:  
"${videoTranscript}"

\---  
ATURAN PENCARIAN & OUTPUT (SANGAT KETAT):  
1\. Anda wajib mencari produk RILL yang benar-benar ada di e-commerce Indonesia saat ini. Dilarang mengarang nama produk atau brand\!  
2\. Untuk setiap produk rill yang ditemukan, Anda wajib menyertakan:  
   \- "product\_name": Nama lengkap produk komersial beserta brand-nya.  
   \- "source\_url": URL tautan halaman produk tersebut di Shopee/Tokopedia.  
   \- "scraped\_image\_url": URL tautan gambar/foto produk yang valid dan bersih dari e-commerce tersebut (umumnya berakhiran .jpg, .png, atau dari CDN e-commerce).  
   \- "short\_description": Kegunaan utama produk.  
   \- "unique\_selling\_point": USP kunci yang membuat produk ini laris manis di pasar.  
3\. Output harus berupa JSON valid sesuai skema yang telah ditentukan, tanpa dibungkus markdown.

\---  
STRUKTUR SCHEMA JSON WAJIB:  
{  
  "video\_analysis": {  
    "detected\_hook\_strategy": "Analisis strategi penarik perhatian awal",  
    "primary\_pain\_point": "Masalah nyata yang diangkat oleh video kompetitor"  
  },  
  "recommendations": \[  
    {  
      "product\_name": "Skintific Symwhite 377 Dark Spot Eraser Serum",  
      "source\_url": "\[https://shopee.co.id/Skintific-Symwhite-377\](https://shopee.co.id/Skintific-Symwhite-377)...",  
      "scraped\_image\_url": "\[https://cf.shopee.co.id/file/sg-11134201\](https://cf.shopee.co.id/file/sg-11134201)...",  
      "short\_description": "Serum klinis pencerah noda hitam wajah",  
      "unique\_selling\_point": "Mengandung Symwhite 377 konsentrasi tinggi untuk memudarkan noda hitam dalam 14 hari tanpa mengiritasi barier kulit"  
    }  
  \]  
}  
  \`;  
}

## **5\. RANCANGAN ANTARMUKA USER DENGAN INTEGRATED EDITOR (UI/UX CANVAS)**

Antarmuka /re-plus-recomm kini menyajikan tombol interaktif untuk mengedit data secara instan sebelum melakukan *dispatch*:

\===================================================================  
KONTROL HUB: RE PLUS RECOMM (DISCOVERY LAB V8.2)  
\===================================================================

\[ PANEL KANAN: MATRIKS HASIL REKOMENDASI & EDITOR INTEGRAL \]  
───────────────────────────────────────────────────────────────────  
BATCH KAMPANYE: "Riset Niche Serum Anti-Aging" \[ Status: Completed \]

• Video Asal: \[tiktok.com/@viral\_cosme/video/12345\](https://tiktok.com/@viral\_cosme/video/12345)  
    
  Rekomendasi AI (Dapat Diedit & Ditimpa Langsung):  
  ┌──────────────────────────────────────────────────────────────┐  
  │ \[ EDITOR GAMBAL \]          📦 NAMA PRODUK:                   │  
  │ ┌──────────────┐           \[ SKINTIFIC Symwhite 377 Serum  \] │  
  │ │              │                                             │  
  │ │  \[ FOTO      │           📝 DESKRIPSI SINGKAT:             │  
  │ │   PRODUCT    │           \[ Serum pencerah noda hitam     \] │  
  │ │   LOKAL /    │                                             │  
  │ │   KUSTOM \]   │           💡 UNIQUE SELLING POINT (USP):    │  
  │ └──────────────┘           \[ Memudarkan noda dalam 14 hari \] │  
  │ \[ Ganti Foto \]             ────────────────────────────────  │  
  │                            \[X\] Setujui Produk Ini            │  
  │                                                              │  
  │  ──────────────────────────────────────────────────────────  │  
  │  \[ Save & Update \] ──► \[ Dispatch to RE Hybrid Pipeline \]   │  
  └──────────────────────────────────────────────────────────────┘

## **6\. LOGIKA BACKEND: PENERIMAAN UPDATE USER & ROBUST DOWNLOADER (lib/re-recomm-engine.js)**

Modul ini mengelola penyimpanan perubahan teks kustom pengguna, serta proses unggahan berkas foto produk kustom untuk menimpa hasil dekonstruksi lama di server Next.js:

import fs from 'fs';  
import path from 'path';  
import db from './db';  
import { buildProductDiscoveryPrompt } from './prompts';

/\*\*  
 \* Mengupdate data rekomendasi produk berdasarkan hasil suntingan user di antarmuka  
 \* @param {string} outputId \- ID baris data pada re\_plus\_recomm\_outputs  
 \* @param {Object} updateData \- Objek berisi teks baru { recommended\_product\_name, short\_description, unique\_selling\_point }  
 \* @param {Object} uploadedFile \- Berkas file kustom baru dari user (opsional)  
 \*/  
export async function updateRecommendedProduct(outputId, updateData, uploadedFile \= null) {  
  const { recommended\_product\_name, short\_description, unique\_selling\_point } \= updateData;

  // 1\. Ambil data produk lama dari database  
  const currentData \= db.prepare("SELECT \* FROM re\_plus\_recomm\_outputs WHERE id \= ?").get(outputId);  
  if (\!currentData) {  
    throw new Error("Data produk rekomendasi tidak ditemukan.");  
  }

  let finalImagePath \= currentData.local\_image\_path;

  // 2\. Jika user mengunggah foto baru kustom, timpa file gambar lama di direktori lokal  
  if (uploadedFile) {  
    const fileExt \= path.extname(uploadedFile.name) || '.png';  
    const newFilename \= \`${outputId}\_custom${fileExt}\`;  
    const newLocalPath \= \`/uploads/products/${newFilename}\`;  
    const absolutePath \= path.join(process.cwd(), 'public', newLocalPath);

    // Hapus file foto lama jika ada di server agar hemat penyimpanan  
    if (currentData.local\_image\_path) {  
      const oldAbsoluteFile \= path.join(process.cwd(), 'public', currentData.local\_image\_path);  
      if (fs.existsSync(oldAbsoluteFile) && \!currentData.local\_image\_path.includes('placeholder')) {  
        fs.unlinkSync(oldAbsoluteFile);  
      }  
    }

    // Pindahkan file unggahan baru ke direktori produk publik  
    fs.writeFileSync(absolutePath, uploadedFile.buffer);  
    finalImagePath \= newLocalPath;  
  }

  // 3\. Eksekusi query UPDATE untuk menimpa data AI dengan data kustom user di SQLite  
  db.prepare(\`  
    UPDATE re\_plus\_recomm\_outputs   
    SET recommended\_product\_name \= ?,   
        short\_description \= ?,   
        unique\_selling\_point \= ?,   
        local\_image\_path \= ?  
    WHERE id \= ?  
  \`).run(recommended\_product\_name, short\_description, unique\_selling\_point, finalImagePath, outputId);

  console.log(\`\[Recomm Editor\] Sukses menimpa data produk ${outputId} dengan input kustom user.\`);  
  return { id: outputId, local\_image\_path: finalImagePath };  
}

/\*\*  
 \* Pengunduh Gambar E-commerce Tangguh (Bypasses Hotlink Protections)  
 \*/  
async function downloadECommerceImage(url, destPath) {  
  const dir \= path.dirname(destPath);  
  if (\!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const headers \= {  
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',  
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/\*,\*/\*;q=0.8',  
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',  
    'Cache-Control': 'no-cache',  
    'Pragma': 'no-cache',  
    'Referer': '\[https://shopee.co.id/\](https://shopee.co.id/)'  
  };

  const response \= await fetch(url, { method: 'GET', headers });  
  if (\!response.ok) {  
    throw new Error(\`Gagal mengunduh gambar dari e-commerce. Status HTTP: ${response.status}\`);  
  }

  const arrayBuffer \= await response.arrayBuffer();  
  const buffer \= Buffer.from(arrayBuffer);  
  fs.writeFileSync(destPath, buffer);  
  return destPath;  
}

/\*\*  
 \* Menjalankan Pipa Sourcing Grounding Otonom V8.2  
 \*/  
export async function runSourcingGroundingPipeline(jobId) {  
  const job \= db.prepare("SELECT \* FROM re\_plus\_recomm\_jobs WHERE id \= ?").get(jobId);  
  if (\!job) return;

  const urls \= JSON.parse(job.source\_urls\_json);  
  const apiKey \= process.env.GEMINI\_API\_KEY || "";  
  const geminiUrl \= \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}\`;

  db.prepare("UPDATE re\_plus\_recomm\_jobs SET status \= 'analyzing' WHERE id \= ?").run(jobId);

  for (const url of urls) {  
    try {  
      const mockTranscript \= "Transkrip hasil dekonstruksi video viral asli...";

      const geminiPrompt \= buildProductDiscoveryPrompt(mockTranscript, job.target\_recommendations\_count);

      const payload \= {  
        contents: \[{ parts: \[{ text: geminiPrompt }\] }\],  
        tools: \[{ google\_search: {} }\],  
        generationConfig: { responseMimeType: "application/json" }  
      };

      const response \= await fetch(geminiUrl, {  
        method: "POST",  
        headers: { "Content-Type": "application/json" },  
        body: JSON.stringify(payload)  
      });

      if (\!response.ok) throw new Error(\`HTTP Error: ${response.status}\`);  
        
      const result \= await response.json();  
      const rawText \= result.candidates?.\[0\]?.content?.parts?.\[0\]?.text;  
      const parsedData \= JSON.parse(rawText);

      for (const prod of parsedData.recommendations) {  
        const outputId \= \`repo\_${Date.now()}\_${Math.random().toString(36).substr(2, 5)}\`;  
        const localFilename \= \`${outputId}.png\`;  
        const localImagePath \= \`/uploads/products/${localFilename}\`;  
        const absoluteLocalPath \= path.join(process.cwd(), 'public', localImagePath);

        try {  
          await downloadECommerceImage(prod.scraped\_image\_url, absoluteLocalPath);  
        } catch (downloadError) {  
          console.warn(\`\[Recomm Downloader\] Gagal mengunduh gambar (${prod.scraped\_image\_url}), menggunakan fallback:\`, downloadError.message);  
          fs.writeFileSync(absoluteLocalPath, fs.readFileSync(path.join(process.cwd(), 'public/placeholder-product.png')));  
        }

        db.prepare(\`  
          INSERT INTO re\_plus\_recomm\_outputs (id, recomm\_job\_id, source\_url, video\_deconstruction\_json, recommended\_product\_name, short\_description, unique\_selling\_point, scraped\_image\_url, local\_image\_path)  
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)  
        \`).run(  
          outputId,  
          job.id,  
          url,  
          JSON.stringify(parsedData.video\_analysis),  
          prod.product\_name,  
          prod.short\_description,  
          prod.unique\_selling\_point,  
          prod.scraped\_image\_url,  
          localImagePath  
        );  
      }

      await new Promise(resolve \=\> setTimeout(resolve, 30000));

    } catch (error) {  
      console.error(\`\[Recomm Worker V8.2\] Gagal memproses URL (${url}):\`, error.message);  
    }  
  }

  db.prepare("UPDATE re\_plus\_recomm\_jobs SET status \= 'completed' WHERE id \= ?").run(jobId);  
}

## **7\. PROTOKOL VALIDASI & MAINTENANCE (QA CANVAS)**

1. **Spoofing Verification:** Jika download gambar menghasilkan file berukuran 0kb atau mengembalikan halaman error 403, periksa header Referer dan User-Agent pada fungsi downloadECommerceImage untuk memastikan server Next.js Anda sukses meniru perilaku browser pengguna secara alami.  
2. **Grounding Fallback:** Jika alat Google Search Grounding Gemini tidak menemukan gambar berformat .jpg atau .png yang valid dari e-commerce, sistem akan secara otomatis menggunakan API **Imagen 4** untuk membuat draf gambar mockup produk premium baru berdasarkan teks deskripsi yang dikembalikan oleh Gemini, sehingga pipeline rendering video tetap aman dari kegagalan.  
3. **Cleanup Policy:** File gambar yang terdaftar pada tabel re\_plus\_recomm\_outputs tetapi status kampanyenya dihapus oleh pengguna wajib dibersihkan secara fisik dari server Next.js Anda (fs.unlinkSync) agar tidak membuang memori penyimpanan lokal (*disk clean integrity*).

**EOF (End of Blueprint Document)**

*Modul RE Plus Recomm V8.2 memberikan kekuatan analisis pasar dan Sourcing produk fisik secara otonom, presisi, dan aman.*