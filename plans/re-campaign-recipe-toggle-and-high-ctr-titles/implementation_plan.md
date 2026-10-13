# Rencana Implementasi: Toggle Resep (Herbal, Rempah & Kuliner) dan YouTube High-CTR Title pada RE Campaign

## Ringkasan Eksekutif
Berdasarkan kebutuhan dan arahan pengguna:
1. **Opsi (Toggle) Hasilkan Resep**:
   - Dibuatkan opsi toggle pada formulir pembuatan kampanye Reverse Engineering (**RE Campaign** di `app/re-campaigns/page.js`).
   - Resep bersifat fleksibel dan komprehensif: mencakup **minuman herbal, racikan rempah, jamu tradisional, ramuan kesehatan alami, infused water, maupun masakan/kuliner umum**.
   - Ketika toggle ini aktif, sistem menginstruksikan AI Gemini mengekstrak bahan & takaran presisi, khasiat/manfaat, langkah-langkah pembuatan, dan pro-tip yang selaras dengan adegan visual hasil dekonstruksi video referensi.
   - Hasil teks resep lengkap disajikan langsung di dalam **Caption** media sosial (`social_media_package.caption`, `tiktok_caption`, `ig_caption`, dan `yt_desc`) sehingga otomatis terbawa ke ContentFlow Hub dan penjadwalan publikasi.

2. **Penyempurnaan Prompt Builder untuk YouTube Title High-CTR**:
   - Menghilangkan masalah judul terpotong / menggantung (seperti contoh sebelumnya: *"Bekerja di bawah atap tanpa insulasi sama seperti #Shorts"*).
   - Menetapkan aturan keras panjang karakter optimal layar YouTube Shorts mobile: **50–75 karakter (maksimal absolut 85 karakter)** dengan akhiran wajib tag `#Shorts`.
   - Menginjeksikan 5 formula psikologis High-CTR (*Curiosity Gap, Mistake Callout, Instant Solution, Counter-Intuitive Truth, Extreme Outcome*).
   - Menyediakan backend safety-net deterministik (`cleanYoutubeTitle`) untuk memvalidasi dan merapikan judul sebelum disimpan ke database.

3. **Simulasi Mockup HTML**:
   - Telah dibuat di [public/mockup_re_campaign_recipe_toggle.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_re_campaign_recipe_toggle.html) untuk simulasi interaktif alur toggle dan preview hasil output.

---

## Execution Task List
- [ ] **Task 1: Tambahkan Dukungan Skema Database & Repositori untuk `generate_recipe`** (`lib/db.js` & `lib/db-pg.js`)
- [ ] **Task 2: Tambahkan Toggle "Hasilkan Resep" di UI Pembuatan Kampanye RE** (`app/re-campaigns/page.js` & `app/api/v2/re-campaigns/route.js`)
- [ ] **Task 3: Perkaya Prompt Builder dengan Recipe Mandate (Herbal/Kuliner) & YouTube High-CTR Formula** (`lib/prompts.js`)
- [ ] **Task 4: Implementasikan Sanitasi & Integrasi Backend di Scheduler Processors** (`lib/scheduler-processors.js`)
- [ ] **Task 5: Buat dan Jalankan Suite Pengujian Otomatis** (`tests/re-campaign-recipe-and-titles.test.js`)
- [ ] **Task 6: Build Produksi Lokal, Verifikasi Zero Error, Rilis Patch Non-Interaktif, dan Deploy ke Dev & Staging Mac Mini**

---

## Before & After Code Snippets

### 1. `lib/db.js` & Migrasi PostgreSQL
Menambahkan kolom `generate_recipe` pada tabel `re_campaigns` dan parameter di `createReCampaign`.

#### Code Sebelum (Current/Before):
```javascript
export async function createReCampaign({
  id,
  campaign_name,
  execution_mode = 'manual_review',
  status = 'running',
  // ...
  ai_directive = null,
  mandatory_outro_line = null
}) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO re_campaigns (
      id, campaign_name, execution_mode, status, aspect_ratio, target_ai, custom_instruction, brand_profile_id,
      // ...
      ai_directive, mandatory_outro_line
    ) VALUES (
      // ...
    )
  `).run(...);
}
```

#### Code Sesudah (Proposed/After):
```javascript
export async function createReCampaign({
  id,
  campaign_name,
  execution_mode = 'manual_review',
  status = 'running',
  // ...
  ai_directive = null,
  mandatory_outro_line = null,
  generate_recipe = 0
}) {
  const db = getDb();
  // Idempotent column check for generate_recipe
  try {
    await db.prepare('ALTER TABLE re_campaigns ADD COLUMN generate_recipe INTEGER DEFAULT 0').run();
  } catch (_) {}

  return db.prepare(`
    INSERT INTO re_campaigns (
      id, campaign_name, execution_mode, status, aspect_ratio, target_ai, custom_instruction, brand_profile_id,
      // ...
      ai_directive, mandatory_outro_line, generate_recipe
    ) VALUES (
      // ...
    )
  `).run(...);
}
```

---

### 2. `app/re-campaigns/page.js`
Menambahkan state `generateRecipe`, Switch Toggle di Accordion 1, dan pengiriman payload ke API.

#### Code Sebelum (Current/Before):
```javascript
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [enableVoAudit, setEnableVoAudit] = useState(0);
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [aiDirective, setAiDirective] = useState('');
  const [mandatoryOutroLine, setMandatoryOutroLine] = useState('');
