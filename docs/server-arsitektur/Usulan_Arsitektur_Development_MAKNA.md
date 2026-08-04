# Usulan Arsitektur Development MAKNA

## Kondisi Saat Ini

### Hardware

  Device      Spesifikasi          OS
  ----------- -------------------- ----------------
  MacBook     Apple Silicon M3     macOS
  PC          Core i7, RAM 16 GB   Windows + WSL
  Intel NUC   Core i3, RAM 16 GB   Ubuntu Desktop

### Tim

-   1 orang: Marketer + Vibe Coder
-   1 orang: Publishing Social Media & Affiliate

------------------------------------------------------------------------

# Analisis

Walaupun MacBook M3 memiliki CPU yang sangat cepat, pada workflow web
modern performa localhost tidak selalu menjadi yang terbaik.

Penyebab yang umum:

-   Docker di macOS berjalan melalui Virtual Machine.
-   File watching (Next.js, Vite, Laravel, React, dsb.) lebih efisien di
    Linux.
-   Banyak proses AI (Cursor, ChatGPT, browser, terminal, database,
    Node) berjalan bersamaan.
-   WSL2 menggunakan kernel Linux sehingga performa development sering
    mendekati Linux native.

Karena itu, MacBook lebih ideal digunakan sebagai **workstation
coding**, bukan sebagai server development.

------------------------------------------------------------------------

# Arsitektur yang Direkomendasikan

                 MacBook M3
          (Coding + AI + Browser)
                   │
                Git Push
                   │
                   ▼
          PC i7 Windows + WSL
          Development Server
       Backend + Frontend + DB
         Docker + Redis + API
                   │
            Testing Selesai
                   ▼
          Intel NUC Ubuntu
            Staging Server
       staging.makna.local
                   │
          Release Production
                   ▼
            VPS / Cloud

------------------------------------------------------------------------

# Pembagian Tugas

## 1. MacBook M3

Fungsi:

-   Cursor / VS Code
-   AI Assistant
-   Browser
-   Git
-   Dokumentasi

Tidak disarankan menjalankan:

-   Docker
-   Database
-   Redis
-   Backend
-   Worker
-   Queue

MacBook menjadi **remote cockpit** untuk seluruh proses development.

------------------------------------------------------------------------

## 2. PC Core i7 + WSL

Berfungsi sebagai **Development Server**.

Menjalankan:

-   Frontend
-   Backend
-   PostgreSQL / MySQL
-   Redis
-   Queue Worker
-   Docker
-   API
-   Local AI Service (jika diperlukan)

MacBook mengakses aplikasi melalui jaringan lokal, misalnya:

    http://192.168.x.x:3000

------------------------------------------------------------------------

## 3. Intel NUC Ubuntu

Berfungsi sebagai **Staging Server**.

Tujuan:

-   Deploy hasil development.
-   Uji integrasi.
-   QA.
-   Tempat asisten melakukan pengecekan sebelum rilis.

------------------------------------------------------------------------

## 4. VPS

Production yang digunakan user.

Semua fitur baru sebaiknya dikontrol menggunakan Feature Flag.

------------------------------------------------------------------------

# Workflow

    Coding
       │
    MacBook
       │
    Commit
       │
    Deploy
       ▼
    Development Server (PC i7)
       │
    Testing
       ▼
    Staging (Intel NUC)
       │
    Validasi
       ▼
    Production VPS

------------------------------------------------------------------------

# Keuntungan

-   MacBook tetap ringan.
-   Development jauh lebih cepat.
-   Staging terpisah dari development.
-   Production lebih aman.
-   Mudah dikembangkan menjadi sistem CI/CD di masa depan.

------------------------------------------------------------------------

# Rekomendasi Akhir

  Device             Peran
  ------------------ --------------------------
  MacBook M3         Coding, AI, Git, Browser
  PC i7 + WSL        Development Server
  Intel NUC Ubuntu   Staging Server
  VPS                Production

Arsitektur ini sederhana, efisien untuk tim kecil, dan cukup skalabel
untuk pengembangan MAKNA dalam jangka panjang.
