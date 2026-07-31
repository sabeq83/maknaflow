# **BLUEPRINT SISTEM: PRODUCT BRIDGING INJECTOR & PIVOT ALIGNER (MAKNA ENGINE V9.2)**

Cetak biru ini menjelaskan spesifikasi teknis, arsitektur basis data, logika AI, serta rancangan antarmuka pengguna untuk modul **Product Bridging Injector** (/product-bridge-inject). Modul ini memungkinkan pengguna menyisipkan klip promosi produk baru (menggunakan *Hybrid Lock* T2I \-\> I2V) ke dalam struktur naskah lama (3 klip) secara otonom, lalu menggeser klip sisa menjadi struktur 4 klip tanpa merusak alur cerita aslinya.

### **1. STRATEGI ALUR KERJA (PIPELINE SINOPSIS)**

  [1. USER INPUT]   
  - Unggah file Naskah Lama (.md)
  - Masukkan data Produk (URL / Teks Manual / Pilih Pustaka terdaftar via Search Bar)
         │
         ▼
  [2. PRODUCT RESOLVER & DATABASE CHECK]
  - Jika URL dimasukkan: Cari kecocokan URL di database lokal `product_extractions` secara real-time.
  - Jika ditemukan: Gunakan data produk eksis secara instan (menghemat kuota scraping).
  - Jika TIDAK ditemukan: Tampilkan popup dialog konfirmasi: `"produk tidak ada didatabase, mesin akan melakukan JIT."`.
  - Jika pengguna mengonfirmasi (OK): Jalankan Playwright Scraper & Gemini Stage 1 -> Ekstrak DNA produk lengkap termasuk detail fisik (Packaging Type, Key Visuals, dll.) -> Simpan permanen ke DB.
         │
         ▼
  [3. COGNITIVE INJECTION (GEMINI AI)]
  - Gemini memproses Naskah Lama + DNA & Visual Truth Produk Target.
  - Hasil:
    * Injeksi Klip 2 baru (Promosi Halus / Soft-sell).
    * Penyesuaian naskah VO untuk 4 klip agar transisi mengalir mulus (Pivot Aligned).
    * T2I & I2V Prompt adaptif dan dinamis untuk Klip 2 baru (menjaga konsistensi setting latar tempat Klip 1 & interaksi produk).
         │
         ▼
  [4. HYBRID LOCK FASE A (G-LABS T2I)]
  - Web App mencari foto produk terdaftar di database, mengonversinya ke format Data URI Base64 secara lokal.
  - Mengirim prompt T2I, model `nano_banana_pro`, dan array `reference_images` berisi base64 tersebut ke webhook G-Labs (Start Frame).
  - Ticking engine otonom di latar belakang (`lib/campaign-scheduler.js`) memantau status render T2I setiap 15 detik, mengunduh file gambar hasil render secara non-blocking ke server lokal, dan memperbarui status kampanye ke `waiting_user`.
         │
         ▼
  [5. USER REVIEW & EDIT WORKBENCH]
  - Tampilkan naskah 4 klip hasil rajutan (disimpan ke `/uploads/bridge-injector/[ID]/naskah_bridging.md`), prompt, dan Gambar Start Frame di Grid UI.
  - Seluruh aset dapat disunting oleh pengguna secara real-time.
         │
         ▼
  [6. HYBRID LOCK FASE B (G-LABS I2V)]
  - Kirim Gambar Start Frame + Prompt I2V ke G-Labs Webhook untuk dianimasikan menjadi video.
  - Ticking engine otonom backend memantau status render I2V, mengunduh klip .mp4 final ke server lokal, dan menyelesaikannya secara otonom.
         │
         ▼
  [7. ASSET DISTRIBUTION]
  - Tampilkan tombol unduh langsung (Direct Download) Klip 2 Baru.
  - Editor tinggal mengganti klip di timeline CapCut lama dengan klip baru ini.

## **2\. SKEMA DATABASE SQLITE (lib/db.js)**

