# Instruksi Antigravity — Remediasi Temuan Run-Once v2.29.6

Perbaiki implementasi Hermes Run-Once berdasarkan hasil pemeriksaan Codex. Jangan menganggap pekerjaan selesai hanya karena unit test dan build lulus.

Gunakan rencana utama:

`plans/hermes-integration/run-once-implementation-plan.md`

## Kondisi Saat Ini

- Source/release lokal: MAKNA `v2.29.6`, skill `v1.1.0`.
- Mac Mini Dev masih menjalankan MAKNA `v2.29.5`, skill `v1.0.0`.
- Seluruh `Execution Task List` pada implementation plan masih kosong.
- Unit test dan build lulus, tetapi belum ada DB integration, concurrency, worker, callback, atau `draft_only` end-to-end proof.

## Temuan yang Wajib Diperbaiki

### 1. Query Brand Profile tidak valid

`lib/content-run-service.js` memakai:

```sql
SELECT id, brand_name, status FROM brand_profiles
```

Audit schema PostgreSQL Dev yang nyata. Jika `brand_profiles.status` tidak ada, hapus referensi tersebut atau gunakan field valid. Tambahkan integration test yang mengeksekusi query terhadap schema Dev/test yang representatif. Jangan hanya mock string SQL.

### 2. Feature flag fail-open

Kode saat ini hanya disabled bila nilai persis `false`. Ubah menjadi fail-closed:

```js
if (process.env.ENABLE_HERMES_RUN_ONCE !== 'true') {
  throw new ContentRunError(...RUN_ONCE_DISABLED...);
}
```

Buktikan tiga kondisi:

- absent → disabled;
- `false` → disabled;
- `true` → enabled.

### 3. Idempotency dan binding belum atomic

Saat ini lookup/create Brand–Product binding dan idempotency check terjadi sebelum transaction.

Perbaiki agar:

1. canonical request hash dibuat sebelum mutation;
2. transaction mengambil advisory lock dari `tenant_id + idempotency_key` atau memakai pola atomic lain yang setara;
3. replay/conflict diperiksa di dalam transaction;
4. resolve/upsert Brand–Product binding terjadi di transaction yang sama;
5. `INSERT ... ON CONFLICT ... RETURNING id` selalu mengembalikan ID binding aktual;
6. schedule, content run, agent run/audit dibuat atomic;
7. failure meninggalkan nol schedule/run/binding parsial yang dibuat oleh request tersebut.

Tambahkan test dua request paralel:

- same key + same body → satu run, replay sukses;
- same key + different body → satu run dan satu response 409;
- dua key dengan product-binding baru → keduanya memakai binding aktual yang sama tanpa dangling ID.

### 4. Preset compatibility belum divalidasi

`resolveOperatorPreset()` dipanggil tetapi hasilnya tidak digunakan.

Gunakan helper kompatibilitas resmi (`isOperatorPresetCompatible` atau sumber truth yang setara) dan tolak preset yang bukan `product_campaign` dengan:

```text
PRESET_CAMPAIGN_KIND_MISMATCH
```

Tambahkan positive test untuk `dapurbotani_kampanye_produk_4_klip` berdasarkan preset tenant Dev dan negative test untuk preset editorial.

Pastikan custom preset tenant sudah di-hydrate sebelum resolve. Jangan hanya mengandalkan cache kosong proses baru.

### 5. Lifecycle Agent Run berpotensi race

Saat enqueue, `agent_automation_runs` sudah dibuat `scheduled`, sementara Content Automation Worker belum capture product snapshot/claim content run. Agent Worker dapat memulai riset lebih dahulu.

Bekukan satu ownership model:

- pilihan yang disarankan: create endpoint hanya membuat durable content run `queued`; Content Automation Worker melakukan product snapshot lalu membuat/reuse Agent Run; atau
- bila Agent Run wajib dibuat saat enqueue, status awal harus non-dispatchable sampai Content Worker menandai context siap.

Tidak boleh ada kondisi Agent Worker mengirim riset sebelum product snapshot dan immutable task context siap. Buktikan event order dengan integration test.

### 6. Skill meminta scope yang tidak diperlukan

Untuk run-once `draft_only`, skill hanya memerlukan:

```text
automation:read
automation:write
```

Jangan mewajibkan `publishing:read` atau `publishing:plan` untuk alur ini. Scope publishing hanya boleh diperiksa saat pengguna benar-benar memakai fitur publishing plan.

Tambahkan test bahwa credential Hermes Dev saat ini dapat menjalankan whoami/catalog/run-once tanpa scope publishing, tetapi tetap mendapat 403 pada endpoint publishing.

### 7. Deploy dan instalasi skill belum dilakukan

Setelah seluruh test berhasil:

1. deploy hanya ke Mac Mini Dev dengan `npm run deploy:macmini-dev`;
2. verifikasi `~/maknaflow-dev/package.json` menjalankan release baru, bukan `v2.29.5`;
3. install/sync skill terbaru ke:
   `~/.hermes/skills/autonomous-ai-agents/makna-content-orchestrator/`;
