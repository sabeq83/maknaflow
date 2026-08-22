# Instruksi Agent AI Antigravity — YouTube Studio Information Architecture & UI Refactor

## Mandat

Implementasikan refactor struktur UI YouTube Studio berdasarkan:

1. `sot/menus/youtube-studio-information-architecture-ui-implementation-plan.md`
2. `sot/menus/youtube-studio-roadmap.md`
3. Seluruh plan Fase 1–3.5 YouTube Studio yang relevan
4. `AGENTS.md`

Tujuannya adalah mengganti satu halaman workflow panjang dengan hierarki:

```text
Channels → Channel detail → Series detail → Episode workspace
                                  ↓
                        Production Queue / Publishing
```

Episode workspace menggunakan stage navigator sembilan langkah, dengan satu stage aktif di satu waktu:

```text
Brief & Research → Blueprint → Script & Voice-over → Scene Plan → Start Frames
→ Video Production → Assemble & Review → Packaging → Publish
```

Ini adalah pekerjaan UI information architecture dan refactor presentasi. Jangan mengubah domain AI/production secara spekulatif.

## Bacaan dan Audit Wajib Sebelum Mengedit

1. Baca `AGENTS.md` sepenuhnya.
2. Baca implementation plan di atas secara penuh, termasuk `Execution Task List`, `Planned File Changes`, dan acceptance criteria.
3. Baca `app/theme.css`, `app/globals.css`, `app/youtube-studio/page.js`, `app/youtube-studio/components/YouTubeStudioWorkspace.js`, dan CSS Module-nya secara penuh.
4. Baca dokumentasi Next.js lokal yang relevan di `node_modules/next/dist/docs/` sebelum mengubah App Router/client component/query navigation.
5. Audit seluruh `app/api/v2/youtube-studio/**` dan `lib/youtube-studio-*` yang dipakai oleh UI untuk membedakan capability yang sudah nyata dari yang baru direncanakan.
6. Jalankan `git status --short` dan lindungi perubahan existing milik user/agent lain.
7. Jalankan baseline build sebelum melakukan perubahan.

## Prinsip Produk yang Tidak Boleh Dilanggar

- **Channel** adalah rumah identitas, AI strategy, dan KB.
- **Series** adalah rumah editorial guide, ide, dan backlog episode.
- **Episode** adalah unit produksi; workflow produksi tidak ditampilkan pada halaman Channel atau Series.
- **Production Queue** dan **Publishing** adalah tampilan lintas episode, bukan duplikasi detail episode.
- UI hanya boleh menyatakan capability yang benar-benar ada. Stage Start Frames, hybrid approval, packaging, atau publish yang belum end-to-end harus menjadi `Coming next`/blocked state yang jujur.
- Membuka channel, series, episode, atau stage **tidak boleh** memicu research/blueprint/script/asset/render generation. Generation hanya berjalan setelah klik CTA eksplisit.
- Pertahankan endpoint, payload, approval gate, KB snapshot, duration inheritance, and generation profile behavior yang sudah berfungsi.

## Aturan Implementasi Wajib

### URL & state

- Gunakan URL state minimal: `view`, `channel`, `series`, `episode`, `stage`.
- URL lama `/youtube-studio` harus tetap aman dan membuka Channels view.
- Deep link episode harus memuat resource yang dibutuhkan atau menampilkan not-found state semantik.
- Jangan membuat global state library baru hanya untuk refactor ini. Gunakan React state dan router/query API Next.js yang sudah tersedia sesuai dokumentasi versi lokal.

### Komponen

- Pecah `YouTubeStudioWorkspace.js` menjadi komponen sesuai plan: shell/local navigation, channels, channel detail, series detail, episode workspace/stage rail, production queue, publishing hub, analytics placeholder.
- Jangan memindahkan semua handler menjadi satu prop bag tak bernama. Definisikan props berdasarkan domain dan callback yang jelas.
- Buat resolver stage murni untuk menentukan status, label, prerequisite, dan enabled state setiap tahap. Resolver tidak boleh fetch, mutate database, atau memanggil generation API.
- Jangan menambah endpoint kecuali audit membuktikan query read-only terpisah benar-benar diperlukan. Jika diperlukan, dokumentasikan kontrak dan Before/After snippet pada implementation plan sebelum edit.

### UI / CSS semantic

- Gunakan CSS Module scoped di `app/youtube-studio/components/`; jangan menaruh CSS feature ini di `globals.css` dan jangan membuat theme baru.
- Class harus berbasis peran: `shell`, `localNavigation`, `viewContent`, `episodeStageRail`, `stagePanel`, `queueList`, `emptyState`, `statusNotice`, dan sejenisnya.
- Gunakan token semantik dari `app/theme.css` untuk seluruh surface, text, border, action, status, radius, shadow, dan transition.
- **Dilarang** memakai hex, `rgb`, `rgba`, `color-mix`, atau literal warna pada JSX/CSS YouTube Studio.
- Hapus `style={{...}}` visual pada file YouTube Studio yang disentuh; pindahkan ke semantic CSS Module. Hindari hard-coded font/radius/shadow/color. Bila spacing/layout lokal belum tersedia sebagai token, scoped custom property harus bernama semantik dan dipakai sangat terbatas.
- Pastikan contrast theme terang/gelap, focus-visible existing tidak hilang, dan status tidak mengandalkan warna saja.
- Gunakan HTML semantik: header, nav, main, section, heading hierarchy, button `type="button"`, label yang terikat input, `role="alert"` untuk error, dan `aria-live="polite"` untuk success/loading.

