# Rencana Implementasi: Toggle Resep (Herbal, Rempah & Kuliner) dan YouTube High-CTR Title pada Multiplier Lab

## Ringkasan Eksekutif
Fitur **Toggle Resep / Racikan** dan formula **YouTube High-CTR Title** yang sebelumnya telah sukses diimplementasikan pada **RE Campaign** kini diintegrasikan ke **Multiplier Lab** (`app/multiplier-lab/page.js`, `lib/re-multiplier-worker.js`, dan `lib/prompts.js`).

### Manfaat & Use Case di Multiplier Lab:
1. **Multiplikasi Varian Racikan Herbal/Kuliner**:
   Dari 1 video referensi dekonstruksi racikan herbal (misal: jahe merah, kunyit, serai), Multiplier Lab dapat memproduksi 3–5 variasi angle konten yang berbeda (Angle Solutif, Angle Kesalahan/Mistake, Angle Ramuan Nenek Moyang).
2. **Resep Lengkap di Caption Tiap Varian**:
   Ketika toggle aktif, seluruh variasi video yang digandakan oleh Gemini AI akan memuat **teks resep/racikan lengkap** (bahan & takaran presisi, langkah peracikan berurutan, khasiat kesehatan alami, tips praktis, CTA & hashtag) langsung di dalam caption.
3. **YouTube Shorts High-CTR Anti-Cutoff**:
   Setiap varian angle otomatis mendapatkan judul YouTube Shorts click-worthy sepanjang 50–75 karakter (maks 85 karakter) diakhiri tag `#Shorts`, tuntas tanpa kata menggantung (*anti-cutoff guarantee*).

### Simulasi Mockup HTML:
File mockup simulasi interaktif telah dibuat dan siap diuji di:
[public/mockup_multiplier_lab_recipe_toggle.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_multiplier_lab_recipe_toggle.html).

---

## Execution Task List
- [x] **Task 1: Migrasi Skema Database `generate_recipe` & `yt_title` untuk Multiplier Lab** (`lib/db.js` & `lib/db-pg.js`)
- [x] **Task 2: Tambahkan Switch Toggle & Integrasi Preset pada UI Multiplier Lab** (`app/multiplier-lab/page.js` & `app/api/v2/multiplier/route.js`)
- [x] **Task 3: Perkaya `buildMultiplierPhase2Prompt` dengan Recipe Mandate & YouTube High-CTR Mandate** (`lib/prompts.js`)
- [x] **Task 4: Integrasikan Sanitasi `cleanYoutubeTitle()` dan Penyimpanan di Worker Multiplier** (`lib/re-multiplier-worker.js`)
- [x] **Task 5: Buat dan Jalankan Suite Pengujian Otomatis Multiplier** (`tests/multiplier-recipe-and-titles.test.js`)
- [x] **Task 6: Build Produksi Lokal, Verifikasi Zero Error, Rilis Patch Non-Interaktif, dan Deploy ke Server Dev Mac Mini (Tanpa Staging)**

---

## Before & After Code Snippets

### 1. `lib/db.js` & `lib/db-pg.js`
Menambahkan kolom `generate_recipe` dan `yt_title` pada tabel `re_multiplier_tasks` dan `re_multiplier_batches`.