Kita menambahkan dua tabel baru untuk mengisolasi dan mendokumentasikan setiap tugas injeksi bridging produk ini.

\-- Tabel Kampanye Injektor Bridging  
CREATE TABLE IF NOT EXISTS bridge\_injector\_campaigns (  
    id TEXT PRIMARY KEY,  
    campaign\_name TEXT NOT NULL,  
    original\_script\_md TEXT NOT NULL,              \-- Menyimpan teks naskah .md asli  
    bridging\_mode TEXT DEFAULT 'select\_existing',  \-- select\_existing | manual\_input | url\_extract  
    target\_product\_id TEXT,                        \-- FK ke product\_extractions  
    ephemeral\_product\_data TEXT,                   \-- Menyimpan JSON manual atau string URL mentah  
    status TEXT DEFAULT 'pending\_source',          \-- pending\_source, pending\_storyboard, waiting\_t2i, polling\_t2i, waiting\_user, generating\_i2v, polling\_i2v, completed, failed  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    FOREIGN KEY(target\_product\_id) REFERENCES product\_extractions(id) ON DELETE SET NULL  
);

\-- Tabel Detail Output & Status Aset  
CREATE TABLE IF NOT EXISTS bridge\_injector\_outputs (  
    id TEXT PRIMARY KEY,  
    campaign\_id TEXT REFERENCES bridge\_injector\_campaigns(id) ON DELETE CASCADE,  
      
    \-- Naskah Voiceover Baru (4 Klip)  
    injected\_vo\_1 TEXT NOT NULL,  
    injected\_vo\_2 TEXT NOT NULL,                   \-- Klip produk baru  
    injected\_vo\_3 TEXT NOT NULL,                   \-- Geseran klip 2 lama  
    injected\_vo\_4 TEXT NOT NULL,                   \-- Geseran klip 3 lama  
      
    \-- Prompt & Aset Visual G-Labs (Klip 2 Baru)  
    clip2_t2i_prompt TEXT NOT NULL,  
    clip2_i2v_prompt TEXT NOT NULL,  
    clip2_t2i_task_id TEXT,  
    clip2_t2i_image_path TEXT,                     -- Path gambar lokal (.jpg) hasil render G-Labs  
    clip2_i2v_task_id TEXT,  
    clip2_video_path TEXT,                         -- Path video lokal (.mp4) hasil render I2V G-Labs  
    injected_script_md_path TEXT,                  -- Path file markdown hasil rajutan VO 1-4 (.md)
      
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP  
);

## **3. LOGIKA BACKEND: PIVOT ALIGNER ENGINE (lib/prompts.js)**

Fungsi di bawah ini merekayasa *system prompt* untuk memaksa Gemini membuat jembatan kognitif (*cognitive bridge*) yang sangat mulus dari Klip 1 ke Klip 2 baru tanpa terasa seperti iklan konvensional (*anti-ad filter*) dan mengunci detail visual produk target agar tetap konsisten.

```javascript
export function buildProductBridgingInjectorPrompt(originalScript, productData) {
  return `
Anda adalah Copywriter Iklan Senior dan Aligner Narasi di MAKNA Engine V9.2.
Tugas Anda adalah membedah naskah video 3 klip yang asli di bawah ini, menyisipkan 1 klip promosi produk baru di posisi Klip 2, dan menyusun ulang naskah voiceover lengkap menjadi tepat 4 klip.

---
NASKAH ASLI (3 KLIP):
${originalScript}

---
DATA PRODUK TARGET:
- Nama Produk: "${productData.product_name}"
- Deskripsi: "${productData.product_description}"
- USP Utama  : "${productData.unique_selling_point}"
- Deskripsi Fisik/Visual (Product Truth): "${productData.key_visuals_extracted || 'Tidak ada deskripsi visual rill'}"
- Tipe Wadah/Kemasan: "${productData.packaging_type || 'Tidak ditentukan'}"
- Status Kemasan: "${productData.is_in_packaging ? 'Dalam kemasan' : 'Tidak dalam kemasan'}"
- Referensi Prompt Render Foto Asli: "${productData.clean_photo_t2i_prompt || 'Gunakan deskripsi fisik di atas'}"

