# **CETAK BIRU: MODUL DEKONSTRUKSI RE (THE DISCOVERY ENGINE)**

Modul ini murni bertugas sebagai "Penambang Pola Viral". Ia mengunduh video kompetitor secara hati-hati, membedah struktur emosionalnya, mencari celah produk untuk dijual, dan menyimpannya ke dalam Master Library (Perpustakaan Aset).

## **1\. ALUR KERJA (WORKFLOW FASE 1\)**

graph TD  
    A\[User Input: Daftar URL Video, Caption Ori\] \--\> B\[(Simpan ke Antrean DB)\]  
    B \--\> C{Scheduler: Sequential Poller}  
      
    %% Siklus dengan Delay  
    C \--\>|Delay 20 Detik antar Video| D\[Download Video Lokal \- yt-dlp\]  
    D \--\> E\[Upload Video ke Gemini File API\]  
      
    %% Analisis  
    E \--\> F\[Gemini Phase 1: Analisis Ori & Rekomendasi Produk\]  
    F \--\> G\[(Simpan Hasil ke Master Library)\]  
    G \--\> H\[Status: 'Deconstructed'\]

## **2\. SKEMA DATABASE SQLITE (lib/db.js)**

CREATE TABLE IF NOT EXISTS re\_deconstruct\_batches (  
    id TEXT PRIMARY KEY,  
    batch\_name TEXT NOT NULL,  
    target\_recommendation\_count INTEGER DEFAULT 3,  
    status TEXT DEFAULT 'processing',  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE IF NOT EXISTS re\_deconstructed\_assets (  
    id TEXT PRIMARY KEY,  
    batch\_id TEXT REFERENCES re\_deconstruct\_batches(id) ON DELETE CASCADE,  
    source\_url TEXT NOT NULL,  
    original\_caption TEXT,  
    local\_video\_path TEXT,          \-- Path hasil download  
    gemini\_file\_uri TEXT,           \-- URI di server Gemini  
      
    \-- Hasil Murni Fase 1  
    original\_storyboard\_json TEXT,  \-- Adegan per adegan & Naskah Ori  
    product\_ideas\_json TEXT,        \-- Low & High Ticket Ideas  
      
    status TEXT DEFAULT 'pending\_download',   
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

## **3\. PENJADWAL SEKUENSIAL DENGAN DELAY LOKAL**

Skeduler ini berjalan dengan kecepatan yang diatur secara ketat (throttled) untuk menghindari pemblokiran IP oleh server TikTok/Instagram.

import db from './db';  
import { downloadVideoExt } from './video-downloader';   
import { uploadToGeminiFileAPI, callGeminiPhase1 } from './gemini-adv';

const delay \= (ms) \=\> new Promise(resolve \=\> setTimeout(resolve, ms));

export async function processDeconstructQueue() {  
  const item \= db.prepare("SELECT \* FROM re\_deconstructed\_assets WHERE status \= 'pending\_download' ORDER BY created\_at ASC LIMIT 1").get();  
  if (\!item) return;

  try {  
    db.prepare("UPDATE re\_deconstructed\_assets SET status \= 'downloading' WHERE id \= ?").run(item.id);

    const localPath \= await downloadVideoExt(item.source\_url);  
    const geminiFile \= await uploadToGeminiFileAPI(localPath);

    db.prepare("UPDATE re\_deconstructed\_assets SET status \= 'analyzing', local\_video\_path \= ?, gemini\_file\_uri \= ? WHERE id \= ?").run(localPath, geminiFile.uri, item.id);

    // Prompt Fase 1 (Sesuai Blueprint sebelumnya)  
    const analysisResult \= await callGeminiPhase1(geminiFile.uri, item.original\_caption, 3);

    db.prepare(\`  
      UPDATE re\_deconstructed\_assets   
      SET original\_storyboard\_json \= ?, product\_ideas\_json \= ?, status \= 'deconstructed'   
      WHERE id \= ?  
    \`).run(JSON.stringify(analysisResult.storyboard), JSON.stringify(analysisResult.ideas), item.id);

    console.log(\`\[DECONSTRUCT\] Video ${item.id} berhasil dibedah. Jeda 20 detik...\`);  
      
    // WAJIB: Jeda 20 detik sebelum memproses video berikutnya di dalam list  
    await delay(20000);   
    setImmediate(processDeconstructQueue);

  } catch (error) {  
    db.prepare("UPDATE re\_deconstructed\_assets SET status \= 'failed' WHERE id \= ?").run(item.id);  
    await delay(20000); // Jeda pengamanan saat error  
    setImmediate(processDeconstructQueue);  
  }  
}  
