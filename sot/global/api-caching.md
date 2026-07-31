# **BLUEPRINT SISTEM: FLEXIBLE CONTEXT CACHING & TIER-BASED KEY MANAGEMENT (MAKNA V7.2)**

Cetak biru ini menjelaskan penyederhanaan arsitektur teknis, pembaruan antarmuka pengaturan (Settings UI), skema database, serta logika backend Next.js untuk menerapkan **Flexible Context Caching** berdasarkan pilihan Tier API yang ditentukan langsung oleh pengguna.

## **1\. PENYEDERHANAAN FILOSOFI & MANAGEMENT KEY**

Untuk menghindari kerumitan rotasi kunci (*key pool rotation*) pada Scheduler utama MAKNA Engine V7, kita menetapkan aturan manajemen kunci berdasarkan Tier yang dipilih:

1. **Paid Tier API (Premium Key):**  
   * **Fitur Caching:** Aktif (Wajib untuk menghemat biaya input token).  
   * **Manajemen Key:** **Single Stable Key**. Karena Paid Tier memiliki batas limit RPM (Requests Per Minute) yang sangat tinggi, Scheduler **TIDAK PERLU** memutar/merotasi banyak API Key. Cukup gunakan satu kunci utama yang stabil.  
2. **Free Tier API (Standard Key):**  
   * **Fitur Caching:** Mati Otomatis (Karena Google memblokir akses caching pada akun gratis).  
   * **Manajemen Key:** Dapat dikonfigurasi menggunakan kunci tunggal atau mengaktifkan pool rotasi jika kuota harian habis.

## **2\. STRUKTUR DATABASE (settings table)**

Kita menggunakan tabel settings (skema Key-Value) yang sudah ada di database SQLite makna.db untuk menyimpan preferensi tier API pengguna:

### **Konfigurasi Baru:**

* **gemini\_api\_tier**:  
  * paid (Paid Tier / Premium Key).  
  * free (Free Tier / Standard Key).  
* **gemini\_context\_caching**:  
  * on (Aktif \- hanya bekerja jika gemini\_api\_tier \= paid).  
  * off (Mati).

## **3\. RANCANGAN ANTARMUKA (SETTINGS UI UPDATE)**

Pada halaman **Settings** (/settings), kita menambahkan seksi konfigurasi yang sangat jelas di bawah form penginputan API Key Gemini:

───────────────────────────────────────────────────────────────────  
PENGATURAN TIER API GEMINI & CONTEXT CACHING  
───────────────────────────────────────────────────────────────────  
\* Pilih Tier API     :  (o) Paid Tier API (Sangat Direkomendasikan)  
                            \* Gunakan 1 Kunci Utama. Mendukung Caching hemat biaya.  
                        ( ) Free Tier API  
                            \* Menggunakan rotasi kunci jika tersedia. Caching dinonaktifkan.

\* Status Caching     :  \[ Aktif (Hemat Anggaran 90%) \] \-\> Otomatis ON jika memilih Paid Tier.  
                        \[ Nonaktif \]                  \-\> Otomatis OFF jika memilih Free Tier.

## **4\. IMPLEMENTASI BACKEND AMAN (lib/gemini.js)**

Berikut adalah kode backend Next.js yang sangat efisien untuk menangani seleksi kunci tunggal jika Paid Tier aktif, serta bypass otomatis pembuatan cache jika Free Tier aktif:

import { GoogleGenAI } from '@google/genai';  
import db from './db';

// Helper untuk mengambil setting dari SQLite makna.db  
function getSetting(key, defaultValue) {  
  const row \= db.prepare('SELECT value FROM settings WHERE key \= ?').get(key);  
  return row ? row.value : defaultValue;  
}

/\*\*  
 \* Pemanggil Gemini API dengan Seleksi Key dan Caching Berbasis Tier  
 \* @param {Object} params \- Parameter generasi  
 \* @param {string} params.systemInstruction \- Instruksi naskah KB yang besar  
 \* @param {string} params.prompt \- Perintah dinamis klip aktif  
 \* @param {string} params.model \- Default: 'gemini-2.5-flash'  
 \*/  
