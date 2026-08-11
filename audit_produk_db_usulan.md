# Audit Forensik & Usulan Solusi Isolasi Database Produk MAKNA Flow

Dokumen ini berisi ringkasan hasil audit mendalam terkait data produk pada `default_tenant` di server database PostgreSQL (`dev` schema, host `100.78.186.123`) beserta temuan celah keamanan (data leakage) dan usulan langkah perbaikannya.

---

## 1. Ringkasan Temuan Audit Forensik

### A. Status Penambahan Produk Saat Login
- **Fakta:** **Tidak ada penambahan produk baru saat user login** maupun selama bulan Agustus 2026.
- **Waktu pembuatan produk terakhir di `default_tenant`:** 19 Juli 2026 (`2026-07-19T01:22:04.000Z`).
- **Jumlah produk yang dibuat sejak 1 Agustus 2026:** **0 produk**.

### B. Asal-Usul 250 Produk di `default_tenant`
Semua 250 produk yang muncul di `default_tenant` adalah **data historis (legacy)** yang dibuat sebelum arsitektur Multi-Tenancy diimplementasikan (sebelum 2 Agustus 2026):
- **Rentang waktu pembuatan**: 14 Mei 2026 s.d. 19 Juli 2026.
- **Rincian tipe data**:
  - `pe_timestamp (Manual / Auto-Created via App)`: **216 produk**
  - `pe_migrated (Legacy MaknaGen/v1)`: **30 produk**
  - `UUID (Import CSV/API v2)`: **4 produk**
- **Mengapa masuk ke `default_tenant`?**
  Pada migrasi multi-tenancy awal Agustus 2026, sistem secara otomatis mengisi `tenant_id = 'default_tenant'` untuk semua baris data lama yang sebelumnya bernilai `NULL`.
- **Perbandingan dengan Tenant Lain di Server Dev**:
  - `default_tenant` (Local Staging / Legacy workspace): **250 produk**
  - `tnt_sy-dodot_4ba27b` (Tenant SY Dodot): **16 produk**
  - `tnt_sy-benu_76edaa` (Tenant SY Benu): **0 produk** (benar-benar kosong)

---

## 2. Temuan Celah Potensial (Vulnerability & Data Leak Audit)

Meskipun saat login tidak ada injeksi data, ditemukan **4 titik rawan pada kode legacy** yang berpotensi menyebabkan produk baru otomatis tersimpan tanpa `tenant_id` (atau jatuh ke default) saat pipeline otomatisasi berjalan:

1. **`product_extractions` Belum Masuk `isolatedTables` di `lib/db.js`**:
   Layer kompatibilitas SQLite-to-PostgreSQL pada `lib/db.js` belum menyertakan `product_extractions` dalam daftar tabel yang otomatis di-inject filter `tenant_id`.
2. **Auto-Scraping Sourcing Kampanye di `lib/scheduler-processors.js` (Line 2128)**:
   Saat sistem melakukan auto-scrape URL produk dari kampanye, query `INSERT INTO product_extractions` lama belum menyertakan `tenant_id`.
3. **Modul Instant Factory di `app/api/v2/instant-factory/route.js` (Line 125)**:
   Masih menggunakan query `INSERT INTO product_extractions` tanpa menyertakan `tenant_id`.
4. **Multiplier Worker di `lib/re-multiplier-worker.js` (Line 158)**:
   Masih menggunakan query `INSERT INTO product_extractions` tanpa menyertakan `tenant_id`.

---

## 3. Usulan Solusi & Rencana Tindakan

### Usulan 1: Penataan Data `default_tenant`
Pilih salah satu opsi:
- **Opsi 1A (Hapus Bersih / Reset Clean)**:
  Menghapus seluruh 250 produk legacy di `default_tenant` sehingga menu Products pada `default_tenant` menjadi **0 produk** (bersih total seperti tenant baru).
- **Opsi 1B (Pindahkan ke Tenant Khusus Arsip / Demo)**:
  Membuat tenant baru bernama `Legacy Archive` (`tnt_legacy_archive`) dan memindahkan 250 produk legacy tersebut ke sana agar data historis tetap aman jika sewaktu-waktu dibutuhkan, tanpa mengotori `default_tenant`.

---

### Usulan 2: Pengamanan Mutlak (Hardening Multi-Tenancy Isolation)
1. **Daftarkan `product_extractions` ke `isolatedTables`** di `lib/db.js`.
2. **Perbarui Semua Query `INSERT INTO product_extractions`**:
   Wajibkan penyertaan kolom `tenant_id` yang diambil dari context tenant aktif pada:
   - `lib/scheduler-processors.js`
   - `app/api/v2/instant-factory/route.js`
   - `lib/re-multiplier-worker.js`
   - `app/api/sheets-autopilot/repair-storyboard-clip/route.js`
3. **Database Constraint Hardening**:
   Pasang constraint `ALTER TABLE product_extractions ALTER COLUMN tenant_id SET NOT NULL;` untuk memastikan tidak ada data produk tanpa tenant yang bisa tersimpan di database.
