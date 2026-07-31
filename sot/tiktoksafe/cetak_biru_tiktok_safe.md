Saya telah meninjau kode alat Herbal Compliance Checker yang Anda buat dan mempelajari kebijakan ketat TikTok Shop mengenai misinformasi medis. Saya paham betul bagaimana fitur ini bisa masuk ke dalam alur kerja (workflow) aplikasi MAKNA Anda.  
Alat yang Anda bangun adalah sebuah **Gerbang Quality Control (QC) yang brilian**. Alat ini menggunakan Gemini untuk menganalisis naskah dan mendeteksi potensi pelanggaran (seperti klaim mutlak, nama penyakit, atau tidak adanya *disclaimer*) *sebelum* video benar-benar diproduksi.  
Untuk menjawab pertanyaan utama Anda: **Logika prompt compliance ini paling baik dieksekusi SETELAH naskah utama selesai dibuat (bertindak sebagai "Loop Revisi & Keamanan Otomatis"), bukan dipaksakan masuk ke dalam prompt kreatif utama.**  
Berikut adalah analisis strategis dan cetak biru untuk mengintegrasikannya ke dalam MAKNA Web App.

### **Mengapa Harus Menjadi Tahap Terpisah (Loop Revisi)?**

Jika Anda memaksa Gemini untuk menjadi sangat kreatif (misal: "Tulis naskah yang emosional, viral, dan menjual tentang produk herbal") *sekaligus* menjadi sangat membatasi (misal: "Tapi jangan gunakan 50 kata ini, jangan buat klaim sembuh, format harus kaku") di dalam satu prompt yang sama, **AI akan mengalami "Prompt Constriction" (Penyempitan Prompt).** AI biasanya akan menghasilkan naskah yang memang aman, tapi sangat membosankan dan kaku layaknya robot, sehingga elemen viral yang Anda bangun di MAKNA Engine menjadi hilang.  
Alur kerja terbaik dalam *Generative AI* adalah:

1. **Tahap Penciptaan (Creator):** Biarkan agen AI pertama menulis naskah yang paling menarik, viral, dan mengonversi tinggi berdasarkan kerangka psikologis yang sudah Anda buat (Mode B / Realist Viral).  
2. **Tahap Sanitasi (Compliance Lawyer):** Kirim draf naskah viral tersebut ke agen AI *kedua* (Alat Compliance Anda). Agen ini akan mengaudit naskah tanpa ampun dan menulis ulang HANYA bagian-bagian yang berbahaya. Hasilnya, naskah tetap memiliki energi *hook* yang kuat, tapi bebas dari risiko pelanggaran (banned).

### **Cetak Biru: Integrasi Compliance Checker ke MAKNA**

Berikut adalah cara Anda dapat mengintegrasikan fitur ini ke dalam MAKNA Web App, khususnya di **Fase 2: Grid Review & Edit (Frontend UI)** atau dalam alur kerja **Sheets Autopilot**.

#### **1\. Pembaruan Skema Database (lib/db.js)**

Tambahkan beberapa kolom untuk menyimpan status kepatuhan (compliance) agar Anda tahu naskah mana yang sudah aman untuk TikTok.

SQL  
\-- Tambahkan ke tabel re\_campaign\_items atau sheets\_jobs  
ALTER TABLE re\_campaign\_items ADD COLUMN compliance\_status TEXT DEFAULT 'pending';   
\-- Status: 'pending', 'pass', 'revise', 'reject'  
ALTER TABLE re\_campaign\_items ADD COLUMN compliance\_log\_json TEXT;   
\-- Menyimpan detail isu (blockers/warnings) dan hook\_analysis  
ALTER TABLE re\_campaign\_items ADD COLUMN tiktok\_safe\_voiceover TEXT;   
\-- Menyimpan naskah yang sudah direvisi dan dibersihkan oleh AI Compliance

#### **2\. Membuat Core Service Compliance (lib/core/TikTokComplianceService.js)**

Buat layanan *backend* khusus untuk menangani logika ini. Kita akan memindahkan *System Prompt* yang panjang dari kode React (Frontend) Anda ke *Backend* agar lebih aman dan terpusat.

JavaScript  
import { GeminiRouterService } from './GeminiRouterService'; // Menggunakan router rotasi key MAKNA

