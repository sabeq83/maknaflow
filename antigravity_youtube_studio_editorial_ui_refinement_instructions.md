# Instruksi Agent AI Antigravity — YouTube Studio One-Column UI Refinement

## Mandat

Refactor UI YouTube Studio Fase 1 agar menjadi **satu kolom vertikal** sesuai:

- `sot/menus/youtube-studio-editorial-ui-refinement-implementation-plan.md`
- `sot/menus/youtube-studio-editorial-workflow-implementation-plan.md`
- `AGENTS.md`

Pertahankan workflow/API editorial yang telah ada. Fokus perubahan adalah UX, semantic markup, theme alignment, feedback state, dan responsive behavior.

Target workflow visual:

```text
Channel → AI Strategy → Content Series → Episode Ideas & Planned Episodes
```

Jangan mengerjakan Blueprint, Script, TTS, G-Labs, renderer, publishing, Shorts, analytics, atau monetization.

## Bacaan dan Audit Wajib

1. Baca `AGENTS.md` sepenuhnya.
2. Baca rencana refinement ini sepenuhnya.
3. Baca `app/theme.css` dan bagian relevan dari `app/globals.css` sebelum menulis CSS.
4. Baca dokumentasi Next.js lokal untuk Client Components dan CSS Modules sebelum mengubah komponen.
5. Audit `app/youtube-studio/**`, `lib/youtube-studio-*`, dan route workflow untuk memastikan UI tidak mengubah domain behavior.
6. Jalankan `git status`; lindungi perubahan existing milik user/agent lain.

## Aturan UI Wajib

- Hilangkan layout dua kolom, left rail series, dan tab yang menyembunyikan langkah workflow.
- Bangun satu alur vertikal dengan section semantik untuk Channel, AI Strategy, Series, dan Episodes.
- Gunakan CSS Module scoped; jangan menaruh CSS YouTube Studio di `globals.css` atau membuat theme baru.
- Gunakan nama class semantik: `workflowStep`, `stepHeader`, `statusNotice`, `strategyDraft`, `ideaCard`, `episodeCard`, dan sejenisnya. Jangan gunakan nama berdasarkan warna/posisi seperti `purpleBox`, `leftPanel`, atau `card2`.
- Seluruh warna/surface/text/border/action/status/radius/shadow/transisi harus memakai token `app/theme.css`.
- Dilarang memakai hex, `rgb`, `rgba`, `color-mix`, atau literal warna pada JSX dan CSS YouTube Studio.
- Hapus seluruh inline `style={{...}}` di `app/youtube-studio/**`; gunakan class CSS Module atau utility global yang sudah semantik (`main-content`, `page-container`, `.btn`, `.form-*`) bila cocok.
- Jangan menghard-code nilai visual baru untuk warna, font, radius, shadow, dan spacing. Jika spacing lokal perlu ditetapkan, gunakan custom property scoped dengan nama semantik dan gunakan token global terlebih dahulu bila tersedia.
- Ganti `alert()` dengan notice non-blocking: error `role="alert"`, success/loading `aria-live="polite"`.
- Label form harus terkait dengan input; tombol memakai `type="button"`; prerequisite disabled perlu penjelasan tekstual.
- Jangan menghapus focus-visible global atau mengandalkan warna semata untuk state.

## Aturan Behaviour Wajib

- Jangan mengubah payload atau endpoint API kecuali perbaikan yang diperlukan untuk memilih response channel hasil POST secara langsung.
- Setelah create channel berhasil, gunakan objek `data.data` untuk memasukkan dan memilih channel baru—jangan mencari berdasarkan nama atau urutan list.
- Pertahankan active strategy → series → ideas → planned episode gating.
- Memilih episode tidak boleh memanggil endpoint generate blueprint/script.
- Jangan menambah side effect generation baru di UI.

## Urutan Eksekusi

1. Jalankan baseline build dan catat hasil.
2. Buat CSS Module semantik, lalu pindahkan styling dari inline JSX secara bertahap.
3. Ubah page wrapper ke `main-content` + `page-container` tanpa inline layout styling.
4. Refactor workspace menjadi flow vertikal; pertahankan handler/data-fetching yang sudah bekerja.
5. Tambahkan status/feedback accessible serta perbaikan channel-selection race.
6. Periksa light/dark dan viewport 360px, 736px, desktop.
7. Jalankan test/focused smoke serta `npm run build`.
8. Deploy dan verifikasi **hanya** pada Mac Mini Dev.
9. Update checklist plan setelah setiap bukti verifikasi berhasil.
10. Jalankan release SOP hanya setelah seluruh acceptance criteria terpenuhi.

## Kontrol Progress

Update checkbox di `sot/menus/youtube-studio-editorial-ui-refinement-implementation-plan.md` bagian `## 4. Execution Task List` dari `- [ ]` menjadi `- [x]` hanya setelah task diverifikasi.

Jika perlu mengubah file yang belum tercantum pada bagian `## 5. Planned File Changes`, tambahkan entri dengan alasan serta Code Sebelum/Code Sesudah sebelum mengeditnya.

## Verifikasi Minimum

1. Satu kolom vertikal tampil tanpa left rail, grid dua kolom, atau tab workflow tersembunyi.
2. Tidak ada inline `style` dan tidak ada literal warna pada `app/youtube-studio/**`.
3. Dark/light theme menggunakan token MAKNA Flow dan tetap terbaca.
4. Mobile 360px, tablet 736px, dan desktop usable dengan keyboard.
5. Create channel memilih channel dari response POST yang tepat.
6. Strategy → series → ideas → episode Planned bekerja tanpa regresi.
7. Tidak ada request Blueprint/Script ketika episode hanya dipilih.
8. Build Next.js berhasil.
9. Dev deployment dan smoke test berhasil di Mac Mini Dev.

## Deployment: Dev Only

Satu-satunya command deployment yang diizinkan untuk tugas ini:

```bash
npm run deploy:macmini-dev
```

Verifikasi hanya pada:

- `http://100.95.245.55:5020/youtube-studio`
- `http://100.95.245.55:7020`

**Dilarang** menjalankan deployment staging atau production, termasuk `deploy:staging`, `deploy:macmini-staging`, `deploy:macmini-prod`, `deploy:production`, `deploy:node1`, atau command lain yang menargetkan environment selain Dev.

Jangan menjalankan polling SSH berulang selama build remote. Ikuti SOP Mac Mini di `AGENTS.md`.

## Release Setelah Verifikasi

Setelah seluruh test dan Dev-only smoke test berhasil:

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio One-Column Workflow" --points "Refactor workflow editorial menjadi satu kolom vertikal|Gunakan CSS Module semantik berbasis theme MAKNA Flow|Perbaiki feedback dan pemilihan channel baru"
```

Release/push tidak memberi izin untuk deploy staging atau production.

## Laporan Akhir

Laporkan ringkas:

- Workflow/UI yang selesai dan checklist yang diperbarui.
- File utama yang berubah serta bukti tidak ada inline/literal warna.
- Hasil test/build dan responsive/accessibility smoke test.
- Bukti deployment Dev dan URL yang diverifikasi.
- Version release, commit, tag, dan push.
- Risiko atau pekerjaan tersisa.

