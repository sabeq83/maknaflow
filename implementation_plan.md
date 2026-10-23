# Implementation Plan - Dukungan Wardrobe Sequential pada Multiplier Lab

Dokumen ini menganalisis penyebab Wardrobe Mode / Key tidak bisa sequential pada Multiplier Lab (dibandingkan dengan Kampanye Pillar) dan merinci tahapan implementasi perbaikan agar rotasi pakaian antar-baris (Baris 1 s/d N) berjalan sempurna secara berurutan.

## 1. Analisis Akar Masalah (Root Cause Analysis)

### 1.1 Perbandingan Arsitektur: Pillar Campaign vs Multiplier Lab

| Komponen | Kampanye Pillar (OPC) | Multiplier Lab (Saat Ini) |
| :--- | :--- | :--- |
| **Penyimpanan VSO** | `campaign.visual_overrides_json` menyimpan snapshot visual identity | `task.vso_config_json` menyimpan konfigurasi VSO mentah |
| **Resolusi per Baris/Item** | Worker memanggil `resolveVisualOverrides({ visualOverrides, itemIndex })` di mana `itemIndex = row_number - 1` | Worker **TIDAK PERNAH** memanggil `resolveVisualOverrides`, hanya membaca `JSON.parse(task.vso_config_json)` |
| **Dukungan `sequential` di Prompt Builder** | `buildOrganicPillarPrompt` menerima `vsoData` yang sudah di-resolve menjadi `wardrobe_style_custom` spesifik per baris | `buildMultiplierPhase2Prompt` **HANYA** memiliki logika `if (wardrobeStyleVal === 'random')`. Tidak ada logika `sequential`, dan tidak menerima parameter `rowIndex` |
| **Hasil Output saat `sequential` dipilih** | Baris 1: Amber Terracotta, Baris 2: Mocca Caramel, Baris 3: Warm Grey, dst. | Variabel `targetWardrobe` jatuh ke fallback string literal: **`"sequential"`**. Prompt AI bertuliskan `- Wardrobe / Pakaian: sequential` tanpa warna nyata |
| **Sinkronisasi Form UI** | Membaca langsung dari `visualIdentity.visual_overrides_json` | `wardrobeStyle` di root payload tidak tersinkronisasi dengan pilihan dropdown di `VisualIdentitySelector` |

### 1.2 Bukti Lapangan Database Staging (Tenant Default)
Pada batch riil di server Staging (`mul_261021_gleesx`), data tugas `mul_261021_gleesx_01` s/d `08` tersimpan dengan konfigurasi:
```json
{
  "wardrobeStyle": "sequential",
  "subjectDemographic": "syari_classic",
  "visual_overrides_json": {
    "character_concept": "faceless",
    "subject_demographic": "syari_classic",
    "wardrobe_style": "sequential"
  }
}
```
Namun karena `lib/re-multiplier-worker.js` dan `lib/prompts.js` tidak memproses `sequential` dengan `task.row_index`, seluruh tugas dalam batch tersebut tidak menghasilkan rotasi warna pakaian.

---

## 2. Proposed Changes & Code Snippets (Before & After)

### File 1: `lib/re-multiplier-worker.js`
* **Tujuan**: Di fungsi `handleStoryboardRemake(task)`, resolve visual overrides berbasis `task.row_index` menggunakan `resolveVisualOverrides`, dan teruskan `rowIndex` ke `buildMultiplierPhase2Prompt`.

#### Code Sebelum (Current/Before)
```javascript
  const aesthetics = JSON.parse(task.vso_config_json || '{}'); // UI stores aesthetics here
  const vso = aesthetics; // aesthetic configs and visual overrides are merged
  const audio = JSON.parse(task.audio_config_json || '{}');

  const productDNA = bridging.resolvedDNA || {
    product_name: bridging.manualProductName || '',
    product_description: bridging.manualProductDesc || '',
    unique_selling_point: bridging.manualProductUsp || ''
  };
...
  logToMultiplier(`[Multiplier Worker] Prompting Gemini for storyboard remake of task ${task.id}`);
  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio);
```

