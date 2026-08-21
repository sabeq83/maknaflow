# Instruksi Agent AI Antigravity — Implementasi YouTube Studio MVP

## Mandat

Implementasikan **YouTube Studio MVP** MAKNA Flow berdasarkan dokumen berikut:

- `sot/menus/youtube-studio-implementation-plan.md` — rencana teknis utama dan checklist eksekusi.
- `sot/menus/youtube-studio-mvp.md` — batasan produk dan Definition of Done.
- `sot/menus/youtube-studio-roadmap.md` — konteks produk jangka panjang.

Target rilis pertama adalah workspace premium, multi-tenant, dan multi-channel untuk **faceless AI YouTube long-form 16:9**. Alur wajib yang harus tercapai: channel strategy → series/episode → blueprint/script approval → produksi dan render → YouTube private/unlisted draft → satu Shorts derivative yang terhubung ke episode asal.

Jangan memperluas scope ke analytics mendalam, monetization dashboard lengkap, public publish/scheduling, auto-dubbing massal, atau editor timeline manual penuh.

## Sumber Kebenaran dan Bacaan Wajib

1. Baca `AGENTS.md` repository secara penuh sebelum melakukan tindakan apa pun.
2. Baca `sot/menus/youtube-studio-implementation-plan.md` secara penuh.
3. Baca `sot/menus/youtube-studio-mvp.md` secara penuh.
4. Periksa `git status` dan lindungi perubahan existing milik pengguna/agent lain.
5. Sebelum mengubah kode Next.js, baca dokumentasi yang relevan di `node_modules/next/dist/docs/`, khususnya Route Handlers, Dynamic Routes, Client Components, Linking/Navigation, dan data fetching yang sesuai dengan implementasi aktual.
6. Inspeksi kode aktual sebelum menerapkan snippet di plan. Snippet merupakan arah desain, bukan patch literal.
7. Audit read-only terhadap schema PostgreSQL staging serta mekanisme worker/scheduler dan Google OAuth yang sudah ada sebelum memilih desain detail queue, render, storage, atau credential binding.

## Hasil yang Wajib Dicapai

- Menu **YouTube Studio** tersedia bagi user/tenant dengan permission premium `youtube_studio`.
- Tenant dapat mengelola beberapa channel; data dan artefak tidak boleh bocor antar-tenant.
- Channel Strategy menyimpan locale, audience, positioning, cadence, revenue objective, serta referensi Universe dan Visual Identity.
- User dapat membuat series, backlog episode, blueprint, dan versi script multilingual.
- Produksi tidak dapat dimulai tanpa script yang berstatus approved.
- Episode faceless AI dapat menghasilkan preview dan render final 16:9 melalui MAKNA Flow.
- Output final memiliki video, subtitle, manifest scene/aset, log job, dan snapshot konteks kreatif.
- User dapat membuat publishing package dan mengunggah final video sebagai draft `private` atau `unlisted` ke YouTube.
- Satu episode dapat menghasilkan minimal satu Shorts derivative yang dapat ditelusuri ke parent episode.
- Semua job mahal aman terhadap duplikasi, memiliki status/progress/error yang jelas, dan memiliki quota/cost guardrail.

## Aturan Implementasi

### Multi-tenant, RBAC, dan Premium Access

- Tambahkan `youtube_studio` ke registry permission pusat, Sidebar, serta tenant disabled-menu behavior yang telah ada.
- Semua API route wajib menggunakan boundary auth/tenant yang sudah dipakai aplikasi, misalnya `withTenantContext` jika sesuai pola aktual.
- Jangan menerima `tenant_id` dari payload browser sebagai sumber otoritas.
- Seluruh repository query, mutasi, job claim, artifact lookup, dan upload credential lookup wajib tenant-scoped.
- Kontrol UI membantu usability, tetapi API adalah enforcement utama.
- Pastikan user tanpa permission tidak dapat mengakses route UI maupun endpoint API.

### Database dan Domain Contract

- Gunakan migration PostgreSQL yang idempotent dan advisory lock mengikuti pola `lib/db-pg.js`.
- Terapkan tabel/model yang tercantum dalam implementation plan: channel, strategy, series, episode, blueprint, script version, production package, render job, publishing package, dan Shorts derivative.
- Gunakan relational field untuk kebutuhan query/index dan JSONB hanya untuk payload kreatif/provider yang variatif.
- Tambahkan foreign key, tenant-aware indexes, unique version constraints, check constraints status, serta unique idempotency key per tenant.
- Jangan menghapus atau memigrasi data lama secara destruktif.
- Definisikan dan gunakan satu state-machine contract. Tidak boleh ada endpoint yang melompati state secara ilegal.
- Simpan snapshot Strategy, Universe, Visual Identity, script approved, prompt/provider config yang relevan ketika produksi dimulai.