---
ATURAN DETEKSI & PARSING NASKAH DEKONSTRUKSI (CRITICAL PARSING RULES):
Jika naskah asli di atas menggunakan format dekonstruksi terstruktur (memiliki judul bagian "## 🎙 Voiceover Script"), Anda WAJIB:
1. Cari bagian "## 🎙 Voiceover Script".
2. Ekstrak teks kutipan voiceover (VO) dari bawah sub-judul berikut:
   - "### Scene 1 (8s)" -> Gunakan teks ini sebagai isi dasar voiceover Klip 1.
   - "### Scene 2 (8s)" -> Gunakan teks ini sebagai isi dasar voiceover Klip 3 (geseran dari scene 2 lama).
   - "### Scene 3 (8s)" -> Gunakan teks ini sebagai isi dasar voiceover Klip 4 (geseran dari scene 3 lama).
3. Abaikan bagian lain seperti "## 📋 Storyboard", "## 🤖 T2V Prompts", "## 📸 T2I Prompts", "## 🎥 I2V Prompts", dan "## 📝 Captions" saat mengekstrak naskah voiceover lama, namun Anda wajib mempelajari bagian Storyboard/Visual Prompt pada Klip 1 dan Klip 2 lama untuk memahami:
   - Setting Lokasi/Latar Tempat (Environment): misal kamar tidur, dapur, jalan raya, taman kos-kosan, dsb.
   - Aktor/Karakter & Tangan: apakah ada aktor pria, wanita, tangan yang sedang memegang sesuatu, dsb.
   - Mood Visual & Pencahayaan: sore hari, lampu neon kamar, warm cozy kitchen, dsb.

Jika naskah asli berupa teks biasa tanpa heading "## 🎙 Voiceover Script", potong teks tersebut menjadi 3 bagian/klip secara logis dan pelajari kata kunci visual di dalamnya.

---
ATURAN EMOSI & MERAYUP (STRICT NARRATIVE LAWS):
1. Hook Asli (Klip 1): Wajib pertahankan emosi hook awal.
2. Jembatan Produk (Klip 2): Batasi VO tepat 18-22 kata (durasi 8s) dan hubungkan produk sebagai pemecah masalah (anti-brosur).
3. Transisi Logis (Klip 3 & 4): Sesuaikan transisi Vo agar mengalir mulus dengan CTA ajakan melirik link bio/keranjang kuning.

---
ATURAN GENERASI PROMPT VISUAL KLIP 2 (VISUAL CONTINUITY & PRODUCT TRUTH LAWS):
Anda wajib menghasilkan prompt visual bahasa Inggris `clip2_t2i_prompt` dan `clip2_i2v_prompt` secara dinamis. DILARANG KERAS menggunakan template statis.

1. **ATURAN KONSISTENSI KEMASAN (STRICT PACKAGING LOCK LAWS)**:
   - Anda WAJIB mengunci wujud fisik produk agar persis konsisten dengan foto produk aslinya (tidak boleh berubah warna kemasan, label, bentuk wadah, tulisan teks kemasan, atau tutup wadah).
   - Salin detail dari "Deskripsi Fisik/Visual (Product Truth)" dan "Referensi Prompt Render Foto Asli" ke dalam `clip2_t2i_prompt`.
2. **Aturan Keselarasan Latar (Environment Continuity)**:
   - Klip 2 yang baru harus berlatar di **lokasi yang sama** dengan Klip 1.
3. **Aturan Interaksi & Aksi (Product Interaction vs. Packshot)**:
   - Produk harus berinteraksi aktif (dipegang tangan aktor, dituangkan, dsb.) bukan packshot steril.

