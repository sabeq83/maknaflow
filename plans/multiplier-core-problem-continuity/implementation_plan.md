# Implementation Plan: Multiplier Lab Core Problem & Content Planner Matrix Continuity Engine

Rencana implementasi ini bertujuan untuk memastikan setiap sudut pandang (angles) dan hook baru yang dihasilkan di Multiplier Lab **mengadopsi Mesin Strategi Content Planner (CEP × W's Matrix × 30 Strategic Archetypes × HARM)**, **bersifat 100% dinamis tanpa batasan hardcoded 7 angle (mendukung 3, 5, 7, 10, 12, 15, s/d 20 angles)**, dan **selalu mengunci serta mempertahankan Masalah Utama (Core Problem / Pain Point)** dari narasi Blueprint aslinya agar AI tidak berhalusinasi melenceng ke masalah lain (seperti kasus pada kampanye `mul_261016_hdai8r` dari Blueprint `#0b3ef9bb`).

---

## 📋 Execution Task List

- [ ] **Task 1: Skema Database & Migrasi Kolom Masalah Utama**
  - [ ] Tambahkan kolom `core_problem`, `core_solution`, dan `target_audience_pain_point` pada tabel `re_deconstructed_assets` di [lib/db-pg.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/db-pg.js).
  - [ ] Perbarui daftar `allowed` fields pada `updateDeconstructAsset` di [lib/db.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/db.js).
  - [ ] Pastikan fungsi `createMultiplierBatch` di [lib/db.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/db.js) menyimpan `core_problem`, `hook_type`, `hook_text`, `target_persona`, `emotional_trigger`, `category_cep`, `ws_matrix`, `strategic_archetype`, dan `cta_type` ke dalam `rowBridging`.
- [ ] **Task 2: Integrasi Strategi Content Planner ke Multiplier Angle Generator**
  - [ ] Tambahkan fungsi ekstraksi `extractBlueprintCoreProblem` pada [lib/multiplier-angle-generator.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/multiplier-angle-generator.js) (membaca kolom atau fallback cerdas dari `viral_pattern_summary` & narasi adegan 1).
  - [ ] Perluas batas `angleCount` di [lib/multiplier-angle-generator.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/multiplier-angle-generator.js) dari batas lama (maks 10) menjadi dinamis hingga 20 angles (`Math.min(Math.max(parseInt(angleCount, 10) || 5, 3), 20)`).
  - [ ] Integrasikan Matriks Permutasi Content Planner ke dalam Prompt Gemini:
    - 6 Kategori CEP (Problem-Solution, Routine, Commitment, Aspirational, Opportunistic, Emotional).
    - W's Matrix (When, Where, With/For Whom, How Feeling, While, With What, Why).
    - The Infinite Strategic Angle Matrix (30 Archetypes dari `STRATEGIC_FRAMEWORKS_v47.9.md` Section XII).
    - Historical Anti-Repetition Memory (HARM) via `getExcludedAnglesHistory(blueprintId)`.
  - [ ] Tambahkan aturan tegas **MANDAT KONSISTENSI MASALAH UTAMA (STRICT PROBLEM CONTINUITY)** pada prompt Gemini: Permutasi CEP dan W's Matrix bebas bervariasi, namun seluruh angle WAJIB tetap menyelesaikan masalah utama yang sama dari Blueprint.
  - [ ] Pastikan output JSON array menyertakan `core_problem`, `category_cep`, `ws_matrix`, dan `strategic_archetype` pada setiap item sudut pandang.
- [ ] **Task 3: Perbaikan Payload UI & Fleksibilitas Jumlah Angle di Multiplier Lab**
  - [ ] Perluas opsi dropdown jumlah angle di [app/multiplier-lab/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/multiplier-lab/page.js) (3, 5, 7, 10, 12, 15, 20 Sudut Pandang).
  - [ ] Perbaiki pemetaan `rows` pada fungsi `handleStartCampaign` di [app/multiplier-lab/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/multiplier-lab/page.js) agar `angle_title`, `hook_type`, `hook_text`, `target_persona`, `emotional_trigger`, `cta_type`, `category_cep`, `ws_matrix`, `strategic_archetype`, dan `core_problem` tidak terhapus.
  - [ ] Perbarui `generateCombinationRows` di [app/multiplier-lab/page.js](file:///Users/sabeqmmursyid/_contentflow-staging/app/multiplier-lab/page.js) untuk menyertakan `core_problem` dan atribut matriks Content Planner.
  - [ ] Tampilkan informasi "Masalah Utama Terdeteksi" dan badge "Content Planner Matrix Engine" pada panel konfigurasi Multiplier Lab.
- [ ] **Task 4: Penguncian Masalah Utama pada Phase 2 Storyboard Remake Prompt**
  - [ ] Perbarui `buildMultiplierPhase2Prompt` pada [lib/prompts.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/prompts.js) agar menyuntikkan `coreProblem` dan metadata angle ke dalam naskah voiceover dan resep, memastikan voiceover adegan 1 s/d selesai tetap menyelesaikan masalah utama tersebut.
- [ ] **Task 5: Upgrade Engine Dekonstruksi V2 (Ekstraksi Otomatis Sejak Awal)**
  - [ ] Perbarui `buildDeconstructPhase1Prompt` pada [lib/prompts.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/prompts.js) agar Gemini secara eksplisit merumuskan `core_problem`, `core_solution`, dan `target_audience_pain_point`.
  - [ ] Perbarui handler dekonstruksi pada [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_contentflow-staging/lib/scheduler-processors.js) untuk menyimpan field baru tersebut ke `re_deconstructed_assets`.
- [ ] **Task 6: Skrip Backfill Masalah Utama pada Seluruh Blueprint Eksisting**
  - [ ] Buat skrip [scripts/backfill-blueprint-core-problems.mjs](file:///Users/sabeqmmursyid/_contentflow-staging/scripts/backfill-blueprint-core-problems.mjs) untuk membaca `viral_pattern_summary` dan narasi asli dari 148 aset di Staging / 20 aset di Dev, lalu mengisi kolom `core_problem`, `core_solution`, dan `target_audience_pain_point`.
- [ ] **Task 7: Unit Testing & Verifikasi End-to-End**
  - [ ] Buat file pengujian otomatis `tests/multiplier-core-problem.test.js` untuk memverifikasi kesinambungan masalah utama, variasi Content Planner matrix (CEP & W's Matrix), dukungan jumlah angle fleksibel (3-20), dan persistence database.
  - [ ] Jalankan test suite dan verifikasi seluruh skenario berhasil tanpa regresi.

---

## 🔍 Before & After Code Snippets

### 1. `lib/db-pg.js` (Migrasi Kolom `core_problem` pada `re_deconstructed_assets`)

#### Code Sebelum (Current/Before):
```javascript
// lib/db-pg.js
          CREATE TABLE IF NOT EXISTS re_deconstructed_assets (
            id TEXT PRIMARY KEY,
            batch_id TEXT,
            source_url TEXT,
            original_caption TEXT,
            local_video_path TEXT,
            gemini_file_uri TEXT,
            original_storyboard_json TEXT,
            product_ideas_json TEXT,
            viral_pattern_summary TEXT,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            tags TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            niche TEXT,
            queued_at TIMESTAMP,
            deconstructed_at TIMESTAMP,
            updated_at TIMESTAMP,
            page_source TEXT
          );
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/db-pg.js
          CREATE TABLE IF NOT EXISTS re_deconstructed_assets (
            id TEXT PRIMARY KEY,
            batch_id TEXT,
            source_url TEXT,
            original_caption TEXT,
            local_video_path TEXT,
            gemini_file_uri TEXT,
            original_storyboard_json TEXT,
            product_ideas_json TEXT,
            viral_pattern_summary TEXT,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            tags TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            niche TEXT,
            queued_at TIMESTAMP,
            deconstructed_at TIMESTAMP,
            updated_at TIMESTAMP,
            page_source TEXT,
            core_problem TEXT,
            core_solution TEXT,
            target_audience_pain_point TEXT
          );

          // Kolom migrasi aman IF NOT EXISTS:
          await client.query(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS core_problem TEXT;`);
          await client.query(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS core_solution TEXT;`);
          await client.query(`ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS target_audience_pain_point TEXT;`);
```

---

### 2. `lib/db.js` (`updateDeconstructAsset` & `createMultiplierBatch`)

#### Code Sebelum (Current/Before):
```javascript
// lib/db.js:L3023
  const allowed = [
    'batch_id', 'source_url', 'page_source', 'original_caption', 'local_video_path',
    'gemini_file_uri', 'original_storyboard_json', 'product_ideas_json',
    'viral_pattern_summary', 'status', 'error_message', 'tags', 'niche',
    'queued_at', 'deconstructed_at', 'updated_at'
  ];
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/db.js:L3023
  const allowed = [
    'batch_id', 'source_url', 'page_source', 'original_caption', 'local_video_path',
    'gemini_file_uri', 'original_storyboard_json', 'product_ideas_json',
    'viral_pattern_summary', 'status', 'error_message', 'tags', 'niche',
    'queued_at', 'deconstructed_at', 'updated_at',
    'core_problem', 'core_solution', 'target_audience_pain_point'
  ];
```

Dan pada `createMultiplierBatch`:
#### Code Sebelum (Current/Before):
```javascript
// lib/db.js:L3191
      const rowBridging = {
        ...(batch.shared_config?.bridging || {}),
        ...(row.bridging || {}),
        campaign_name: campaignName,
        brand_profile_id: brandProfileId,
        account_name: accountName,
        brandName: accountName,
        campaign_type: row.campaign_type || batch.shared_config?.bridging?.campaign_type || 'product_campaign',
        editorialTopic: row.editorial_topic || row.angle_title || batch.shared_config?.bridging?.editorialTopic || '',
        editorialOutro: row.editorial_outro || batch.shared_config?.bridging?.editorialOutro || '',
        angleTitle: row.angle_title || row.editorial_topic || '',
        hookType: row.hook_type || '',
        hookText: row.hook_text || '',
        targetPersona: row.target_persona || '',
        emotionalTrigger: row.emotional_trigger || '',
        ctaType: row.cta_type || '',
        nicheKbName: row.niche_kb_name || batch.shared_config?.bridging?.nicheKbName || '',
        generate_recipe: generateRecipe
      };
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/db.js:L3191
      const rowBridging = {
        ...(batch.shared_config?.bridging || {}),
        ...(row.bridging || {}),
        campaign_name: campaignName,
        brand_profile_id: brandProfileId,
        account_name: accountName,
        brandName: accountName,
        campaign_type: row.campaign_type || batch.shared_config?.bridging?.campaign_type || 'product_campaign',
        editorialTopic: row.editorial_topic || row.angle_title || batch.shared_config?.bridging?.editorialTopic || '',
        editorialOutro: row.editorial_outro || batch.shared_config?.bridging?.editorialOutro || '',
        angleTitle: row.angle_title || row.editorial_topic || '',
        hookType: row.hook_type || row.hookType || '',
        hookText: row.hook_text || row.hookText || '',
        targetPersona: row.target_persona || row.targetPersona || '',
        emotionalTrigger: row.emotional_trigger || row.emotionalTrigger || '',
        ctaType: row.cta_type || row.ctaType || '',
        category_cep: row.category_cep || row.categoryCep || '',
        ws_matrix: row.ws_matrix || row.wsMatrix || '',
        strategic_archetype: row.strategic_archetype || row.strategicArchetype || '',
        core_problem: row.core_problem || row.coreProblem || batch.shared_config?.bridging?.core_problem || '',
        nicheKbName: row.niche_kb_name || batch.shared_config?.bridging?.nicheKbName || '',
        generate_recipe: generateRecipe
      };
```

---

### 3. `lib/multiplier-angle-generator.js` (Integrasi Content Planner Matrix Engine)

#### Code Sebelum (Current/Before):
```javascript
// lib/multiplier-angle-generator.js:L268
  const requestedCount = Math.min(Math.max(parseInt(angleCount, 10) || 5, 3), 10);

  const prompt = `
Anda adalah Chief Viral Strategist & Retention Algorithm Expert kelas dunia untuk Facebook Content Monetization (Reels & In-Stream Ads) di MAKNA Flow.
...
## 📐 MATRIKS 5-SUMBU PERMUTASI (WAJIB DIVERSIFIKASI SESUAI TOPIK):
Setiap angle yang Anda ciptakan WAJIB mengambil kombinasi sumbu yang berbeda sesuai niche "${anchorDNA.nicheLabel}":
1. Sumbu Persona
2. Sumbu Momen/Waktu
3. Sumbu Format Hook
4. Sumbu Emosi
5. Sumbu CTA Bait
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/multiplier-angle-generator.js:L268
  // Mendukung pembuatan sudut pandang dinamis dari 3 hingga 20 angles
  const requestedCount = Math.min(Math.max(parseInt(angleCount, 10) || 5, 3), 20);

  const prompt = `
Anda adalah Chief Viral Strategist & Retention Algorithm Expert kelas dunia di MAKNA Flow.

TUGAS ANDA:
Menganalisis aset Visual Blueprint referensi dan menghasilkan **${requestedCount} SUDUT PANDANG (EDITORIAL ANGLES) YANG 100% UNIK, SEGAR, DAN VIRAL-OPTIMIZED** dengan menerapkan **CONTENT PLANNER STRATEGIC MATRIX (CEP × W'S MATRIX × 30 STRATEGIC ARCHETYPES)**.

---

## 🎯 DATA VISUAL BLUEPRINT REFERENSI & MASALAH UTAMA (CORE ANCHOR):
- Blueprint ID: ${primaryBp.id}
- Niche Terdeteksi: ${anchorDNA.nicheLabel} (${anchorDNA.detectedNiche})
- Masalah Utama Pokok (LOCKED): "${primaryBp.core_problem || anchorDNA.coreProblem}"
${anchorDNA.coreSolution ? `- Solusi Inti Pokok (LOCKED): "${anchorDNA.coreSolution}"\n` : ''}${anchorDNA.extractedIngredients.length > 0 ? `- Bahan Baku Pokok Visual (LOCKED): ${anchorDNA.extractedIngredients.join(', ')}\n` : ''}- Rincian Adegan Visual & Voiceover Asli:
${sceneSummaries}

---

## 🔒 MANDAT KESINAMBUNGAN MASALAH UTAMA (STRICT CORE PROBLEM CONTINUITY):
1. **KUNCI MASALAH UTAMA (DILARANG KERAS MENGGANTI MASALAH)**:
   - Seluruh ${requestedCount} sudut pandang yang Anda hasilkan WAJIB 100% berakar dan menyelesaikan MASALAH UTAMA di atas ("${primaryBp.core_problem || anchorDNA.coreProblem}")!
   - JIKA Blueprint membahas [Membakar Lemak Perut Alami], maka SELURUH ${requestedCount} angle WAJIB tetap seputar membakar lemak perut alami tersebut! DILARANG KERAS berhalusinasi mengganti masalah menjadi perut begah, kecanduan kopi, stamina keluarga, susah tidur, atau hemat biaya kost!
2. **DIVERSIFIKASI HANYA PADA PERSPEKTIF AUDIENS (BUKAN MENGGANTI MASALAH POKOK)**:
   - Variasi dilakukan melalui permutasi Matriks Content Planner di bawah ini, sehingga audiens yang berbeda merasakan kedekatan emosional terhadap solusi masalah utama tersebut.

---

## 🧬 MATRIKS STRATEGI CONTENT PLANNER (PANDUAN PERMUTASI DINAMIS):
Setiap angle dari ${requestedCount} angle yang Anda ciptakan WAJIB mengombinasikan 3 dimensi strategi berikut:

### 1. Kategori CEP (Category Entry Points - Pilih 1 per Baris):
- Problem-Solution Based: Mengatasi keluhan fisik/kesehatan mendesak
- Routine-Based: Rutinitas harian (pagi sebelum ngantor, sarapan praktis)
- Commitment-Based: Disiplin & dedikasi (defisit kalori, tantangan 7 hari)
- Aspirational-Based: Menuju lingkar tubuh ideal & perbaikan kualitas hidup
- Opportunistic-Based: Solusi cerdas, modal murah bahan dapur
- Emotional-Based: Meredakan stres, rasa bersalah makan banyak, ngidam malam

### 2. W's Matrix (Pilih & Gabungkan Minimal 2 Variabel per Baris):
- When? (Pagi hari sebelum ngantor, malam jam 10 sebelum tidur, sore saat energi drop)
- Where? (Dapur kost, meja kantor, gym, ruang makan keluarga)
- With/For Whom? (Sendiri, ibu pasca melahirkan, pasangan, lansia)
- How Feeling? (Frustrasi timbangan stuck, kancing celana sesak, bersalah makan gorengan)
- While? (Sambil lembur kerja, sambil bersiap pagi, sehabis olahraga ringan)
- With What? (Panci kost sederhana, modal 5 ribu perak, 2 rempah dapur)
- Why? (Detoksifikasi alami, susut lingkar pinggang, hilangkan lemak visceral)

### 3. The Infinite Strategic Angle Matrix (30 Archetypes dari KB):
Gunakan variasi archetype yang berbeda tajam antar baris (Life Hack, Cost of Inaction, Myth Buster, 7-Day Challenge, Scientific Proof, Pure Relief, Ancient Wisdom, Second Chance, Sensory ASMR, Secret Club, Minimalist, dll).

---

## 🛡️ ATURAN ANTI-DUPLIKASI (HISTORICAL ANTI-REPETITION MEMORY):
DILARANG KERAS mengulangi sudut pandang yang mirip dengan riwayat sebelumnya:
${excludedAngles.length > 0 ? excludedAngles.map((ex, i) => `${i + 1}. "${ex}"`).join('\n') : '(Belum ada riwayat sebelumnya. Pastikan semua variasi saling berbeda tajam).'}

---

## 📤 FORMAT OUTPUT (WAJIB STRICT VALID JSON ARRAY):
[
  {
    "angle_id": "ang_1",
    "title": "Judul Angle Singkat & Menarik (Maks 10 Kata)",
    "category_cep": "Problem-Solution | Routine | Commitment | Aspirational | Opportunistic | Emotional",
    "ws_matrix": "When (Pagi) + While (Sebelum Ngantor)",
    "strategic_archetype": "The Habit Replacement | The Cost of Inaction | The 7-Day Challenge | ...",
    "target_persona": "Target Audiens Spesifik",
    "emotional_trigger": "Emosi & Masalah Utama yang Disentuh",
    "hook_text": "Naskah Hook 0 - 3 Detik Pertama (Wajib sangat kuat & memikat)",
    "vo_preview": "Draft kelanjutan naskah Voice-Over Scene 2 & 3 yang sinkron dengan visual blueprint",
    "recommended_voice": "Warm Mentor | Cozy ASMR Whisper | Energetic Inspiring | Wise Storyteller",
    "cta_type": "Komen 'IKUTAN' | Share ke teman | Simpan video ini",
    "core_problem": "${primaryBp.core_problem || anchorDNA.coreProblem}"
  }
]
`;
```

---

### 4. `app/multiplier-lab/page.js` (Pilihan Jumlah Angle & Payload Lengkap)

#### Code Sebelum (Current/Before):
```jsx
// app/multiplier-lab/page.js:L1468
<select className="form-input" value={angleCount} onChange={e => setAngleCount(Number(e.target.value))}>
  <option value={3}>3 Sudut Pandang (Quick Test)</option>
  <option value={5}>5 Sudut Pandang (Standard Viral Pack)</option>
  <option value={7}>7 Sudut Pandang (Deep Matrix)</option>
  <option value={10}>10 Sudut Pandang (Full Saturation)</option>
</select>
```

#### Code Sesudah (Proposed/After):
```jsx
// app/multiplier-lab/page.js:L1468
<select className="form-input" value={angleCount} onChange={e => setAngleCount(Number(e.target.value))}>
  <option value={3}>3 Sudut Pandang (Quick Test)</option>
  <option value={5}>5 Sudut Pandang (Standard Viral Pack)</option>
  <option value={7}>7 Sudut Pandang (Deep Matrix)</option>
  <option value={10}>10 Sudut Pandang (Full Saturation)</option>
  <option value={12}>12 Sudut Pandang (Content Planner 12-Pack)</option>
  <option value={15}>15 Sudut Pandang (Mega Campaign Pack)</option>
  <option value={20}>20 Sudut Pandang (Ultra Matrix Pack)</option>
</select>
```

Dan pada mapping payload `handleStartCampaign`:
#### Code Sebelum (Current/Before):
```javascript
// app/multiplier-lab/page.js:L896
        rows: combinationRows.map(row => ({
          deconstruct_asset_id: row.deconstruct_asset_id,
          target_product_id: row.target_product_id,
          target_product_url: row.target_product_url,
          affiliate_url: row.affiliate_url,
          campaign_name: cleanCampaignName,
          brand_profile_id: selectedBrandId || null,
          account_name: accountName || null,
          campaign_type: row.campaign_type || (isPureStory ? 'pure_storytelling' : 'product_campaign'),
          status: targetInitialStatus,
          editorial_topic: row.editorial_topic || editorialTopic.trim(),
          editorial_outro: row.editorial_outro || editorialOutro.trim()
        })),
```

#### Code Sesudah (Proposed/After):
```javascript
// app/multiplier-lab/page.js:L896
        rows: combinationRows.map(row => ({
          deconstruct_asset_id: row.deconstruct_asset_id,
          target_product_id: row.target_product_id,
          target_product_url: row.target_product_url,
          affiliate_url: row.affiliate_url,
          campaign_name: cleanCampaignName,
          brand_profile_id: selectedBrandId || null,
          account_name: accountName || null,
          campaign_type: row.campaign_type || (isPureStory ? 'pure_storytelling' : 'product_campaign'),
          status: targetInitialStatus,
          editorial_topic: row.editorial_topic || editorialTopic.trim(),
          editorial_outro: row.editorial_outro || editorialOutro.trim(),
          angle_title: row.angle_title || row.editorial_topic || '',
          hook_type: row.hook_type || '',
          hook_text: row.hook_text || '',
          target_persona: row.target_persona || '',
          emotional_trigger: row.emotional_trigger || '',
          cta_type: row.cta_type || '',
          category_cep: row.category_cep || '',
          ws_matrix: row.ws_matrix || '',
          strategic_archetype: row.strategic_archetype || '',
          core_problem: row.core_problem || '',
          niche_kb_name: row.niche_kb_name || selectedNicheKb || ''
        })),
```

---

### 5. `lib/prompts.js` (`buildMultiplierPhase2Prompt`)

#### Code Sebelum (Current/Before):
```javascript
// lib/prompts.js:L2810
  const dataSection = isPureStorytelling
    ? `---
### TOPIK & SUDUT PANDANG CERITA (ORGANIC MONETIZATION - NON-PRODUK):
- Judul / Angle Spesifik: "${angleTitle || productDesc || 'Refleksi mendalam & pesan bernilai tinggi'}"
${targetPersona ? `- Target Persona / Audiens: "${targetPersona}"\n` : ''}${hookType ? `- Tipe Hook Pembuka: "${hookType}"\n` : ''}${hookText ? `- Panduan Hook 0-3s: "${hookText}" (Gunakan atau variasikan hook ini untuk Scene 1)\n` : ''}${emotionalTrigger ? `- Trigger Emosi Utama: "${emotionalTrigger}"\n` : ''}${ctaType ? `- Rekomendasi CTA Interaksi: "${ctaType}"\n` : ''}- Pesan Penutup / Outro: "${productUsp || mandatoryOutroLine || 'Pesan moral penutup / CTA interaksi'}"
${nicheKbSnippet ? `\n### PANDUAN DOMAIN KHUSUS (NICHE KB):\n${nicheKbSnippet}\n` : ''}`
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/prompts.js:L2810
  const coreProblem = bridging?.core_problem || bridging?.coreProblem || '';
  const categoryCep = bridging?.category_cep || bridging?.categoryCep || '';
  const wsMatrix = bridging?.ws_matrix || bridging?.wsMatrix || '';
  const strategicArchetype = bridging?.strategic_archetype || bridging?.strategicArchetype || '';

  const dataSection = isPureStorytelling
    ? `---
### TOPIK & SUDUT PANDANG CERITA (ORGANIC MONETIZATION - NON-PRODUK):
- Judul / Angle Spesifik: "${angleTitle || productDesc || 'Refleksi mendalam & pesan bernilai tinggi'}"
${coreProblem ? `- Masalah Utama Blueprint (Wajib Diselesaikan Konten): "${coreProblem}"\n` : ''}${strategicArchetype ? `- Strategic Archetype: "${strategicArchetype}"\n` : ''}${categoryCep ? `- Category CEP: "${categoryCep}"\n` : ''}${wsMatrix ? `- W's Matrix Context: "${wsMatrix}"\n` : ''}${targetPersona ? `- Target Persona / Audiens: "${targetPersona}"\n` : ''}${hookType ? `- Tipe Hook Pembuka: "${hookType}"\n` : ''}${hookText ? `- Panduan Hook 0-3s: "${hookText}" (Gunakan atau variasikan hook ini untuk Scene 1)\n` : ''}${emotionalTrigger ? `- Trigger Emosi Utama: "${emotionalTrigger}"\n` : ''}${ctaType ? `- Rekomendasi CTA Interaksi: "${ctaType}"\n` : ''}- Pesan Penutup / Outro: "${productUsp || mandatoryOutroLine || 'Pesan moral penutup / CTA interaksi'}"
${nicheKbSnippet ? `\n### PANDUAN DOMAIN KHUSUS (NICHE KB):\n${nicheKbSnippet}\n` : ''}`
```

---

### 6. `lib/prompts.js` (`buildDeconstructPhase1Prompt`)

#### Code Sebelum (Current/Before):
```javascript
// lib/prompts.js:L2580
### C. VIRAL PATTERN SUMMARY
Rangkuman 3-5 kalimat tentang POLA VIRAL apa yang digunakan video ini:
- Teknik hook apa yang digunakan?
- Emosi apa yang mendominasi?
- Mengapa format ini efektif untuk engagement?
- Saran adaptasi untuk produk lain.

### D. AUTO-DETECT NICHE & KEYWORDS (TAGS)
1. **niche**: ${nicheInstruction}
2. **tags**: Tentukan 5-10 kata kunci (keywords) terbaik dan paling relevan dengan isi dan visual video tersebut...
```

#### Code Sesudah (Proposed/After):
```javascript
// lib/prompts.js:L2580
### C. RUMUSAN MASALAH UTAMA & SOLUSI POKOK (CORE PROBLEM & SOLUTION)
Rumuskan secara jelas dan padat akar masalah dan solusi yang diangkat narasi video:
1. **core_problem**: Masalah utama / keluhan terbesar yang ingin diselesaikan oleh narasi video (contoh: "Membakar dan merontokkan lemak perut secara alami tanpa obat pelangsing kimia berbahaya").
2. **core_solution**: Solusi inti atau racikan utama yang diajarkan (contoh: "Rebusan kayu manis cengkeh 8 menit dengan perasan lemon segar").
3. **target_audience_pain_point**: Penderitaan / kekhawatiran spesifik audiens sasaran (contoh: "Frustrasi dengan lemak perut membandel yang tak kunjung susut dan takut efek samping pil diet").

### D. VIRAL PATTERN SUMMARY
Rangkuman 3-5 kalimat tentang POLA VIRAL apa yang digunakan video ini...

### E. AUTO-DETECT NICHE & KEYWORDS (TAGS)
1. **niche**: ${nicheInstruction}
2. **tags**: Tentukan 5-10 kata kunci...
```

---

## 🚀 Prosedur Verifikasi & Pengujian

1. **Simulasi Visual Interaktif (Mockup HTML)**:
   - File mockup telah diperbarui di [public/mockup_multiplier_core_problem.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_multiplier_core_problem.html).
   - Pengguna dapat menguji dropdown jumlah angle dinamis (3, 5, 7, 10, 12, 15, 20), melihat kolom permutasi **Category CEP**, **W's Matrix**, dan **Strategic Archetype**, serta menguji toggle penguncian masalah utama.
2. **Automated Unit Testing (`tests/multiplier-core-problem.test.js`)**:
   - Memastikan `extractBlueprintAnchorDNA` mengekstrak `coreProblem`.
   - Memastikan `generateDynamicMultiplierAngles` menghasilkan array dinamis dengan jumlah sesuai request (3 s/d 20) di mana setiap item membawa `core_problem`, `category_cep`, `ws_matrix`, dan `strategic_archetype`.
   - Memastikan payload `re_multiplier_tasks` menyimpan seluruh atribut strategi tanpa ada field yang hilang.
3. **Verifikasi Database & Skrip Backfill**:
   - Menjalankan migrasi kolom PostgreSQL secara aman (`core_problem`, `core_solution`, `target_audience_pain_point`).
   - Menjalankan skrip `backfill-blueprint-core-problems.mjs` untuk mengisi data `core_problem` pada Blueprint eksisting di Staging (`148` item) dan Dev (`20` item).
