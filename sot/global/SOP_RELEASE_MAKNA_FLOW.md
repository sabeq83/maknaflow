# 📜 Standard Operating Procedure (SOP): Update Versi & Automatic Git Push — MAKNA Flow

**Target Repository**: `https://github.com/sabeq83/maknaflow.git`  
**Nama Projek**: `maknaflow`  
**Tujuan**: Standar Operasional Prosedur (SOP) untuk memperbarui versi aplikasi, mencatat riwayat pada `sot/global/changelog.md`, membuat git tag versi, dan melakukan `git push` otomatis ke GitHub remote.

---

## 📌 1. Prinsip Utama Rilis Pasca-Update

Setiap kali Anda (AI Agent / Developer) selesai melakukan perbaikan bug, refaktorisasi, atau penambahan fitur di `maknaflow` dan verifikasi berhasil:
- **WAJIB** menjalankan skrip rilis otomatis non-interaktif tanpa perlu menunggu perintah terpisah.

---

## ⚙️ 2. Perintah Rilis Utama (Sangat Direkomendasikan)

Gunakan perintah rilis non-interaktif bawaan projek untuk melakukan update versi, pembaruan changelog, git commit, git tagging, dan push otomatis ke GitHub:

```bash
npm run release-non-interactive -- --type patch --title "Judul Rilis Singkat" --points "Poin perubahan 1|Poin perubahan 2"
```

### Parameter yang Didukung:
- `--type`: `patch` (0.0.X - Perbaikan Bug/Minor Refactor), `minor` (0.X.0 - Fitur Baru/Phase Completion), atau `major` (X.0.0 - Major Architecture Overhaul). Default: `patch`.
- `--title`: Judul rilis singkat yang deskriptif.
- `--points`: Poin-poin rincian perubahan yang dipisahkan oleh tanda pipa (`|`).

---

## 💡 3. Contoh Penggunaan Perintah Rilis Produksi

### Contoh Rilis Fitur / Phase Release (`minor`):
```bash
npm run release-non-interactive -- --type minor --title "Initial Release 3-Node Architecture" --points "Implementasi Node Role Management (gateway, worker, storage)|Central DB Adapter & Media Storage Vault|Cluster Health Verification Tool"
```

### Contoh Rilis Bugfix / Patch Release (`patch`):
```bash
npm run release-non-interactive -- --type patch --title "Fix Storage Vault Path Resolution" --points "Memperbaiki penanganan path berkas video pada Node 3|Mengoptimalkan polling queue pada Node 2 Worker"
```

---

## 📝 4. Prosedur Manual (Step-by-Step Checkout Flow)

Jika skrip rilis non-interaktif tidak digunakan, ikuti 5 langkah manual berikut:

### Langkah 1: Perbarui Versi di `package.json`
Perbarui bidang `"version"` di `package.json` sesuai semantic versioning (`v1.0.0` -> `v1.0.1`).

### Langkah 2: Catat Perubahan pada `sot/global/changelog.md`
Tambahkan entri rilis terbaru pada bagian teratas `sot/global/changelog.md`:
```markdown
## [v1.0.1] - YYYY-MM-DD
### 🚀 Perubahan
- Judul Rilis: [Judul]
  - Poin rincian 1
  - Poin rincian 2
```

### Langkah 3: Git Add & Commit
```bash
git add .
git commit -m "release: v1.0.1 — Judul Rilis Singkat"
```

### Langkah 4: Buat Tag Git Versi
```bash
git tag -a v1.0.1 -m "v1.0.1 — Judul Rilis Singkat"
```

### Langkah 5: Push Commit & Tags ke GitHub Remote
```bash
git push origin main --tags
```

---

## 🧪 5. Checklist Verifikasi Pasca-Rilis
- [ ] Versi di `package.json` dan `sot/global/changelog.md` sudah selaras.
- [ ] Git commit dan Tag rilis (`vX.Y.Z`) telah berhasil terunggah di repository `https://github.com/sabeq83/maknaflow.git`.
- [ ] Skrip `node scripts/test-cluster-health.js` berjalan hijau (Clean Pass).

---
*SOP ini resmi berlaku untuk projek `maknaflow`.*