---
FORMAT OUTPUT WAJIB (JSON VALID):
{
  "injected_vo_1": "VO Klip 1...",
  "injected_vo_2": "VO Klip 2...",
  "injected_vo_3": "VO Klip 3...",
  "injected_vo_4": "VO Klip 4...",
  "clip2_t2i_prompt": "T2I Prompt (English): ...",
  "clip2_i2v_prompt": "I2V Prompt (English): ..."
}
  `;
}
```

## **4. RANCANGAN ANTARMUKA FRONTEND UI (app/product-bridge-inject/page.js)**

Antarmuka dirancang dengan pendekatan visual *Editor's Workbench* yang intuitif dan modern.

<!-- Skema Struktur JSX Halaman /product-bridge-inject -->
<div class="bridge-injector-container">
    
  <!-- PANEL ATAS: STEP 1 - INPUT FORM (Disembunyikan jika campaign sudah dibuat) -->
  <div class="injector-setup-card card">
    <h2>🎯 Product Bridging Injector</h2>
    <p class="desc">Ubah video viral T2V Anda menjadi mesin konversi dengan menyisipkan produk ke Klip 2 baru.</p>
      
    <form id="injector-form">
      <div class="form-grid">
        <div class="form-group">
          <label>Nama Kampanye Baru:</label>
          <input type="text" placeholder="Contoh: Inject Madu ke Video Diet Viral" required />
        </div>
        <div class="form-group">
          <label>Pilih Metode Sourcing Produk:</label>
          <select id="source_mode" onChange={handleSourceModeChange}>
            <option value="select_existing">Pilih dari Pustaka Produk</option>
            <option value="manual_input">Tulis Manual</option>
            <option value="url_extract">Ekstrak Otomatis via URL Toko</option>
          </select>
        </div>
      </div>

      <!-- KOLOM PENCARIAN REAL-TIME (Hanya tampil jika source_mode === 'select_existing') -->
      <div class="form-group mt-2" id="search-bar-group">
        <label>Cari Produk Terdaftar:</label>
        <input type="text" placeholder="Cari nama produk di pustaka secara real-time..." class="form-input" />
      </div>

      <div class="form-group mt-4">
        <label>Naskah .MD Lama (Format 3 Klip):</label>
        <textarea rows="6" placeholder="[Klip 1] Naskah...\n\n[Klip 2] Naskah...\n\n[Klip 3] Naskah..." required></textarea>
      </div>

      <button type="submit" class="btn btn-primary btn-block">Proses Injeksi Awal</button>
    </form>
  </div>

  <!-- PANEL BAWAH: STEP 2 - WORKBENCH DETAIL KAMPANYE (Interactive Editor) -->
  <div class="injector-workbench-card card mt-6">
    <div class="workbench-header">
      <h3>🛠️ Editor's Workbench: Injector Detail</h3>
      <span class="badge status-waiting">Status: Waiting T2I Render</span>
    </div>

    <!-- GRID REVIEW 4 KLIP BARU -->
    <div class="storyboard-compare-grid">
      <!-- Klip 1 -->
      <div class="clip-card shadow-sm">
        <div class="clip-badge bg-blue-600">KLIP 1: HOOK (ORIGINAL)</div>
        <textarea class="vo-textarea" placeholder="Naskah VO Klip 1..." value={result.injected_vo_1}></textarea>
      </div>

      <!-- Klip 2 (NEW INJECTED PRODUCT) -->
      <div class="clip-card shadow-md border-2 border-emerald-500">
        <div class="clip-badge bg-emerald-600">KLIP 2: PRODUCT INS (NEW)</div>
          
        <!-- T2I Start Frame Preview Box -->
        <div class="t2i-preview-box">
          {result.clip2_t2i_image_path ? (
            <img src={result.clip2_t2i_image_path} alt="Start Frame" />
          ) : (
            <div class="loading-state">
              <Loader2 class="animate-spin text-emerald-500" />
              <span>Generating Start Frame...</span>
            </div>
          )}
        </div>

        <textarea class="vo-textarea mt-2 font-bold" placeholder="Naskah VO Klip 2..." value={result.injected_vo_2}></textarea>
        <input type="text" class="prompt-input" placeholder="Prompt T2I..." value={result.clip2_t2i_prompt} />
        <input type="text" class="prompt-input" placeholder="Prompt I2V..." value={result.clip2_i2v_prompt} />
      </div>

      <!-- Klip 3 -->
      <div class="clip-card shadow-sm">
        <div class="clip-badge bg-purple-600">KLIP 3: CONTINUATION</div>
        <textarea class="vo-textarea" placeholder="Naskah VO Klip 3..." value={result.injected_vo_3}></textarea>
      </div>

      <!-- Klip 4 -->
      <div class="clip-card shadow-sm">
        <div class="clip-badge bg-purple-600">KLIP 4: CTA</div>
        <textarea class="vo-textarea" placeholder="Naskah VO Klip 4..." value={result.injected_vo_4}></textarea>
      </div>  
    </div>

    <!-- PANEL AKSI EKSEKUSI JALAN VIDEO -->
    <div class="execution-action-bar mt-6">
      <div class="progress-info">
        <span>G-Labs I2V Video Status: <strong>{result.video_status || 'Waiting'}</strong></span>
      </div>  
        
      <div class="button-group">
        <button class="btn btn-secondary">Simpan Perubahan Teks</button>
        <button class="btn btn-success flex items-center gap-1.5">
          <Play size={14} /> Generate Video Klip 2 Baru (G-Labs Webhook)
        </button>
      </div>
    </div>

    <!-- OUTPUT DOWNLOAD AREA (Muncul setelah G-Labs selesai) -->
    <div class="download-container bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 mt-6 flex justify-between items-center">
      <div>
        <h4 className="font-bold text-emerald-400">🎉 Klip 2 Baru Berhasil Dirender!</h4>
        <p className="text-[11px] text-slate-400 mt-1">Unduh file video berkualitas HD ini dan sisipkan ke posisi track ke-2 di CapCut.</p>
      </div>
      <a href={result.clip2_video_path} download class="btn btn-primary flex items-center gap-1.5">
        <DownloadCloud size={14} /> Unduh Klip .MP4
      </a>
    </div>

  </div>