#### Code Sesudah (Proposed/After)
```javascript
  const aesthetics = JSON.parse(task.vso_config_json || '{}'); // UI stores aesthetics here
  const audio = JSON.parse(task.audio_config_json || '{}');

  const rowIndex = (task.row_index !== undefined && task.row_index !== null) ? Number(task.row_index) : 0;
  
  // Resolve Visual Overrides per baris untuk mendukung Wardrobe Sequential, Random, dan Snapshot V1
  let resolvedVso = aesthetics;
  try {
    const { resolveVisualOverrides } = await import('./visual-override-resolver.js');
    const rawOverrides = aesthetics.visual_overrides_json || aesthetics.visualIdentity?.visual_overrides_json || {
      character_concept: aesthetics.characterConcept || 'faceless',
      subject_demographic: aesthetics.subjectDemographic || 'syari_classic',
      wardrobe_style: aesthetics.wardrobeStyle || 'random',
      wardrobe_style_custom: aesthetics.wardrobeStyleCustom || '',
      lighting_style: aesthetics.lightingStyle || 'window_daylight',
      lighting_style_custom: aesthetics.lightingStyleCustom || '',
      visual_style_preset: aesthetics.visualStylePreset || 'cinematic_realistic'
    };

    const resolvedVisuals = resolveVisualOverrides({
      visualOverrides: rawOverrides,
      itemIndex: rowIndex,
      stableSeed: `${task.batch_id || 'multiplier'}:${task.id || rowIndex}`
    });

    resolvedVso = {
      ...aesthetics,
      ...resolvedVisuals,
      isVsoActive: aesthetics.isVsoActive !== undefined ? aesthetics.isVsoActive : true,
      characterConcept: resolvedVisuals.character_concept || aesthetics.characterConcept || 'faceless',
      subjectDemographic: resolvedVisuals.subject_demographic || aesthetics.subjectDemographic || 'syari_classic',
      wardrobeStyle: resolvedVisuals.wardrobe_style || aesthetics.wardrobeStyle,
      wardrobeStyleCustom: resolvedVisuals.wardrobe_style_custom || aesthetics.wardrobeStyleCustom || '',
      lightingStyle: resolvedVisuals.lighting_style || aesthetics.lightingStyle,
      lightingStyleCustom: resolvedVisuals.lighting_style_custom || aesthetics.lightingStyleCustom || ''
    };
  } catch (vsoErr) {
    console.warn(`[Multiplier Worker] Visual override resolution fallback for task ${task.id}:`, vsoErr.message);
  }

  const vso = resolvedVso;

  const productDNA = bridging.resolvedDNA || {
    product_name: bridging.manualProductName || '',
    product_description: bridging.manualProductDesc || '',
    unique_selling_point: bridging.manualProductUsp || ''
  };
...
  logToMultiplier(`[Multiplier Worker] Prompting Gemini for storyboard remake of task ${task.id} (Row ${rowIndex + 1})`);
  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio, rowIndex);
```

---

### File 2: `lib/prompts.js`
* **Tujuan**: Di `buildMultiplierPhase2Prompt`, terima parameter `rowIndex = 0`, kenali `wardrobe_style === 'custom'` / `wardrobe_style_custom` dari resolver, dan sediakan fallback direct `resolveWardrobe` jika `wardrobeStyleVal === 'sequential'`.

#### Code Sebelum (Current/Before)
```javascript
export function buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio) {
  const targetLanguage = audio?.targetLanguage || 'id-ID';
...
  // Resolve VSO details using presets
  let vsoSection = "";
  if (vso?.isVsoActive) {
    const targetConcept = vso.characterConcept || "faceless";

    let wardrobeStyleVal = vso.wardrobeStyle;
    if (wardrobeStyleVal === 'random') {
      const keys = Object.keys(WARDROBE_PRESETS);
      wardrobeStyleVal = keys[Math.floor(Math.random() * keys.length)];
    }
    const targetWardrobe = WARDROBE_PRESETS[wardrobeStyleVal] || wardrobeStyleVal || "modest clothing";

    let lightingStyleVal = vso.lightingStyle;
    if (lightingStyleVal === 'random') {
      const keys = Object.keys(LIGHTING_PRESETS);
      lightingStyleVal = keys[Math.floor(Math.random() * keys.length)];
    }
    const targetLighting = LIGHTING_PRESETS[lightingStyleVal] || lightingStyleVal || "soft natural light";

    const targetCharacter = DEMOGRAPHIC_PRESETS[vso.subjectDemographic] || vso.subjectDemographic || "a graceful Muslimah";
```

