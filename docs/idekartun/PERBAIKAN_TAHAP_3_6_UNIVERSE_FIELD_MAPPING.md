# Perbaikan Tahap 3.6 — Universe Profile Field Mapping

## Instruksi untuk Antigravity Agent

Perbaiki hanya bug mapping data **Universe Profile → Universe Manager UI** dan **Universe Manager UI → API/database**.

Jangan menambah fitur baru, mengubah schema database, mengubah isi preset, atau melakukan deployment Production.

---

## Masalah Terverifikasi

Preset sudah memiliki nilai:

```text
default_visual_style
default_aspect_ratio
default_scene_count
default_scene_duration
default_story_template
default_pillars_json
```

Endpoint instantiate juga sudah menyimpan field tersebut ke `universe_profiles`.

Namun halaman `app/settings/universes/page.js` membaca dan menulis alias UI:

```text
visual_style
aspect_ratio
scene_count
scene_duration
story_template
pillars
```

Akibatnya, setelah universe dibuat dari preset:

- field **Visual Style** pada Edit Universe kosong;
- nilai scene/aspect/story template dapat jatuh ke fallback UI;
- tabel universe dapat menampilkan nilai kosong;
- penyimpanan ulang berisiko tidak memperbarui kolom canonical database.

Root cause adalah mismatch nama field, bukan preset yang tidak memiliki Visual Style.

---

## Target Perbaikan

Setelah preset di-instantiate:

1. Edit Universe menampilkan Visual Style dari preset.
2. Aspect Ratio, Scene Count, Scene Duration, Story Template, dan Pillars juga tampil benar.
3. Menyimpan form Edit memperbarui kolom canonical database.
4. Start from Blank tetap bekerja.
5. Tidak ada perubahan schema.

---

## Kontrak Field Canonical

Gunakan field database/API berikut sebagai sumber kebenaran:

| Field UI | Field canonical database/API |
|---|---|
| `visual_style` | `default_visual_style` |
| `aspect_ratio` | `default_aspect_ratio` |
| `scene_count` | `default_scene_count` |
| `scene_duration` | `default_scene_duration` |
| `story_template` | `default_story_template` |
| `pillars` | `default_pillars_json` |

Pilih satu boundary mapping yang eksplisit. Rekomendasi:

- state form boleh tetap memakai nama ramah UI;
- map response API canonical ke state form melalui satu helper;
- map state form ke payload canonical melalui satu helper;
- jangan menaruh fallback mapping berulang di JSX.

Contoh nama helper:

```js
mapUniverseRecordToForm(profile)
mapUniverseFormToPayload(form)
```

Helper harus menangani JSONB yang mungkin diterima sebagai array/object atau string JSON.

---

## Perubahan yang Wajib

### 1. Mapping API response ke form

Saat tombol **Edit** diklik, gunakan:

```text
default_visual_style  → visual_style
default_aspect_ratio  → aspect_ratio
default_scene_count   → scene_count
default_scene_duration → scene_duration
default_story_template → story_template
default_pillars_json  → pillars
```

Untuk backward compatibility, alias lama boleh menjadi fallback kedua, bukan sumber utama:

```js
visual_style: profile.default_visual_style ?? profile.visual_style ?? ''
```

Terapkan pola yang sama pada field terkait.

### 2. Mapping form ke payload API

Sebelum POST/PUT Universe Profile, kirim field canonical:

```text
default_visual_style
default_aspect_ratio
default_scene_count
default_scene_duration
default_story_template
default_pillars_json
```

Pastikan angka dikonversi ke number dan pillars dikirim dalam format yang diterima API/database.

### 3. Tampilan tabel Universe

Perbaiki kolom tabel:

```text
Visual Style → default_visual_style
Scenes       → default_scene_count
```

Alias lama boleh menjadi fallback untuk record legacy.

### 4. Required validation

Field Visual Style tetap required.

Jika record preset/database tidak memiliki Visual Style, tampilkan error yang jelas. Jangan diam-diam menyimpan string kosong.

Default hanya boleh dipakai untuk record legacy yang memang belum memiliki nilai:

```text
cinematic 3D claymation, handcrafted matte clay textures,
soft cinematic lighting, consistent character proportions
```

Jangan mengganti Visual Style valid dari preset dengan default generic.

### 5. Preset preview

Tampilkan Visual Style pada preview preset sebelum user menekan **Create Universe**.

Pastikan endpoint list/detail preset mengirim nilai visual style yang aman untuk UI, misalnya melalui field ringkasan `visual_style`, atau UI membaca `profile.default_visual_style` dari endpoint detail. Jangan mengekspos data sensitif atau filesystem path.

---

## Audit Field Terkait

Audit seluruh field Universe Profile pada tiga boundary:

```text
Preset registry
    ↓
Instantiate API / database
    ↓
Universe Profiles API
    ↓
Universe Manager form
    ↓
PUT/POST payload
```

Pastikan tidak ada mismatch lain antara nama canonical dan alias UI.

Jangan memperluas audit ke Character atau Location Library kecuali ditemukan bug mapping yang langsung disebabkan pola yang sama.

---

## Verifikasi Wajib

1. Instantiate preset PawVille.
2. Buka Edit Universe.
3. Visual Style harus sama persis dengan `preset.profile.default_visual_style`.
4. Ulangi pemeriksaan pada lima preset lainnya.
5. Aspect Ratio tampil sesuai preset.
6. Scene Count tampil sesuai preset.
7. Scene Duration tampil sesuai preset.
8. Story Template tampil sesuai preset.
9. Pillars tampil sesuai preset.
10. Edit Visual Style, simpan, refresh halaman, lalu pastikan nilai baru tetap tersimpan.
11. Edit scene settings, simpan, refresh, lalu pastikan nilai tetap tersimpan.
12. Start from Blank tetap dapat dibuat dan diedit.
13. Record legacy tetap dapat dibuka.
14. Test Tahap 3, 3.5, dan 3.6 tetap lulus.
15. Build verification berhasil.

Tambahkan regression test khusus mapping field agar bug ini tidak kembali.

---

## Execution Task List

- [ ] Audit kontrak response Universe Profiles API.
- [ ] Dokumentasikan Code Sebelum dan Code Sesudah.
- [ ] Buat helper API-record-to-form.
- [ ] Buat helper form-to-API-payload.
- [ ] Perbaiki mapping Edit Universe.
- [ ] Perbaiki payload Create/Update Universe.
- [ ] Perbaiki kolom Visual Style dan Scenes pada tabel.
- [ ] Tambahkan Visual Style pada preview preset.
- [ ] Tambahkan required validation dan error yang jelas.
- [ ] Tambahkan regression test untuk enam field canonical.
- [ ] Jalankan test Tahap 3, 3.5, dan 3.6.
- [ ] Jalankan build verification.
- [ ] Perbarui SOT jika kontrak UI/API didokumentasikan.
- [ ] Jalankan prosedur rilis repository sesuai SOP.

---

## Laporan Akhir

Laporkan:

```text
- Root cause
- File yang diubah
- Helper mapping yang dibuat
- Field yang diperbaiki
- Hasil tes enam preset
- Hasil persistence setelah refresh
- Hasil build
- Versi/tag rilis
```

Berhenti setelah bug mapping selesai diperbaiki, diuji, didokumentasikan, dan dirilis. Jangan melanjutkan ke fitur lain.

