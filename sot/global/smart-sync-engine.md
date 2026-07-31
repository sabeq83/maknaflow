# **BLUEPRINT SISTEM: SMART DYNAMIC AUDIO-VIDEO SYNC ENGINE (MAKNA ENGINE V7)**

Cetak biru ini menjelaskan spesifikasi arsitektur, algoritma penentu keputusan (*Smart Decision Tree*), logika penyelarasan berbasis zona adegan (*Zone-Aware Alignment*), serta implementasi kode backend Next.js untuk fitur **Smart Audio-Video Sync Engine** pada **MAKNA Engine V5/V6**.

## **1\. PENDAHULUAN: ERA "ZERO-THOUGHT" SINKRONISASI MEDIA**

Saat ini, pada modul pembuatan RE Campaign klasik, pengguna harus memilih salah satu dari 4 opsi sinkronisasi kaku: shortest, loop, stretch, atau freeze. Masalahnya, **satu metode tidak cocok untuk semua jenis klip dalam satu video**.

### **Mengapa Pilihan Manual Kurang Efektif?**

* **Zona Hook (Klip Awal):** Jika video membeku (*freeze*) atau melambat secara drastis pada detik-detik awal, retensi penonton akan langsung hancur. Zona ini membutuhkan visual yang dinamis dan berenergi tinggi.  
* **Zona CTA/Penjualan (Klip Akhir):** Pengguna ingin penonton membaca info produk lebih lama. Memotong video secara paksa (*shortest*) akan membuat adegan terpotong sebelum penonton sempat membaca teks promosi.

**Solusinya:** Kita menggantinya dengan opsi default **"Auto-Pilot Smart Sync"**. Sistem akan secara cerdas menyelidiki durasi audio dan video secara real-time, lalu menerapkan metode manipulasi visual terbaik berdasarkan kecocokan durasi dan posisi zona klip tersebut dalam alur video iklan.

## **2\. MATRIKS KEPUTUSAN OTOMATIS (SMART DECISION TREE)**

Biarkan sistem bekerja secara matematis menggunakan variabel durasi audio (![][image1]), durasi video asli (![][image2]), serta nomor klip aktif (![][image3]) terhadap titik transisi bridging (![][image4]).

                      \[SISTEM MEMULAI PROSES MUXING KLIP\]  
                                      │  
                                      ▼  
                      \[Probing Durasi via FFprobe\]  
                     Mendapatkan Durasi Da dan Dv  
                                      │  
                                      ▼  
                    \[Hitung Deviasi: ΔD \= Dv \- Da\]  
                                      │  
         ┌────────────────────────────┼────────────────────────────┐  
         ▼                            ▼                            ▼  
   \[ΔD \> 2.0s\]                  \[-2.0s \<= ΔD \<= 2.0s\]              \[ΔD \< \-2.0s\]  
 (Video jauh lebih panjang)     (Perbedaan Durasi Mikro)     (Audio jauh lebih panjang)  
         │                            │                            │  
         ▼                            ▼                            ▼  
\[Klip ke-C di Zona Mana?\]      \[DYNAMICAL STRETCH\]          \[INFINITE VIDEO LOOP\]  
 ├─► Hook Zone (C \< X)         Sesuaikan kecepatan visual   Ulangi klip video dari awal  
 │   Action: HARD TRIM         sebesar: faktor \= Da / Dv    secara mulus hingga audio  
 └─► CTA Zone (C \>= X)         agar sinkron 100%            suara selesai dibacakan.  
     Action: FREEZE FRAME

### **Aturan Logika Keputusan Otomatis:**

1. **Symmetrical Micro-Stretch (Deviasi ![][image5] Detik):** Jika perbedaan durasi sangat tipis, sistem secara otomatis melambatkan atau mempercepat video secara halus menggunakan filter setpts FFmpeg. Gerakannya tidak akan terasa aneh di mata penonton karena perubahannya di bawah 25%.  
2. **Zona-Sadar Pemangkasan (Video Jauh Lebih Panjang):**  
   Jika video 8 detik sementara pengisi suara hanya bicara selama 4 detik (![][image6]):  
   * **Klip Retensi (Klip ![][image7] s/d ![][image8]):** Potong video di akhir adegan secara tegas (*Hard Trim*). Ini mempertahankan tempo ketukan visual yang cepat dan intens.  
   * **Klip Konversi & CTA (Klip ![][image4] s/d ![][image9]):** Jalankan visual secara normal selama 8 detik, lalu bekukan (*Freeze*) frame terakhir produk agar penonton bisa fokus membaca penawaran Anda selagi pengisi suara menyelesaikan naskahnya.  
