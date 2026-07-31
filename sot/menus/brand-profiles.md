# **🎯 Master Blueprint: Integrasi Brand DNA ke RE Campaign & Instant Factory (V5.1)**

## **1\. Visi & Prinsip Integrasi**

Menghubungkan entitas **Brand Profile** ke dalam proyek **Standalone RE Campaign** dan **Instant Factory**. Sistem tidak lagi melakukan kloning mentah terhadap video referensi atau membuat video produk generik. Sebaliknya, ia bertindak sebagai penerjemah kreatif (*Translational AI*) yang mempertahankan struktur psikologis konten (Hook & Pacing) tetapi membungkus visual, narasi, dan prompts dengan DNA unik merek Anda.

## **2\. Arsitektur Database SQLite Baru (Relasional & Aman)**

Kita akan memodifikasi skema SQLite yang telah dirancang sebelumnya dengan menambahkan relasi kunci luar (*Foreign Key*) ke tabel kampanye baru.

erDiagram  
    BRAND\_PROFILES ||--o{ RE\_CAMPAIGNS : "mewarnai"  
    BRAND\_PROFILES ||--o{ INSTANT\_CAMPAIGNS : "mengarahkan"  
      
    BRAND\_PROFILES {  
        uuid id PK  
        string brand\_name  
        string tone\_of\_voice  
        text visual\_signature  
        string color\_palette  
        text forbidden\_elements  
        string brand\_slogan\_or\_cta  
    }  
      
    RE\_CAMPAIGNS {  
        uuid id PK  
        string campaign\_name  
        uuid brand\_profile\_id FK "nullable"  
        string status  
        string target\_spreadsheet\_id  
    }  
      
    INSTANT\_CAMPAIGNS {  
        uuid id PK  
        string product\_name  
        uuid brand\_profile\_id FK "nullable"  
        string status  
    }

### **A. Tabel brand\_profiles (Master Brand DNA)**

CREATE TABLE IF NOT EXISTS brand\_profiles (  
    id TEXT PRIMARY KEY, \-- UUID  
    brand\_name TEXT NOT NULL,  
    tone\_of\_voice TEXT CHECK(tone\_of\_voice IN ('Kasual/Gaul', 'Profesional/Edukatif', 'ASMR/Menenangkan', 'Motivasi/Tegas')) DEFAULT 'Kasual/Gaul',  
    visual\_signature TEXT NOT NULL, \-- e.g., "pencahayaan matahari sore (golden hour), sudut kamera macro, clean aesthetic"  
    color\_palette TEXT, \-- e.g., "Warm beige, sage green, soft white"  
    forbidden\_elements TEXT, \-- e.g., "Jangan ada transisi kilatan cahaya, dilarang ada teks neon, hindari shot wajah"  
    brand\_slogan\_or\_cta TEXT, \-- e.g., "Klik link di bio sekarang juga\!"  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

### **B. Migrasi Tambahan (Alter Table Campaigns)**

Untuk menjaga database lama tetap aman, kita hanya menambahkan kolom nullable brand\_profile\_id pada tabel kampanye V2/V5:

ALTER TABLE re\_campaigns ADD COLUMN brand\_profile\_id TEXT REFERENCES brand\_profiles(id) ON DELETE SET NULL;  
ALTER TABLE instant\_campaigns ADD COLUMN brand\_profile\_id TEXT REFERENCES brand\_profiles(id) ON DELETE SET NULL;

## **3\. Workflow 1: Penyuntikan Brand DNA pada RE Campaign**

Saat **Scheduler Analyzer V2** (analyzerCampaignQueue) memproses video referensi yang telah diunduh:

1. **Ambil Data Profil:** Backend membaca data re\_campaigns berdasarkan campaign\_id. Jika brand\_profile\_id tidak null, backend mem- *fetch* profil dari tabel brand\_profiles.  
2. **Double-Prompting Layer:** Backend menyusun systemInstruction ke Gemini API dengan menyisipkan aturan merek.

### **Modifikasi Prompt RE Engine V2 (Sintaks Penggabung):**

export function buildBrandAlignedREPrompt(kbTexts, config, brandConfig \= null) {  
  // 1\. Ambil prompt dasar dari reverse\_engineering\_prompt.js  
  const baseREPrompt \= buildReverseEngineeringPrompt(kbTexts, config);  
    
  if (\!brandConfig) return baseREPrompt;

  // 2\. Jika ada Brand Config, suntikkan instruksi penerjemahan gaya (Translational Adaptation)  
  return \`${baseREPrompt}

\========================================================================  
🚨 BRAND IDENTITY TRANSFORMATION MANDATE (CRITICAL)  
\========================================================================  
Kamu WAJIB mentransformasikan hasil reverse engineering video referensi ini agar selaras dengan identitas brand berikut:

\- Nama Brand: ${brandConfig.brand\_name}  
\- Tone of Voice (Gaya Bicara Naskah): ${brandConfig.tone\_of\_voice}  
\- Gaya Estetika Visual: ${brandConfig.visual\_signature}  
\- Palet Warna Kamera: ${brandConfig.color\_palette}  
\- ELEMEN TERLARANG (Jangan Dimunculkan di Visual/Prompt): ${brandConfig.forbidden\_elements}  
\- Slogan Kampanye/CTA Penutup: ${brandConfig.brand\_slogan\_or\_cta}

ATURAN ADAPTASI:  
1\. JANGAN kloning naskah mentah-mentah. Ambil struktur informasinya, lalu ubah gaya bahasanya menjadi tipe "${brandConfig.tone\_of\_voice}".  
2\. visual\_description dan T2V/T2I prompts wajib dimodifikasi secara radikal untuk menggunakan panduan visual: "${brandConfig.visual\_signature}" dan warna "${brandConfig.color\_palette}".  
3\. Pastikan tidak ada satupun elemen dari daftar "${brandConfig.forbidden\_elements}" yang masuk ke visual\_description atau prompts video AI.  
4\. Akhiri adegan storyboard terakhir (atau bagian narasi penutup) dengan menyertakan Slogan Brand: "${brandConfig.brand\_slogan\_or\_cta}".\`;  
}

## **4\. Workflow 2: Penyuntikan Brand DNA pada Instant Factory**

Di dalam menu **Instant Factory (1-Stage Ultra-Compact Edition)**, proses penyelarasan terjadi sejak awal mula pembentukan ide strategis produk:

1. **Integrasi UI:** Dropdown \[ Pilih Brand Profile \] diletakkan di bagian paling atas kolom konfigurasi masukan.  
2. **Simultan Cascading (1-Stage API Call):** Payload brand dikirimkan utuh ke backend /api/v2/instant-factory.  
3. **Logika Prompting:** Gemini langsung menuntun naskah narasi Indonesia, deskripsi sinematik, dan prompt AI Inggris mengikuti koridor merek.

### **Modifikasi Prompt Instant Factory V5 (Sintaks Penggabung):**

export function buildBrandAlignedInstantPrompt(productInfo, config, brandConfig \= null) {  
  const baseBrandSection \= brandConfig ? \`  
\========================================================================  
🚨 STRICT BRAND ALIGNMENT CONSTRAINT  
\========================================================================  
Semua output wajib diselaraskan dengan identitas Brand:  
\- Nama Brand: ${brandConfig.brand\_name}  
\- Nada Bahasa (VO): ${brandConfig.tone\_of\_voice}  
\- visual\_signature & color\_palette: ${brandConfig.visual\_signature} (Gunakan palet warna: ${brandConfig.color\_palette})  
\- FORBIDDEN VISUALS: Hindari memunculkan "${brandConfig.forbidden\_elements}" baik dalam teks storyboard maupun prompts.  
\- Penutup Video: Slogan brand "${brandConfig.brand\_slogan\_or\_cta}" wajib disuntikkan secara kreatif di scene terakhir.\` : '';

  return \`Kamu adalah "MAKNA v50.2" \- STAGE UNIFIED: AI CONTENT FACTORY.  
Tugas utama kamu adalah membuat Blueprint Konten Video yang 100% selaras dengan identitas Brand dan USP Produk.

\[PRODUCT & CREATIVE CONFIGURATION\]  
\- Produk: ${productInfo.product\_name}  
\- Deskripsi: ${productInfo.product\_description}  
\- Narrative Mode: ${config.narrative\_mode}  
\- Visual Style: ${config.visual\_style}  
\- Aspect Ratio: ${config.aspect\_ratio}  
\- Face Visibility: ${config.face\_visibility}

${baseBrandSection}

\[INSTRUKSI PENGERJAAN\]  
1\. Lakukan analisis SWOT & rancang Core Campaign Concept yang pas dengan karakter brand.  
2\. Rancang Storyboard & Narasi VO. Gaya bahasa naskah WAJIB mencerminkan nada "${brandConfig ? brandConfig.tone\_of\_voice : config.narrative\_mode}".  
3\. visual\_description dan AI Generation Prompts (T2I & I2V) harus secara konsisten menggunakan gaya "${brandConfig ? brandConfig.visual\_signature : config.visual\_style}" dan warna "${brandConfig ? brandConfig.color\_palette : 'natural photorealistic'}".

\[OUTPUT FORMAT \- STRICT JSON\]  
(Gunakan skema keluaran JSON Unified Payload yang didefinisikan pada master blueprint V5)\`;  
}

## **5\. UI/UX Integrasi Dropdown pada Form Vertikal**

Pada halaman input form (Desktop & Mobile), dropdown pemilih Brand Profile diletakkan sebagai jembatan pembatas yang intuitif:

\[ FORM INSTANT FACTORY (SINGLE COLUMN) \]  
┌────────────────────────────────────────────────────────┐  
│  IDENTITAS PRODUK                                      │  
│  \[Nama Produk\] \-\> \[Deskripsi Produk\] \-\> \[Upload Foto\]  │  
├────────────────────────────────────────────────────────┤  
│  ✨ BRAND PERSONALIZATION (PILOKAN UTAMA)               │  
│  Brand Profile: \[ Dropdown: Pilih Brand Profile ▾ \]    │  
│  \*Pilih profil brand Anda untuk auto-adaptasi gaya\* │  
├────────────────────────────────────────────────────────┤  
│  CREATIVE SETTINGS & AUTOMATION                        │  
│  \[Narrative Mode\] \-\> \[Visual Style\] \-\> \[Voice Persona\] │  
└────────────────────────────────────────────────────────┘

*Jika user memilih "None/Tanpa Brand Profile", sistem akan otomatis beralih menggunakan pengaturan dasar generik dari konfigurasi bawaan.*

## **6\. Instruksi Khusus Untuk AI Coder (Antigravity/Cursor)**

**STRICT SECURITY RULE:** This is an additive extension. Do NOT touch legacy endpoints or alter the existing non-brand prompting files directly. Create wrappers or helper utilities to merge contexts.

**TASKS:**

1. Create SQLite database migration to add the brand\_profiles table, and append the brand\_profile\_id column to both the re\_campaigns and instant\_campaigns tables.  
2. Create a new dashboard page app/(dashboard)/settings/brand-profiles/page.jsx for managing brand profiles (Create, Read, Update, Delete UI).  
3. Inject the Brand Profile dropdown select option into:  
   * **"New RE Campaign"** modal/form.  
   * **"Instant Factory"** single-column setup form.  
4. Inside /api/v2/instant-factory and the campaign analyzer queue processor, check if brand\_profile\_id is supplied. If true, query the brand\_profiles table, retrieve the active brand data, and use the helper functions (buildBrandAlignedREPrompt and buildBrandAlignedInstantPrompt) to wrap the AI execution environment.