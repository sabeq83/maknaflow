# **BLUEPRINT SISTEM: MULTI-LANGUAGE SCRIPTING ENGINE (MAKNA V8.9)**

Cetak biru ini menjelaskan implementasi fitur dukungan Multi-Bahasa (Bahasa Indonesia & English) pada MAKNA Engine. Pembaruan ini diintegrasikan ke dalam menu pembuatan **RE Campaign**, **Organic Pillar Campaign (OPC)**, dan **Instant Factory**, memungkinkan agen AI menulis naskah sulih suara (*voiceover*) sesuai bahasa yang ditargetkan pengguna.

## **1\. PEMBARUAN SKEMA DATABASE SQLITE (lib/db.js)**

Kita perlu menambahkan kolom target\_language pada tiga tabel utama yang bertindak sebagai master konfigurasi kampanye.

\-- Tambahkan kolom bahasa pada RE Campaigns  
ALTER TABLE re\_campaigns ADD COLUMN target\_language TEXT DEFAULT 'id-ID';

\-- Tambahkan kolom bahasa pada Organic Pillar Campaigns (OPC)  
ALTER TABLE pillar\_campaigns ADD COLUMN target\_language TEXT DEFAULT 'id-ID';

\-- Tambahkan kolom bahasa pada Instant Campaigns  
ALTER TABLE instant\_campaign\_configs ADD COLUMN target\_language TEXT DEFAULT 'id-ID';

*(Nilai default adalah id-ID untuk Bahasa Indonesia, dan opsi lainnya adalah en-US untuk Bahasa Inggris).*

## **2\. RANCANGAN ANTARMUKA PENGGUNA (UI / FORMS)**

Pada halaman pembuatan kampanye (/re-campaigns, /pillar-campaigns, dan /instant-factory), kita menyisipkan *dropdown* **Bahasa Naskah Voiceover** tepat di bawah input Nama Kampanye pada **Bagian 1: Informasi Dasar**.

\<\!-- Cuplikan Komponen Form di Bagian Informasi Dasar \--\>  
\<div class="form-section-glowing"\>  
  \<h3\>📝 Informasi Dasar & Bahasa\</h3\>  
    
  \<div class="form-row-2col"\>  
    \<div class="form-group"\>  
      \<label\>Nama Kampanye:\</label\>  
      \<input type="text" name="campaign\_name" placeholder="Contoh: Promo Serum Glow" required /\>  
    \</div\>

    \<div class="form-group"\>  
      \<label\>Bahasa Naskah Voiceover (Script Language):\</label\>  
      \<select name="target\_language" id="target\_language" onChange="handleLanguageChange(this.value)"\>  
        \<option value="id-ID"\>🇮🇩 Bahasa Indonesia (Lokal)\</option\>  
        \<option value="en-US"\>🇺🇸 English (Global / US Market)\</option\>  
      \</select\>  
      \<small class="text-muted"\>\*AI akan menulis seluruh naskah narasi dalam bahasa ini.\</small\>  
    \</div\>  
  \</div\>  
\</div\>

## **3\. INTEGRASI LOGIKA PROMPT KOGNITIF (lib/prompts.js)**

Ini adalah bagian paling krusial. Kita harus menyuntikkan **Language Mandate** secara eksplisit ke dalam *system prompt* Gemini agar tidak terjadi kebocoran terjemahan (misal: prompt visual berbahasa Inggris, tapi naskah VO malah kembali ke bahasa Indonesia).

### **A. Update pada Prompt OPC (buildOrganicPillarPrompt):**

