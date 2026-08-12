# Implementation Plan — MAKNA Flow Light & Dark Theme System

## 1. Sasaran

Mengganti pendekatan pewarnaan tambal-sulam menjadi satu sistem token semantik yang konsisten untuk seluruh halaman MAKNA Flow. Hasil akhir harus:

- mempunyai pilihan `dark` dan `light`;
- mempertahankan preferensi pengguna tanpa flash tema saat halaman dibuka;
- mencapai kontras WCAG AA untuk teks dan kontrol utama;
- mempertahankan arti warna status di kedua tema;
- menghapus ketergantungan pada selector global yang menimpa inline style;
- mencakup 29 entri menu serta seluruh 36 file halaman UI yang ditemukan, termasuk route detail, login, dan legacy/internal;
- tidak mengubah kontrak API, alur bisnis, database, atau permission menu.

Mockup acuan: [`docs/mockups/maknaflow-theme-preview.html`](../mockups/maknaflow-theme-preview.html).

## 2. Temuan Audit Saat Ini

- `#fff` dipakai sekitar 448 kali pada source UI.
- Terdapat campuran palet Tailwind, Flat UI, cyan, indigo, hijau, dan warna brand platform tanpa pemetaan fungsi.
- Light theme bergantung pada selector seperti `[style*='color: #fff']` dan banyak `!important`.
- `app/video-studio/studio.css` dan `app/tts-studio/studio.css` masih mengasumsikan background gelap.
- Status yang sama kadang memakai warna berbeda antarhalaman.
- Theme toggle berada di sidebar, tetapi belum menjadi kontrol global yang reusable dan aksesibel.

## 3. Keputusan Desain

### 3.1 Token semantik

Token tidak dinamai berdasarkan warna mentah, tetapi berdasarkan fungsi:

```css
--canvas;
--sidebar;
--surface;
--surface-raised;
--surface-interactive;
--text-primary;
--text-secondary;
--text-muted;
--border-subtle;
--border-strong;
--action-primary;
--action-primary-hover;
--on-action-primary;
--status-info;
--status-success;
--status-warning;
--status-danger;
--focus-ring;
```

Alias lama seperti `--bg-primary`, `--bg-card`, `--accent`, dan `--border` dipertahankan sementara selama migrasi, lalu dihapus setelah tidak memiliki consumer.

### 3.2 Aturan kontras

- Teks normal: minimal `4.5:1`.
- Teks besar dan boundary kontrol: minimal `3:1`.
- Status selalu memakai label/ikon selain warna.
- Focus ring wajib terlihat pada dua tema.
- Disabled state tidak hanya mengandalkan opacity di bawah batas keterbacaan.

### 3.3 Strategi migrasi

Migrasi dilakukan per kelompok halaman. Setiap kelompok harus lolos build, audit literal warna, dan smoke test light/dark sebelum kelompok berikutnya dikerjakan. Override lama baru dihapus setelah seluruh kelompok selesai.

## 4. Perubahan Fondasi

### 4.1 `app/theme.css` — file baru

**Code Sebelum (Current/Before)**

```css
/* Belum ada file khusus sebagai sumber kebenaran token tema. */
```

**Code Sesudah (Proposed/After)**

```css
:root,
[data-theme='dark'] {
  color-scheme: dark;
  --canvas: #080c14;
  --surface: #101827;
  --surface-raised: #162235;
  --text-primary: #f4f7fb;
  --text-secondary: #b6c2d2;
  --text-muted: #8290a5;
  --border-subtle: #26354a;
  --action-primary: #2dd4bf;
  --on-action-primary: #042f2e;
}

[data-theme='light'] {
  color-scheme: light;
  --canvas: #f2f5f8;
  --surface: #ffffff;
  --surface-raised: #f7f9fc;
  --text-primary: #152033;
  --text-secondary: #40506a;
  --text-muted: #66758a;
  --border-subtle: #d8e0ea;
  --action-primary: #087f73;
  --on-action-primary: #ffffff;
}
```

