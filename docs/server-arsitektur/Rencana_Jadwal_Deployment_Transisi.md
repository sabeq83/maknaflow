# 📅 Rencana Jadwal & Prosedur Deployment Transisi Server MAKNA Flow

**Tanggal Dokumen:** 5 Agustus 2026  
**Penulis:** Antigravity (AI Coding Assistant)  
**Tingkat Kerawanan:** Sedang (Memerlukan pembekuan sementara aktivitas Staging selama ±15 menit)

---

## 🕒 1. Usulan Waktu Eksekusi (Window Maintenance)

Untuk menghindari gangguan pada aktivitas Asisten dalam membuat kampanye dan mengelola konten, kami mengusulkan deployment dilakukan pada salah satu waktu berikut:

* **Pilihan 1 (Direkomendasikan): Malam Hari (Pukul 21:00 - 21:30 WIB)**
  * *Rasional*: Mayoritas asisten sudah selesai melakukan tugas harian, aktivitas database minimum, dan risiko gangguan operasional sangat kecil.
* **Pilihan 2: Pagi Hari Sebelum Jam Kerja (Pukul 07:00 - 07:30 WIB)**
  * *Rasional*: Jika diperlukan koordinasi langsung di pagi hari sebelum asisten mulai login untuk membuat kampanye baru.
* **Pilihan 3: Segera (Real-time)**
  * *Syarat*: Jika Anda mengonfirmasi tidak ada asisten yang sedang aktif mengakses staging saat ini, kita bisa langsung mengeksekusinya sekarang.

---

## 📋 2. Rincian Prosedur & Durasi (Total Estimasi: 15 Menit)

Berikut adalah tahapan dari awal hingga verifikasi sukses:

| Tahapan | Aksi Teknis | Durasi | Ketersediaan Sistem |
| :--- | :--- | :---: | :--- |
| **1. Pembekuan Aktivitas** | Mengumumkan ke asisten untuk log-out sementara / tidak melakukan aksi input baru. Menyetop background worker di staging lama. | 3 Menit | Staging Read-only |
| **2. Migrasi Database** | Menjalankan `pg_dump` di `100.117.59.92` (WSL), transfer dump biner ke `100.78.186.123` (NUC DB), lalu `pg_restore` ke skema `staging`. | 7 Menit | Offline / Migrasi |
| **3. Push & Deploy Kode** | Melakukan commit modifikasi konfigurasi IP & webhook host ke Git, lalu menjalankan deployment single-pass ke server staging baru (`100.65.62.63`). | 2 Menit | Staging restart |
| **4. Uji Kesehatan Cluster** | Menjalankan `node scripts/test-cluster-health.js` dan verifikasi konektivitas ke G-Labs Webhook baru (`100.64.70.61`). | 1 Menit | Sistem Online |
| **5. Smoke Test & Go-Live** | Melakukan uji coba pembuatan 1 kampanye uji coba singkat untuk mematikan alur kerja dari UI ke G-Labs & DB berjalan mulus. | 2 Menit | Sistem Online |

---

## 🛡️ 3. Rencana Rollback (Antisipasi Kegagalan)
Apabila terjadi kendala saat proses impor database atau deployment Next.js gagal:
1. **Rollback Database**: Skema `staging` lama di database server pusat dapat di-drop, dan sistem dikembalikan menggunakan backup dump awal.
2. **Rollback Kode**: Mengembalikan branch staging ke commit sebelumnya (`git reset --hard`) dan menjalankan ulang deploy script untuk mengembalikan setting IP lama.
3. Database di server lama (`100.117.59.92`) **tidak akan dihapus** sebelum transisi dinyatakan 100% sukses, sehingga data historis di server lama tetap aman sebagai salinan cadangan utama.
