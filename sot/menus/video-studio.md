# **BLUEPRINT SISTEM: STANDALONE FFmpeg VIDEO STUDIO & AUTOMATED EDITING ENGINE (V5.9)**

Cetak biru ini menjelaskan spesifikasi teknis, rancangan UI, alur kerja backend, serta opsi sinkronisasi audio-video tingkat lanjut untuk modul **FFmpeg Standalone Video Studio** (/video-studio). Fitur ini dirancang mandiri, aman, dan fleksibel untuk memproses berkas unggahan langsung (drag-and-drop) maupun aset dari database MAKNA.

## **1\. PENDAHULUAN & ARSITEKTUR MODUL MANDIRI**

Modul **Standalone Video Studio** berfungsi sebagai pusat penyuntingan media lokal yang tidak bergantung pada platform third-party. Pengguna dapat memilih sumber aset secara fleksibel:

               \[PILIHAN SUMBER MEDIA DI UI\]  
         ┌───────────────────┴───────────────────┐  
         ▼                                       ▼  
   \[UPLOAD LANGSUNG\]                    \[AMBIL DARI DATABASE\]  
   \- Seret video (.mp4/.mov)            \- Cari klip visual hasil AI  
   \- Seret audio (.mp3/.wav)            \- Cari sulih suara (TTS MiniMax)  
         │                                       │  
         └───────────────────┬───────────────────┘  
                             ▼  
              \[PILIH STRATEGI SINKRONISASI\]  
         (Shortest | Stretch Speed | Freeze Frame | Loop)  
                             │  
                             ▼  
         \[ANTREAN PROSES: NATIVE FFmpeg ENGINE\]  
                             │  
                             ▼  
                 \[HASIL AKHIR: AD-READY VIDEO\]

## **2\. 4 OPSI UTAMA SINKRONISASI AUDIO-VIDEO (FFmpeg ENGINE)**

Masalah klasik dalam otomatisasi editing adalah **ketidakcocokan durasi** antara video (biasanya berdurasi kaku seperti 8 detik hasil generate AI) dengan suara voiceover (durasi dinamis tergantung panjang kalimat).

Berikut adalah 4 opsi teknis yang kami sediakan untuk menyelesaikan sinkronisasi ini menggunakan FFmpeg:

### **OPSI A: Potong Mengikuti Durasi Terpendek (Mux & Hard Trim)**

* **Konsep:** Video atau audio yang memiliki durasi lebih panjang akan dipotong secara paksa agar menyamai durasi berkas yang lebih pendek. Biasanya digunakan jika visual ingin dipangkas agar langsung beralih begitu voiceover selesai.  
* **Command FFmpeg:**  
  ffmpeg \-i video.mp4 \-i audio.mp3 \-map 0:v:0 \-map 1:a:0 \-c:v libx264 \-pix\_fmt yuv420p \-c:a aac \-shortest output.mp4

* **Kelebihan:** Proses rendering sangat cepat tanpa manipulasi kecepatan (*framerate*).

### **OPSI B: Penyesuaian Kecepatan Visual (Dynamic Speed Stretching)**

* **Konsep:** Durasi video dipercepat atau diperlambat secara mulus menggunakan manipulasi PTS (*Presentation Time Stamp*) agar durasi visual pas ![][image1] dengan durasi audio pengisi suara.  
* **Formula Faktor Kecepatan:** ![][image2]  
  *(Contoh: Audio 5 detik, Video 8 detik ![][image3] Faktor \= ![][image4]. Video akan dipercepat).*  
* **Command FFmpeg:**  
  ffmpeg \-i video.mp4 \-i audio.mp3 \-filter\_complex "\[0:v\]setpts=0.625\*PTS\[v\]" \-map "\[v\]" \-map 1:a:0 \-c:v libx264 \-pix\_fmt yuv420p \-c:a aac output.mp4

* **Kelebihan:** Visual tidak ada yang terpotong, semua adegan dari awal hingga akhir tetap terlihat dalam tempo yang disesuaikan.

### **OPSI C: Pembekuan Frame Terakhir (Freeze Last Frame / Video Pad)**

* **Konsep:** Jika video lebih pendek daripada audio (misal: video 8 detik, audio 10 detik), video akan diputar normal, lalu pada detik ke-8, frame terakhir akan "membeku" (*freeze*) selama 2 detik hingga audio selesai dibacakan.  
* **Command FFmpeg (menggunakan filter tpad):**  
  ffmpeg \-i video.mp4 \-i audio.mp3 \-filter\_complex "\[0:v\]tpad=stop\_mode=clone:stop\_duration=2\[v\]" \-map "\[v\]" \-map 1:a:0 \-c:v libx264 \-pix\_fmt yuv420p \-c:a aac output.mp4