### Production/publishing honesty

- Migrate UI Fase 2/2.5/3 yang sudah selesai ke stage yang tepat: Research, Blueprint, Script, Scene Plan/Profile, Video Production, Assemble/Review.
- Jangan mengubah contract endpoint generation profile Google Flow, duration, production plan, worker, renderer, KB snapshot, atau data persistence tanpa kebutuhan yang terbukti.
- Jika endpoint publishing dapat digunakan end-to-end, tampilkan CTA hanya pada candidate yang memenuhi status nyata; jika belum, tampilkan status pending/coming next tanpa mock action.
- Analytics hanya placeholder—jangan membuat angka performa fiktif.

## Urutan Eksekusi

1. Selesaikan baseline/audit dan update checklist plan hanya setelah bukti tersedia.
2. Implementasikan URL workspace resolver + shell local navigation.
3. Pindahkan Channels dan Channel detail, lalu Series detail.
4. Implementasikan pure episode stage resolver dengan test fixture.
5. Implementasikan Episode workspace dan migrasikan existing capability ke panel stage yang tepat.
6. Tambahkan Production Queue, Publishing Hub, dan Analytics placeholder berdasar data aktual.
7. Selesaikan CSS semantic cleanup, responsive behavior, accessibility, empty/loading/error states.
8. Jalankan focused test, build, manual smoke tanpa generation side effect.
9. Deploy **hanya** ke Mac Mini Dev dan verifikasi.
10. Update semua checkbox yang benar-benar selesai lalu jalankan release SOP.

## Kontrol Progress Plan

Update `sot/menus/youtube-studio-information-architecture-ui-implementation-plan.md` pada bagian `## 6. Execution Task List`:

- Ubah `- [ ]` menjadi `- [x]` hanya setelah step selesai **dan** terverifikasi.
- Jika perlu mengubah file yang belum tercantum di `## 7. Planned File Changes`, tambahkan file tersebut ke plan lebih dulu dengan alasan dan Code Sebelum/Code Sesudah sebelum mengeditnya.
- Jangan mencentang deployment/release tanpa bukti command dan smoke test aktual.

## Verifikasi Minimum

1. `/youtube-studio` default membuka Channels, bukan workflow panjang.
2. Channel → Series → Episode dapat dinavigasikan serta di-deep-link melalui URL.
3. Channel page tidak memuat seluruh episode production UI; Series page tidak memuat detail strategy yang panjang.
4. Episode hanya menampilkan satu stage aktif; stage rail merefleksikan status/prerequisite secara konsisten.
5. Pilih episode/stage tidak membuat request generation.
6. Existing workflow Research → Blueprint → Script → Profile → Production Plan → Assets → Preview/Render tetap dapat dipakai.
7. Production Queue/Publishing tidak memalsukan data atau action yang belum tersedia; Analytics jelas placeholder.
8. Tidak ada literal warna atau inline visual styles pada YouTube Studio files yang diubah.
9. UI usable pada 360px, 736px, dan desktop; keyboard/focus serta screen reader semantics diperiksa.
10. Focused test dan `npm run build` lulus.

## Deployment: Dev Only

Deployment yang diizinkan hanya:

```bash
npm run deploy:macmini-dev
```

Verifikasi target:

- `http://100.95.245.55:5020/youtube-studio`
- satu deep-link episode Dev aktual
- `http://100.95.245.55:7020` untuk API health/relevant smoke

**Dilarang** deploy staging atau production, termasuk `deploy:staging`, `deploy:macmini-staging`, `deploy:macmini-prod`, `deploy:production`, `deploy:node1`, atau command target non-Dev lainnya.

Jangan melakukan polling SSH berulang selama remote build. Ikuti SOP Mac Mini dari `AGENTS.md`.

## Release Setelah Seluruh Verifikasi Berhasil

```bash
npm run release-non-interactive -- --type patch --title "YouTube Studio Workspace Architecture" --points "Restructure YouTube Studio around channels series and episodes|Add focused episode workspace and production hubs|Align UI with semantic MAKNA Flow theme"
```

Release/push tidak memberi izin deploy staging ataupun production.

## Laporan Akhir Wajib

Laporkan secara ringkas:

- View dan stage workspace yang selesai serta status capability yang sengaja masih `Coming next`.
- File yang berubah dan alasan architectural split-nya.
- Bukti cleanup CSS semantic/no inline visual styles.
- Hasil test, build, responsive/accessibility smoke, dan bukti tidak ada automatic generation.
- Bukti deployment Dev: command, URL, dan hasil.
- Version release, commit, tag, dan push.
- Risiko/pekerjaan yang tersisa.
