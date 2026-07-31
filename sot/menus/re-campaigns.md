# **BLUEPRINT REVISI TERPADU: RE \+ BRIDGING PROMOSI PRODUK & INTEGRASI BRAND PROFILE (V5.5 \- FULL EDITION)**

Cetak biru ini merupakan dokumen konsolidasi resmi yang menggabungkan seluruh spesifikasi teknis, rancangan UI dinamis, alur data otomatis (*Unified Logic Flow*), dan aturan logika terbaru untuk fitur **Reverse Engineering (RE) \+ Bridging Promosi Produk** pada **MAKNA Engine V5**.

Dokumen ini menyatukan parameter kustomisasi **Jumlah Klip (![][image1])**, penentuan **Titik Transisi (![][image2])**, integrasi wajib **Brand Profile** sebagai penjaga *Tone of Voice*, serta menyediakan 3 opsi fleksibel bagi pengguna untuk menyertakan produk yang akan dipromosikan (pustaka terdaftar, manual instan, atau ekstrak otomatis via URL).

## **1\. PENDAHULUAN & KONSEP INTEGRASI (3 PILAR UTAMA)**

Fitur **RE \+ Bridging** memungkinkan pengguna untuk mengunggah tautan video kompetitor yang viral, mendekonstruksinya, lalu meretrospeksi konten tersebut menjadi video promosi produk baru dalam jumlah klip yang fleksibel.

                                    ┌────────────────────────┐  
                                    │  VIDEO VIRAL KOMPETITOR│  
                                    └───────────┬────────────┘  
                                                │ (Scrape & Deconstruct)  
                                                ▼  
     ┌─────────────────────────────────────────────────────────────────────────────────────┐  
     │ ZONA 1: RETENSI VIRAL (Klip 1 s/d X-1)                                              │  
     │ Fokus penuh meniru emosi, hook, dan gaya video kompetitor agar retensi awal tinggi.  │  
     └──────────────────────────────────────────┬──────────────────────────────────────────┘  
                                                │ (Pivot / Jembatan Halus)  
                                                ▼  
     ┌─────────────────────────────────────────────────────────────────────────────────────┐  
     │ ZONA 2: THE BRIDGE / PIVOT POINT (Klip ke-X)                                        │  
     │ Titik belok narasi. Menghubungkan bahasan viral kompetitor dengan masalah produk.    │  
     └──────────────────────────────────────────┬──────────────────────────────────────────┘  
                                                │ (Konversi Penjualan)  
                                                ▼  
     ┌─────────────────────────────────────────────────────────────────────────────────────┐  
     │ ZONA 3: BRAND CONVERSION (Klip X+1 s/d N)                                           │  
     │ Promosi intensif produk target menggunakan Tone of Voice & aturan Brand Profile.     │  
     └─────────────────────────────────────────────────────────────────────────────────────┘

1. **Viral Hook Retention:** Mempertahankan daya tarik psikologis video kompetitor asli pada awal video (Klip ![][image3] s/d ![][image4]) tanpa menyebutkan produk jualan agar audiens tidak langsung pergi.  
2. **Dynamic Clip Scaling:** AI mendistribusikan ulang atau memecah alur cerita asli menjadi tepat sejumlah ![][image1] klip sesuai dengan jumlah yang diinginkan pengguna.  
3. **Brand-Aligned Promotion:** Setelah transisi terjadi pada klip ke\-![][image2], promosi produk dikemas menggunakan DNA produk serta *Tone of Voice* yang didefinisikan secara ketat pada **Brand Profile** terpilih.

## **2\. MODIFIKASI SKEMA DATA TERPADU (lib/db.js)**

Untuk memastikan semua parameter tersimpan dengan benar dan dapat diaudit secara real-time, skema tabel re\_campaigns diperluas dengan kolom-kolom baru tanpa merusak relasi brand profile yang sudah berjalan.

