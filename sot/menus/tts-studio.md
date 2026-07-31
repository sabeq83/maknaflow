# **BLUEPRINT SISTEM: STANDALONE TTS STUDIO & VOICE PERSISTENCE ENGINE (V6.0 \- Vv2 VOICES UPDATE)**

Cetak biru ini menjelaskan spesifikasi teknis, arsitektur basis data, rancangan antarmuka pengguna (UI), serta logika backend untuk modul **Standalone TTS Studio** (/tts-studio). Modul ini memungkinkan pembuatan sulih suara secara massal (batch) dengan memanfaatkan API premium **MiniMax AI** atau **Gemini TTS API** yang terintegrasi secara persisten dengan database SQLite lokal MAKNA Engine V5.

## **1\. PENDAHULUAN & ARSITEKTUR INTEGRASI**

Modul **Standalone TTS Studio** dirancang untuk memecah batasan kaku pembuatan suara manual. Pengguna dapat memilih sumber teks secara fleksibel, memilih mesin kecerdasan suara sesuai kebutuhan anggaran, menyetel kontrol dinamika audio, serta menyimpan hasil akhir langsung ke database sehingga siap digunakan oleh modul **FFmpeg Standalone Video Studio**.

                  \[PILIHAN SUMBER TEKS DI UI\]  
         ┌─────────────────────┼─────────────────────┐  
         ▼                     ▼                     ▼  
   \[TULIS MANUAL\]      \[RE AUTOPILOT FACTORY\] \[INSTANT FACTORY\]  
   Ketik paragraf      Pilih dari draf        Pilih dari pipeline  
   bebas (multi-clip)  campaign autopilot     assets yang sudah jadi  
         │                     │                     │  
         └─────────────────────┼─────────────────────┘  
                               ▼  
                \[PILIH PENYEDIA API & PERSONA\]  
             (Gemini TTS API  vs  MiniMax AI API)  
                               ▼  
                  \[PILIH SETING AUDIO-PHYSICS\]  
                 (Speed | Volume | Pitch Slider)  
                               ▼  
                  \[GENERASI BATCH ASINKRON\]  
                               ▼  
             \[DECK AUDIO PLAYER (PLAY, DOWNLOAD, RE-GEN)\]  
                               ▼  
             \[SIMPAN KE DATABASE \`tts\_studio\_clips\`\]

## **2\. STRUKTUR DATABASE TERISOLASI (lib/db.js)**

Untuk memastikan hasil render audio terekam secara persisten dan dapat dilacak oleh editor video FFmpeg, kita menambahkan dua tabel relasional baru bernama tts\_studio\_batches dan tts\_studio\_clips:

erDiagram  
    re\_autopilot\_variants ||--o{ tts\_studio\_batches : "source text from"  
    pipeline\_assets ||--o{ tts\_studio\_batches : "source text from"  
    tts\_studio\_batches ||--|{ tts\_studio\_clips : "contains (N clips)"

    tts\_studio\_batches {  
        text id PK "ttsb\_xxxx"  
        text source\_type "manual | autopilot | instant\_factory"  
        text source\_ref\_id "ID referensi variant atau asset"  
        text provider\_active "minimax | gemini"  
        text voice\_persona "Contoh: Kore, Indonesian\_casual\_reporter\_vv2"  
        real config\_speed "Default: 1.0"  
        real config\_volume "Default: 1.0"  
        datetime created\_at  
    }

    tts\_studio\_clips {  
        text id PK "ttsc\_xxxx"  
        text batch\_id FK "Merujuk ke tts\_studio\_batches"  
        integer clip\_index "Indeks klip ke-X (0 hingga N-1)"  
        text source\_text "Naskah pembacaan klip ini"  
        text audio\_path "Path file lokal MP3/WAV hasil render"  
        text status "pending | processing | completed | failed"  
        datetime created\_at  
    }

### **Script Inisialisasi Database SQLite:**

// Jalankan query ini pada lib/db.js untuk mendaftarkan tabel TTS Studio  
db.exec(\`  
  CREATE TABLE IF NOT EXISTS tts\_studio\_batches (  
    id TEXT PRIMARY KEY,  
    source\_type TEXT NOT NULL,  
    source\_ref\_id TEXT,  
    provider\_active TEXT NOT NULL,  
    voice\_persona TEXT NOT NULL,  
    config\_speed REAL DEFAULT 1.0,  
    config\_volume REAL DEFAULT 1.0,  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
  );

  CREATE TABLE IF NOT EXISTS tts\_studio\_clips (  
    id TEXT PRIMARY KEY,  
    batch\_id TEXT NOT NULL,  
    clip\_index INTEGER NOT NULL,  
    source\_text TEXT NOT NULL,  
    audio\_path TEXT,  
    status TEXT DEFAULT 'pending',  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    FOREIGN KEY(batch\_id) REFERENCES tts\_studio\_batches(id)  
  );  
\`);

## **3\. LOGIKA INTEGRASI PENYEDIA API (GEMINI VS MINIMAX)**

### **A. Gemini TTS API (gemini-2.5-flash-preview-tts)**

* **Spesifikasi:** Menghasilkan audio berformat raw PCM 16-bit Mono (mimetype audio/L16). Untuk diputar, server wajib mengonversi menjadi WAV (menambahkan header RIFF 44-byte).  
* **Voice Personas (14 Resmi):**  
  * *Kore, Fenrir, Puck, Charon, Leda, Zephyr, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Despina.*

### **B. MiniMax AI TTS API (V2 Models \- INDONESIAN ONLY)**

* **Spesifikasi:** Menghasilkan audio premium berformat .mp3 (128kbps, 32kHz). Sangat alami dan mendukung konfigurasi numerik yang presisi serta fitur *Micro-Acting* interjection seperti (laughs) atau (sighs) jika menggunakan model HD.  
* **Daftar Persona Suara Resmi Vv2 (Generasi Terbaru):**  
  Berikut adalah 7 karakter suara Bahasa Indonesia terbaru yang dikonfigurasi untuk engine MiniMax:

| No. | Voice ID (Sistem) | Voice Name (UI) | Gender | Karakter & Rekomendasi Penggunaan |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Indonesian\_casual\_reporter\_vv2 | Casual Reporter | Pria | Santai, komunikatif, informatif. Cocok untuk daily vlog atau ulasan ringan. |
| 2 | Indonesian\_compelling\_storyteller\_vv2 | Storyteller | Pria | Naratif, mendalam, memikat. Sangat cocok untuk *Psychodrama* (Mode A) atau cerita panjang. |
| 3 | Indonesian\_expressive\_podcaster\_vv2 | Podcaster | Pria | Ekspresif, dinamis, beropini. Cocok untuk format opini, Q\&A, atau ulasan produk yang interaktif. |
| 4 | Indonesian\_energetic\_streamer\_vv2 | Streamer | Pria | Bersemangat, bertempo cepat, antusias. Sempurna untuk "Racun TikTok", promo diskon, dan Hook. |
| 5 | Indonesian\_intellectual\_commentator\_vv2 | Commentator | Wanita | Cerdas, tenang, analitis. Sangat pas untuk edukasi, konten medis/kesehatan, atau tips & trik. |
| 6 | Indonesian\_professional\_anchor\_vv2 | Anchor | Wanita | Formal, jelas, berwibawa. Ideal untuk profil perusahaan, pengumuman resmi, atau berita. |
| 7 | Indonesian\_crisp\_reporter\_vv2 | Crisp Reporter | Wanita | Lugas, jernih, artikulasi tajam. Cocok untuk presentasi produk detail dan *soft-selling*. |

* **Kontrol Dinamis (Config Parameters):**  
  * Model: speech-2.8-hd (Disarankan) atau speech-2.8-turbo  
  * Speed (0.5 s/d 2.0, Default: 1.0)  
  * Volume (0.5 s/d 1.5, Default: 1.0)

## **4\. DESAIN ANTARMUKA: TTS STANDALONE STUDIO UI (/tts-studio)**

Halaman ini didesain menggunakan **Vanilla CSS murni** (No-Tailwind) untuk keselarasan 100% dengan estetika MAKNA Engine V5.

\<\!-- Struktur JSX Utama Halaman /tts-studio \--\>  
\<div class="tts-studio-container"\>  
    
  \<\!-- PANEL KIRI: SELECTOR SUMBER DAN KONFIGURASI \--\>  
  \<div class="tts-control-panel"\>  
    \<h2\>🎙️ TTS Standalone Studio\</h2\>  
      
    \<form id="tts-config-form"\>  
      \<\!-- 1\. Pemilihan Sumber Teks \--\>  
      \<div class="tts-section"\>  
        \<h3\>1. Sumber Naskah Voiceover\</h3\>  
        \<div class="source-tabs"\>  
          \<button type="button" class="tab-btn active" data-source="manual"\>Input Tulis Manual\</button\>  
          \<button type="button" class="tab-btn" data-source="autopilot"\>Ambil dari Autopilot\</button\>  
          \<button type="button" class="tab-btn" data-source="instant"\>Instant Factory\</button\>  
        \</div\>

        \<div class="source-content" id="source-manual-input"\>  
          \<label\>Ketik Naskah (Pisahkan paragraf per klip menggunakan baris kosong double):\</label\>  
          \<textarea placeholder="Paragraf klip ke-1...  Paragraf klip ke-2..."\>\</textarea\>  
        \</div\>  
      \</div\>

      \<\!-- 2\. Pemilihan API Provider & Persona \--\>  
      \<div class="tts-section"\>  
        \<h3\>2. Mesin TTS & Karakter Suara\</h3\>  
        \<label\>Pilih Penyedia API:\</label\>  
        \<select id="api-provider-select"\>  
          \<option value="minimax"\>MiniMax AI (Premium MP3 \- Vv2 Models)\</option\>  
          \<option value="gemini"\>Gemini TTS Engine (WAV)\</option\>  
        \</select\>

        \<label\>Pilih Persona Suara:\</label\>  
        \<div class="voice-persona-grid" id="persona-selector-container"\>  
          \<\!-- Diisi otomatis secara dinamis lewat JS berdasarkan pilihan API \--\>  
          \<\!-- Contoh render MiniMax Indonesian Voice Vv2: \--\>  
          \<div class="persona-card active" data-voice="Indonesian\_casual\_reporter\_vv2"\>  
            \<div class="persona-avatar"\>🧔\</div\>  
            \<strong\>Casual Reporter\</strong\>  
            \<span class="persona-id"\>Indonesian\_casual\_reporter\_vv2\</span\>  
          \</div\>  
          \<div class="persona-card" data-voice="Indonesian\_crisp\_reporter\_vv2"\>  
            \<div class="persona-avatar"\>👩‍🦰\</div\>  
            \<strong\>Crisp Reporter\</strong\>  
            \<span class="persona-id"\>Indonesian\_crisp\_reporter\_vv2\</span\>  
          \</div\>  
        \</div\>  
      \</div\>

      \<\!-- 3\. Konfigurasi Kontrol Audio-Physics \--\>  
      \<div class="tts-section"\>  
        \<h3\>3. Penyelarasan Dinamika Suara\</h3\>  
        \<div class="range-control"\>  
          \<label\>Kecepatan Pembacaan (Speed): \<span id="val-speed"\>1.0x\</span\>\</label\>  
          \<input type="range" min="0.5" max="2.0" step="0.1" value="1.0" name="speed\_slider" /\>  
        \</div\>  
        \<div class="range-control"\>  
          \<label\>Volume: \<span id="val-volume"\>1.0x\</span\>\</label\>  
          \<input type="range" min="0.5" max="1.5" step="0.1" value="1.0" name="volume\_slider" /\>  
        \</div\>  
      \</div\>

      \<button type="submit" class="glowing-btn-tts"\>Mulai Sintesis Batch Suara\</button\>  
    \</form\>  
  \</div\>

  \<\!-- PANEL KANAN: TRACK DECK PLAYER & ACTIONS \--\>  
  \<\!-- ... Sisa kode player UI ... \--\>  
\</div\>

## **5\. PENANGANAN BACKEND API SINKRONISASI (api/tts-studio/route.js)**

Route handler ini memproses pembuatan batch audio secara berantai, menyimpannya di file lokal Next.js, dan mencatat riwayat ke SQLite. Menggunakan output hex khusus untuk MiniMax T2A V2.

import db from '../../../lib/db';  
import { generateMinimaxVO } from '../../../lib/minimax-tts'; // Fungsi MiniMax V2 Decode HEX  
import { convertPcmToWav } from '../../../lib/audio-helper';  
import path from 'path';  
import fs from 'fs';

export async function POST(req) {  
  try {  
    const { source\_type, source\_ref\_id, provider\_active, voice\_persona, speed, volume, clips } \= await req.json();

    const batchId \= \`ttsb\_${Date.now()}\`;  
      
    // 1\. Catat batch utama ke SQLite  
    db.prepare(\`  
      INSERT INTO tts\_studio\_batches (id, source\_type, source\_ref\_id, provider\_active, voice\_persona, config\_speed, config\_volume)  
      VALUES (?, ?, ?, ?, ?, ?, ?)  
    \`).run(batchId, source\_type, source\_ref\_id || null, provider\_active, voice\_persona, speed, volume);

    const generatedClips \= \[\];

    // 2\. Proses batch audio per klip secara sekuensial  
    for (let i \= 0; i \< clips.length; i++) {  
      const clipId \= \`ttsc\_${Date.now()}\_${i}\`;  
      const text \= clips\[i\];  
      const ext \= provider\_active \=== 'minimax' ? 'mp3' : 'wav';  
      const outputFileName \= \`tts\_studio\_${batchId}\_clip\_${i}.${ext}\`;  
      const localPath \= path.join(process.cwd(), 'public/temp', outputFileName);

      // Tandai draf pekerjaan di database  
      db.prepare(\`  
        INSERT INTO tts\_studio\_clips (id, batch\_id, clip\_index, source\_text, audio\_path, status)  
        VALUES (?, ?, ?, ?, ?, 'processing')  
      \`).run(clipId, batchId, i, text, \`/temp/${outputFileName}\`);

      try {  
        if (provider\_active \=== 'minimax') {  
          // Panggil API MiniMax V2 (Format MP3 via HEX Output) menggunakan Vv2 Voice IDs  
          await generateMinimaxVO(text, voice\_persona, localPath, { speed, volume });  
        } else {  
          // Panggil API Gemini TTS (Format PCM \-\> WAV conversion)  
          const rawPcm \= await callGeminiTtsApi(text, voice\_persona);   
          const wavBuffer \= convertPcmToWav(rawPcm, 24000); // 24kHz Mono  
          fs.writeFileSync(localPath, wavBuffer);  
        }

        // Sukses\! Update status menjadi completed  
        db.prepare('UPDATE tts\_studio\_clips SET status \= "completed" WHERE id \= ?').run(clipId);  
        generatedClips.push({ clip\_index: i, audio\_path: \`/temp/${outputFileName}\`, status: 'completed' });

      } catch (err) {  
        db.prepare('UPDATE tts\_studio\_clips SET status \= "failed" WHERE id \= ?').run(clipId);  
        console.error(\`Gagal melakukan TTS pada klip ke-${i} di batch ${batchId}:\`, err);  
      }  
    }

    return Response.json({ success: true, batchId, clips: generatedClips });

  } catch (error) {  
    return Response.json({ success: false, error: error.message }, { status: 500 });  
  }  
}

**EOF (End of Blueprint Document)**

*Modul Standalone TTS Studio V6.0 (Updated Vv2) siap merender naskah dengan persona suara Indonesia ter-update.*