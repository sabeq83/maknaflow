# Instruksi Agent AI Antigravity — YouTube Studio Fase 3: Production Factory

## Mandat

Implementasikan Production Factory berdasarkan:

1. `AGENTS.md`
2. `sot/menus/youtube-studio-production-factory-implementation-plan.md`
3. Fase 2.5 duration/generation profile plan dan implementasi aktual.

Workflow wajib:

```text
Script Approved + Generation Profile
→ AI Production Plan
→ user approve plan
→ per-shot visual + VO generation
→ preview assembly
→ selected-shot revision
→ explicit final render
→ Ready to Publish
```

Jangan membangun Publishing Studio, YouTube upload, Shorts, analytics, atau monetization pada tugas ini.

## Audit Wajib Sebelum Coding

1. Baca `AGENTS.md` dan production plan ini sepenuhnya.
2. Baca dokumentasi Next.js lokal untuk Route Handlers, dynamic routes, Client Components, dan CSS Modules.
3. Audit `lib/youtube-studio-production-worker.js`, render adapter, scheduler, G-Labs integration/processors, TTS service, storage paths, and existing provider job patterns.
4. Audit Fase 2.5 generation profile registry/validators. Jangan menduplikasi capability model di UI atau prompt.
5. Periksa `git status`; jangan overwrite perubahan user/agent lain.

## Aturan Domain dan Safety

- Hanya episode `Script Approved` dengan generation profile valid dapat membuat Production Plan.
- Production Plan harus disetujui user sebelum provider berbayar dipanggil.
- Narrative scene duration tidak sama dengan generated visual shot duration.
- Generated visual shot mengikuti server-side capability profile: Omni Flash 4/6/8/10s; Veo 3.1 Lite 8s. Non-generated asset tidak dipaksa mengikuti batas ini.
- Gunakan provider-neutral adapter untuk merutekan profile ke G-Labs/Google Flow; jangan panggil provider dari API route.
- Setiap asset/VO/assembly/final action harus durable, tenant-scoped, idempotent, observable, quota/cost guarded, and retry-safe.
- Simpan prompt/context/profile/provider task ID/output/provenance/cost/error per asset.
- Dilarang menjadikan placeholder video atau dummy audio sebagai output final. Mock hanya di test.
- Final render hanya tersedia setelah preview berhasil dan disetujui user.
- Regenerate satu shot hanya membatalkan preview/final dependent; jangan regenerate seluruh episode atau menghapus histori.

## Database, Queue, dan Security

- Gunakan migration PostgreSQL idempotent/advisory lock; jangan hapus legacy render/job data.
- Pisahkan package, asset, dan job records; jangan membuat satu job monolitik untuk seluruh video.
- Use server-generated idempotency keys and job state transitions.
- Claim/lease job menggunakan pola scheduler yang aman dari double processing.
- Jangan kirim local filesystem path, provider secret, OAuth token, atau internal route detail ke UI/API.
- Semua route menggunakan tenant/auth/permission enforcement `youtube_studio`; client tidak menjadi sumber tenant/profile/cost/job authority.

## UI dan CSS

- Pertahankan satu-column YouTube Studio workflow.
- Tambahkan Production Plan, Asset Progress, Preview Review sebagai step eksplisit setelah Generation Profile.
- Tampilkan prerequisite, progress, failure, retry, approval, and cost/quota blocking states secara jelas.
- Gunakan CSS Module dengan class semantik dan hanya token `app/theme.css`.
- Dilarang inline style, hex/RGB/RGBA/color literal, atau hard-coded visual design values dalam `app/youtube-studio/**`.
- Preview player harus memiliki fallback/error state dan tetap tenant-authorized.

## Urutan Eksekusi

1. Dokumentasikan hasil audit provider/queue/storage/TTS and update plan bila perlu.
2. Implementasikan contract/state/schema/repository production package-assets-jobs.
3. Implementasikan AI Production Plan dan approval UI/API.
4. Implementasikan adapters and granular worker jobs with mocked tests first.
5. Implementasikan asset progress, preview assembly, selective revision, final render.
6. Retire placeholder/dummy production path hanya setelah real Dev smoke test sukses.
7. Jalankan full test/build and Dev-only smoke.
8. Update checklist plan with evidence.
9. Release sesuai SOP setelah semua acceptance criteria lulus.

## Kontrol Progress

Update checkbox dalam `## 6. Execution Task List` di `sot/menus/youtube-studio-production-factory-implementation-plan.md` dari `- [ ]` menjadi `- [x]` hanya setelah task diverifikasi.

Jika file tambahan diperlukan, masukkan dulu ke `## 7. Planned File Changes` dengan alasan dan Code Sebelum/Code Sesudah sebelum edit.

## Acceptance Minimum

1. Production Plan hanya dari Script Approved + valid profile.
2. Plan generated-shot valid terhadap generation profile dan dapat di-review/edit/approve.
3. Tidak ada provider call sebelum Production Plan approval.
4. Asset/VO job tenant-safe, idempotent, retry/cost guarded, serta tercatat.
5. Real adapter path menghasilkan artifact preview tanpa placeholder/dummy final output.
6. Preview approval wajib sebelum final render.
7. Selective regeneration hanya menginvalidasi artifact turunan yang perlu.
8. Build, mock tests, and Dev-only live smoke pass.

## Deployment: Mac Mini Dev Only

Hanya jalankan:

```bash
npm run deploy:macmini-dev
```

Verifikasi hanya pada:

- `http://100.95.245.55:5020/youtube-studio`
- `http://100.95.245.55:7020`

Jangan gunakan staging/production command. Jangan polling SSH loop saat remote build; ikuti SOP Mac Mini di `AGENTS.md`.

## Release Setelah Verifikasi

```bash
npm run release-non-interactive -- --type minor --title "YouTube Studio Production Factory" --points "Tambah production plan AI berbasis profile Google Flow|Tambah asset dan VO jobs tenant-safe dengan preview render|Tambah selective shot revision dan final render workflow"
```

Release/push tidak mengizinkan deploy staging/production.

## Laporan Akhir

Laporkan checklist/bukti, keputusan adapter/provider/queue, migration dan file utama, test/build/Dev smoke, artifact preview/final test tanpa secret, release/commit/tag/push, dan batasan yang dialihkan ke Publishing Studio Fase 4.

