# Antigravity Agent Instructions — OPC ReGen Exclusive Reference Lane

## Mission

Implementasikan `plans/opc-regen-exclusive-lane/implementation_plan.md` sampai terverifikasi dan dirilis. Tujuan utama adalah memastikan manual ReGen Product Bridge tidak pernah overlap dengan T2I lain pada effective G-Labs image lane, termasuk lintas item dan lintas campaign yang memakai endpoint provider sama.

Jangan membatalkan perbaikan v2.29.13/v2.29.14: canonical Clean/Raw resolver, named reference object, `@tag`, product reference index 0, SHA guard, `nano_banana_2`, dan polling 4/5 detik wajib dipertahankan.

## Mandatory Reading

Sebelum mengedit:

1. baca `AGENTS.md` sepenuhnya;
2. baca `plans/opc-regen-exclusive-lane/implementation_plan.md` sepenuhnya;
3. baca `docs/WEBHOOK_INTEGRATION.en.md` sepenuhnya, khususnya concurrency, async lifecycle, image schema, named references, polling, tasks-in-memory, dan gotchas;
4. baca guide Next.js relevan di `node_modules/next/dist/docs/` sebelum mengubah route/page;
5. inspeksi `git status`; semua perubahan user yang tidak terkait wajib dipertahankan;
6. audit current initial, single ReGen, bulk ReGen, recovery, worker, and UI call paths sebelum menulis kode.

## Incident Facts That Must Become Tests

Dev campaign `opc_260902_lurhc1` menunjukkan:

```text
10:54:48 WIB item 217 clip 2 shared
10:54:49 WIB item 217 clip 3 exclusive
10:54:58 WIB item 216 clip 3 exclusive
10:55:00 WIB item 215 clip 3 exclusive
```

Initial dan ReGen mempunyai reference SHA, prompt SHA, dan request fingerprint sama. Karena itu jangan “memperbaiki” prompt/reference lagi tanpa bukti baru. Bug berada pada orchestration concurrency dan direct manual path.

## Hard Requirements

### A. Single ReGen must be durable

- Route manual hanya preflight + enqueue + `202`.
- Dilarang memanggil `generateImage`, `getTaskStatus`, `getFileUrl`, atau menulis output file dari route.
- Gunakan idempotency key.
- Duplicate active item+clip tidak boleh menciptakan task provider kedua.

### B. Provider-level lane

- Key berdasarkan effective webhook host+port+media type, di-hash dan tidak memuat API key.
- Product Bridge = exclusive.
- Non-product T2I = shared.
- Exclusive menunggu seluruh owner aktif selesai.
- Shared menunggu exclusive aktif dan exclusive waiter yang lebih tua.
- Lease bertahan sampai provider terminal; HTTP 202 bukan terminal.
- Heartbeat, expiry, and recovery wajib ada.
- Enforcement memakai PostgreSQL transaction/advisory lock; UI lock atau JavaScript in-memory mutex tidak diterima.
- Jangan menahan satu DB connection selama image generation.

### C. All OPC paths participate

Provider lane harus dipakai oleh:

- initial Pillar start-frame;
- single ReGen;
- bulk ReGen;
- durable worker retry;
- production recovery.

Jika satu jalur masih dapat memanggil G-Labs tanpa lane, task belum selesai.

### D. Immutable revisions

- Filename harus memuat item, clip, revision, dan provider task ID.
- Deteksi ekstensi dari response bytes/MIME.
- Jangan overwrite output initial atau revision lama.
- Aktivasi `t2i_images_json` harus transaction-safe.
- Late older result tidak boleh mengganti revision baru.

### E. Audit

Audit prepared dibuat sebelum submit dan dilanjutkan ke submitted/terminal. Simpan metadata aman:

```text
reference_name, reference_position, reference_sha256,
reference_mime_type, reference_byte_length,
requested_model, effective_model,
lane_key, lane_mode,
lane_wait_started_at, lane_acquired_at,
sibling_active_count_at_submit,
provider_task_id, lifecycle timestamps/status
```

Dilarang menyimpan/log base64, API key, credential, atau prompt plaintext.

### F. UI

- Multiple clicks across rows boleh queue.
- Disable hanya duplicate active item+clip.
- Tampilkan queued/waiting lane/provider processing/downloading/completed/failed.
- Jangan mempertahankan HTTP request selama provider generation.
- UI bukan concurrency enforcement boundary.

### G. Product pointer normalization

New writes:

```text
active_photo = clean_photo_url | raw_photo_url
```

Legacy invalid pointer dinormalisasi ke Clean jika ada, selain itu Raw. Buat dry-run script dan jangan apply Production tanpa perintah eksplisit user.

## Implementation Guardrails

1. Update `## Execution Task List` real-time setelah setiap tahap.
2. Gunakan `apply_patch` untuk edit manual.
3. Jangan menyentuh perubahan user yang tidak terkait.
4. Jangan memakai process-local mutex sebagai sumber kebenaran.
5. Jangan memakai `/api/health.tasks_running` sebagai lock; itu hanya telemetry.
6. Jangan fallback dari lane failure ke direct concurrent submit.
7. Jangan menghapus schema/file revision lama.
8. Pertahankan tenant context, brand webhook override, task routing, and safe logs.
9. Jangan mengubah Strategic Campaign Single-Pass architecture.
10. Jangan deploy Production tanpa instruksi eksplisit.
11. Jika deploy Dev/Staging diperlukan, patuhi remote-build SOP dan jangan polling SSH berulang.

## Required Test Matrix

Wajib ada test untuk:

1. three exclusive requests across different item IDs serialize;
2. shared request cannot overlap exclusive;
3. exclusive waits for existing shared owners;
4. older exclusive waiter prevents shared starvation;
5. two workers race for lane and only legal owners win;
6. lease heartbeat and expiry;
7. worker crash/restart recovery;
8. submit failure releases lease;
9. provider failed/timeout releases lease;
10. route performs zero direct provider calls;
11. duplicate idempotency key returns same asset;
12. duplicate active item+clip cannot double submit;
13. revision filenames are unique;
14. late result cannot activate over newer revision;
15. audit prepared exists even when submit fails;
16. audit never contains base64/secrets;
17. initial and recovery also acquire lane;
18. reference SHA/fingerprint parity remains intact;
19. active photo accepts only Clean/Raw;
20. legacy pointer dry-run normalization is correct.

Use a real PostgreSQL concurrency integration test where available. A mocked single-process unit test alone is not sufficient evidence for transaction isolation.

## Verification

Run the commands listed in the implementation plan, plus targeted repository tests discovered during implementation. Then perform a controlled Dev smoke:

1. use a non-production campaign with at least three Product Bridge rows;
2. trigger three Product Bridge ReGen requests rapidly plus one normal clip;
3. confirm all API responses are immediate `202`;
4. capture safe DB lifecycle timestamps;
5. prove overlap count is zero;
6. inspect all output images visually against canonical Clean photo;
7. prove previous revisions still exist;
8. do not mutate `opc_260902_lurhc1` unless user explicitly authorizes re-running it.

## Release

After all available verification succeeds:

```bash
npm run release-non-interactive -- --type patch --title "Isolasi ReGen Product Bridge" --points "Pindahkan ReGen start frame ke durable exclusive provider lane|Tambahkan revisioned output, lifecycle audit, dan concurrency regression coverage"
```

Verify changelog, version, commit, tag, `main`, and remote `https://github.com/sabeq83/maknaflow.git`. Do not deploy Production. Final report must separately state:

- implemented;
- unit verified;
- PostgreSQL concurrency verified;
- Dev provider smoke verified;
- visually verified;
- released and pushed;
- anything not verified and why.

