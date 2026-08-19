# Prompt untuk Agent AI Antigravity — Implementasi Repliz Publishing

Anda bekerja pada repository MAKNA Flow di `/Users/sabeqmmursyid/_maknaflow-staging`.

## Misi

Implementasikan integrasi Repliz sebagai provider publishing dari menu Content Flow untuk Facebook, Instagram, TikTok, YouTube, Threads, dan LinkedIn. Pertahankan provider Meta yang sudah ada. Ikuti rencana authoritative berikut:

`/Users/sabeqmmursyid/_maknaflow-staging/plans/repliz/implementation_plan.md`

Baca seluruh rencana sebelum mengubah kode. Kerjakan sampai implementasi dan verifikasi staging selesai, tetapi jangan deploy production.

## Instruksi Wajib

1. Baca dan patuhi `/Users/sabeqmmursyid/_maknaflow-staging/AGENTS.md`.
2. Sebelum menulis kode Next.js, baca panduan relevan di `node_modules/next/dist/docs/`; versi proyek ini memiliki breaking changes.
3. Periksa `git status` lebih dahulu. Pertahankan semua perubahan pengguna yang tidak terkait.
4. Perbarui `## Execution Task List` pada implementation plan secara real-time: ubah task menjadi `[x]` segera setelah benar-benar selesai.
5. Jangan meminta atau menaruh credential di source code. Gunakan settings server-side, masking secret, dan sanitasi log.
6. Jangan mengubah arsitektur Single-Pass Strategic Campaign Engine.
7. Jangan menghapus publisher Meta lama.
8. Jangan deploy production tanpa instruksi eksplisit pengguna.

## API Repliz

Base URL default: `https://api.repliz.com`

Authentication:

```text
Authorization: Basic base64(accessKey:secretKey)
```

Endpoint utama:

- `GET /public/account?page=1&limit=100`
- `POST /public/schedule`
- `GET /public/schedule/{scheduleId}`
- `PUT /public/schedule/{scheduleId}/retry`
- `DELETE /public/schedule/{scheduleId}`

Jangan berasumsi nama status detail. Verifikasi respons aktual secara aman dan buat mapper yang toleran terhadap status tak dikenal (`needs_review`).

## Arsitektur Target

- `publishing_jobs` tetap menjadi source of truth workflow MAKNA.
- Tambahkan provider discriminator `meta|repliz` pada akun dan job.
- Satu akun target = satu job = satu `scheduleId` Repliz.
- Worker merutekan job berdasarkan provider.
- Repliz menerima URL media HTTPS publik.
- Simpan external schedule ID segera setelah create sukses.
- Cegah duplikasi pada retry atau timeout ambigu.
- Sinkronkan hasil akhir ke status platform pada `content_flow_items`.

## Contoh Mapping Payload Video

```js
{
  title: contentTitle || '',
  description: caption,
  topic: '',
  type: 'video',
  medias: [{
    alt: '',
    customThumbnail: false,
    type: 'video',
    thumbnail: thumbnailUrl || '',
    url: mediaUrl
  }],
  additionalInfo: {
    isAiGenerated: true,
    isDraft: publishMode === 'draft'
  },
  accountId: providerAccountId,
  scheduleAt: scheduledAtIso
}
```

## Urutan Eksekusi

1. Audit kode existing dan dokumentasi Next.js.
2. Implementasikan serta test `repliz-client` terlebih dahulu.
3. Implementasikan settings dan test connection.
4. Buat migrasi idempotent.
5. Perluas repository dan sinkronisasi akun.
6. Perluas validation/preflight.
7. Implementasikan worker create/reconcile serta cancel/retry.
8. Perbarui Publishing Scheduler UI.
9. Tambahkan test untuk mapping, sanitasi secret, status, retry, cancel, dan anti-duplikasi.
10. Jalankan test, lint/build, lalu smoke test staging.

## Definition of Done

- Kredensial aman dan test connection bekerja.
- Akun Repliz dapat disinkronkan dan dipilih dari Content Flow.
- Video/image dapat dijadwalkan ke seluruh platform yang didukung akun.
- Job menunjukkan provider, external schedule ID, status, dan error tersanitasi.
- Retry/cancel konsisten antara MAKNA dan Repliz.
- Timeout ambigu tidak membuat schedule ganda.
- Media nonpublik ditolak preflight.
- Provider Meta lama tidak mengalami regresi.
- Semua task plan ditandai sesuai kondisi sebenarnya.
- Semua tes dan build yang relevan lulus.

## Release

Sesudah verifikasi berhasil, ikuti SOP release repository:

```bash
npm run release-non-interactive -- --type patch --title "Repliz Content Flow Publishing" --points "Integrasi akun dan scheduling Repliz|Sinkronisasi status, retry, dan cancel lintas platform|Preflight media dan perlindungan credential"
```

Verifikasi tag rilis dan branch `main` telah terunggah ke `https://github.com/sabeq83/maknaflow.git`. Jangan menjalankan deployment production.

## Laporan Akhir yang Diharapkan

Berikan ringkasan singkat berisi:

- file yang berubah;
- keputusan penting dan deviasi dari rencana;
- hasil test/build/smoke test;
- versi/tag/commit rilis;
- risiko atau pekerjaan lanjutan yang masih tersisa.