3. **Visual Looping (Audio Jauh Lebih Panjang):**  
   Jika audio voiceover sangat panjang (misal: 12 detik) sementara klip visual AI hanya berdurasi kaku 8 detik. Sistem akan mengulang video tersebut secara mulus (*Infinite Loop*) dan memotongnya tepat saat audio selesai.

## **3\. PENYESUAIAN ANTARMUKA PENGGUNA (UI/UX SIMPLIFICATION)**

Pada form pembuatan kampanye RE /re-campaigns atau /re-autopilot, menu dropdown sinkronisasi yang membingungkan bagi pengguna awam diganti dengan opsi yang jauh lebih intuitif:

───────────────────────────────────────────────────────────────────  
PENGATURAN SINKRONISASI AUDIO-VIDEO  
───────────────────────────────────────────────────────────────────  
\* Mode Sinkronisasi : (o) Auto-Pilot Smart Sync (Sangat Direkomendasikan)  
                      ( ) Kustom Manual (Terbuka untuk Profesional)

 \[ Jika Memilih Kustom Manual, Tampilkan Pilihan Lama: \]  
 \* Metode Manual     : \[ Potong Durasi Terpendek (Shortest)        | v \]

*Dengan pengaturan ini, 95% pengguna akan tetap menggunakan mode **Auto-Pilot Smart Sync**, menyederhanakan proses berpikir mereka, namun sistem menghasilkan video dengan kualitas editing yang jauh lebih natural.*

## **4\. LOGIKA KODE BACKEND SMART SYNC ENGINE (lib/smart-sync-engine.js)**

Berikut adalah modul helper backend Next.js untuk menganalisis durasi media dan mengeksekusi filter FFmpeg secara dinamis:

import ffmpeg from 'fluent-ffmpeg';  
import ffprobe from 'ffprobe-static';  
import path from 'path';  
import fs from 'fs';

ffmpeg.setFfprobePath(ffprobe.path);

/\*\*  
 \* Mendapatkan durasi sebuah file media secara presisi menggunakan FFprobe  
 \* @param {string} filePath \- Path file lokal media  
 \* @returns {Promise\<number\>} Durasi dalam detik  
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
 \* Smart Audio-Video Muxing Engine  
 \* Mengambil keputusan edit secara otonom berdasarkan durasi media dan posisi adegan  
 \* @param {Object} params \- Parameter konfigurasi  
 \* @param {string} params.videoPath \- Path video mentah  
 \* @param {string} params.audioPath \- Path audio VO mentah  
 \* @param {string} params.outputPath \- Path hasil render final klip  
 \* @param {number} params.currentClipIndex \- Indeks klip saat ini (1 s/d N)  
 \* @param {number} params.bridgeAtClip \- Titik transisi bridging (X)  
 \*/  
