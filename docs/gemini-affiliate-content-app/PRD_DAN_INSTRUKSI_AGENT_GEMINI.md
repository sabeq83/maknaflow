# PRD Affiliate Studio Lite

## 1. Ringkasan

Affiliate Studio Lite adalah aplikasi web satu menu untuk membantu kreator affiliate mengubah data produk menjadi paket konten menggunakan Gemini.

Aplikasi menggunakan model BYOK atau Bring Your Own Key. Setiap pengguna menghubungkan Gemini API key miliknya sendiri. Penggunaan dan biaya Gemini menjadi tanggung jawab pengguna, sedangkan pemilik produk menjual akses ke aplikasinya.

```text
Hubungkan Gemini → Lengkapi Brand → Tambah Produk → Buat Planner → Approve Ide
→ Generate Paket Produksi → Review → Jadwalkan → Published
```

## 2. Tujuan MVP

Pengguna dapat:

- login dengan Google;
- menyimpan Gemini API key miliknya dengan aman;
- membuat satu profil brand;
- menyimpan produk affiliate;
- menghasilkan dan menyetujui beberapa ide di Content Planner;
- mengubah ide yang disetujui menjadi paket produksi berisi storyboard, naskah voice-over, prompt T2I, prompt I2V, dan caption post;
- mengedit dan menyetujui paket produksi;
- menjadwalkan dan mencatat publikasi manual.

## 3. Struktur Aplikasi

Aplikasi hanya mempunyai satu menu utama: **Affiliate Studio**.

Di dalam workspace terdapat empat tab:

1. **Setup** untuk koneksi Gemini, profil brand, dan produk.
2. **Planner** untuk menghasilkan dan menyetujui ide konten.
3. **Production** untuk membuat paket produksi, review, status, dan jadwal.
4. **Overview** untuk ringkasan pekerjaan.

Tab adalah bagian dari satu workspace, bukan menu aplikasi terpisah. MVP ditujukan untuk kreator individu dan hanya mempunyai peran `owner`.

## 4. Fitur

### 4.1 Login

- Sign in with Google menggunakan Firebase Authentication.
- Pengguna yang belum login tidak dapat membuka Affiliate Studio.
- Semua data diisolasi berdasarkan `ownerId`.

### 4.2 Setup

#### Koneksi Gemini

Pengguna dapat:

- memasukkan Gemini API key miliknya;
- menguji koneksi;
- mengganti atau menghapus key;
- melihat status `Connected`, `Invalid`, atau `Not Connected`;
- melihat masked key, misalnya `AIza••••••7Kp2`.

API key asli tidak boleh ditampilkan kembali setelah disimpan.

#### Profil Brand

- nama brand;
- konteks brand;
- target audience;
- tone of voice;
- maksimal enam content pillars;
- default CTA;
- bahasa Indonesia atau English;
- platform utama;
- durasi default 15, 30, 45, atau 60 detik.

MVP hanya mendukung satu brand per pengguna.

#### Produk

Pengguna dapat menambah, mengedit, mencari, dan mengarsipkan produk.

| Field | Wajib | Aturan |
|---|---:|---|
| Nama | Ya | 2–120 karakter |
| Deskripsi | Ya | Minimal 10 karakter |
| Kategori | Ya | Maksimal 80 karakter |
| USP | Ya | Maksimal 500 karakter |
| Product truth | Ya | Maksimal 1000 karakter |
| Affiliate URL | Tidak | URL valid jika diisi |
| Foto | Tidak | Satu URL atau file |
| Status | Ya | `active` atau `archived` |

Produk bernilai `ready` jika seluruh field wajib valid. Hanya produk active dan ready yang dapat digunakan untuk generate.

### 4.3 Planner

Form hanya memuat:

- produk;
- platform: TikTok, Instagram Reels, YouTube Shorts, atau Facebook Reels;
- objective: soft sell, hard sell, education, atau engagement;
- jumlah ide: 3, 6, 9, atau 12;
- konteks promosi opsional;
- instruksi tambahan opsional, maksimal 500 karakter.