### Multilingual

- Gunakan BCP 47 locale (contoh `id-ID`, `en-US`); jangan membatasi schema pada enum Bahasa Indonesia/Inggris.
- Channel menjadi default locale. Override hanya bila kontrak produk mengizinkan dan harus tercatat pada episode/script/publishing package.
- Prompt script wajib meminta tulisan natural sesuai locale; jangan memakai translasi literal dari output Indonesia.
- Voice, subtitle, metadata, dan chapter memakai locale yang konsisten dengan episode.

### Script, Approval, dan Production

- Blueprint minimal memuat hook, chapters, estimasi durasi, retention moments, CTA, dan next-video bridge.
- Script bersifat versioned; hanya snapshot approved yang boleh masuk ke produksi.
- Job produksi harus durable, idempotent, observable, dan dapat di-retry secara granular.
- Jangan menjalankan generation/render panjang di request lifecycle Next.js. Endpoint hanya validasi dan enqueue job.
- Persist state/artifact setelah setiap tahap: scene plan, asset generation, voice, subtitle, timeline, preview, dan final render.
- Gunakan provider adapter agar domain YouTube Studio tidak terkunci pada vendor tertentu.
- Quota/cost guardrail wajib dicek sebelum memanggil provider berbayar.
- Regenerate scene hanya boleh memperbarui scene yang diminta dan harus memicu assembly/render yang benar; jangan menghapus histori output lama.

### Render dan Asset

- Target MVP adalah MP4 landscape 16:9 plus subtitle asset.
- Catat asal/provider, timestamp, dan manifest untuk setiap asset yang dipakai.
- Jangan mengirim filesystem path internal atau secret provider pada response list/API/UI.
- Storage/artifact access harus mengikuti tenant authorization.
- Kegagalan render tidak boleh menghapus approved script, preview sebelumnya, atau publishing package yang sudah ada.

### YouTube Publishing

- Gunakan OAuth/token handling yang sudah ada sebagai basis hanya setelah diverifikasi kompatibel dengan binding tenant/channel.
- Jangan pernah mengekspos access token atau refresh token ke browser, API response, log biasa, Markdown, atau fixture.
- MVP hanya boleh upload sebagai `private` atau `unlisted`; jangan menambahkan public publish atau scheduling.
- Wajib ada pre-publish checklist dan approval sebelum upload.
- Simpan YouTube video ID, YouTube Studio URL, status upload, dan error yang actionable.
- Upload gagal tidak boleh merusak video final atau metadata package.

### Shorts Bridge

- Derivative wajib menyimpan parent `tenant → channel → series → episode`, time range, status, dan referensi workflow short-form.
- Gunakan engine short-form MAKNA Flow yang telah ada; jangan membangun generator Shorts kedua.
- Metadata derivative harus menyediakan CTA yang dapat diedit menuju episode penuh.

### Scope Discipline

- Jangan mengubah prompt/worker short-form yang tidak diperlukan untuk bridge.
- Jangan melakukan refactor besar pada campaign processor, OAuth, auth, atau database di luar kebutuhan YouTube Studio.
- Jangan menambah dependency/provider baru sebelum technical spike mendokumentasikan alasan, biaya, retry profile, security posture, dan dampaknya ke deployment.
- Jangan commit API key, token OAuth, secret provider, file media besar, database dump, atau artifact render.
- Jangan deployment production. Staging hanya setelah semua test dan acceptance lulus.
- Jangan overwrite perubahan milik pengguna atau agent lain di worktree yang kotor.

## Tata Cara Eksekusi

1. Buat catatan hasil technical spike untuk queue/worker, provider adapters, storage, render, dan OAuth channel binding.
2. Bila keputusan spike mengubah desain inti implementation plan, update plan terlebih dahulu dengan alasan dan before/after snippet file yang terdampak.
3. Implementasikan RBAC/sidebar dan database migration terlebih dahulu.
4. Implementasikan domain contract serta tenant-scoped repository layer.
5. Implementasikan API dan UI dasar Channel Strategy, Series, Episode, dan Overview.
6. Implementasikan blueprint/script generation, versioning, dan approval gate.
7. Implementasikan snapshot resolver Universe/Visual Identity ketika produksi dimulai.
8. Implementasikan durable production orchestrator, adapters, artifact manifest, preview, subtitle, dan final render.
9. Implementasikan publishing package, pre-publish approval, OAuth binding, serta private/unlisted upload.
10. Implementasikan Shorts derivative bridge.
11. Tambahkan dan jalankan test setiap layer sebelum lanjut ke tahap berikutnya.
12. Jalankan end-to-end acceptance di staging memakai test YouTube channel dan upload `private`/`unlisted`.
13. Jalankan release SOP hanya setelah semua verifikasi berhasil.

