# Implementation Plan — Visual Identity Style Taxonomy & Safe Migration

## Ringkasan

Perbaikan ini menghilangkan bias global `editorial_graphic_novel` dari Visual Identity schema v2. Katalog akan diperluas agar mencakup kebutuhan realistic/commercial/culinary/3D/clay, system preset akan memperoleh gaya yang sesuai, data tidak valid tidak lagi dikoreksi diam-diam, dan preset tenant lama akan diaudit serta dimigrasikan secara selektif.

Rencana ini mengimplementasikan lima usulan:

1. memperluas katalog style v2;
2. menetapkan primary style semantik per system preset;
3. menghapus silent fallback;
4. memisahkan rendering medium, art direction, dan narrative mode;
5. menyediakan audit, migrasi aman, dan regression coverage.

## Temuan Dasar

- `VISUAL_STYLE_KEYS` saat ini hanya berisi enam gaya editorial/politik.
- Lima system preset masih membawa `style.preset_key: cinematic_realistic`.
- `normalizeVisualLanguage()` hanya memetakan `3d_claymation_cozy`; nilai legacy lain jatuh ke `editorial_graphic_novel`.
- `listSystemVisualIdentities()` menormalisasi semua system preset saat dibaca, sehingga nilai yang salah terlihat di UI dan ikut masuk resolver produksi.
- Fallback editorial juga tersebar di AI contract, catalog lookup, allocator, resolver, dan default form.
- Database tenant belum dapat diaudit dari workstation karena tunnel PostgreSQL lokal belum aktif. Karena itu migrasi harus memiliki mode dry-run dan tidak boleh mengasumsikan semua record editorial adalah salah.

## Prinsip Desain

### 1. Tiga dimensi visual yang terpisah

- `rendering_medium`: bagaimana gambar diwujudkan, misalnya `photorealistic`, `stylized_3d`, `claymation`, `illustration`, `paper_cutout`.
- `art_direction`: bahasa estetika utama, misalnya `cinematic_realistic`, `commercial_product_cinematic`, `culinary_cinematic`, atau `editorial_graphic_novel`.
- `narrative_mode`: cara adegan menjalankan fungsi cerita, misalnya `symbolic_surrealism`, `isometric_society`, atau `evidence_reveal`.

Untuk kompatibilitas schema v2, `visual_language.primary_style` tetap menjadi key art direction yang dipakai resolver. Metadata `medium` dan `family` ditambahkan pada definisi katalog, sedangkan `supporting_styles`/`mode_routing` tetap menangani mode naratif. Tidak diperlukan perubahan kolom database.

### 2. Default netral, bukan editorial

`cinematic_realistic` menjadi default netral untuk draft baru yang tidak memiliki konteks. Preset politik tetap eksplisit memakai `editorial_graphic_novel`.

### 3. Strict pada write, kompatibel pada read

- Create/update dan output AI yang membawa style tidak dikenal harus gagal dengan error yang jelas.
- Legacy payload dibaca melalui mapper eksplisit dan menghasilkan metadata migrasi/warning.
- Tidak ada lagi coercion style tidak dikenal menjadi style valid tanpa jejak.

### 4. Migrasi konservatif

Record tenant hanya diubah bila terdapat bukti kuat bahwa nilainya dihasilkan fallback lama. Preset yang memang dibuat sebagai editorial tidak disentuh.

## Taxonomy Target

| Key | Family | Medium | Peran utama |
|---|---|---|---|
| `cinematic_realistic` | cinematic | photorealistic | default netral/lifestyle |
| `commercial_product_cinematic` | commercial | photorealistic | produk, workspace, hands-only |
| `culinary_cinematic` | culinary | photorealistic | bahan, memasak, plating |
| `stylized_3d_character` | character_3d | stylized_3d | karakter 3D faceless |
| `cozy_claymation` | character_3d | claymation | mascot/character clay yang hangat |
| `editorial_graphic_novel` | editorial | illustration | editorial dan pendidikan politik |
| `isometric_society` | editorial | illustration | narrative mode sistem/institusi |
| `symbolic_surrealism` | editorial | illustration | narrative mode metafora |
| `paper_cutout_documentary` | documentary | paper_cutout | narrative mode bukti/dokumen |
| `shadow_silhouette` | editorial | illustration | narrative mode kuasa/ancaman |
| `clay_political_theater` | editorial_satire | claymation | satire politik clay |