File ini juga mendefinisikan token hover, focus, elevation, overlay, input, link, dan empat status.

### 4.2 `app/components/ThemeToggle.js` — file baru

**Code Sebelum (Current/Before)**

```js
// State dan fungsi toggle tema menyatu di Sidebar.
```

**Code Sesudah (Proposed/After)**

```js
'use client';

export default function ThemeToggle() {
  // Sinkronkan data-theme, localStorage, aria-label, dan icon.
  return <button className="theme-toggle" aria-label="Gunakan light theme" />;
}
```

### 4.3 `app/layout.js`

**Code Sebelum (Current/Before)**

```js
const storedTheme = localStorage.getItem('theme');
const theme = storedTheme || 'dark';
document.documentElement.setAttribute('data-theme', theme);
```

**Code Sesudah (Proposed/After)**

```js
const stored = localStorage.getItem('theme');
const theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
document.documentElement.dataset.theme = theme;
document.documentElement.style.colorScheme = theme;
```

Tambahkan import `theme.css`, validasi nilai storage, dan pertahankan script blocking kecil untuk mencegah flash tema.

### 4.4 `app/globals.css`

**Code Sebelum (Current/Before)**

```css
[data-theme='light'] [style*='color: #fff'] {
  color: var(--text-primary) !important;
}
```

**Code Sesudah (Proposed/After)**

```css
.card {
  color: var(--text-primary);
  background: var(--surface);
  border-color: var(--border-subtle);
}

:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
```

Pertahankan alias token lama pada fase awal. Hapus selector pencarian inline dan `!important` setelah seluruh route dimigrasikan.

### 4.5 `app/components/Sidebar.js`

**Code Sebelum (Current/Before)**

```js
color: currentAccount === 'all' ? '#ffffff' : '#a1a1aa',
background: currentAccount === 'all'
  ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.2))'
  : 'rgba(255,255,255,0.02)'
```

**Code Sesudah (Proposed/After)**

```js
className={`account-link ${currentAccount === 'all' ? 'active' : ''}`}
```

```css
.account-link { color: var(--text-muted); background: var(--surface-interactive); }
.account-link.active { color: var(--status-success); background: var(--status-success-soft); }
```

Pindahkan theme state ke `ThemeToggle`, gunakan kelas untuk state aktif/nonaktif, dan perbaiki disabled state agar tetap terbaca.

### 4.6 `app/components/ImportPlannerModal.js`

**Code Sebelum (Current/Before)**

```js
background: 'rgba(0, 0, 0, 0.3)', color: '#fff'
```

**Code Sesudah (Proposed/After)**

```js
background: 'var(--overlay-subtle)', color: 'var(--text-primary)'
```

### 4.7 `app/components/BrandProductSelector.js`

**Code Sebelum (Current/Before)**

```js
color: '#94a3b8'
```

**Code Sesudah (Proposed/After)**

```js
color: 'var(--text-muted)'
```

## 5. Migrasi Halaman — Planning dan Overview

Semua file di bawah menggunakan pola migrasi yang sama, tetapi diverifikasi satu per satu.

### 5.1 `app/page.js`

**Before**

```js
color: '#38bdf8'
```

**After**

```js
color: 'var(--link)'
```

### 5.2 `app/content-planner/page.js`

**Before**

```js
color: '#ffffff'
```

**After**

```js
color: 'var(--text-primary)'
```

### 5.3 `app/content-planner/[id]/page.js`

**Before**

```js
color: '#60a5fa'
```

**After**

```js
color: 'var(--link)'
```

### 5.4 `app/products/page.js`

**Before**

```js
background: 'rgba(255,255,255,0.05)'
```

**After**

```js
background: 'var(--surface-interactive)'
```

### 5.5 `app/deconstruct/page.js`

**Before**

```js
border: '1px solid rgba(255,255,255,0.08)'
```

**After**

```js
border: '1px solid var(--border-subtle)'
```

### 5.6 `app/settings/presets/page.js`

