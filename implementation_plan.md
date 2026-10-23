# Implementation Plan - Fitur Target Language pada Content Planner (Opsi 2)

Rencana ini merinci implementasi penambahan dukungan **Target Language (`id-ID` vs `en-US`)** pada modul **Content Planner**, sehingga Content Planner dapat menghasilkan Hook, Context, Visual Action, dan seluruh metadata perencanaan dalam Bahasa Inggris secara native dan deterministik untuk akun global seperti **HabitFolk**.

---

## 1. Analisis & Ruang Lingkup Perubahan

| Komponen | Kondisi Saat Ini (As-Is) | Rencana Perubahan (To-Be) |
| :--- | :--- | :--- |
| **Database `content_planners`** | Belum ada kolom `target_language`. | Menambahkan kolom `target_language TEXT DEFAULT 'id-ID'` via auto-migration di `lib/db-pg.js`. |
| **Kontrak & Validasi** | `lib/content-planner-contract.js` tidak memvalidasi bahasa. | Menambahkan validasi `SUPPORTED_PLANNER_LANGUAGES = ['id-ID', 'en-US']` dengan fallback aman `'id-ID'`. |
| **Engine AI Directives** | Prompt AI Call 1 & Call 2 100% berbahasa Indonesia tanpa batasan bahasa target. | Menambahkan **Language Directive Mandate** deterministik di AI Call 1 & 2 (`lib/content-planner-engine.js` dan `lib/recipe-planner-engine.js`). |
| **Tone Instruction** | Menggunakan diksi lokal Indonesia ("Bunda", "Moms", dll). | Jika `target_language === 'en-US'`, tone dialihkan ke gaya audiens global/English (relatable, curiosity-driven, zero local slang). |
| **Form UI (`PlannerConfigurationForm.js`)** | Tidak ada pilihan bahasa. | Menambahkan komponen UI **Language Selector** (🇮🇩 Bahasa Indonesia vs 🇺🇸 English US) dengan auto-suggestion saat brand global dipilih. |
| **Mockup Interaktif** | Standalone mockup. | Disediakan di `public/mockup_content_planner_language_selector.html`. |

---

## 2. Proposed Changes & Code Snippets (Before & After)

### File 1: `lib/db-pg.js`
* **Tujuan**: Tambahkan auto-migration kolom `target_language` pada tabel `content_planners`.

#### Code Sebelum (Current/Before)
```javascript
      ALTER TABLE content_planners
        ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS recipe_config_json JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS products_snapshot_json JSONB DEFAULT '[]'::jsonb;
```

#### Code Sesudah (Proposed/After)
```javascript
      ALTER TABLE content_planners
        ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS recipe_config_json JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS products_snapshot_json JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS target_language TEXT DEFAULT 'id-ID';
```

---

### File 2: `lib/content-planner-contract.js`
* **Tujuan**: Validasi dan normalisasi nilai `target_language`.

#### Code Sebelum (Current/Before)
```javascript
export function validatePlannerDraft(params = {}) {
  const { planner_focus, planner_count, pillars, recipe_config } = params;
...
```

#### Code Sesudah (Proposed/After)
```javascript
export const SUPPORTED_PLANNER_LANGUAGES = ['id-ID', 'en-US'];

export function normalizePlannerLanguage(lang) {
  if (!lang) return 'id-ID';
  const clean = String(lang).trim();
  return SUPPORTED_PLANNER_LANGUAGES.includes(clean) ? clean : 'id-ID';
}

export function validatePlannerDraft(params = {}) {
  const { planner_focus, planner_count, pillars, recipe_config } = params;
...
```

---

### File 3: `lib/content-planner-engine.js`
* **Tujuan**: Menerima `target_language`, menyimpannya ke database saat membuat draft, dan menyuntikkan instruksi bahasa pada prompt AI Call 1 (Skeleton) dan AI Call 2 (Creative Generator).

#### Code Sebelum (Current/Before)
```javascript
export async function createDraftContentPlanner(params) {
  const db = getDb();
  const {
    title,
    account_name = 'account',
...
```

#### Code Sesudah (Proposed/After)
```javascript
export async function createDraftContentPlanner(params) {
  const db = getDb();
  const {
    title,
    account_name = 'account',
    target_language = 'id-ID',
...
  const normalizedLanguage = normalizePlannerLanguage(target_language);
...
  // In insert query:
  // INSERT INTO content_planners (..., target_language) VALUES (..., ?)
```

