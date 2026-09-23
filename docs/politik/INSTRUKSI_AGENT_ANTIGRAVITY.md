# Instruksi Eksekusi untuk Agent Antigravity

Anda ditugaskan mengimplementasikan **Visual Identity Studio v2** pada repository ContentFlow.

## Sumber Wajib

Baca seluruh file berikut sebelum mengubah kode:

1. `AGENTS.md`
2. `docs/politik/implementation_plan.md`
3. `docs/politik/BRAND_PROFILE_WAY_SIYASI.md`
4. `docs/politik/POLITICAL_VISUAL_IDENTITY.md`
5. `public/mockup_visual_identity_studio_v2.html`
6. Panduan Next.js yang relevan di `node_modules/next/dist/docs/`

`docs/politik/implementation_plan.md` adalah sumber utama scope, desain schema, daftar file, snippet sebelum/sesudah, test cases, acceptance criteria, dan urutan eksekusi. Jangan mengimplementasikan berdasarkan ringkasan saja.

## Tujuan

Perbaiki menu `Settings → Visual Identity` agar mendukung multi-mode visual language untuk Wa’y Siyasi dan brand lain.

Sistem harus membedakan:

- **Subject:** human, blank-face 3D, animal, atau mascot/object.
- **Visual language:** gaya rendering dan cara visual menjelaskan narasi.
- **Narrative routing:** pemilihan gaya visual berdasarkan fungsi setiap scene.

Enam gaya berikut adalah **visual-language modes**, bukan `subject.kind`:

1. Editorial Graphic Novel
2. Isometric Society
3. Symbolic Surrealism
4. Paper Cutout Documentary
5. Shadow & Silhouette
6. Clay Political Theater

## Hasil yang Wajib Dicapai

1. Tambahkan schema Visual Identity v2 secara backward-compatible.
2. Pertahankan seluruh blok dan preset schema v1.
3. Tambahkan katalog visual-language deterministik.
4. Tambahkan satu primary style dan beberapa supporting styles.
5. Tambahkan narrative mode routing untuk:
   - `hook`
   - `context`
   - `mechanism`
   - `consequence`
   - `evidence_reveal`
   - `conclusion`
6. Perluas vocabulary camera, population, rendering, composition, texture, dan metaphor.
7. Perbaiki resolver agar keenam mode memiliki prompt fragment sendiri.
8. Izinkan intentional faceless group/crowd, tetapi tetap larang unintended people dan wajah yang terlihat.
9. Tambahkan system preset `way_siyasi_editorial_system`.
10. Ubah AI Visual Identity Builder menjadi alur lima langkah sesuai mockup.
11. Perbarui editor manual dan kartu preset agar menampilkan primary/supporting styles dan routing.
12. Tambahkan test untuk schema, resolver, preset, AI builder, tenant isolation, dan regresi preset lama.

## Default Wa’y Siyasi

- Primary style: `editorial_graphic_novel`
- Supporting styles:
  - `isometric_society`
  - `symbolic_surrealism`
  - `paper_cutout_documentary`
- Disabled by default:
  - `shadow_silhouette`
  - `clay_political_theater`
- Subject: faceless contemporary human
- Population: single, group, atau intentional crowd
- Format: vertical 9:16
- Texture: subtle printed-paper grain dan editorial ink
- Palette: charcoal, off-white, warm gray, muted beige, maksimal satu accent color per scene
- Scene principle: satu primary subject dan satu primary idea

Default routing:

```json
{
  "hook": "symbolic_surrealism",
  "context": "editorial_graphic_novel",
  "mechanism": "isometric_society",
  "consequence": "editorial_graphic_novel",
  "evidence_reveal": "paper_cutout_documentary",
  "conclusion": "symbolic_surrealism"
}
```

## Aturan Implementasi

1. Jalankan `git status` sebelum mulai dan catat perubahan yang sudah ada.
2. Perubahan yang sudah ada adalah milik pengguna. Jangan menghapus, mereset, menimpa, atau memasukkannya secara tidak sengaja.
3. Gunakan `apply_patch` untuk perubahan kode dan dokumentasi.
4. Baca panduan Next.js lokal sebelum mengubah App Router atau Client Component.
5. Jangan menambahkan keenam gaya visual ke `SUBJECT_KINDS`.
6. Jangan membuat migrasi database kecuali terdapat bukti objektif bahwa `config_json JSONB` tidak mencukupi.
7. Jangan mengubah format API route jika normalisasi di contract/repository sudah mencukupi.
8. Jangan membuat call AI kedua. AI Builder dan Strategic Campaign harus tetap single-pass/one-call.
9. AI output selalu dianggap untrusted dan wajib dinormalisasi di server.
10. Pertahankan resolved fields lama agar downstream consumer tidak rusak.
11. Jangan mengubah historical snapshot yang sudah tersimpan.
12. Semua UI wajib memakai semantic CSS tokens dari `app/theme.css`.
13. Dilarang memakai hardcoded hex, RGB, warna ad-hoc, atau inline color literal.
14. Pastikan UI harmonis di light mode dan dark mode.
15. Jangan menulis API key, credential, password, atau placeholder menyerupai secret.
16. Jangan melakukan production deployment. Deployment production hanya boleh dilakukan setelah perintah eksplisit pengguna.

