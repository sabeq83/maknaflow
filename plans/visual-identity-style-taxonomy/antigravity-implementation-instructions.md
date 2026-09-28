# Instruksi Agent AI Antigravity — Visual Identity Style Taxonomy & Safe Migration

## Mandat

Kerjakan rencana berikut sampai Definition of Done terbukti:

- `plans/visual-identity-style-taxonomy/implementation_plan.md`

Target utama adalah memperbaiki bug yang menyebabkan hampir semua preset Visual Identity tampil dan ter-resolve sebagai `Editorial Graphic Novel`. Hasil akhir harus memiliki taxonomy visual lintas use case, mapping system preset yang benar, validasi tanpa silent fallback, pemisahan medium/art direction/narrative mode, serta audit dan migrasi tenant yang aman.

Ini adalah tugas implementasi penuh, bukan sekadar audit atau rekomendasi. Namun perubahan UI React/Next.js memiliki **manual review gate**: buat dan tunjukkan mockup HTML terlebih dahulu, lalu hentikan bagian UI sampai pengguna menyetujui mockup. Pekerjaan backend/non-UI yang tidak mengunci keputusan visual boleh dilanjutkan sambil menunggu review bila aman.

## Sumber Kebenaran dan Bacaan Wajib

Sebelum mengubah file apa pun:

1. Baca `AGENTS.md` repository secara penuh.
2. Baca seluruh `plans/visual-identity-style-taxonomy/implementation_plan.md`, termasuk before/after snippets, acceptance criteria, rollout, dan `Execution Task List`.
3. Baca `sot/global/vso-engine.md` dan `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md`.
4. Periksa `git status`; jangan menimpa perubahan pengguna atau agent lain.
5. Inspeksi implementasi aktual minimal pada:
   - `lib/visual-language-catalog.js`
   - `lib/visual-identity-contract.js`
   - `lib/visual-identity-system-presets.js`
   - `lib/visual-identity-repository.js`
   - `lib/visual-override-resolver.js`
   - `lib/visual-identity-allocator.js`
   - `lib/visual-identity-ai-contract.js`
   - `lib/visual-identity-ai-builder.js`
   - `app/settings/visual-identities/page.js`
   - `app/components/AiVisualIdentityBuilderModal.js`
   - test Visual Identity yang ada.
6. Sebelum mengubah Next.js/React, baca dokumentasi relevan dari versi repository pada `node_modules/next/dist/docs/`, terutama Server/Client Components dan `use client`. Jangan mengandalkan asumsi versi Next.js dari training data.
7. Anggap snippet dalam plan sebagai arah desain, bukan patch literal. Cocokkan dengan source dan schema aktual.

Jika source aktual berbeda material dari plan, update plan terlebih dahulu. Setiap file tambahan yang hendak diubah wajib ditambahkan ke bagian `File Changes — Before & After` lengkap dengan path, alasan, Code Sebelum, dan Code Sesudah **sebelum** file tersebut diedit.

## Batas Scope dan Keselamatan

- Jangan mengubah Strategic Campaign menjadi arsitektur dua-call; single-pass engine tetap wajib.
- Jangan melakukan refactor besar di luar Visual Identity.
- Jangan merusak kompatibilitas snapshot campaign lama.
- Jangan memodifikasi Production atau schema `public` tanpa perintah eksplisit pengguna.
- Jangan menjalankan migrasi data Staging sebelum Dev lolos.
- Jangan mengubah record tenant hanya karena primary style-nya editorial. Editorial bisa merupakan pilihan sah.
- Jangan menyimpan API key, token, password, connection string, cookie, atau data sensitif ke source, mockup, log, report, atau manifest migrasi.
- Jangan mencetak `.env.local` atau credential database. Gunakan hanya indikator `PRESENT/ABSENT`, row count, ID aman, dan field visual yang memang diperlukan.
- Jangan membuat contoh secret dengan format credential asli. Gunakan placeholder netral bila diperlukan.
- Jangan deploy Production.

## Fase 0 — Baseline yang Harus Dibuktikan

Sebelum implementasi, rekam baseline evidence:

1. Jalankan reproduksi lokal terhadap `listSystemVisualIdentities()`.
2. Catat primary style keenam system preset.
3. Buktikan bahwa lima preset non-editorial saat ini ter-normalisasi menjadi `editorial_graphic_novel`.
4. Telusuri semua fallback literal `editorial_graphic_novel` dengan `rg`.
5. Kelompokkan setiap kemunculan sebagai:
   - legitimate explicit editorial choice;
   - unsafe global fallback;
   - example/test fixture;
   - compatibility mapping.
