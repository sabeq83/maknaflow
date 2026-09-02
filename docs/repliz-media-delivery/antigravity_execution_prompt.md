# Instruksi Eksekusi untuk Agen Antigravity

Implementasikan plan berikut secara penuh:

`docs/repliz-media-delivery/implementation_plan.md`

## Konteks Insiden

Publishing Facebook dan TikTok melalui Repliz gagal karena payload masih berisi URL Nextcloud `cloud.ast402.my.id`. Facebook melaporkan `403 Restricted by robots.txt`; TikTok melaporkan `internal`. Audit membuktikan file sumber dapat diambil dari Mac Mini melalui URL internal Nextcloud dengan HTTP 200. Token Google staging juga revoked, tetapi upload Drive tidak pernah dijalankan karena `repliz_drive_folder_id` tidak dikonfigurasi.

## Aturan Wajib

1. Baca `AGENTS.md` dan seluruh `implementation_plan.md` sebelum mengubah file.
2. Baca dokumentasi Next.js 16 yang relevan di `node_modules/next/dist/docs/`, khususnya Route Handlers, sebelum coding.
3. Jangan mengasumsikan API Next.js dari versi lama.
4. Jangan meneruskan raw URL Nextcloud ke Repliz dalam kondisi apa pun.
5. Media staging wajib fail-closed. Jika proxy/object delivery gagal, schedule Repliz tidak boleh dibuat.
6. Jangan deploy ke production. Scope hanya local dan staging.
7. Jangan melakukan retry/migrasi job gagal tanpa verifikasi smoke dan persetujuan operasional eksplisit.
8. Jangan menyimpan atau mencetak signing secret, token, URL bertanda tangan lengkap, maupun Nextcloud share token.
9. Gunakan `apply_patch` untuk perubahan file.
10. Pertahankan semua perubahan user yang tidak terkait.

## Decision Gate Cloudflare

Sebelum implementasi, laporkan provider yang dipilih. Cloudflare public-hostname Tunnel pada paket Free tidak boleh diasumsikan sebagai jalur produksi untuk video/large files. Pilihan yang diterima:

- `proxy` hanya untuk PoC terbatas;
- `r2` untuk temporary object staging;
- `stream` untuk Cloudflare Stream;
- `origin` untuk DNS-only signed origin.

Jika belum ada keputusan, bangun abstraction dan provider `proxy` sebagai PoC, tetapi jangan melakukan rollout produksi atau menyebutnya production-ready.

## Urutan Eksekusi

Ikuti `## Execution Task List` secara kronologis. Setelah setiap tahap selesai, segera ubah checkbox terkait dari `- [ ]` menjadi `- [x]` pada implementation plan. Jangan menandai tahap yang belum benar-benar selesai.

## Acceptance Criteria

- Signed URL tervalidasi HMAC dan expiry secara constant-time.
- Source dibatasi pada allowlist dan tidak membuka SSRF/arbitrary fetch.
- Proxy mendukung `GET`, `HEAD`, dan `Range` dengan status/header yang benar.
- Raw Nextcloud URL tidak pernah ada di payload Repliz.
- Preflight gagal keras bila endpoint anonim tidak kompatibel.
- Token/share URL tidak bocor ke log atau response error.
- Semua test baru lulus.
- `npm run test:publishing-scheduler` lulus.
- `npm run build` atau command build staging yang sesuai lulus.
- Smoke eksternal memverifikasi `robots.txt`, `HEAD`, dan `Range`.
- Satu smoke Facebook dan TikTok di staging mencapai hasil yang dapat diverifikasi.

## Cloudflare Free

Gunakan panduan:

`docs/repliz-media-delivery/cloudflare-free-setup.md`

Bot Fight Mode Free tidak dapat dikecualikan per-path. Jangan mencoba membuat skip rule yang diklaim dapat melewati Bot Fight Mode Free. Jangan memasang Cloudflare Access pada endpoint yang harus diambil Repliz.

## Deployment dan Release

Setelah seluruh verifikasi lokal lulus:

1. Deploy staging dengan command resmi repository.
2. Ikuti SOP remote build dan jangan membuat polling SSH 10–15 detik.
3. Jangan deploy production.
4. Setelah verifikasi staging sukses, jalankan release non-interaktif patch dengan judul dan poin yang akurat.
5. Verifikasi branch `main` dan tag versi telah terunggah ke remote resmi.

## Laporan Akhir

Laporkan:

- provider yang dipilih dan alasan;
- file yang berubah;
- hasil test/build/smoke;
- konfigurasi Cloudflare yang benar-benar diterapkan;
- status job smoke Facebook/TikTok;
- risiko tersisa dan rollback point;
- versi, commit, dan tag rilis.