</div>

## **5\. PANDUAN EKSEKUSI UNTUK AI AGENT DI ANTIGRAVITY**

Sampaikan instruksi terstruktur ini agar agen Antigravity dapat menulis dan mengimplementasikan modul ini tanpa kesalahan:

1. **Langkah 1 (Database):** Buka berkas lib/db.js dan rekatkan *query* pembuatan tabel bridge\_injector\_campaigns dan bridge\_injector\_outputs dari **Bagian 2**.  
2. **Langkah 2 (Logika AI):** Buka berkas lib/prompts.js dan tambahkan fungsi buildProductBridgingInjectorPrompt dari **Bagian 3** untuk menghasilkan integrasi naskah yang rapi.  
3. **Langkah 3 (Penyelarasan Produk):** Buat Route Handler Next.js baru app/api/v2/bridge-injector/route.js untuk menerima input data kampanye. Manfaatkan fungsi resolveProductData dari recipe-labs Anda untuk menyatukan polymorphic data input.  
4. **Langkah 4 (T2I & G-Labs):** Di dalam api route handler /api/v2/bridge-injector/generate-t2i, tambahkan penanganan pengiriman prompt clip2\_t2i\_prompt ke G-Labs, dan lakukan polling untuk mengunduh gambarnya ke direktori /public/uploads/bridge-injector/.  
5. **Langkah 5 (Frontend):** Buat folder halaman baru app/product-bridge-inject/page.js dan bangun antarmuka pengguna interaktif (React) sesuai dengan desain *mock-up* pada **Bagian 4**.

**EOF (End of Blueprint Document)**