Setiap entry katalog wajib memiliki `label`, `description`, `prompt`, `negative_prompts`, `family`, `medium`, dan `role` (`primary`, `supporting`, atau `both`).

## Mapping System Preset

| Preset | Primary style target | Alasan |
|---|---|---|
| `way_siyasi_editorial_system` | `editorial_graphic_novel` | memang editorial politik |
| `hands_only_muslimah_sage_kitchen` | `culinary_cinematic` | aktivitas dapur dan makanan |
| `hands_only_southeast_asian_male` | `commercial_product_cinematic` | lifestyle/product workspace |
| `hands_only_caucasian_male_caramel` | `commercial_product_cinematic` | lifestyle/product kitchen |
| `stylized_3d_muslimah_emerald` | `stylized_3d_character` | karakter 3D, bukan ilustrasi editorial |
| `mascot_herbal_ginger_guardian` | `cozy_claymation` | mascot clay yang hangat |

## Strategi Validasi dan Fallback

### Jalur create/update

- `visual_language.primary_style` wajib ada dan valid setelah form/AI mengirim schema v2.
- Nilai tidak dikenal menghasilkan `INVALID_VISUAL_STYLE` beserta path field dan daftar key yang valid.
- `supporting_styles` yang invalid juga ditolak, bukan dibuang diam-diam.
- Route yang menunjuk style tidak aktif tetap boleh diperbaiki deterministik ke primary, tetapi correction dicatat di compliance report.

### Jalur legacy

Mapper eksplisit:

```js
const LEGACY_STYLE_MAP = {
  cinematic_realistic: 'cinematic_realistic',
  '3d_claymation_cozy': 'cozy_claymation'
};
```

Jika legacy key tidak dikenal, resolver memakai `cinematic_realistic` dan menyertakan warning terstruktur. Jalur ini hanya berlaku untuk payload yang benar-benar dikenali sebagai legacy, bukan untuk schema v2 baru.

### Catalog lookup

`getVisualStyleDefinition()` tidak lagi mengembalikan editorial untuk key salah. Default aman hanya digunakan bila caller tidak mengirim key; unknown key harus melempar error.

## Audit dan Migrasi Tenant

Script migrasi memiliki dua tahap:

1. `--dry-run` sebagai default, menghasilkan jumlah dan daftar ringkas kandidat tanpa menampilkan secret atau isi prompt sensitif.
2. `--apply --confirm-visual-style-migration` untuk perubahan aktual dalam transaksi.

Klasifikasi kandidat:

- **safe-auto-fix**: `primary_style=editorial_graphic_novel`, `supporting_styles=[]`, legacy `style.preset_key` berisi key yang dapat dipetakan, dan metadata preset tidak menunjukkan maksud editorial.
- **review-required**: primary editorial tetapi ada campuran sinyal legacy/editorial atau custom configuration.
- **already-correct**: style valid dan konsisten.
- **invalid-unmapped**: key lama tidak dikenali; tidak diubah otomatis.

Setiap update:

- memakai transaksi;
- hanya mengubah `config_json.visual_language`, routing yang terbukti dihasilkan fallback, dan `style.preset_key` agar konsisten;
- menaikkan `version` dan `updated_at`;
- menghasilkan manifest audit sebelum/sesudah tanpa credential;
- idempotent: run kedua menghasilkan nol perubahan.

Database tidak memerlukan kolom baru. Script dijalankan per environment dengan `PG_SEARCH_PATH` yang sudah ada. Dev diverifikasi lebih dahulu, lalu staging. Production di luar scope sampai ada perintah eksplisit pengguna.

## Perubahan UI dan Gate Mockup

Sebelum perubahan React/Next.js, buat `public/mockup_visual_identity_style_taxonomy.html` menggunakan semantic CSS tokens. Mockup harus memperlihatkan:

- style cards dikelompokkan berdasarkan family/medium;
- badge `Primary` dan `Supporting`;
- penjelasan singkat perbedaan art direction dan narrative mode;
- warning untuk legacy/unmapped style;
- preview keenam system preset dengan primary style yang benar;
- light/dark mode tanpa hardcoded color.

Coding UI baru dilanjutkan setelah pengguna mereview mockup tersebut.

## File Changes — Before & After

### `lib/visual-language-catalog.js`

**Code Sebelum (Current/Before)**

```js
export const VISUAL_STYLE_KEYS = [
  'editorial_graphic_novel',
  'isometric_society',
  'symbolic_surrealism',
  'paper_cutout_documentary',
  'shadow_silhouette',
  'clay_political_theater'
];

export function getVisualStyleDefinition(key) {
  return VISUAL_LANGUAGE_CATALOG[key] || VISUAL_LANGUAGE_CATALOG.editorial_graphic_novel;
}
```