## Kontrol Progress Wajib

Gunakan bagian `## Execution Task List` dalam `docs/politik/implementation_plan.md` sebagai task tracker aktif.

Setelah menyelesaikan setiap tahap:

1. Segera ubah checkbox tahap tersebut dari `- [ ]` menjadi `- [x]`.
2. Jangan menunggu sampai seluruh implementasi selesai.
3. Jangan menandai task selesai sebelum implementasi atau verifikasinya benar-benar selesai.
4. Jika perlu memperluas scope ke file lain, tuliskan alasan dan file tambahan dalam implementation plan sebelum mengeditnya.

## Ketentuan UI

Ikuti `public/mockup_visual_identity_studio_v2.html` sebagai UX contract.

Builder harus memiliki lima langkah:

1. Brand Foundation
2. Subject System
3. Visual Language
4. Narrative Mode Routing
5. Consistency & Review

Interaksi minimum:

- Setiap style card memiliki status Primary, Supporting, atau Off.
- Hanya boleh ada satu Primary.
- Memilih Primary baru menurunkan Primary lama menjadi Supporting.
- Route selector hanya menampilkan style yang aktif.
- Menonaktifkan style yang sedang digunakan harus memperbaiki route ke Primary.
- Live preview menampilkan subject, primary style, supporting styles, aspect ratio, dan resolved prompt.
- Preset Wa’y Siyasi dapat dipilih dan di-clone, tetapi system preset tidak dapat diedit langsung.
- Kontrol lama untuk wardrobe/environment tetap tersedia sebagai Advanced Controls.

## Pengujian Wajib

Tambahkan atau perbarui test sesuai rincian pada implementation plan, lalu jalankan:

```bash
npm run test:visual-identity
npm run test:ai-visual-identity
npm run build
```

Jangan melanjutkan ke release jika salah satu perintah gagal.

Manual verification minimum:

1. Buka `/settings/visual-identities`.
2. Jalankan builder lima langkah.
3. Pilih preset Wa’y Siyasi.
4. Ganti primary style dan periksa demotion otomatis.
5. Nonaktifkan routed style dan periksa route fallback.
6. Periksa live prompt setelah routing berubah.
7. Simpan, buka kembali, clone, dan archive user preset.
8. Periksa system preset tetap read-only dan cloneable.
9. Periksa light/dark mode dan narrow viewport.
10. Pastikan preset lifestyle/clay lama tidak mengalami regresi.

## Release Wajib Setelah Verifikasi Berhasil

Setelah seluruh pengujian dan build berhasil, jalankan:

```bash
npm run release-non-interactive -- --type patch --title "Visual Identity Studio v2" --points "Tambah multi-mode visual language dan narrative routing|Tambah preset editorial Wa’y Siyasi|Pertahankan kompatibilitas preset Visual Identity lama"
```

Kemudian verifikasi:

- Versi dan changelog sudah diperbarui.
- Commit dan tag `vX.Y.Z` terbentuk.
- Branch `main` sudah terunggah.
- Tag baru sudah terunggah ke `https://github.com/sabeq83/maknaflow.git`.

## Kondisi Wajib Berhenti dan Meminta Arahan

Berhenti dan minta arahan pengguna apabila:

- Mockup perlu diubah secara material.
- Implementasi membutuhkan migrasi destruktif terhadap preset lama.
- Perubahan memerlukan call AI kedua.
- Perubahan milik pengguna bertabrakan dan tidak dapat dipertahankan dengan aman.
- Diperlukan deployment production.
- Scope perlu diperluas secara material di luar implementation plan.

## Format Laporan Akhir

Laporan akhir harus berisi:

1. Ringkasan hasil.
2. Daftar file yang diubah.
3. Status seluruh task dalam implementation plan.
4. Hasil setiap test dan build.
5. Hasil manual verification.
6. Nomor versi dan tag release.
7. Verifikasi push branch dan tag.
8. Risiko atau pekerjaan tersisa.
9. Pernyataan eksplisit bahwa production tidak dideploy.

