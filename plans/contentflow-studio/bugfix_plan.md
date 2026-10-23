# Rencana Implementasi: Perbaikan Bug & Penyempurnaan ContentFlow Studio

## 1. Analisis Akar Masalah & Audit Teknis (Root Cause & UI Audit)

### Poin 1: Bug Jadwal Tayang per Baris Konten Mereset Tanggal Produksi ke Tanggal 1
- **Lokasi Kode**: [`app/components/contentflow-studio/StudioWorkspace.js:784-788`](file:///Users/sabeqmmursyid/_contentflow-staging/app/components/contentflow-studio/StudioWorkspace.js#L784-L788)
- **Akar Masalah**:
  ```javascript
  const pubTime = e.target.value;
  const prodTime = pubTime ? toZonedInput(new Date(zonedInputToIso(pubTime)).getTime() - 86400000) : '';
  setSlotScheduleMap(prev=>updateStudioOutputSchedule(outputManifest,prev,row.outputKey,{
    scheduledPublishAt:pubTime,
    scheduledProductionAt:rowSched.scheduledProductionAt && rowSched.scheduledProductionAt<prodTime ? rowSched.scheduledProductionAt : prodTime
  }));
  ```
  Kondisi ternary `rowSched.scheduledProductionAt && rowSched.scheduledProductionAt < prodTime ? rowSched.scheduledProductionAt : prodTime` dirancang dengan asumsi mempertahankan tanggal produksi lama jika lebih awal dari `prodTime`. Akibatnya:
  1. Jika tanggal produksi lama terisi nilai awal (misal tanggal 1 atau hari ini), dan pengguna mengubah tanggal tayang ke tanggal berikutnya (misal tanggal 15 atau bulan depan), `rowSched.scheduledProductionAt < prodTime` **selalu bernilai true**.
  2. Tanggal produksi **terkunci permanen pada tanggal awal (tanggal 1)** dan tidak pernah tersinkronisasi mengikuti tanggal tayang yang baru.
  3. Pemanggilan `zonedInputToIso(pubTime)` tanpa `try/catch` rawan memicu exception jika input datetime-local sedang diketik atau belum lengkap di browser pengguna.
- **Solusi**:
  1. Hitung `prodTime` secara dinamis (H-1 dari `pubTime`). Saat tanggal tayang diubah, tanggal produksi otomatis tersinkronisasi mengikuti tanggal tayang baru (`scheduledProductionAt: prodTime`).
  2. Pengguna tetap dapat mengkustomisasi jam/tanggal produksi secara independen melalui input *Mulai produksi (WIB)* yang sudah memiliki kontrol terpisah.
  3. Bungkus konversi waktu dalam blok pengaman (`try/catch`) agar input tanggal parsial di browser tidak memicu crash.

---

### Poin 2: Penyempurnaan UI & Fungsi Akun Tujuan Repliz
- **Lokasi Kode**:
  - Fetch Akun: [`app/components/contentflow-studio/StudioWorkspace.js:120`](file:///Users/sabeqmmursyid/_contentflow-staging/app/components/contentflow-studio/StudioWorkspace.js#L120)
  - Render Akun: [`app/components/contentflow-studio/StudioWorkspace.js:805`](file:///Users/sabeqmmursyid/_contentflow-staging/app/components/contentflow-studio/StudioWorkspace.js#L805)
  - Backend API: [`app/api/v2/publishing/accounts/route.js:27-75`](file:///Users/sabeqmmursyid/_contentflow-staging/app/api/v2/publishing/accounts/route.js#L27-L75)
- **Akar Masalah**:
  1. Fetch hanya memanggil `/api/v2/publishing/accounts?provider=repliz` tanpa opsi sinkronisasi live (`sync=1`).
  2. Tidak ada filter status koneksi (`status === 'active'`).
  3. Tidak ada tombol reload/sinkronisasi instan dengan state spinner pemuatan.
  4. Tidak ada filter pencarian cepat (search bar) berdasarkan nama akun atau platform.
- **Solusi**:
  1. Filter akun Repliz agar hanya menampilkan yang berstatus aktif: `a.provider === 'repliz' && (a.status === 'active' || !a.status)`.
  2. Tambahkan tombol **🔄 Reload Akun Repliz** (`?sync=1&provider=repliz`) lengkap dengan loading spinner.
  3. Sediakan input pencarian real-time untuk memfilter nama akun dan platform secara instan.
  4. Sediakan tombol bantuan cepat **"Pilih Semua"** dan **"Batal Pilih"**, beserta ringkasan jumlah akun terpilih.

---

### Poin 3: Bug Kampanye Pillar (⚠️ Planner belum siap atau sudah digunakan)
- **Lokasi Kode**:
  - Batch Service Guard: [`lib/contentflow-studio-batch-service.js:33`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/contentflow-studio-batch-service.js#L33)
  - Recipe Planner Engine: [`lib/recipe-planner-engine.js:387`](file:///Users/sabeqmmursyid/_contentflow-staging/lib/recipe-planner-engine.js#L387)
- **Akar Masalah**:
  1. Validasi di `lib/contentflow-studio-batch-service.js` secara kaku hanya memeriksa `['completed', 'ready']`. Sementara itu, `recipe-planner-engine.js` menghasilkan status `'planned'`. Status ini ditolak server dengan error `⚠️ Planner belum siap atau sudah digunakan`.
  2. Pengguna meminta alur: *Content planner disave (disimpan ke database), digenerate (AI dijalankan hingga baris konten tercipta), dan setelah planner ada serta siap, baru bisa dibawa ke wizard konfigurasi campaign.*
- **Solusi**:
  1. Perbarui guard di `lib/contentflow-studio-batch-service.js` untuk menerima seluruh status siap pakai: `['completed', 'ready', 'planned']` dengan syarat `rows.length > 0` dan belum pernah dikonsumsi di `content_planner_consumptions`.
  2. Di antarmuka Studio Step 1:
     - Tampilkan progres generator transparan: "1. Menyimpan Draft Planner... → 2. Menjalankan AI Generator Pipeline... → 3. Planner Siap!".
     - Validasi kelengkapan baris konten (`rows.length > 0`) sebelum beralih ke Step 2 (Review) dan Step 3 (Konfigurasi Campaign).
     - Berikan opsi tab praktis: **"Buat & Generate Planner Baru"** ATAU **"Pilih dari Planner Siap Pakai"**.

---

### Poin 4: Tombol Halaman Log untuk Tiap Baris Konten yang Dijadwalkan
- **Kebutuhan**: Melacak riwayat, status eksekusi, dan audit trail dari setiap baris konten (slot) yang sudah dijadwalkan.
- **Solusi**:
  1. Pada `GET /api/v2/contentflow-studio/slots/[id]`, sertakan query data events:
     ```sql
     SELECT * FROM content_studio_events WHERE slot_id = $1 AND tenant_id = $2 ORDER BY created_at DESC
     ```
  2. Tambahkan tombol **📜 Log** di setiap baris slot dan pada modal detail slot:
     - Membuka drawer/modal timeline log eksekusi yang menampilkan kronologi event lengkap beserta pesan error teknis jika ada.
     - Menyediakan tombol pintas langsung menuju `/content-flow` jika baris sudah memiliki `contentflow_id`.

---

### Poin 5: Mitigasi Manual Terpilih (Sesuai Keputusan Pengguna)
- **A. Gagal Produksi (AI Worker Failure)** → **Opsi 1: `🔄 Ulangi Produksi AI (Retry Dispatch)`**
  - Endpoint `POST /api/v2/contentflow-studio/slots/[id]/actions` dengan `{ action: 'retry_production' }`.
  - Mereset status baris ke `stage_status = 'pending'`, `error_message = NULL`, `progress_percent = 0`.
  - Worker AI mengklaim ulang slot untuk dirender ulang otomatis.
- **B. Gagal Skedul / Publikasi (Publishing Failure)** → **Opsi 2: `⏰ Jadwalkan Ulang / Ganti Akun Target (Reschedule & Re-target)`**
  - Endpoint `POST /api/v2/contentflow-studio/slots/[id]/actions` dengan `{ action: 'reschedule', scheduledPublishAt, accountIds }`.
  - Pengguna dapat memundurkan jadwal tayang dan memilih akun Repliz aktif pengganti.
  - Memperbarui jadwal slot dan target akun, mereset `publishing_status = 'approved'`.

---

### Poin 6: Audit Tipografi & Standarisasi Semantic CSS Tokens
- **Skala Tipografi Proporsional**:
  - Modal/Wizard Title: `1.25rem` – `1.35rem`, 700 Bold
  - Subheader: `1.05rem` – `1.15rem`, 700 Bold
  - Deskripsi/Subtitle: `0.85rem` – `0.88rem`, 400 Regular
  - Judul Baris Slot: `0.92rem` – `0.95rem`, 600 Semibold
  - Labels Input: `0.80rem` – `0.84rem`, 600 Semibold (menggantikan 12px/0.72rem)
  - Inputs & Datetime-local: `0.88rem` – `0.92rem`, padding `8px 10px`
- **Audit 100% Semantic Tokens**:
  - Hapus hardcoded `#fff` (line 1064) dan ubah ke `var(--on-action-primary)`.
  - Ganti `var(--border)` menjadi `var(--border-subtle)` / `var(--border-strong)`.
  - Seluruh komponen adaptif sempurna untuk Universal Theme (Light/Dark Mode).

---

### Poin 7 (BARU): Fungsionalitas Dropdown Filter Brand Profile Sesuai Tenant
- **Kondisi & Akar Masalah Saat Ini**:
  1. Pada `StudioWorkspace.js:82, 89`:
     ```javascript
     const [resCal, resBrands] = await Promise.all([
       fetch(`/api/v2/contentflow-studio/calendar?${params.toString()}`).then(r => r.json()).catch(() => ({ success: false })),
       fetch('/api/brand-profiles').then(r => r.json()).catch(() => ({ profiles: [] }))
     ]);
     if (resBrands?.profiles) {
       setBrandProfiles(resBrands.profiles);
     }
     ```
     Endpoint `/api/brand-profiles` mengembalikan `{ success: true, brands: [...] }`, **bukan** `resBrands.profiles`. Akibatnya, `setBrandProfiles` tidak pernah terisi dan dropdown selalu kosong hanya berisi opsi default "Semua Brand Profile".
  2. Pada `app/api/v2/contentflow-studio/calendar/route.js`:
     Pengecekan `brandId` hanya mencari `snap.brand_profile_id === brandId || snap.selectedBrandId === brandId`. Ini belum mencakup variasi key `brand_id`, `global_settings.brand_profile_id`, atau parsing string JSON dari batch config.
  3. Perhitungan `metrics` kalender sebelumnya menghitung dari total seluruh slot (`slots.length`), bukan dari slot yang telah terfilter brand (`filtered.length`).
- **Solusi**:
  1. **Frontend `StudioWorkspace.js`**:
     - Baca data brand dari endpoint secara tepat: `const loadedBrands = resBrands?.brands || resBrands?.profiles || []; setBrandProfiles(loadedBrands);`.
     - Render seluruh brand profile aktif sesuai tenant pada `<select value={selectedBrandId} onChange=...>`:
       ```javascript
       <option value="all">Semua Brand Profile ({brandProfiles.length} Brand)</option>
       {brandProfiles.map(b => (
         <option key={b.id} value={b.id}>{b.brand_name || b.name}</option>
       ))}
       ```
     - Saring baris slot konten secara reaktif (baik pada Kalender View maupun Tabel Jadwal View) berdasarkan `selectedBrandId`.
  2. **Backend `app/api/v2/contentflow-studio/calendar/route.js`**:
     - Sempurnakan ekstraksi `brandId` dari `batch_config` agar mendukung seluruh variasi:
       ```javascript
       const bId = snap.brand_profile_id || snap.selectedBrandId || snap.brandId || snap.brand_id || snap.global_settings?.brand_profile_id || snap.global_settings?.brandId;
       ```
     - Hitung objek `metrics` berdasarkan `filtered` (bukan seluruh slot).

---

## 2. Mockup Simulasi Standalone HTML

File simulasi interaktif lengkap telah diperbarui dengan filter brand profile:
🔗 **[`public/mockup_contentflow_studio_fixes.html`](file:///Users/sabeqmmursyid/_contentflow-staging/public/mockup_contentflow_studio_fixes.html)**

---

## 3. Execution Task List

- [x] **Task 1: Perbaiki Logika Sinkronisasi Tanggal pada Wizard Alokasi Jadwal**
  - Perbaiki event handler `onChange` pada input `scheduledPublishAt` di `app/components/contentflow-studio/StudioWorkspace.js`.
  - Pastikan tanggal produksi otomatis tersinkronisasi ke H-1 tanpa terkunci pada nilai tanggal 1 yang lama.
- [x] **Task 2: Sempurnakan UI & Fungsi Selector Akun Repliz**
  - Tambahkan fungsi reload akun Repliz dengan parameter `?sync=1&provider=repliz`.
  - Tambahkan input filter pencarian akun real-time di `app/components/contentflow-studio/StudioWorkspace.js`.
  - Filter hanya akun Repliz yang berstatus `active` / `connected`.
  - Tambahkan tombol helper "Pilih Semua" dan "Batal Pilih".
- [x] **Task 3: Perbaiki Guard Status Planner & Alur Save -> Generate -> Bawa ke Wizard**
  - Perbarui validasi status di `lib/contentflow-studio-batch-service.js` agar mendukung `['completed', 'ready', 'planned']`.
  - Sempurnakan `handlePlannerSuccess` di `app/components/contentflow-studio/StudioWorkspace.js` agar memverifikasi kelengkapan baris konten dan status selesai sebelum membuka Step 2/3.
  - Tambahkan dukungan memilih planner siap pakai yang belum dikonsumsi.
- [x] **Task 4: Implementasikan Tombol & Modal Log Eksekusi per Baris Konten**
  - Perbarui `GET /api/v2/contentflow-studio/slots/[id]` agar mengembalikan array `events` dari `content_studio_events`.
  - Tambahkan tombol **📜 Log** di setiap baris slot dan panel timeline log interaktif pada modal detail slot di `StudioWorkspace.js`.
- [x] **Task 5: Implementasikan Aksi Mitigasi Manual Terpilih (Retry AI & Reschedule Akun)**
  - Buat endpoint `POST /api/v2/contentflow-studio/slots/[id]/actions` yang mengimplementasikan:
    - `retry_production` (Opsi 1 untuk gagal produksi)
    - `reschedule` (Opsi 2 untuk gagal skedul dengan update waktu & akun)
  - Tambahkan tombol aksi mitigasi terpilih pada modal slot di `StudioWorkspace.js`.
- [x] **Task 6: Standardisasi Font Size & 100% Semantic CSS Tokens**
  - Terapkan skala tipografi proporsional sesuai tabel Typography Hierarchy di seluruh step wizard dan modal slot `StudioWorkspace.js`.
  - Hapus hardcoded `#fff` (line 1064) dan ubah ke token `var(--on-action-primary)`.
  - Ganti `var(--border)` menjadi `var(--border-subtle)` / `var(--border-strong)`.
  - Pastikan seluruh input form menggunakan `var(--input-bg)` dan `var(--focus-ring)`.
- [x] **Task 7: Fungsikan Dropdown Filter Brand Profile Sesuai Tenant**
  - Perbaiki pemanggilan API `/api/brand-profiles` pada `StudioWorkspace.js` untuk membaca `resBrands.brands`.
  - Tampilkan seluruh brand profile milik tenant aktif pada dropdown filter.
  - Saring Kalender dan Tabel Jadwal Konten secara reaktif dan menyeluruh saat brand tertentu dipilih.
  - Sempurnakan filter brand dan metrik pada `app/api/v2/contentflow-studio/calendar/route.js`.
- [x] **Task 8: Pengujian & Verifikasi Terintegrasi**
  - Jalankan unit test `tests/contentflow-studio.test.js` & `tests/contentflow-studio-wizard-parity.test.mjs` (Semua 16 test berhasil lolos 100%).
  - Jalankan `npm run build` untuk memverifikasi tidak ada error build Next.js (Build sukses dengan exit code 0).
  - Verifikasi fungsionalitas di server dev (Port 5020/7020) sesuai SOP.

---

## 4. Cuplikan Kode Sebelum & Sesudah (Before & After Code Snippets)

### File 1: `app/components/contentflow-studio/StudioWorkspace.js` (Brand Profile Fetch & Filter)

#### Code Sebelum (Current/Before):
```javascript
// Baris 82, 89: Salah membaca response key (.profiles bukannya .brands)
const [resCal, resBrands] = await Promise.all([
  fetch(`/api/v2/contentflow-studio/calendar?${params.toString()}`).then(r => r.json()).catch(() => ({ success: false })),
  fetch('/api/brand-profiles').then(r => r.json()).catch(() => ({ profiles: [] }))
]);

if (resCal.success) {
  setSlots(resCal.data || []);
  if (resCal.metrics) setMetrics(resCal.metrics);
}
if (resBrands?.profiles) {
  setBrandProfiles(resBrands.profiles);
}
```

#### Code Sesudah (Proposed/After):
```javascript
const [resCal, resBrands] = await Promise.all([
  fetch(`/api/v2/contentflow-studio/calendar?${params.toString()}`).then(r => r.json()).catch(() => ({ success: false })),
  fetch('/api/brand-profiles').then(r => r.json()).catch(() => ({ brands: [] }))
]);

if (resCal.success) {
  setSlots(resCal.data || []);
  if (resCal.metrics) setMetrics(resCal.metrics);
}
const loadedBrands = resBrands?.brands || resBrands?.profiles || [];
if (Array.isArray(loadedBrands)) {
  setBrandProfiles(loadedBrands);
}
```

---

### File 2: `app/api/v2/contentflow-studio/calendar/route.js` (Robust Brand Filtering & Metrics)

#### Code Sebelum (Current/Before):
```javascript
    let filtered = slots;
    if (status && status !== 'all') {
      filtered = filtered.filter(s => s.stage_status === status || s.publishing_status === status);
    }
    if (brandId && brandId !== 'all') {
      filtered = filtered.filter(s => {
        const snap = s.batch_config || {};
        return snap.brand_profile_id === brandId || snap.selectedBrandId === brandId;
      });
    }

    const metrics = {
      total: slots.length,
      ...
    };
```

#### Code Sesudah (Proposed/After):
```javascript
    let filtered = slots;
    if (status && status !== 'all') {
      filtered = filtered.filter(s => s.stage_status === status || s.publishing_status === status);
    }
    if (brandId && brandId !== 'all') {
      filtered = filtered.filter(s => {
        let snap = s.batch_config || {};
        if (typeof snap === 'string') {
          try { snap = JSON.parse(snap); } catch {}
        }
        const bId = snap.brand_profile_id || snap.selectedBrandId || snap.brandId || snap.brand_id || snap.global_settings?.brand_profile_id || snap.global_settings?.brandId;
        return String(bId) === String(brandId);
      });
    }

    const metrics = {
      total: filtered.length,
      pending: filtered.filter(s => s.stage_status === 'pending').length,
      in_progress: filtered.filter(s => s.stage_status === 'in_progress').length,
      ready_for_review: filtered.filter(s => ['ready','needs_review'].includes(s.stage_status) && s.publishing_status === 'not_approved').length,
      approved: filtered.filter(s => s.publishing_status === 'approved' || s.publishing_status === 'scheduled').length,
      published: filtered.filter(s => s.publishing_status === 'published').length,
      failed: filtered.filter(s => s.stage_status === 'failed' || s.publishing_status === 'failed').length
    };
```