**Code Sesudah (Proposed/After)**

```js
export const DEFAULT_VISUAL_STYLE = 'cinematic_realistic';

export const VISUAL_LANGUAGE_CATALOG = {
  cinematic_realistic: {
    label: 'Cinematic Realistic',
    family: 'cinematic',
    medium: 'photorealistic',
    role: 'primary',
    prompt: '...',
    negative_prompts: []
  },
  // commercial, culinary, 3D, clay, and existing editorial entries
};

export function getVisualStyleDefinition(key = DEFAULT_VISUAL_STYLE) {
  const definition = VISUAL_LANGUAGE_CATALOG[key];
  if (!definition) throw createInvalidVisualStyleError(key);
  return definition;
}
```

### `lib/visual-identity-contract.js`

**Code Sebelum (Current/Before)**

```js
if (!isValidVisualStyle(primary)) {
  if (legacyStyle?.preset_key === '3d_claymation_cozy') {
    primary = 'clay_political_theater';
  } else {
    primary = 'editorial_graphic_novel';
  }
}
```

**Code Sesudah (Proposed/After)**

```js
if (!primary && sourceVersion === '2') {
  primary = DEFAULT_VISUAL_STYLE;
} else if (!isValidVisualStyle(primary)) {
  throw createInvalidVisualStyleError(primary, 'visual_language.primary_style');
}

const mappedLegacyStyle = mapLegacyVisualStyle(legacyStyle?.preset_key);
```

Validator menerima opsi/source context agar strict-write dan legacy-read tidak tercampur. `normalizeLegacyVisualOverrides()` memakai `LEGACY_STYLE_MAP` dan mengembalikan warnings yang dapat diteruskan ke snapshot/compliance report.

### `lib/visual-identity-system-presets.js`

**Code Sebelum (Current/Before)**

```js
style: {
  preset_key: 'cinematic_realistic',
  aspect_ratio: '9:16'
}
```

**Code Sesudah (Proposed/After)**

```js
visual_language: {
  primary_style: 'culinary_cinematic',
  supporting_styles: [],
  disabled_styles: []
},
style: {
  preset_key: 'culinary_cinematic',
  aspect_ratio: '9:16'
}
```

Kelima preset non-editorial memperoleh mapping eksplisit sesuai tabel di atas. `style.preset_key` dan `visual_language.primary_style` harus konsisten.

### `lib/visual-identity-ai-contract.js`

**Code Sebelum (Current/Before)**

```js
const primary_style = isValidVisualStyle(input.primary_style)
  ? input.primary_style
  : 'editorial_graphic_novel';
```

**Code Sesudah (Proposed/After)**

```js
const primary_style = input.primary_style || DEFAULT_VISUAL_STYLE;
assertValidVisualStyle(primary_style, 'primary_style');
assertValidSupportingStyles(input.supporting_styles, primary_style);
```

Compliance report membedakan `invalid`, `legacy_mapped`, dan `corrected_route`; style invalid tidak lagi diberi status seolah berhasil dikoreksi.

### `lib/visual-identity-ai-builder.js`

**Code Sebelum (Current/Before)**

```js
- visual_language.primary_style: "editorial_graphic_novel" | ...

"visual_language": {
  "primary_style": "editorial_graphic_novel"
}
```

**Code Sesudah (Proposed/After)**

```js
const styleCatalogForPrompt = listVisualStylesForAi();

// Prompt explains family, medium, role, and asks the model to choose
// based on the brief rather than copying an editorial example.
```

Contoh JSON netral memakai `cinematic_realistic`; prompt tetap menyertakan contoh editorial sebagai use-case, bukan default universal. Arsitektur tetap single-pass satu panggilan Gemini.

### `lib/visual-override-resolver.js`

**Code Sebelum (Current/Before)**

```js
let activeStyleKey = config.visual_language?.primary_style
  || config.style?.preset_key
  || 'editorial_graphic_novel';
```

**Code Sesudah (Proposed/After)**

```js
const activeStyleKey = resolveActiveVisualStyle(config, {
  narrativeFunction,
  defaultStyle: DEFAULT_VISUAL_STYLE
});
const styleDefinition = getVisualStyleDefinition(activeStyleKey);
```

Resolver meneruskan warning legacy ke snapshot dan tidak pernah menyembunyikan unknown schema-v2 style.

