# Instruksi Agent AI Antigravity — YouTube Studio Hybrid Production

## Mandat

Implementasikan pipeline hybrid berdasarkan `AGENTS.md` dan `sot/menus/youtube-studio-hybrid-production-implementation-plan.md`.

Workflow wajib:

```text
Prompt matrix approval → T2I start-frame review → approve frame batch
→ TTS review/approval → I2V/T2V visual generation → preview
```

## Aturan Wajib

- Audit dan reuse pola Pillar `hybrid_lock`, start-frame service/adapter/audit/checkpoint sebagai inspirasi/adapter saja; jangan coupling ke tabel atau ID Pillar Campaign.
- `t2i_i2v` wajib memiliki T2I dan I2V prompt + approved start frame; `t2v` wajib T2V prompt; static/broll tidak boleh dipaksa provider video.
- Prompt package approval terjadi sebelum generation apa pun.
- TTS terjadi setelah start-frame batch approved; video visual setelah VO batch approved.
- Semua batch, shot, asset, provider task, approval, retry, and invalidation tenant-safe/idempotent/audited.
- Replacing/regenerating one frame hanya membatalkan I2V and assembly descendant-nya.
- Never use dummy audio/video as final artifact. Do not expose secrets, local paths, or provider internal payloads.
- One-column UI, semantic CSS Module, only MAKNA theme tokens; no inline/literal colors.
- Do not build publishing/analytics in this task.

## Urutan Eksekusi

1. Baca AGENTS/plan/Next docs dan audit Pillar hybrid code.
2. Implementasikan contract, migration, repository state/batches.
3. Implementasikan AI prompt matrix + prompt approval UI/API.
4. Implementasikan start-frame adapter/review/replace/approval.
5. Implementasikan VO generation/review/approval.
6. Implementasikan I2V/T2V gated jobs dan preview integration.
7. Test mocks, build, small chapter Dev-only smoke.
8. Update checklist dengan bukti lalu release SOP.

## Kontrol Progress

Update checklist `## 4. Execution Task List` di plan hanya setelah verifikasi. Tambahkan before/after entry ke plan sebelum mengedit file unplanned.

## Acceptance Minimum

1. Mode/prompt matrix tervalidasi server-side.
2. Tidak ada generation sebelum gate approval yang relevan.
3. Start frame, VO, I2V/T2V mengikuti batch state dan dependency.
4. Selective replacement tidak mengulang seluruh episode.
5. Tenant isolation/idempotency/retry/error evidence tersedia.
6. UI/CSS/build/tests/Dev smoke lulus.

## Deployment: Mac Mini Dev Only

Hanya `npm run deploy:macmini-dev`, verifikasi pada 5020/7020, tanpa staging/production atau polling SSH loop.

## Release

Jalankan command release pada plan setelah seluruh verification lulus. Laporan akhir harus mencantumkan adapter decisions, approval evidence, tests/build/Dev smoke, release/tag/push, dan pekerjaan yang ditunda ke Publishing Studio.