Konteks brand, audience, tone, CTA, bahasa, dan durasi diambil otomatis dari Setup.

Satu panggilan Gemini menghasilkan seluruh ide planner. Setiap ide hanya berisi:

- judul;
- content pillar;
- consumer problem;
- strategic angle;
- hook tiga detik;
- premis atau konsep konten;
- estimasi durasi;
- status `draft`, `review`, atau `approved`.

Pengguna dapat mengedit, lock, regenerate, dan approve ide. Hanya ide berstatus `approved` yang dapat masuk ke Production.

### 4.4 Production

Production mengubah satu ide planner yang sudah approved menjadi satu paket produksi lengkap.

#### Generate Paket Produksi

Gunakan arsitektur single-pass: satu panggilan Gemini harus sekaligus menghasilkan:

1. **Storyboard** per scene.
2. **Naskah voice-over** lengkap dan voice-over per scene.
3. **Prompt T2I** per scene untuk membuat keyframe atau gambar.
4. **Prompt I2V** per scene untuk menganimasikan keyframe.
5. **Caption post** yang mencakup caption, CTA, dan 5–10 hashtag.

Setiap scene minimal memuat:

- nomor scene;
- durasi dalam detik;
- tujuan scene;
- deskripsi visual;
- voice-over scene;
- prompt T2I;
- prompt I2V.

Total durasi scene harus sesuai dengan durasi target. Naskah voice-over lengkap harus konsisten dengan gabungan voice-over per scene.

Pengguna dapat mengedit setiap bagian, regenerate satu scene, regenerate satu field, atau regenerate seluruh paket. Regenerate tidak boleh mengubah ide planner sumber.

Production mempunyai dua tampilan atas data paket produksi yang sama.

#### Board

```text
Draft → Review → Ready → Scheduled → Published
```

#### Calendar

- Menampilkan konten yang mempunyai `scheduledAt`.
- Klik item membuka editor konten.

#### Editor Paket Produksi

Pengguna dapat:

- mengedit storyboard, voice-over, prompt T2I, prompt I2V, dan caption post;
- lock atau unlock paket;
- regenerate satu field, satu scene, atau seluruh paket;
- mengubah status;
- menentukan tanggal publikasi;
- menyimpan URL publikasi;
- menghapus konten dengan konfirmasi.

Paket locked tidak dapat diregenerate. Status `scheduled` wajib mempunyai tanggal. Perubahan dari `published` memerlukan konfirmasi.

### 4.5 Overview

Tampilkan jumlah produk ready, ide planner draft dan approved, paket produksi draft dan ready, Scheduled, Published, dan konten terjadwal hari ini.

Tidak ada analytics media sosial, GMV, atau komisi pada MVP.

## 5. Navigasi dan Tampilan

```text
Affiliate Studio                 [Gemini Status] [Account]
[Setup] [Planner] [Production] [Overview]
```

- Responsif untuk mobile dan desktop.
- Mendukung light dan dark mode.
- Menggunakan semantic CSS variables.
- Memiliki loading, empty, error, success, dan inline validation state.
- Seluruh aksi utama dapat digunakan dengan keyboard.
- Jika board memakai drag and drop, tombol perubahan status tetap wajib tersedia.

## 6. Penyimpanan Gemini API Key

### Prinsip

- Key adalah milik pengguna.
- Browser hanya mengirim key saat connect atau replace.
- Browser tidak memanggil Gemini secara langsung.
- Backend menguji, mengenkripsi, dan menyimpan key.
- Backend mendekripsi key hanya di memory ketika melakukan request Gemini.
- Plaintext key tidak boleh masuk log, Firestore, analytics, atau respons API.

### Enkripsi

Gunakan AES-256-GCM dengan IV acak. Master key aplikasi disimpan sebagai server-side secret:

```text
CREDENTIAL_ENCRYPTION_KEY
```

Master key tidak digunakan untuk request Gemini dan tidak disimpan di Firestore.

```ts
type GeminiCredential = {
  ownerId: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
  maskedKey: string;
  keyVersion: number;
  status: 'valid' | 'invalid';
  lastTestedAt: Timestamp;
  updatedAt: Timestamp;
};
```