```
*dan pada pengiriman formData:*
```javascript
  formData.append('sfx_setting', sfxSetting);
  formData.append('enable_audio_segment', enableAudioSegment ? '1' : '0');
  formData.append('ai_directive', aiDirective);
  formData.append('mandatory_outro_line', mandatoryOutroLine);
```

#### Code Sesudah (Proposed/After):
```javascript
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [enableVoAudit, setEnableVoAudit] = useState(0);
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [generateRecipe, setGenerateRecipe] = useState(false);
  const [aiDirective, setAiDirective] = useState('');
  const [mandatoryOutroLine, setMandatoryOutroLine] = useState('');
```
*dan pada UI Accordion 1:*
```jsx
  <div className="form-group" style={{ marginBottom: 12 }}>
    <label className="form-label">🍳 Ekstraksi Resep / Racikan (Herbal, Rempah, Kuliner)</label>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-interactive)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
      <label className="switch">
        <input
          type="checkbox"
          checked={generateRecipe}
          onChange={e => setGenerateRecipe(e.target.checked)}
        />
        <span className="slider"></span>
      </label>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-color)' }}>
        <b>Hasilkan Teks Resep/Racikan Lengkap di Caption</b>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          AI Gemini akan mengekstrak bahan & takaran, khasiat/manfaat, langkah pembuatan, dan tips dari video, lalu menyajikannya di caption. Cocok untuk minuman herbal, rempah, jamu, maupun kuliner.
        </div>
      </div>
    </div>
  </div>
```
*dan pada pengiriman formData:*
```javascript
  formData.append('sfx_setting', sfxSetting);
  formData.append('enable_audio_segment', enableAudioSegment ? '1' : '0');
  formData.append('generate_recipe', generateRecipe ? '1' : '0');
  formData.append('ai_directive', aiDirective);
  formData.append('mandatory_outro_line', mandatoryOutroLine);
```

---

### 3. `lib/prompts.js`
Menambahkan Recipe Mandate (untuk minuman herbal, rempah, dan kuliner) serta YouTube Shorts High-CTR Mandate di `buildReverseEngineeringPrompt` dan `buildReverseEngineeringBridgePrompt`.

#### Code Sebelum (Current/Before):
```javascript
  "social_media_package": {
    "title": "Judul YouTube Shorts/Video yang click-worthy & memicu rasa penasaran (panjang optimal 50-70 karakter, maksimal 100 karakter). In ${targetLanguageLabel}.",
    "caption": "Single Universal Caption (terdiri dari Hook menarik, Value delivery, CTA universal, dan Hashtags relevan). In ${targetLanguageLabel}."
  }
