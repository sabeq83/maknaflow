<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SOP Rilis & Auto Git Sync MAKNA Flow

**Target Repository**: `https://github.com/sabeq83/maknaflow.git`

Setiap kali Anda selesai mengimplementasikan fitur, melakukan refaktorisasi, atau memperbaiki bug (setelah tahap verifikasi berhasil), Anda **WAJIB** melakukan prosedur rilis dan sinkronisasi berikut tanpa perlu menunggu instruksi terpisah dari pengguna:

1. **Jalankan Perintah Rilis Tanpa Interaktif (Sangat Direkomendasikan)**:
   - Gunakan perintah rilis non-interaktif untuk mengupdate versi, changelog, commit, tag, dan push otomatis:
     ```bash
     npm run release-non-interactive -- --type patch --title "Judul Rilis Singkat" --points "Poin perubahan 1|Poin perubahan 2"
     ```
   - Parameter yang didukung:
     - `--type`: `patch` (default), `minor`, atau `major`
     - `--title`: Judul rilis singkat
     - `--points`: Poin-poin perubahan dipisahkan oleh tanda pipa (`|`)

2. **Checklist Rilis**:
   - Pastikan versi yang dirilis selaras dengan riwayat versi terbaru pada [sot/global/changelog.md](file:///Users/sabeqmmursyid/_maknaflow/sot/global/changelog.md).
   - Verifikasi bahwa tag rilis (`vX.Y.Z`) dan branch `main` telah terunggah dengan sempurna ke remote repository `https://github.com/sabeq83/maknaflow.git`.

# SOP Inspeksi Multi-Node Server (3-Node Topology)

Gunakan prosedur ini untuk menguji kesehatan atau menginspeksi server 3-node MAKNA Flow:

1. **Konfigurasi SSH & Port**:
   - Node 1 (Ubuntu Gateway): `ssh makna-ui` (`100.65.62.63`)
   - Node 2 (Windows Worker): `ssh vibe-server` (`100.117.59.92`, Port 2222)
   - Node 3 (Storage & DB): `ssh makna-db` (`100.78.186.123`)

2. **Uji Kesehatan Cluster Real-Time**:
   ```bash
   node scripts/test-cluster-health.js
   ```


# SOP Deployment Node 1 (Single-Pass & Zero-Spam Mode)

Node 1 (`ssh makna-ui`) menggunakan spesifikasi **Intel Core i3 dengan RAM 16GB**. Kompilasi Next.js 16 (`npm run build`) memerlukan waktu **90 - 120 detik**.

Aturan Wajib Deployment Node 1:
1. **Gunakan Perintah Deployment Single-Pass 1-Call**:
   - Jalankan `npm run deploy:node1` (atau `node scripts/deploy-node1.js`).
   - Skrip ini mengeksekusi git sync, build, dan restart server dalam **1x panggilan SSH tunggal**.
2. **DILARANG KERAS Polling SSH Loop**:
   - Agen **DILARANG KERAS** melakukan polling SSH berulang-ulang (`ssh ... ps aux | grep 'next build'`) setiap 10-15 detik yang memicu pop-up persetujuan berulang.
3. **Timer Tunggu 120 Detik**:
   - Pasang `schedule` timer 120 detik (2 menit) tanpa melakukan pemanggilan SSH di antaranya.

# Strategic Campaign Engine Architecture Rule

- Strategic Campaign di MAKNA sepenuhnya menggunakan **Single-Pass Engine (1-Call Architecture)**. Dalam 1x call API ke Gemini AI, sistem sekaligus menghasilkan Storyboard, Naskah Voice-Over, 10 Parameter Video DNA, dan Social Media Package (Caption, Hashtags, CTA).
- Pemanggilan **Call 2 secara terpisah SUDAH TIDAK DIGUNAKAN (DEPRECATED)** dalam pipeline eksekusi otomatis (`processStrategicGenerator`).

# SOP Kontrol Eksekusi Rencana (Real-Time Implementation Task List)

Setiap kali Anda menyusun **Implementation Plan** (`implementation_plan.md`), Anda **WAJIB** menerapkan aturan kontrol berikut:

1. **Seksi Wajib `## Execution Task List`**:
   - Sertakan seksi `## Execution Task List` di dalam `implementation_plan.md` yang memuat tahapan pengerjaan secara kronologis dalam bentuk Markdown Checkbox (`- [ ]`).
2. **Pembaruan Progress Real-Time**:
   - Selama tahap eksekusi berlangsung, setelah menyelesaikan setiap tahapan task, Anda **WAJIB memperbarui** file `implementation_plan.md` dengan mengubah `- [ ]` menjadi **`- [x]`** agar pengguna dapat memantau progres pengerjaan secara transparan dan real-time.
3. **Format Sebelum & Sesudah Kode (Before & After Code Snippets)**:
   - Setiap kali menyusun **Implementation Plan** (`implementation_plan.md`), Anda **WAJIB** menyertakan potongan kode awal sebelum diedit (**Code Sebelum (Current/Before)**) dan potongan kode usulan setelah diedit (**Code Sesudah (Proposed/After)**) untuk setiap file yang akan dimodifikasi.