Endpoint:

```text
PUT    /api/account/gemini-credential
GET    /api/account/gemini-credential
DELETE /api/account/gemini-credential
POST   /api/account/gemini-credential/test
```

Endpoint GET hanya mengembalikan status, masked key, dan waktu pengujian terakhir.

## 7. Model Data

```text
users/{userId}
brands/{userId}
users/{userId}/secrets/gemini
products/{productId}
generationBatches/{batchId}
plannerItems/{plannerItemId}
productionPackages/{packageId}
```

```ts
type Brand = {
  ownerId: string;
  name: string;
  context: string;
  targetAudience: string;
  toneOfVoice: string;
  contentPillars: string[];
  defaultCta: string;
  language: 'id' | 'en';
  defaultPlatform: 'tiktok' | 'instagram' | 'youtube' | 'facebook';
  defaultDurationSeconds: 15 | 30 | 45 | 60;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type Product = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  usp: string;
  productTruth: string;
  affiliateUrl?: string;
  photoUrl?: string;
  readiness: 'incomplete' | 'ready';
  status: 'active' | 'archived';
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type GenerationBatch = {
  id: string;
  ownerId: string;
  productId: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'facebook';
  objective: 'soft_sell' | 'hard_sell' | 'education' | 'engagement';
  ideaCount: 3 | 6 | 9 | 12;
  promptVersion: string;
  status: 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Timestamp;
};

type PlannerItem = {
  id: string;
  ownerId: string;
  batchId: string;
  productId: string;
  sequence: number;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'facebook';
  objective: 'soft_sell' | 'hard_sell' | 'education' | 'engagement';
  title: string;
  pillar: string;
  consumerProblem: string;
  strategicAngle: string;
  hook: string;
  concept: string;
  estimatedDurationSeconds: number;
  status: 'draft' | 'review' | 'approved';
  isLocked: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type ProductionScene = {
  sceneNumber: number;
  durationSeconds: number;
  purpose: string;
  visualDescription: string;
  voiceOver: string;
  t2iPrompt: string;
  i2vPrompt: string;
};

type ProductionPackage = {
  id: string;
  ownerId: string;
  plannerItemId: string;
  productId: string;
  scenes: ProductionScene[];
  fullVoiceOver: string;
  postCaption: string;
  postCta: string;
  hashtags: string[];
  status: 'draft' | 'review' | 'ready' | 'scheduled' | 'published';
  isLocked: boolean;
  scheduledAt?: Timestamp;
  publishedAt?: Timestamp;
  publishedUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

## 8. Kontrak Gemini

Terdapat dua kontrak Gemini yang terpisah.

### 8.1 Kontrak Planner

Planner menerima profil brand, produk, platform, objective, jumlah ide, konteks promosi, dan instruksi tambahan.

Aturan:

- hanya gunakan klaim dari deskripsi, USP, dan product truth;
- jangan mengarang harga, diskon, sertifikasi, manfaat medis, testimonial, atau garansi;
- jika affiliate URL kosong, CTA tidak boleh menyatakan link pembelian tersedia;
- variasikan hook dan angle antaride;
- gunakan bahasa brand;
- keluarkan structured JSON, bukan Markdown.

```json
{
  "ideas": [
    {
      "sequence": 1,
      "title": "string",
      "pillar": "string",
      "consumerProblem": "string",
      "strategicAngle": "string",
      "hook": "string",
      "concept": "string",
      "estimatedDurationSeconds": 30
    }
  ]
}
```

Server memvalidasi jumlah ide, field wajib, sequence, durasi, dan content pillar. Jika gagal, lakukan maksimal satu repair call.

### 8.2 Kontrak Paket Produksi

Input paket produksi adalah satu `PlannerItem` approved beserta brand dan product truth. Gunakan satu panggilan Gemini untuk menghasilkan seluruh paket, bukan panggilan terpisah untuk storyboard, voice-over, T2I, I2V, dan caption.

```json
{
  "scenes": [
    {
      "sceneNumber": 1,
      "durationSeconds": 5,
      "purpose": "string",
      "visualDescription": "string",
      "voiceOver": "string",
      "t2iPrompt": "string",
      "i2vPrompt": "string"
    }
  ],
  "fullVoiceOver": "string",
  "postCaption": "string",
  "postCta": "string",
  "hashtags": ["string"]
}
```

Aturan tambahan:

- prompt T2I menjelaskan subjek, produk, komposisi, kamera, pencahayaan, latar, dan gaya visual untuk satu keyframe;
- prompt I2V menjelaskan gerakan subjek, gerakan kamera, perubahan scene, tempo, serta elemen yang harus tetap konsisten;
- prompt T2I dan I2V tidak boleh saling bertentangan;
- semua scene harus menjaga identitas dan bentuk produk;
- jumlah durasi scene harus sama dengan target durasi;
- caption post harus sesuai platform dan tidak menambah klaim produk;
- jika validasi gagal, lakukan maksimal satu repair call.

## 9. Keamanan

- Semua request memerlukan Firebase Authentication.
- Semua operasi memverifikasi `ownerId`.
- Firestore Security Rules mencegah akses lintas pengguna.
- Path credential tidak dapat dibaca langsung oleh client.
- Jangan mengirim encrypted credential ke browser.
- Jangan mencatat request body endpoint credential.
- Batasi connect, test, generate, dan regenerate.
- Validasi URL, panjang teks, MIME type, dan ukuran file.
- Jangan render HTML dari output Gemini.
- Aktifkan Firebase App Check jika tersedia.

## 10. Acceptance Criteria

- Login Google berfungsi dan data antaruser terisolasi.
- API key dapat diuji, disimpan terenkripsi, diganti, dan dihapus.
- API key asli tidak muncul kembali di browser, log, atau Firestore plaintext.
- Brand dapat disimpan dan dimuat ulang.
- Produk dapat dibuat, diedit, dicari, dan diarsipkan.
- Produk incomplete tidak tersedia di Planner.
- Planner menghasilkan tepat 3, 6, 9, atau 12 ide.
- Hanya ide approved yang dapat dibuatkan paket produksi.
- Satu generate Production menghasilkan storyboard, full voice-over, voice-over per scene, prompt T2I per scene, prompt I2V per scene, caption, CTA, dan hashtag.
- Total durasi scene sama dengan target durasi.
- Ide planner dan paket produksi tetap tersedia setelah reload.
- Paket dapat diedit, dikunci, diregenerate, dan diubah status.
- Paket locked tidak dapat diregenerate.
- Scheduled tanpa tanggal ditolak.
- Board, calendar, dan overview memakai `productionPackages` yang sama.
- Type check, build, dan automated tests lulus.

## 11. Di Luar MVP

- lebih dari satu brand per pengguna;
- recipe dan brand editorial campaign;
- scraper marketplace;
- import atau export;
- rendering video, image generation, dan voice synthesis;
- auto publishing;
- analytics, GMV, dan komisi;
- team role dan approval bertingkat.

---

# Instruksi untuk Agent Gemini AI Studio

```text
Bangun aplikasi web full-stack bernama Affiliate Studio Lite berdasarkan PRD ini.

