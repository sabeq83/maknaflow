# Instruksi Antigravity — Perbaiki Hermes Run-Once

Implementasikan seluruh rencana berikut:

`plans/hermes-integration/run-once-implementation-plan.md`

## Objective

Buat jalur resmi dan cepat untuk instruksi Hermes “buat satu kali campaign, riset, buat N video, manual review, draft_only, jalankan sekarang”. Endpoint create harus mengembalikan durable `run_id` dalam target maksimal dua detik, sementara riset dan produksi berjalan di background.

## Root Cause yang Harus Diperbaiki

- Operator API hanya dapat membuat schedule, belum mempunyai run-once enqueue.
- Session `run-now` membuat Operator Job langsung dan melewati research-first path.
- Skill tidak mempunyai prosedur fail-fast, sehingga Hermes membaca `.env`, source code, implementation plan, PM2, dan mencoba port 7020.
- Status background belum tersedia melalui satu endpoint bounded.

Jangan menutupi masalah dengan prompt tambahan saja. Perbaiki API, lifecycle, worker, status, dan skill sebagai satu alur end-to-end.

## Non-Negotiable Rules

1. Baca `AGENTS.md` dan dokumentasi Next.js lokal yang relevan sebelum mengubah route.
2. Gunakan `## Execution Task List` pada implementation plan; update checkbox real-time.
3. Jika audit menemukan file tambahan, tambahkan Before/After snippet ke plan sebelum mengedit file itu.
4. MAKNA adalah system of record dan schedule authority.
5. `run_once` harus non-recurring dan durable.
6. Create endpoint tidak boleh menjalankan research/AI/produksi/Repliz inline.
7. Same idempotency key + same body harus mengembalikan run yang sama; different body harus 409.
8. Semua query dan status tenant-scoped.
9. Research-enabled run harus membuat Agent Run sebelum Operator Job.
10. `draft_only` wajib menghasilkan nol publishing intent, nol publishing job, dan nol Repliz call.
11. Hermes dilarang membaca `.env`, filesystem MAKNA, source code, DB, PM2, process list, atau mencoba port selain base URL yang dikonfigurasi.
12. Base URL Dev yang benar untuk Next Operator API adalah `http://127.0.0.1:5020`, bukan 7020.
13. Hermes harus berhenti maksimal 30 detik bila create API tidak berhasil dan tidak memperoleh `run_id`.
14. Jangan deploy Staging atau Production. Jangan mengaktifkan auto-publish.
15. Jangan menampilkan atau commit secret.

## Required Sequence

1. Audit data flow dan DB constraints aktual.
2. Bekukan schema, contract, states, mapping, latency budget, dan error codes.
3. Tambahkan migration idempotent.
4. Implement contract dan atomic enqueue.
5. Perbaiki worker claim/lifecycle run-once.
6. Implement catalog terfilter, create, dan status Operator routes.
7. Refactor session run-now ke shared background service.
8. Update skill Hermes dan API reference; tambahkan larangan discovery yang eksplisit.
9. Tambahkan test contract, authorization, concurrency, background boundary, dan regression.
10. Jalankan test/build.
11. Deploy hanya Dev dengan feature flag off.
12. Verifikasi disabled, unauthorized, wrong scope, and idempotency.
13. Konfigurasi dan health-check Hermes Runs API serta signed callbacks tanpa membocorkan secret.
14. Enable Dev pilot dan jalankan tepat satu smoke `draft_only` untuk:
    - Brand: `dapurbotani`
    - Product: `Rolled Oat Premium Sahabat`
    - Preset: `dapurbotani_kampanye_produk_4_klip`
    - Video count: `6`
    - Review: `start_frames`
15. Jangan menyetujui start frame pada smoke tanpa instruksi pengguna; cukup buktikan run berhenti di manual review.
16. Pastikan tidak ada publishing intent/job/Repliz call.
17. Jalankan SOP release patch dan verifikasi branch/tag/worktree.

## Acceptance Evidence

Antigravity harus menyerahkan bukti:

- create response time dan HTTP 202;
- `run_id`, `agent_run_id`, status URL, dan review URL aman;
- satu request/retry/concurrency menghasilkan satu run;
- event sequence `queued → research → planning → start_frames → awaiting_manual_review`;
- planner requested item count sama dengan N;
- Operator Job baru ada setelah research callback tervalidasi;
- jumlah publishing intent/job sebelum dan sesudah smoke tetap nol;
- Hermes skill tidak memuat referensi `.env`, route discovery, PM2, DB, atau port 7020;
- test/build output;
- release version/commit/tag;
- konfirmasi Production dan auto-publish tidak disentuh.

## Required Failure Behavior

Jika API/capability belum siap, Hermes harus menjawab singkat seperti:

```text
Campaign belum dibuat.
Code: RUN_ONCE_UNAVAILABLE
MAKNA tidak mengembalikan run_id dalam batas waktu. Tidak ada retry alternatif atau perubahan sistem yang dilakukan.
```

Jika lineage, research callback, atau worker readiness tidak dapat dibuktikan, berhenti sebelum smoke. Laporkan bukti teknisnya; jangan membuat workaround berbasis filesystem, direct DB, atau direct Repliz.