Dan pada fungsi `executeContentPlanner`:
```javascript
    const targetLanguage = normalizePlannerLanguage(planner.target_language || 'id-ID');
    const isEnglish = targetLanguage === 'en-US';

    const languageDirective = isEnglish ? `
🚨 CRITICAL LANGUAGE MANDATE:
- Target Output Language: ENGLISH (US).
- ALL generated text in the JSON output (hook, visual_action, context, content_subject, strategic_angle, category_cep) MUST be written 100% in natural, fluent, idiomatically correct American English.
- DILARANG KERAS menggunakan kosakata atau frasa Bahasa Indonesia pada nilai field JSON output.
` : `
- Target Output Language: BAHASA INDONESIA.
`;
```

---

### File 4: `lib/recipe-planner-engine.js`
* **Tujuan**: Menyuntikkan `languageDirective` pada generator resep agar judul resep, hook, bahan, takaran, langkah pembuatan, dan tips chef otomatis berbahasa Inggris jika `target_language === 'en-US'`.

#### Code Sebelum (Current/Before)
```javascript
- Instruksi Khusus: ${customInstructions || 'Gunakan gaya bahasa yang engaging dan takaran yang jelas.'}
```

#### Code Sesudah (Proposed/After)
```javascript
- Target Output Language: ${isEnglish ? 'ENGLISH (US) - All fields (title, hook, ingredients, steps, chef tips) must be in natural English.' : 'BAHASA INDONESIA'}
- Instruksi Khusus: ${customInstructions || (isEnglish ? 'Use engaging, appetizing culinary terminology.' : 'Gunakan gaya bahasa yang engaging dan takaran yang jelas.')}
```

---

### File 5: `app/components/campaign-forms/PlannerConfigurationForm.js`
* **Tujuan**: Menambahkan state `targetLanguage`, kontrol radio pill UI di form modal, auto-detect brand global (seperti `habitfolk` -> auto `en-US`), dan menyertakannya di payload `POST /api/content-planner`.

#### Code Sebelum (Current/Before)
```javascript
  const [plannerFocus, setPlannerFocus] = useState('product_campaign');
  const [recipeCategory, setRecipeCategory] = useState('minuman');
...
```

#### Code Sesudah (Proposed/After)
```javascript
  const [plannerFocus, setPlannerFocus] = useState('product_campaign');
  const [targetLanguage, setTargetLanguage] = useState('id-ID');
  const [recipeCategory, setRecipeCategory] = useState('minuman');
...
  // Auto-detect brand language
  useEffect(() => {
    if (selectedBrandId) {
      const b = brandProfiles.find(p => p.id === selectedBrandId);
      if (b && (b.brand_name.toLowerCase().includes('habit') || b.brand_name.toLowerCase().includes('global'))) {
        setTargetLanguage('en-US');
      }
    }
  }, [selectedBrandId, brandProfiles]);
```

---

## 3. Execution Task List

- [x] **Task 1**: Update `lib/db-pg.js` untuk menambahkan auto-migration kolom `target_language` pada tabel `content_planners`.
- [x] **Task 2**: Update `lib/content-planner-contract.js` dengan `SUPPORTED_PLANNER_LANGUAGES` dan helper normalisasi bahasa.
- [x] **Task 3**: Update `lib/content-planner-engine.js` untuk persistensi `target_language` dan injeksi Language Mandate pada AI Call 1 & 2.
- [x] **Task 4**: Update `lib/recipe-planner-engine.js` untuk mendukung `target_language` pada perumusan resep kuliner.
- [x] **Task 5**: Update `app/components/campaign-forms/PlannerConfigurationForm.js` dengan komponen UI Language Selector & auto-detection brand.
- [x] **Task 6**: Buat automated unit test suite `tests/content-planner-language-support.test.js` dan jalankan pengujian.
- [x] **Task 7**: Rilis versi baru (`npm run release-non-interactive`) dan deploy ke server Staging Mac Mini via SOP Atomic Deployment.
- [x] **Task 8**: Verifikasi fungsionalitas pembuatan Content Planner berbahasa Inggris di server Staging.