BATASAN
- Hanya ada satu menu utama: Affiliate Studio.
- Di dalamnya hanya ada tab Setup, Planner, Production, dan Overview.
- Jangan menambahkan fitur atau integrasi di luar PRD.
- MVP hanya mendukung satu brand dan satu owner per akun.

STACK
- React dan TypeScript strict mode.
- Runtime Node.js server.
- Firebase Authentication dengan Google Sign-In.
- Cloud Firestore dan Firebase Storage untuk foto jika diperlukan.
- SDK resmi @google/genai.
- Pisahkan UI, validation, data access, encryption, dan Gemini service.

BYOK GEMINI
- Setiap pengguna memasukkan Gemini API key miliknya sendiri.
- Jangan gunakan satu GEMINI_API_KEY aplikasi untuk request pengguna.
- Browser tidak boleh memanggil Gemini secara langsung.
- Kirim key melalui HTTPS ke backend hanya saat connect atau replace.
- Test key di backend sebelum menyimpan.
- Enkripsi dengan AES-256-GCM dan IV acak.
- Ambil master key dari server secret CREDENTIAL_ENCRYPTION_KEY.
- Simpan encryptedKey, iv, authTag, maskedKey, keyVersion, dan status.
- Jangan simpan atau log plaintext key.
- Jangan kirim key asli atau encrypted credential ke browser.
- Dekripsi hanya di memory saat request Gemini.
- Sediakan connect, test, replace, dan delete credential.