### `lib/visual-identity-allocator.js`

**Code Sebelum (Current/Before)**

```js
const primaryStyle = visualLang.primary_style || 'editorial_graphic_novel';
const assignedMode = defaultRouting[selectedFunction]
  || defaultRouting.context
  || 'editorial_graphic_novel';
```

**Code Sesudah (Proposed/After)**

```js
const primaryStyle = visualLang.primary_style || DEFAULT_VISUAL_STYLE;
const assignedMode = defaultRouting[selectedFunction]
  || defaultRouting.context
  || primaryStyle;
```

Deskripsi style diambil dari katalog tunggal agar allocator tidak memiliki katalog editorial duplikat.

### `app/settings/visual-identities/page.js`

**Code Sebelum (Current/Before)**

```js
visual_language: {
  primary_style: 'editorial_graphic_novel',
  supporting_styles: ['isometric_society', 'symbolic_surrealism']
}
```

**Code Sesudah (Proposed/After)**

```js
visual_language: {
  primary_style: DEFAULT_VISUAL_STYLE,
  supporting_styles: []
}

const groupedStyles = groupVisualStylesByFamily(VISUAL_LANGUAGE_CATALOG);
```

Selector membedakan primary art direction dan supporting narrative modes, menampilkan family/medium badges serta warning migrasi. Semua styling memakai token dari `app/theme.css`.

### `app/components/AiVisualIdentityBuilderModal.js`

**Code Sebelum (Current/Before)**

```js
primary_style: 'editorial_graphic_novel',
supporting_styles: ['isometric_society', 'symbolic_surrealism', 'paper_cutout_documentary']
```

**Code Sesudah (Proposed/After)**

```js
primary_style: DEFAULT_VISUAL_STYLE,
supporting_styles: []
```

Modal memakai komponen/pengelompokan yang sama dengan Studio, mencegah supporting-only mode dipilih sebagai primary bila catalog role melarangnya, dan tetap menggunakan state/event handler di Client Component sesuai Next.js 16.

### `scripts/migrate-visual-identity-primary-styles.mjs` (baru)

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```js
const mode = args.has('--apply') ? 'apply' : 'dry-run';
const candidates = await auditVisualIdentityStyles(client);

if (mode === 'apply') {
  requireConfirmation(args, '--confirm-visual-style-migration');
  await applySafeCandidatesInTransaction(client, candidates.safeAutoFix);
}
```

Script membaca environment yang sudah tersedia, menghormati `PG_SEARCH_PATH`, mengeluarkan manifest audit, dan tidak pernah mencetak credential.

### `package.json`

**Code Sebelum (Current/Before)**

```json
"test:visual-identity": "node scripts/test-visual-identity-foundation.mjs"
```

**Code Sesudah (Proposed/After)**

```json
"test:visual-identity": "node scripts/test-visual-identity-foundation.mjs",
"visual-identity:style-audit": "node scripts/migrate-visual-identity-primary-styles.mjs --dry-run",
"visual-identity:style-migrate": "node scripts/migrate-visual-identity-primary-styles.mjs --apply"
```

### `scripts/test-visual-identity-foundation.mjs`

**Code Sebelum (Current/Before)**

```js
const sagePreset = getSystemVisualIdentity('hands_only_muslimah_sage_kitchen');
assert.ok(sagePreset);
assert.equal(sagePreset.label, 'Muslimah Sage Kitchen');
```

**Code Sesudah (Proposed/After)**

```js
assertSystemPresetStyle('hands_only_muslimah_sage_kitchen', 'culinary_cinematic');
assertSystemPresetStyle('hands_only_southeast_asian_male', 'commercial_product_cinematic');
assertSystemPresetStyle('hands_only_caucasian_male_caramel', 'commercial_product_cinematic');
assertSystemPresetStyle('stylized_3d_muslimah_emerald', 'stylized_3d_character');
assertSystemPresetStyle('mascot_herbal_ginger_guardian', 'cozy_claymation');
assert.throws(() => validateSchemaV2WithUnknownStyle(), /INVALID_VISUAL_STYLE/);
```

Test juga mencakup mapper legacy, prompt resolver, route fallback, migration idempotency, tenant isolation, dan bahwa primary style system preset tidak semuanya sama.

### `scripts/test-ai-visual-identity-builder.mjs`

**Code Sebelum (Current/Before)**

```js
assert.equal(normalizedConfig.visual_language.primary_style, 'editorial_graphic_novel');
```

