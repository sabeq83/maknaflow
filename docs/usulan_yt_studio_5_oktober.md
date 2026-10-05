# Usulan Perbaikan UX: Character & Voice Registry YouTube Studio (5 Oktober 2026)

**Dokumen Rencana & Rekomendasi Fitur:** `docs/usulan_yt_studio_5_oktober.md`  
**Tanggal:** 5 Oktober 2026  
**Status:** Disimpan untuk Implementasi Tahap Berikutnya  
**Target Komponen:** YouTube Studio Channel Voice Registry (`app/youtube-studio/components/ChannelAudioRegistry.js`)

---

## 1. Latar Belakang & Permasalahan

Pada antarmuka **Audio, Characters & Voices Registry** di menu YouTube Studio saat ini:
1. **Beban Input Ganda (`Speaker ID` vs `Display Name`)**:
   - Pengguna dipaksa memasukkan `Speaker ID` (harus format huruf kecil/snake_case) dan `Display Name` secara terpisah, yang membingungkan dan tidak intuitif.
2. **Ketiadaan Sinkronisasi Otomatis dengan Universe Manager**:
   - Karakter yang sudah dibuat di Universe Manager (seperti Kio dan BIMO pada universe *Kio Wonders*) tidak otomatis tersedia. Pengguna harus mengetik ulang nama dan deskripsi karakter secara manual.
3. **Konfigurasi Suara Buta (`Provider Persona ID`)**:
   - Kolom pilihan suara TTS saat ini hanya berupa kotak input teks kosong tanpa daftar suara siap pakai, sehingga pengguna harus menghafal kode internal suara seperti `id-ID-Wavenet-A` atau `id-ID-Standard-B`.

---

## 2. Rencana Solusi & Penyederhanaan UX

### A. Tombol 1-Klik: "Impor Karakter dari Universe"
- Jika Channel YouTube terhubung ke suatu Universe (misal: *Kio Wonders* atau *WonderQuest Kids*), sistem akan menampilkan tombol cerdas:
  - `[ 📥 Impor Karakter dari Universe Kio Wonders ]`
- Begitu tombol diklik, seluruh karakter resmi di Universe tersebut (Kio, BIMO, dll.) otomatis didaftarkan sebagai Speaker beserta atribut dan deskripsinya tanpa perlu input manual.

### B. Otomatisasi `Speaker ID` (Hapus Input Manual)
- Input teknis `Speaker ID` dihilangkan dari tampilan form.
- Pengguna hanya cukup mengisi **1 Kolom: "Nama Pembicara / Karakter"** (misal: `Kio` atau `Profesor Dino`).
- Sistem secara otomatis membuat `speaker_id` di belakang layar (contoh: `kio` atau `profesor_dino`) sesuai kaidah sistem.

### C. Dropdown Katalog Suara Populer + Tombol Tes Audio
- Kotak teks `Provider Persona ID` diganti dengan **Dropdown Suara Bahasa Indonesia & Inggris** yang ramah pengguna:
  - *Indonesia - Pria Dewasa Ramah (Google Wavenet-B)*
  - *Indonesia - Wanita Lembut & Jelas (Google Wavenet-A)*
  - *Indonesia - Anak-anak / Karakter Ceria (Google Neural2)*
  - *English - Male Storyteller (Google Wavenet-D)*
- Disertai tombol `[ 🔊 Putar Contoh Suara ]` untuk mendengarkan sampel suara sebelum memilih.

### D. Tombol Cepat: "Tambah Narator Default"
- Tombol 1-klik untuk menambahkan Voice Narator Standar untuk channel bertipe voice-over tunggal tanpa karakter dialog.

---

## 3. Konsep Tampilan Baru (Visual Mockup)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 🎙️ Audio, Characters & Voice Registry                                                  │
│ Channel-level source of truth for every Series and Episode                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  [ 📥 Impor Karakter dari Universe Kio Wonders ]  <-- 1-KLIK LANGSUNG MASUK KIO & BIMO  │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  DAFTAR KARAKTER & PEMBICARA AKTIF                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 👦 Kio (Character)                                                                │  │
│  │ Suara: [ 🔊 Indonesia - Anak Ceria (Wavenet-B) ▼ ]  Speed: [ 1.0x ]  [ 💾 Simpan ]│  │
│  ├───────────────────────────────────────────────────────────────────────────────────┤  │
│  │ 🤖 BIMO (Companion)                                                               │  │
│  │ Suara: [ 🔊 Robot / Karakter Khusus (Custom)   ▼ ]  Speed: [ 1.0x ]  [ 💾 Simpan ]│  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│  TAMBAH PEMBICARA BARU                                                                  │
│  Nama Pembicara  : [ Kio Penjelajah                  ]                                  │
│  Tipe            : [ Karakter ▼ ]                                                       │
│  Pilihan Suara   : [ 🔊 Indonesia - Pria Ramah (Wavenet-B) ▼ ] [ 🔊 Test Dengar ]       │
│  Karakter Suara  : [ Suara anak laki-laki usia 8 tahun penuh semangat              ]    │
│                                                                                         │
│  [ ➕ Tambah Pembicara ]   [ 🎙️ Tambah Narator Default ]                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Rencana File yang Akan Dimodifikasi Saat Implementasi

1. **Frontend Component**:
   - `app/youtube-studio/components/ChannelAudioRegistry.js`:
     - Menambahkan fungsi `importUniverseCharacters()`.
     - Menghapus input `Speaker ID` dan menggantinya dengan auto-slug generator.
     - Menyediakan katalog suara TTS Indonesia & Inggris dalam bentuk Select Dropdown.
2. **Backend / API**:
   - `app/api/v2/youtube-studio/channels/[id]/voice-registry/route.js`:
     - Menyertakan daftar karakter dari linked universe saat query channel audio registry.
   - `app/api/v2/youtube-studio/channels/[id]/speakers/import-universe/route.js` *(Baru)*:
     - Endpoint batch import karakter universe ke channel speakers.
3. **Daftar Preset Suara**:
   - `lib/youtube-studio-voice-catalog.js` *(Baru)*:
     - Definisi label suara ramah pengguna untuk Google TTS dan MiniMax.

---

*Dokumen ini telah disimpan dan siap digunakan sebagai panduan implementasi ketika pengerjaan fitur ini dimulai.*