FITUR
- Setup: koneksi Gemini, satu profil brand, dan product library.
- Planner: produk ready, platform, objective, jumlah ide, konteks promosi, dan instruksi tambahan.
- Satu request Planner menghasilkan 3, 6, 9, atau 12 ide memakai structured output.
- Ide planner harus di-approve sebelum masuk Production.
- Production: satu request Gemini menghasilkan satu paket lengkap berisi storyboard, full voice-over, voice-over per scene, prompt T2I per scene, prompt I2V per scene, caption, CTA, dan hashtag.
- Jangan membuat call terpisah untuk setiap bagian paket produksi; gunakan single-pass generation.
- Production juga menyediakan board, calendar, editor, lock, regenerate, status, schedule, published URL, dan delete.
- Overview: counter produk, ide, paket produksi, dan jadwal hari ini.

ATURAN GEMINI
- Ground seluruh klaim pada description, USP, dan productTruth.
- Jangan mengarang harga, diskon, sertifikasi, manfaat medis, testimonial, atau garansi.
- Jika affiliateUrl kosong, jangan membuat CTA seolah link pembelian tersedia.
- Gunakan structured JSON schema Planner dan Production sesuai PRD.
- Pastikan total durasi seluruh scene sama dengan target durasi.
- Pastikan prompt T2I dan I2V konsisten dengan visual scene dan bentuk produk.
- Validasi respons di server dan lakukan maksimal satu repair call.
- Jangan menyimpan chain of thought.

KEAMANAN
- Verifikasi Firebase session dan ownerId pada setiap operasi.
- Buat Firestore Security Rules yang menolak akses lintas pengguna.
- Path credential tidak boleh dibaca langsung oleh client.
- Tambahkan rate limit untuk connect, test, generate, dan regenerate.
- Jangan render HTML dari output AI.
- Gunakan server timestamps dan validasi input server-side.

UI
- Satu app shell responsif dengan header dan empat tab workspace.
- Gunakan semantic CSS variables dan light/dark mode.
- Sediakan loading, empty, error, success, inline validation, dan confirmation state.
- Pastikan keyboard navigation dan visible focus.

URUTAN IMPLEMENTASI
1. Authentication, app shell, Firestore rules, dan domain types.
2. BYOK encryption serta connect, test, replace, dan delete.
3. Brand dan product CRUD beserta readiness validator.
4. Planner generation dengan structured output.
5. Production package single-pass, editor, board, calendar, dan status validation.
6. Overview, responsive polish, tests, dan README.

VERIFIKASI
- Test encryption round trip tanpa mencetak key.
- Test credential user A tidak dapat dipakai user B.
- Test product readiness dan status transitions.
- Test malformed Planner dan Production output serta repair limit.
- Test jumlah durasi scene dan kelengkapan storyboard, voice-over, T2I, I2V, dan caption.
- Test login → connect key → setup brand → add product → generate 6 ideas → approve ide → generate paket produksi → review → schedule → published.
- Jalankan type check, build, dan tests. Perbaiki semua error sebelum selesai.

Mulai dengan membaca seluruh PRD. Tampilkan rencana file yang ringkas, lalu implementasikan sesuai urutan. Jangan memperluas scope.
```

## Referensi

- https://ai.google.dev/gemini-api/docs/api-key
- https://ai.google.dev/gemini-api/docs/aistudio-fullstack
- https://ai.google.dev/gemini-api/docs/structured-output
- https://firebase.google.com/docs/firestore/security/overview