* **Kelebihan:** Sangat baik untuk mempertahankan detail visual produk di akhir video promosi sambil menyelesaikan pembacaan CTA.

### **OPSI D: Pengulangan Klip Visual (Infinite Loop Video)**

* **Konsep:** Jika audio jauh lebih panjang daripada video, video akan diatur untuk berputar berulang kali (*looping*) dari awal secara terus-menerus dan otomatis terpotong tepat saat audio berakhir.  
* **Command FFmpeg:**  
  ffmpeg \-stream\_loop \-1 \-i video.mp4 \-i audio.mp3 \-map 0:v:0 \-map 1:a:0 \-c:v libx264 \-pix\_fmt yuv420p \-c:a aac \-shortest output.mp4

* **Kelebihan:** Sangat cocok untuk tipe konten berlatar belakang visual pemandangan atau suasana (*aesthetic ambient loop*).

## **3\. STRUKTUR DATABASE BARU (lib/db.js)**

Untuk mendukung pencatatan riwayat rendering dan pemanggilan aset database secara standalone, kita membuat satu tabel baru bernama ffmpeg\_studio\_jobs:

// Struktur tabel penyimpanan riwayat studio rendering standalone  
db.exec(\`  
  CREATE TABLE IF NOT EXISTS ffmpeg\_studio\_jobs (  
    id TEXT PRIMARY KEY,                 \-- ID pekerjaan 'fsj\_xxxx'  
    video\_source\_type TEXT NOT NULL,     \-- 'upload' | 'database'  
    video\_path TEXT NOT NULL,            \-- Path lokal file video mentah  
    audio\_source\_type TEXT NOT NULL,     \-- 'upload' | 'database'  
    audio\_path TEXT NOT NULL,            \-- Path lokal file audio mentah  
    sync\_option TEXT NOT NULL,           \-- 'shortest' | 'stretch' | 'freeze' | 'loop'  
    bgm\_path TEXT,                       \-- Path instrumen latar belakang (opsional)  
    bgm\_volume REAL DEFAULT 0.15,        \-- Volume musik latar  
    output\_path TEXT,                    \-- Hasil render video final  
    status TEXT DEFAULT 'pending',       \-- 'pending' | 'processing' | 'completed' | 'failed'  
    error\_log TEXT,                      \-- Catatan error jika crash  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
  );  
\`);

## **4\. DESAIN ANTARMUKA: STANDALONE STUDIO UI (re-autopilot/page.js / /video-studio)**

Halaman ini didesain menggunakan **Vanilla CSS murni** dengan dua kolom: **Panel Kiri (Media Selector & Parameter)** dan **Panel Kanan (Live Preview & Status Render)**.

\<\!-- Struktur JSX Studio Editor Standalone \--\>  
\<div class="ffmpeg-studio-container"\>  
    
  \<\!-- PANEL KIRI: SETUP KAMPANYE & MEDIA \--\>  
  \<div class="studio-control-panel"\>  
    \<h2\>🎬 FFmpeg Video Studio\</h2\>  
      
    \<form id="render-form"\>  
      \<\!-- 1\. Input Video \--\>  
      \<div class="media-section"\>  
        \<h3\>1. Sumber Video (Visual)\</h3\>  
        \<div class="tabs"\>  
          \<button type="button" class="tab-btn active" id="tab-video-upload"\>Upload File\</button\>  
          \<button type="button" class="tab-btn" id="tab-video-db"\>Ambil dari DB\</button\>  
        \</div\>  
          
        \<div class="tab-content" id="video-upload-box"\>  
          \<div class="drag-drop-zone"\>  
            \<input type="file" accept="video/mp4,video/quicktime" /\>  
            \<p\>Seret file video .mp4 ke sini atau klik untuk mencari\</p\>  
          \</div\>  
        \</div\>  
      \</div\>

      \<\!-- 2\. Input Audio \--\>  
      \<div class="media-section"\>  
        \<h3\>2. Sumber Audio (Voiceover)\</h3\>  
        \<div class="tabs"\>  
          \<button type="button" class="tab-btn active" id="tab-audio-upload"\>Upload File\</button\>  
          \<button type="button" class="tab-btn" id="tab-audio-db"\>Ambil dari DB\</button\>  
        \</div\>  
          
        \<div class="tab-content" id="audio-upload-box"\>  
          \<div class="drag-drop-zone"\>  
            \<input type="file" accept="audio/mp3,audio/wav" /\>  
            \<p\>Seret file audio .mp3 ke sini atau klik untuk mencari\</p\>  
          \</div\>  
        \</div\>  
      \</div\>

      \<\!-- 3\. Parameter Sinkronisasi & BGM \--\>  
      \<div class="media-section"\>  
        \<h3\>3. Strategi Sinkronisasi & Efek\</h3\>  
          
        \<label\>Pilih Opsi Sinkron Audio-Video:\</label\>  
        \<select name="sync\_option" required\>  
          \<option value="shortest"\>Potong Ikuti Audio Terpendek (Shortest Trim)\</option\>  
          \<option value="stretch"\>Sesuaikan Kecepatan Video (Speed Stretch)\</option\>  
          \<option value="freeze"\>Bekukan Frame Terakhir (Freeze Last Frame)\</option\>  
          \<option value="loop"\>Ulangi Video Terus-menerus (Infinite Loop)\</option\>  
        \</select\>

        \<label\>Musik Latar (BGM) \- Opsional:\</label\>  
        \<select name="bgm\_file"\>  
          \<option value=""\>Tanpa Musik Latar\</option\>  
          \<option value="smooth\_commercial.mp3"\>Smooth Commercial (0.15 Vol)\</option\>  
          \<option value="upbeat\_promo.mp3"\>Upbeat Promo (0.10 Vol)\</option\>  
        \</select\>  
      \</div\>

      \<button type="submit" class="glowing-btn-render"\>Mulai Rendering Video\</button\>  
    \</form\>  
  \</div\>

  \<\!-- PANEL KANAN: PREVIEW & RIWAYAT \--\>  
  \<div class="studio-preview-panel"\>  
    \<h2\>📺 Preview & Antrean Render\</h2\>  
      
    \<\!-- Video Player Preview \--\>  
    \<div class="preview-box"\>  
      \<video id="studio-preview-player" controls\>  
        \<source src="/placeholder-video.mp4" type="video/mp4" /\>  
        Browser Anda tidak mendukung pratinjau video.  
      \</video\>  
    \</div\>

    \<\!-- Antrean Riwayat Pekerjaan Render \--\>  
    \<div class="queue-box"\>  
      \<h3\>Antrean Kerja Server\</h3\>  
      \<div class="queue-list"\>  
        \<div class="queue-item processing"\>  
          \<div class="item-info"\>  
            \<strong\>render\_job\_9128.mp4\</strong\>  
            \<span\>Status: Sedang merender (Opsi: Stretch Speed)...\</span\>  
          \</div\>  
          \<div class="spinner-loader"\>\</div\>  
        \</div\>  
      \</div\>  
    \</div\>  
  \</div\>

\</div\>

## **5\. PENANGANAN BACKEND SINKRONISASI (api/video-studio/render/route.js)**

API ini menerima input form, mengidentifikasi durasi durasi media secara akurat menggunakan ffprobe, menghitung rasio peregangan/pembekuan, dan mengeksekusi pipeline rendering menggunakan fluent-ffmpeg:

import ffmpeg from 'fluent-ffmpeg';  
import ffprobe from 'ffprobe-static';  
import path from 'path';  
import fs from 'fs';

ffmpeg.setFfprobePath(ffprobe.path);

/\*\*  
 \* Fungsi pembantu untuk mendapatkan durasi media (Video/Audio) secara presisi  
 \*/  
function getMediaDuration(filePath) {  
  return new Promise((resolve, reject) \=\> {  
    ffmpeg.ffprobe(filePath, (err, metadata) \=\> {  
      if (err) return reject(err);  
      resolve(metadata.format.duration);  
    });  
  });  
}

/\*\*  
 \* Core rendering controller  
 \*/  
export async function processVideoMuxing(jobConfig) {  
  const { videoPath, audioPath, syncOption, bgmPath, outputPath } \= jobConfig;

  // 1\. Dapatkan durasi aktual dari visual dan audio suara  
  const videoDuration \= await getMediaDuration(videoPath);  
  const audioDuration \= await getMediaDuration(audioPath);

  let command \= ffmpeg();

  // OPSI A: SHORTEST  
  if (syncOption \=== 'shortest') {  
    return new Promise((resolve, reject) \=\> {  
      ffmpeg()  
        .input(videoPath)  
        .input(audioPath)  
        .outputOptions(\[  
          '-map 0:v:0',  
          '-map 1:a:0',  
          '-c:v libx264',  
          '-pix\_fmt yuv420p',  
          '-c:a aac',  
          '-shortest'  
        \])  
        .save(outputPath)  
        .on('end', () \=\> resolve(outputPath))  
        .on('error', (err) \=\> reject(err));  
    });  
  }

  // OPSI B: DYNAMIC SPEED STRETCHING  
  if (syncOption \=== 'stretch') {  
    const factor \= audioDuration / videoDuration;  
    return new Promise((resolve, reject) \=\> {  
      ffmpeg()  
        .input(videoPath)  
        .input(audioPath)  
        .complexFilter(\[  
          \`\[0:v\]setpts=${factor}\*PTS\[v\]\`  
        \])  
        .outputOptions(\[  
          '-map \[v\]',  
          '-map 1:a:0',  
          '-c:v libx264',  
          '-pix\_fmt yuv420p',  
          '-c:a aac',  
          '-shortest'  
        \])  
        .save(outputPath)  
        .on('end', () \=\> resolve(outputPath))  
        .on('error', (err) \=\> reject(err));  
    });  
  }

  // OPSI C: FREEZE LAST FRAME  
  if (syncOption \=== 'freeze') {  
    const padDuration \= Math.max(0, audioDuration \- videoDuration);  
    return new Promise((resolve, reject) \=\> {  
      ffmpeg()  
        .input(videoPath)  
        .input(audioPath)  
        .complexFilter(\[  
          \`\[0:v\]tpad=stop\_mode=clone:stop\_duration=${padDuration}\[v\]\`  
        \])  
        .outputOptions(\[  
          '-map \[v\]',  
          '-map 1:a:0',  
          '-c:v libx264',  
          '-pix\_fmt yuv420p',  
          '-c:a aac',  
          '-shortest'  
        \])  
        .save(outputPath)  
        .on('end', () \=\> resolve(outputPath))  
        .on('error', (err) \=\> reject(err));  
    });  
  }

  // OPSI D: INFINITE LOOP VIDEO  
  if (syncOption \=== 'loop') {  
    return new Promise((resolve, reject) \=\> {  
      ffmpeg()  
        .input(videoPath)  
        .inputOptions(\['-stream\_loop \-1'\]) // Set loop tak terbatas di sisi input visual  
        .input(audioPath)  
        .outputOptions(\[  
          '-map 0:v:0',  
          '-map 1:a:0',  
          '-c:v libx264',  
          '-pix\_fmt yuv420p',  
          '-c:a aac',  
          '-shortest' // Batasi paksa durasi melingkar visual tepat saat audio selesai  
        \])  
        .save(outputPath)  
        .on('end', () \=\> resolve(outputPath))  
        .on('error', (err) \=\> reject(err));  
    });  
  }  
}

## **6\. PENANGANAN FILE TEMPORER & PROTEKSI OVERLOAD SERVER**

Operasi FFmpeg adalah aktivitas intensif CPU (*CPU Bound*). Untuk menjamin kesehatan infrastruktur server Next.js, aturan main berikut diterapkan secara ketat:

1. **Antrean Sekuensial Tunggal:** API tidak boleh mengeksekusi lebih dari 1 proses fluent-ffmpeg secara bersamaan. Semua permintaan render baru harus mengantre di tabel database ffmpeg\_studio\_jobs dengan status pending.  
2. **Pembersihan Otomatis (Temp File Garbage Collection):** Semua file video dan audio yang diunggah pengguna ke folder /public/temp/ akan dihapus secara otomatis menggunakan fungsi fs.unlinkSync() tepat 30 menit setelah status pengerjaan berubah menjadi completed atau failed.  
3. **Batas Ukuran File Maksimal (File Limit):** Batasi ukuran unggahan video maksimal **50MB** dan audio maksimal **10MB** melalui file konfigurasi Next.js (bodyParser: { sizeLimit: '50mb' }) untuk mencegah kehabisan ruang penyimpanan disk (*disk exhaustion*).

**EOF (End of Blueprint Document)**

*Fitur Standalone FFmpeg Studio ini melengkapi kemandirian produksi materi promosi iklan digital massal pada MAKNA Engine V5.*

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAZCAYAAAB3oa15AAAClElEQVR4Xu2W24vNURTHz9Q8uOQScnRuv3OrE0rDJMkDRXkV5R/w4hJRlBeexhNNKZ6YlDIeqPEml1JT5JIizOR5FCJqGDFhfNac/Tsta/b+ORNF+X1rtff3u75777V+t3MymRT/MUql0rJ8Pl+wuka5XF5itX8CURS9JXqIXuKZzQvQK8SE1RPBgoN0vcvqMcgfIUaJT8QOmxcUCoU6V/eeHE7ctHm0bcQ3xd8Q45w7SGwmtsDfy3ru0EK91guMF2UDd6DEbusRoA8RNxR/StzWHg5fL3so3qW5AP6KeKD4oUajMUfmuVxuFkMnF2A5en9rUbsINVCv1+faQgSiUeR8w3+6g1Hz4tzVHuJWzPFvoOCNMY89mreNUANoj3ybOv9ZmddqtcXCZdQeCryu1zK/GqnnnvkxPDMUf9jWo+NDQgOihxqY1LmKR30e9HNap9g1mpucPHIXYj5t/GYDVwKe01an0JNR80UdrVQqK5R3yvppwRW0J6BP2VzrFDXo87hiJ/g65W1OA88TPAti7u6cvD8rtS8RchAL9/p0X3FaZ+wPeE45vdPmYhSLxdV4zsec+UsaP+zmIwwdLXMSXAP7fHqguJYeegfQ+ny6hsl3WD98QPMgZCGd7/foH+ymTpcGhmVOA+uE/+orZCHrq9XqPMXXWj98TPMgXAMHrE5x2+2mAtHIdWtObDWej8Q7rcVwxZ4x2lJ7VlsN8Cu4yBVwwuYErrmdih+3B9HMNbSvSpp8HFhXVloL5L5bTWD3jZIeIZKXoub/kRfEiBtfE+PaxxdipivmPuNj4nPG83K53BhxWfw0tcl6BOSeZ7PZ2VYXkLsTuc+51JTxnPPXQWE9VtMgP0B8IVbZXIoUKVKk+CP4ATmi8RO1PT43AAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAcklEQVR4XmNgGAWjYOCBvLz8XnQxigHQ0H/oYhQDOTk5GyAuQxenGABde05BQcEcXRwOZGVlTcjBQENvAQ3fh24eRQBo4F8gxYguTjYAGvgfXYwiAPT2BBUVFXZ0cYoA0JW/0cUoBkCXGqCLjYJRQEMAAMSsFY9fiDqtAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAZCAYAAAChBHccAAACk0lEQVR4Xu2Vu2sUURTGJ0ER8QE+lg37mn3BGhAR1weKCKIgNorGF6hYCAG7FCJoJfoHBBQbMQg2YqVVCsXaInYiYhUxqATBQhBfRP2+5dz47cnNBm0zHxzunt/57r1ndubOJEmmTItU+Xx+RbVafZym6W/EBFCf9/QS5uxCfOb8SqUy6uv1er2C2htb/0Wz2VztPeA/0MNIrVbLl0ql5VhnP+d4X5dgLHJRTmBeLBbXMcfPfmeNCt5niGnJX6GJy5IP0SP5JNeH53BgxnlhPvaqZ45g+IKFHjj2HPFNWUzwXOcmIS8UCutt03Hx8G4cD3lgOi8w9HEV4x2MJ7U2r2zxE45d8YvHZE2MKcPGGzSfp9GPxgfVp54FhedrjzW/WzkaOEeOR2mtchU8B6yBIeblcvmQ91DwXUCcUoY53zlXn/1/bp4HxBrYopy3mRz1HcpVfNTsws/wdmNcg3wK8cF7vWxPfzfIniDeIcaZ8/Cqp0swXDPTJseP2GKnlatQe22eT46T3VSmQu2W7dlynCwNOf6MS2Tq6RIMwzTgn9vs+DFyjPuUq1CfMM+w42w+uml4k6HJ7b4Wk6311POOwjOP2KkcDZ0l52tUuQqeu/TgWW8o79F8H3mj0Sj7AtVut5d61mOtJMGBWcbi/7xtUD9oi8++MYxHNyTjx1Dy8+HC8XuMdeTb/s6YXeunsi6Z4YZjnQOjjIfYHyB6eGA9Q/xyjN+MJY69lN/3EDOJfNlbrdYqW+t2YHOURv5lm3RUUOeWR3xh045yudxKenCGBgLDxb0Nc30ED9SP/KvkXHvSeeKC6T5ixkZuPuI9aOIRahc9B3tozbzniFu/0dVZi4b6MG+r8Wkbp7SeKVOmTJkWl/4ADAf4BRvMU30AAAAASUVORK5CYII=>