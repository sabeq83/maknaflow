# Instruksi AI Agent — Affiliate Studio Fase 1 Brand-First Application Shell

## Mandat

Implementasikan hanya Fase 1 berdasarkan:

1. `AGENTS.md`
2. `sot/menus/affiliate-studio-roadmap.md`
3. `sot/menus/affiliate-studio/phase-00-foundation-implementation-plan.md`
4. `sot/menus/affiliate-studio/phase-01-brand-shell-implementation-plan.md`

Target Fase 1 adalah shell `/affiliate-studio`, Brand Profile switcher, dan Brand Overview read-only. Jangan membuat Product Portfolio, Campaign Program, Planner connection, Production Queue, atau launch engine.

## Hard Prerequisite

Sebelum mengedit file:

- pastikan Fase 0 sudah diimplementasikan, semua test lulus, dirilis, ditag, dan dipush;
- pastikan `withAffiliateStudioAccess`, feature flag, permission, contract, dan registry tersedia;
- bandingkan implementasi aktual Fase 0 dengan plan.

Jika Fase 0 belum selesai, hentikan. Jangan mengimplementasikan ulang fondasinya di Fase 1.

## Aturan Additive-Only

- Buat seluruh runtime baru di namespace `app/affiliate-studio`, `app/api/v2/affiliate-studio`, dan `lib/affiliate-studio-*`.
- Satu-satunya file runtime legacy yang boleh disentuh adalah `app/components/Sidebar.js`, hanya untuk mapping dan nav item.
- Jangan mengubah tabel, migration, repository, API, UI, prompt, worker, scheduler, atau state machine legacy.
- Jangan mengubah file Fase 0 kecuali failing regression membuktikan bug; bila demikian hentikan dan minta keputusan user.
- Jangan melakukan cleanup/refactor opportunistic.
- Jangan memasukkan unrelated user changes ke release.

## Read-Only Boundary

Affiliate Studio Fase 1 boleh:

- membaca authorized Brand Profiles;
- menghitung projection Product, Planner, Campaign, dan ContentFlow;
- mengganti selected brand;
- refresh projection;
- membuka deep link modul legacy.

Affiliate Studio Fase 1 dilarang:

- create/edit/delete data;
- menjalankan campaign;
- retry/approve/publish;
- menulis normalized status;
- membuat tabel `affiliate_*`;
- mengubah affiliate resolver;
- menambahkan fake brand query ke halaman yang belum mendukungnya.

## Data-Truth Rules

- Tenant ID hanya dari authenticated server user.
- Regular user hanya `assignedBrandIds`.
- Unauthorized atau cross-tenant Brand ID → 404 tanpa enumeration leak.
- Product summary hanya dari `brand_products`.
- Planner memakai Brand ID dengan fallback nama dan harus distinct.
- Campaign coverage Fase 1 hanya RE, Pillar, dan Recipe serta wajib ditandai partial.
- ContentFlow memakai Brand ID; fallback nama hanya untuk row tanpa Brand ID.
- Source gagal → metric `null`, `partial=true`, warning code.
- Jangan menampilkan angka `0` bila source unavailable.
- Setiap overview memiliki `generatedAt`, sources, coverage, dan warnings.

## UX Rules

- Brand selection disimpan pada `?brand=<id>`, bukan localStorage.
- Page tetap Server Component; interactivity pada Workspace Client Component.
- Brand switcher menggunakan labelled native select.
- Overview adalah satu-satunya local navigation yang enabled.
- Area fase berikutnya tampil disabled/coming later, bukan route kosong.
- Gunakan CSS Module dan semantic theme tokens.
- Dilarang inline visual style, hex, RGB/RGBA, page-specific gradient, dan perubahan `app/theme.css`.
- Tidak boleh ada tombol create/edit/generate/run/retry/approve/publish/delete.

## Urutan Eksekusi

1. Verifikasi prerequisite dan release Fase 0.
2. Baca Next.js docs lokal, theme, existing Sidebar, brand authorization, Planner, campaign, dan ContentFlow schema.
3. Audit working tree dan catat perubahan user existing.
4. Update checkbox prerequisite setelah bukti lengkap.
5. Tambahkan Sidebar connection minimal.
6. Implementasikan pure workspace/deep-link helpers.
7. Implementasikan server-only read adapter dan truthful partial projections.
8. Implementasikan GET-only brand list dan overview routes.
9. Implementasikan page, Workspace, Shell, Overview, dan CSS Module.
10. Tambahkan unit, integration, authorization, and boundary tests.
11. Jalankan Fase 1 focused tests dan Fase 0 regressions.
12. Jalankan RBAC smoke, diff check, build, dan path audit.
13. Jika diperlukan, deploy Dev saja dan lakukan browser/API smoke.
14. Update checklist real-time.
15. Setelah seluruh gate lulus, jalankan release SOP dan verifikasi push.

## Kontrol Implementation Plan

- Ubah `- [ ]` menjadi `- [x]` segera setelah task selesai dan terverifikasi.
- Jangan mencentang berdasarkan asumsi atau keberhasilan parsial.
- Sebelum menyentuh file yang tidak tercantum pada `Planned File Changes`, tambahkan Before/After snippet ke plan.
- Jika file tersebut termasuk Explicit No-Change List, jangan edit; laporkan blocker.

## Verification Minimum

```bash
node --test tests/affiliate-studio-brand-shell.test.js tests/affiliate-studio-brand-projection.test.js tests/affiliate-studio-phase-01-boundary.test.js
node --test tests/affiliate-studio-foundation.test.js tests/affiliate-studio-boundary.test.js
node scripts/test-auth-rbac.js
git diff --check
npm run build
```

Buktikan juga:

1. Feature flag false menolak API.
2. Menu permission dan tenant-disabled behavior bekerja.
3. Admin tidak melihat tenant lain.
4. Regular user tidak melihat unassigned brand.
5. Cross-brand overview tidak membocorkan data.
6. URL selected brand stabil setelah refresh.
7. ContentFlow legacy fallback tidak mencampur Brand ID lain.
8. Partial source tidak menjadi fake zero.
9. Tidak ada write route/action.
10. Explicit No-Change List bersih.

## Dev Deployment

Deployment hanya bila dibutuhkan untuk smoke:

```bash
npm run deploy:macmini-dev
```

- UI port 5020, API port 7020.
- Dilarang deploy Staging atau Production.
- Dilarang polling SSH loop; gunakan SOP timer dua menit untuk remote build.

## Release

Jalankan command release dari implementation plan hanya setelah semua verification gate lulus. Pastikan version, changelog, commit, tag, `main`, dan remote sync berhasil tanpa membawa unrelated changes.

## Laporan Akhir Agent

Laporan akhir wajib mencakup:

- hasil prerequisite Fase 0;
- shell, brand selection, projection, dan deep-link yang ditambahkan;
- daftar file berubah;
- bukti assigned-brand dan tenant isolation;
- bukti partial projection truthfulness;
- hasil focused tests, Fase 0 regressions, RBAC smoke, diff check, dan build;
- konfirmasi Explicit No-Change List;
- hasil Dev smoke bila dijalankan;
- release version, commit, tag, dan push;
- pekerjaan yang sengaja ditunda ke Fase 2.