export async function runSmartSyncMux(params) {  
  const { videoPath, audioPath, outputPath, currentClipIndex, bridgeAtClip } \= params;

  // 1\. Dapatkan durasi aktual video dan audio  
  const videoDuration \= await getMediaDuration(videoPath);  
  const audioDuration \= await getMediaDuration(audioPath);  
  const durationDiff \= videoDuration \- audioDuration; // Selisih durasi

  console.log(\`\[SmartSync\] Klip ${currentClipIndex}: Video \= ${videoDuration}s, Audio \= ${audioDuration}s. Selisih \= ${durationDiff}s\`);

  // \==========================================  
  // KASUS 1: Selisih mikro (± 2 detik) \-\> Symmetrical Speed Stretch  
  // \==========================================  
  if (Math.abs(durationDiff) \<= 2.0) {  
    const speedFactor \= audioDuration / videoDuration;  
    console.log(\`\[SmartSync\] Menerapkan Speed Stretch (Faktor: ${speedFactor.toFixed(3)})\`);  
      
    return new Promise((resolve, reject) \=\> {  
      ffmpeg()  
        .input(videoPath)  
        .input(audioPath)  
        .complexFilter(\[  
          \`\[0:v\]setpts=${speedFactor}\*PTS\[v\]\`  
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

  // \==========================================  
  // KASUS 2: Video jauh lebih panjang (Selisih \> 2 detik)  
  // \==========================================  
  if (durationDiff \> 2.0) {  
    const isHookZone \= currentClipIndex \< bridgeAtClip;

    if (isHookZone) {  
      // Zona Hook/Retention \-\> Menerapkan Hard Trim agar video tetap gesit dan cepat beralih  
      console.log(\`\[SmartSync\] Zona Hook: Menerapkan Hard Trim (Potong s/d ${audioDuration}s)\`);  
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
            '-shortest' // memotong sisa visual video mengikuti berakhirnya audio  
          \])  
          .save(outputPath)  
          .on('end', () \=\> resolve(outputPath))  
          .on('error', (err) \=\> reject(err));  
      });  
    } else {  
      // Zona CTA/Conversion \-\> Menerapkan Freeze Frame di akhir agar info produk nampak lebih lama  
      console.log(\`\[SmartSync\] Zona CTA: Menerapkan Freeze Frame pada frame akhir\`);  
      return new Promise((resolve, reject) \=\> {  
        ffmpeg()  
          .input(videoPath)  
          .input(audioPath)  
          .complexFilter(\[  
            \`\[0:v\]tpad=stop\_mode=clone:stop\_duration=${durationDiff}\[v\]\`  
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
  }

  // \==========================================  
  // KASUS 3: Audio jauh lebih panjang (Selisih \< \-2 detik) \-\> Infinite Video Looping  
  // \==========================================  
  if (durationDiff \< \-2.0) {  
    console.log(\`\[SmartSync\] Audio Sangat Panjang: Menerapkan Infinite Video Looping\`);  
    return new Promise((resolve, reject) \=\> {  
      ffmpeg()  
        .input(videoPath)  
        .inputOptions(\['-stream\_loop \-1'\]) // Loop video mentah tanpa batas  
        .input(audioPath)  
        .outputOptions(\[  
          '-map 0:v:0',  
          '-map 1:a:0',  
          '-c:v libx264',  
          '-pix\_fmt yuv420p',  
          '-c:a aac',  
          '-shortest' // Batasi paksa durasi melingkar video tepat saat audio VO selesai  
        \])  
        .save(outputPath)  
        .on('end', () \=\> resolve(outputPath))  
        .on('error', (err) \=\> reject(err));  
    });  
  }  
}

## **5\. SKENARIO INTEGRASI PADA PRODUCTION SCHEDULER**

Saat sistem background task (scheduler-processors.js) memproses antrean pembuatan kampanye RE, kita menyederhanakan proses pemanggilan fungsi jahit klip:

// Draf integrasi pemrosesan otomatis pada scheduler utama  
import { runSmartSyncMux } from './smart-sync-engine';

export async function processCampaignClips(campaignId) {  
  const campaign \= db.prepare("SELECT \* FROM re\_campaigns WHERE id \= ?").get(campaignId);  
  const clipsCount \= campaign.target\_clips\_count;  
  const bridgeAt \= campaign.bridge\_at\_clip;

  const finalClipsPaths \= \[\];

  for (let i \= 1; i \<= clipsCount; i++) {  
    const rawVideo \= \`/public/temp/${campaignId}\_clip\_${i}\_raw.mp4\`;  
    const rawAudio \= \`/public/temp/${campaignId}\_clip\_${i}\_vo.mp3\`;  
    const outputClip \= \`/public/temp/${campaignId}\_clip\_${i}\_final\_synced.mp4\`;

    // Panggil mesin pembuat keputusan cerdas (Auto-Pilot Smart Sync)  
    await runSmartSyncMux({  
      videoPath: rawVideo,  
      audioPath: rawAudio,  
      outputPath: outputClip,  
      currentClipIndex: i,  
      bridgeAtClip: bridgeAt  
    });

    finalClipsPaths.push(outputClip);  
  }

  // Lanjutkan ke proses penggabungan (Concatenate) seluruh klip final...  
}

## **6\. MATRIX EVALUASI KEBERHASILAN PRODUKSI**

| Aspek Pengukuran | Sistem Klasik (Pilihan Manual) | Sistem Baru (Smart Sync Engine V6.1) |
| :---- | :---- | :---- |
| **User Experience (UX)** | Membingungkan. Pengguna harus menebak metode mana yang pas untuk setiap klip. | **Sederhana & Tanpa Berpikir.** Cukup centang mode "Auto-Pilot" dan biarkan AI mengaturnya. |
| **Kualitas Retensi Video** | Rendah. Visual sering kali membeku secara tidak perlu pada 3 detik pertama video karena salah menyetel konfigurasi. | **Sangat Tinggi.** Klip-klip awal video dijamin selalu dinamis dan energik tanpa ada frame diam. |
| **Efektivitas Konversi Promosi** | Sedang. Teks penawaran produk sering kali menghilang terlalu cepat sebelum audiens selesai membaca. | **Maksimal.** Frame produk promosi di akhir video otomatis tertahan lebih lama di layar selagi suara voiceover membacakan call to action. |

**EOF (End of Blueprint Document)**

*Smart Dynamic Audio-Video Sync Engine V6.1 merevolusi kualitas penyuntingan otomatis pada MAKNA Engine V5.*

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAABP0lEQVR4XmNgGAVDCsjLy3cB8Ucg/g/F34H4HZrYdXR9ZAOYoejiIAAU/4lLjmQAMkhBQeEQujgIiIqK8kDlG9DlSAJAAyKgPnJEl4MBfD4mGgANuEbIEGpZRNAQYtQQBFBDDqCLw4CioqIbVA35qQ8WP0DaAV0OBoDyt0FqlJWVxdDliAZAA24SChKob/6ii5MEoIbgtEgekVCY0OVIAtBgw5p/gOKNIHlZWVkddDmguDcQnwbiJ0A8CV0eBQAVVIMMkpOTc0UWB1oQIA8pgn4ji8MAMHGYgSyA8XGGCFBiGhD/BSlAwn/kIUUNqKxboqWlxYauDwZA6oEJQxbEBjpSCcj/hq6GKgDZB0CLFgD5NcjyVAPIFoHYUlJSXED6FbIaqgCgL+LkIdliNzA+M4D0WRUVFT50daNgFNAfAACq8GyQIv4SyAAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAABO0lEQVR4XmNgGAVDCsjLy3cB8Ucg/g/F34H4HZrYdXR9ZAOYoejiIAAU/4lLjmQAMkhBQeEQujgIiIqK8kDlG9DlSAJAAyKgPnJEl4MBfD4mGgANuEbIEGpZRNAQYtQQBFBDDqCLw4CioqIbVA35qQ8WP0DaAV0OBoDyt0FqlJWVxdDliAZAA24SChKob/6ii5MEoIbgtEgekVCY0OVIAtBgw5p/gOKNIHlZWVkdNPEGoPgVOTk5LRAfpEZJSYkfWQ0KACqoBikCanBFFgcaFCAPKYJ+I4vDAFDeHSg3FUh3gPhA9log2wBdHUhiGhD/BVmChP/IQ4oaUFm3REtLiw1dHzIA6YGxgZb4I8tRFSBbBGS/RJajGpCSkuKShwaruro6L5Btia6GagBo+BkgPgDEfehyo2AUDBwAAL4+Z9imB/JaAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAAA2ElEQVR4XmNgGN5ARkZGWkFBoQCIZ8rJySnBxOXl5a2Q1WEAoILFQPwfiG8DsTfQIFUgPQ2InwOxJUgOXQ8cQDX+U1JS4keXA7qkEiQPpC+hy4EBUPIPXtMZ4BYEoYuDJD6AJIHO5USXQwZYLQBq0oU67Ra6HDrAagBQ8C9IApu/iQJQf2GaTCyg1ABmqAEv0SXQAU5LiHEBMIAtgDgBXRwMgJrvQg1gRpeDApArX6ELogCoK/4woBkCFDMC4tfIYjgBUOFumHeA+CuIBmaiVHR1o2AUUB0AAGxKQK2dyS75AAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAAA8UlEQVR4XmNgGAUUAXl5+Wgg/gnE/5HwGyT5X2hyt5H1YwWKiopuUMVPkcXFxcW5gWL/pKSkuJDFCQKY7ehiyHyigYKCwkqogc0gPtQgZjRlRANGmOuA+BvQcAF0BSQBoCG/QYYBDbJHlyMZyMnJnYS67B66HEkAaMAsoGHlMK+iyxMNgJqzgXgJiA2LCJDB6OoIAqAmF6Dm00hC8IhAEiMMgIlVHajpBbq4PDTlA10pgS6HAbS0tNiALpoP0gBio8sDxYuhrnuGLocCgLbdAir6AMRvgfgjEH9Flgfy30HFQfIg9megnkpkNaNgFAxZAAAE/08m4M643wAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAAA/ElEQVR4XmNgGAVDGTDKycmFogtiAwoKCh3y8vK/gfgPkL0QXR4vkJGR4QRqLEEXRwdANR+B2AjElpaWFgay/4MwujqcQFRUlAeooRRdHBkAXW8OVPNSXV2dFyYmKytrCrXsHLJanACkmQiLQEEGMvQKsjhJviLGIhAAqlmtoqLChyZGfYvQAVCPJdSi1ehycBcQi5WVlWXRzYABqJp/6OI4ATk+AqpfC8R/0cXxAlItAiaMdKD6D+jiBAEpFgEtsQCqfYAsBgpCZD5OQKxFQEskgOouootT2yIWaORjw8fRFZOc6oDFkzRU32x0ORgG+rQS3Z5RMApGAWUAABN2bEI/EeKcAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIoAAAAaCAYAAABo4cQnAAAEjElEQVR4Xu2ZWWgUQRCGo3jfVwzk2N4cEoiCSgRRVDzweBD1QVTQBx8FQfRBVBRUEBRBffHA13iBIPikKIpR8UC8UOOBF4iCZ7wJiUn0r0x1Utbu7Mxmd3GQ/qDY7qrqnuqanpnu3rw8h8PhcDgcjohjjNkJ+Qr5zdIAqVe6R7pdVEBszzlmG+sPyEfId6Gr0e2iBOI7wnHSOLZpeyrgvwvSBPkUi8UmaXvWsUnVegL6Rj9bVOD4r2h9WVlZjG3PtS0KUGyFhYXDqFxaWjqaY23Rfskw3sPcPrFQbojH4zukT9ahAHGRS1pP5Ofn92P7Fm2LAohtKSd4urYR0K8lOybNQG1LB4x/jtZlAt4A6xDXXRS7Wp2NFbJbuCaAtjPIT+qKi4uHaF1WQQKWcHDTtM3C9twFkQGI63Gq2AoKCvqSHcndo23pQE++8T5pR7WtM6Cf65zXvUofmGvjfW4SfHicy7Q+K6Dzh8kuKgkT/L8iKDY8CL3Yh57ejKmsrOyPvt5CrqLaRdvDgonXB32cyBNvlIqKip5B4yHY51cyPcZ7z9YxacqgOw2pg34Ffq9L/7RII7CUPv8Kjq1W6y1I1kL2yfaithv6fAB5idd+b23sDLiZGzjWldomYZ9vPvoGKmPcc43YiKBeRfYO7zThzmu13oJF1iz2idzuB4NfRLEhwVO1zQL7VfZZrG3ZAv2fh3wtLy8frm3pwHmu13qNnx/r2yYDfj9Ajmm7rIfGrk8CEv2UfDJJQlFR0dCSkpJxYQQTs1K398MErE8Imbxcg+schjRiHOXaFgTn+aPWJ4PH9MVH30plPETbuf4ZsraqqqqH9g8NOngSlES+WKgtmx+4+QbJmxdSJuv2fnBsvvHTddnnlLblAuOdS9GDN17bUmG8s5Q6rfeDx9Too39q65gsZ1jXJqiflP6hsR1ovcV0LHTbF1xRggd/UestPL5mrc82uEYNpCmdt6EF8a/CxDordanuCeF33zgfB6gsvwC8oL9DdpQHdbQICTdMen4C/Vay4wkfpfRboH9AiyOqk0+mZxSdAXEs54T5nZ/QJKfXcMLOBG0PGu8zcQVyWdvDgrbnIPX20CxdMLGmoP0hrTfq7YJcb5Z12PfT2KUOdCFddXV1d/ahe9tLOnC+JkpdIGiwkRoiiJlSj84XGO/UL2H7RcA+G7Z9cT4FRPkEymO0X67Bdd8nSRbFt54TclvbCNiPQ1ZTOeYdXP3UPgHQbqcO8oy2s9oYFuyUijjOBKH1hfWjzwXpKG7Znv1G2jrsN4zYCXFfL23d6mQ9JcabjS0quGbjHdXT/w2HgxY+8oIIcL605Rrj/RfVKmKn8i+O/ydNFN1GImM33idjk7T7QVtg+L42GbyBJIY3CT4ywfphMgxG/Q0m5QDZXqy/zsPnFflIO9vGij5bMYYR0ifn0IVF+Z20RRnDx/2i/jvoobDgZizUOkcK+ESx7bPEp5Ttsz/q0KRAvC+ozG+ItkmDt9Cavz0dWQEJvgmpNQF/XkURxHwBci3uHWnfh9zSPg6Hw+FwOBwOh8Ph+N/5AzdorOMhiwfVAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAAdElEQVR4XmNgGLqAGV0AGTDLy8vXAPF/IM5ClwQDoMQNIF4nKyvrh1chMhhCCnPQxTEASKGcnFwuujgGgCrMQxfHACCFCgoKBejiGACqsBBdHAVISUmJQD3Tgy4HBkCJ1UD8GoifAPFjKP0SiH+hqx0FlAEAbf4mssC/SGQAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAaCAYAAAD8K6+QAAABYklEQVR4Xu2WvUrEUBCFVwQLbewigfxspQRLexux9AV8BEsLsfYtbLax8VHEN1CwkfVv3UURFRXUMzCR8YhJMJBrMR8M3HvmzmQmw95sr+c4TmdkWbYJe4F9GLs1/lfyndr4rsjzfAnPvma9ln6/v66FD60eRdEctPc4jmet3gVa08i81Bs+04gyAWt2H4pWjWHch5pgT/ba1DQdC0KrxsBUOTXYExqd5wOhaNuYJHiTJGhqlX0had1YmqZHmuSMfSHRmkasNwKB+2hsR5P86dJIkmSlqXFsFVrTmPVaELQFO5B1eYlIk3yuDhS80dQ4tgptbMJ6JWhgDUHHRvq6RIwWFK3njvVfwUdwEQFXrGf6jwPTW2BfCLSxe9Z/UBTFDCY1kABZsx/6tia7YF8ItJZn1r+BKZzIWGFjeQuwR+vHfqK6+GX9gJhde6YL8Dtc1ucPYedql1IPn3Ucx3Ec55/yCZbvhpg2HTKaAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABB0lEQVR4Xu2SPQrCQBCF408jiF26/LPYWNh4A2/gNSy8hI14B7GysLGwsBDtPYKNJzCiCApi0De4C5txk8ZKyAdDdt97TGaXtayCn/B9f4K6ol5UnudNDZlE+TLT5ZkUeph7BPSt4ziC6yZKCK9QC9mwxwNZP/kCYw9c1+3QOms6aE+uGUEw1tZnaiaEaCgtiqJmEAQjtc9Fn4TuRU631/yZbdt1tc+D7mupC/yopmMb0e9L12TDMe3xfeh+JgieuEao6dC4he+Q+0ayjgB9LRsecI817puoIrzhoqSspuOGiQqCRxxjxw0F/BvqzvUUeDNzhC6o2P+8q4RniDAM2/D6XC8o+GveBoJOcgwgL1UAAAAASUVORK5CYII=>