export class TikTokComplianceService {  
  static SYSTEM\_PROMPT \= \`  
    Anda adalah "Herbal-Compliance", QC compliance checker khusus untuk konten TikTok Shop niche herbal/kesehatan.  
    Tugas Anda adalah memeriksa input script video, caption, dll, dan memberikan analisis berdasarkan 4 lapis pemeriksaan...  
    \[... MASUKKAN SYSTEM PROMPT DARI KODE REACT ANDA DI SINI ...\]  
  \`;

  static async auditScript(originalScript, originalCaption) {  
    const userPrompt \= \`  
      Tolong analisis draft konten ini:  
      SCRIPT VIDEO: ${originalScript || '-'}  
      CAPTION: ${originalCaption || '-'}  
    \`;

    try {  
      // Memanggil Gemini API menggunakan layanan internal MAKNA dengan format JSON Schema  
      const responseText \= await GeminiRouterService.callWithSchema(  
        'gemini-2.5-flash',   
        this.SYSTEM\_PROMPT,   
        userPrompt,   
        this.getJsonSchema() // Skema JSON wajib sama persis dengan yang ada di React Anda  
      );

      return JSON.parse(responseText);  
    } catch (error) {  
      console.error("\[Compliance Checker\] Error:", error);  
      throw new Error("Gagal melakukan audit compliance TikTok.");  
    }  
  }

  static getJsonSchema() {  
     return {  
        // ... masukkan struktur schema JSON persis seperti di properti 'responseSchema' kode Anda ...  
     }  
  }  
}

#### **3\. Pilihan Integrasi pada Workflow MAKNA (Pilih 2 Opsi Ini)**

Anda memiliki dua pilihan di mana fitur ini akan diletakkan di dalam pipa produksi (pipeline) MAKNA:  
**Opsi A: Alur Otomatis di Latar Belakang (Ideal untuk Autopilot Massal)**  
Suntikkan langkah ini ke dalam skeduler lokal (lib/scheduler-processors.js), tepat *setelah* AI membuat Storyboard & Naskah, namun *sebelum* naskah tersebut dikirim ke MiniMax/Gemini untuk diubah menjadi suara (TTS).

JavaScript  
// Di dalam fungsi processScriptStage() / Worker Latar Belakang  
const draftStoryboard \= await generateStoryboard(productData);

// 1\. JALANKAN COMPLIANCE CHECK TIKTOK  
const complianceResult \= await TikTokComplianceService.auditScript(draftStoryboard.voiceover, draftStoryboard.caption);

if (complianceResult.verdict \=== 'REVISE') {  
   // 2\. Timpa naskah asli dengan versi aman dari agen QC  
   draftStoryboard.voiceover \= complianceResult.revised\_script.join('\\n');  
   draftStoryboard.caption \= complianceResult.revised\_caption;  
     
   // 3\. Catat log dan status ke Database  
   db.prepare("UPDATE sheets\_jobs SET compliance\_status \= 'revise', tiktok\_safe\_voiceover \= ?, compliance\_log\_json \= ? WHERE id \= ?")  
     .run(draftStoryboard.voiceover, JSON.stringify(complianceResult), jobId);

} else if (complianceResult.verdict \=== 'REJECT') {  
   // Hentikan proses, tandai failed karena pelanggaran sangat fatal yang tak bisa ditolong  
   throw new Error("TikTok Compliance REJECTED: " \+ complianceResult.issues\[0\].text);  
}

// 4\. Jika status PASS atau sudah di-REVISE, lanjutkan naskah tersebut ke pembuatan Suara (TTS)...

**Opsi B: Tombol "Sanitize" Manual di Frontend (Ideal untuk Mode RE V2)**  
Pada halaman detil kampanye (Fase 2 Editor's Workbench), tambahkan tombol **"Sanitize for TikTok / Bersihkan Naskah"** di atas kolom teks Voiceover.

1. Saat pengguna mengeklik tombol tersebut, Frontend menembak teks naskah ke endpoint API /api/compliance-check.  
2. Antarmuka memunculkan *loading spinner*.  
3. Jika AI menemukan masalah (*Blocker/Warning*), sebuah *pop-up* akan muncul menampilkan log isu tersebut.  
4. Teks di dalam kotak input Voiceover secara **otomatis terganti** dengan tiktok\_safe\_voiceover yang telah diperbaiki AI, siap untuk direkam ke TTS.

### **Konteks Ekstra: Menghadapi Kebijakan Ketat TikTok Shop**

Prompt yang Anda buat sudah sangat baik. Namun, untuk memastikan alat ini berfungsi maksimal menghadapi bot moderasi TikTok, pastikan Anda menambahkan aturan-aturan ini di dalam SYSTEM\_PROMPT Gemini Anda:

1. **Peralihan Klaim Fungsi Struktur (Structure/Function Claims):** Naskah revisi (revised\_script) WAJIB mengubah klaim kesembuhan menjadi klaim dukungan struktur tubuh.  
   * *BAHAYA:* "Menyembuhkan nyeri sendi." (Berisiko *banned*).  
   * *REVISI AMAN:* "Mendukung kesehatan tulang dan pelumas sendi."  
2. **Anti Eufemisme (Kata Sandi):** Bot TikTok kini bisa mendeteksi "kata sandi" yang digunakan penjual untuk menghindari sensor (seperti menyebut "Gula Tinggi" sebagai pengganti "Diabetes", atau "Benjolan Jahat" sebagai pengganti "Tumor"). Instruksikan Agen QC Anda untuk memblokir juga eufemisme/kiasan medis yang merujuk pada penyakit serius.

Dengan mendelegasikan tugas "Pengacara Hukum" ini kepada agen AI yang terpisah, mesin MAKNA Anda akan tetap menghasilkan konten dengan narasi yang kuat (Mode B), tanpa perlu khawatir akun TikTok Anda akan terblokir saat mem-posting ribuan video herbal tersebut\!