# **CETAK BIRU: MODUL ANGLE MULTIPLIER (THE REMAKE ENGINE)**

Modul ini adalah "Pabrik Pembuatan". Ia mengambil satu template storyboard dari *Master Library* (hasil Modul Dekonstruksi), menyuntikkan data produk jualan Anda, dan merender video baru dengan *angle* penjualan yang spesifik.

## **1\. ALUR KERJA (WORKFLOW FASE 2\)**

graph TD  
    %% INTERAKSI PENGGUNA  
    A\[UI: User Melihat List 'Deconstructed Assets'\] \--\> B\[User Memilih 1 Aset Target\]  
    B \--\> C\[User Input URL Produk Target, VSO, Bridging, Audio Settings\]  
    C \--\> D\[User Klik 'Generate Remake'\]

    %% RESOLUSI PRODUK & REMAKE  
    D \--\> E{Cek URL Produk di Product DB Lokal}  
    E \--\>|URL Tersedia| F\[Tarik Cepat DNA Produk: Nama, USP, Foto\]  
    E \--\>|URL Belum Ada| G\[Jalankan Scraper Playwright & Ekstrak Gemini\]  
      
    F \--\> H  
    G \--\> H\[Gemini Phase 2: Remake Naskah, Prompt T2I & I2V\]  
      
    H \--\> I\[(Simpan Hasil Remake ke DB Multiplier)\]  
    I \--\> J\[Kirim JSON Payload via Webhook ke G-Labs\]  
    J \--\> K\[Status: Sent to G-Labs\]

## **2\. SKEMA DATABASE SQLITE (lib/db.js)**

Tabel ini terpisah dari aset dekonstruksi, karena 1 aset dekonstruksi bisa memiliki banyak turunan di tabel multiplier ini.

CREATE TABLE IF NOT EXISTS re\_multiplier\_tasks (  
    id TEXT PRIMARY KEY,  
    deconstruct\_asset\_id TEXT REFERENCES re\_deconstructed\_assets(id), \-- Referensi ke Template Ori  
    target\_product\_url TEXT NOT NULL,  
    affiliate\_url TEXT,  
      
    \-- Konfigurasi dari UI  
    vso\_config\_json TEXT,       \-- Aesthetics & Visual Settings  
    bridging\_config\_json TEXT,  \-- Product Bridging Settings  
    audio\_config\_json TEXT,     \-- Workflow & Audio Settings  
      
    \-- Hasil Fase 2  
    remake\_storyboard\_json TEXT,  
    t2i\_i2v\_prompts\_json TEXT,  
    new\_caption TEXT,  
      
    status TEXT DEFAULT 'pending\_resolution',  
    \-- Status: pending\_resolution \-\> resolving\_product \-\> remaking \-\> sent\_to\_webhook \-\> completed  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

## **3\. ANTARMUKA PENGGUNA (UI WORKFLOW)**

**Langkah A: Asset Picker (Memilih Template)**

Pengguna membuka menu /re-multiplier. Sistem menampilkan galeri video kompetitor yang sudah sukses dibedah di Modul 1\. Pengguna dapat melihat *Original Storyboard* dan Ide Produk (Low/High Ticket) sebagai inspirasi. Pengguna mengeklik tombol **"Use this Blueprint"**.

**Langkah B: Configuration Form (Menyuntikkan Produk)**

Pada tahap ini, setelah memilih aset (*blueprint*), terdapat 2 pilihan mode generasi untuk pengguna:

**a. Single Product Generation**

Maksudnya memilih *single asset* dan memasukkan *single product*. Pengguna mengisi form tunggal:

* **Target Product URL:** https://shopee.co.id/xxx  
* **Affiliate URL:** https://shope.ee/xxx  
* **Aesthetics & Visual Settings:** (Faceless, Scandinavian Kitchen, dll).  
* **Bridging Settings:** Sisipkan di klip ke-berapa.  
* **Audio Settings:** Pilihan Voice Persona.  
* Klik **"Generate Remake"**.

**b. Multi Product Generation**

User memilih 1 *asset* dan memasukkan *N list produk* (misal: via *copy-paste* ke *textarea* atau unggah file CSV berisi kumpulan URL dan konfigurasi).

* **Pemrosesan Sekuensial:** Mesin akan memproses masukan ini **per baris produk**. Sistem akan otomatis melakukan antrean (mengulang alur *Product Resolution* & *Remake*) untuk masing-masing baris hingga seluruh *N* produk di *list* selesai diproduksi menggunakan 1 *blueprint* yang sama.

## **4\. LOGIKA WORKER: PRODUCT RESOLUTION & WEBHOOK (lib/re-multiplier-worker.js)**

import db from './db';  
import { resolveProductDNA } from './product-resolver'; // Modul scraper \+ extract USP  
import { callGeminiPhase2 } from './gemini-adv';

export async function processMultiplierTask(taskId) {  
  const task \= db.prepare("SELECT \* FROM re\_multiplier\_tasks WHERE id \= ?").get(taskId);  
  const asset \= db.prepare("SELECT \* FROM re\_deconstructed\_assets WHERE id \= ?").get(task.deconstruct\_asset\_id);

  try {  
    db.prepare("UPDATE re\_multiplier\_tasks SET status \= 'resolving\_product' WHERE id \= ?").run(taskId);

    // 1\. RESOLUSI PRODUK (Cek DB atau Scrape Baru)  
    const productDNA \= await resolveProductDNA(task.target\_product\_url);

    db.prepare("UPDATE re\_multiplier\_tasks SET status \= 'remaking' WHERE id \= ?").run(taskId);

    // 2\. GEMINI PHASE 2 (Remake Storyboard)  
    // Melempar Storyboard Ori \+ DNA Produk Baru \+ VSO Config  
    const remakeResult \= await callGeminiPhase2(  
      asset.original\_storyboard\_json,   
      productDNA,   
      task.vso\_config\_json,  
      task.bridging\_config\_json  
    );

    // 3\. SIMPAN HASIL REMAKE  
    db.prepare(\`  
      UPDATE re\_multiplier\_tasks   
      SET remake\_storyboard\_json \= ?, t2i\_i2v\_prompts\_json \= ?, new\_caption \= ?   
      WHERE id \= ?  
    \`).run(  
      JSON.stringify(remakeResult.storyboard),   
      JSON.stringify(remakeResult.prompts),   
      remakeResult.caption,   
      taskId  
    );

    // 4\. KIRIM KE WEBHOOK G-LABS  
    const webhookPayload \= {  
      makna\_reference\_id: taskId,  
      project\_name: \`Multiplier\_${taskId}\`,  
      audio\_config: JSON.parse(task.audio\_config\_json),  
      scenes: remakeResult.prompts  
    };

    const webhookRes \= await fetch("\[https://g-labs-endpoint.com/api/webhook/makna\](https://g-labs-endpoint.com/api/webhook/makna)", {  
      method: "POST",  
      headers: { "Content-Type": "application/json" },  
      body: JSON.stringify(webhookPayload)  
    });

    if (webhookRes.ok) {  
      db.prepare("UPDATE re\_multiplier\_tasks SET status \= 'sent\_to\_webhook' WHERE id \= ?").run(taskId);  
    }

  } catch (error) {  
    db.prepare("UPDATE re\_multiplier\_tasks SET status \= 'failed' WHERE id \= ?").run(taskId);  
    console.error(\`Multiplier Task Failed:\`, error);  
  }  
}