**Before**

```js
background: '#18181b'
```

**After**

```js
background: 'var(--surface)'
```

### 5.7 `app/settings/brand-profiles/page.js`

**Before**

```js
color: 'var(--accent-light)'
```

**After**

```js
color: 'var(--action-primary-hover)'
```

### 5.8 `app/settings/universes/page.js`

**Before**

```js
color: '#f87171'
```

**After**

```js
color: 'var(--status-danger)'
```

## 6. Migrasi Halaman — Workflow

### 6.1 `app/re-campaigns/page.js`

**Before**

```js
background: 'rgba(99,102,241,0.15)'
```

**After**

```js
background: 'var(--status-info-soft)'
```

### 6.2 `app/re-campaigns/[id]/page.js`

**Before**

```js
color: '#fff'
```

**After**

```js
color: 'var(--text-primary)'
```

### 6.3 `app/pillar-campaigns/page.js`

**Before**

```js
borderColor: '#10b981'
```

**After**

```js
borderColor: 'var(--status-success)'
```

### 6.4 `app/pillar-campaigns/[id]/page.js`

**Before**

```js
background: '#FF0000'
```

**After**

```js
background: 'var(--platform-youtube)'
```

Warna brand eksternal dipertahankan sebagai token platform dan selalu dipasangkan dengan warna teks yang tervalidasi.

### 6.5 `app/sheets-autopilot/page.js`

**Before**

```js
background: '#09090b'
```

**After**

```js
background: 'var(--canvas)'
```

### 6.6 `app/sheets-autopilot/[id]/page.js`

**Before**

```js
color: 'var(--accent)'
```

**After**

```js
color: 'var(--link)'
```

### 6.7 `app/recipe-labs/page.js`

**Before**

```js
background: 'rgba(0,0,0,0.3)'
```

**After**

```js
background: 'var(--overlay-subtle)'
```

### 6.8 `app/instant-factory/page.js`

**Before**

```js
color: '#f3f4f6'
```

**After**

```js
color: 'var(--text-primary)'
```

### 6.9 `app/instant-factory/[id]/page.js`

**Before**

```js
background: 'rgba(255,255,255,0.03)'
```

**After**

```js
background: 'var(--surface-interactive)'
```

### 6.10 `app/multiplier-lab/page.js`

**Before**

```js
boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
```

**After**

```js
boxShadow: 'var(--shadow-lg)'
```

### 6.11 `app/product-bridge-inject/page.js`

**Before**

```js
color: '#fff'
```

**After**

```js
color: 'var(--text-primary)'
```

### 6.12 `app/product-bridge-inject/[id]/page.js`

**Before**

```js
color: 'var(--accent-light)'
```

**After**

```js
color: 'var(--link)'
```

### 6.13 `app/re-plus-recomm/page.js`

**Before**

```js
color: 'var(--text-muted)'
```

**After**

```js
color: 'var(--text-muted)'
```

Token yang sudah semantik dipertahankan; audit fokus pada background dan badge hardcoded di sekitarnya.

## 7. Migrasi Halaman — Publishing, Tools, Analytics

### 7.1 `app/content-flow/page.js`

**Before**

```js
background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
color: 'var(--text-primary)'
```

**After**

```js
background: 'var(--action-primary)',
color: 'var(--on-action-primary)'
```

### 7.2 `app/content-flow/PublishingScheduler.js`

**Before**

```js
background: 'rgba(245,158,11,0.15)'
```

**After**

```js
background: 'var(--status-warning-soft)'
```

### 7.3 `app/content-automations/page.js`

**Before**

```js
border: '1px solid var(--border-color)'
```

**After**

```js
border: '1px solid var(--border-subtle)'
```

### 7.4 `app/content-automations/AutomationCalendar.js`

**Before**

```js
background: STATUS_COLORS[event.status]
```

**After**

```js
className={`calendar-event status-${normalizeStatus(event.status)}`}
```

### 7.5 `app/video-studio/page.js`

**Before**