4. verifikasi `hermes skills list` menunjukkan enabled dan versi skill terbaru;
5. jangan membaca atau mencetak nilai token;
6. jangan deploy Staging atau Production.

### 8. Configuration readiness belum lengkap

Jangan mengaktifkan worker sebelum konfigurasi berikut terbukti sehat:

- `MAKNA_OPERATOR_BASE_URL=http://127.0.0.1:5020` pada proses Hermes;
- credential Hermes minimum-scope valid;
- MAKNA memiliki Hermes Runs API base URL/key yang valid;
- callback signing secret terpasang dan cukup kuat;
- Hermes gateway/Runs API reachable dari MAKNA Dev;
- callback complete/fail dapat mencapai MAKNA Dev;
- auto-publish tetap off.

Semua pemeriksaan harus melaporkan `configured/absent`, bukan nilainya.

## Test yang Wajib Ditambahkan

Test sekarang terlalu dangkal. Tambahkan:

1. DB integration test enqueue memakai schema nyata/isolated test schema.
2. Test query Brand Profile dan Product benar-benar berhasil.
3. Feature flag absent/false/true.
4. Preset system dan custom tenant compatibility.
5. Transaction rollback pada injected failure.
6. Concurrency/idempotency sebagaimana di atas.
7. Event ordering: content run claim → snapshot ready → agent run scheduled → research dispatch.
8. Create endpoint tidak memanggil Hermes/Gemini/G-Labs/Repliz inline.
9. Response time target `< 2 detik` pada enqueue yang sehat.
10. Status endpoint tenant isolation dan redaction.
11. `draft_only` menghasilkan nol `agent_publishing_intents`, nol `publishing_jobs`, dan nol Repliz call.
12. Session `run-now` dan recurring automation tidak mengalami regresi.

Jalankan minimal:

```bash
node --test tests/content-run-once.test.js tests/agent-automation.test.js tests/hermes-client.test.js
npm run test:content-automation
npm run test:operator-content
npm run test:publishing-scheduler
npm run build
```

Jika integration suite membutuhkan DB, jalankan terhadap Mac Mini Dev/test schema secara aman. Jangan menyatakan lulus bila test sebenarnya skip atau DB tidak tersedia.

## Urutan Rollout Dev yang Wajib

1. Perbaiki kode dan test lokal/integration.
2. Set `ENABLE_HERMES_RUN_ONCE=false`; deploy Dev.
3. Verifikasi unauthenticated 401, wrong scope 403, absent/false flag disabled.
4. Verifikasi migration dan query nyata.
5. Verifikasi Hermes API/callback readiness tanpa secret.
6. Set `ENABLE_HERMES_RUN_ONCE=true`, tetapi Agent Worker masih off.
7. Enqueue fixture/request aman; buktikan HTTP 202 cepat dan durable queued run. Jangan memakai produk user terlebih dahulu.
8. Pastikan belum ada research dispatch saat worker off.
9. Aktifkan Agent Worker Dev hanya setelah readiness lulus.
10. Dengan izin eksplisit pengguna untuk smoke, jalankan tepat satu request:
    - Brand: `dapurbotani`
    - Product: `Rolled Oat Premium Sahabat`
    - Preset: `dapurbotani_kampanye_produk_4_klip`
    - Video count: `6`
    - Research: enabled
    - Review: `start_frames`
    - Publishing: `draft_only`
11. Berhenti di `awaiting_manual_review`. Jangan approve start frame.
12. Buktikan publishing intent/job count tetap nol.

## Execution Plan Discipline

Perbarui `## Execution Task List` di:

`plans/hermes-integration/run-once-implementation-plan.md`

Aturan:

- Ubah menjadi `[x]` hanya setelah ada bukti aktual.
- Item deploy, configuration readiness, smoke, dan zero-publishing tidak boleh ditandai selesai berdasarkan asumsi.
- Tambahkan Before/After snippet ke plan untuk setiap file tambahan sebelum mengeditnya.

## Release Discipline

Release `v2.29.6` tidak boleh dianggap final. Setelah remediasi dan seluruh verifikasi berhasil:

1. buat patch release baru;
2. push branch dan tag;
3. deploy patch tersebut hanya ke Dev;
4. verifikasi remote version/tag dan worktree bersih;
5. jangan deploy Production.

## Required Handoff Evidence

Laporkan secara terstruktur:

- daftar temuan dan fix masing-masing;
- file/line yang berubah;
- test command serta pass/fail/skip sebenarnya;
- release version, commit, tag;
- versi MAKNA Dev dan versi skill Hermes terpasang;
- feature flag dan worker state tanpa secret;
- endpoint response time;
- run/agent/task IDs smoke yang aman;
- event ordering;
- jumlah publishing intent/job sebelum dan sesudah smoke;
- konfirmasi bahwa Staging, Production, dan auto-publish tidak disentuh.

Jangan meminta pengguna mencoba Hermes sebelum seluruh acceptance evidence di atas tersedia. Jika ada blocker, laporkan blocker secara jujur dan biarkan feature flag/worker tetap off.