**Code Sesudah (Proposed/After)**

```js
assert.throws(
  () => normalizeAiVisualIdentityResult(invalidStyleEnvelope),
  error => error.code === 'INVALID_VISUAL_STYLE'
);
assert.equal(neutralBrief.primary_style, 'cinematic_realistic');
```

Test memastikan generator tetap single-pass dan dapat memilih realistic, culinary, 3D, serta editorial berdasarkan brief.

### `tests/test-visual-identity-allocator.mjs`

**Code Sebelum (Current/Before)**

```js
assert.ok(distinctModes10.has('editorial_graphic_novel'));
```

**Code Sesudah (Proposed/After)**

```js
assert.equal(
  allocateClipsToNarrativeModes(4, {}, 'culinary_cinematic')[0].visualMode,
  'culinary_cinematic'
);
assert.ok(editorialAllocation.some(item => item.visualMode === 'editorial_graphic_novel'));
```

### `public/mockup_visual_identity_style_taxonomy.html` (baru)

**Code Sebelum (Current/Before)**

```text
File belum ada.
```

**Code Sesudah (Proposed/After)**

```html
<section class="style-family" data-family="cinematic">
  <button class="style-card is-primary" data-style="cinematic_realistic">
    <span class="badge">Primary</span>
    <strong>Cinematic Realistic</strong>
  </button>
</section>
```

CSS mockup hanya memakai semantic tokens seperti `var(--surface)`, `var(--text-primary)`, `var(--border-subtle)`, dan `var(--action-primary)`.

### `sot/global/vso-engine.md`

**Code Sebelum (Current/Before)**

```md
Preset VSO dipetakan ke deskripsi visual sebelum dikirim ke generator.
```

**Code Sesudah (Proposed/After)**

```md
Visual Identity schema v2 memisahkan rendering medium, art direction,
dan narrative mode. Unknown schema-v2 style ditolak; legacy style hanya
dipetakan melalui compatibility map resmi.
```

Dokumentasi mencatat taxonomy, default netral, aturan strict-write/legacy-read, serta prosedur audit/migrasi.

## Urutan Implementasi

1. Buat mockup taxonomy dan minta review pengguna.
2. Tambahkan taxonomy metadata dan default netral ke katalog.
3. Refactor contract/mapper agar strict-write dan legacy-read terpisah.
4. Koreksi kelima system preset.
5. Ubah resolver dan allocator untuk memakai katalog tunggal.
6. Perbarui AI contract/prompt tanpa mengubah arsitektur single-pass.
7. Setelah mockup disetujui, implementasikan pengelompokan dan warning UI.
8. Tambahkan audit/migration script beserta dry-run manifest.
9. Tambahkan unit, integration, migration-idempotency, dan build verification.
10. Jalankan dry-run di Dev; review semua kategori sebelum apply.
11. Apply dan verifikasi migrasi data Dev.
12. Jalankan release non-interaktif dan verifikasi tag serta branch `main` di remote.
13. Deploy immutable full Git SHA tersebut ke Dev, verifikasi API/UI/resolved prompts, lalu ulangi dry-run dan apply data di Staging sebelum deployment Staging.

## Verification Matrix

| Area | Verifikasi |
|---|---|
| Catalog | seluruh key unik dan memiliki family/medium/role/prompt |
| Contract | unknown schema-v2 style gagal jelas; legacy dikenal terpetakan |
| System preset | 6 preset menghasilkan mapping sesuai tabel |
| Resolver | resolved `active_visual_mode` dan `style_prompt` sesuai preset |
| Allocator | fallback mengikuti primary preset, bukan editorial global |
| AI builder | tetap 1 call; output lintas family tervalidasi |
| Migration | dry-run non-mutating, apply transaksional, run kedua idempotent |
| Tenant safety | hanya tenant/schema target yang berubah |
| UI | mockup disetujui; light/dark; semua warna semantic token |
| Next.js | `npm run build` berhasil pada Next.js 16.2.5 |
| Regression | existing editorial routing Wa’y Siyasi tetap identik |

Perintah verifikasi minimum:

```bash
node scripts/test-visual-identity-foundation.mjs
node scripts/test-ai-visual-identity-builder.mjs
node --test tests/test-visual-identity-allocator.mjs
npm run build
npm run visual-identity:style-audit
```

Verifikasi prompt harus membuktikan:

- preset dapur tidak memuat `political graphic novel`;
- preset 3D tidak memuat instruksi photorealistic/editorial yang berkonflik;
- Wa’y Siyasi tetap memakai routing symbolic/isometric/paper-cutout;
- unknown style tidak pernah diam-diam menjadi editorial.

## Risiko dan Mitigasi

- **Preset editorial sengaja ikut termigrasi** — gunakan heuristik berlapis dan kategori `review-required`; jangan auto-fix berdasarkan primary style saja.
- **Prompt berubah terlalu besar** — snapshot output per system preset dan bandingkan sebelum apply DB.
- **Supporting mode tidak kompatibel dengan primary** — validasi `family`/`role` dan tampilkan warning, tanpa memaksa semua family menjadi editorial.
- **Data legacy tanpa style** — gunakan default netral dengan warning, bukan editorial.
- **UI membingungkan** — mockup dan review pengguna menjadi gate sebelum React implementation.
- **Rollback database** — simpan manifest before/after dan sediakan mode restore berbasis manifest; filesystem rollback tidak dianggap rollback DB.

## Rollout dan Rollback

### Dev

1. Jalankan seluruh unit test dan build.
2. Jalankan audit dry-run pada schema `dev`.
3. Review `safe-auto-fix`, `review-required`, dan `invalid-unmapped`.
4. Apply hanya kategori safe setelah persetujuan hasil audit.
5. Deploy memakai Git-based atomic deployment dengan full remote SHA.

### Staging

1. Ulangi dry-run pada schema `staging`.
2. Bandingkan jumlah kandidat dengan Dev dan validasi sample preset.
3. Apply secara transaksional.
4. Deploy atomic dan verifikasi UI/API, PM2 cwd, schema, pool, serta resolved prompts.

### Rollback

- Aplikasi: gunakan prosedur atomic rollback environment.
- Database: jalankan restore dari manifest migrasi yang tervalidasi; jangan mengandalkan rollback aplikasi untuk membalik data.
- Production: tidak disentuh tanpa instruksi manual eksplisit pengguna.

## Acceptance Criteria

- Tidak semua card Visual Identity menampilkan `Editorial Graphic Novel`.
- Kelima system preset non-editorial memiliki primary style sesuai maknanya.
- Wa’y Siyasi tetap editorial dan narrative routing-nya tidak berubah.
- Schema-v2 style salah menghasilkan error, bukan silent fallback.
- Legacy `cinematic_realistic` dan `3d_claymation_cozy` dipetakan deterministik.
- Resolver, allocator, AI builder, dan UI memakai katalog yang sama.
- Audit tenant dapat dijalankan tanpa mutasi; apply aman, transaksional, dan idempotent.
- Tidak ada hardcoded color baru pada UI/mockup.
- Semua test target dan build lulus.
- Dev dan Staging terverifikasi sebelum release dianggap selesai.

## Execution Task List

- [x] Buat mockup HTML taxonomy menggunakan semantic CSS tokens.
- [ ] Tunjukkan mockup kepada pengguna dan dapatkan review sebelum mengubah React UI.
- [x] Tambahkan style taxonomy baru, metadata family/medium/role, dan default netral.
- [x] Implementasikan strict schema-v2 validation dan explicit legacy style mapper.
- [x] Koreksi primary style kelima system preset non-editorial.
- [x] Satukan lookup style resolver dan allocator pada katalog pusat.
- [x] Perbarui AI contract dan prompt builder sambil mempertahankan single-pass engine.
- [ ] Implementasikan UI Studio dan AI Builder sesuai mockup yang disetujui.
- [x] Buat audit/migration script dengan dry-run default, transaksi, manifest, dan idempotency.
- [x] Audit data tenant pada Dev dan klasifikasikan kandidat migrasi.
- [x] Tambahkan dan jalankan regression tests untuk contract, presets, resolver, allocator, AI, dan migrasi.
- [ ] Jalankan build Next.js 16 dan pemeriksaan semantic tokens.
- [ ] Apply migrasi Dev setelah hasil dry-run tervalidasi.
- [ ] Jalankan release non-interaktif patch, lalu verifikasi branch `main` dan tag remote.
- [ ] Deploy full Git SHA release secara atomic ke Dev dan lakukan verifikasi wajib.
- [ ] Jalankan dry-run lalu apply migrasi Staging setelah Dev lolos.
- [ ] Deploy full Git SHA yang sama secara atomic ke Staging dan lakukan verifikasi wajib.
- [x] Perbarui dokumentasi SOT taxonomy dan prosedur migrasi.