## Kontrol Progress Wajib

Setelah setiap task benar-benar selesai dan diverifikasi, segera ubah checkbox terkait pada `sot/menus/youtube-studio-implementation-plan.md`, bagian `## 4. Execution Task List`:

```md
- [ ] Tahap
```

menjadi:

```md
- [x] Tahap
```

Jangan menandai task selesai hanya karena kode sudah ditulis; task harus memiliki bukti test atau smoke verification yang relevan.

Jika implementasi membutuhkan file tambahan atau perubahan substansial pada file yang belum ada di plan, tambahkan entri baru di bagian `## 5. Planned File Changes` **sebelum** mengedit file tersebut. Setiap entri baru wajib memuat:

- path file;
- alasan perubahan;
- **Code Sebelum (Current/Before)**;
- **Code Sesudah (Proposed/After)**.

## Pemeriksaan Minimum

Wajib buktikan seluruh kondisi berikut:

1. User tanpa `youtube_studio` tidak dapat membuka UI atau API YouTube Studio.
2. Tenant A tidak dapat membaca, menulis, render, mengunggah, atau membuat derivative atas channel/episode Tenant B.
3. Satu tenant dapat membuat minimal dua channel dengan locale dan Visual Identity berbeda.
4. Episode baru mewarisi Channel Strategy yang benar, dan production snapshot tetap tidak berubah setelah strategy/preset diedit.
5. Script draft dapat dibuat dan diedit, tetapi job produksi ditolak sebelum script approved.
6. Request produksi ganda memakai job idempotent, bukan menghasilkan render duplikat.
7. Preview dan final render 16:9 beserta subtitle/artifact manifest tersedia pada happy path.
8. Provider failure menghasilkan error yang dapat dipahami dan retry aman tanpa merusak data/artifact sebelumnya.
9. Pre-publish package menolak upload bila checklist, final video, atau approval belum lengkap.
10. Upload sukses menghasilkan video `private`/`unlisted`, YouTube video ID, dan YouTube Studio URL.
11. Upload failure tidak menghapus render atau publishing package.
12. Shorts derivative menyimpan parent episode dan dapat diteruskan ke workflow short-form yang sudah ada.
13. Migration dapat dijalankan berulang tanpa kegagalan/schema drift.
14. Test, lint, build Next.js, dan smoke staging berhasil, atau kegagalan existing di luar scope dibuktikan secara terpisah.

## Penanganan Blocker

- Bila schema aktual berbeda dari plan, hentikan perubahan schema terkait, dokumentasikan perbedaannya, lalu update plan sebelum lanjut.
- Bila tidak ada worker/queue yang aman untuk render durasi panjang, jangan menyamarkan proses tersebut di request handler. Dokumentasikan blocker dan implementasikan hanya fondasi yang aman sampai keputusan runtime disetujui.
- Bila provider yang dibutuhkan belum tersedia, lakukan abstraction dan mock/integration test; jangan menggunakan credential pribadi atau provider tidak resmi.
- Bila OAuth yang ada tidak mendukung channel binding tenant dengan aman, jangan reuse token secara global. Dokumentasikan gap dan tambahkan desain credential binding sebelum upload diaktifkan.
- Bila test gagal karena regression existing di luar scope, pisahkan bukti kegagalan tersebut dari perubahan YouTube Studio.
- Bila deployment production diperlukan, berhenti dan minta perintah eksplisit pengguna.

## Release Wajib Setelah Verifikasi

Setelah semua acceptance test berhasil, jalankan SOP rilis repository:

```bash
npm run release-non-interactive -- --type minor --title "YouTube Studio MVP" --points "Tambah workspace YouTube Studio multi-channel premium|Tambah pipeline faceless AI long-form hingga render dan YouTube draft|Tambah bridge episode long-form ke Shorts"
```

Lalu verifikasi:

- versi dan changelog konsisten;
- commit release berhasil;
- tag `vX.Y.Z` tersedia di remote;
- branch `main` tersinkron ke `https://github.com/sabeq83/maknaflow.git`.

Jangan deploy ke production. Staging deployment hanya dilakukan bila memang dibutuhkan untuk acceptance test dan sesuai SOP deployment Mac Mini.

## Format Laporan Akhir

Laporkan ringkas namun evidence-based:

- Scope MVP yang selesai dan checkbox plan yang diperbarui.
- Technical spike decision: queue/worker, provider adapters, storage, render, dan OAuth binding.
- File utama dan migration yang ditambahkan/diubah.
- Hasil test, lint, build, serta acceptance staging.
- Bukti test private/unlisted upload dan Shorts derivative (tanpa membocorkan token/secret).
- Version release, commit, tag, dan status push.
- Risiko, capability yang sengaja ditunda, atau pekerjaan tersisa.