#### Code Sesudah (Proposed/After)
```javascript
export function buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio, rowIndex = 0) {
  const targetLanguage = audio?.targetLanguage || 'id-ID';
...
  // Resolve VSO details using presets
  let vsoSection = "";
  if (vso?.isVsoActive) {
    const targetConcept = vso.characterConcept || vso.character_concept || "faceless";
    const subjectDemo = vso.subjectDemographic || vso.subject_demographic || "syari_classic";

    let targetWardrobe = "modest clothing";
    if (vso.wardrobe_style === "custom" && vso.wardrobe_style_custom) {
      targetWardrobe = vso.wardrobe_style_custom;
    } else {
      let wardrobeStyleVal = vso.wardrobeStyle || vso.wardrobe_style || 'random';
      if (wardrobeStyleVal === 'sequential') {
        const GROUPS = {
          syari_classic: ['amber_terracotta', 'mocca_caramel', 'warm_grey', 'sage_muted', 'lavender_lilac', 'butter_yellow', 'teal_navy', 'olive_modern', 'mahogany_maroon', 'cloud_dancer'],
          southeast_asian_male: ['male_terracotta', 'male_caramel', 'male_khaki_tan', 'male_navy_blue', 'male_forest_green', 'male_charcoal', 'male_burgundy', 'male_sage_muted', 'male_steel_blue', 'male_cloud_dancer'],
          caucasian_male: ['male_terracotta', 'male_caramel', 'male_khaki_tan', 'male_navy_blue', 'male_forest_green', 'male_charcoal', 'male_burgundy', 'male_sage_muted', 'male_steel_blue', 'male_cloud_dancer'],
          stylized_3d_muslimah: ['3d_fem_emerald', '3d_fem_pastel_pink', '3d_fem_jetblack', '3d_fem_mocca'],
          stylized_3d_male: ['3d_male_tan_knit', '3d_male_sage_jacket', '3d_male_charcoal_tshirt', '3d_male_terracotta_flannel'],
          stylized_3d_duo: ['3d_duo_earth', '3d_duo_contrast', '3d_duo_monochrome', '3d_duo_pastel', '3d_duo_cool']
        };
        const catalog = GROUPS[subjectDemo] || GROUPS.syari_classic;
        const key = catalog[Math.max(0, Number(rowIndex) || 0) % catalog.length];
        wardrobeStyleVal = key;
      } else if (wardrobeStyleVal === 'random') {
        const keys = Object.keys(WARDROBE_PRESETS);
        wardrobeStyleVal = keys[Math.floor(Math.random() * keys.length)];
      }
      targetWardrobe = WARDROBE_PRESETS[wardrobeStyleVal] || wardrobeStyleVal || "modest clothing";
    }

    let targetLighting = "soft natural light";
    if (vso.lighting_style === "custom" && vso.lighting_style_custom) {
      targetLighting = vso.lighting_style_custom;
    } else {
      let lightingStyleVal = vso.lightingStyle || vso.lighting_style || 'random';
      if (lightingStyleVal === 'random') {
        const keys = Object.keys(LIGHTING_PRESETS);
        lightingStyleVal = keys[Math.floor(Math.random() * keys.length)];
      }
      targetLighting = LIGHTING_PRESETS[lightingStyleVal] || lightingStyleVal || "soft natural light";
    }

    const targetCharacter = DEMOGRAPHIC_PRESETS[subjectDemo] || subjectDemo || "a graceful Muslimah";
```

---

### File 3: `app/components/campaign-forms/MultiplierConfigurationForm.js`
* **Tujuan**: Sinkronisasi nilai `characterConcept`, `subjectDemographic`, `wardrobeStyle`, `wardrobeStyleCustom`, `lightingStyle`, dan `lightingStyleCustom` di root `vso_config_json` langsung dari `visualIdentity.visual_overrides_json` saat mode Custom dipilih.