export async function generateContentFlexible(params) {  
  const { systemInstruction, prompt, model \= 'gemini-2.5-flash' } \= params;  
    
  // 1\. Ambil preferensi Tier dari Database  
  const apiTier \= getSetting('gemini\_api\_tier', 'paid'); // Default ke Paid Tier  
  const isCachingEnabled \= getSetting('gemini\_context\_caching', 'on') \=== 'on';

  let apiKey \= '';

  // 2\. LOGIKA SELEKSI KEY: JIKA PAID TIER \-\> Gunakan Single Stable Key  
  if (apiTier \=== 'paid') {  
    console.log(\`\[Gemini API\] Mode: PAID TIER. Menggunakan Single Stable Key (No Rotation).\`);  
    apiKey \= getSetting('gemini\_api\_key', process.env.GEMINI\_API\_KEY);  
  } else {  
    // JIKA FREE TIER \-\> Gunakan rotasi key pool jika tersedia (fallback ke single key jika kosong)  
    console.log(\`\[Gemini API\] Mode: FREE TIER. Menggunakan Key Pool Rotation.\`);  
    apiKey \= getRotatedFreeApiKey();   
  }

  const ai \= new GoogleGenAI({ apiKey });

  // 3\. LOGIKA CACHING: JIKA FREE TIER atau Caching OFF \-\> Langsung bypass ke request standar  
  if (apiTier \=== 'free' || \!isCachingEnabled) {  
    console.log(\`\[Gemini API\] Caching dinonaktifkan (Bypass ke standard request).\`);  
    return await runStandardRequest(ai, model, systemInstruction, prompt);  
  }

  // 4\. JIKA PAID TIER & CACHING ON \-\> Jalankan Explicit Context Caching (Sewa Storage)  
  try {  
    console.log(\`\[Gemini API\] Mendaftarkan Context Caching (Paid Tier)...\`);  
      
    // Buat Explicit Cache (Masa aktif sewa: 15 Menit / 900 detik)  
    const cache \= await ai.caches.create({  
      model: model,  
      displayName: \`makna\_v7\_paid\_cache\_${Date.now()}\`,  
      contents: \[  
        {  
          role: 'user',  
          parts: \[{ text: systemInstruction }\]  
        }  
      \],  
      ttl: '900s'   
    });

    console.log(\`\[Gemini API\] Caching Sukses\! ID: ${cache.name}. Mengeksekusi generasi...\`);

    // Kirim request ke model dengan referensi ID Cache  
    const response \= await ai.models.generateContent({  
      model: model,  
      contents: \[{ role: 'user', parts: \[{ text: prompt }\] }\],  
      cachedContent: cache.name  
    });

    return response.text;

  } catch (error) {  
    console.error(\`\[Gemini API\] Caching gagal atau bermasalah:\`, error.message);  
    // Graceful Fallback: Jika sewa cache gagal di sisi Google, langsung jalankan request standar agar video tidak gagal dibuat  
    console.log(\`\[Gemini API\] Menjalankan Fallback: Mengalihkan ke Standard Request...\`);  
    return await runStandardRequest(ai, model, systemInstruction, prompt);  
  }  
}

/\*\*  
 \* Request standar Gemini tanpa Caching  
 \*/  
async function runStandardRequest(ai, model, systemInstruction, prompt) {  
  const response \= await ai.models.generateContent({  
    model: model,  
    contents: \[  
      {  
        role: 'user',  
        parts: \[  
          { text: \`SYSTEM INSTRUCTION:\\n${systemInstruction}\` },  
          { text: \`USER PROMPT:\\n${prompt}\` }  
        \]  
      }  
    \]  
  });  
  return response.text;  
}

/\*\*  
 \* Fungsi pembantu rotasi key untuk Free Tier API  
 \*/  
function getRotatedFreeApiKey() {  
  // Mengambil kunci aktif dari tabel gemini\_api\_keys  
  const activeKeyRow \= db.prepare(\`  
    SELECT api\_key FROM gemini\_api\_keys   
    WHERE is\_active \= 1   
    ORDER BY RANDOM() LIMIT 1  
  \`).get();

  if (activeKeyRow) {  
    return activeKeyRow.api\_key;  
  }  
    
  // Jika database pool kosong, kembalikan key settings utama  
  return getSetting('gemini\_api\_key', process.env.GEMINI\_API\_KEY);  
}

**EOF (End of Blueprint Document)**