export function buildOrganicPillarPrompt(campaignData, productData, brandProfile, vsoData) {  
  const { content\_pillar, target\_language, /\* ... parameter lain ... \*/ } \= campaignData;  
    
  // Tentukan nama bahasa secara eksplisit  
  const languageName \= target\_language \=== 'en-US' ? 'ENGLISH (US)' : 'INDONESIAN';

  return \`  
Anda adalah Content Creator & Storyteller tingkat tinggi untuk MAKNA Engine V8.9.  
Tugas Anda adalah membuat storyboard dan skrip voiceover.

\---  
LANGUAGE MANDATE (SANGAT KETAT):  
Anda WAJIB menulis isi dari kolom "voiceover" (naskah suara) SEPENUHNYA dalam bahasa: \*\*${languageName}\*\*.  
\- Jika bahasa adalah ENGLISH: Gunakan gaya bahasa natural, slang TikTok US (misal: "POV", "hooked", "game-changer"), dan pastikan grammar sempurna.  
\- Jika bahasa adalah INDONESIAN: Gunakan bahasa kasual/gaul atau formal sesuai Tone of Voice.

... \[Sisa Prompt OPC Sesuai Blueprint Sebelumnya\] ...

FORMAT OUTPUT (JSON ARRAY):  
\[  
  {  
    "clip\_index": 1,  
    "generation\_mode": "T2V",  
    "voiceover": "\[WAJIB DITULIS DALAM BAHASA ${languageName}\]",  
    "t2v\_prompt": "Visual prompt always in English..."  
  }  
\]  
  \`;  
}

### **B. Update pada Prompt RE & Instant Factory:**

Lakukan penyuntikan blok LANGUAGE MANDATE yang sama persis seperti di atas ke dalam fungsi buildReverseEngineeringBridgePrompt dan fungsi *prompt builder* untuk *Instant Factory*.

## **4\. PENYELARASAN MENU TTS (VOICE PERSONA ROUTING)**

Jika pengguna memilih Bahasa Inggris (en-US), maka saat mereka masuk ke **Bagian Workflow / Audio Settings**, *dropdown* pilihan suara TTS MiniMax **WAJIB** secara dinamis menyesuaikan dan hanya menampilkan ID khusus berbahasa Inggris.

**Daftar MiniMax Voice IDs (English Curation):**

| Gender | Voice ID (Sistem) | Voice Name (UI) |
| :---- | :---- | :---- |
| **Pria** | English\_Resonant\_Man | Resonant Man |
| **Pria** | English\_Trustworth\_Man | Trustworthy Man |
| **Pria** | English\_causual\_narrator\_vv1 | Casual Narrator |
| **Pria** | English\_causual\_podcast\_vv1 | Casual Podcast |
| **Pria** | English\_expressive\_host\_\_vv1 | Expressive Host |
| **Wanita** | English\_instructive\_professor\_vv1 | Instructive Professor |
| **Wanita** | English\_nursery\_teacher\_vv2 | Nursery Teacher |
| **Wanita** | English\_captivating\_female1 | Captivating Female |
| **Wanita** | English\_radiant\_girl | Radiant Girl |
| **Wanita** | English\_CalmWoman | Calm Woman |

**Logika Frontend Dinamis (React / Vanilla JS):**

// Daftar array statis di frontend  
const minimaxIndonesianVoices \= \[  
  { id: 'Indonesian\_casual\_reporter\_vv2', name: 'Casual Reporter (Pria)' },  
  // ... (Sisa voice id bahasa Indonesia)  
\];

const minimaxEnglishVoices \= \[  
  { id: 'English\_Resonant\_Man', name: 'Resonant Man (Pria)' },  
  { id: 'English\_Trustworth\_Man', name: 'Trustworthy Man (Pria)' },  
  { id: 'English\_causual\_narrator\_vv1', name: 'Casual Narrator (Pria)' },  
  { id: 'English\_causual\_podcast\_vv1', name: 'Casual Podcast (Pria)' },  
  { id: 'English\_expressive\_host\_\_vv1', name: 'Expressive Host (Pria)' },  
  { id: 'English\_instructive\_professor\_vv1', name: 'Instructive Professor (Wanita)' },  
  { id: 'English\_nursery\_teacher\_vv2', name: 'Nursery Teacher (Wanita)' },  
  { id: 'English\_captivating\_female1', name: 'Captivating Female (Wanita)' },  
  { id: 'English\_radiant\_girl', name: 'Radiant Girl (Wanita)' },  
  { id: 'English\_CalmWoman', name: 'Calm Woman (Wanita)' }  
\];

function handleLanguageChange(selectedLang) {  
  const voiceDropdown \= document.getElementById('voice\_persona');  
  voiceDropdown.innerHTML \= ''; // Kosongkan opsi yang ada

  const activeVoices \= selectedLang \=== 'en-US' ? minimaxEnglishVoices : minimaxIndonesianVoices;

  activeVoices.forEach(voice \=\> {  
    const option \= document.createElement('option');  
    option.value \= voice.id;  
    option.textContent \= voice.name;  
    voiceDropdown.appendChild(option);  
  });  
}

## **5\. UJI KUALITAS (QA TESTING MATRIX)**

Saat Anda menguji fitur ini, pastikan elemen-elemen berikut tidak saling tumpang tindih (*Language Bleeding*):

1. **Kolom voiceover (JSON Output):** Harus murni berbahasa Inggris (jika en-US dipilih).  
2. **Kolom t2v\_prompt, t2i\_prompt, i2v\_prompt:** Harus **TETAP berbahasa Inggris** terlepas dari bahasa naskah VO yang dipilih. (Karena mesin AI Video seperti Veo/Imagen/Kling bekerja jauh lebih baik dengan prompt instruksional berbahasa Inggris).  
3. **Pengujian TTS:** Pastikan ketika mencoba mem-play audio en-US, suara yang keluar beraksen logat barat/US (*native English speaker*), bukan orang Indonesia yang mencoba membaca bahasa Inggris.

**EOF (End of Blueprint Document)**

*Dengan V8.9, MAKNA Engine resmi menjadi platform produksi konten kelas dunia yang tidak dibatasi oleh batas negara.*