```

#### Code Sesudah (Proposed/After):
```javascript
  const isRecipeActive = config?.generate_recipe === true || config?.generate_recipe === 1;

  const recipeMandateSection = isRecipeActive ? `
========================================================================
🍳 RECIPE & HERBAL CONCOCTION MANDATE [AKTIF]
========================================================================
Konten ini berfokus pada resep kuliner, minuman herbal, ramuan rempah, jamu tradisional, atau racikan kesehatan alami.
Anda WAJIB menyusun teks resep/racikan yang terperinci dan berkorelasi langsung dengan adegan video hasil dekonstruksi:
1. IDENTIFIKASI BAHAN & TAKARAN:
   - Sebutkan seluruh bahan baku atau rimpang/rempah alami (misal: jahe merah, kunyit, serai, temulawak, kayu manis, madu, atau bahan masakan).
   - Berikan takaran yang jelas dan aplikatif (sendok makan, gram, ruas jari, lembar, ml air).
2. LANGKAH PEMBUATAN / RACIKAN:
   - Tuliskan langkah-langkah bernomor yang runtut dan ringkas sesuai urutan adegan visual klip video.
3. KHASIAT / VALUE DELIVERY & PRO-TIP:
   - Jelaskan manfaat utama (misal: meredakan masuk angin, melancarkan peredaran darah, meningkatkan imunitas, atau tips agar resep anti-gagal).
4. PENYAJIAN DI CAPTION:
   - Anda WAJIB menyajikan format teks resep/racikan lengkap ini LANGSUNG di dalam field "caption" pada "social_media_package" (dan pada "tiktok_caption" / "ig_caption" / "yt_desc") dengan tata letak emoji yang rapi, estetik, dan siap posting!
========================================================================
` : '';

  const ytHighCtrTitleMandate = `
========================================================================
🔥 YOUTUBE SHORTS HIGH-CTR TITLE MANDATE [STRICT]
========================================================================
Untuk field "title" / "yt_title", Anda WAJIB merumuskan judul YouTube Shorts yang memikat penonton (high CTR) dengan ketentuan mutlak:
1. PANJANG & TAG WAJIB:
   - Panjang total HARUS antara 50 hingga 75 karakter (MAKSIMAL ABSOLUT 85 karakter).
   - WAJIB diakhiri tepat dengan tag: #Shorts
2. ANTI-CUTOFF GUARANTEE (DILARANG MENGGANTUNG):
   - Judul WAJIB berupa kalimat UTUH dan tuntas.
   - DILARANG KERAS menghasilkan judul terpotong di tengah kalimat atau menyisakan kata perbandingan menggantung (CONTOH SALAH: "...sama seperti #Shorts", "...ternyata bikin #Shorts").
3. FORMULA PSIKOLOGIS CLICK-WORTHY (Pilih salah satu):
   - [Curiosity Gap]: "Jangan Dibuang! Rebus Rimpang Ini Sebelum Tidur Bikin Badan Segar #Shorts"
   - [Mistake Callout]: "Kesalahan Fatal Seduh Madu! Enzim Alaminya Malah Rusak #Shorts"
   - [Fast Solution]: "Cuma Butuh 3 Rempah Dapur! Trik Alami Redakan Batuk & Flu #Shorts"
   - [Shocking Contrast]: "Bukan Obat! Ramuan Nenek Moyang Ini Ampuh Hangatkan Badan #Shorts"
========================================================================
`;
```

---

### 4. `lib/scheduler-processors.js`
Menyuntikkan `generate_recipe: campaign.generate_recipe === 1` dan menambahkan fungsi proteksi pembersihan judul YouTube (`cleanYoutubeTitle`).

#### Code Sebelum (Current/Before):
```javascript
    const parsed = parseGeminiJSON(result, campaign.voice_provider || 'gemini');
    if (typeof parsed.social_media_package === 'object' && parsed.social_media_package?.title && !parsed.yt_title) {
      parsed.yt_title = String(parsed.social_media_package.title).trim();
    }
    if (typeof parsed.social_media_package === 'object' && parsed.social_media_package?.caption && !parsed.yt_desc) {
      parsed.yt_desc = String(parsed.social_media_package.caption).trim();
    }
```

#### Code Sesudah (Proposed/After):
```javascript
    const parsed = parseGeminiJSON(result, campaign.voice_provider || 'gemini');
    if (typeof parsed.social_media_package === 'object' && parsed.social_media_package?.title && !parsed.yt_title) {
      parsed.yt_title = cleanYoutubeTitle(parsed.social_media_package.title, parsed.new_video_plan?.[0]?.new_vo);
    } else if (parsed.yt_title) {
      parsed.yt_title = cleanYoutubeTitle(parsed.yt_title, parsed.new_video_plan?.[0]?.new_vo);
    }
    if (typeof parsed.social_media_package === 'object' && parsed.social_media_package?.caption && !parsed.yt_desc) {
      parsed.yt_desc = String(parsed.social_media_package.caption).trim();
    }
```

---

## Verification Plan

### Automated Verification
1. **Unit Test Suite**:
   Jalankan `node --test tests/re-campaign-recipe-and-titles.test.js`:
   - Validasi struktur prompt saat `generate_recipe: true` dan `generate_recipe: false`.
   - Validasi fungsi `cleanYoutubeTitle()` dalam memotong kalimat menggantung dan memastikan tag `#Shorts`.
   - Validasi integritas JSON output Gemini.
2. **Cluster Health & Ingest Test**:
   Jalankan `node scripts/test-cluster-health.js` dan pastikan database migrasi berjalan mulus tanpa mengganggu antrean kampanye lain.

### Manual Verification by User
1. Buka browser ke Web App MAKNA Flow -> Menu **RE Campaign** (`/re-campaigns`).
2. Klik tombol Buat Kampanye, buka Accordion 1, periksa kehadiran Toggle **"Hasilkan Resep / Racikan (Herbal, Rempah, Kuliner)"**.
3. Coba buat satu kampanye uji coba dengan toggle aktif, jalankan, dan periksa bahwa naskah caption pada hasil dekonstruksi memuat teks resep/racikan lengkap dan judul YouTube Shorts bernilai High-CTR tanpa terpotong.
4. Anda juga dapat menguji visual interaktifnya di [public/mockup_re_campaign_recipe_toggle.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_re_campaign_recipe_toggle.html).
