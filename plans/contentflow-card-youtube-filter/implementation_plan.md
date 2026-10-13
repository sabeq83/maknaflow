# Implementation Plan: Card ContentFlow (Title & Caption Terpisah) + Filter Platform YouTube

## Overview
Peningkatan antarmuka (UI) dan kapabilitas filtering pada modul **ContentFlow**:
1. **Pemisahan Title & Caption di Kolom Tengah Card ContentFlow**:
   - Menampilkan blok **🔴 Judul YouTube Video / Shorts** mandiri lengkap dengan ikon `▶`, indikator counter karakter (`X/100 Optimal`), dan tombol `📋 Salin Judul`.
   - Menampilkan blok **📱 Naskah Caption & Deskripsi Sosmed** mandiri di bawahnya dengan tombol `📋 Salin Caption`.
   - Menambahkan status chip **YouTube** (`▶ YouTube: Draft / Scheduled / Published`) pada baris status platform bersama TikTok, Instagram, dan Facebook.
2. **Penambahan Filter Platform YouTube**:
   - Memperluas baris kedua filter platform dari 4 kolom menjadi **5 Kolom** pada antarmuka [`app/content-flow/page.js`](file:///Users/sabeqmmursyid/_contentflow-staging/app/content-flow/page.js).
   - Menghubungkan parameter filter `youtube_status` ke backend API Route [`app/api/content-flow/route.js`](file:///Users/sabeqmmursyid/_contentflow-staging/app/api/content-flow/route.js) dan repository query [`lib/contentflow-repository.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/contentflow-repository.js).
3. **Deployment Multi-Environment (Dev & Staging Mac Mini)**:
   - Deploy ke Server Dev (`npm run deploy:dev:atomic -- --ref <sha> --apply --confirm-dev`, Port 5020/7020).
   - Deploy ke Server Staging (`npm run deploy:staging -- --ref <sha> --apply --confirm-staging`, Port 5010/7010).

---

## User Review Required

> [!IMPORTANT]
> **Poin Verifikasi Desain**:
> 1. File mockup interaktif telah selesai dibuat dan diverifikasi di [`public/mockup_contentflow_card_title_caption.html`](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_contentflow_card_title_caption.html).
> 2. Kolom tengah card kini memiliki dua tombol salin terpisah: **Salin Judul** (untuk judul video YouTube Shorts) dan **Salin Caption** (untuk teks deskripsi sosmed).
> 3. Baris filter platform kini memiliki 5 elemen: `▶️ Semua YouTube Status`, `🎵 Semua TikTok Status`, `📷 Semua Instagram Status`, `📘 Semua Facebook Status`, dan tombol `🔄 Reset Filter`.
> 4. Deployment akan dilakukan ke **Server Dev (Port 5020)** terlebih dahulu, diikuti dengan **Server Staging (Port 5010)**.

---

## Execution Task List
- [ ] Task 1: Perbarui backend repository [`lib/contentflow-repository.js`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/contentflow-repository.js) untuk mendukung filter `youtubeStatus`.
- [ ] Task 2: Perbarui API route [`app/api/content-flow/route.js`](file:///Users/sabeqmmursyid/_contentflow-staging/app/api/content-flow/route.js) untuk mem-passing query param `youtube_status`.
- [ ] Task 3: Modifikasi antarmuka utama [`app/content-flow/page.js`](file:///Users/sabeqmmursyid/_contentflow-staging/app/content-flow/page.js):
  - [ ] 3a. Tambahkan state `youtubeFilter` dan masukkan ke URL query & fungsi `resetFilters`.
  - [ ] 3b. Perbarui filter grid baris kedua menjadi 5 kolom dan pasang dropdown filter YouTube.
  - [ ] 3c. Tata ulang kolom tengah card: Blok YouTube Title mandiri, Blok Caption mandiri, dan Chip YouTube status.
- [ ] Task 4: Uji build lokal (`npm run build`) untuk memastikan tidak ada syntax error, bundle collision, atau lint warning.
- [ ] Task 5: Rilis patch non-interaktif (`npm run release-non-interactive`).
- [ ] Task 6: Deploy atomic ke Server Dev Mac Mini (`npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`) dan verifikasi UI port 5020 / API port 7020.
- [ ] Task 7: Deploy atomic ke Server Staging Mac Mini (`npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`) dan verifikasi UI port 5010 / API port 7010.