6. Jangan menghapus explicit editorial choice milik Wa’y Siyasi.

Masukkan ringkasan baseline ke laporan kerja atau bagian catatan plan. Jangan menandai task implementasi selesai hanya berdasarkan reproduksi.

## Fase 1 — Mockup HTML Creative yang Riil

### Tujuan

Buat:

```text
public/mockup_visual_identity_style_taxonomy.html
```

Mockup bukan wireframe generik. Mockup harus merepresentasikan Visual Identity Studio nyata berdasarkan code dan database yang sedang digunakan.

### Sumber data mockup

Gunakan urutan sumber berikut:

1. **Code aktual**: baca system preset dari `lib/visual-identity-system-presets.js` melalui fungsi publik aplikasi, bukan menyalin label berdasarkan ingatan.
2. **Database aktual Dev terlebih dahulu**: lakukan audit read-only terhadap `visual_identity_presets` pada schema `dev` menggunakan helper environment resmi repository atau melalui API aplikasi yang sudah terautentikasi.
3. Bila Dev belum dapat dijangkau, gunakan Staging hanya untuk audit read-only dan nyatakan environment pada bukti. Jangan mutasi Staging pada fase mockup.
4. Bila koneksi langsung lokal memakai tunnel dan tunnel belum aktif, gunakan prosedur SSH/read-only yang sah dari SOP atau endpoint aplikasi. Jangan mengarang record database.
5. Bila semua jalur database tidak tersedia, tampilkan system preset nyata dari code dan beri blok jelas `Tenant presets unavailable in current environment`; jangan membuat tenant preset fiktif lalu menyebutnya data riil.

Data tenant yang boleh masuk mockup hanya data aman:

- preset key/ID non-secret;
- label;
- description;
- source/status/version;
- primary/supporting style;
- rendering metadata yang tidak sensitif.

Jangan embed prompt rahasia, reference asset signed URL, filesystem internal, identity data pribadi, credential, atau payload campaign. Jika mockup disimpan di Git, gunakan **sanitized snapshot** dari hasil audit dan beri komentar timestamp/environment/source. Jangan membuat mockup melakukan koneksi database dari browser.

### Kualitas visual dan interaksi

Mockup harus creative, polished, dan realistis terhadap aplikasi saat ini. Minimal menyediakan:

- sidebar/header yang konsisten dengan Visual Identity Studio;
- tab `System`, `My Presets`, dan `Archived` sesuai UI aktual;
- card keenam system preset dengan mapping target yang benar;
- grouping/filter berdasarkan `family`, `medium`, dan `role`;
- badge `Primary`, `Supporting`, `Legacy`, dan `Needs Review` bila relevan;
- panel detail yang menjelaskan tiga lapisan:
  - Rendering Medium;
  - Art Direction;
  - Narrative Modes;
- interactive primary selection dan supporting-mode selection;
- aturan bahwa supporting-only style tidak dapat dipilih sebagai primary;
- comparison state `Before` vs `Proposed` agar pengguna melihat bug dan solusi;
- warning state untuk legacy/unmapped style;
- contoh preview resolved style prompt yang berasal dari catalog aktual dan sudah disanitasi;
- responsive desktop/mobile behavior;
- light/dark mode.

Gunakan hanya semantic CSS tokens dari `app/theme.css`. Dilarang memakai warna hex/rgb/hsl hardcoded. Jika standalone HTML tidak dapat langsung mengimpor seluruh theme, deklarasikan hanya alias yang merujuk pada semantic token names yang sama dan jelaskan keterbatasannya; jangan mengganti dengan palet ad-hoc.

JavaScript mockup harus self-contained, aman, dan hanya mensimulasikan interaksi UI. Jangan melakukan mutation API atau database.

### Validasi terhadap code/database

Sebelum meminta review pengguna, buktikan:

- seluruh system preset pada mockup cocok dengan source aktual;
- jumlah tenant preset dan label yang ditampilkan cocok dengan audit database/API pada saat snapshot;
- mapping proposed mengikuti tabel di implementation plan;
- tidak ada secret atau private asset URL dalam HTML;
- tidak ada hardcoded color statis;
- mockup dapat dibuka dan seluruh interaksi utama berfungsi.

Tunjukkan mockup kepada pengguna melalui preview/link aplikasi yang tersedia. Setelah itu minta review eksplisit. Jangan mulai perubahan React UI sebelum disetujui.