#### Code Sebelum (Current/Before) — `lib/db.js`:
```javascript
export async function createMultiplierTask(data) {
  const tenantId = getActiveTenantId();
  const db = getDb();
  db.prepare(`
    INSERT INTO re_multiplier_tasks (
      id, tenant_id, deconstruct_asset_id, target_product_id, target_product_url, affiliate_url,
      vso_config_json, bridging_config_json, audio_config_json, status, enable_vo_audit,
      batch_id, row_index, product_snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    tenantId,
    data.deconstruct_asset_id,
    data.target_product_id || null,
    data.target_product_url || null,
    data.affiliate_url || null,
    data.vso_config_json || null,
    data.bridging_config_json || null,
    data.audio_config_json || null,
    data.status || 'pending_resolution',
    data.enable_vo_audit !== undefined ? Number(data.enable_vo_audit) : 1,
    data.batch_id || null,
    data.row_index !== undefined ? data.row_index : null,
    data.product_snapshot_json || null
  );
  return data.id;
}
```

#### Code Sesudah (Proposed/After) — `lib/db.js`:
```javascript
export async function createMultiplierTask(data) {
  const tenantId = getActiveTenantId();
  const db = getDb();
  // Idempotent column checks
  try { db.prepare('ALTER TABLE re_multiplier_tasks ADD COLUMN generate_recipe INTEGER DEFAULT 0').run(); } catch(_) {}
  try { db.prepare('ALTER TABLE re_multiplier_tasks ADD COLUMN yt_title TEXT').run(); } catch(_) {}

  db.prepare(`
    INSERT INTO re_multiplier_tasks (
      id, tenant_id, deconstruct_asset_id, target_product_id, target_product_url, affiliate_url,
      vso_config_json, bridging_config_json, audio_config_json, status, enable_vo_audit,
      batch_id, row_index, product_snapshot_json, generate_recipe, yt_title
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    tenantId,
    data.deconstruct_asset_id,
    data.target_product_id || null,
    data.target_product_url || null,
    data.affiliate_url || null,
    data.vso_config_json || null,
    data.bridging_config_json || null,
    data.audio_config_json || null,
    data.status || 'pending_resolution',
    data.enable_vo_audit !== undefined ? Number(data.enable_vo_audit) : 1,
    data.batch_id || null,
    data.row_index !== undefined ? data.row_index : null,
    data.product_snapshot_json || null,
    data.generate_recipe !== undefined ? Number(data.generate_recipe) : 0,
    data.yt_title || null
  );
  return data.id;
}
```

---

### 2. `app/multiplier-lab/page.js`
Menambahkan state `generateRecipe`, persistensi ke konfigurasi Preset, dan Switch Toggle pada Accordion 1.

#### Code Sebelum (Current/Before):
```javascript
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [enableVoAudit, setEnableVoAudit] = useState(1);
```

#### Code Sesudah (Proposed/After):
```javascript
  const [sfxSetting, setSfxSetting] = useState('without_sfx');
  const [enableAudioSegment, setEnableAudioSegment] = useState(false);
  const [enableVoAudit, setEnableVoAudit] = useState(1);
  const [generateRecipe, setGenerateRecipe] = useState(false);
```

*Pada UI Accordion 1 (Basic Creative Strategy):*
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
        <b>Hasilkan Teks Resep/Racikan Lengkap di Caption Tiap Varian Angle</b>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          AI Gemini akan mengekstrak bahan & takaran, khasiat/manfaat, langkah pembuatan, dan tips dari video, lalu menyajikannya di caption seluruh variasi angle yang digandakan.
        </div>
      </div>
    </div>
  </div>
```

*Pada payload pengiriman API:*
```javascript
  const payload = {
    // ...
    generate_recipe: generateRecipe ? 1 : 0,
    // ...
  };
```

---

### 3. `app/api/v2/multiplier/route.js`
Menangkap `generate_recipe` dari request body dan menyimpannya ke objek batch & task.

#### Code Sebelum (Current/Before):
```javascript
  const {
    deconstruct_asset_id,
    target_product_url,
    affiliate_url,
    vso_config_json,
    bridging_config_json,
    audio_config_json,
    enable_vo_audit,
    // ...
  } = body;
```

#### Code Sesudah (Proposed/After):
```javascript
  const {
    deconstruct_asset_id,
    target_product_url,
    affiliate_url,
    vso_config_json,
    bridging_config_json,
    audio_config_json,
    enable_vo_audit,
    generate_recipe,
    // ...
  } = body;

  const parsedGenerateRecipe = Number(generate_recipe || 0);
  // Simpan parsedGenerateRecipe ke dalam batch dan setiap row task
```

---

### 4. `lib/prompts.js` (`buildMultiplierPhase2Prompt`)
Menyuntikkan Recipe Mandate dan YouTube Shorts High-CTR Mandate ke dalam prompt Gemini AI pada Multiplier Lab.

#### Code Sebelum (Current/Before):
```javascript
export function buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio) {
  // ...
  return `${roleIntro}
  // ...
  "prompts": [ ... ],
  "caption": "Teks caption media sosial baru yang menarik dengan hashtag..."
}`;
}
```

#### Code Sesudah (Proposed/After):
```javascript
export function buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio) {
  const isRecipeActive = Boolean(
    bridging?.generate_recipe === true || bridging?.generate_recipe === 1 ||
    aesthetics?.generate_recipe === true || aesthetics?.generate_recipe === 1 ||
    audio?.generate_recipe === true || audio?.generate_recipe === 1
  );
  const recipeMandate = getRecipeMandateSection(isRecipeActive);

  // ...
  return `${roleIntro}

${toneBlock}${directiveBlock}${outroBlock}${customBlock}${dataSection}
${recipeMandate}
${YT_SHORTS_HIGH_CTR_TITLE_MANDATE}

// ...
### FORMAT OUTPUT (WAJIB JSON VALID):
{
  "storyboard": [ ... ],
  "prompts": [ ... ],
  "yt_title": "Judul YouTube Shorts click-worthy, kalimat utuh anti-terpotong (50-75 karakter, maks 85 karakter) diakhiri #Shorts. In ${targetLanguage === 'en-US' ? 'English' : 'Bahasa Indonesia'}.",
  "caption": "${isRecipeActive ? 'Teks resep/racikan lengkap (Bahan & Takaran, Langkah Pembuatan, Khasiat, Tips, CTA & Hashtags) dengan emoji rapi. In ' + (targetLanguage === 'en-US' ? 'English' : 'Bahasa Indonesia') + '.' : 'Teks caption media sosial baru yang menarik dengan hashtag...'}"
}`;
}
```

---

### 5. `lib/re-multiplier-worker.js`
Meneruskan flag `generate_recipe` ke prompt builder dan men-sanitasi `yt_title` dengan `cleanYoutubeTitle()`.

#### Code Sebelum (Current/Before):
```javascript
  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio);
  const model = await getGeminiModel();
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const { parseGeminiJSON } = await import('./json-parser');
  const parsed = parseGeminiJSON(responseText);

  // ...
  await updateMultiplierTask(task.id, {
    remake_storyboard_json: JSON.stringify(safeVoiceover),
    // ...
    new_caption: parsed.caption || '',
    status: nextStatus
  });