```js
<div className="ffmpeg-studio-container">
```

**After**

```js
<div className="ffmpeg-studio-container themed-workspace">
```

### 7.6 `app/video-studio/studio.css`

**Before**

```css
.studio-control-panel { background: rgba(20, 20, 25, 0.6); }
.media-section { background: rgba(255, 255, 255, 0.03); }
```

**After**

```css
.studio-control-panel { background: var(--surface); }
.media-section { background: var(--surface-raised); }
```

### 7.7 `app/tts-studio/page.js`

**Before**

```js
<div className="tts-studio-container">
```

**After**

```js
<div className="tts-studio-container themed-workspace">
```

### 7.8 `app/tts-studio/studio.css`

**Before**

```css
.tts-section { background: rgba(255, 255, 255, 0.02); }
.source-content textarea { background: rgba(0, 0, 0, 0.3); }
```

**After**

```css
.tts-section { background: var(--surface-raised); }
.source-content textarea { background: var(--input-bg); }
```

### 7.9 `app/scraper/page.js`

**Before**

```js
color: '#94a3b8'
```

**After**

```js
color: 'var(--text-muted)'
```

### 7.10 `app/reverse/page.js`

**Before**

```js
color: '#4285f4'
```

**After**

```js
color: 'var(--platform-google)'
```

### 7.11 `app/reports/page.js`

**Before**

```js
<h2 style={{ color: 'red' }}>Error loading reports</h2>
```

**After**

```js
<h2 className="text-danger">Error loading reports</h2>
```

## 8. Migrasi Halaman — System dan Legacy

### 8.1 `app/settings/users/page.js`

**Before**

```js
background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)'
```

**After**

```js
color: 'var(--text-primary)'
```

### 8.2 `app/settings/tenants/page.js`

**Before**

```js
background: 'rgba(255,255,255,0.04)'
```

**After**

```js
background: 'var(--surface-raised)'
```

### 8.3 `app/settings/page.js`

**Before**

```js
background: '#121318'
```

**After**

```js
background: 'var(--surface)'
```

### 8.4 `app/system-health/page.js`

**Before**

```js
color: google.connected ? '#10b981' : '#ef4444'
```

**After**

```js
color: google.connected ? 'var(--status-success)' : 'var(--status-danger)'
```

### 8.5 `app/ideation/page.js`

**Before**

```js
background: 'rgba(255,255,255,0.05)'
```

**After**

```js
background: 'var(--surface-interactive)'
```

### 8.6 `app/production/page.js`

**Before**

```js
borderColor: '#3b82f6'
```

**After**

```js
borderColor: 'var(--status-info)'
```

### 8.7 `app/pipeline/page.js`

**Before**

```js
color: '#fff'
```

**After**

```js
color: 'var(--text-primary)'
```

### 8.8 `app/login/page.js`

**Before**

```js
background: '#09090b'
```

**After**

```js
background: 'var(--canvas)'
```

Login tetap mengikuti preferensi tersimpan walaupun Sidebar tidak dirender.

## 9. Verifikasi

### 9.1 Pemeriksaan otomatis

1. `npm run build` harus sukses.
2. Audit literal warna pada `app/**/*.{js,css}`.
3. Allowlist hanya untuk warna platform resmi dan media preview yang memang tidak semantik.
4. Tidak ada selector `[style*=...]` baru.
5. Tidak ada `!important` baru tanpa justifikasi.

### 9.2 Matriks browser visual

Setiap route diuji pada:

- dark desktop;
- light desktop;
- dark mobile;
- light mobile;
- empty, loading, success, warning, error, disabled, modal, dan dropdown bila tersedia.

Route detail dinilai menggunakan data staging yang tersedia tanpa melakukan aksi produksi berbayar.

### 9.3 Kriteria penerimaan