Setelah mockup selesai dan tervalidasi, segera centang task mockup pada `Execution Task List`. Centang task review hanya setelah pengguna benar-benar menyetujui.

## Fase 2 — Taxonomy Pusat

Implementasikan katalog pusat di `lib/visual-language-catalog.js`:

- `cinematic_realistic`
- `commercial_product_cinematic`
- `culinary_cinematic`
- `stylized_3d_character`
- `cozy_claymation`
- seluruh style editorial existing.

Setiap entry wajib memiliki:

- stable key;
- label dan description;
- `family`;
- `medium`;
- `role` (`primary`, `supporting`, atau `both`);
- production prompt;
- negative prompts.

Tetapkan `DEFAULT_VISUAL_STYLE = 'cinematic_realistic'` sebagai default netral. Jangan duplikasi deskripsi katalog di allocator atau UI; sediakan helper yang dapat dipakai server dan Client Component tanpa membawa dependency server-only.

`getVisualStyleDefinition()` harus membedakan:

- key kosong yang sah memakai default netral pada konteks draft baru;
- key tidak dikenal yang harus menghasilkan error terstruktur.

## Fase 3 — Contract, Compatibility, dan System Preset

### Strict write

Untuk schema v2 create/update dan output AI:

- primary style invalid harus gagal dengan code `INVALID_VISUAL_STYLE`;
- supporting style invalid harus gagal dan menyebut path/index;
- supporting-only style tidak boleh menjadi primary bila metadata role melarangnya;
- jangan membuang nilai invalid diam-diam;
- correction route yang menunjuk style tidak aktif boleh kembali ke primary, tetapi wajib terlihat pada compliance report.

### Legacy read

Buat mapper legacy eksplisit, minimal:

```js
cinematic_realistic -> cinematic_realistic
3d_claymation_cozy -> cozy_claymation
```

Legacy unknown menggunakan default netral hanya bersama warning terstruktur. Jangan memakai fallback editorial.

Pastikan `style.preset_key` dan `visual_language.primary_style` tidak saling menimpa dengan urutan spread yang salah. Canonical output harus konsisten.

### System preset mapping

Terapkan persis:

- Wa’y Siyasi → `editorial_graphic_novel`
- Muslimah Sage Kitchen → `culinary_cinematic`
- Southeast Asian Male Casual → `commercial_product_cinematic`
- Caucasian Male Caramel → `commercial_product_cinematic`
- 3D Muslimah Emerald → `stylized_3d_character`
- Ginger Guardian → `cozy_claymation`

Jangan hanya memperbaiki label UI. Pastikan resolver menghasilkan `active_visual_mode` dan `style_prompt` yang benar untuk keenam preset.

## Fase 4 — Resolver dan Allocator

- Resolver wajib mengambil definisi dari katalog pusat.
- Default resolver netral adalah `cinematic_realistic` hanya bila style benar-benar absent pada draft/legacy context yang diperbolehkan.
- Unknown schema-v2 style harus gagal secara actionable.
- Narrative routing tetap dapat memakai supporting style aktif.
- Allocator fallback mengikuti primary style preset, bukan nilai editorial global.
- Hapus katalog deskripsi duplikat dari allocator setelah seluruh consumer dipindahkan.
- Snapshot existing harus tetap resolvable secara backward-compatible dan menyertakan warning bila dipetakan dari legacy.

## Fase 5 — AI Builder Single-Pass

Perbarui contract dan prompt AI Builder agar memahami metadata family/medium/role.

Ketentuan:

- tetap tepat satu call Gemini per generate/refine;
- jangan menambah Call 2;
- contoh envelope default bersifat netral dan tidak memancing semua output menjadi editorial;
- style harus dipilih berdasarkan seed/purpose/subject/environment;
- supporting-only style tidak boleh dipilih sebagai primary;
- output invalid ditolak, bukan dikoreksi diam-diam;
- Wa’y Siyasi tetap dapat menghasilkan sistem editorial multi-mode yang sama.

Tambahkan test brief minimal untuk:

- culinary/hands-only;
- commercial product/lifestyle;
- stylized 3D character;
- clay mascot;
- political editorial.

## Fase 6 — React UI Setelah Mockup Disetujui

Hanya kerjakan fase ini setelah pengguna menyetujui mockup.