erDiagram  
    brand\_profiles ||--o{ re\_campaigns : "defines tone for"  
    product\_extractions ||--o{ re\_campaigns : "promoted in"  
    re\_campaigns ||--o{ re\_campaign\_items : "contains"

    re\_campaigns {  
        text id PK  
        text campaign\_name  
        text status  
        text target\_spreadsheet\_id  
        text aspect\_ratio  
        text target\_ai  
        text custom\_instruction  
        text brand\_profile\_id FK "MUST NOT BE NULL \- Menentukan Tone of Voice iklan"  
        integer is\_bridging\_active "0 \= RE Murni, 1 \= RE \+ Bridging Promosi"  
        integer target\_clips\_count "Jumlah total klip yang diinginkan (N)"  
        integer bridge\_at\_clip "Klip ke-X tempat terjadinya transisi promosi"  
        integer bridge\_duration_clips "Durasi bridging produk dalam klip (default: 1)"
        text visual\_style "Gaya visual (Cinematic, UGC, Macrophotography)"
        text bridging\_mode "select\_existing | manual\_input | url\_extract"  
        text target\_product\_id FK "NULLABLE \- Terhubung ke product\_extractions"  
        text ephemeral\_product\_data "Menyimpan data JSON manual atau string URL mentah"  
        datetime created\_at  
    }

### **Script Migrasi SQL:**

\-- Query Migrasi Tabel re\_campaigns (Menambahkan kolom parameter bridging & kustomisasi klip)  
ALTER TABLE re\_campaigns ADD COLUMN is\_bridging_active INTEGER DEFAULT 0; \-- 0: OFF, 1: ON  
ALTER TABLE re\_campaigns ADD COLUMN target\_clips\_count INTEGER DEFAULT 5; \-- Jumlah total klip (N)  
ALTER TABLE re\_campaigns ADD COLUMN bridge\_at\_clip INTEGER DEFAULT 3;      \-- Titik transisi promosi (X)  
ALTER TABLE re\_campaigns ADD COLUMN bridge\_duration_clips INTEGER DEFAULT 1; \-- Durasi bridging produk (default: 1)
ALTER TABLE re\_campaigns ADD COLUMN visual\_style TEXT DEFAULT 'Cinematic';   \-- Gaya visual (Cinematic, UGC, Macrophotography)
ALTER TABLE re\_campaigns ADD COLUMN bridging\_mode TEXT DEFAULT 'select\_existing'; \-- Mode polymorphic  
ALTER TABLE re\_campaigns ADD COLUMN target\_product\_id TEXT NULL;                  \-- FK jika select\_existing  
ALTER TABLE re\_campaigns ADD COLUMN ephemeral\_product\_data TEXT NULL;             \-- JSON data manual / URL string
ALTER TABLE re\_campaigns ADD COLUMN sync\_mode TEXT DEFAULT 'auto';                 \-- Mode sinkronisasi (V2.10)
ALTER TABLE re\_campaigns ADD COLUMN webhook\_t2i\_pattern TEXT DEFAULT 'threading';  \-- Pola T2I (threading vs sequential)

\-- Query Migrasi Tabel re\_campaign\_items (Menambahkan kolom progres regenerasi start frame)
ALTER TABLE re\_campaign\_items ADD COLUMN regenerate\_start\_frames\_status TEXT DEFAULT NULL;
ALTER TABLE re\_campaign\_items ADD COLUMN regenerate\_start\_frames\_progress TEXT DEFAULT NULL;

## **3\. RANCANGAN ANTARMUKA (UI/UX DI HALAMAN RE CAMPAIGN)**

Berikut adalah mock-up antarmuka pengguna pada halaman /re-campaigns yang mengintegrasikan pengaturan **Jumlah Klip (![][image1])**, **Titik Transisi (![][image2])**, serta 3 opsi input produk secara visual dan kondisional:

\===================================================================  
FORM PEMBUATAN KAMPANYE RE \+ BRIDGING BARU  
\===================================================================

\[ BAGIAN 1: INFORMASI DASAR KAMPANYE \]  
───────────────────────────────────────────────────────────────────  
\* Nama Kampanye : \[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\]  
\* Brand Profile : \[ Pilih Brand Profile...                      | v \] (Wajib)  
\* Target AI     : (o) Veo 3.1 Lite (8s)     ( ) Kling     ( ) Luma  
\* Aspect Ratio  : (o) 9:16 Vertical         ( ) 16:9 Horizontal
\* Visual Style  : \[ Cinematic | UGC | Macrophotography         | v \]

\[ BAGIAN 2: PENGATURAN STRUKTUR KLIP (FITUR BARU) \]  
───────────────────────────────────────────────────────────────────  
\* Jumlah Klip Video (N) : \[ 5 \] (Input angka, rentang: 3 \- 10\)  
  Custom Instruction    : \[ Tulis instruksi tambahan jika ada...  \] (Textarea)

\[ BAGIAN 3: KONFIGURASI BRIDGING PROMOSI (KONDISIONAL) \]  
───────────────────────────────────────────────────────────────────  
\[X\] Aktifkan Bridging Promosi Produk (Toggle ON)

 ├─► \* Sisipkan Transisi Promosi pada Klip Ke- (X): \[ 3 \] (Input angka, syarat: 1 \< X \<= N)  
 ├─► \* Durasi Bridging Produk (Klip)              : \[ 1 Klip \] (Dropdown, default: 1)
 └─► \* Metode Penyertaan Produk:  
     (o) Pilih dari Pustaka      ( ) Tulis Manual      ( ) Ekstrak dari URL  
      │                           │                     │  
      ▼ (Tampilkan Dropdown)      ▼ (Tampilkan Form)    ▼ (Tampilkan Textbox)  
     ┌──────────────────────┐    ┌─────────────────┐   ┌────────────────────────┐  
     │ Dropdown Pilih       │    │ \* Nama Produk   │   │ Tempel URL Produk      │  
     │ Produk Terdaftar...  │    │ \* Deskripsi     │   │ \[https://shopee...   \] │  
     │                      │    │ \* USP (Kunci)   │   │                        │  
     └──────────────────────┘    └─────────────────┘   └────────────────────────┘

### **Penjelasan Fungsional UI:**

* **Validasi Jumlah Klip (![][image1]) & Titik Transisi (![][image2]):** Nilai input ![][image2] secara dinamis divalidasi oleh JavaScript di sisi klien agar tidak boleh melebihi nilai ![][image1]. Jika pengguna mencoba mengeset ![][image5], sistem akan menampilkan pesan peringatan dan mengembalikan nilai ![][image2] ke default (![][image6]).

## **4\. LOGIKA BACKEND OTOMATIS (UNIFIED LOGIC FLOW)**

Fungsi **"Penyelaras Data Produk" (Product Data Resolver)** di bawah ini menjamin bahwa apa pun metode input produk yang dipilih oleh pengguna di antarmuka, output yang dilemparkan ke prompt AI selalu berupa objek data produk yang seragam.

         \[Scheduler Membaca Pekerjaan Antrean Kampanye RE \+ Bridging\]  
                                      │  
                                      ▼  
                      \[Periksa nilai \`bridging\_mode\`\]  
                                      │  
         ┌────────────────────────────┼────────────────────────────┐  
         ▼ (select\_existing)          ▼ (manual\_input)             ▼ (url\_extract)  
\[Ambil baris data dari\]       \[Parse JSON teks dari\]       \[Panggil Scraper & Stage 1 Agent\]  
\[tabel product\_extractions\]   \[\`ephemeral\_product\_data\`\]   \[Simpan hasil ke DB, gunakan\]  
\[berdasarkan target\_product\_id\]                            \[objek data baru tersebut\]  
         │                            │                            │  
         └────────────────────────────┼────────────────────────────┘  
                                      │  
                                      ▼  
                        \[Dihasilkan: OBJEK DNA PRODUK\]  
             Format: { product\_name, product\_description, unique\_selling\_point }  
                                      │  
                                      ▼  
        \[Suapkan langsung ke: buildReverseEngineeringBridgePrompt()\]

### **A. Pengaturan Pola Generasi T2I (Threading vs Sequential)**
Sistem mendukung dua pola pengiriman gambar T2I awal ke G-Labs:
1. **Threading (Kirim Serentak, Jeda Aman, Pantau Bersama)**: Mengirimkan seluruh prompt adegan ke webhook G-Labs secara sekuensial dengan jeda acak 10-20 detik antar adegan, lalu memantau polling secara paralel.
2. **Sequential (Kirim, Pantau, Jeda)**: Mengirimkan satu adegan, memantau polling hingga selesai (`completed`) dan terunduh, memberikan jeda aman acak 10-20 detik, baru memproses adegan berikutnya.
* **Safety Cooldown**: Jeda pengiriman prompt diseragamkan ke batas aman acak `10.000 ms` hingga `20.000 ms` untuk kedua pola guna menghindari rate limit/penolakan dari Google Cloud Flow.

### **B. Mekanisme Fallback Otomatis T2I (Transparent Quota Fallback Interceptor)**
Untuk menjaga kelancaran alur otomatisasi ketika model utama `nano_banana_pro` mengalami limitasi kuota harian (`Daily image quota exhausted`), sistem dilengkapi interceptor transparan di dalam `lib/webhook-client.js`:
- **Fase Submission**: Jika pengajuan ke `nano_banana_pro` mengembalikan error HTTP 429 atau pesan quota limit, client otomatis mengajukan ulang perintah tersebut menggunakan model fallback `nano_banana_2`.
- **Fase Polling**: Jika status tugas `nano_banana_pro` dilaporkan `failed` karena quota limit saat polling status, sistem mengambil parameter asli dari `taskParamsMap`, meluncurkan tugas baru menggunakan `nano_banana_2`, dan mendaftarkan pemetaannya ke `taskMapRedirects`.
- Polling status berikutnya untuk ID tugas lama secara dinamis dialihkan ke ID tugas fallback baru secara transparan, menjaga agar scheduler/caller tidak menyadari adanya perubahan dan terhindar dari crash alur produksi.

### **Kode Implementasi Resolver (api/production/route.js atau lib/scheduler-processors.js):**

import db from '../../lib/db';  
import { scrapeUrl } from '../../lib/url-scraper';  
import { runProductAgentStage1 } from '../../lib/gemini'; // Stage 1 Agent call

/\*\*  
 \* Otomatis menyelesaikan input produk dari berbagai sumber menjadi satu format seragam.  
 \* Menghilangkan kompleksitas percabangan pada script generator utama.  
 \* \* @param {Object} campaignRow \- Data baris kampanye dari SQLite (re\_campaigns)  
 \* @returns {Promise\<Object\>} DNA Produk { product\_name, product\_description, unique\_selling\_point }  
 \*/  
export async function resolveProductData(campaignRow) {  
  const { bridging\_mode, target\_product\_id, ephemeral\_product\_data } \= campaignRow;

  // MODE A: Memilih dari pustaka produk terdaftar  
  if (bridging\_mode \=== 'select\_existing') {  
    const product \= db.prepare('SELECT \* FROM product\_extractions WHERE id \= ?').get(target\_product\_id);  
    if (\!product) {  
      throw new Error(\`Produk dengan ID ${target\_product\_id} tidak ditemukan di database.\`);  
    }  
      
    return {  
      product\_name: product.product\_name,  
      product\_description: product.product\_description,  
      unique\_selling\_point: typeof product.unique\_selling\_point \=== 'string'   
        ? JSON.parse(product.unique\_selling\_point)   
        : product.unique\_selling\_point  
    };  
  }

  // MODE B: Input detail manual instan  
  if (bridging\_mode \=== 'manual\_input') {  
    const manualData \= JSON.parse(ephemeral\_product\_data);  
    return {  
      product\_name: manualData.product\_name,  
      product\_description: manualData.product\_description,  
      unique\_selling\_point: manualData.unique\_selling\_point || manualData.usp  
    };  
  }

  // MODE C: Tempel URL \-\> Scraping & Ekstraksi AI Otomatis (Stage 1 Terintegrasi)  
  if (bridging\_mode \=== 'url\_extract') {  
    const targetUrl \= ephemeral\_product\_data;  
      
    // 1\. Scraping isi HTML web produk  
    const rawHtmlText \= await scrapeUrl(targetUrl);  
      
    // 2\. Minta Gemini mengekstrak teks menjadi DNA Produk komersial  
    const extractedData \= await runProductAgentStage1(rawHtmlText, targetUrl);  
      
    // 3\. Simpan permanen ke pustaka agar terekam dalam audit trail & dapat digunakan kembali  
    const newProductId \= \`pe\_${Date.now()}\`;  
    db.prepare(\`  
      INSERT INTO product\_extractions (id, input\_source, is\_url, product\_name, product\_description, unique\_selling\_point, raw\_response)  
      VALUES (?, ?, 1, ?, ?, ?, ?)  
    \`).run(  
      newProductId,   
      targetUrl,   
      extractedData.product\_name,   
      extractedData.product\_description,   
      JSON.stringify(extractedData.unique\_selling\_point),  
      JSON.stringify(extractedData)  
    );

    // 4\. Perbarui data kampanye agar merujuk ke ID produk baru yang sudah tersimpan  
    db.prepare('UPDATE re\_campaigns SET bridging\_mode \= "select\_existing", target\_product\_id \= ? WHERE id \= ?')  
      .run(newProductId, campaignRow.id);

    return {  
      product\_name: extractedData.product\_name,  
      product\_description: extractedData.product\_description,  
      unique\_selling\_point: extractedData.unique\_selling\_point  
    };  
  }

  throw new Error("Metode bridging tidak dikenal atau tidak didukung.");  
}

## **5\. REKAYASA PROMPT SISTEM UNTUK GEMINI (lib/prompts.js)**

Fungsi generator prompt di bawah mengintegrasikan seluruh variabel kampanye, profil brand pembatasan bahasa, detail produk hasil penyelarasan, serta instruksi pembagian zona klip yang ketat:

/\*\*  
 \* Membangun prompt sistem untuk RE \+ Bridging Promosi Produk  
 \* @param {Object} videoData \- Data dekonstruksi video viral asli  
 \* @param {Object} brandProfile \- Aturan gaya bahasa, larangan, dan persona brand  
 \* @param {Object} productData \- Data DNA ekstraksi produk (USP, Deskripsi)  
 \* @param {number} targetClips \- Total klip yang diinginkan (N)  
 \* @param {number} bridgeAtClip \- Indeks klip tempat promosi dimulai (X)  
 \*/  
function buildReverseEngineeringBridgePrompt(videoData, brandProfile, productData, targetClips, bridgeAtClip) {  
  return \`  
Anda adalah Prompt Engineer & Copywriter Iklan Video Pendek kelas dunia untuk MAKNA Engine V5.  
Tugas Anda adalah merancang skrip voiceover dan storyboard visual sebanyak tepat ${targetClips} klip dengan melakukan rekonstruksi kreatif dari video viral kompetitor yang diberikan, serta melakukan 'bridging' promosi produk target pada klip ke-${bridgeAtClip}.

\---  
1\. SPESIFIKASI DAN ATURAN STRUKTUR (MANDATORY)  
\- Total Klip Output: Tepat ${targetClips} klip (tidak boleh kurang, tidak boleh lebih).  
\- Titik Transisi Promosi (Pivot Point): Klip ke-${bridgeAtClip}.  
\- Aturan Penjagaan Gaya Bahasa (Brand Profile):  
  \* Nama Brand/Profil: "${brandProfile.name}"  
  \* Tone of Voice: "${brandProfile.tone\_of\_voice}"  
  \* Kata Terlarang: \[${brandProfile.forbidden\_words || 'Tidak ada'}\]  
\- Data Produk Target yang akan diiklankan:  
  \* Nama Produk: "${productData.product\_name}"  
  \* Deskripsi: "${productData.product\_description}"  
  \* Unique Selling Point (USP): "${productData.unique\_selling\_point}"

\---  
2\. DETAIL ATURAN PER ZONA SEGMENTASI

\[ZONA 1: RETENSI VIRAL\] (Klip 1 hingga Klip ${bridgeAtClip \- 1})  
\- Fokus 100% pada adaptasi hook dan alur cerita dari video viral kompetitor.  
\- JANGAN sebutkan nama produk, brand, atau melakukan jualan di zona ini demi menjaga retensi penonton di detik-detik awal.  
\- Gunakan emosi, intonasi, atau pembuka kontroversial dari kompetitor asli.

\[ZONA 2: THE BRIDGE / PIVOT POINT\] (Klip ke-${bridgeAtClip})  
\- Tulis narasi peralihan psikologis (cognitive bridge) yang sangat halus namun tak terhindarkan.  
\- Hubungkan topik viral di Zona 1 dengan masalah nyata yang diselesaikan oleh produk target.  
\- Gunakan transisi visual yang kontras atau gerakan kamera dinamis (seperti zooming/pan cepat) untuk mengalihkan pandangan penonton ke arah objek produk.

\[ZONA 3: BRAND CONVERSION\] (Klip ${bridgeAtClip \+ 1} hingga Klip ${targetClips})  
\- Narasi beralih sepenuhnya ke promosi komersial produk target.  
\- Menonjolkan USP produk dengan mematuhi aturan "Tone of Voice" dari Brand Profile: "${brandProfile.tone\_of\_voice}" serta menghindari kata-kata terlarangnya.  
\- Akhiri klip terakhir dengan Call to Action (CTA) yang tajam sesuai karakter Brand Profile Anda.

\---  
3\. REGULASI AUDIO DAN VISUAL (MANDATE LOCK)  
\- Visual wajib berupa cinematic photorealistic (Sesuai Mandate 50 & 51). Hindari animasi, kartun, atau 3D render murahan.  
\- Sesuai Mandate 71 (Pacing Audio-Physics), batasi jumlah kata per klip agar sinkron dengan durasi video 8 detik:  
  \* Klip Retensi & Bridge: 18-22 kata per klip.  
  \* Klip Konversi Brand: 22-25 kata per klip.  
\- Tulis visual prompt dalam bentuk deskripsi linear satu baris (Plain Text format) tanpa menyertakan enter/newline (\\\\n) dan BEBAS dari tag 'NEGATIVE PROMPT'.  
\- Format output wajib berupa JSON terstruktur yang valid agar dapat diparsing langsung oleh sistem.  
  \`;  
}

## **6\. REGULASI INTERNAL TAMBAHAN (MANDATE LOG EXTENSION)**

* **Mandate 76 (Brand Tone Integrity):** AI dilarang keras melanggar batasan komunikasi, batasan kata terlarang, atau gaya bahasa dari Brand Profile terpilih saat menulis naskah jualan di Zona 3\. Pelanggaran terhadap *tone of voice* akan ditandai sebagai kegagalan audit generasi.  
* **Mandate 96 (Symmetrical Scaling Rule):** Jika pengguna meminta jumlah klip yang besar (misalnya ![][image7]), AI harus mampu memecah dekonstruksi video viral asli menjadi segmen-segmen adegan mikro yang logis di Zona 1, bukan memperpanjang naskah di satu adegan tunggal yang membuat pacing audio terasa lambat dan membosankan.

## **7\. SKENARIO AUDIT & VERIFIKASI PEMELIHARAAN (QA TEST)**

Saat tim pengembang melakukan uji coba fungsionalitas baru pada tab **Audit** di halaman UI:

1. **Verifikasi Jumlah Klip:** Pastikan jumlah objek klip dalam array JSON hasil generasi tepat sama dengan nilai ![][image1] yang diinput pengguna pada form.  
2. **Verifikasi Titik Transisi (![][image2]):** Periksa teks audio pada klip ke\-![][image2]. Harus ada kalimat transisi transisi seperti: *"...tapi sebenarnya..."*, *"...berbeda dengan..."*, atau *"...untungnya sekarang ada..."*.  
3. **Verifikasi Brand Alignment:** Periksa apakah kata-kata terlarang (*forbidden words*) dari Brand Profile yang aktif bocor ke dalam naskah iklan di klip ![][image2] hingga ![][image1].  
4. **Verifikasi Kebersihan Prompt:** Pastikan prompt visual terbebas dari format enter (\\n) dan bebas dari keyword negatif sesuai standar hygiene MAKNA Engine V5.

## **8\. HUMAN-IN-THE-LOOP & VIDEO DNA REVIEW WORKFLOW (V2.0 - NEW)**

Alur kerja Reverse Engineering (RE) Campaign ditingkatkan pada V2 menjadi sistem **3-Fase Terintegrasi** dengan dukungan penuh pengeditan langsung serta pencatatan terstandarisasi untuk metrik Video DNA.

### **Alur Kerja 3-Fase:**
1. **Fase 1: Discovery (Otomatis)**:
   - Scraper mengunduh video kompetitor.
   - Modul `processReAnalyzer` memicu Gemini untuk merumuskan Dekonstruksi Asli, Rencana Video Baru, dan Video DNA.
   - Mesin secara otomatis mengirim task T2I ke G-Labs untuk merender seluruh gambar start-frame produk (jika menggunakan mode `hybrid_lock`) dan mengunduhnya ke folder lokal `/uploads/start_frames/`.
   - Hasil JSON disimpan ke kolom `original_deconstruction_json`, `new_video_plan_json`, dan `video_dna_json`, dan kolom status `workflow_status` diset ke `'ready_for_review'`.
   - Kampanye scheduler menjeda (*pause*) otomatis eksekusi item ini pada tahap ini.

2. **Fase 2: Review & Edit (Manusia)**:
   - Halaman detail UI menampilkan antarmuka **Workbench Editor** yang mengunci polling otomatis agar input pengguna tidak tertimpa.
   - Pengguna dapat melihat detail perbandingan transkrip/visual kompetitor asli lewat modal pop-up **"Lihat Dekonstruksi Asli"**.
   - Pengguna dapat mengedit langsung Voiceover (VO), prompt visual T2I, dan prompt gerak I2V/T2V di dalam **Storyboard Card Grid**.
   - Pengguna dapat meregenerasi gambar T2I per klip secara asinkron menggunakan tombol **"🔄 Regenerate T2I"**.
   - Pengguna dapat memperbarui 10 parameter **Video DNA** melalui input dan select dropdown premium.
   - Pengguna dapat mengatur pipa produksi yang ingin dijalankan (TTS, Video, FFmpeg) menggunakan tombol switch/slider.
   - Klik tombol utama **"🚀 Approve & Proceed to Production"** untuk menyimpan editan dan mengubah `workflow_status` ke `'production_processing'`.

3. **Fase 3: Production (Otomatis)**:
   - Scheduler mendeteksi perubahan status dan melanjutkan pemrosesan sisa pipa (audio TTS, video G-Labs I2V menggunakan start-frame yang sudah diunduh, dan FFmpeg muxing).
   - Setelah selesai, status item diubah menjadi `'completed'`.

### **Aset Unggahan Dinamis (Bypass Cache)**
- Untuk menyajikan file hasil unduhan secara real-time di lingkungan produksi tanpa tertahan cache statis Next.js, sistem menggunakan dynamic API routes:
  - `/uploads/start_frames/[filename]` untuk gambar start frame.
  - `/uploads/recipes/[filename]` untuk file resep.

### **Fitur Sinkronisasi & Automasi Lanjutan (V3.0)**
* **Autopilot Google Sheets Alignment**: Menyelaraskan status campaign, asset URL, dan data logs ke Google Sheet target (`CAMPAIGN_RE` dan tab singular storyboard, voiceover, prompts, captions dengan pemformatan tebal & baris beku).
* **Nextcloud Asset Auto-Upload**: Setelah proses FFmpeg render selesai, video final, naskah.md, video klip individual, dan audio klip per adegan otomatis diunggah ke Nextcloud (`/MAKNA_Assets/MAKNA_Production_Final`).
* **Mitigasi Aksi Retry & Reset**: Tombol **🔄 Retry** dan **💥 Reset** pada baris adegan yang gagal (failed) mengaktifkan reset data per-item di database dan mengeset status kampanye ke `'running'` secara otomatis untuk memicu resume instan.
* **Pencegahan Race Condition**: Operasi regenerasi T2I paralel dilindungi oleh transaksi SQLite (`db.transaction()`) yang menjamin tidak adanya tabrakan penulisan database (overwrite).

### **Metrik Video DNA (10 Parameter):**
* `pilar_konten`: Kategori konten/resep (e.g. Minuman Sehat, Makanan Cepat, Diet).
* `hook_type`: Tipe hook pembuka (e.g. Pertanyaan, Mitos, Hasil Akhir).
* `visual_style`: Gaya presentasi visual (e.g. Faceless, Macro, Food Porn).
* `signature_moment`: Adegan paling estetik/ASMR (e.g. Madu menetes, Smoothie pusaran).
* `camera_pace`: Kecepatan pergerakan kamera (e.g. Static, Dynamic Tracking, Fast Cuts).
* `primary_emotion`: Mood dominan (e.g. Menggugah Selera, Segar, Santai).
* `affiliate_integration`: Cara menyisipkan produk (e.g. Natural Usage, Background, Problem Solver).
* `affiliate_mention`: Metode penyebutan afiliasi (e.g. Voice Over, Visual Only, Both).
* `scene_count`: Jumlah scene/klip total (e.g. 5).
* `cta_type`: Tindakan ajakan interaksi (e.g. Save Recipe, Share to Friend, Buy Now).

**EOF (End of Blueprint Document)**

*Cetak biru terintegrasi ini menjadi acuan mutlak tim pengembang untuk rilis produksi fitur RE \+ Bridging pada MAKNA Engine V5.*

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABB0lEQVR4Xu2SPQrCQBCF408jiF26/LPYWNh4A2/gNSy8hI14B7GysLGwsBDtPYKNJzCiCApi0De4C5txk8ZKyAdDdt97TGaXtayCn/B9f4K6ol5UnudNDZlE+TLT5ZkUeph7BPSt4ziC6yZKCK9QC9mwxwNZP/kCYw9c1+3QOms6aE+uGUEw1tZnaiaEaCgtiqJmEAQjtc9Fn4TuRU631/yZbdt1tc+D7mupC/yopmMb0e9L12TDMe3xfeh+JgieuEao6dC4he+Q+0ayjgB9LRsecI817puoIrzhoqSspuOGiQqCRxxjxw0F/BvqzvUUeDNzhC6o2P+8q4RniDAM2/D6XC8o+GveBoJOcgwgL1UAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA8UlEQVR4XmNgGAUUAXl5+Wgg/gnE/5HwGyT5X2hyt5H1YwWKiopuUMVPkcXFxcW5gWL/pKSkuJDFCQKY7ehiyHyigYKCwkqogc0gPtQgZjRlRANGmOuA+BvQcAF0BSQBoCG/QYYBDbJHlyMZyMnJnYS67B66HEkAaMAsoGHlMK+iyxMNgJqzgXgJiA2LCJDB6OoIAqAmF6Dm00hC8IhAEiMMgIlVHajpBbq4PDTlA10pgS6HAbS0tNiALpoP0gBio8sDxYuhrnuGLocCgLbdAir6AMRvgfgjEH9Flgfy30HFQfIg9megnkpkNaNgFAxZAAAE/08m4M643wAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAAdElEQVR4XmNgGLqAGV0AGTDLy8vXAPF/IM5ClwQDoMQNIF4nKyvrh1chMhhCCnPQxTEASKGcnFwuujgGgCrMQxfHACCFCgoKBejiGACqsBBdHAVISUmJQD3Tgy4HBkCJ1UD8GoifAPFjKP0SiH+hqx0FlAEAbf4mssC/SGQAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAaCAYAAAD8K6+QAAABYklEQVR4Xu2WvUrEUBCFVwQLbewigfxspQRLexux9AV8BEsLsfYtbLax8VHEN1CwkfVv3UURFRXUMzCR8YhJMJBrMR8M3HvmzmQmw95sr+c4TmdkWbYJe4F9GLs1/lfyndr4rsjzfAnPvma9ln6/v66FD60eRdEctPc4jmet3gVa08i81Bs+04gyAWt2H4pWjWHch5pgT/ba1DQdC0KrxsBUOTXYExqd5wOhaNuYJHiTJGhqlX0had1YmqZHmuSMfSHRmkasNwKB+2hsR5P86dJIkmSlqXFsFVrTmPVaELQFO5B1eYlIk3yuDhS80dQ4tgptbMJ6JWhgDUHHRvq6RIwWFK3njvVfwUdwEQFXrGf6jwPTW2BfCLSxe9Z/UBTFDCY1kABZsx/6tia7YF8ItJZn1r+BKZzIWGFjeQuwR+vHfqK6+GX9gJhde6YL8Dtc1ucPYedql1IPn3Ucx3Ec55/yCZbvhpg2HTKaAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAaCAYAAADovjFxAAACTUlEQVR4Xu2WT0sbYRDGI5VC68VLmxJCNpukLeRQvBZBEYoKCh49+AUKohcpxbM9tF+hFxGE0osIngRPXkSKJwtFBfFiqWBrQlBQwfYZnZXhyb/dTdAe3h8M2Z1nZjI7u/vum0g4HA5HHTzPm4Cdw/4aOzb6BWl7Nv+ukd5sPzX0fep3h2Pq4vv+oCYdWn8ymeyC7yqVSj22/vskk8kso6ct7fc166AT/h/sDEUwPfbZ8zAgx2dfO5GeisXiQ+33gnUMaQr+EfaHIpvNftXCc3KuA3hAYU1BnbeSi2ZGWWsHqF3W30vtsZP0X/Y8Kh06BLEzXEw3B0QB+eNaa5K1uOC1fYV6M3KMIfdKffzPuo3RwcQnmC4K97MWFzTepzU/sRYV1FlKmKczuGkmRHwb9jwymO6mFt5nrVUwjJfezdfmC2th4QvGYD9qv9dPh7yKssjbmEig0GcM4X2t6baTfD7/FPVL+K9V1prh6XpAvtt+8XvEemiQPAlblONggZSBcFw7SKfTj1D/ALbNWiPQVw9y3rEfvu/SL+o+j33zcLFvkPzNuG4XSONrmUKh8AQ1T2BrrIUBeSsJ+hIIupeRfsu8SIZC39OqT4qnO0UUfcZaVHK53Auph1oLrEWh0U2BdqWDGGCtLrLZwBMwL4lyzDr8M1r0J2thCb4KsA+sRQW9TusQOlgTMODhRkOqAgm7SCjBfsPKsFOr4/yP+kWX4wpyZm1MIxA7Jg3JSs1aDGQLXNE+xGT/MsRBgvTLvnvDi7tldTgcDofD4fgP+AfF37pQ4a/92wAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAAAaCAYAAADmF08eAAACfUlEQVR4Xu2WT0tUURjGR5JMhCAEZzH//0Q5QQSCIJHgJgUXLSSqdZsschN9h9ZBtfIrRNA3UMSNrkrEjUULKTRBgqgE7XmGc4e3Z869SnMPTDE/ONw5z/uc95z33Lnn3kymx39MsVi8XS6X77l2B/0r6glBpVIZVy2JUqk0h/XdjdZar9cH1JMIEhyjjbJh8ktIcF49IcB8O6olUSgUaijwMteJ3zdwfaSeRFioago8e25Dms0T37ZxtC31WBB/iH/OmNWq1WoR+kc3/l3ShuOGZEshCiVY2Bt4191CJjQO+qFvquhD50R/Dm3V9D/Qgzt4y/oighZKX6PROOsK/aVxbMRj6LOqe+iDb9kKzMmzQrW4tYUu9MBdD92Yfol/tv044FtEURdEaysK/V2nj1qdBCsUia/C94S/scjrHIO/1ZL1nCYP8fmQa54nqtXg+0mv71kNVig8r3E5Y/rcab0DrWcsjlqtNoKNeqW6D98cESEL/cOD3X/mFtK8y+g/wOQ3rccH/Guq+YDvBfPzdacxErLQ5vMpWmvHcf2icR+nmSuXyw27ImM/KIIUirt1DZ6nqkN7z7H5fP7iSTkIPFN8FlUXeCIf4y9e0IAlSKGIv83ICUuy2ewQx6Id6MHkgz7VFOZjXtO/zy8i6yGhCo2NI3bkip3SmALPvmoWxH9k2l9ZG7YfkXqhOCEXXLxPYwR3ciZpfAQ/JvhaUj0CsU9uw9qaekmahfJz7hvavmvfUdS0mghiX1VTYuZoocXZpl6SZqGpgjlWVOuEriwU+V/qJ1+ndGuhqefvukLxjh1E/ueqd8pfFYpBk6qlhe+DPC1wOJ5TrUePHv8WvwE8MdwIKUd6AgAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAaCAYAAADi4p8jAAACH0lEQVR4Xu2VvUoDURCFk2gjiF1AIcnmDxsVUQQfQLCJIGihYBcQhRSWNgqKFopiGbQRKwsbCwUR0cZK38BGfADjD0IESdAz5K5cTxKym00wxf1g2N05M3dn5uZufD6DwdAyWJZ1CPuAfYtFIpGjCjFFW1cxYxzTbNS7N2Bp2Fw0Gp2FzYglEokwx5ehN8CaAP9NKBRKsr8SiD2FvcJ6WKuHeDwe0etjE51zGD8CL6xSYZI0xQHiZ18tkJO1Srs/xJobkJ+B7ck6aKY3HA4n8CuKw5axgwccXwYCl5A0Ivf2VDgGvgL7nILcVbVuijUnoL5L9oF2rJdnZ0UQmNPu36SYZDLZZftkapjUtv1cLyh0XtbGWgusucXVwPUdk3Ompv2g6cfBYLDTfvYKGp1Q71hhzQnIy2JI6+yvhpy/M92hXv7btH7fKFDgoqyLo9HPWi1c1aOfP92nmtyRZ1y/dN0LaGxN1o7FYuOsOQG5u64aRPAL+wR7F9FsH66brLtFvnZYp4AjMMCaG6QmrHXP/qpUmwb8V6rJRxTVwbpTkH8Oe0dR3azVg2pwi/3VkE/tNTsVAXsXWXCCTBm5T16Gw2DNSalHjhBrlWhD8DOC71iwgZ6HfbK/Fsi5xcXPfq+g1n019DRrf8AkTuRnA8tZpf+9IscI+BAMQsuw/79ALdOqwWHWDI0EE045NYQHOL/lwREYdWq+JpxVg8FgMHjhB2Mjpn/WxSGoAAAAAElFTkSuQmCC>