```

#### Code Sesudah (Proposed/After):
```javascript
  // Pastikan flag generate_recipe dari task diteruskan
  bridging.generate_recipe = task.generate_recipe === 1 || bridging.generate_recipe === 1;
  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio);
  const model = await getGeminiModel();
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const { parseGeminiJSON } = await import('./json-parser');
  const parsed = parseGeminiJSON(responseText);

  const { cleanYoutubeTitle } = await import('./prompts.js');
  const firstVo = voiceover?.[0]?.voice_over || voiceover?.[0]?.narration || '';
  const sanitizedYtTitle = cleanYoutubeTitle(parsed.yt_title || parsed.title || '', firstVo);

  // ...
  await updateMultiplierTask(task.id, {
    remake_storyboard_json: JSON.stringify(safeVoiceover),
    // ...
    yt_title: sanitizedYtTitle,
    new_caption: parsed.caption || '',
    status: nextStatus
  });
```

---

## Verification Plan

### Automated Verification
1. **Unit Test Suite**:
   Buat dan jalankan `node --test tests/multiplier-recipe-and-titles.test.js`:
   - Validasi bahwa `buildMultiplierPhase2Prompt` menyertakan Recipe Mandate saat `generate_recipe: true/1`.
   - Validasi bahwa `buildMultiplierPhase2Prompt` menghasilkan output schema memuat `yt_title` dan conditional `caption` resep.
   - Validasi bahwa judul YouTube Shorts hasil multiplikasi dibersihkan dengan `cleanYoutubeTitle()`.
2. **Kesehatan Cluster**:
   Jalankan `node scripts/test-cluster-health.js` untuk memastikan seluruh node siap.

### Deployment Strategy (Dev First - Tanpa Staging)
1. **Perintah Deploy**:
   ```bash
   npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev
   ```
2. **Verifikasi Host Dev Mac Mini**:
   - UI Port 5020: `HTTP/1.1 200 OK`
   - API Port 7020: `{"server_status":"online"}`
   - PM2: `maknaflow-dev-ui` & `maknaflow-dev-api` online.
   - Server Staging (`5010`/`7010`) **TIDAK DIDEPLOY** sampai ada instruksi eksplisit berikutnya.

### Manual Verification by User
1. Buka Web App MAKNA Flow Dev -> Menu **Multiplier Lab** (`http://100.95.245.55:5020/multiplier-lab`).
2. Buka Accordion 1, periksa kehadiran Toggle **"🍳 Hasilkan Teks Resep / Racikan (Herbal, Rempah, Kuliner) di Caption"**.
3. Buat varian angle multiplikasi dengan toggle aktif, jalankan, dan periksa bahwa caption dari setiap varian memuat teks resep lengkap serta judul YouTube bernilai High-CTR tanpa terpotong.
4. Anda dapat mencoba alur interaktif visualnya di [public/mockup_multiplier_lab_recipe_toggle.html](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_multiplier_lab_recipe_toggle.html).
