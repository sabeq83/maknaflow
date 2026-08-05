# 📊 Analisis Migrasi Database Staging Lama (`100.117.59.92`) ke Database Server Terpusat

**Tanggal Analisis:** 5 Agustus 2026  
**Status:** Usulan Teknis Migrasi  
**Penulis:** Antigravity (AI Coding Assistant)  

---

## 📌 1. Pertanyaan Kunci: Apakah Memungkinkan?
**Sangat Memungkinkan dan Aman.**  
Karena basis data yang berjalan di `100.117.59.92` (WSL 2) menggunakan engine **PostgreSQL 15**, kita dapat dengan mudah melakukan ekspor database secara logis menggunakan utilitas standard `pg_dump` ke dalam format biner terkompresi (format Custom `.dump`), mengirimkannya via secure network, dan mengimpornya kembali menggunakan `pg_restore`.

---

## 📐 2. Analisis Target Destinasi Migrasi

Berdasarkan topologi MAKNA Flow yang berjalan, server database terpusat berada di **`100.78.186.123` (Node 3)**. Server ini menyimpan basis data untuk Staging (skema `staging`) maupun Production (skema `public`).

Oleh karena itu, penyalinan data dari `100.117.59.92` diarahkan ke Node 3 dengan opsi pembagian berikut:

### Opsi A: Menyalin ke Skema `staging` di Database Terpusat (Sangat Direkomendasikan 🟢)
Data dari server lama dipulihkan ke skema `staging` di database `maknaflow_db` pada `100.78.186.123`.
* **Kelebihan**: Asisten dapat langsung melanjutkan pekerjaan (kampanye, video, draf) di server staging baru (`100.65.62.63`) dengan data historis yang utuh.
* **Tantangan**: Jika di skema `staging` pusat sudah ada data baru, kita harus menimpa skema tersebut (`DROP SCHEMA staging CASCADE` lalu restore) agar tidak terjadi konflik Primary Key (PK).

### Opsi B: Menyalin ke Skema `public` (Production) di Database Terpusat (Perlu Hati-Hati ⚠️)
Data staging lama dipulihkan ke skema `public` (yang digunakan oleh aplikasi production).
* **Kelebihan**: Kampanye atau video yang dibuat di staging lama langsung tersedia di sistem production aktif.
* **Risiko & Tantangan**:
  * **Kebocoran Kredensial**: Tabel pengaturan (`settings`) di server staging lama mungkin berisi API key/kredensial pengujian. Jika ditimpa langsung ke production, kredensial production riil bisa terhapus/terganti.
  * **Tabrakan ID (PK Conflict)**: Jika sistem production sudah memiliki data kampanye/video aktif, mengimpor mentah-mentah dump staging akan memicu error duplikasi ID (PK Violations).
  * **Data Sampah**: Data uji coba (dummy data/broken renders) dari staging lama akan mencemari database production.

---

## 🛠️ 3. Prosedur Eksekusi Migrasi (Langkah-Langkah Teknis)

Berikut adalah tahapan aman untuk memigrasikan database dari `100.117.59.92` ke server database terpusat `100.78.186.123`:

### Langkah 1: Backup Database di Staging Lama (`100.117.59.92`)
Masuk ke terminal WSL 2 di PC Staging lama, jalankan perintah ekspor:
```bash
# Backup seluruh database maknaflow_staging ke format custom terkompresi
pg_dump -h localhost -U maknaflow_staging -F c -b -v -f /tmp/maknaflow_staging_backup.dump maknaflow_staging
```

### Langkah 2: Transfer File Backup ke Database Server Terpusat (`100.78.186.123`)
Kirimkan berkas `.dump` dari PC lama ke server database baru menggunakan SCP via Tailscale:
```bash
scp /tmp/maknaflow_staging_backup.dump makna-db:/tmp/
```

### Langkah 3: Restore ke Database Server Terpusat (`100.78.186.123`)
Masuk via SSH ke `makna-db` (`100.78.186.123`) dan restore backup tersebut.

* **Skenario 3.1: Jika memulihkan ke skema `staging` (Staging Baru)**:
  Sebelum melakukan restore, hapus skema staging lama di server pusat untuk menghindari bentrok:
  ```bash
  # Masuk ke psql di makna-db
  psql -h localhost -U postgres -d maknaflow_db -c "DROP SCHEMA IF EXISTS staging CASCADE; CREATE SCHEMA staging;"
  
  # Jalankan pg_restore terarah ke skema staging
  pg_restore -h localhost -U postgres -d maknaflow_db --schema=staging -v /tmp/maknaflow_staging_backup.dump
  ```

* **Skenario 3.2: Jika memulihkan ke skema `public` (Production)**:
  Kita **tidak boleh** menimpa seluruh skema `public`. Solusi terbaik adalah memulihkan data lama ke database/skema temporary terlebih dahulu (misal `temp_import`), lalu melakukan *selective insert* (hanya menyalin data kampanye/video yang sukses tanpa menimpa konfigurasi `settings` production).
  ```sql
  -- Contoh query selective transfer dari temp_import ke public
  INSERT INTO public.campaigns (id, campaign_name, status, tenant_id, ...)
  SELECT id, campaign_name, status, tenant_id, ... 
  FROM temp_import.campaigns
  ON CONFLICT (id) DO NOTHING;
  ```

---

## 📋 4. Rekomendasi Akhir
1. **Lakukan Backup Penuh** pada database target di `100.78.186.123` sebelum proses restore dimulai untuk menjaga keamanan data production saat ini.
2. **Prioritaskan Opsi A (Migrasi ke Staging Pusat)** untuk meminimalkan risiko kerusakan data production.
3. Jika video dari database lama memang ingin diposting oleh asisten di production, cara paling aman adalah memigrasikannya terlebih dahulu ke **Staging Baru**, melakukan pengecekan kualitas visual, lalu menekan tombol **Sync to ContentFlow** dari UI Staging Baru untuk mendorongnya ke Production secara selektif dan aman melalui jalur API yang terisolasi.
