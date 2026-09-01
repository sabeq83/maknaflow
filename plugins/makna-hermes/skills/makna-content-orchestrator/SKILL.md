---
name: makna-content-orchestrator
description: Orchestrate MAKNA research, video, review, and posting.
version: 1.1.0
author: Sabeq M. Mursyid, Hermes Agent
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [makna, research, video, scheduling, publishing, run-once]
    related_skills: [hermes-agent, plan]
---

# MAKNA Content Orchestrator

Jadikan MAKNA Flow sebagai pemilik jadwal, produksi, approval, dan publishing. Gunakan hanya Operator API resmi. Jangan membuat cron Hermes kedua, memanggil Repliz, membuka database, memakai session browser, atau membaca secret.

## When to Use

- Gunakan untuk perintah membuat video produk/brand dengan preset MAKNA (baik one-time execution maupun recurring automation).
- Gunakan untuk riset dan produksi yang berjalan di background.
- Gunakan untuk manual review atau persiapan posting sosial.
- Jangan gunakan untuk mengubah feature flag, credential, atau database.

## Prerequisites & Endpoint Authority

- `MAKNA_OPERATOR_BASE_URL` berasal dari environment. Di Dev, URL resmi Next.js Operator API adalah `http://127.0.0.1:5020` (bukan port 7020).
- `MAKNA_OPERATOR_API_TOKEN` tersedia di environment dan memiliki scope minimum yang diperlukan untuk operasi yang dijalankan:
  - **Untuk alur katalog, run-once, dan automasi**: Cukup `automation:read` dan `automation:write`.
  - **Untuk alur publish approved campaign**: Memerlukan tambahan `publishing:read` dan `publishing:plan`.
- Skill dianggap belum siap jika `GET /api/operator/v2/whoami` gagal atau scope tidak mencukupi untuk alur yang diminta.

## Strict Fail-Fast & Safety Prohibitions

1. **Dilarang Keras Discovery Ilegal**: Hermes dilarang membaca file `.env`, source code MAKNA, database, PM2, process list, atau mencoba port alternatif selain base URL yang dikonfigurasi.
2. **Batas Waktu Create (Max 30 Detik)**: Total waktu eksekusi create endpoint maksimal 30 detik. Maksimal satu kali retry untuk network timeout / 502 / 503 / 504 dengan `Idempotency-Key` yang sama.
3. **No Phantom Confirmation**: Jangan pernah menyatakan campaign dibuat sebelum menerima `run_id` resmi dari server (HTTP 202).
4. **Failure Behavior**: Jika API gagal atau run ID tidak diperoleh dalam 30 detik, hentikan eksekusi dan berikan pesan kegagalan singkat tanpa melakukan retry manipulatif atau discovery alternatif:
   ```text
   Campaign belum dibuat.
   Code: RUN_ONCE_UNAVAILABLE
   MAKNA tidak mengembalikan run_id dalam batas waktu. Tidak ada retry alternatif atau perubahan sistem yang dilakukan.
   ```

## Jalankan Alur Run-Once (One-Time Campaign)

1. **Resolve Katalog**: Panggil `GET /api/operator/v2/content-catalog?brand=<brand>&product=<product>&preset=<preset>`.
   - Jika nol atau lebih dari satu hasil, tampilkan pilihan singkat dan minta pengguna memilih. Jangan menebak identifier.
2. **Konfirmasi**: Tampilkan ringkasan (Brand, Produk, Preset, Jumlah Video, Review Checkpoint, Mode Publishing) dan minta satu konfirmasi eksplisit.
3. **Durable Enqueue**: Panggil `POST /api/operator/v2/content-runs` dengan `Idempotency-Key` stabil (`hermes:<conversation_id>:<request_id>`).
   - Server mengembalikan HTTP 202 `< 2 detik` dengan `run_id`, `status_url`, dan `review_url`.
4. **Background Monitoring**: Jangan lakukan chat blocking panjang. Laporkan `run_id` dan bahwa proses berjalan di background. Jika pengguna meminta status, panggil `GET /api/operator/v2/content-runs/{id}` secara bounded (interval 30–60 detik, max 5 poll).
5. **Review Checkpoint**: Bila status mencapai `awaiting_manual_review`, berikan link review MAKNA UI (`/content-automations?run=<run_id>`).

## Batas Penting

- Jumlah video Product Campaign yang valid: `6`, `12`, `18`, `24`, atau `30`.
- Timezone default: `Asia/Jakarta`.
- `manual review` tidak berarti langsung posting. Review start-frame dan approval publikasi adalah dua checkpoint berbeda.
- Mode `draft_only` dijamin menghasilkan nol publishing intent, nol publishing job, dan nol panggilan ke Repliz.
- Jangan pernah menampilkan bearer token, callback token, header autentikasi, atau raw error yang memuat secret.

Untuk endpoint, body JSON, dan contoh lengkap, baca [references/operator-api.md](references/operator-api.md).
