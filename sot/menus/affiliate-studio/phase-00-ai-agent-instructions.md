# Instruksi AI Agent — Affiliate Studio Fase 0 Foundation

## Mandat

Implementasikan hanya Fase 0 berdasarkan:

1. `AGENTS.md`
2. `sot/menus/affiliate-studio-roadmap.md`
3. `sot/menus/affiliate-studio/phase-00-foundation-implementation-plan.md`

Tujuan fase ini adalah membuat contract, boundary, permission, tenant feature flag, access policy, metadata-only connector registry, capability API, audit event, dan tests.

Fase ini **bukan** implementasi UI Affiliate Studio dan **bukan** integrasi engine.

## Aturan Additive-Only

- Buat file baru di namespace Affiliate Studio sejauh mungkin.
- Satu-satunya file runtime existing yang direncanakan berubah adalah `lib/schema/user-schema.js`, berupa penambahan satu permission key.
- Jangan mengubah Sidebar atau membuat page `/affiliate-studio`; keduanya milik Fase 1.
- Jangan menambah kolom atau tabel database.
- Gunakan `tenant_settings` dan `tenant_audit_events` existing.
- Jangan mengubah `lib/auth.js`; susun `withTenantContext` melalui file access baru.
- Jangan mengimpor atau memanggil engine legacy.
- Jangan memperbaiki, merapikan, memindahkan, atau melakukan refactor code di luar scope.
- Jika build gagal karena masalah existing di luar scope, dokumentasikan bukti dan minta keputusan user; jangan memperluas scope diam-diam.

## Legacy Freeze Boundary

Dilarang mengubah:

```text
RE Campaign
Pillar Campaign / OPC
Recipe Labs
Multiplier Lab
Instant Campaign
Product Bridging
Deconstruct Lab
Content Planner
Product Database
ContentFlow
Publishing
YouTube Studio
prompts
schedulers
workers
campaign repositories
```

Gunakan daftar path lengkap pada bagian `Explicit No-Change List` di implementation plan sebagai gate sebelum commit.

## Urutan Eksekusi

1. Baca seluruh `AGENTS.md`, roadmap, implementation plan, dan panduan Next.js lokal yang relevan.
2. Audit working tree dan simpan daftar perubahan user yang sudah ada; jangan menyentuhnya.
3. Update task pertama pada `## 5. Execution Task List` hanya setelah audit selesai.
4. Tambahkan permission key secara minimal.
5. Implementasikan contract dan pure validators.
6. Implementasikan feature flag default-deny.
7. Implementasikan pure access evaluator lalu wrapper server-side.
8. Implementasikan metadata-only registry dan audit helper.
9. Implementasikan dua route handler foundation.
10. Tambahkan tests contract/access/registry/flag/boundary.
11. Jalankan focused tests, existing RBAC regression, `git diff --check`, dan build.
12. Audit diff terhadap Explicit No-Change List.
13. Update checklist secara real-time berdasarkan bukti.
14. Setelah seluruh gate lulus, jalankan release SOP dari plan dan verifikasi commit/tag/push.

## Kontrol Implementation Plan

- Checkbox di `## 5. Execution Task List` harus diperbarui segera setelah setiap task selesai dan diverifikasi.
- Jangan mencentang task berdasarkan asumsi.
- Sebelum mengedit file yang belum tercantum pada `## 6. Planned File Changes`, tambahkan entri file tersebut ke plan beserta **Code Sebelum** dan **Code Sesudah**.
- Bila kebutuhan file baru menandakan scope Fase 1+, hentikan dan jangan menambahkannya.

## Contract yang Tidak Boleh Diubah

Permission:

```text
affiliate_studio
```

Tenant setting:

```text
affiliate_studio_enabled
```

Engine vocabulary:

```text
re
pillar
recipe
multiplier
instant
product_bridge
deconstruct
```

Access modes:

```text
read
write
admin
```

Registry production Fase 0 harus kosong.

## Security Requirements

- Tenant ID selalu berasal dari authenticated server context.
- Tolak `tenantId='__none__'` untuk operasi feature flag.
- Missing flag berarti disabled.
- User permission tidak mengalahkan tenant-disabled menu.
- Feature flag tidak mengalahkan user permission.
- Mode `admin` hanya untuk role admin tenant.
- Feature flag PUT harus menerima boolean asli, bukan truthy coercion.
- Jangan menyimpan credential, cookies, token, atau headers pada audit event.
- Jangan mengembalikan stack trace atau internal filesystem path dari API.

## Verification Minimum

```bash
node --test tests/affiliate-studio-foundation.test.js tests/affiliate-studio-boundary.test.js
node scripts/test-auth-rbac.js
git diff --check
npm run build
```

Selain command tersebut, buktikan:

1. Flag missing → disabled.
2. Permission missing → forbidden.
3. Tenant disabled menu → forbidden.
4. Flag disabled → forbidden.
5. Admin mode untuk regular user → forbidden.
6. Registry kosong dan immutable dari sisi caller.
7. Forbidden legacy imports tidak ditemukan.
8. Tidak ada file Explicit No-Change List yang berubah.

## Deployment

Deployment bukan syarat default Fase 0 karena belum ada UI. Bila Dev API smoke diperlukan setelah build:

```bash
npm run deploy:macmini-dev
```

- Hanya Dev ports 5020/7020.
- Dilarang deploy Staging atau Production.
- Dilarang polling SSH loop; ikuti SOP timer dua menit saat remote build.

## Release

Jalankan command release pada implementation plan hanya setelah semua verification gate lulus. Pastikan version, changelog, commit, tag, branch, dan remote sync berhasil.

## Laporan Akhir Agent

Laporan akhir harus menyebutkan:

- contract dan gate yang ditambahkan;
- daftar file berubah;
- hasil focused tests, RBAC regression, diff check, dan build;
- konfirmasi Explicit No-Change List bersih;
- status feature flag default-deny;
- release version, commit, tag, dan push;
- blocker atau pekerjaan yang sengaja ditunda ke Fase 1.