- Implementasikan struktur dan interaksi yang disetujui ke Visual Identity Studio dan AI Builder.
- Jangan memasukkan HTML mockup mentah ke React; adaptasikan ke komponen/pola codebase.
- Pertahankan `'use client'` hanya pada boundary interaktif yang memang diperlukan.
- Gunakan katalog pusat untuk label/grouping/role; jangan membuat array style kedua di komponen.
- Gunakan 100% semantic CSS tokens dari `app/theme.css`.
- Jangan memakai hardcoded hex/rgb/hsl pada inline style atau stylesheet.
- Berikan warning jelas untuk legacy/unmapped records tanpa menakut-nakuti atau menyembunyikan data.
- UI tidak boleh menjadi satu-satunya enforcement; server contract tetap otoritatif.

Pengujian UI manual oleh pengguna adalah acceptance visual utama. Jangan melakukan browser automation berlebihan kecuali dibutuhkan untuk smoke dasar.

## Fase 7 — Audit dan Migrasi Database Riil

Buat `scripts/migrate-visual-identity-primary-styles.mjs` dengan dry-run sebagai default.

### Audit wajib

Query tenant preset aktual dan klasifikasikan:

- `safe-auto-fix`;
- `review-required`;
- `already-correct`;
- `invalid-unmapped`.

Jangan memakai heuristic `primary_style === editorial_graphic_novel` sendirian. Minimal pertimbangkan:

- legacy `style.preset_key`;
- supporting styles;
- mode routing;
- subject kind/demographic;
- preset key/label/description;
- rendering geometry/finish;
- created/updated version bila relevan.

### Dry-run output

Output wajib berisi:

- environment/schema target;
- total record;
- jumlah per kategori;
- ID/key/label aman untuk kandidat;
- current primary, legacy style, proposed primary, dan reason code;
- nol mutation.

Jangan mencetak full config bila berpotensi memuat data sensitif.

### Apply

Apply hanya diperbolehkan dengan:

```bash
--apply --confirm-visual-style-migration
```

Ketentuan:

- transaksi database;
- tenant scoped;
- hanya kategori `safe-auto-fix` otomatis;
- optimistic guard/WHERE memastikan record belum berubah sejak audit;
- version bertambah;
- `updated_at` diperbarui;
- manifest before/after aman dibuat untuk rollback;
- run kedua idempotent;
- failure satu batch me-roll back seluruh batch.

Jangan menjalankan apply Staging sebelum hasil Dev diverifikasi. Jangan menyentuh Production.

## Kontrol Progress Real-Time

Setelah setiap tahapan benar-benar selesai dan diverifikasi, segera ubah checkbox terkait dalam:

```text
plans/visual-identity-style-taxonomy/implementation_plan.md
```

dari:

```md
- [ ] Task
```

menjadi:

```md
- [x] Task
```

Jangan mencentang task hanya karena source sudah ditulis. Harus ada bukti test, audit, review pengguna, deploy, atau verifikasi yang sesuai.

## Test Gate Wajib

Minimal jalankan:

```bash
node scripts/test-visual-identity-foundation.mjs
node scripts/test-ai-visual-identity-builder.mjs
node --test tests/test-visual-identity-allocator.mjs
npm run build
npm run visual-identity:style-audit
```

Tambahkan test yang membuktikan:

1. Keenam system preset memiliki mapping persis sesuai plan.
2. Tidak semua system preset memiliki primary style sama.
3. Preset dapur tidak menghasilkan prompt politik/graphic novel.
4. Preset 3D tidak menghasilkan prompt photorealistic atau editorial yang berkonflik.
5. Ginger Guardian menghasilkan clay/cozy prompt.
6. Wa’y Siyasi tetap menghasilkan routing symbolic/isometric/paper-cutout.
7. Unknown schema-v2 primary/supporting style gagal dengan error terstruktur.
8. Legacy style dikenal terpetakan deterministik.
9. Legacy unknown menghasilkan warning dan default netral, bukan editorial.
10. Allocator fallback memakai primary preset.
11. AI Builder tetap single-pass.
12. Dry-run migrasi tidak mengubah row.
13. Apply migrasi hanya mengubah safe candidate.
14. Apply kedua menghasilkan nol perubahan.
15. Tenant isolation tetap berlaku.
16. Mockup dan UI tidak mengandung hardcoded color atau secret pattern.

Jika test DB tidak dapat berjalan lokal karena tunnel tidak aktif, jalankan integration test pada Dev Mac Mini/schema `dev`. Jangan mengganti integration proof dengan skip lalu mengklaim selesai.

## Urutan Release dan Deployment

Ikuti urutan ini setelah source, test, build, mockup review, dan Dev migration dry-run/apply selesai:

1. Pastikan checklist implementasi relevan sudah tercentang dengan bukti.
2. Jalankan release non-interaktif patch:

```bash
npm run release-non-interactive -- --type patch --title "Perbaiki Visual Identity Style Taxonomy" --points "Tambah taxonomy cinematic commercial culinary 3D dan clay|Hapus silent fallback Editorial Graphic Novel|Tambah audit dan migrasi aman preset tenant"
```

3. Verifikasi commit release, changelog, branch `main`, dan tag `vX.Y.Z` tersedia di remote.
4. Resolve full 40-character Git SHA release tersebut.
5. Jalankan Dev atomic dry-run lalu apply menggunakan full Git SHA sesuai SOT.
6. Verifikasi Dev: `current`, manifest, HTTP 200 UI/API, PM2 online, `pm_cwd`, `PG_SEARCH_PATH=dev`, `PGPOOL_MAX=3`, shared paths, dan resolved prompt keenam preset.
7. Setelah Dev lolos, jalankan Staging database dry-run; review kandidat sebelum apply.
8. Apply migrasi Staging yang aman.
9. Deploy full Git SHA yang sama ke Staging melalui atomic deployment.
10. Verifikasi Staging: `current`, manifest, HTTP 200 UI/API, PM2 online, `pm_cwd`, `PG_SEARCH_PATH=staging`, `PGPOOL_MAX=3`, shared paths, UI cards, dan resolved prompts.

Jangan polling SSH setiap 10–15 detik. Gunakan sesi deployment yang sama dan interval tunggu sekitar 60–120 detik. Jangan deploy Production.

## Definition of Done

Tugas dianggap selesai hanya jika semuanya terbukti:

- mockup creative yang riil terhadap code/database sudah dibuat dan disetujui pengguna;
- lima preset non-editorial tidak lagi tampil/ter-resolve sebagai Editorial Graphic Novel;
- Wa’y Siyasi tetap editorial;
- taxonomy pusat digunakan oleh contract, resolver, allocator, AI Builder, dan UI;
- silent fallback schema v2 sudah hilang;
- compatibility mapper legacy tetap menjaga snapshot lama;
- audit Dev dan Staging memiliki bukti serta tidak mengekspose secret;
- hanya safe candidates yang termigrasi;
- migration idempotent dan memiliki manifest rollback;
- semua focused tests dan build exit code `0`;
- release, tag, dan push remote terverifikasi;
- Dev dan Staging atomic deployment sehat;
- Production tidak disentuh;
- seluruh checkbox plan yang benar-benar selesai sudah diperbarui.

## Penanganan Blocker

- Jika database tidak dapat dijangkau, exhaust jalur helper lokal, API authenticated, dan SSH read-only sesuai SOP. Bila tetap gagal, selesaikan bagian code/system preset/mockup berbasis source, tandai data tenant sebagai belum terverifikasi, dan jangan jalankan apply.
- Jika audit menemukan preset ambigu, masukkan `review-required`; jangan auto-fix.
- Jika perubahan taxonomy berpotensi membuat snapshot campaign lama gagal, pertahankan compatibility adapter dan tambahkan fixture snapshot sebelum melanjutkan.
- Jika mockup belum disetujui, jangan mengubah React UI. Laporkan link/path mockup dan keputusan yang diperlukan.
- Jika test gagal karena regression existing, buktikan baseline dan pisahkan dari regression akibat perubahan; jangan melemahkan assertion.
- Jika production deployment diminta secara implisit oleh pipeline, hentikan dan minta instruksi eksplisit pengguna.

## Format Laporan Saat Menunggu Review Mockup

Laporkan:

- path/link mockup;
- sumber data code dan database beserta timestamp/environment;
- jumlah system/tenant preset yang direpresentasikan;
- interaksi utama yang perlu diuji pengguna;
- perbedaan utama Before vs Proposed;
- pertanyaan keputusan visual yang benar-benar diperlukan.

Jangan mengklaim implementasi UI selesai pada tahap ini.

## Format Laporan Akhir

Laporkan secara ringkas dan evidence-based:

- mapping final keenam system preset;
- taxonomy dan fallback policy final;
- hasil audit/migrasi per environment dan jumlah record tiap kategori;
- file utama yang berubah;
- hasil test dan build beserta exit code;
- hasil manual UI review;
- version, commit SHA, tag, dan status push;
- bukti deployment Dev/Staging dan health checks;
- record `review-required`, risiko, atau pekerjaan tersisa;
- konfirmasi bahwa Production tidak disentuh dan tidak ada secret terpapar.