#### Code Sebelum (Current/Before)
```javascript
        vso_config_json: JSON.stringify({
          narrativeMode, visualStyle, targetAi, videoModel, clipDuration, aspectRatio, faceVisibility, wordsPerClip,
          isVsoActive, characterConcept, subjectDemographic, wardrobeStyle, wardrobeStyleCustom, lightingStyle, lightingStyleCustom,
          visualIdentity,
          visual_identity_preset_id: isVsoActive ? visualIdentity?.preset_id : null,
          visual_identity_inline_config: isVsoActive && visualIdentity?.preset_id === 'inline' ? visualIdentity.inline_config : null,
          visual_overrides_json: isVsoActive && visualIdentity?.preset_id === 'custom' ? visualIdentity.visual_overrides_json : null
        }),
```

#### Code Sesudah (Proposed/After)
```javascript
        vso_config_json: JSON.stringify({
          narrativeMode, visualStyle, targetAi, videoModel, clipDuration, aspectRatio, faceVisibility, wordsPerClip,
          isVsoActive,
          characterConcept: isVsoActive && visualIdentity?.preset_id === 'custom' ? (visualIdentity.visual_overrides_json?.character_concept || characterConcept) : characterConcept,
          subjectDemographic: isVsoActive && visualIdentity?.preset_id === 'custom' ? (visualIdentity.visual_overrides_json?.subject_demographic || subjectDemographic) : subjectDemographic,
          wardrobeStyle: isVsoActive && visualIdentity?.preset_id === 'custom' ? (visualIdentity.visual_overrides_json?.wardrobe_style || wardrobeStyle) : wardrobeStyle,
          wardrobeStyleCustom: isVsoActive && visualIdentity?.preset_id === 'custom' ? (visualIdentity.visual_overrides_json?.wardrobe_style_custom || wardrobeStyleCustom) : wardrobeStyleCustom,
          lightingStyle: isVsoActive && visualIdentity?.preset_id === 'custom' ? (visualIdentity.visual_overrides_json?.lighting_style || lightingStyle) : lightingStyle,
          lightingStyleCustom: isVsoActive && visualIdentity?.preset_id === 'custom' ? (visualIdentity.visual_overrides_json?.lighting_style_custom || lightingStyleCustom) : lightingStyleCustom,
          visualIdentity,
          visual_identity_preset_id: isVsoActive ? visualIdentity?.preset_id : null,
          visual_identity_inline_config: isVsoActive && visualIdentity?.preset_id === 'inline' ? visualIdentity.inline_config : null,
          visual_overrides_json: isVsoActive && visualIdentity?.preset_id === 'custom' ? visualIdentity.visual_overrides_json : null
        }),
```

---

## 3. Execution Task List

- [x] **Task 1**: Update `lib/prompts.js` (`buildMultiplierPhase2Prompt`) untuk mendukung `rowIndex` dan rotasi `sequential` wardrobe.
- [x] **Task 2**: Update `lib/re-multiplier-worker.js` (`handleStoryboardRemake`) agar meresolusi visual identity per baris dengan `resolveVisualOverrides` dan meneruskan `rowIndex`.
- [x] **Task 3**: Update `app/components/campaign-forms/MultiplierConfigurationForm.js` untuk menyelaraskan sinkronisasi `visual_overrides_json` ke root payload VSO.
- [x] **Task 4**: Buat automated unit test suite `tests/multiplier-sequential-wardrobe.test.js` untuk memverifikasi bahwa Baris 1, Baris 2, Baris 3, dst. menghasilkan warna wardrobe sequential yang berputar berbeda.
- [x] **Task 5**: Jalankan seluruh unit test suite dan pastikan tidak ada regresi.
- [ ] **Task 6**: Rilis versi baru (`npm run release-non-interactive`) dan deploy ke server Staging Mac Mini via SOP Atomic Deployment.
- [ ] **Task 7**: Verifikasi di server Staging untuk tenant `default`.