- Semua 29 entri menu dan seluruh 36 file halaman dapat dibuka pada dua tema.
- Tidak ada teks putih di surface terang atau teks gelap di surface gelap.
- Tombol primary memiliki teks yang terbaca pada dua tema.
- Modal, dropdown, option, tooltip, dan table header mengikuti tema.
- Semua status memiliki label teks atau ikon.
- Theme preference bertahan setelah refresh dan navigasi.
- Tidak ada regression pada role/permission Sidebar.
- Tidak ada perubahan payload API atau proses campaign.

## 10. Strategi Rilis

1. Implementasi dikerjakan pada staging.
2. Build dan visual smoke test selesai terlebih dahulu.
3. Jalankan release patch non-interaktif sesuai SOP repository.
4. Verifikasi commit, changelog, tag, dan branch `main` pada remote.
5. Deploy staging saja setelah verifikasi; production hanya dengan instruksi eksplisit pengguna.

## Execution Task List

- [x] Audit route UI, literal warna, dan pola theme saat ini.
- [x] Buat dan tinjau mockup light/dark seluruh menu.
- [x] Tambahkan `app/theme.css` dan token semantik dark/light.
- [x] Tambahkan `ThemeToggle` reusable dan perbaiki bootstrap theme di layout.
- [x] Migrasikan Sidebar dan komponen global.
- [x] Migrasikan Overview dan seluruh halaman Planning.
- [x] Jalankan build serta smoke test checkpoint Planning.
- [x] Migrasikan seluruh halaman Workflow dan route detail.
- [x] Jalankan build serta smoke test checkpoint Workflow.
- [x] Migrasikan Publishing, Tools, Analytics, dan stylesheet Studio.
- [x] Jalankan build serta smoke test checkpoint Publishing/Tools.
- [x] Migrasikan System, Login, dan route Legacy/Internal.
- [x] Hapus override light-theme berbasis pencarian inline dari `globals.css`.
- [x] Jalankan audit literal warna dan selesaikan allowlist platform.
- [x] Uji seluruh route dalam matriks desktop/mobile × dark/light.
- [x] Jalankan build final dan pemeriksaan regression permission/navigation.
- [x] Perbarui changelog, release patch, commit, tag, dan push sesuai SOP.
- [x] Deploy ke environment dev Mac Mini dan verifikasi kesehatan; staging/production tidak disentuh.

### Follow-up harmonisasi light theme

- [x] Selaraskan tombol Nextcloud, Drive, dan Download pada kartu ContentFlow.
- [x] Selaraskan seluruh tombol aksi utama pada modal detail ContentFlow.
- [x] Ganti surface, header, row, role badge, dan brand badge tabel User Management dengan token tema.
- [x] Jalankan build lokal dan pemeriksaan visual light/dark.
- [x] Rilis patch dan deploy hanya ke Mac Mini dev.

### Follow-up ContentFlow visual consistency II

- [x] Samakan dimensi tombol Nextcloud dan Download.
- [x] Perpendek proporsi search box Video ID.
- [x] Tingkatkan kontras status TikTok, Facebook, Instagram, dan badge Not Published.
- [x] Selaraskan thumbnail serta badge Video ID dengan light theme.
- [x] Migrasikan surface utama Publishing Scheduler ke token light/dark.
- [x] Jalankan build, rilis patch, dan deploy hanya ke Mac Mini dev.

### Follow-up Content Planner detail dan Video ID search

- [x] Selaraskan action bar, informational panel, dan tabel detail Content Planner pada light/dark theme.
- [x] Selaraskan badge, row state, serta inline editor Content Planner.
- [x] Batasi search Video ID ContentFlow menjadi 260px dan pencarian scheduler maksimal 360px.
- [x] Jalankan build, rilis patch, dan deploy hanya ke Mac Mini dev.

### Follow-up field sizing dan header skedul produk

- [x] Batasi search Video ID dan filter produk ContentFlow menjadi 220px.
- [x] Perkecil kartu/form login agar field password proporsional.
- [x] Migrasikan header serta kartu Skedul Produk ke surface light/dark.
- [ ] Jalankan build, rilis patch, dan deploy hanya ke Mac Mini dev.
