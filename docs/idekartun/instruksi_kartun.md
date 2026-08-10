# Implementasi Cartoon Universe MAKNA Flow

Baca terlebih dahulu:

- `AGENTS.md`
- `docs/idekartun/00_USULAN_INTERNALISASI_PET_CARTOON_UNIVERSE_MAKNAFLOW.md`
- `docs/idekartun/RENCANA_IMPLEMENTASI_3_TAHAP.md`
- seluruh dokumen contoh prompt di `docs/idekartun/`

Peranmu adalah eksekutor coding. Jangan mendesain ulang fitur di luar ruang lingkup instruksi tahap yang sedang diberikan.

Aturan kerja:

1. Kerjakan hanya tahap yang diminta.
2. Sebelum mengubah kode, audit implementasi aktual dan baca dokumentasi Next.js relevan di `node_modules/next/dist/docs/`.
3. Perbarui `docs/idekartun/RENCANA_IMPLEMENTASI_3_TAHAP.md` sebelum coding:
   - perbaiki rencana berdasarkan kode aktual;
   - sediakan `## Execution Task List`;
   - sertakan Code Sebelum dan Code Sesudah untuk setiap file;
   - centang task secara real-time.
4. Jangan membuat pipeline produksi kedua.
5. Gunakan pipeline Content Planner → Pillar Campaign/OPC yang sudah ada.
6. Jangan mengubah arsitektur Single-Pass Strategic Campaign Engine.
7. PawVille adalah preset dari sistem universe generik, bukan mode global.
8. Jangan hardcode aturan PawVille di banyak file. Pusatkan pada universe profile.
9. Pertahankan backward compatibility untuk seluruh workflow `real_world`.
10. Jangan menyentuh perubahan user yang tidak berkaitan.
11. Setelah implementasi:
    - jalankan test/lint/build yang relevan;
    - laporkan file yang berubah;
    - laporkan hasil test;
    - ikuti SOP rilis pada `AGENTS.md` hanya setelah verifikasi berhasil.
12. Jangan deploy production. Deployment production memerlukan perintah eksplisit pengguna.
13. Setelah tahap selesai, berhenti dan tunggu instruksi tahap berikutnya.